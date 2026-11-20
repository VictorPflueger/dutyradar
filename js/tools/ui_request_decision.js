// UI: asks the reviewer for one decision (or a cluster review) and waits until it exists.
import { ToolError, unknownId } from "./errors.js";

export default {
  name: "ui_request_decision",
  async run({ target, option_ids, cluster_id }, { state, hooks, emit, signal, intended }) {
    const optionShape = typeof target === "string" && Array.isArray(option_ids) && cluster_id === undefined;
    const clusterShape = typeof cluster_id === "string" && target === undefined && option_ids === undefined;
    if (!optionShape && !clusterShape) throw new ToolError("Give either target with option_ids, or cluster_id alone.", "shape");
    if (clusterShape) {
      const c = state.clusters.get(cluster_id);
      if (!c) throw unknownId(cluster_id);
      if (c.status !== "candidate") throw new ToolError(`Cluster ${cluster_id} was already reviewed (${c.status}).`, "cluster_reviewed");
      const req = { kind: "cluster", cluster_id, intended: intended || null };
      const wait = state.waitForReview(cluster_id, signal);
      emit?.("decision_requested", req);
      const hooked = await hooks.requestDecision?.(req);
      const res = hooked && hooked.cluster_id ? hooked : await wait;
      return { result: { kind: "cluster", ...res }, summary: { code: "tool.ui_request_review", params: { cluster: cluster_id, action: res.action } } };
    }
    if (!state.duties.has(target) && !state.clusters.has(target)) throw unknownId(target);
    const t = state.targets.get(target);
    if (!t) throw new ToolError(`No options for ${target} yet. Call draft_options first.`, "no_options");
    if (t.decided) throw new ToolError(`Target ${target} is already decided (${t.decided}).`, "target_decided");
    for (const id of option_ids) {
      const o = state.options.get(id);
      if (!o || o.target.id !== target) throw new ToolError(`Option ${id} does not belong to ${target}. Use the ids draft_options returned for it.`, "foreign_option");
      if (o.status === "draft") throw new ToolError(`Option ${id} is a draft: call draft_amendment and audit_check first, or leave it out.`, "draft");
      if (!["proposed", "under_review"].includes(o.status)) throw new ToolError(`Option ${id} is ${o.status} and cannot be decided now; leave it out.`, "not_open");
    }
    const req = { kind: "option", target, option_ids, intended: intended || null };
    state.requests.push({ ...req, at: Date.now() });
    const wait = state.waitForDecision(option_ids, signal);
    emit?.("decision_requested", req);
    const hooked = await hooks.requestDecision?.(req);
    const decision = hooked && hooked.option_id ? hooked : await wait;
    return { result: { kind: "option", decision }, summary: { code: "tool.ui_request_decision", params: { target, decision: decision.decision, reason: decision.reason_code } } };
  }
};
