// ?record=1 and "Record run" (PLAN.md 5.5): in Live or Sovereign mode the control bar offers Record run,
// which downloads the run's event stream for curation into data/runs/. The recording keeps what a replay
// needs (the plan, narration, tool calls with their inputs, cluster reviews, the fact ids with their keys,
// the sub-calls' answers) and leaves out what a replay recomputes or must not hold: tool results, audit
// failures, decisions and their dossier, the closing report, reasoning summaries and thinking blocks,
// and anything key-like. Texts are stored under the run's language; curation adds the other language
// and each decision request's intention before tools/check-runs.mjs accepts the file.

import { redactSecrets } from "./keystore.js";

/** True when the page was opened with ?record=1. */
export function recordingEnabled(search = globalThis.location?.search ?? "") {
  return new URLSearchParams(search).get("record") === "1";
}

/** Collects the sub-calls' answers of a Live run (hooks.onSubcall of js/agent.js). */
export function createSubcallLog(lang) {
  const classifications = {};
  const amendments = {};
  return {
    add(kind, input, output) {
      if (kind === "classify") {
        for (const c of output?.classifications || []) {
          if (!c?.candidate_id) continue;
          classifications[c.candidate_id] = { ...c, rationale: typeof c.rationale === "string" ? { [lang]: c.rationale } : c.rationale ?? null };
        }
      } else if (kind === "amend" && input?.option?.id) {
        (amendments[input.option.id] ||= []).push({ wording: output?.wording ?? "", gist_en: output?.gist_en ?? null });
      }
    },
    value: () => ({ classifications, amendments })
  };
}

const KEEP = new Set(["plan", "agent_text", "tool_call", "cluster_split", "cluster_confirmed"]);
/** Text fields of a recorded event that curation translates: { [lang]: text }. */
const wrapTexts = (ev, lang) => {
  const p = { ...ev.payload };
  if (ev.type === "plan" || ev.type === "agent_text") p.text = { [lang]: p.text };
  if (ev.type === "tool_call" && p.tool === "ui_progress" && typeof p.input?.message === "string") p.input = { ...p.input, message: { [lang]: p.input.message } };
  return p;
};

/** The recording of a run: { meta, facts, recorded, events }. */
export function recordedRun(run) {
  const lang = run.lang;
  const events = run.events
    .filter((e) => KEEP.has(e.type))
    .filter((e) => !(e.type === "agent_text" && (e.payload?.kind === "reasoning" || e.payload?.kind === "report")))
    .filter((e) => !(e.type === "tool_call" && e.payload?.tool === "ui_report"))
    .map((e, i) => ({ run_id: run.runId, seq: i + 1, t_ms: e.t_ms || 0, mode: "simulation", agent: e.agent || "orchestrator", type: e.type, payload: wrapTexts(e, lang) }));
  const facts = Object.fromEntries(Object.entries(run.state.facts.keys()).filter(([, key]) => !key.startsWith("kpi|")));
  const out = {
    meta: {
      run_id: run.runId,
      title: null,
      source: "recorded",
      recorded_with: run.model || null,
      mode: run.mode,
      lang,
      slice_id: run.data.sliceId,
      norm_ids: run.normIds || [],
      recorded_at: new Date().toISOString(),
      note: "Recorded with ?record=1. Before use: add the second language to every text, an intention to every decision request and expect_audit marks to failed amendment attempts, then run tools/check-runs.mjs."
    },
    facts,
    recorded: run.subcalls ? run.subcalls.value() : { classifications: {}, amendments: {} },
    events
  };
  // No thinking block, signature or key-like string leaves the page.
  return JSON.parse(JSON.stringify(out, (k, v) => (k === "thinking" || k === "signature" ? undefined : typeof v === "string" ? redactSecrets(v) : v)));
}
