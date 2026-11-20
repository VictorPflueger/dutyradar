// Duty extractor: the deterministic pattern stage over one norm.
import { extractCandidates } from "../engine/patterns.js";
import { normOrError } from "./law_fetch.js";

export default {
  name: "duty_extract",
  run({ norm_id }, { data, state }) {
    const norm = normOrError(data, norm_id);
    const found = extractCandidates(norm, data.patterns);
    state.addCandidates(norm_id, found);
    const candidates = found.map((c) => ({ candidate_id: c.candidate_id, sentence_id: c.sentence_id, pattern_ids: c.pattern_ids, type_hint: c.type_hint, marker: c.marker, span: { start: c.span.start, end: c.span.end, phrase: c.span.phrase } }));
    return { result: { norm_id, candidates }, summary: { code: "tool.duty_extract", params: { norm: norm.abbr, candidates: candidates.length } } };
  }
};
