// Cost agent: the cost parameters of a confirmed duty, each with its source or assumption flag.
import { ToolError, unknownId } from "./errors.js";

export function confirmedDuty(state, id) {
  const duty = state.duties.get(id);
  if (!duty) throw unknownId(id);
  if (duty.status !== "confirmed") throw new ToolError(`${id} is not a confirmed duty (status ${duty.status}). Price only confirmed duties.`, "not_confirmed");
  return duty;
}

export default {
  name: "cost_params",
  run({ duty_id }, { state }) {
    confirmedDuty(state, duty_id);
    const params = state.paramsFor(duty_id);
    const warning = state.duties.get(duty_id).warnings?.includes("params_mismatch") ? "params_mismatch" : null;
    return { result: { duty_id, params, warning }, summary: { code: "tool.cost_params", params: { duty: duty_id, from: params.from } } };
  }
};
