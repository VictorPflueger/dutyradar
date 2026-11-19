// Audit log: the specification's AuditEvents, append-only, held in memory and mirrored to
// sessionStorage under dr.audit.<run_id> on a best-effort basis. Input digests are SHA-256 hashes of
// the canonical JSON input (Web Crypto). Keys and authorization headers never enter the log: every
// event is redacted before it is stored.

import { STORAGE } from "./config.js";
import { redactSecrets } from "./keystore.js";

export const AUDIT_EVENTS = ["run_started", "mode_set", "model_request", "model_response", "tool_called", "tool_result", "audit_failed", "cluster_split", "decision_recorded", "parameter_changed", "export_created", "cap_reached", "run_stopped", "error"];

/** JSON with sorted object keys, so equal inputs give equal digests. */
export function canonicalJson(value) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, walk(v[k])]));
    return v;
  };
  return JSON.stringify(walk(value));
}

export async function sha256Digest(value) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : canonicalJson(value));
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Removes anything key-like and every authorization header from an event, recursively. */
function redact(value) {
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = /^(x-api-key|authorization|api[_-]?key)$/i.test(k) ? "[REDACTED]" : redact(v);
    return out;
  }
  return value;
}

/**
 * One run's log. record(event, fields) appends an AuditEvent and returns it; fields may carry tool,
 * input (digested, not stored), output_ref, model, usage, cost_eur, actor and details.
 */
export function createAuditLog({ runId, mode, now = () => new Date() }) {
  const events = [];
  let seq = 0;
  let currentMode = mode;
  const mirror = () => {
    try { sessionStorage.setItem(STORAGE.audit(runId), JSON.stringify(events)); } catch { /* best effort */ }
  };
  return {
    runId,
    async record(event, { actor = "agent", tool = null, input, output_ref = null, model = null, usage = null, cost_eur = null, details = null } = {}) {
      if (event === "mode_set" && details?.mode) currentMode = details.mode;
      seq += 1;
      const ev = redact({
        id: `A-${String(seq).padStart(6, "0")}`,
        ts: now().toISOString(),
        run_id: runId,
        mode: currentMode,
        actor,
        event,
        tool,
        input_digest: input === undefined ? null : await sha256Digest(input),
        output_ref,
        model,
        usage,
        cost_eur,
        ...(details ? { details } : {})
      });
      events.push(ev);
      mirror();
      return ev;
    },
    events: () => events.slice(),
    /** The export: the log with the run's mode, model, settings, facts and decisions. */
    exportJson({ model = null, settings = {}, facts = [], decisions = [] } = {}) {
      return JSON.stringify(redact({ run_id: runId, mode: currentMode, model, settings, exported_at: now().toISOString(), facts, decisions, events }), null, 2);
    }
  };
}
