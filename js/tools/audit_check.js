// Fact auditor: a text, or an option's draft wording; a passed option becomes proposed.
import { ToolError, auditMessage } from "./errors.js";

export default {
  name: "audit_check",
  run({ text, option_id }, { state, emit }) {
    const hasText = typeof text === "string";
    const hasOption = typeof option_id === "string";
    if (hasText === hasOption) throw new ToolError(hasText ? "Give either text or option_id, not both." : "Give text or option_id.", "shape");
    if (hasText) {
      const r = state.audit(text);
      if (!r.pass) {
        emit?.("audit_failed", { tool: "audit_check", tokens: r.violations.map((v) => v.token), blocked_text: text });
        throw new ToolError(auditMessage(r.violations), "audit_failed", { tokens: r.violations.map((v) => v.token) });
      }
      return { result: { pass: true, violations: [] }, summary: { code: "tool.audit_check_text", params: {} } };
    }
    const o = state.options.get(option_id);
    if (!o) throw new ToolError(`Unknown option ${option_id}. Call draft_options for its target first.`, "unknown_option");
    if (o.type === "keep") return { result: { pass: true, violations: [], option_status: o.status }, summary: { code: "tool.audit_check_option", params: { option: option_id, pass: true } } };
    if (!o.draft) throw new ToolError(`Option ${option_id} has no draft yet. Call draft_amendment first.`, "no_draft");
    const r = state.auditOption(option_id);
    if (!r.pass) {
      emit?.("audit_failed", { tool: "audit_check", option_id, tokens: r.violations.map((v) => v.token), failures: r.failures, blocked_text: o.draft.wording });
      const manual = o.status === "needs_info";
      throw new ToolError(`${auditMessage(r.violations)} ${manual ? `Option ${option_id} failed the audit three times and needs manual editing; it stays out of the decision.` : `Redraft with draft_amendment (failure ${r.failures} of 3).`}`, "audit_failed", { tokens: r.violations.map((v) => v.token), failures: r.failures });
    }
    return { result: { pass: true, violations: [], option_status: o.status }, summary: { code: "tool.audit_check_option", params: { option: option_id, pass: true } } };
  }
};
