// A scripted stand-in for an OpenAI-compatible POST {base_url}/v1/chat/completions (the Sovereign mode,
// AC-12). It checks the function-tool format, tool_choice "auto", that every earlier assistant turn
// with tool_calls is passed back and answered by role "tool" messages with the matching tool_call_id.
export function createFakeOpenAi(script, { model = "open-model" } = {}) {
  const violations = [];
  const requests = [];
  const sent = []; // assistant messages as returned
  let i = 0;
  const check = (cond, msg) => { if (!cond) violations.push(`request ${requests.length}: ${msg}`); };

  function validate(req) {
    check(req.model === model, `model ${req.model}`);
    check(req.tool_choice === "auto", "tool_choice must be \"auto\"");
    check(typeof req.max_tokens === "number" && req.max_tokens > 0, "max_tokens missing");
    for (const k of ["temperature", "top_p", "top_k", "stream"]) check(!(k in req) || (k === "stream" && req.stream === false), `${k} must not be sent`);
    check(Array.isArray(req.tools) && req.tools.length > 0 && req.tools.every((t) => t.type === "function" && t.function?.name && typeof t.function.description === "string" && t.function.parameters?.type === "object"), "tools must be functions with name, description and parameters");
    const msgs = req.messages || [];
    check(msgs[0]?.role === "system" && typeof msgs[0].content === "string", "the first message is the system prompt");
    let a = 0;
    msgs.forEach((m, k) => {
      if (m.role !== "assistant") return;
      const expected = sent[a++];
      check(expected && JSON.stringify(m.tool_calls || null) === JSON.stringify(expected.tool_calls || null) && (m.content ?? null) === (expected.content ?? null), `assistant turn ${a} not passed back unchanged`);
      for (const [n, call] of (m.tool_calls || []).entries()) {
        const reply = msgs[k + 1 + n];
        check(reply?.role === "tool" && reply.tool_call_id === call.id && typeof reply.content === "string", `tool call ${call.id} not answered by a tool message right after`);
      }
    });
  }

  return {
    violations, requests,
    handle(raw, headers) {
      const req = JSON.parse(raw);
      requests.push({ req, headers });
      validate(req);
      const step = script[i++];
      if (!step) {
        violations.push(`unexpected request ${requests.length}`);
        return { status: 500, body: JSON.stringify({ error: { message: "script exhausted" } }) };
      }
      const message = { role: "assistant", content: step.content ?? null, ...(step.tool_calls ? { tool_calls: step.tool_calls } : {}) };
      sent.push(message);
      return {
        status: 200,
        body: JSON.stringify({
          id: `chatcmpl-${requests.length}`, object: "chat.completion", model,
          choices: [{ index: 0, message, finish_reason: step.finish_reason || (step.tool_calls ? "tool_calls" : "stop") }],
          usage: { prompt_tokens: step.prompt_tokens ?? 1200, completion_tokens: step.completion_tokens ?? 300, total_tokens: (step.prompt_tokens ?? 1200) + (step.completion_tokens ?? 300) }
        })
      };
    }
  };
}

export const call = (id, name, args) => ({ id, type: "function", function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) } });
