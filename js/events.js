// Run-event bus. Runs record and replay the specification's RunEvent types; the shell's modules
// (js/handover.js, the role strip, the status pill) listen to the shell events derived from them
// here (PLAN.md P-2), so the shell keeps its own vocabulary and the recordings keep the
// specification's.

/** The specification's RunEvent types, as recorded in data/runs/*.json. */
export const RUN_EVENT_TYPES = [
  "run_started", "plan", "tool_call", "tool_result", "agent_text", "audit_failed", "decision_requested",
  "decision_recorded", "cluster_split", "cluster_confirmed", "dossier_updated", "cap_reached", "run_finished", "error"
];

/** Run states the shell shows; each label is the i18n key state.<state>. */
export const RUN_STATES = {
  idle: "state.idle",
  running: "state.running",
  awaiting_decision: "state.awaiting_decision",
  awaiting_review: "state.awaiting_review",
  done: "state.done",
  stopped: "state.stopped",
  aborted: "state.aborted",
  error: "state.error"
};

/** Which agent role a tool belongs to, by its prefix (the console and the role strip use it). */
export const TOOL_ROLE = {
  law: "corpus", duty: "duty_extractor", once: "once_matcher", cost: "cost", signal: "signal",
  draft: "drafting", audit: "fact_auditor", ui: "ui"
};
export const roleOfTool = (tool) => TOOL_ROLE[String(tool || "").split("_")[0]] || "orchestrator";

function createBus() {
  const handlers = new Map();
  const any = new Set();
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type)?.delete(fn);
    },
    onAny(fn) {
      any.add(fn);
      return () => any.delete(fn);
    },
    emit(type, payload = {}, meta = {}) {
      const ev = { type, payload, ...meta };
      for (const fn of handlers.get(type) || []) fn(ev);
      for (const fn of any) fn(ev);
      return ev;
    }
  };
}

export const bus = createBus();

/**
 * Emits a RunEvent and the shell events derived from it: run_start, state_change, options,
 * option_decision, run_end.
 */
export function emitRunEvent(ev) {
  bus.emit(ev.type, ev.payload || {}, { run_id: ev.run_id, seq: ev.seq, t_ms: ev.t_ms, mode: ev.mode, agent: ev.agent });
  switch (ev.type) {
    case "run_started":
      bus.emit("run_start", { run_id: ev.run_id, mode: ev.mode });
      bus.emit("state_change", { state: "running" });
      break;
    case "tool_call":
      bus.emit("role_active", { role: roleOfTool(ev.payload?.tool), tool: ev.payload?.tool });
      break;
    case "decision_requested":
      if (ev.payload?.kind === "cluster") bus.emit("state_change", { state: "awaiting_review" });
      else {
        bus.emit("options", { target: ev.payload?.target });
        bus.emit("state_change", { state: "awaiting_decision" });
      }
      break;
    case "decision_recorded":
      bus.emit("option_decision", { decision: ev.payload?.decision, option_id: ev.payload?.option_id });
      bus.emit("state_change", { state: "running" });
      break;
    case "cluster_split":
    case "cluster_confirmed":
      bus.emit("state_change", { state: "running" });
      break;
    case "cap_reached":
      bus.emit("state_change", { state: "stopped" });
      break;
    case "run_finished": {
      const status = ev.payload?.status || "done";
      bus.emit("run_end", { status });
      bus.emit("state_change", { state: RUN_STATES[status] || status === "incomplete" ? status : "done" });
      break;
    }
    case "error":
      bus.emit("state_change", { state: "error" });
      break;
    default:
      break;
  }
}

let runCounter = 0;
/** A run id for a live run: L1, L2, … (recorded runs keep R1 to R3). */
export const newRunId = () => `L${++runCounter}`;
