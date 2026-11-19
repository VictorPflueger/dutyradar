// Builds the hand-authored runs data/runs/R1.json to R3.json (decision D7: no API key, so no recording).
// Each run is the tool sequence a Live run follows, with narration in English and German, the
// classifications a classifier would return (tools/runs/rules.mjs, hand-written cards for the
// duties the storyline turns on in tools/runs/overrides.json) and the drafted amendment wording.
// Fact placeholders are written by key ({{fact@<key>}}) and resolved to ids by a dry replay with the
// production modules; a second replay checks the finished run, and js/run_check.js must pass.
// Usage: node tools/author-runs.mjs [R1 R2 R3]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildData } from "../js/data.js";
import { createRunState } from "../js/state.js";
import { createToolbox } from "../js/tools/registry.js";
import { extractCandidates } from "../js/engine/patterns.js";
import { replayRun } from "../js/simulation.js";
import { checkRun } from "../js/run_check.js";
import { classify } from "./runs/rules.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = (...p) => JSON.parse(readFileSync(path.join(ROOT, ...p), "utf8"));
const OVERRIDES = json("tools/runs/overrides.json").cards;

function load(normIds) {
  const index = json("data/corpus/index.json");
  return buildData({
    index, slice: json("config/slice.json"), norms: normIds.map((id) => json("data/corpus", `${id}.json`)),
    patterns: json("data/patterns/duty-patterns.json"), vocab: json("data/vocab/data-items.json"),
    populations: json("data/params/populations.json"), costParams: json("data/params/cost-params.json"),
    oneOff: json("data/params/one-off.json"), registers: json("data/registers.json"),
    consumers: json("data/consumers.json"), complaints: json("data/signals/complaints.json")
  });
}

/** The authored classification of every candidate of the run's norms. */
function classifications(data, normIds) {
  const family = new Map(data.index.norms.map((n) => [n.id, n.family]));
  const out = {};
  for (const id of normIds) {
    const norm = data.norms.get(id);
    const normText = norm.paragraphs.map((p) => p.text).join(" ");
    for (const c of extractCandidates(norm, data.patterns)) {
      const cand = { ...c, norm_id: id };
      out[c.candidate_id] = OVERRIDES[c.candidate_id] ? { candidate_id: c.candidate_id, ...OVERRIDES[c.candidate_id] } : classify(cand, { data, normText, family: family.get(id) });
    }
  }
  return out;
}

/** Phase A: the inventory and clusters a run will find, to pick the storyline's targets. */
async function world(data, normIds, recorded) {
  const state = createRunState({ data, lang: "en", runId: "A", mode: "simulation" });
  const tb = createToolbox({ data, state, lang: "en", emit: () => {}, hooks: { classify: async (batch) => ({ classifications: batch.map((b) => ({ ...recorded[b.candidate_id], rationale: recorded[b.candidate_id].rationale.en })) }) } });
  const byNorm = {};
  for (const id of normIds) byNorm[id] = JSON.parse((await tb.execute("duty_extract", { norm_id: id })).content).candidates.map((c) => c.candidate_id);
  for (const id of normIds) for (let i = 0; i < byNorm[id].length; i += 25) await tb.execute("duty_classify", { candidate_ids: byNorm[id].slice(i, i + 25) });
  await tb.execute("once_cluster", {});
  return { state, byNorm, clusterWith: (dutyIds) => [...state.clusters.values()].find((c) => dutyIds.every((d) => c.duty_ids.includes(d)))?.id };
}

/** Event builder: tool calls, narration and reviews, paced in milliseconds. */
function builder(runId, pace = 1) {
  const events = [];
  let t = 0;
  let n = 0;
  const push = (type, agent, payload, dt) => { t += Math.round(dt * pace); events.push({ run_id: runId, seq: events.length + 1, t_ms: t, mode: "simulation", agent, type, payload }); };
  return {
    events,
    plan: (text, dt = 1500) => push("plan", "orchestrator", { text }, dt),
    tool: (tool, input, { dt = 1200, intended = null, expectError = false } = {}) => push("tool_call", "orchestrator", { tool, tool_use_id: `${runId}-tu-${String(++n).padStart(3, "0")}`, input, ...(intended ? { intended } : {}), ...(expectError ? { expect_error: true } : {}) }, dt),
    say: (step, agent, message, { focus = null, dt = 3500 } = {}) => push("tool_call", "orchestrator", { tool: "ui_progress", tool_use_id: `${runId}-tu-${String(++n).padStart(3, "0")}`, input: { step, agent, message, ...(focus ? { focus } : {}) } }, dt),
    review: (clusterId, action, separate = []) => {
      push("tool_call", "orchestrator", { tool: "ui_request_decision", tool_use_id: `${runId}-tu-${String(++n).padStart(3, "0")}`, input: { cluster_id: clusterId } }, 2500);
      push(action === "split" ? "cluster_split" : "cluster_confirmed", "human", { cluster_id: clusterId, ...(action === "split" ? { separate_ids: separate } : {}) }, 400);
    }
  };
}

const T = (en, de) => ({ en, de });
const FAMILY_TEXT = {
  statistics: T("Next: the business statistics laws.", "Weiter mit den Gesetzen der Wirtschaftsstatistik."),
  energy: T("Next: the energy statistics.", "Weiter mit der Energiestatistik."),
  worktime: T("Next: minimum wage and working time.", "Weiter mit Mindestlohn und Arbeitszeit."),
  products: T("Next: product responsibility.", "Weiter mit der Produktverantwortung."),
  trade: T("Next: the trade regulation and its ordinances.", "Weiter mit dem Gewerberecht und seinen Verordnungen.")
};

/** Inventory of the given norms: extraction, classification in batches of at most 25, family narration. */
function inventory(b, data, w, normIds, { dtExtract = 900, dtClassify = 1400 } = {}) {
  let family = null;
  for (const id of normIds) {
    const f = data.index.norms.find((n) => n.id === id).family;
    if (f !== family && normIds.length > 3) { b.say("inventory", "duty_extractor", FAMILY_TEXT[f], { dt: 2500 }); family = f; }
    b.tool("duty_extract", { norm_id: id }, { dt: dtExtract });
    const ids = w.byNorm[id];
    for (let i = 0; i < ids.length; i += 25) b.tool("duty_classify", { candidate_ids: ids.slice(i, i + 25) }, { dt: dtClassify });
  }
}

const STORIES = {
  R1: {
    title: T("R1 Pitch run", "R1 Pitch-Lauf"),
    pace: 1.5,
    norms: (data) => data.index.norms.map((n) => n.id),
    edit_case: { duty_id: "D-prodgewstatg-p9-1", field: "frequency_per_year", value: 4 },
    amendments: (C) => ({
      [`O-${C}-merge`]: [
        { wording: "{{cite:prodgewstatg-p9}} Absatz 1 wird aufgehoben; die Angaben werden binnen 10 Tagen nach Monatsende mit der Meldung nach {{cite:hdldlstatg-p11}} Absatz 1 übermittelt. [Entwurf, rechtlich zu prüfen]", gist_en: "The production survey's own report is repealed; its data travels with the monthly trade and services report.", expect_audit: "fail" },
        { wording: "{{cite:prodgewstatg-p9}} Absatz 1 wird aufgehoben; die Angaben werden mit der Meldung nach {{cite:hdldlstatg-p11}} Absatz 1 übermittelt. [Entwurf, rechtlich zu prüfen]", gist_en: "The production survey's own report is repealed; its data travels with the monthly trade and services report." }
      ],
      [`O-${C}-register_retrieval`]: [
        { wording: "In {{cite:hdldlstatg-p11}} Absatz 1 werden nach den Wörtern „Für die Erhebungen besteht Auskunftspflicht“ die Wörter „, soweit die Angaben nicht aus dem Unternehmensregister abgerufen werden“ eingefügt. [Entwurf, rechtlich zu prüfen]", gist_en: "The monthly trade and services report applies only where the data cannot be retrieved from the business register." }
      ]
    }),
    script(b, data, w) {
      const C = w.clusterWith(["D-hdldlstatg-p11-1", "D-prodgewstatg-p9-1"]);
      if (!C) throw new Error("R1: the storyline cluster did not form");
      b.plan(T("Plan: read the slice, find the duties, cluster duplicate data requests, price the largest cluster and propose relief for it.", "Plan: den Ausschnitt lesen, die Pflichten finden, doppelte Datenanforderungen bündeln, das größte Bündel bepreisen und dafür Entlastung vorschlagen."));
      b.tool("law_list", { slice_id: data.sliceId });
      b.say("inventory", "corpus", T("I read the norms of the slice, family by family.", "Ich lese die Normen des Ausschnitts, Familie für Familie."));
      inventory(b, data, w, this.norms(data));
      b.say("cluster", "once_matcher", T("The inventory is complete; now I look for duties that ask the same businesses for the same data.", "Das Inventar steht; jetzt suche ich Pflichten, die dieselben Betriebe nach denselben Daten fragen."), { dt: 4000 });
      b.tool("once_cluster", {}, { dt: 2500 });
      b.say("cluster", "once_matcher", T(`Cluster ${C}: the monthly reports under {{cite:hdldlstatg-p11}} and {{cite:prodgewstatg-p9}} ask the same businesses for company data, persons employed, turnover and branch.`, `Bündel ${C}: Die Monatsmeldungen nach {{cite:hdldlstatg-p11}} und {{cite:prodgewstatg-p9}} fragen dieselben Betriebe nach Stammdaten, tätigen Personen, Umsatz und Branche.`), { focus: C, dt: 5000 });
      b.tool("once_registers", { target: C }, { dt: 2500 });
      b.tool("cost_params", { duty_id: "D-hdldlstatg-p11-1" }, { dt: 1500 });
      b.tool("cost_params", { duty_id: "D-prodgewstatg-p9-1" }, { dt: 1500 });
      b.tool("cost_estimate", { target: C }, { dt: 2000 });
      b.say("price", "cost", T(`Cluster ${C} costs businesses {{fact@cost_estimate|${C}|ea_annual_eur}} a year under {{cite:hdldlstatg-p11}} and {{cite:prodgewstatg-p9}}.`, `Bündel ${C} kostet die Betriebe nach {{cite:hdldlstatg-p11}} und {{cite:prodgewstatg-p9}} {{fact@cost_estimate|${C}|ea_annual_eur}} im Jahr.`), { focus: C, dt: 5000 });
      b.tool("signal_match", { duty_ids: ["D-hdldlstatg-p11-1", "D-prodgewstatg-p9-1"] }, { dt: 2000 });
      b.tool("draft_options", { target: C }, { dt: 3000 });
      b.say("propose", "drafting", T(`For cluster ${C} under {{cite:hdldlstatg-p11}} merging changes the cost by {{fact@draft_options|${C}|merge|net_delta}}, a register retrieval by {{fact@draft_options|${C}|register_retrieval|net_delta}} a year.`, `Für Bündel ${C} nach {{cite:hdldlstatg-p11}} ändert Zusammenführen den Aufwand um {{fact@draft_options|${C}|merge|net_delta}}, ein Registerabruf um {{fact@draft_options|${C}|register_retrieval|net_delta}} im Jahr.`), { focus: C, dt: 6000 });
      b.tool("draft_amendment", { option_id: `O-${C}-merge` }, { dt: 4000 });
      b.tool("audit_check", { option_id: `O-${C}-merge` }, { dt: 2500, expectError: true });
      b.say("propose", "drafting", T("The draft had a deadline as a bare number; I redraft it without one.", "Der Entwurf enthielt eine Frist als bloße Zahl; ich formuliere ihn ohne sie neu."), { dt: 4000 });
      b.tool("draft_amendment", { option_id: `O-${C}-merge` }, { dt: 4000 });
      b.tool("audit_check", { option_id: `O-${C}-merge` }, { dt: 2500 });
      b.tool("draft_amendment", { option_id: `O-${C}-register_retrieval` }, { dt: 4000 });
      b.tool("audit_check", { option_id: `O-${C}-register_retrieval` }, { dt: 2500 });
      b.say("decide", "drafting", T(`The options for cluster ${C} under {{cite:hdldlstatg-p11}} are ready for your decision.`, `Die Optionen für Bündel ${C} nach {{cite:hdldlstatg-p11}} liegen zur Entscheidung vor.`), { focus: C, dt: 4000 });
      b.tool("ui_request_decision", { target: C, option_ids: [`O-${C}-merge`, `O-${C}-register_retrieval`, `O-${C}-keep`] }, { dt: 2500, intended: { option_id: `O-${C}-merge`, decision: "approved", reason_code: "Z1" } });
      return C;
    }
  },
  R2: {
    title: T("R2 Rejection path", "R2 Ablehnungspfad"),
    pace: 1.8,
    norms: () => ["milog", "aentg_2009", "milomeldv"],
    amendments: (C) => ({
      [`O-${C}-a-register_retrieval`]: [
        { wording: "{{cite:milog-p16}} Absatz 1 und {{cite:aentg_2009-p18}} Absatz 1 werden für 3 Jahre ausgesetzt; die Behörden der Zollverwaltung rufen die Angaben aus dem Register ab. [Entwurf, rechtlich zu prüfen]", gist_en: "Both registrations are suspended; customs retrieves the data from the register.", expect_audit: "fail" },
        { wording: "{{cite:milog-p16}} Absatz 1 und {{cite:aentg_2009-p18}} Absatz 1 gelten nicht, soweit die Behörden der Zollverwaltung die Angaben aus dem Register abrufen können. [Entwurf, rechtlich zu prüfen]", gist_en: "Both registrations no longer apply where customs can retrieve the data from the register." }
      ],
      [`O-${C}-a-merge`]: [
        { wording: "{{cite:aentg_2009-p18}} Absatz 1 wird aufgehoben; die Anmeldung nach {{cite:milog-p16}} Absatz 1 umfasst die Angaben. [Entwurf, rechtlich zu prüfen]", gist_en: "The second registration is repealed; the first covers its data." }
      ]
    }),
    script(b, data, w) {
      const C = w.clusterWith(["D-aentg_2009-p18-1", "D-milog-p16-1", "D-milomeldv-p2-1"]);
      if (!C) throw new Error("R2: the storyline cluster did not form");
      const P = `${C}-a`;
      b.plan(T("Plan: read the minimum wage and posting rules, cluster the registrations of foreign employers and propose relief.", "Plan: die Regeln zu Mindestlohn und Entsendung lesen, die Anmeldungen ausländischer Arbeitgeber bündeln und Entlastung vorschlagen."));
      b.tool("law_list", { slice_id: data.sliceId });
      inventory(b, data, w, this.norms(), { dtExtract: 1200, dtClassify: 2000 });
      b.tool("once_cluster", {}, { dt: 2500 });
      b.say("cluster", "once_matcher", T(`Cluster ${C} links the registrations under {{cite:milog-p16}}, {{cite:aentg_2009-p18}} and {{cite:milomeldv-p2}}; its confidence is low, so I ask for a review.`, `Bündel ${C} verbindet die Anmeldungen nach {{cite:milog-p16}}, {{cite:aentg_2009-p18}} und {{cite:milomeldv-p2}}; seine Konfidenz ist gering, deshalb bitte ich um Prüfung.`), { focus: C, dt: 5000 });
      b.review(C, "split", ["D-milomeldv-p2-1"]);
      b.say("cluster", "once_matcher", T(`I continue with the part of cluster ${C} under {{cite:milog-p16}} and {{cite:aentg_2009-p18}}.`, `Ich arbeite mit dem Teil von Bündel ${C} nach {{cite:milog-p16}} und {{cite:aentg_2009-p18}} weiter.`), { focus: P, dt: 4000 });
      b.tool("once_registers", { target: P }, { dt: 2500 });
      b.tool("cost_estimate", { target: P }, { dt: 2000 });
      b.tool("draft_options", { target: P }, { dt: 3000 });
      b.tool("draft_amendment", { option_id: `O-${P}-register_retrieval` }, { dt: 4000 });
      b.tool("audit_check", { option_id: `O-${P}-register_retrieval` }, { dt: 2500, expectError: true });
      b.say("propose", "drafting", T("The draft named a period as a bare number; I redraft it.", "Der Entwurf nannte einen Zeitraum als bloße Zahl; ich formuliere ihn neu."), { dt: 4000 });
      b.tool("draft_amendment", { option_id: `O-${P}-register_retrieval` }, { dt: 4000 });
      b.tool("audit_check", { option_id: `O-${P}-register_retrieval` }, { dt: 2500 });
      b.tool("draft_amendment", { option_id: `O-${P}-merge` }, { dt: 4000 });
      b.tool("audit_check", { option_id: `O-${P}-merge` }, { dt: 2500 });
      b.tool("ui_request_decision", { target: P, option_ids: [`O-${P}-register_retrieval`, `O-${P}-merge`, `O-${P}-keep`] }, { dt: 3000, intended: { option_id: `O-${P}-register_retrieval`, decision: "rejected", reason_code: "A1" } });
      b.say("decide", "drafting", T(`I put keeping the registrations under {{cite:milog-p16}} and {{cite:aentg_2009-p18}} to a decision, with its justification basis.`, `Ich lege die Beibehaltung der Anmeldungen nach {{cite:milog-p16}} und {{cite:aentg_2009-p18}} mit ihrer Begründungsgrundlage zur Entscheidung vor.`), { focus: P, dt: 4000 });
      b.tool("ui_request_decision", { target: P, option_ids: [`O-${P}-keep`] }, { dt: 2500, intended: { option_id: `O-${P}-keep`, decision: "approved", reason_code: "A1" } });
      return C;
    }
  },
  R3: {
    title: T("R3 Single norm", "R3 Einzelne Norm"),
    pace: 2,
    norms: () => ["enstatg_2017"],
    amendments: () => ({
      "O-D-enstatg_2017-p10-1-lower_frequency": [
        { wording: "Die Erhebungen nach {{cite:enstatg_2017-p10}} werden vierteljährlich statt monatlich durchgeführt; die Auskunftspflicht gilt entsprechend. [Entwurf, rechtlich zu prüfen]", gist_en: "The surveys run quarterly instead of monthly; the duty to report follows." }
      ],
      "O-D-enstatg_2017-p10-1-register_retrieval": [
        { wording: "In {{cite:enstatg_2017-p10}} Absatz 1 werden nach den Wörtern „Für die Erhebungen besteht Auskunftspflicht“ die Wörter „, soweit die Angaben nicht aus dem Register abgerufen werden“ eingefügt. [Entwurf, rechtlich zu prüfen]", gist_en: "The duty to report applies only where the data cannot be retrieved from the register." }
      ]
    }),
    script(b, data, w) {
      const D = "D-enstatg_2017-p10-1";
      b.plan(T("Plan: one norm end to end, the Energy Statistics Act.", "Plan: eine Norm von Anfang bis Ende, das Energiestatistikgesetz."));
      b.tool("law_list", { slice_id: data.sliceId });
      b.tool("law_fetch", { norm_id: "enstatg_2017" }, { dt: 1500 });
      inventory(b, data, w, this.norms(), { dtExtract: 1500, dtClassify: 3000 });
      b.tool("once_cluster", {}, { dt: 2500 });
      b.say("price", "cost", T(`I price the monthly report under {{cite:enstatg_2017-p10}}.`, `Ich bepreise die Monatsmeldung nach {{cite:enstatg_2017-p10}}.`), { focus: D, dt: 4000 });
      b.tool("cost_params", { duty_id: D }, { dt: 2000 });
      b.tool("cost_estimate", { target: D }, { dt: 2000 });
      b.tool("signal_match", { duty_ids: [D] }, { dt: 2000 });
      b.tool("draft_options", { target: D }, { dt: 3000 });
      b.say("propose", "drafting", T(`For {{cite:enstatg_2017-p10}} a lower frequency changes the cost by {{fact@draft_options|${D}|lower_frequency|net_delta}} a year.`, `Für {{cite:enstatg_2017-p10}} ändert ein seltenerer Turnus den Aufwand um {{fact@draft_options|${D}|lower_frequency|net_delta}} im Jahr.`), { focus: D, dt: 5000 });
      b.tool("draft_amendment", { option_id: `O-${D}-lower_frequency` }, { dt: 4000 });
      b.tool("audit_check", { option_id: `O-${D}-lower_frequency` }, { dt: 2500 });
      b.tool("draft_amendment", { option_id: `O-${D}-register_retrieval` }, { dt: 4000 });
      b.tool("audit_check", { option_id: `O-${D}-register_retrieval` }, { dt: 2500 });
      b.tool("ui_request_decision", { target: D, option_ids: [`O-${D}-lower_frequency`, `O-${D}-register_retrieval`, `O-${D}-keep`] }, { dt: 3000, intended: { option_id: `O-${D}-lower_frequency`, decision: "approved", reason_code: "Z4" } });
      return null;
    }
  }
};

/** Replaces {{fact@key}} with the id the dry replay gave that key. */
function resolveFacts(value, idOf) {
  if (typeof value === "string") return value.replace(/\{\{fact@([^{}]+)\}\}/g, (m, key) => { const id = idOf(key); if (!id) throw new Error(`No fact for key ${key}`); return `{{fact:${id}}}`; });
  if (Array.isArray(value)) return value.map((v) => resolveFacts(v, idOf));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveFacts(v, idOf)]));
  return value;
}
const stripFacts = (value) => JSON.parse(JSON.stringify(value).replace(/\{\{fact@[^{}]+\}\}/g, "…"));

async function dryReplay(run, data, lang = "en") {
  const state = createRunState({ data, lang, runId: run.meta.run_id, mode: "simulation" });
  const events = [];
  await replayRun({ run, data, state, lang, emit: (e) => events.push(e), awaitDecision: async (req) => state.decide({ option_id: req.intended.option_id, decision: req.intended.decision, reason_code: req.intended.reason_code, comment: "" }) });
  return { state, events };
}

async function author(runId) {
  const story = STORIES[runId];
  const normIds = story.norms(load([]));
  const data = load(normIds);
  const recordedCls = classifications(data, normIds);
  const w = await world(data, normIds, recordedCls);
  const b = builder(runId, story.pace || 1);
  const C = story.script(b, data, w);
  const run = {
    meta: { run_id: runId, title: story.title, source: "hand-authored", slice_id: data.sliceId, norm_ids: normIds, duration_ms: b.events.at(-1).t_ms, note: "Hand-authored with tools/author-runs.mjs (decision D7): no model was called. Replace with a recording once a key is available.", ...(story.edit_case ? { edit_case: story.edit_case } : {}) },
    facts: {},
    recorded: { classifications: recordedCls, amendments: story.amendments(C) },
    events: b.events
  };
  // Pass 1: ids by key, with the fact placeholders stripped from the texts.
  const first = await dryReplay(stripFacts(run), data);
  const keys = Object.entries(first.state.facts.keys()).filter(([, k]) => !k.startsWith("kpi|"));
  const idOf = (key) => keys.find(([, k]) => k === key)?.[0];
  run.facts = Object.fromEntries(keys);
  run.events = resolveFacts(run.events, idOf);
  run.meta.clusters = Object.fromEntries([...first.state.clusters.values()].map((c) => [c.id, c.paragraph_ids]));
  // Pass 2: the finished run replays without an unexpected tool error, and the checker passes.
  for (const lang of ["en", "de"]) {
    const second = await dryReplay(run, data, lang);
    const bad = second.events.filter((e) => e.type === "tool_result" && !e.payload.ok && !/^Fact audit failed/.test(e.payload.content || ""));
    if (bad.length) throw new Error(`${runId} ${lang}: ${bad.map((e) => `${e.payload.tool}: ${e.payload.content}`).join("; ")}`);
  }
  const problems = checkRun(run, { data });
  if (problems.length) throw new Error(`${runId}: ${problems.slice(0, 8).join("; ")}`);
  writeFileSync(path.join(ROOT, "data/runs", `${runId}.json`), `${JSON.stringify(run)}\n`);
  console.log(`${runId}: ${run.events.length} events, ${Object.keys(run.recorded.classifications).length} classifications, ${Object.keys(run.facts).length} facts, ${Math.round(run.meta.duration_ms / 1000)} s at ×1`);
}

for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STORIES)) await author(id);
