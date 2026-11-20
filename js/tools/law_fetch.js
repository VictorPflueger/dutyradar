// Corpus agent: a norm's outline, or the text of some of its paragraphs.
import { ToolError } from "./errors.js";

export const MAX_PARAGRAPHS = 10;

export function normOrError(data, id) {
  const norm = data.norms.get(id);
  if (norm) return norm;
  if ((data.index.norms || []).some((n) => n.id === id)) throw new ToolError(`Norm ${id} is outside this run's norms. Work with the norms named in the opening message.`, "norm_not_in_run");
  throw new ToolError(`Unknown norm ${id}. Call law_list for the norms of the slice.`, "unknown_norm");
}

export default {
  name: "law_fetch",
  run({ norm_id, paragraph_ids }, { data }) {
    const norm = normOrError(data, norm_id);
    if (!paragraph_ids) {
      const paragraphs = norm.paragraphs.map((p) => ({ id: p.id, enbez: p.enbez, title: p.title, sentences: p.sentences.length }));
      return { result: { norm_id, abbr: norm.abbr, title: norm.title, eu_basis: norm.eu_basis, paragraphs }, summary: { code: "tool.law_fetch_outline", params: { norm: norm.abbr, paragraphs: paragraphs.length } } };
    }
    if (paragraph_ids.length > MAX_PARAGRAPHS) throw new ToolError(`At most ${MAX_PARAGRAPHS} paragraph_ids per call; fetch the rest in another call.`, "too_many");
    const paragraphs = paragraph_ids.map((pid) => {
      const p = norm.paragraphs.find((x) => x.id === pid);
      if (!p) throw new ToolError(`Unknown paragraph ${pid} in ${norm_id}. Call law_fetch with norm_id only to list its paragraphs.`, "unknown_paragraph");
      return { id: p.id, enbez: p.enbez, title: p.title, text: p.text, html_url: p.html_url, sentences: p.sentences.map((s) => ({ id: s.id, text: p.text.slice(s.start, s.end) })) };
    });
    return { result: { norm_id, abbr: norm.abbr, paragraphs }, summary: { code: "tool.law_fetch", params: { norm: norm.abbr, paragraphs: paragraphs.length, first: paragraphs[0]?.id } } };
  }
};
