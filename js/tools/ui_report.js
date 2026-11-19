// UI: the closing report, fact-audited; placeholders only.
import { ToolError, auditMessage } from "./errors.js";

export default {
  name: "ui_report",
  run({ text }, { state, emit }) {
    const r = state.audit(text);
    if (!r.pass) {
      emit?.("audit_failed", { tool: "ui_report", tokens: r.violations.map((v) => v.token), blocked_text: text });
      throw new ToolError(auditMessage(r.violations, "ui_report"), "audit_failed", { tokens: r.violations.map((v) => v.token) });
    }
    state.setReport({ text, source: "model", lang: state.lang });
    emit?.("agent_text", { kind: "report", text, lang: state.lang });
    return { result: { ok: true }, summary: { code: "tool.ui_report", params: {} } };
  }
};
