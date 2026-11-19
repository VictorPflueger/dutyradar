// Runs suite: the recorded runs R1 to R3 replayed headless in Node with the production modules
// (js/simulation.js, js/tools/, js/state.js, js/engine/), and the run checker (js/run_check.js).
//   checker  the checker fails on each fault it guards against, on broken copies of R1
//   facts    AC-36: two replays bind every fact id to the same key; after an assumption edit that makes
//            an option ineligible the ids stay, and retired facts render "no longer applies" / "entfallen"
//   replay   R1 to R3 to their end with the intended decisions and with other decisions: dossier,
//            kept duties and KPIs equal what the engines compute from the decisions taken
// Usage: node tests/runs.mjs [section…]
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT, loadBundled } from "./lib/data-node.mjs";

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
globalThis.sessionStorage = memoryStorage();
globalThis.localStorage = memoryStorage();

const { loadI18n } = await import("../js/i18n.js");
const { createRunState } = await import("../js/state.js");
const { replayRun } = await import("../js/simulation.js");
const { checkRun } = await import("../js/run_check.js");
const { renderPlaceholders } = await import("../js/placeholders.js");
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
const readRun = (id) => JSON.parse(readFileSync(path.join(ROOT, "data/runs", `${id}.json`), "utf8"));
const clone = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b) => Math.abs(a - b) <= 0.005;
const RUNS = ["R1", "R2", "R3"];
const dataFor = (run) => loadBundled(run.meta.norm_ids);

/** Replays a run headless; decide(req, state) answers option decisions (default: the recorded intention). */
async function replay(runId, { lang = "en", decide = null, before = null } = {}) {
  const run = readRun(runId);
  const data = dataFor(run);
  const state = createRunState({ data, lang, runId, mode: "simulation" });
  before?.(state, data);
  const events = [];
  const result = await replayRun({
    run, data, state, lang,
    wait: () => Promise.resolve(),
    emit: (ev) => events.push(ev),
    awaitDecision: async (req) => {
      if (decide) return decide(req, state);
      const i = req.intended;
      return state.decide({ option_id: i.option_id, decision: i.decision, reason_code: i.reason_code, comment: i.comment || "" });
    }
  });
  return { run, data, state, events, result };
}

// ---- the checker guards ----------------------------------------------------------------------------
if (want("checker")) {
  begin();
  const base = readRun("R1");
  const data = dataFor(base);
  const ok = checkRun(base, { data });
  check("R1 passes the checker as it is (the control)", ok.length === 0, ok.join("; "));
  const firstText = (run) => run.events.find((e) => e.type === "tool_call" && e.payload.tool === "ui_progress");
  const breakers = {
    "a bare number in a text": (r) => { firstText(r).payload.input.message.en += " Three of them, 3."; },
    "an unknown fact id": (r) => { firstText(r).payload.input.message.de += " {{fact:F-9999}}"; firstText(r).payload.input.message.en += " {{fact:F-9999}}"; },
    "an unknown cite id": (r) => { firstText(r).payload.input.message.de += " {{cite:gibtsnicht-p1}}"; firstText(r).payload.input.message.en += " {{cite:gibtsnicht-p1}}"; },
    "a key-like string": (r) => { r.meta.note = ["sk", "ant", "api03", "A".repeat(30)].join("-"); },
    "a thinking block": (r) => { r.events.splice(2, 0, { run_id: "R1", seq: 0, t_ms: 0, mode: "simulation", agent: "orchestrator", type: "agent_text", payload: { thinking: "…", signature: "x" } }); },
    "a decision_recorded event": (r) => { r.events.push({ run_id: "R1", seq: 0, t_ms: 0, mode: "simulation", agent: "human", type: "decision_recorded", payload: {} }); },
    "a dossier_updated event": (r) => { r.events.push({ run_id: "R1", seq: 0, t_ms: 0, mode: "simulation", agent: "ui", type: "dossier_updated", payload: {} }); },
    "a ui_report call": (r) => { r.events.push({ run_id: "R1", seq: 0, t_ms: 0, mode: "simulation", agent: "ui", type: "tool_call", payload: { tool: "ui_report", input: { text: { en: "Done.", de: "Fertig." } } } }); },
    "texts with different placeholders": (r) => { firstText(r).payload.input.message.en += " {{cite:beispielg-p20}}"; },
    "a text in one language only": (r) => { delete firstText(r).payload.input.message.de; },
    "a run not marked hand-authored": (r) => { r.meta.source = "recorded"; },
    "a decision request without its intention": (r) => { delete r.events.find((e) => e.payload?.tool === "ui_request_decision" && e.payload.input.option_ids).payload.intended; }
  };
  for (const [what, breakIt] of Object.entries(breakers)) {
    const broken = clone(base);
    breakIt(broken);
    const problems = checkRun(broken, { data });
    check(`the checker fails on ${what}`, problems.length > 0, "no problem reported");
  }
  end("CHECKER CONTROLS OK", `${Object.keys(breakers).length} faults`);
}

// ---- AC-36 ----------------------------------------------------------------------------------------
if (want("facts")) {
  begin();
  const a = await replay("R1", { lang: "en" });
  const b = await replay("R1", { lang: "de" });
  const keysOf = (s) => Object.fromEntries(s.facts.all().map((f) => [f.id, f.key]));
  const ka = keysOf(a.state);
  const kb = keysOf(b.state);
  check("two replays produce the same facts with the same ids", JSON.stringify(ka) === JSON.stringify(kb) && Object.keys(ka).length > 0, `${Object.keys(ka).length} vs ${Object.keys(kb).length}`);
  for (const [id, key] of Object.entries(a.run.facts)) check(`recorded ${id} is bound to ${key}`, ka[id] === key, ka[id]);
  // An assumption edit that makes an option ineligible: the duty becomes yearly, so lowering its
  // frequency no longer applies (the ladder's next step below 1 does not exist).
  const target = a.run.meta.edit_case;
  check("R1 names an edit case for this test", Boolean(target?.duty_id && target.field && target.value !== undefined));
  const before = keysOf(a.state);
  const change = a.state.editParam(target.duty_id, target.field, target.value);
  check("the edit recomputes facts and options and reports parameter_changed", change?.event === "parameter_changed" && change.retired.length > 0, JSON.stringify(change));
  const after = keysOf(a.state);
  check("every fact id keeps its key after the edit", Object.entries(before).every(([id, key]) => after[id] === key));
  const retired = a.state.facts.get(change.retired[0]);
  check("a retired fact keeps its id and has no value", retired?.retired === true && retired.value === null);
  const en = renderPlaceholders(`{{fact:${change.retired[0]}}}`, { facts: a.state.facts, lang: "en", data: a.data, format: "text" });
  const de = renderPlaceholders(`{{fact:${change.retired[0]}}}`, { facts: a.state.facts, lang: "de", data: a.data, format: "text" });
  check("its placeholder renders \"no longer applies\" in English and \"entfallen\" in German", en === "no longer applies" && de === "entfallen", `${en} / ${de}`);
  // Replaying after the same edit made up front keeps the recorded ids too.
  const c = await replay("R1", { before: (state) => state.editParam(target.duty_id, target.field, target.value) });
  const kc = keysOf(c.state);
  check("a replay after the edit binds the recorded ids to the same keys", Object.entries(c.run.facts).every(([id, key]) => !kc[id] || kc[id] === key));
  check("facts the edited replay no longer produces render as no longer applies", Object.keys(c.run.facts).filter((id) => !kc[id] || c.state.facts.get(id)?.retired).every((id) => renderPlaceholders(`{{fact:${id}}}`, { facts: c.state.facts, lang: "en", data: c.data, format: "text" }) === "no longer applies"));
  end("FACT BINDING OK", `${Object.keys(ka).length} facts`);
}

// ---- replay to the end ----------------------------------------------------------------------------
if (want("replay")) {
  begin();
  for (const id of RUNS) {
    for (const lang of ["en", "de"]) {
      const r = await replay(id, { lang });
      check(`${id} ${lang}: replays to its end`, r.result?.status === "done", JSON.stringify(r.result));
      check(`${id} ${lang}: no tool error in the replay`, !r.events.some((e) => e.type === "tool_result" && e.payload.ok === false && !e.payload.expected_error), r.events.filter((e) => e.type === "tool_result" && e.payload.ok === false).map((e) => e.payload.content).join("; "));
      check(`${id} ${lang}: the closing report comes from the template`, r.state.report?.source === "template" && r.events.some((e) => e.type === "run_finished"));
      // KPIs equal what the engines say about the decisions taken.
      const k = r.state.kpis();
      const approved = r.state.decisions.filter((d) => d.decision === "approved").map((d) => r.state.options.get(d.option_id));
      const ea = approved.reduce((s, o) => s + o.delta_ea_eur, 0);
      check(`${id} ${lang}: compliance cost addressed equals the approved options' net deltas`, near(k.ea_addressed_eur, ea), `${k.ea_addressed_eur} vs ${ea}`);
      const removed = new Set(approved.flatMap((o) => o.removed_duty_ids));
      const confirmed = [...r.state.duties.values()].filter((d) => d.status === "confirmed");
      const share = (type) => { const all = confirmed.filter((d) => d.type === type); return all.length ? all.filter((d) => removed.has(d.id)).length / all.length : 0; };
      check(`${id} ${lang}: coverage equals removed duties per type`, near(k.coverage.reporting.share, share("MELDEPFLICHT")) && near(k.coverage.documentation.share, share("DOKUMENTATIONSPFLICHT")));
      check(`${id} ${lang}: the dossier holds exactly the approved relief options`, JSON.stringify(r.state.dossier.items.map((x) => x.option_id).sort()) === JSON.stringify(approved.filter((o) => o.type !== "keep").map((o) => o.id).sort()));
      check(`${id} ${lang}: every kept duty carries its justification code`, r.state.dossier.kept.every((x) => /^A[1-46]$/.test(x.reason_code)));
    }
  }
  // R1 with another decision than the intended one: reject the intended option with A3, then keep.
  const other = await replay("R1", {
    decide: (req, state) => {
      if (req.option_ids.includes(req.intended.option_id) && state.options.get(req.intended.option_id).status !== "rejected") {
        return state.decide({ option_id: req.intended.option_id, decision: "rejected", reason_code: "A3", comment: "" });
      }
      const keep = req.option_ids.find((o) => o.endsWith("-keep"));
      return state.decide({ option_id: keep, decision: "approved", reason_code: "A3", comment: "" });
    }
  });
  check("R1 with a rejection instead of the intended approval still ends", other.result?.status === "done", JSON.stringify(other.result));
  check("then the dossier holds no relief item and the KPIs stay at zero", other.state.dossier.items.length === 0 && other.state.kpis().ea_addressed_eur === 0);
  const report = renderPlaceholders(other.state.report.text, { facts: other.state.facts, lang: "en", data: other.data, format: "text" });
  check("and the closing report says nothing was approved", /no relief option was approved/i.test(report), report);
  const r2 = await replay("R2");
  check("R2 records the split, a blocked figure, the rejection and the duty kept with A1",
    r2.events.some((e) => e.type === "cluster_split") && r2.events.some((e) => e.type === "audit_failed") && r2.state.decisions.some((d) => d.decision === "rejected") && r2.state.dossier.kept.some((x) => x.reason_code === "A1") && r2.state.dossier.items.length === 0);
  end("REPLAY OK", `${RUNS.length} runs × 2 languages`);
}

console.log(failed ? `${failed} of ${checks} checks failed.` : `All ${checks} checks passed.`);
process.exit(failed ? 1 : 0);
