// UI: one short sentence of narration, fact-audited before the console shows it.
import { ToolError, auditMessage } from "./errors.js";

export default {
  name: "ui_progress",
  run({ step, agent, message, focus }, { state, emit }) {
    const r = state.audit(message);
    if (!r.pass) {
      emit?.("audit_failed", { tool: "ui_progress", tokens: r.violations.map((v) => v.token), blocked_text: message });
      throw new ToolError(auditMessage(r.violations, "ui_progress"), "audit_failed", { tokens: r.violations.map((v) => v.token) });
    }
    emit?.("agent_text", { kind: "narration", step, agent, text: message, lang: state.lang, focus: focus || null });
    return { result: { ok: true }, summary: { code: "tool.ui_progress", params: {} } };
  }
};
