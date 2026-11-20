// The two tools that call a model themselves (PLAN.md 5.2): duty_classify through Haiku 5.5 at effort
// low, draft_amendment through the drafting model at the orchestrator's effort. Each sends one strict
// tool, asks for exactly one call of it and returns that call's input; validation, mapping and the
// fact audit stay in the tools. Both count toward the run's caps and are audited like any model call,
// because they go through the loop's call function.

import { classificationTool, AMENDMENT_TOOL } from "./tools/schemas.js";
import { classificationPrompt, amendmentPrompt } from "./prompt.js";

/** call(kind, { model, effort, system, user, tools }) → Anthropic-format message. */
export function createSubcalls({ call, data, lang, settings }) {
  const toolInput = (message, name) => message?.content?.find((b) => b.type === "tool_use" && b.name === name)?.input ?? {};
  return {
    classifierModel: settings.classifier_model,
    async classify(batch, { attempt = 1, errors = null } = {}) {
      const tool = classificationTool(data.populations.map((p) => p.id));
      const { system, user } = classificationPrompt({ lang, batch, populations: data.populations, vocabulary: data.vocab?.items || [], retryErrors: attempt > 1 ? errors : null });
      const message = await call("classify", { model: settings.classifier_model, effort: settings.classifier_effort, system, user, tools: [tool] });
      return toolInput(message, tool.name);
    },
    async amend({ option, paragraphs }) {
      const { system, user } = amendmentPrompt({ lang, option, paragraphs });
      const message = await call("amend", { model: settings.drafting_model, effort: settings.orchestrator_effort, system, user, tools: [AMENDMENT_TOOL] });
      return toolInput(message, AMENDMENT_TOOL.name);
    }
  };
}
