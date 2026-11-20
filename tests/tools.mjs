// Tools suite: the 16 tools and both sub-call tools on the two-norm fixture slice, with the production
// modules (js/tools/, js/state.js, js/engine/) and recorded sub-call outputs. Pure Node, no browser.
//   cases     AC-10: each tool accepts its valid fixture input and answers its invalid one with
//             is_error true and an English instruction (tests/fixtures/tool-cases.json)
//   schemas   every schema strict and within the measured limits (PLAN.md P7); the validator rejects a
//             missing field, an extra field and a wrong type for every tool
//   classify  AC-37: no numeric field in the classification tool; code sets frequency, confidence,
//             status and eu_related; one retry on a schema failure, then needs_review; blocked texts
//   pipeline  AC-13: inventory, clustering, costing and options on the fixture slice, figures worked
//             out by hand from the golden cases' parameters
// Usage: node tests/tools.mjs [section…]
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT, loadFixture, fixtureRecorded } from "./lib/data-node.mjs";
import { createRunState } from "../js/state.js";
import { createToolbox, TOOL_DEFS, SUBCALL_DEFS, ORCHESTRATOR_TOOL_NAMES } from "../js/tools/registry.js";
import { classificationTool } from "../js/tools/schemas.js";
import { validate } from "../js/tools/validate.js";
import { mapClassification } from "../js/engine/mappings.js";

const ONLY = process.argv.slice(2);
const run = (s) => ONLY.length === 0 || ONLY.includes(s);
let failed = 0;
let checks = 0;
let sectionFailed = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) { failed += 1; sectionFailed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${String(detail).slice(0, 600)}` : ""}`); }
};
const begin = () => { sectionFailed = 0; };
const end = (token, extra = "") => console.log(sectionFailed ? `${token.replace(" OK", "")} FAILED` : `${token}${extra ? ` (${extra})` : ""}`);
const near = (a, b, tol = 0.005) => typeof a === "number" && Math.abs(a - b) <= tol;
const CATALOGUE = ["law_list", "law_fetch", "law_search", "duty_extract", "duty_classify", "once_cluster", "once_registers", "cost_params", "cost_estimate", "signal_match", "draft_options", "draft_amendment", "audit_check", "ui_progress", "ui_request_decision", "ui_report"];

/** A toolbox on the fixture slice whose sub-calls answer from the recordings. */
function setup({ lang = "de", classify, decide, model = null } = {}) {
  const data = loadFixture();
  const recorded = fixtureRecorded();
  const state = createRunState({ data, lang, runId: "T1", mode: "simulation" });
  const events = [];
  const calls = { classify: 0, amend: 0 };
  const hooks = {
    classify: async (batch) => {
      calls.classify += 1;
      if (classify) return classify(batch, calls.classify);
      return { classifications: batch.map((b) => ({ ...recorded.classifications[b.candidate_id], rationale: recorded.classifications[b.candidate_id].rationale[lang] })) };
    },
    amend: async ({ option }) => {
      calls.amend += 1;
      const a = recorded.amendments[option.id];
      return { wording: a.wording, gist_en: lang === "en" ? a.gist_en : null };
    },
    requestDecision: async (req) => (decide ? decide(req, state) : null),
    classifierModel: model
  };
  const tb = createToolbox({ data, state, lang, hooks, emit: (type, payload) => events.push({ type, payload }) });
  return { data, state, tb, events, calls, recorded };
}
const parse = (out) => { try { return JSON.parse(out.content); } catch { return null; } };

// ---- AC-10 ----------------------------------------------------------------------------------------
if (run("cases")) {
  begin();
  const fixture = JSON.parse(readFileSync(path.join(ROOT, "tests/fixtures/tool-cases.json"), "utf8"));
  check("the cases cover the 16 tools in catalogue order", JSON.stringify(fixture.cases.map((c) => c.tool)) === JSON.stringify(CATALOGUE));
  const env = setup({
    decide: (req, state) => state.decide({ option_id: req.option_ids[0], decision: "approved", reason_code: "Z2", comment: "" })
  });
  const valid = {
    law_list: (r) => r.slice_id === "slice-mini" && r.norms.map((n) => n.id).join() === "beispielg,musterv" && r.norms[1].eu_related === true,
    law_fetch: (r) => r.paragraphs.length === 1 && r.paragraphs[0].id === "beispielg-p20" && r.paragraphs[0].sentences.length === 3 && /__20\.html$/.test(r.paragraphs[0].html_url),
    law_search: (r) => r.matches.length >= 1 && r.matches.length <= 5 && r.matches.some((m) => m.sentence_id === "beispielg-p20-s1"),
    duty_extract: (r) => r.candidates.map((c) => c.candidate_id).join() === "D-beispielg-p20-1,D-beispielg-p20-2,D-beispielg-p21-1,D-beispielg-p23a-1",
    duty_classify: (r) => r.cards.length === 6 && r.cards.find((c) => c.id === "D-beispielg-p20-2").status === "rejected" && r.cards.filter((c) => c.status === "confirmed").length === 5,
    once_cluster: (r) => r.clusters.length === 1 && r.clusters[0].id === "C-001" && r.clusters[0].duty_ids.join() === "D-beispielg-p20-1,D-musterv-p3-2",
    once_registers: (r) => r.register?.register_id === "reg-unternehmensstammdaten" && r.register.covers_duty_ids.join() === "D-beispielg-p20-1,D-musterv-p3-2",
    cost_params: (r) => r.params.minutes_per_case === 45 && r.params.sources.length === 8,
    cost_estimate: (r) => Boolean(r.facts.ea_annual_eur) && near(env.state.facts.get(r.facts.ea_annual_eur).value, 1220000),
    signal_match: (r) => r.matches.find((m) => m.duty_id === "D-beispielg-p20-1")?.complaint_ids.includes("K-012") && r.matches.find((m) => m.duty_id === "D-musterv-p3-2")?.complaint_ids.includes("K-012"),
    draft_options: (r) => r.options.map((o) => o.type).join() === "register_retrieval,merge,keep",
    draft_amendment: (r) => r.wording.endsWith("[Entwurf, rechtlich zu prüfen]") && r.gist_en === null,
    audit_check: (r) => r.pass === true && env.state.options.get("O-C-001-register_retrieval").status === "proposed",
    ui_progress: (r) => r.ok === true && env.events.some((e) => e.type === "agent_text" && e.payload.step === "propose"),
    ui_request_decision: (r) => r.kind === "option" && r.decision.decision === "approved" && r.decision.reason_code === "Z2" && env.state.dossier.items.length === 1,
    ui_report: (r) => r.ok === true && env.state.report?.text.includes("{{cite:beispielg-p20}}")
  };
  for (const c of fixture.cases) {
    for (const s of c.setup || []) await env.tb.execute(s.tool, s.input);
    const ok = await env.tb.execute(c.tool, c.valid);
    check(`${c.tool}: the valid input is accepted`, ok && !ok.isError, ok?.content);
    const r = parse(ok);
    check(`${c.tool}: the valid input gives the expected result`, Boolean(r && valid[c.tool]?.(r)), ok?.content);
    const bad = await env.tb.execute(c.tool, c.invalid);
    check(`${c.tool}: the invalid input returns is_error`, bad?.isError === true, bad?.content);
    check(`${c.tool}: with the instruction "${c.error}"`, typeof bad?.content === "string" && bad.content.includes(c.error), bad?.content);
  }
  // A tool that is not in the catalogue is answered as an error, too.
  const unknown = await env.tb.execute("law_delete", {});
  check("an unknown tool returns is_error with the tool list", unknown.isError === true && unknown.content.includes("law_list"));
  end("TOOL CASES OK", `${fixture.cases.length} tools`);
}

// ---- strict schemas within the limits ---------------------------------------------------------------
if (run("schemas")) {
  begin();
  const FORBIDDEN = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "maxItems", "oneOf", "allOf", "not", "pattern", "format", "default"];
  const measure = (defs) => {
    let optional = 0;
    let union = 0;
    const problems = [];
    const walk = (s, where) => {
      if (!s || typeof s !== "object") return;
      for (const k of FORBIDDEN) if (k in s) problems.push(`${where}: ${k}`);
      if (Array.isArray(s.type) || s.anyOf) union += 1;
      if ("minItems" in s && ![0, 1].includes(s.minItems)) problems.push(`${where}: minItems ${s.minItems}`);
      const isObject = s.type === "object" || (Array.isArray(s.type) && s.type.includes("object"));
      if (isObject) {
        if (s.additionalProperties !== false) problems.push(`${where}: additionalProperties is not false`);
        const props = Object.keys(s.properties || {});
        for (const r of s.required || []) if (!props.includes(r)) problems.push(`${where}: required ${r} is not a property`);
        optional += props.filter((p) => !(s.required || []).includes(p)).length;
        for (const p of props) walk(s.properties[p], `${where}.${p}`);
      }
      if (s.items) walk(s.items, `${where}[]`);
      for (const x of s.anyOf || []) walk(x, `${where}|`);
    };
    for (const d of defs) {
      if (d.strict !== true) problems.push(`${d.name}: not strict`);
      if (!d.description || d.description.length < 20) problems.push(`${d.name}: no description`);
      if (d.input_schema?.type !== "object") problems.push(`${d.name}: input is not an object`);
      walk(d.input_schema, d.name);
    }
    return { optional, union, problems };
  };
  check("16 orchestrator tools in catalogue order", JSON.stringify(TOOL_DEFS.map((d) => d.name)) === JSON.stringify(CATALOGUE) && JSON.stringify(ORCHESTRATOR_TOOL_NAMES) === JSON.stringify(CATALOGUE));
  const orch = measure(TOOL_DEFS);
  check("the orchestrator's tools are strict, closed and use no forbidden keyword", orch.problems.length === 0, orch.problems.join("; "));
  check(`the orchestrator's request: 16 of 20 strict tools, ${orch.optional} of 24 optional and ${orch.union} of 16 union-typed parameters`, TOOL_DEFS.length <= 20 && orch.optional <= 24 && orch.union <= 16, `${orch.optional} optional, ${orch.union} union`);
  check("the orchestrator's tools measure as in PLAN.md P7 (10 optional, 0 union-typed)", orch.optional === 10 && orch.union === 0, `${orch.optional} optional, ${orch.union} union`);
  check("two sub-call tools: submit_classification and submit_amendment", SUBCALL_DEFS.map((d) => d.name).join() === "submit_classification,submit_amendment");
  for (const d of SUBCALL_DEFS) {
    const m = measure([d]);
    check(`${d.name}: strict, closed, within the limits (${m.optional} optional, ${m.union} union-typed)`, m.problems.length === 0 && m.optional <= 24 && m.union <= 16, m.problems.join("; "));
  }
  check("submit_classification measures as in P7 (0 optional, 3 union-typed)", (() => { const m = measure([SUBCALL_DEFS[0]]); return m.optional === 0 && m.union === 3; })());
  check("submit_amendment measures as in P7 (0 optional, 1 union-typed)", (() => { const m = measure([SUBCALL_DEFS[1]]); return m.optional === 0 && m.union === 1; })());

  // The validator enforces every schema: a missing required field, an extra field, a wrong type.
  const sample = (s) => {
    if (Array.isArray(s.type)) return sample({ ...s, type: s.type.find((t) => t !== "null") });
    if (s.enum) return s.enum.find((x) => x !== null);
    if (s.type === "string") return "x";
    if (s.type === "boolean") return true;
    if (s.type === "integer" || s.type === "number") return 1;
    if (s.type === "array") return [sample(s.items)];
    if (s.type === "object") return Object.fromEntries(Object.keys(s.properties || {}).map((k) => [k, sample(s.properties[k])]));
    return null;
  };
  for (const d of [...TOOL_DEFS, ...SUBCALL_DEFS]) {
    const good = sample(d.input_schema);
    check(`${d.name}: a well-formed input validates`, validate(d.input_schema, good).length === 0, validate(d.input_schema, good).join("; "));
    check(`${d.name}: an extra field is rejected`, validate(d.input_schema, { ...good, extra_field: "x" }).length > 0);
    const req = d.input_schema.required || [];
    if (req.length) {
      const missing = { ...good };
      delete missing[req[0]];
      check(`${d.name}: a missing ${req[0]} is rejected`, validate(d.input_schema, missing).length > 0);
      const wrong = { ...good, [req[0]]: 12345 };
      check(`${d.name}: a number for ${req[0]} is rejected`, validate(d.input_schema, wrong).length > 0);
    }
  }
  end("SCHEMAS OK", `${TOOL_DEFS.length + SUBCALL_DEFS.length} schemas`);
}

// ---- AC-37 ----------------------------------------------------------------------------------------
if (run("classify")) {
  begin();
  // As the sub-call sends it: with the slice's population ids.
  const schema = classificationTool(loadFixture().populations.map((p) => p.id)).input_schema;
  const types = [];
  const walk = (s) => { if (!s || typeof s !== "object") return; types.push(...[].concat(s.type || [])); Object.values(s.properties || {}).forEach(walk); if (s.items) walk(s.items); (s.anyOf || []).forEach(walk); };
  walk(schema);
  check("the classification tool has no numeric field", !types.includes("number") && !types.includes("integer"), types.join());
  const item = fixtureRecorded().classifications["D-beispielg-p20-1"];
  const one = { classifications: [{ ...item, rationale: item.rationale.de }] };
  check("a recorded classification validates", validate(schema, one).length === 0, validate(schema, one).join("; "));
  for (const extra of [{ frequency_per_year: 4 }, { confidence: 0.9 }, { eu_related: true }]) {
    const k = Object.keys(extra)[0];
    check(`a classification with ${k} is rejected`, validate(schema, { classifications: [{ ...one.classifications[0], ...extra }] }).length > 0);
  }
  // The mapping tables, every category.
  const FREQ = { täglich: 250, wöchentlich: 52, monatlich: 12, vierteljährlich: 4, halbjährlich: 2, jährlich: 1 };
  const CONF = { hoch: 0.9, mittel: 0.7, niedrig: 0.5 };
  let combos = 0;
  for (const certainty of Object.keys(CONF)) for (const trigger of ["periodisch", "anlassbezogen", "einmalig"]) for (const term of [...Object.keys(FREQ), null]) for (const isDuty of [true, false]) {
    combos += 1;
    const m = mapClassification({ is_duty: isDuty, certainty, trigger, frequency_term: term });
    const f = trigger === "periodisch" && term ? FREQ[term] : null;
    const st = !isDuty ? "rejected" : CONF[certainty] < 0.6 ? "needs_review" : "confirmed";
    if (m.frequency_per_year !== f || m.confidence !== CONF[certainty] || m.status !== st) check(`mapping ${certainty}/${trigger}/${term}/${isDuty}`, false, JSON.stringify(m));
  }
  check(`the mapping tables hold for all ${combos} combinations`, true);

  // Through the tool: code sets the numbers and eu_related; the model's categories stay as given.
  const env = setup();
  await env.tb.execute("duty_extract", { norm_id: "beispielg" });
  await env.tb.execute("duty_extract", { norm_id: "musterv" });
  const out = parse(await env.tb.execute("duty_classify", { candidate_ids: ["D-beispielg-p20-1", "D-beispielg-p21-1", "D-musterv-p3-2"] }));
  const card = (id) => env.state.duties.get(id);
  check("frequency_per_year from the term (vierteljährlich → 4)", card("D-beispielg-p20-1")?.frequency_per_year === 4);
  check("no frequency for an event-driven duty", card("D-beispielg-p21-1")?.frequency_per_year === null);
  check("confidence from the certainty (hoch 0.9, mittel 0.7)", card("D-beispielg-p20-1")?.classification.confidence === 0.9 && card("D-beispielg-p21-1")?.classification.confidence === 0.7);
  check("eu_related from the norm's eu_basis (MusterV has an EU note, BeispielG none)", card("D-musterv-p3-2")?.eu_related === true && card("D-beispielg-p20-1")?.eu_related === false);
  check("data items mapped to vocabulary ids", JSON.stringify(card("D-musterv-p3-2")?.data_items) === JSON.stringify(["unternehmensstammdaten", "beschaeftigte"]));
  check("the evidence span marks the trigger phrase", card("D-beispielg-p20-1")?.evidence_span?.phrase === "zu melden");
  check("a recorded classification is marked as recorded, with pattern ids and certainty", card("D-beispielg-p20-1")?.classification.method === "pattern+recorded" && card("D-beispielg-p20-1")?.classification.model === null && card("D-beispielg-p20-1")?.classification.pattern_ids.includes("PM-02") && card("D-beispielg-p20-1")?.classification.certainty === "hoch");
  const live = setup({ model: "claude-haiku-5-5" });
  await live.tb.execute("duty_extract", { norm_id: "beispielg" });
  await live.tb.execute("duty_classify", { candidate_ids: ["D-beispielg-p20-1"] });
  check("a model's classification is marked pattern+llm with the model", live.state.duties.get("D-beispielg-p20-1")?.classification.method === "pattern+llm" && live.state.duties.get("D-beispielg-p20-1")?.classification.model === "claude-haiku-5-5");
  check("the tool result lists the cards", out?.cards?.length === 3);

  // A schema failure is retried once; a second failure sends the batch to needs_review.
  const bad = setup({ classify: () => ({ classifications: [{ ...one.classifications[0], frequency_per_year: 4 }] }) });
  await bad.tb.execute("duty_extract", { norm_id: "beispielg" });
  const r = await bad.tb.execute("duty_classify", { candidate_ids: ["D-beispielg-p20-1"] });
  check("an invalid classification is retried once", bad.calls.classify === 2, bad.calls.classify);
  check("after the retry the batch goes to needs_review", bad.state.duties.get("D-beispielg-p20-1")?.status === "needs_review", r.content);
  // A population that is not in the list is a schema failure too.
  const pop = setup({ classify: () => ({ classifications: [{ ...one.classifications[0], population_id: "pop-erfunden" }] }) });
  await pop.tb.execute("duty_extract", { norm_id: "beispielg" });
  await pop.tb.execute("duty_classify", { candidate_ids: ["D-beispielg-p20-1"] });
  check("an unlisted population_id fails validation and ends in needs_review", pop.calls.classify === 2 && pop.state.duties.get("D-beispielg-p20-1")?.status === "needs_review");
  // A bare number in the rationale is blocked without retry; the card shows "Text blocked".
  const num = setup({ classify: () => ({ classifications: [{ ...one.classifications[0], rationale: "Meldung binnen 15 Tagen" }] }) });
  await num.tb.execute("duty_extract", { norm_id: "beispielg" });
  await num.tb.execute("duty_classify", { candidate_ids: ["D-beispielg-p20-1"] });
  const blocked = num.state.duties.get("D-beispielg-p20-1");
  check("a rationale with a bare number is replaced by the blocked marker, without a retry", num.calls.classify === 1 && blocked?.classification.rationale === null && blocked?.blocked_fields?.includes("rationale"));
  check("the blocked text is logged as audit_failed", num.events.some((e) => e.type === "audit_failed" && e.payload.field === "rationale"));
  // More than 25 candidates are refused.
  const many = setup();
  const ids = Array.from({ length: 26 }, (_, i) => `D-beispielg-p20-${i + 1}`);
  const tooMany = await many.tb.execute("duty_classify", { candidate_ids: ids });
  check("more than 25 candidates are refused with an instruction", tooMany.isError && tooMany.content.includes("At most 25 candidates per call"));
  end("CLASSIFY OK", `${combos} mapping combinations`);
}

// ---- AC-13 ----------------------------------------------------------------------------------------
if (run("pipeline")) {
  begin();
  const env = setup({ lang: "en" });
  const call = async (name, input) => { const o = await env.tb.execute(name, input); check(`${name} ${JSON.stringify(input)} runs`, !o.isError, o.content); return parse(o); };
  const list = await call("law_list", { slice_id: "slice-mini" });
  for (const n of list.norms) await call("duty_extract", { norm_id: n.id });
  const cands = [...env.state.candidates.keys()];
  await call("duty_classify", { candidate_ids: cands });
  const clusters = await call("once_cluster", {});
  const c1 = clusters.clusters[0];
  check("one cluster of the two quarterly reports, from two norms", clusters.clusters.length === 1 && c1.duty_ids.join() === "D-beispielg-p20-1,D-musterv-p3-2");
  check("cluster overlap 1 (both ask for company master data and persons employed) and confidence 0.9", c1.overlap === 1 && c1.confidence === 0.9 && c1.shared_items.join() === "beschaeftigte,unternehmensstammdaten");
  await call("once_registers", { target: "C-001" });
  for (const id of ["D-beispielg-p20-1", "D-musterv-p3-2"]) await call("cost_params", { duty_id: id });
  const est = await call("cost_estimate", { target: "D-beispielg-p20-1" });
  const fact = (id) => env.state.facts.get(id);
  // G1: 10,000 units × 4 = 40,000 cases × (45/60 × €40 + €0.50) = €1,220,000.
  check("G1 duty: Fallzahl 40,000 and EA €1,220,000", near(fact(est.facts.fallzahl)?.value, 40000) && near(fact(est.facts.ea_annual_eur)?.value, 1220000));
  const est2 = await call("cost_estimate", { target: "C-001" });
  // The cluster: €1,220,000 + 40,000 × (30/60 × €40 + €0.50) = €1,220,000 + €820,000.
  check("the cluster's EA is the sum of its members, €2,040,000", near(fact(est2.facts.ea_annual_eur)?.value, 2040000));
  const duty = await call("draft_options", { target: "D-beispielg-p20-1" });
  const val = (o, m) => fact(o.facts[m])?.value;
  const byType = (r) => Object.fromEntries(r.options.map((o) => [o.type, o]));
  const d = byType(duty);
  check("duty options in the order of O1: delete, register_retrieval, lower_frequency, keep", duty.options.map((o) => o.type).join() === "delete,register_retrieval,lower_frequency,keep");
  check("delete −€1,220,000; register retrieval −€1,160,000 (businesses −€1,220,000, administration +€60,000, one-off €250,000); lower frequency −€915,000",
    near(val(d.delete, "net_delta"), -1220000) && near(val(d.register_retrieval, "net_delta"), -1160000) && near(val(d.register_retrieval, "wirtschaft_delta"), -1220000)
    && near(val(d.register_retrieval, "verwaltung_delta"), 60000) && near(val(d.register_retrieval, "one_off"), 250000) && near(val(d.lower_frequency, "net_delta"), -915000));
  check("merge is ineligible for a duty: no cluster", duty.ineligible.some((x) => x.type === "merge" && x.reason === "no_cluster"));
  const cl = await call("draft_options", { target: "C-001" });
  const c = byType(cl);
  check("cluster options: register_retrieval, merge, keep", cl.options.map((o) => o.type).join() === "register_retrieval,merge,keep");
  // Register retrieval replaces both: −€2,040,000 + 2 × 40,000 × 2/60 × €45 = −€1,920,000 (as O6).
  // Merge: the lead keeps 45 minutes, the member's items are all contained (o = 1), so
  // 40,000 × (45/60 × €40 + €0.50) − €2,040,000 = −€820,000, one duty fewer.
  check("register retrieval −€1,920,000 replacing both; merge −€820,000 and one duty fewer",
    near(val(c.register_retrieval, "net_delta"), -1920000) && near(val(c.merge, "net_delta"), -820000) && near(val(c.merge, "duty_count_delta"), -1)
    && env.state.options.get("O-C-001-register_retrieval").removed_duty_ids.join() === "D-beispielg-p20-1,D-musterv-p3-2");
  check("lower frequency and delete are for single duties only", ["lower_frequency", "delete"].every((t) => cl.ineligible.some((x) => x.type === t && x.reason === "single_duties_only")));
  check("every option figure is a registered fact with a key", [...duty.options, ...cl.options].every((o) => Object.values(o.facts).every((id) => fact(id)?.key?.startsWith(`draft_options|${o.id.slice(2, o.id.lastIndexOf("-"))}|`))));
  check("no code path knows the fixture: the same modules serve data/ (the toolbox is built from the data object only)", typeof createToolbox === "function" && !readFileSync(path.join(ROOT, "js/tools/registry.js"), "utf8").includes("slice-mini"));
  end("PIPELINE OK");
}

console.log(failed ? `${failed} of ${checks} checks failed.` : `All ${checks} checks passed.`);
process.exit(failed ? 1 : 0);
