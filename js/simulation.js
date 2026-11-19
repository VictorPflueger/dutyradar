// The replay of a recorded run (data/runs/R1.json …): the same tools and engines as a Live run, with the
// two sub-calls answered from the recording. Engines recompute every figure from the bundled data,
// and the recorded fact ids are bound to their keys first, so a replay never shows a number the engine
// would not produce. Option decisions are the presenter's (the recording's intention is never
// applied); a cluster review accepts only the recorded action. Decision-dependent events and the
// closing report are generated from what the presenter actually decided. Pure apart from the injected
// wait and emit, so Node tests replay runs headless (PLAN.md 5.5).

import { createToolbox } from "./tools/registry.js";
import { roleOfTool } from "./events.js";
import { buildClosingReport } from "./report.js";

/** Picks the run's language from a { en, de } text; other values pass through. */
export function localize(value, lang) {
  if (Array.isArray(value)) return value.map((v) => localize(v, lang));
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 2 && keys.includes("en") && keys.includes("de") && keys.every((k) => typeof value[k] === "string")) return value[lang] ?? value.en;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v, lang)]));
  }
  return value;
}

/** The recorded result of a cluster review that follows a request in the stream. */
function recordedReview(events, index, clusterId) {
  for (let i = index + 1; i < events.length; i++) {
    const e = events[i];
    if ((e.type === "cluster_split" || e.type === "cluster_confirmed") && e.payload?.cluster_id === clusterId) {
      return e.type === "cluster_split" ? { action: "split", separate_ids: e.payload.separate_ids || [] } : { action: "confirm" };
    }
  }
  return { action: "confirm" };
}

/**
 * Replays a run. wait(ms) paces the events (scaled and paused by the caller); emit(RunEvent) delivers
 * them; awaitDecision(req) resolves with the presenter's Decision for an option request;
 * awaitReview(req, recorded) resolves when the recorded cluster action has been applied (by default it
 * is applied at once). Returns { status }.
 */
export async function replayRun({ run, data, state, lang, wait = async () => {}, emit = () => {}, awaitDecision, awaitReview = null, signal = null }) {
  for (const [id, key] of Object.entries(run.facts || {})) state.facts.bind(id, key);
  const rec = run.recorded || {};
  const attempts = new Map();
  let seq = 0;
  let clock = 0;
  const out = (type, payload, agent) => {
    seq += 1;
    emit({ run_id: run.meta.run_id, seq, t_ms: clock, mode: "simulation", agent, type, payload });
  };
  state.setEmitter((type, payload) => out(type, payload, type === "decision_recorded" || type.startsWith("cluster_") ? "human" : "ui"));
  let pendingReview = null;
  const hooks = {
    classifierModel: null,
    classify: async (batch) => ({ classifications: batch.map((b) => localize(rec.classifications?.[b.candidate_id], lang) || { candidate_id: b.candidate_id }) }),
    amend: async ({ option }) => {
      const list = rec.amendments?.[option.id] || [];
      const n = attempts.get(option.id) || 0;
      attempts.set(option.id, n + 1);
      const a = list[Math.min(n, list.length - 1)] || {};
      return { wording: a.wording ?? "", gist_en: lang === "en" ? a.gist_en ?? null : null };
    },
    requestDecision: async (req) => {
      if (req.kind === "cluster") {
        const recorded = pendingReview || { action: "confirm" };
        if (awaitReview) return awaitReview(req, recorded);
        return state.reviewCluster({ cluster_id: req.cluster_id, action: recorded.action, separate_ids: recorded.separate_ids || [] });
      }
      return awaitDecision ? awaitDecision(req) : null;
    }
  };
  const toolbox = createToolbox({
    data, state, lang, hooks, signal,
    emit: (type, payload) => out(type, payload, type === "audit_failed" ? "fact_auditor" : type === "agent_text" ? payload.agent || "orchestrator" : "ui")
  });

  out("run_started", { run_id: run.meta.run_id, title: run.meta.title ? localize(run.meta.title, lang) : null, norm_ids: run.meta.norm_ids, lang, mode: "simulation", source: run.meta.source });
  const events = run.events || [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const dt = Math.max(0, (e.t_ms || 0) - clock);
    if (dt) await wait(dt);
    clock = Math.max(clock, e.t_ms || 0);
    if (signal?.aborted) return { status: "aborted" };
    if (e.type === "plan" || e.type === "agent_text") {
      out(e.type, { ...localize(e.payload, lang), lang }, e.agent || "orchestrator");
      continue;
    }
    if (e.type !== "tool_call") continue; // results, reviews and audits are recomputed, never replayed
    const tool = e.payload.tool;
    const input = localize(e.payload.input || {}, lang);
    if (tool === "ui_request_decision" && input.target && state.targets.get(input.target)?.decided) continue;
    if (tool === "ui_request_decision" && input.cluster_id) pendingReview = recordedReview(events, i, input.cluster_id);
    const role = roleOfTool(tool);
    out("tool_call", { tool, tool_use_id: e.payload.tool_use_id, input }, role);
    const res = await toolbox.execute(tool, input, { intended: e.payload.intended || null });
    out("tool_result", { tool, tool_use_id: e.payload.tool_use_id, ok: !res.isError, summary: res.summary, content: res.isError ? res.content : null, expected_error: Boolean(e.payload.expect_error) }, role);
    pendingReview = null;
  }
  const text = buildClosingReport(state);
  state.setReport({ text, source: "template", lang });
  out("agent_text", { kind: "report", text, lang, source: "template" }, "ui");
  out("run_finished", { status: "done", report: text }, "orchestrator");
  return { status: "done" };
}
