// A tool's answer to an input it cannot act on: is_error true with an English instruction (brief §5.2).
export class ToolError extends Error {
  constructor(message, code = "tool_error", params = {}) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.params = params;
  }
}

/** The English message for a failed fact audit, with the offending tokens. */
export function auditMessage(violations, retryTool) {
  const tokens = [...new Set(violations.map((v) => v.token))];
  const details = [...new Set(violations.map((v) => v.message))].join(" ");
  return `Fact audit failed: ${tokens.join(", ")}. ${details} Use {{fact:ID}} placeholders for numbers and {{cite:ID}} for paragraphs${retryTool ? `, then call ${retryTool} again` : ""}.`;
}

/** Errors for ids the model may get wrong, with the tool that yields the right ones. */
export function unknownId(id) {
  if (/^C-\d{3}/.test(id)) return new ToolError(`Unknown cluster ${id}. Call once_cluster first.`, "unknown_cluster");
  if (/^D-/.test(id)) return new ToolError(`Unknown duty ${id}. Use an id that duty_classify returned.`, "unknown_duty");
  return new ToolError(`${id} is not a duty or cluster id. Use an id from duty_classify or once_cluster.`, "not_a_target");
}
