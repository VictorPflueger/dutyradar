// Cost agent: prices a duty or a cluster; every figure becomes a fact the model cites by id.
import { unknownId } from "./errors.js";
import { confirmedDuty } from "./cost_params.js";

export default {
  name: "cost_estimate",
  run({ target }, { state }) {
    if (state.duties.has(target)) confirmedDuty(state, target);
    else if (!state.clusters.has(target)) throw unknownId(target);
    const facts = state.estimate(target);
    return { result: { target, facts }, summary: { code: "tool.cost_estimate", params: { target, fact: facts.ea_annual_eur || facts.one_off_eur || null } } };
  }
};
