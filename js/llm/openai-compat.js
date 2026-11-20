// Sovereign mode: translates the Live loop's Anthropic-format conversation to an OpenAI-compatible
// chat endpoint and back (PLAN.md 5.6, AC-12). Tools go out as functions; the model's tool_calls come
// back as tool_use blocks with their arguments parsed; tool results return as role "tool" messages with
// the matching tool_call_id. Thinking blocks never leave the browser in this mode.

/** Whether the mode can run, and why not: { enabled, reason } (reason is an i18n key). */
export function sovereignStatus(config) {
  if (!config || !config.enabled) return { enabled: false, reason: "sovereign.none" };
  if (!/^https:\/\//.test(config.base_url || "")) return { enabled: false, reason: "sovereign.bad_url" };
  if (!config.model) return { enabled: false, reason: "sovereign.no_model" };
  return { enabled: true, reason: null };
}

/** The euro cost of one response at the endpoint's own prices per million tokens. */
export const sovereignCostEur = (config, usage = {}) => ((usage.input_tokens || 0) * (config.price_eur_per_mtok_in || 0) + (usage.output_tokens || 0) * (config.price_eur_per_mtok_out || 0)) / 1e6;

/** Anthropic-format request → OpenAI chat completions body. */
export function toChatRequest({ model, system, messages, tools, max_tokens }) {
  const out = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "assistant") {
      if (m._raw) { out.push(m._raw); continue; }
      const blocks = Array.isArray(m.content) ? m.content : [{ type: "text", text: String(m.content) }];
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const calls = blocks.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      out.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    if (typeof m.content === "string") { out.push({ role: "user", content: m.content }); continue; }
    const results = m.content.filter((b) => b.type === "tool_result");
    for (const r of results) out.push({ role: "tool", tool_call_id: r.tool_use_id, content: typeof r.content === "string" ? r.content : JSON.stringify(r.content) });
    const text = m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    if (text) out.push({ role: "user", content: text });
  }
  return {
    model,
    messages: out,
    tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
    tool_choice: "auto",
    max_tokens
  };
}

const STOP = { tool_calls: "tool_use", stop: "end_turn", length: "max_tokens", content_filter: "refusal" };

/** OpenAI chat completion → Anthropic-shaped message; arguments that are not JSON are marked. */
export function fromChatResponse(json) {
  const choice = json?.choices?.[0] || {};
  const msg = choice.message || { role: "assistant", content: null };
  const content = [];
  if (typeof msg.content === "string" && msg.content.trim()) content.push({ type: "text", text: msg.content });
  for (const c of msg.tool_calls || []) {
    let input;
    let invalid = null;
    try {
      input = JSON.parse(c.function?.arguments ?? "{}");
      if (!input || typeof input !== "object" || Array.isArray(input)) { invalid = c.function?.arguments; input = {}; }
    } catch {
      invalid = c.function?.arguments ?? "";
      input = {};
    }
    content.push({ type: "tool_use", id: c.id, name: c.function?.name, input, ...(invalid !== null ? { invalid_json: invalid } : {}) });
  }
  return {
    id: json?.id || null,
    model: json?.model || null,
    role: "assistant",
    content,
    stop_reason: STOP[choice.finish_reason] || (content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn"),
    usage: { input_tokens: json?.usage?.prompt_tokens || 0, output_tokens: json?.usage?.completion_tokens || 0 },
    _raw: msg
  };
}

/** One non-streaming call to the configured endpoint. Throws { status, type, message } on failure. */
export async function callChat({ config, key = null, body, signal }) {
  let res;
  try {
    res = await fetch(`${config.base_url.replace(/\/+$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });
  } catch (e) {
    if (signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    throw Object.assign(new Error(`The sovereign endpoint is not reachable (${e?.message || e}).`), { status: 0, type: "network_error" });
  }
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try { message = JSON.parse(text)?.error?.message || text; } catch { /* plain text */ }
    throw Object.assign(new Error(message || `HTTP ${res.status}`), { status: res.status, type: `http_${res.status}` });
  }
  return fromChatResponse(JSON.parse(text));
}
