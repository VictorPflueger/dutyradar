// Once-only matcher: clusters of confirmed duties that ask the same addressees for overlapping data.
import { ToolError } from "./errors.js";

export default {
  name: "once_cluster",
  run({ addressee }, { state }) {
    const r = state.cluster(addressee || null);
    if (!r.ok) throw new ToolError("Clusters were already reviewed; work with the existing cluster ids.", "clusters_reviewed");
    const clusters = r.clusters.map((c) => ({ id: c.id, duty_ids: c.duty_ids, addressee: c.addressee, population_id: c.population_id, shared_items: c.shared_items, overlap: c.overlap, confidence: c.confidence, status: c.status, review_needed: c.status === "candidate" && c.confidence < 0.5 }));
    return { result: { clusters }, summary: { code: "tool.once_cluster", params: { clusters: clusters.length, review: clusters.filter((c) => c.review_needed).length } } };
  }
};
