// Live suite: the Live loop (js/agent.js) and the Sovereign adapter (js/llm/openai-compat.js) against
// scripted stand-ins (tests/lib/fake-claude.mjs, tests/lib/fake-openai.mjs), in Node, on the two-norm
// fixture slice. No key, no network: fetch is replaced, and every other host is refused.
//   request    AC-11: version and browser headers, strict tools, tool_choice auto, no sampling
//              parameters, tool results first, thinking blocks passed back unchanged, sub-calls
//   loop       stop rules and errors of PLAN.md 5.1: cut-off tool call retried with more room,
//              continuation, two nudges, refusal, 401 removes the key, 400 stops, errors audited
//   caps       no 41st call (sub-calls count), no call once 3 euros are spent, the soft note,
//              cap_reached in events and audit, the closing report from the template
//   sovereign  AC-12: function tools, tool_calls arguments parsed, tool messages with tool_call_id
// Usage: node tests/live.mjs [section…]
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT, loadFixture, fixtureRecorded } from "./lib/data-node.mjs";
import { createFakeClaude, fakeFetch, toolUse, text, thinking } from "./lib/fake-claude.mjs";
import { createFakeOpenAi, call } from "./lib/fake-openai.mjs";

// Browser globals the shared modules use, before they load.
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
globalThis.sessionStorage = memoryStorage();
globalThis.localStorage = memoryStorage();
globalThis.location = { search: "" };

const { bus } = await import("../js/events.js");
const { loadI18n } = await import("../js/i18n.js");
const { setKey, getKey } = await import("../js/keystore.js");
const { createRunState } = await import("../js/state.js");
const { createAuditLog } = await import("../js/audit.js");
const { createLiveAgent } = await import("../js/agent.js");
await loadI18n(async (p) => new Response(readFileSync(path.join(ROOT, p))));

const ONLY = process.argv.slice(2);
const want = (s) => ONLY.length === 0 || ONLY.includes(s);
let failed = 0;
let checks = 0;
let sectionFailed = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) { failed += 1; sectionFailed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${String(detail).slice(0, 700)}` : ""}`); }
};
const begin = () => { sectionFailed = 0; };
const end = (token, extra = "") => console.log(sectionFailed ? `${token.replace(" OK", "")} FAILED` : `${token}${extra ? ` (${extra})` : ""}`);
const KEY = "sk-ant-test-MOCKKEY-live0123456789abcdef";
const recorded = fixtureRecorded();
const CANDS = ["D-beispielg-p20-1", "D-beispielg-p20-2", "D-beispielg-p21-1", "D-beispielg-p23a-1", "D-musterv-p3-1", "D-musterv-p3-2"];
const classification = (lang = "en") => ({ classifications: CANDS.map((c) => ({ ...recorded.classifications[c], rationale: recorded.classifications[c].rationale[lang] })) });

/** One Live run on the fixture slice against a script; returns everything the checks need. */
async function liveRun(script, { lang = "en", caps = null, repeat = null, decide = null, mode = "live", sovereign = null, openai = null, keyRejected = null } = {}) {
  setKey(KEY);
  const fake = createFakeClaude(script, { repeat });
  const others = openai ? { [sovereign.base_url]: async (u, init) => { const r = openai.handle(init.body, init.headers); return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } }); } } : {};
  globalThis.fetch = fakeFetch(fake, { others });
  const data = loadFixture();
  const state = createRunState({ data, lang, runId: "L1", mode });
  const audit = createAuditLog({ runId: "L1", mode });
  const events = [];
  const offs = [bus.onAny((ev) => events.push(ev))];
  offs.push(bus.on("decision_requested", (ev) => setTimeout(() => {
    const p = ev.payload;
    if (decide) return decide(p, state);
    if (p.kind === "cluster") return state.reviewCluster({ cluster_id: p.cluster_id, action: "confirm" });
    return state.decide({ option_id: p.option_ids[0], decision: "approved", reason_code: "Z2", comment: "" });
  }, 5)));
  const agent = createLiveAgent({ hooks: { onKeyRejected: () => keyRejected?.() } });
  let result;
  try {
    result = await agent.run({ runId: "L1", lang, mode, modelId: "claude-sonnet-5-5", data, state, audit, normIds: ["beispielg", "musterv"], caps, sovereign });
  } finally {
    offs.forEach((off) => off());
  }
  return { fake, state, audit, events, result, types: events.map((e) => e.type) };
}

// ---- AC-11 ----------------------------------------------------------------------------------------
if (want("request")) {
  begin();
  const think = thinking("Ich beginne mit dem Inventar.", "sig-0001");
  const r = await liveRun([
    { blocks: [think, text("Ich beginne."), toolUse("tu_1", "law_list", { slice_id: "slice-mini" })], stop: "tool_use" },
    { blocks: [toolUse("tu_2", "duty_extract", { norm_id: "beispielg" }), toolUse("tu_3", "duty_extract", { norm_id: "musterv" })], stop: "tool_use",
      expect: (req, { check: c }) => c(JSON.stringify(req.messages[1].content[0]) === JSON.stringify({ type: "thinking", thinking: think.thinking, signature: think.signature }), "the thinking block is not first and unchanged") },
    { blocks: [toolUse("tu_4", "duty_classify", { candidate_ids: CANDS })], stop: "tool_use" },
    { kind: "classify", blocks: [toolUse("tu_c1", "submit_classification", classification("en"))], stop: "tool_use",
      expect: (req, { check: c }) => c(/D-musterv-p3-2/.test(JSON.stringify(req.messages[0].content)) && /pop-gewerbebetriebe/.test(JSON.stringify(req.messages[0].content)), "the classification request lists the candidates and the population ids") },
    { blocks: [toolUse("tu_5", "ui_report", { text: "Inventory of {{cite:beispielg-p20}} and {{cite:musterv-p3}} done." })], stop: "tool_use" },
    { blocks: [text("Done.")], stop: "end_turn" }
  ]);
  check("the stand-in saw no protocol violation", r.fake.violations.length === 0, r.fake.violations.join("\n  - "));
  check("six requests: five orchestrator turns and one classification sub-call", r.fake.requests.length === 6 && r.fake.requests.filter((q) => q.kind === "classify").length === 1);
  const req2 = r.fake.requests[1].req;
  const results = req2.messages[2].content;
  check("the tool results come first in the next user message", results[0]?.type === "tool_result" && results[0].tool_use_id === "tu_1");
  const req3 = r.fake.requests[2].req;
  check("two parallel tool calls get two results in order", req3.messages[4].content.map((b) => b.tool_use_id).join() === "tu_2,tu_3");
  check("the run ends done after ui_report", r.result?.status === "done", JSON.stringify(r.result));
  check("the classified duties are in the state", r.state.duties.get("D-musterv-p3-2")?.status === "confirmed");
  check("the sub-call counts as a model call", r.audit.events().filter((e) => e.event === "model_response").length === 6);
  check("every model response is audited with model, usage and cost", r.audit.events().filter((e) => e.event === "model_response").every((e) => e.model && e.usage?.input_tokens > 0 && e.cost_eur > 0));
  check("the classification response is audited with Haiku 5.5", r.audit.events().some((e) => e.event === "model_response" && e.model === "claude-haiku-5-5"));
  check("tool calls and results are RunEvents with the tool's role", r.events.some((e) => e.type === "tool_call" && e.payload.tool === "duty_classify" && e.agent === "duty_extractor"));
  check("no key in the audit", !JSON.stringify(r.audit.events()).includes(KEY));
  end("LIVE REQUEST OK", `${r.fake.requests.length} requests`);
}

// ---- stop rules and errors ----------------------------------------------------------------------------
if (want("loop")) {
  begin();
  // A tool call cut off by max_tokens is discarded and retried once with half as much room again.
  const cut = await liveRun([
    { blocks: [text("Ich suche."), toolUse("tu_1", "law_search", { query: "zu melden oder anzuzeigen", limit: 5 })], stop: "max_tokens", cut: 1, discard: true },
    { blocks: [toolUse("tu_1b", "law_list", { slice_id: "slice-mini" })], stop: "tool_use", expect: (req, { check: c }) => c(req.max_tokens === 24000, `max_tokens ${req.max_tokens} after the retry`) },
    { blocks: [toolUse("tu_2", "ui_report", { text: "Done for {{cite:beispielg-p20}}." })], stop: "tool_use" },
    { blocks: [text("Ende.")], stop: "end_turn" }
  ]);
  check("a cut-off tool call is retried once with max_tokens 24,000", cut.fake.violations.length === 0 && cut.fake.requests.length === 4, cut.fake.violations.join("; "));
  check("the discarded turn is not passed back", cut.fake.requests[1].req.messages.length === 1);
  // max_tokens without a tool call continues.
  const cont = await liveRun([
    { blocks: [text("Ich schreibe …")], stop: "max_tokens" },
    { blocks: [toolUse("tu_1", "ui_report", { text: "Done for {{cite:beispielg-p20}}." })], stop: "tool_use", expect: (req, { check: c }) => c(JSON.stringify(req.messages.at(-1)).includes("Continue from where you stopped."), "no continuation instruction") },
    { blocks: [text("Ende.")], stop: "end_turn" }
  ]);
  check("max_tokens without a tool call continues with an instruction", cont.fake.violations.length === 0 && cont.result.status === "done", cont.fake.violations.join("; "));
  // end_turn before ui_report: at most two nudges, then the run ends incomplete.
  const nudge = await liveRun([
    { blocks: [text("Soll ich weitermachen?")], stop: "end_turn" },
    { blocks: [text("Gern.")], stop: "end_turn" },
    { blocks: [text("Fertig?")], stop: "end_turn" }
  ]);
  check("two nudges, then the run ends incomplete", nudge.fake.requests.length === 3 && nudge.result.status === "incomplete" && nudge.events.filter((e) => e.type === "notice").length >= 2, `${nudge.fake.requests.length} requests, ${nudge.result?.status}`);
  // refusal ends the run.
  const refusal = await liveRun([{ blocks: [text("Dazu kann ich nichts sagen.")], stop: "refusal" }]);
  check("refusal ends the run with an error and no further call", refusal.fake.requests.length === 1 && refusal.result.status === "error");
  // 401 removes the key and tells the UI; 400 stops with a readable message; both audited.
  let rejected = false;
  const unauthorized = await liveRun([{ error: { status: 401, type: "authentication_error", message: "invalid x-api-key" } }], { keyRejected: () => { rejected = true; } });
  check("401 removes the key from the session and calls onKeyRejected", getKey() === null && rejected && unauthorized.result.status === "error");
  check("the 401 is audited as an error", unauthorized.audit.events().some((e) => e.event === "error"));
  const bad = await liveRun([{ error: { status: 400, type: "invalid_request_error", message: "messages: something is wrong" } }]);
  check("400 stops the run with a readable message", bad.result.status === "error" && bad.events.some((e) => e.type === "notice" && /something is wrong/.test(e.payload.text)) && bad.fake.requests.length === 1);
  check("the 400 is audited as an error", bad.audit.events().some((e) => e.event === "error"));
  // A transient error is retried (after 1.5 s), and the run continues.
  const busy = await liveRun([
    { error: { status: 529, type: "overloaded_error", message: "Overloaded" } },
    { blocks: [toolUse("tu_1", "ui_report", { text: "Done for {{cite:beispielg-p20}}." })], stop: "tool_use" },
    { blocks: [text("Ende.")], stop: "end_turn" }
  ]);
  check("an overloaded API is retried and the run finishes", busy.result.status === "done" && busy.fake.requests.length === 3);
  // A failed fact audit of narration is returned to the model with the offending tokens.
  const blocked = await liveRun([
    { blocks: [toolUse("tu_1", "ui_progress", { step: "inventory", agent: "corpus", message: "Es gibt zwei Normen." })], stop: "tool_use" },
    { blocks: [toolUse("tu_2", "ui_report", { text: "Done for {{cite:beispielg-p20}}." })], stop: "tool_use",
      expect: (req, { check: c }) => { const r1 = req.messages[2].content[0]; c(r1.is_error === true && /zwei/.test(r1.content), "the blocked narration must come back as is_error with the token"); } },
    { blocks: [text("Ende.")], stop: "end_turn" }
  ]);
  check("blocked narration returns is_error to the model and shows audit_failed", blocked.fake.violations.length === 0 && blocked.types.includes("audit_failed"), blocked.fake.violations.join("; "));
  end("LIVE LOOP OK");
}

// ---- caps ----------------------------------------------------------------------------------------------
if (want("caps")) {
  begin();
  const progress = (n) => ({ blocks: [toolUse(`tu_${n}`, "ui_progress", { step: "inventory", agent: "corpus", message: "Ich arbeite weiter." })], stop: "tool_use", usage: { input_tokens: 2000, output_tokens: 200 } });
  const calls = await liveRun([], { repeat: progress });
  check("a run that always requests a tool stops after 40 model calls: no 41st", calls.fake.requests.length === 40, `${calls.fake.requests.length} requests`);
  const capEv = calls.events.find((e) => e.type === "cap_reached");
  check("cap_reached names the call cap", capEv?.payload.cap === "calls", JSON.stringify(capEv?.payload));
  check("cap_reached is audited", calls.audit.events().some((e) => e.event === "cap_reached"));
  check("the run stops with the closing report from the template", calls.result.status === "stopped" && calls.state.report?.source === "template" && calls.types.includes("run_finished"));
  const note = (req) => JSON.stringify(req.messages.at(-1)).includes("Budget nearly used: request open decisions, then call ui_report.");
  check("the soft note reaches the model once, in the request after the 36th call", note(calls.fake.requests[36].req) && !note(calls.fake.requests[35].req) && calls.fake.requests.filter((q) => note(q.req)).length === 1);
  // High usage: about €1.34 per call at $2 and $10 per million tokens and 0.894 €/$.
  const dear = (n) => ({ blocks: [toolUse(`tu_${n}`, "ui_progress", { step: "inventory", agent: "corpus", message: "Ich arbeite weiter." })], stop: "tool_use", usage: { input_tokens: 500000, output_tokens: 50000 } });
  const cost = await liveRun([], { repeat: dear });
  check("no call starts once €3 is spent: three calls (€2.68 before the third), no fourth", cost.fake.requests.length === 3, `${cost.fake.requests.length} requests`);
  check("cap_reached names the cost cap", cost.events.find((e) => e.type === "cap_reached")?.payload.cap === "cost");
  // Sub-calls count toward the same cap.
  const sub = await liveRun([
    { blocks: [toolUse("tu_1", "duty_extract", { norm_id: "beispielg" }), toolUse("tu_2", "duty_extract", { norm_id: "musterv" })], stop: "tool_use" },
    { blocks: [toolUse("tu_3", "duty_classify", { candidate_ids: CANDS })], stop: "tool_use" },
    { kind: "classify", blocks: [toolUse("tu_c", "submit_classification", classification("en"))], stop: "tool_use" }
  ], { caps: { maxCalls: 3 }, repeat: progress });
  check("with a cap of three calls the sub-call is the third, and no fourth starts", sub.fake.requests.length === 3 && sub.fake.requests[2].kind === "classify", sub.fake.requests.map((q) => q.kind).join());
  check("the capped run says which cap", sub.events.find((e) => e.type === "cap_reached")?.payload.cap === "calls");
  end("CAPS UNIT OK");
}

// ---- AC-12 ----------------------------------------------------------------------------------------
if (want("sovereign")) {
  begin();
  const sovereign = { enabled: true, label: "Test endpoint", base_url: "https://sovereign.example.test", model: "open-model", requires_key: false, price_eur_per_mtok_in: 0.5, price_eur_per_mtok_out: 1.5 };
  const openai = createFakeOpenAi([
    { content: null, tool_calls: [call("call_1", "law_list", { slice_id: "slice-mini" }), call("call_2", "duty_extract", { norm_id: "beispielg" })] },
    { content: null, tool_calls: [call("call_3", "law_fetch", "{not json")] },
    { content: null, tool_calls: [call("call_4", "ui_report", { text: "Done for {{cite:beispielg-p20}}." })] },
    { content: "Fertig." }
  ]);
  const r = await liveRun([], { mode: "sovereign", sovereign, openai });
  check("the endpoint saw no format violation", openai.violations.length === 0, openai.violations.join("\n  - "));
  const first = openai.requests[0]?.req;
  check("tools go out in the function format, sixteen of them", first?.tools?.length === 16 && first.tools[0].function.name === "law_list" && first.tools[0].function.parameters.additionalProperties === false);
  const second = openai.requests[1]?.req.messages;
  check("tool results come back as role tool with the matching tool_call_id", second?.filter((m) => m.role === "tool").map((m) => m.tool_call_id).join() === "call_1,call_2");
  const third = openai.requests[2]?.req.messages;
  const reply = third?.find((m) => m.role === "tool" && m.tool_call_id === "call_3");
  check("arguments that are not JSON are answered with an error the model can act on", reply && /not valid JSON/.test(reply.content), reply?.content);
  check("the run finishes after ui_report", r.result?.status === "done", JSON.stringify(r.result));
  check("no request went to api.anthropic.com in Sovereign mode", r.fake.requests.length === 0);
  check("the endpoint's usage is priced with its own euro prices", r.audit.events().filter((e) => e.event === "model_response").every((e) => Math.abs(e.cost_eur - (1200 * 0.5 + 300 * 1.5) / 1e6) < 1e-9));
  end("SOVEREIGN OK", `${openai.requests.length} requests`);
}

console.log(failed ? `${failed} of ${checks} checks failed.` : `All ${checks} checks passed.`);
process.exit(failed ? 1 : 0);
