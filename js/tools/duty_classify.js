// Duty extractor: at most 25 candidates per call through the classification sub-call. The model
// returns categories and text only; code sets frequency, confidence, status and the EU relation
// (AC-37), maps the data items to the vocabulary, and the fact auditor checks every text before a
// card shows it (a blocked field reads "Text blocked"; no retry).
import { ToolError } from "./errors.js";
import { validate } from "./validate.js";
import { classificationTool } from "./schemas.js";
import { mapClassification } from "../engine/mappings.js";
import { mapItems } from "../engine/cluster.js";
import { auditText } from "../engine/auditor.js";

export const MAX_BATCH = 25;
const CONTEXT_CHARS = 1200;

export default {
  name: "duty_classify",
  async run({ candidate_ids }, ctx) {
    const { data, state, hooks, emit } = ctx;
    if (candidate_ids.length > MAX_BATCH) throw new ToolError(`At most ${MAX_BATCH} candidates per call; split the batch.`, "too_many");
    const cands = candidate_ids.map((id) => {
      const c = state.candidates.get(id);
      if (!c) throw new ToolError(`Unknown candidate ${id}. Call duty_extract for its norm first.`, "unknown_candidate");
      return c;
    });
    const batch = cands.map((c) => {
      const p = data.paragraphs.get(c.paragraph_id);
      const sentence = data.sentences.get(c.sentence_id);
      return { candidate_id: c.candidate_id, norm_id: c.norm_id, abbr: p?.abbr, enbez: p?.enbez, paragraph_title: p?.title || "", sentence: sentence?.text || "", paragraph_text: (p?.text || "").slice(0, CONTEXT_CHARS), type_hint: c.type_hint, pattern_ids: c.pattern_ids };
    });
    const populationIds = data.populations.map((p) => p.id);
    const schema = classificationTool(populationIds).input_schema;
    const check = (out) => {
      const errors = validate(schema, out);
      if (errors.length) return errors;
      const got = out.classifications.map((x) => x.candidate_id);
      for (const id of candidate_ids) if (got.filter((g) => g === id).length !== 1) errors.push(`classifications must hold ${id} exactly once.`);
      for (const g of got) if (!candidate_ids.includes(g)) errors.push(`${g} was not asked for.`);
      return errors;
    };
    let out = await hooks.classify(batch, { populationIds, attempt: 1 });
    let errors = check(out);
    if (errors.length) {
      out = await hooks.classify(batch, { populationIds, attempt: 2, errors });
      errors = check(out);
    }
    const model = hooks.classifierModel ?? null;
    const cards = [];
    for (const c of cands) {
      const raw = errors.length ? null : out.classifications.find((x) => x.candidate_id === c.candidate_id);
      cards.push(makeCard(c, raw, { data, state, emit, model, failed: errors.length ? errors : null }));
    }
    for (const card of cards) state.setDuty(card);
    const count = (st) => cards.filter((x) => x.status === st).length;
    const result = {
      cards: cards.map((x) => ({ id: x.id, status: x.status, type: x.type, addressee: x.addressee, trigger: x.trigger, frequency_term: x.frequency_term, population_id: x.population_id, data_items: x.data_items, eu_related: x.eu_related, protected_standard: x.protected_standard, confidence: x.classification.confidence })),
      confirmed: count("confirmed"), needs_review: count("needs_review"), rejected: count("rejected"),
      ...(errors.length ? { note: "The classification failed validation twice; the batch went to needs_review." } : {})
    };
    return { result, summary: { code: "tool.duty_classify", params: { candidates: cards.length, confirmed: result.confirmed, needs_review: result.needs_review, rejected: result.rejected } } };
  }
};

function makeCard(c, raw, { data, state, emit, model, failed }) {
  const norm = data.norms.get(c.norm_id);
  const p = data.paragraphs.get(c.paragraph_id);
  const span = { sentence_id: c.sentence_id, start: c.span.start, end: c.span.end, phrase: c.span.phrase ?? p?.text.slice(c.span.start, c.span.end) };
  const base = { id: c.candidate_id, norm_id: c.norm_id, paragraph_id: c.paragraph_id, eu_related: (norm?.eu_basis || []).length > 0, evidence_span: span, provenance: { tool: "duty_classify", run_id: state.runId }, blocked_fields: [], warnings: [] };
  if (!raw) {
    return { ...base, type: c.type_hint, addressee: null, trigger: null, frequency_per_year: null, frequency_term: null, recipient: null, data_items: [], population_id: null, protected_standard: null, classification: { method: "pattern", pattern_ids: c.pattern_ids, certainty: null, confidence: 0.5, rationale: null, model, failed }, status: "needs_review" };
  }
  const m = mapClassification(raw);
  const ctx = state.auditContext();
  const blocked = [];
  const guard = (field, text, lang) => {
    if (text === null || text === undefined || text === "") return text ?? null;
    const r = auditText(text, { ...ctx, lang });
    if (r.pass) return text;
    blocked.push(field);
    emit?.("audit_failed", { tool: "duty_classify", field, candidate_id: c.candidate_id, tokens: r.violations.map((v) => v.token) });
    return null;
  };
  const rationale = guard("rationale", raw.rationale, state.lang);
  const recipient = guard("recipient", raw.recipient, "de");
  const items = [];
  for (const item of raw.data_items) {
    const text = String(item).replace(/^other:/, "");
    if (guard("data_items", text, "de") !== null) items.push(item);
  }
  return {
    ...base,
    type: raw.type, addressee: raw.addressee, trigger: raw.trigger,
    frequency_per_year: m.frequency_per_year, frequency_assumption: m.frequency_assumption,
    frequency_term: raw.trigger === "periodisch" ? raw.frequency_term : null,
    recipient, data_items: mapItems(items, data.vocab), population_id: raw.population_id,
    protected_standard: raw.protected_standard,
    classification: { method: model ? "pattern+llm" : "pattern+recorded", pattern_ids: c.pattern_ids, certainty: raw.certainty, confidence: m.confidence, rationale, model },
    status: m.status,
    blocked_fields: [...new Set(blocked)]
  };
}
