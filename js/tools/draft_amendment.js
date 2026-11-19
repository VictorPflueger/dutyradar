// Drafting agent: German amendment wording through a sub-call, with an English gist in an English run.
import { ToolError } from "./errors.js";
import { validate } from "./validate.js";
import { AMENDMENT_TOOL } from "./schemas.js";

export const MARKER = "[Entwurf, rechtlich zu prüfen]";
export const MAX_WORDS = 120;
export const MAX_GIST_WORDS = 40;
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;

export default {
  name: "draft_amendment",
  async run({ option_id }, { data, state, hooks }) {
    const o = state.options.get(option_id);
    if (!o) throw new ToolError(`Unknown option ${option_id}. Call draft_options for its target first.`, "unknown_option");
    if (o.type === "keep") throw new ToolError("Keep has no wording to draft. Request the decision with ui_request_decision.", "keep_no_wording");
    if (o.status === "withdrawn") throw new ToolError(`Option ${option_id} no longer applies after an assumption change. Call draft_options again.`, "withdrawn");
    if (!["draft", "needs_info"].includes(o.status) || (o.status === "needs_info" && o.audit?.flag === "manual")) throw new ToolError(`Option ${option_id} is ${o.status}; it needs no new draft.`, "not_draft");
    const paragraphs = state.paragraphsOf(o.target.id).map((id) => { const p = data.paragraphs.get(id); return { id, enbez: p?.enbez, abbr: p?.abbr, text: p?.text }; });
    const out = await hooks.amend({ option: o, paragraphs, lang: state.lang });
    const errors = validate(AMENDMENT_TOOL.input_schema, out);
    if (errors.length) throw new ToolError(`The draft failed validation: ${errors.join(" ")} Call draft_amendment again.`, "invalid_draft");
    if (!out.wording.trim().endsWith(MARKER)) throw new ToolError(`The wording must end with "${MARKER}". Call draft_amendment again.`, "marker");
    if (words(out.wording) > MAX_WORDS) throw new ToolError(`The wording has more than ${MAX_WORDS} words. Call draft_amendment again.`, "too_long");
    if (state.lang === "en" && words(out.gist_en) > MAX_GIST_WORDS) throw new ToolError(`The English gist has more than ${MAX_GIST_WORDS} words. Call draft_amendment again.`, "gist_too_long");
    const draft = state.setDraft(option_id, { wording: out.wording, gist_en: state.lang === "en" ? out.gist_en : null });
    return { result: { option_id, wording: draft.wording, gist_en: draft.gist_en, attempt: draft.attempt, next: "Call audit_check with this option_id." }, summary: { code: "tool.draft_amendment", params: { option: option_id, attempt: draft.attempt } } };
  }
};
