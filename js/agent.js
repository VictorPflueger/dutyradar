// The Live loop (and Sovereign mode): Rebate Hunter's js/agent.js adapted (PLAN.md 5.1–5.3).
//
// One run = repeated calls to the model. Every assistant response goes back unchanged (thinking blocks
// and signatures included); stop_reason drives the loop:
//   tool_use   → execute the tools (independent law_* lookups in parallel), then one user message whose
//                content starts with one tool_result per tool_use id
//   pause_turn → resend as is
//   max_tokens → a cut-off tool call is discarded and retried once with half as much room again
//                (at most 128,000); otherwise "Continue from where you stopped."
//   end_turn   → done after ui_report; before it, at most two visible nudges
//   refusal, a full context window → the run ends
// Caps (PLAN.md 5.3): orchestrator and sub-calls share one gate, checked before every call: no 41st
// call, no call once €3 is spent. From 36 calls or €2.70 the next tool result carries a note to wrap
// up; at a cap the run stops cleanly with the closing report from the template. Everything the run
// does goes through RunEvents (the same stream the replay produces) and the audit log.

import { bus, emitRunEvent, roleOfTool } from "./events.js";
import { AGENT, FX_USD_EUR, RUN_DEFAULTS, MODELS } from "./config.js";
import { streamMessage, withRetry, ApiError } from "./anthropic.js";
import { usageCostUsd } from "./cost.js";
import { getKey, forgetKey } from "./keystore.js";
import { getSovereignKey, forgetSovereignKey } from "./sovereign_key.js";
import { createToolbox, TOOL_DEFS, ORDER_FREE } from "./tools/registry.js";
import { createSubcalls } from "./subcalls.js";
import { systemPrompt, openingMessage, SOFT_NOTE } from "./prompt.js";
import { buildClosingReport } from "./report.js";
import { callChat, toChatRequest, sovereignCostEur } from "./llm/openai-compat.js";
import { indexEntry } from "./data.js";
import { t } from "./i18n.js";

const ABORT = Symbol("abort");
const CONTINUE = "Continue from where you stopped.";

export class CapReached extends Error {
  constructor(cap) { super(`The run's ${cap} cap is reached.`); this.name = "CapReached"; this.cap = cap; }
}

/** One gate for every model call of a run: checked before the call, charged after it. */
export function createCallGate({ maxCalls = RUN_DEFAULTS.max_model_calls, budgetEur = RUN_DEFAULTS.max_cost_eur, softCalls = AGENT.softSteps, softEur = AGENT.softBudgetEur } = {}) {
  let calls = 0;
  let eur = 0;
  return {
    before() {
      if (calls >= maxCalls) throw new CapReached("calls");
      if (eur >= budgetEur) throw new CapReached("cost");
      calls += 1;
    },
    add(costEur) { eur += costEur; },
    soft: () => calls >= softCalls || eur >= softEur,
    snapshot: () => ({ calls, eur, maxCalls, budgetEur })
  };
}

/** hooks: { onKeyRejected(), onSubcall(kind, input, output) } */
export function createLiveAgent({ hooks = {} } = {}) {
  let current = null;

  async function run({ runId, lang = "en", mode = "live", modelId = RUN_DEFAULTS.orchestrator_model, data, state, audit, normIds, caps = null, sovereign = null, settings = {} }) {
    const set = { ...RUN_DEFAULTS, orchestrator_model: modelId, ...settings };
    const sov = mode === "sovereign" ? sovereign : null;
    const r = {
      runId, lang, mode, data, state, audit, set, sov,
      ended: false, cancelled: false, status: null,
      ac: new AbortController(),
      gate: createCallGate({ maxCalls: caps?.maxCalls ?? set.max_model_calls, budgetEur: caps?.budgetEur ?? set.max_cost_eur, softCalls: caps?.softCalls ?? AGENT.softSteps, softEur: caps?.softEur ?? AGENT.softBudgetEur }),
      maxTokens: set.max_tokens_orchestrator,
      seq: 0, t0: performance.now(), softSent: false
    };
    current = r;
    const ev = (type, payload, agent = "orchestrator") => {
      if (r.ended && !["run_finished", "cap_reached", "agent_text"].includes(type)) return;
      r.seq += 1;
      emitRunEvent({ run_id: runId, seq: r.seq, t_ms: Math.round(performance.now() - r.t0), mode, agent, type, payload });
    };
    r.ev = ev;
    state.setEmitter((type, payload) => ev(type, payload, type === "decision_recorded" || type.startsWith("cluster_") ? "human" : "ui"));
    const subcalls = createSubcalls({ call: (kind, req) => subcall(r, kind, req), data, lang, settings: set });
    // Each sub-call's answer is handed to hooks.onSubcall too, so that "Record run" can store it.
    const recorded = (kind, fn) => async (input, opts) => {
      const output = await fn(input, opts);
      hooks.onSubcall?.(kind, input, output);
      return output;
    };
    const toolbox = createToolbox({
      data, state, lang,
      hooks: { classify: recorded("classify", subcalls.classify), amend: recorded("amend", subcalls.amend), classifierModel: sov ? sov.model : set.classifier_model },
      emit: (type, payload) => {
        if (type === "audit_failed") audit.record("audit_failed", { actor: "agent", tool: payload.tool, details: { tokens: payload.tokens, option_id: payload.option_id || null, field: payload.field || null } });
        ev(type, payload, type === "audit_failed" ? "fact_auditor" : type === "agent_text" ? payload.agent || "orchestrator" : "ui");
      },
      signal: r.ac.signal
    });
    const norms = normIds.map((id) => indexEntry(data, id)).filter(Boolean);
    const system = systemPrompt(lang);
    const messages = [{ role: "user", content: openingMessage({ lang, sliceId: data.sliceId, status: data.index?.slice_status || "", norms }) }];
    let maxTokensRetried = false;
    let nudges = 0;

    await audit.record("run_started", { actor: "human", details: { mode, lang, norms: normIds, model: sov ? sov.model : modelId } });
    await audit.record("mode_set", { actor: "human", details: { mode } });
    ev("run_started", { title: null, norm_ids: normIds, lang, mode });
    bus.emit("cost_update", { ...r.gate.snapshot(), simulated: false });

    try {
      for (;;) {
        if (r.cancelled) throw ABORT;
        const call = await orchestratorCall(r, system, messages);
        const { message, incomplete } = call;
        const stop = message.stop_reason;
        if (stop === "max_tokens" && incomplete.size && !maxTokensRetried) {
          maxTokensRetried = true;
          r.maxTokens = Math.min(AGENT.maxOutputTokens, Math.round(r.maxTokens * 1.5));
          notice(r, "info", "notice.cut_tool_call");
          continue;
        }
        const kept = message.content.filter((_, i) => !incomplete.has(i));
        showText(r, kept);
        if (kept.length) messages.push({ role: "assistant", content: kept, ...(message._raw ? { _raw: message._raw } : {}) });
        if (stop === "pause_turn") continue;
        const uses = kept.filter((b) => b.type === "tool_use");
        if (stop === "tool_use" || (stop === "max_tokens" && uses.length)) {
          if (!uses.length) continue;
          const results = await runTools(r, uses, toolbox);
          if (r.gate.soft() && !r.softSent) {
            r.softSent = true;
            results.push({ type: "text", text: SOFT_NOTE });
            notice(r, "info", "notice.soft_limit");
          }
          messages.push({ role: "user", content: results });
          continue;
        }
        if (stop === "max_tokens") { pushUserText(messages, CONTINUE); continue; }
        if (stop === "refusal") return await finish(r, "error", "notice.refusal");
        if (stop === "model_context_window_exceeded") return await finish(r, "error", "notice.context_full");
        if (state.report) return await finish(r, "done");
        if (nudges < 2) {
          nudges += 1;
          notice(r, "info", "notice.nudge");
          pushUserText(messages, "Nobody can answer questions in the console, so do not wait for a reply. Continue the plan with your tools, request the open decisions with ui_request_decision and end with ui_report.");
          continue;
        }
        return await finish(r, "incomplete", "notice.incomplete");
      }
    } catch (e) {
      if (e instanceof CapReached) return await capStop(r, e.cap);
      if (e === ABORT || e?.name === "AbortError") {
        if (!r.ended) await finish(r, "aborted", r.abortReason || "notice.aborted");
        return { status: "aborted" };
      }
      return await handleError(r, e);
    } finally {
      if (current === r) current = null;
    }
  }

  // ---- model calls ----------------------------------------------------------------------------------

  async function orchestratorCall(r, system, messages) {
    r.gate.before();
    const model = r.sov ? r.sov.model : r.set.orchestrator_model;
    const body = r.sov
      ? toChatRequest({ model, system, messages, tools: TOOL_DEFS, max_tokens: r.maxTokens })
      : { model, max_tokens: r.maxTokens, system, tools: TOOL_DEFS, tool_choice: { type: "auto" }, messages, cache_control: { type: "ephemeral" }, thinking: { type: "adaptive", display: "summarized" }, output_config: { effort: r.set.orchestrator_effort } };
    return exchange(r, "orchestrator", model, body);
  }

  async function subcall(r, kind, { model, effort, system, user, tools }) {
    r.gate.before();
    const m = r.sov ? r.sov.model : model;
    const messages = [{ role: "user", content: user }];
    const body = r.sov
      ? toChatRequest({ model: m, system, messages, tools, max_tokens: r.set.max_tokens_subcall })
      : { model: m, max_tokens: r.set.max_tokens_subcall, system, tools, tool_choice: { type: "auto" }, messages, output_config: { effort }, ...(kind === "classify" ? { thinking: { type: "disabled" } } : {}) };
    const { message } = await exchange(r, kind, m, body);
    return message;
  }

  /** One model request with retries, cost and audit. */
  async function exchange(r, kind, model, body) {
    await r.audit.record("model_request", { actor: "agent", input: stripForDigest(body), model, details: { kind } });
    const out = await withRetry(
      () => (r.sov ? callChat({ config: r.sov, key: r.sov.requires_key ? getSovereignKey() : null, body, signal: r.ac.signal }).then((message) => ({ message, incomplete: new Set(), requestId: null })) : streamMessage({ key: getKey(), body, signal: r.ac.signal, idleMs: AGENT.idleTimeoutMs })),
      { retries: 2, signal: r.ac.signal, onRetry: ({ attempt, waitMs }) => notice(r, "warn", "notice.retry", { attempt, seconds: Math.round(waitMs / 1000) }) }
    );
    if (r.cancelled) throw ABORT;
    const usage = out.message.usage || {};
    const costEur = r.sov ? sovereignCostEur(r.sov, usage) : usageCostUsd(model, usage) * FX_USD_EUR;
    r.gate.add(costEur);
    bus.emit("cost_update", { ...r.gate.snapshot(), simulated: false });
    await r.audit.record("model_response", { actor: "agent", output_ref: out.message.id || out.requestId || null, model: out.message.model || model, usage: { input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0, cache_creation_input_tokens: usage.cache_creation_input_tokens || 0, cache_read_input_tokens: usage.cache_read_input_tokens || 0 }, cost_eur: costEur, details: { kind, stop_reason: out.message.stop_reason } });
    return { message: out.message, incomplete: out.incomplete || new Set() };
  }

  /** Free text and reasoning summaries reach the console only after the fact auditor passed them. */
  function showText(r, blocks) {
    for (const b of blocks) {
      const text = b.type === "text" ? b.text : b.type === "thinking" ? b.thinking : null;
      if (!text || !text.trim()) continue;
      const res = r.state.audit(text);
      if (res.pass) r.ev("agent_text", { kind: b.type === "text" ? "free" : "reasoning", text, lang: r.lang });
      else if (b.type === "text") r.ev("audit_failed", { tool: null, tokens: res.violations.map((v) => v.token), blocked_text: text }, "fact_auditor");
    }
  }

  // ---- tools ----------------------------------------------------------------------------------------

  async function runTools(r, uses, toolbox) {
    const results = new Array(uses.length);
    let i = 0;
    while (i < uses.length) {
      if (r.cancelled) throw ABORT;
      if (ORDER_FREE.has(uses[i].name)) {
        let j = i;
        while (j < uses.length && ORDER_FREE.has(uses[j].name)) j++;
        const outs = await Promise.all(uses.slice(i, j).map((b) => execOne(r, b, toolbox)));
        outs.forEach((o, k) => { results[i + k] = o; });
        i = j;
      } else {
        results[i] = await execOne(r, uses[i], toolbox);
        i += 1;
      }
    }
    return results;
  }

  async function execOne(r, block, toolbox) {
    const name = block.name;
    const role = roleOfTool(name);
    r.ev("tool_call", { tool: name, tool_use_id: block.id, input: block.input || {} }, role);
    await r.audit.record("tool_called", { actor: "agent", tool: name, input: block.input || {}, output_ref: block.id });
    let out;
    if (block.invalid_json !== undefined) {
      const msg = `The arguments of ${name} are not valid JSON: ${String(block.invalid_json).slice(0, 200)}. Call ${name} again with a JSON object.`;
      out = { content: msg, isError: true, result: { error: msg }, summary: { code: "tool.error", params: { code: "invalid_json" } } };
    } else {
      out = await toolbox.execute(name, block.input || {});
    }
    if (r.ended || r.cancelled) throw ABORT;
    r.ev("tool_result", { tool: name, tool_use_id: block.id, ok: !out.isError, summary: out.summary, error: out.isError ? out.content : null }, role);
    await r.audit.record("tool_result", { actor: "agent", tool: name, output_ref: block.id, details: { ok: !out.isError } });
    return { type: "tool_result", tool_use_id: block.id, content: out.content, ...(out.isError ? { is_error: true } : {}) };
  }

  // ---- ending -----------------------------------------------------------------------------------------

  function notice(r, level, code, params = {}) {
    bus.emit("notice", { level, code, params, text: t(code, params, r.lang) });
  }

  async function finish(r, status, reasonCode = null) {
    if (r.ended) return { status: r.status };
    r.ended = true;
    r.status = status;
    if (reasonCode) notice(r, status === "error" ? "error" : "info", reasonCode);
    await r.audit.record("run_stopped", { actor: "system", details: { status } });
    r.ev("run_finished", { status, report: r.state.report?.text || null });
    return { status };
  }

  async function capStop(r, cap) {
    const snap = r.gate.snapshot();
    const text = buildClosingReport(r.state, { cap });
    r.state.setReport({ text, source: "template", lang: r.lang });
    r.ev("cap_reached", { cap, calls: snap.calls, eur: snap.eur });
    await r.audit.record("cap_reached", { actor: "system", details: { cap, calls: snap.calls, eur: snap.eur } });
    r.ev("agent_text", { kind: "report", text, lang: r.lang, source: "template" });
    return finish(r, "stopped", cap === "cost" ? "notice.cap_cost" : "notice.cap_calls");
  }

  async function handleError(r, e) {
    let code = "notice.error";
    const params = { message: redact(e?.message || String(e)) };
    if (e instanceof ApiError || (e && typeof e.status === "number")) {
      params.status = e.status;
      // A rejected key is forgotten from its own slot: the endpoint's in Sovereign mode, else Anthropic's.
      if (e.status === 401) { code = "notice.key_rejected"; if (r.sov) forgetSovereignKey(); else { forgetKey(); hooks.onKeyRejected?.(); } }
      else if (e.spendLimit || e.status === 402) code = "notice.spend_limit";
      else if (e.status === 404) code = "notice.model_unavailable";
      else if (e.status === 400) code = "notice.bad_request";
      else if (e.status === 0) code = "notice.network";
      else if (e.retryable) code = "notice.busy";
    } else {
      console.error("[Duty Radar] live run failed:", e);
    }
    await r.audit.record("error", { actor: "system", details: { status: e?.status ?? null, type: e?.type || e?.name || "error", message: params.message } });
    notice(r, "error", code, params);
    return finish(r, "error");
  }

  function abort(reasonCode = "notice.aborted") {
    const r = current;
    if (!r || r.ended) return;
    r.cancelled = true;
    r.abortReason = reasonCode;
    r.ac.abort();
  }

  return { run, abort, isActive: () => !!current && !current.ended };
}

// ---------------------------------------------------------------------------------------------------------

function pushUserText(messages, text) {
  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const content = Array.isArray(last.content) ? last.content : [{ type: "text", text: String(last.content) }];
    last.content = [...content, { type: "text", text }];
    return;
  }
  messages.push({ role: "user", content: text });
}

const redact = (s) => String(s).replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, "sk-ant-[REDACTED]");

/** What the audit digests of a request: the body without signatures and raw provider messages. */
function stripForDigest(body) {
  return JSON.parse(JSON.stringify(body, (k, v) => (k === "signature" || k === "_raw" ? undefined : v)));
}

export const modelLabel = (id) => MODELS.find((m) => m.id === id)?.label || id;
