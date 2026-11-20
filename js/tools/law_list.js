// Corpus agent: the norms of the bundled slice.
import { ToolError } from "./errors.js";

export default {
  name: "law_list",
  run({ slice_id }, { data }) {
    if (slice_id !== data.sliceId) throw new ToolError(`Unknown slice ${slice_id}. Call law_list with slice_id "${data.sliceId}".`, "unknown_slice");
    const norms = (data.index.norms || []).map((n) => ({ id: n.id, abbr: n.abbr, title: n.title, paragraphs: n.paragraphs, eu_related: (n.eu_basis || []).length > 0, loaded: data.norms.has(n.id) }));
    return { result: { slice_id, status: data.index.slice_status || data.slice?.status || null, retrieved: data.retrievedDate, norms }, summary: { code: "tool.law_list", params: { norms: norms.length } } };
  }
};
