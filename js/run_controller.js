// One run at a time: loads what it needs, creates the run state and the audit log, and drives the replay
// (Simulation) or the Live loop (Live, Sovereign). The screens read the state and listen to the
// RunEvents; the presenter's decisions go straight into the state, which the waiting tool notices.
// Pause and the replay speed act on the replay's clock; the clock stands still while a decision is open.

import { bus, emitRunEvent } from "./events.js";
import { createRunState } from "./state.js";
import { createAuditLog } from "./audit.js";
import { replayRun } from "./simulation.js";
import { createLiveAgent } from "./agent.js";
import { sliceNormIds, DATA_FILES } from "./data.js";
import { lang } from "./i18n.js";
import { RUN_DEFAULTS } from "./config.js";
import { createSubcallLog } from "./recorder.js";

/** The norms a Live run of each scripted run works on (R3: one norm end to end). */
export const LIVE_NORMS = { R3: ["enstatg_2017"], R2: ["milog", "aentg_2009", "milomeldv"] };

export function createRunController({ store, fetchJson, onKeyRejected }) {
  let run = null; // { id, mode, lang, state, audit, data, recording, status, paused, speed, review, aborter }
  const listeners = new Set();
  const changed = () => { for (const fn of listeners) fn(run); };
  let speed = 1;
  let liveAgent = null;

  /** The replay's clock: waits ms / speed in small steps, holding while paused. */
  function pacedWait(r) {
    return async (ms) => {
      let left = ms;
      while (left > 0) {
        if (r.aborter.signal.aborted) return;
        await new Promise((res) => setTimeout(res, 50));
        if (!r.paused) left -= 50 * speed;
      }
    };
  }

  async function start({ runId, mode, settings = {}, sovereign = null }) {
    stop();
    const recording = mode === "simulation" ? await fetchJson(DATA_FILES.recording(runId)) : null;
    const index = (await store.load([])).index;
    const normIds = recording ? recording.meta.norm_ids : LIVE_NORMS[runId] || index.norms.map((n) => n.id);
    const data = await store.load(normIds);
    const l = lang();
    const liveId = mode === "simulation" ? runId : `L-${runId}`;
    const state = createRunState({ data, lang: l, runId: liveId, mode });
    const audit = createAuditLog({ runId: liveId, mode });
    const model = mode === "live" ? settings.orchestrator_model || RUN_DEFAULTS.orchestrator_model : mode === "sovereign" ? sovereign?.model || null : null;
    run = { id: runId, runId: liveId, mode, lang: l, state, audit, data, recording, normIds, model, subcalls: mode === "simulation" ? null : createSubcallLog(l), status: "running", paused: false, review: null, aborter: new AbortController(), events: [], reviewMs: [], requestedAt: null };
    const r = run;
    state.onChange(() => { if (run === r) bus.emit("state_changed", {}); });
    const mine = (ev) => run === r && ev.run_id === r.runId;
    const offs = [
      bus.onAny((ev) => { if (mine(ev)) r.events.push({ type: ev.type, payload: ev.payload, agent: ev.agent, seq: ev.seq, t_ms: ev.t_ms }); }),
      // The time from a request to the reviewer's decision, for the median in the run figures.
      bus.on("decision_requested", (ev) => { if (mine(ev) && ev.payload.kind !== "cluster") r.requestedAt = Date.now(); }),
      // The reviewer's decisions and cluster splits are logged here for every mode.
      bus.on("decision_recorded", (ev) => {
        if (!mine(ev)) return;
        if (r.requestedAt !== null) { r.reviewMs.push(Date.now() - r.requestedAt); r.requestedAt = null; }
        audit.record("decision_recorded", { actor: "human", details: ev.payload.decision });
      }),
      bus.on("cluster_split", (ev) => { if (mine(ev)) audit.record("cluster_split", { actor: "human", details: ev.payload }); })
    ];
    r.off = () => { for (const off of offs) off(); };
    changed();
    try {
      if (mode === "simulation") {
        await audit.record("run_started", { actor: "human", details: { mode, run: runId, source: recording.meta.source } });
        await audit.record("mode_set", { actor: "human", details: { mode } });
        state.setEmitter(null);
        const result = await replayRun({
          run: recording, data, state, lang: l, signal: r.aborter.signal,
          wait: pacedWait(r),
          emit: (ev) => {
            if (run !== r) return;
            emitRunEvent(ev);
            if (ev.type === "tool_call") audit.record("tool_called", { actor: "agent", tool: ev.payload.tool, input: ev.payload.input, output_ref: ev.payload.tool_use_id });
            if (ev.type === "tool_result") audit.record("tool_result", { actor: "agent", tool: ev.payload.tool, output_ref: ev.payload.tool_use_id, details: { ok: ev.payload.ok } });
            if (ev.type === "audit_failed") audit.record("audit_failed", { actor: "agent", tool: ev.payload.tool || null, details: { tokens: ev.payload.tokens } });
          },
          awaitDecision: (req) => state.waitForDecision(req.option_ids, r.aborter.signal),
          awaitReview: (req, recorded) => {
            r.review = { cluster_id: req.cluster_id, recorded };
            changed();
            return state.waitForReview(req.cluster_id, r.aborter.signal).finally(() => { r.review = null; changed(); });
          }
        });
        r.status = result.status === "done" ? "done" : result.status;
        await audit.record("run_stopped", { actor: "system", details: { status: r.status } });
      } else {
        liveAgent = createLiveAgent({ hooks: { onKeyRejected, onSubcall: (kind, input, output) => r.subcalls.add(kind, input, output) } });
        const res = await liveAgent.run({ runId: liveId, lang: l, mode, modelId: settings.orchestrator_model || RUN_DEFAULTS.orchestrator_model, data, state, audit, normIds, sovereign, settings });
        r.status = res.status;
      }
    } catch (e) {
      if (e?.name !== "AbortError") { console.error("[Duty Radar] run failed:", e); r.status = "error"; }
    } finally {
      if (run === r) changed();
    }
    return r.status;
  }

  function stop() {
    if (!run) return;
    run.aborter.abort();
    liveAgent?.abort();
    run.off?.();
    if (run.status === "running") {
      run.status = "aborted";
      emitRunEvent({ run_id: run.runId, seq: 0, t_ms: 0, mode: run.mode, agent: "human", type: "run_finished", payload: { status: "aborted" } });
    }
  }

  return {
    start,
    abort() { stop(); changed(); },
    reset() { stop(); run = null; bus.emit("run_reset", {}); changed(); },
    pause(p) { if (run) { run.paused = p; changed(); } },
    setSpeed(x) { speed = x; changed(); },
    speed: () => speed,
    current: () => run,
    /** Applies the presenter's cluster review in Simulation: only the recorded action is allowed. */
    review({ cluster_id, action, separate_ids }) { return run.state.reviewCluster({ cluster_id, action, separate_ids }); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    sliceNormIds: () => sliceNormIds(store.get())
  };
}
