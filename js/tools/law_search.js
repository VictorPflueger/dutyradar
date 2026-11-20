// Corpus agent: sentences that contain a phrase. The console shows the query, which the model wrote,
// only when it passes the fact auditor (checked against both lists of number words), so no number
// reaches the screen through it.
import { ToolError } from "./errors.js";
import { normOrError } from "./law_fetch.js";
import { auditText } from "../engine/auditor.js";

export const MAX_LIMIT = 20;

export default {
  name: "law_search",
  run({ query, norm_ids, limit }, { data, state }) {
    if (limit !== undefined && limit > MAX_LIMIT) throw new ToolError(`limit is at most ${MAX_LIMIT}.`, "limit");
    if (limit !== undefined && limit < 1) throw new ToolError("limit must be at least 1.", "limit");
    const q = String(query).trim().toLocaleLowerCase("de-DE");
    if (!q) throw new ToolError("query needs at least one word.", "query");
    const norms = (norm_ids || [...data.norms.keys()]).map((id) => normOrError(data, id));
    const max = limit ?? 10;
    const matches = [];
    let total = 0;
    for (const n of norms) for (const p of n.paragraphs) for (const s of p.sentences) {
      const text = p.text.slice(s.start, s.end);
      const at = text.toLocaleLowerCase("de-DE").indexOf(q);
      if (at < 0) continue;
      total += 1;
      if (matches.length >= max) continue;
      const from = Math.max(0, at - 80);
      matches.push({ paragraph_id: p.id, sentence_id: s.id, snippet: `${from > 0 ? "…" : ""}${text.slice(from, at + q.length + 80)}${at + q.length + 80 < text.length ? "…" : ""}` });
    }
    const shown = auditText(String(query), { ...(state?.auditContext?.() || {}), lang: "en" }).pass;
    return { result: { query, matches, more: total > matches.length }, summary: shown ? { code: "tool.law_search", params: { matches: total, query } } : { code: "tool.law_search_hidden", params: { matches: total } } };
  }
};
