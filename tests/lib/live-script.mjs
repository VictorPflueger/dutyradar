// The scripted Live run the browser suites use: one norm (the Energy Statistics Act) end to end with
// R3's tool sequence, the classification and amendment sub-calls answered from R3's recording, one
// decision request (lower frequency or keep), the model's closing report and the end of the turn.
// Texts are English, so a suite can switch the page to German and see that model text keeps its language.
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./harness.mjs";
import { toolUse, text, thinking } from "./fake-claude.mjs";

const R3 = JSON.parse(readFileSync(path.join(APP_ROOT, "data/runs/R3.json"), "utf8"));
const en = (v) => (v && typeof v === "object" && "en" in v ? v.en : v);

/** The narration and the report the script sends, for checks. */
export const LIVE_TEXTS = {
  narration: "I price the monthly report under {{cite:enstatg_2017-p10}}.",
  report: "Duty Radar priced the monthly report under {{cite:enstatg_2017-p10}}; your decision is in the dossier. Nothing is sent."
};

/** The scripted Live run of one norm (the Energy Statistics Act), the tool sequence of R3. */
export function liveScript({ thinkingBlock = true } = {}) {
  const calls = R3.events.filter((e) => e.type === "tool_call").map((e) => e.payload);
  const input = (tool) => calls.find((c) => c.tool === tool).input;
  const cands = input("duty_classify").candidate_ids;
  const duty = "D-enstatg_2017-p10-1";
  const lower = `O-${duty}-lower_frequency`;
  const amendment = R3.recorded.amendments[lower][0];
  let n = 0;
  const step = (name, args, extra = []) => ({ blocks: [...(thinkingBlock && n === 0 ? [thinking("I start with the slice's list of norms.", "sig-live-1")] : []), ...extra, toolUse(`tu_${++n}`, name, args)], stop: "tool_use" });
  return [
    step("law_list", { slice_id: "slice-1" }, [text("I take the Energy Statistics Act end to end.")]),
    step("law_fetch", { norm_id: "enstatg_2017" }),
    step("duty_extract", { norm_id: "enstatg_2017" }),
    step("duty_classify", { candidate_ids: cands }),
    { kind: "classify", blocks: [toolUse("cls_1", "submit_classification", { classifications: cands.map((id) => ({ ...R3.recorded.classifications[id], rationale: en(R3.recorded.classifications[id].rationale) })) })], stop: "tool_use" },
    step("once_cluster", {}),
    step("ui_progress", { step: "price", agent: "cost", message: LIVE_TEXTS.narration }),
    step("cost_params", { duty_id: duty }),
    step("cost_estimate", { target: duty }),
    step("draft_options", { target: duty }),
    step("draft_amendment", { option_id: lower }),
    { kind: "amend", blocks: [toolUse("amd_1", "submit_amendment", { wording: amendment.wording, gist_en: amendment.gist_en })], stop: "tool_use" },
    step("audit_check", { option_id: lower }),
    step("ui_request_decision", { target: duty, option_ids: [lower, `O-${duty}-keep`] }),
    step("ui_report", { text: LIVE_TEXTS.report }),
    { blocks: [text("The run is complete.")], stop: "end_turn" }
  ];
}
