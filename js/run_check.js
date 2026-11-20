// The recorded-run checker (AC-16), shared by tools/check-runs.mjs and Assumptions & diagnostics. A run
// fails when a recorded text holds a number outside placeholders, an unknown fact or cite id, a
// key-like string or a thinking block; when it holds an event that depends on an option decision
// (decision_recorded, dossier_updated, a ui_report call) or outcome words after a decision request;
// when a text lacks a language or the two languages differ in their placeholders; when a decision
// request lacks its intention; when narration after a decision request announces a later request
// without naming its target (for_request), so it would play after any decision; or when the run is
// not marked hand-authored (or recorded with a model).
// Texts inside audit_failed events and amendment attempts marked expect_audit "fail" are what the UI
// never shows; the latter must fail the audit, or the checker says so.

import { auditText } from "./engine/auditor.js";
import { RUN_EVENT_TYPES } from "./events.js";

const KEYLIKE = /sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bghp_[A-Za-z0-9]{30,}|\bxox[abp]-[A-Za-z0-9-]{10,}/;
const OUTCOME = /\b(approved|rejected|accepted|freigegeben|abgelehnt|angenommen|genehmigt)\b/i;
const placeholders = (s) => (String(s).match(/\{\{(?:fact|cite):[^{}\s]+\}\}/g) || []).sort().join(" ");
const isBilingual = (v) => v && typeof v === "object" && !Array.isArray(v) && ("en" in v || "de" in v) && Object.keys(v).every((k) => k === "en" || k === "de");

/** problems[] for one run; data: the bundled data with the run's norms loaded. */
export function checkRun(run, { data }) {
  const problems = [];
  const where = (i, e) => `event ${i + 1} (${e?.type}${e?.payload?.tool ? ` ${e.payload.tool}` : ""})`;
  const meta = run?.meta || {};
  if (!(meta.source === "hand-authored" || (meta.source === "recorded" && meta.recorded_with))) problems.push(`the run is not marked hand-authored (source ${meta.source ?? "missing"})`);
  if (KEYLIKE.test(JSON.stringify(run))) problems.push("the run holds a key-like string");
  const factIds = new Set(Object.keys(run.facts || {}));
  const classified = new Set(Object.keys(run.recorded?.classifications || {}));
  const ctx = (lang) => ({
    lang,
    facts: factIds,
    paragraphs: data.paragraphs,
    duties: { has: (id) => classified.has(id), get: (id) => ({ paragraph_id: id.replace(/^D-/, "").replace(/-\d+$/, "") }) },
    clusters: new Map(Object.entries(meta.clusters || {}).map(([id, paragraph_ids]) => [id, { paragraph_ids }])),
    complaints: data.complaintsById,
    dates: new Set([data.retrievedDate].filter(Boolean))
  });
  const audit = (text, lang, label) => {
    const r = auditText(text, ctx(lang));
    if (!r.pass) problems.push(`${label}: ${r.violations.map((v) => v.token).join(", ")} (${lang})`);
  };
  const checkText = (value, label, { outcomeGuard = false } = {}) => {
    if (!isBilingual(value)) { problems.push(`${label}: not a text in both languages`); return; }
    for (const lang of ["en", "de"]) {
      if (typeof value[lang] !== "string" || !value[lang].trim()) { problems.push(`${label}: the ${lang} text is missing`); return; }
    }
    if (placeholders(value.en) !== placeholders(value.de)) problems.push(`${label}: the languages differ in their placeholders`);
    audit(value.en, "en", label);
    audit(value.de, "de", label);
    if (outcomeGuard && (OUTCOME.test(value.en) || OUTCOME.test(value.de))) problems.push(`${label}: refers to a decision's outcome`);
  };
  const thinking = (v) => JSON.stringify(v).match(/"(?:thinking|signature|redacted_thinking)"\s*:|"type"\s*:\s*"(?:thinking|redacted_thinking)"/);

  let afterDecision = false;
  (run.events || []).forEach((e, i) => {
    const label = where(i, e);
    if (!RUN_EVENT_TYPES.includes(e.type)) problems.push(`${label}: unknown event type`);
    if (thinking(e)) problems.push(`${label}: holds a thinking block`);
    if (e.type === "decision_recorded" || e.type === "dossier_updated") problems.push(`${label}: depends on an option decision`);
    if (e.type === "audit_failed") return;
    if (e.type === "plan" || e.type === "agent_text") checkText(e.payload?.text, label, { outcomeGuard: afterDecision });
    if (e.type !== "tool_call") return;
    const tool = e.payload?.tool;
    const input = e.payload?.input || {};
    if (tool === "ui_report") problems.push(`${label}: a recording holds no ui_report call`);
    if (tool === "ui_progress") checkText(input.message, label, { outcomeGuard: afterDecision });
    if (tool === "ui_progress" && e.payload.for_request !== undefined) {
      const next = (run.events || []).slice(i + 1).find((x) => x.type === "tool_call" && x.payload?.tool === "ui_request_decision" && x.payload.input?.option_ids);
      if (next?.payload.input.target !== e.payload.for_request) problems.push(`${label}: for_request ${e.payload.for_request} is not the target of the next decision request`);
    }
    // Narration that names the next request's step ("decide") after a request on the same target
    // depends on that request's outcome; it must say so with for_request.
    if (tool === "ui_progress" && afterDecision && input.step === "decide" && e.payload.for_request === undefined) problems.push(`${label}: announces a decision request after a decision without for_request`);
    if (tool === "audit_check" && typeof input.text !== "string" && input.text !== undefined) checkText(input.text, label);
    if (tool === "ui_request_decision" && input.option_ids) {
      const it = e.payload.intended;
      if (!it || !input.option_ids.includes(it.option_id) || !["approved", "rejected", "needs_info"].includes(it.decision) || !it.reason_code) problems.push(`${label}: the decision request lacks its intention`);
      afterDecision = true;
    }
  });
  for (const [cid, c] of Object.entries(run.recorded?.classifications || {})) {
    if (thinking(c)) problems.push(`classification ${cid}: holds a thinking block`);
    if (c.is_duty !== false || c.rationale) checkText(c.rationale, `classification ${cid} rationale`);
    for (const k of ["frequency_per_year", "confidence", "eu_related"]) if (k in c) problems.push(`classification ${cid}: holds the numeric field ${k}`);
  }
  for (const [oid, list] of Object.entries(run.recorded?.amendments || {})) {
    (list || []).forEach((a, n) => {
      const label = `amendment ${oid} attempt ${n + 1}`;
      const w = auditText(a.wording || "", ctx("de"));
      const g = typeof a.gist_en === "string" ? auditText(a.gist_en, ctx("en")) : { pass: true, violations: [] };
      if (a.expect_audit === "fail") { if (w.pass && g.pass) problems.push(`${label}: marked to fail the audit, but passes`); return; }
      if (!w.pass) problems.push(`${label}: ${w.violations.map((v) => v.token).join(", ")} (de)`);
      if (!g.pass) problems.push(`${label} gist: ${g.violations.map((v) => v.token).join(", ")} (en)`);
      if (!String(a.wording || "").trim().endsWith("[Entwurf, rechtlich zu prüfen]")) problems.push(`${label}: lacks the closing marker`);
    });
  }
  return problems;
}
