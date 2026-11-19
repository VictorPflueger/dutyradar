// The toolbox: validates every tool input against its strict schema in code, runs the tool on the run
// state and returns JSON for the model, or is_error with an English instruction. One toolbox serves
// the Live loop, the Sovereign adapter and the replay; tools never touch the DOM, storage or network.
//
// ctx: { data, state, lang, hooks: { classify(batch, meta), amend({ option, paragraphs, lang }),
// requestDecision(req), classifierModel }, emit(type, payload), signal }.

import { TOOL_DEFS, SUBCALL_DEFS, ORCHESTRATOR_TOOL_NAMES } from "./schemas.js";
import { validate } from "./validate.js";
import { ToolError } from "./errors.js";
import law_list from "./law_list.js";
import law_fetch from "./law_fetch.js";
import law_search from "./law_search.js";
import duty_extract from "./duty_extract.js";
import duty_classify from "./duty_classify.js";
import once_cluster from "./once_cluster.js";
import once_registers from "./once_registers.js";
import cost_params from "./cost_params.js";
import cost_estimate from "./cost_estimate.js";
import signal_match from "./signal_match.js";
import draft_options from "./draft_options.js";
import draft_amendment from "./draft_amendment.js";
import audit_check from "./audit_check.js";
import ui_progress from "./ui_progress.js";
import ui_request_decision from "./ui_request_decision.js";
import ui_report from "./ui_report.js";

export { TOOL_DEFS, SUBCALL_DEFS, ORCHESTRATOR_TOOL_NAMES, ToolError };

const MODULES = [law_list, law_fetch, law_search, duty_extract, duty_classify, once_cluster, once_registers, cost_params, cost_estimate, signal_match, draft_options, draft_amendment, audit_check, ui_progress, ui_request_decision, ui_report];
const BY_NAME = new Map(MODULES.map((m) => [m.name, m]));
const DEFS = new Map(TOOL_DEFS.map((d) => [d.name, d]));

/** Tools whose calls the loop runs in parallel when they come in a row (independent lookups). */
export const ORDER_FREE = new Set(["law_list", "law_fetch", "law_search"]);
/** Tools that wait for the reviewer. */
export const BLOCKING = new Set(["ui_request_decision"]);

export function createToolbox(ctx) {
  return {
    /** Runs one tool; extra: { intended } for a replayed decision request. */
    async execute(name, input, extra = {}) {
      const def = DEFS.get(name);
      const mod = BY_NAME.get(name);
      if (!def || !mod) return fail(`Unknown tool ${name}. Available tools: ${ORCHESTRATOR_TOOL_NAMES.join(", ")}.`, "unknown_tool");
      const errors = validate(def.input_schema, input ?? {});
      if (errors.length) return fail(`${errors.join(" ")} Check the input of ${name} against its schema and call it again.`, "invalid_input");
      try {
        const out = await mod.run(input ?? {}, { ...ctx, ...extra });
        return { content: JSON.stringify(out.result), isError: false, result: out.result, summary: out.summary };
      } catch (e) {
        if (e instanceof ToolError) return fail(e.message, e.code, e.params);
        throw e;
      }
    }
  };
}

function fail(message, code, params = {}) {
  return { content: message, isError: true, result: { error: message, code, ...params }, summary: { code: "tool.error", params: { code } } };
}
