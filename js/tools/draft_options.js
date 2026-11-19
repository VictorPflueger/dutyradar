// Drafting agent: the option rules for a duty or cluster; every option figure is a fact.
import { ToolError, unknownId } from "./errors.js";
import { confirmedDuty } from "./cost_params.js";

export default {
  name: "draft_options",
  run({ target }, { state }) {
    if (state.duties.has(target)) confirmedDuty(state, target);
    else if (!state.clusters.has(target)) throw unknownId(target);
    const r = state.draftOptions(target);
    if (!r.ok) {
      const id = r.error.params?.cluster_id || target;
      if (r.error.code === "cluster_split") {
        const parts = [...state.clusters.keys()].filter((k) => k.startsWith(`${id}-`));
        throw new ToolError(`Cluster ${id} was split${parts.length ? `; use its parts ${parts.join(" or ")}` : " and no part remains a cluster"}.`, "cluster_split");
      }
      if (r.error.code === "cluster_review_needed") throw new ToolError(`Cluster ${id} needs a review first: call ui_request_decision with its cluster_id.`, "cluster_review_needed");
      throw new ToolError(`No options for ${target} (${r.error.code}).`, r.error.code);
    }
    const options = r.options.map((o) => ({ id: o.id, type: o.type, status: o.status, facts: o.facts, duty_count_delta: o.duty_count_delta, removes: o.removed_duty_ids, risks: o.risks, notes: o.notes }));
    return { result: { target, options, ineligible: r.ineligible.map((x) => ({ type: x.type, reason: x.reason })) }, summary: { code: "tool.draft_options", params: { target, options: options.length } } };
  }
};
