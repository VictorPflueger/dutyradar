// A scripted stand-in for POST /v1/messages that streams realistic SSE and checks every request against
// the protocol rules the Live loop must follow (TECH_NOTES §11, AC-11). It serves the orchestrator's
// conversation and the two sub-calls (classification, amendment) in the order the script lists them.
import { isDeepStrictEqual } from "node:util";

export const CATALOGUE = ["law_list", "law_fetch", "law_search", "duty_extract", "duty_classify", "once_cluster", "once_registers", "cost_params", "cost_estimate", "signal_match", "draft_options", "draft_amendment", "audit_check", "ui_progress", "ui_request_decision", "ui_report"];

export function sseFor({ id, model = "claude-sonnet-5-5", blocks, stop, usage = {}, cut = null, midError = null }) {
  const ev = [];
  const push = (event, data) => ev.push(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  push("message_start", { type: "message_start", message: { id, type: "message", role: "assistant", model, content: [], stop_reason: null, usage: { input_tokens: usage.input_tokens ?? 1500, cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0, cache_read_input_tokens: usage.cache_read_input_tokens ?? 0, output_tokens: 1 } } });
  blocks.forEach((b, i) => {
    if (b.type === "text") {
      push("content_block_start", { type: "content_block_start", index: i, content_block: { type: "text", text: "" } });
      for (const piece of chunks(b.text, 17)) push("content_block_delta", { type: "content_block_delta", index: i, delta: { type: "text_delta", text: piece } });
    } else if (b.type === "thinking") {
      push("content_block_start", { type: "content_block_start", index: i, content_block: { type: "thinking", thinking: "", signature: "" } });
      for (const piece of chunks(b.thinking, 23)) push("content_block_delta", { type: "content_block_delta", index: i, delta: { type: "thinking_delta", thinking: piece } });
      push("content_block_delta", { type: "content_block_delta", index: i, delta: { type: "signature_delta", signature: b.signature } });
    } else if (b.type === "tool_use") {
      push("content_block_start", { type: "content_block_start", index: i, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } });
      const json = cut === i ? JSON.stringify(b.input).slice(0, 25) : JSON.stringify(b.input);
      for (const piece of chunks(json, 29)) push("content_block_delta", { type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: piece } });
    }
    push("content_block_stop", { type: "content_block_stop", index: i });
  });
  if (midError) {
    push("error", { type: "error", error: { type: midError.type || "overloaded_error", message: midError.message || "Overloaded" } });
    return ev.join("");
  }
  push("message_delta", { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: usage.output_tokens ?? 600 } });
  push("message_stop", { type: "message_stop" });
  return ev.join("");
}

function chunks(s, n) {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out.length ? out : [""];
}

/** What the loop should have sent back for an earlier assistant turn. */
function stripForEcho(blocks) {
  return blocks.map((b) => {
    if (b.type === "text") return { type: "text", text: b.text };
    if (b.type === "thinking") return { type: "thinking", thinking: b.thinking, signature: b.signature };
    return { type: b.type, id: b.id, name: b.name, input: b.input };
  });
}

/** The kind of conversation a request belongs to, from the tools it offers. */
export function kindOf(req) {
  const names = (req.tools || []).map((t) => t.name);
  if (names.length === 1 && names[0] === "submit_classification") return "classify";
  if (names.length === 1 && names[0] === "submit_amendment") return "amend";
  return "orchestrator";
}

/**
 * script: steps in request order. A step is a response { kind?, blocks, stop, usage, expect?(req, ctx) }
 * or an error { error: { status, type, message, headers? } } returned once. kind names the
 * conversation the request must belong to ("orchestrator" by default, "classify", "amend").
 * repeat: a function (n) → step used once the script is exhausted (for the cap tests).
 */
export function createFakeClaude(script, { repeat = null, orchestratorModel = "claude-sonnet-5-5" } = {}) {
  const violations = [];
  const requests = [];
  const sent = [];        // orchestrator assistant turns as sent (only kept turns)
  let i = 0;

  function check(cond, msg) { if (!cond) violations.push(`request ${requests.length}: ${msg}`); }

  function validate(req, headers, kind) {
    check(/^sk-ant-/.test(headers["x-api-key"] || ""), "x-api-key missing");
    check(headers["anthropic-version"] === "2023-06-01", `anthropic-version ${headers["anthropic-version"]}`);
    check(headers["anthropic-dangerous-direct-browser-access"] === "true", "direct browser access header missing");
    check(req.stream === true, "stream must be true");
    check(typeof req.max_tokens === "number" && req.max_tokens > 0, "max_tokens missing");
    check(req.tool_choice?.type === "auto", "tool_choice must be auto");
    for (const k of ["temperature", "top_p", "top_k"]) check(!(k in req), `${k} must not be sent`);
    check(Array.isArray(req.tools) && req.tools.every((t) => t.strict === true && t.input_schema?.type === "object" && !t.type), "every tool must be a strict client tool");
    if (kind === "orchestrator") {
      check(JSON.stringify(req.tools.map((t) => t.name)) === JSON.stringify(CATALOGUE), `the sixteen tools must be sent (got ${req.tools?.length})`);
      check(typeof req.system === "string" && /^(You are the orchestrator of Duty Radar|Du bist der Orchestrator von Pflichten-Radar)/.test(req.system), "orchestrator system prompt missing");
      check(req.model === orchestratorModel, `orchestrator model ${req.model}`);
      check(req.output_config?.effort === "medium", `orchestrator effort ${req.output_config?.effort}`);
      check(req.thinking?.type === "adaptive", "adaptive thinking expected");
      // Every assistant turn must be echoed exactly; every tool_use must be answered next, results first.
      const msgs = req.messages || [];
      let a = 0;
      msgs.forEach((m, k) => {
        if (m.role !== "assistant") return;
        const expected = sent[a];
        check(expected && isDeepStrictEqual(m.content, expected), `assistant turn ${a + 1} was not passed back unchanged`);
        a += 1;
        const uses = m.content.filter((b) => b.type === "tool_use");
        const next = msgs[k + 1];
        if (uses.length) {
          check(next && next.role === "user", "tool_use not followed by a user message");
          const content = Array.isArray(next?.content) ? next.content : [];
          const results = content.filter((b) => b.type === "tool_result");
          for (const u of uses) check(results.some((r) => r.tool_use_id === u.id), `tool_use ${u.id} has no tool_result`);
          const firstOther = content.findIndex((b) => b.type !== "tool_result");
          check(firstOther === -1 || content.slice(firstOther).every((b) => b.type !== "tool_result"), "tool_result blocks must come first");
        }
      });
    } else {
      check(req.messages?.length === 1 && req.messages[0].role === "user", "a sub-call is a single user turn");
      check(req.max_tokens === 8000, `sub-call max_tokens ${req.max_tokens}`);
      if (kind === "classify") {
        check(req.model === "claude-haiku-5-5", `classification model ${req.model}`);
        check(req.output_config?.effort === "low", `classification effort ${req.output_config?.effort}`);
      } else {
        check(req.output_config?.effort === "medium", `amendment effort ${req.output_config?.effort}`);
      }
    }
  }

  return {
    violations, requests, sent,
    remaining: () => script.length - i,
    handle(raw, headers) {
      const req = JSON.parse(raw);
      const kind = kindOf(req);
      requests.push({ req, headers, kind });
      validate(req, headers, kind);
      const step = i < script.length ? script[i] : repeat ? repeat(requests.length) : null;
      i += 1;
      if (!step) {
        violations.push(`unexpected request ${requests.length} (script exhausted)`);
        return { status: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "error", error: { type: "api_error", message: "script exhausted" } }) };
      }
      check((step.kind || "orchestrator") === kind, `expected a ${step.kind || "orchestrator"} request, got ${kind}`);
      try { step.expect?.(req, { check }); } catch (e) { violations.push(`request ${requests.length}: expectation threw ${e.message}`); }
      if (step.error) {
        return { status: step.error.status, headers: { "content-type": "application/json", ...(step.error.headers || {}) }, body: JSON.stringify({ type: "error", error: { type: step.error.type, message: step.error.message } }) };
      }
      const id = `msg_${requests.length}`;
      const body = sseFor({ id, model: req.model, blocks: step.blocks, stop: step.stop, usage: step.usage, cut: step.cut ?? null, midError: step.midError || null });
      if (kind === "orchestrator" && !step.discard && !step.midError) sent.push(stripForEcho(step.cut === undefined || step.cut === null ? step.blocks : step.blocks.filter((_, k) => k !== step.cut)));
      return { status: 200, headers: { "content-type": "text/event-stream", "request-id": `req_${requests.length}` }, body, delayMs: step.delayMs || 0 };
    }
  };
}

/** A fetch for Node tests: api.anthropic.com answered by the fake, every other host refused. */
export function fakeFetch(fake, { others = {} } = {}) {
  return async (url, init = {}) => {
    const u = String(url);
    if (u === "https://api.anthropic.com/v1/messages") {
      const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      const r = fake.handle(init.body, headers);
      if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
      return new Response(r.body, { status: r.status, headers: r.headers });
    }
    for (const [prefix, handler] of Object.entries(others)) if (u.startsWith(prefix)) return handler(u, init);
    throw new TypeError(`fetch to ${u} is blocked in the tests`);
  };
}

/** Tool-use and text blocks for scripts. */
export const toolUse = (id, name, input) => ({ type: "tool_use", id, name, input });
export const text = (t) => ({ type: "text", text: t });
export const thinking = (t, signature = "sig-abc") => ({ type: "thinking", thinking: t, signature });
