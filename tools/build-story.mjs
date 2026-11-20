// Writes data/story.js: every figure and law text the showcase shows, computed by release 1.0.0's own
// engines. It replays 1.0.0's run R1 headless three times, once for each decision a presenter can take
// (merge, register retrieval, keep), with the modules of a checkout of commit 7377619, and keeps what
// the five steps need. The page itself runs no engine; it plays these results.
//
// Usage: node tools/build-story.mjs [--legacy <folder>] [--check]
//   --legacy  a checkout of Duty Radar 1.0.0 (git worktree add ../dutyradar-1.0.0 7377619);
//             default: $DR_LEGACY, else ../dutyradar-1.0.0 next to this repository
//   --check   write nothing; exit 1 unless data/story.js equals a fresh build
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const LEGACY_COMMIT = "7377619";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "story.js");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const LEGACY = path.resolve(option("--legacy") || process.env.DR_LEGACY || path.join(ROOT, "..", "dutyradar-1.0.0"));
if (!existsSync(path.join(LEGACY, "js", "state.js")) || !existsSync(path.join(LEGACY, "data", "runs", "R1.json"))) {
  console.error(`No Duty Radar 1.0.0 checkout at ${LEGACY}.\nCreate one with: git worktree add ../dutyradar-1.0.0 ${LEGACY_COMMIT}`);
  process.exit(2);
}

// 1.0.0's modules read these browser globals when they load.
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
globalThis.sessionStorage = memory();
globalThis.localStorage = memory();
globalThis.location = { search: "" };
const load = (p) => import(pathToFileURL(path.join(LEGACY, p)).href);
const { loadI18n } = await load("js/i18n.js");
const { createRunState } = await load("js/state.js");
const { replayRun } = await load("js/simulation.js");
const { auditText } = await load("js/engine/auditor.js");
const { loadBundled } = await load("tests/lib/data-node.mjs");
await loadI18n(async (p) => new Response(readFileSync(path.join(LEGACY, p))));
const json = (...p) => JSON.parse(readFileSync(path.join(LEGACY, ...p), "utf8"));
const strings = { en: json("js/i18n/en.json"), de: json("js/i18n/de.json") };
const both = (key) => ({ en: key.split(".").reduce((o, k) => o?.[k], strings.en), de: key.split(".").reduce((o, k) => o?.[k], strings.de) });

const run = json("data/runs/R1.json");
const data = loadBundled(run.meta.norm_ids);
const sources = json("data/params/sources.json");

/** The decisions a presenter can take on the cluster, each with the reason code the showcase records. */
const DECISIONS = {
  merge: { option_id: "O-C-046-merge", decision: "approved", reason_code: "Z1" },
  register_retrieval: { option_id: "O-C-046-register_retrieval", decision: "approved", reason_code: "Z2" },
  keep: { option_id: "O-C-046-keep", decision: "approved", reason_code: "A3" }
};
const CLUSTER = "C-046";

async function replay(choice) {
  const state = createRunState({ data, lang: "en", runId: "R1", mode: "simulation", now: () => new Date("2026-11-20T09:00:00Z") });
  let request = null;
  let before = null;
  await replayRun({
    run, data, state, lang: "en",
    awaitDecision: async (req) => {
      request = req;
      before = JSON.parse(JSON.stringify(state.kpis()));
      return state.decide(DECISIONS[choice]);
    }
  });
  if (!request || request.target !== CLUSTER) throw new Error(`R1 did not ask for a decision on ${CLUSTER}`);
  return { state, before, after: state.kpis() };
}

const runs = {};
for (const choice of Object.keys(DECISIONS)) runs[choice] = await replay(choice);
const S = runs.merge.state;

// ---- the slice and the reading -------------------------------------------------------------------
const confirmed = S.confirmedDuties();
const clustered = new Set([...S.clusters.values()].flatMap((c) => c.duty_ids));
const byNorm = (list) => { const m = {}; for (const d of list) m[d.norm_id] = (m[d.norm_id] || 0) + 1; return m; };
const countBy = (list, key) => { const m = {}; for (const d of list) m[d[key]] = (m[d[key]] || 0) + 1; return m; };
const dutiesOf = byNorm(confirmed);
const clusteredOf = byNorm([...clustered].map((id) => S.duties.get(id)));
const candidatesOf = byNorm([...S.candidates.values()]);

// When the agent finished reading each norm in the replay: the time of the next norm's extraction, or of
// the step that follows the inventory.
const events = run.events;
const extractAt = events.filter((e) => e.payload?.tool === "duty_extract").map((e) => ({ norm: e.payload.input.norm_id, t: e.t_ms }));
const inventoryEnd = events.find((e) => e.payload?.tool === "ui_progress" && e.payload.input.step === "cluster").t_ms;
const readAt = Object.fromEntries(extractAt.map((x, i) => [x.norm, (extractAt[i + 1]?.t ?? inventoryEnd)]));

const familyOf = Object.fromEntries(data.slice.norms.map((n) => [n.slug, n.family]));
const norms = data.index.norms.map((n) => ({
  id: n.id,
  abbr: n.abbr,
  title: n.title,
  family: familyOf[n.id],
  paragraphs: n.paragraphs,
  sentences: n.sentences,
  url: `https://www.gesetze-im-internet.de/${n.slug}/`,
  candidates: candidatesOf[n.id] || 0,
  duties: dutiesOf[n.id] || 0,
  clustered: clusteredOf[n.id] || 0,
  readFrom: extractAt.find((x) => x.norm === n.id).t,
  readAt: readAt[n.id]
}));
const families = Object.entries(data.slice.families).map(([id, label]) => ({ id, en: label.en, de: label.de, norms: norms.filter((n) => n.family === id).map((n) => n.id) }));

// ---- the cluster the run decides ---------------------------------------------------------------------------
const cluster = S.clusters.get(CLUSTER);
const vocab = (id) => { const v = data.vocabById.get(id); return { id, en: v.label_en, de: v.label }; };
const cite = (pid) => { const p = data.paragraphs.get(pid); return `${p.enbez} ${p.abbr}`; };
const resolve = (text) => String(text).replace(/\{\{cite:([^}]+)\}\}/g, (_, pid) => cite(pid));
const RECIPIENT_EN = { "statistische Ämter der Länder": "the statistical offices of the Länder" };
const memberOf = (id) => {
  const d = S.duties.get(id);
  const p = data.paragraphs.get(d.paragraph_id);
  const sentence = data.sentences.get(d.evidence_span.sentence_id);
  const params = S.paramsFor(id);
  return {
    duty: id,
    norm: d.norm_id,
    abbr: p.abbr,
    section: p.enbez,
    title: p.title,
    url: p.html_url,
    sentence: sentence.text,
    phrase: { start: d.evidence_span.start, end: d.evidence_span.end, text: d.evidence_span.phrase },
    type: d.type,
    typeLabel: both(`duty_type.${d.type}`),
    addressee: both(`addressee.${d.addressee}`),
    frequency: both(`frequency.${d.frequency_term}`),
    perYear: d.frequency_per_year,
    recipient: { de: d.recipient, en: RECIPIENT_EN[d.recipient] || d.recipient },
    items: d.data_items.map(vocab),
    cases: params.population_units * params.frequency_per_year,
    cost: S.facts.get(S.estimate(id).ea_annual_eur).value
  };
};
const members = cluster.duty_ids.map(memberOf);
const est = S.estimates.get(CLUSTER);
const pop = data.populationsById.get(cluster.population_id);
const reg = data.registersById.get(cluster.register_candidate.register_id);

// ---- the cost inputs and their sources -----------------------------------------------------------------------
const lead = S.paramsFor(cluster.duty_ids[0]);
for (const id of cluster.duty_ids) {
  const p = S.paramsFor(id);
  for (const f of ["population_units", "frequency_per_year", "minutes_per_case", "wage_eur_per_hour", "material_eur_per_case", "admin_minutes_per_case", "admin_wage_eur_per_hour"]) {
    if (p[f] !== lead[f]) throw new Error(`The members of ${CLUSTER} differ in ${f}; the showcase explains one set of inputs`);
  }
}
const table = (key) => sources.tables.find((t) => t.key === key);
const sourced = (key, valueKey) => ({ table: key, page: table(key).page, title: table(key).title, value: table(key).values[valueKey] });
const doc = sources.documents[0];
const merge = S.options.get(DECISIONS.merge.option_id);
// 1.0.0's default time per report: the guide's simple standard activities, added up.
const SIMPLE = ["einarbeitung_einfach", "daten_beschaffen_einfach", "formulare_einfach", "pruefung_einfach", "uebermittlung_einfach"];
const times = table("leitfaden-2026:zeitwerte-wirtschaft");
const minutesSource = { table: times.key, page: times.page, title: times.title, parts: Object.fromEntries(SIMPLE.map((k) => [k, times.values[k]])), value: SIMPLE.reduce((s, k) => s + times.values[k], 0) };
const inputs = {
  businesses: { value: lead.population_units, kind: "assumed", en: pop.label_en, de: pop.label },
  perYear: { value: lead.frequency_per_year, kind: "law", en: "monthly, § 4 HdlDlStatG", de: "monatlich, § 4 HdlDlStatG" },
  minutes: { value: lead.minutes_per_case, kind: "sourced", source: minutesSource },
  wage: { value: lead.wage_eur_per_hour, kind: "sourced", source: sourced("leitfaden-2026:lohnkosten-wirtschaft", "gesamtwirtschaft_durchschnitt") },
  material: { value: lead.material_eur_per_case, kind: "assumed" },
  adminMinutes: { value: lead.admin_minutes_per_case, kind: "assumed" },
  adminWage: { value: lead.admin_wage_eur_per_hour, kind: "sourced", source: sourced("leitfaden-2026:lohnkosten-verwaltung", "bund_durchschnitt") },
  mergedMinutes: { value: merge.details.merged_minutes, kind: "engine" },
  oneOff: { value: data.oneOff.find((o) => o.option_type === "register_retrieval").eur, kind: "assumed" }
};
if (inputs.wage.source.value !== inputs.wage.value || inputs.adminWage.source.value !== inputs.adminWage.value || inputs.minutes.source.value !== inputs.minutes.value) throw new Error("An input differs from the guide's table it cites");
const guide = { title: doc.title, publisher: doc.publisher, edition: doc.edition, url: doc.url };

// ---- the options, the fact check and the drafts ---------------------------------------------------------------
const factValue = (o, measure) => (o.facts[measure] ? S.facts.get(o.facts[measure]).value : 0);
const optionOf = (type) => {
  const o = S.options.get(`O-${CLUSTER}-${type}`);
  return {
    id: o.id,
    type,
    label: both(`option_type.${type}`),
    net: factValue(o, "net_delta"),
    businesses: factValue(o, "wirtschaft_delta"),
    administration: factValue(o, "verwaltung_delta"),
    duties: factValue(o, "duty_count_delta"),
    oneOff: factValue(o, "one_off"),
    removes: o.removed_duty_ids,
    reason: { code: DECISIONS[type].reason_code, ...both(`code.${DECISIONS[type].reason_code}`) },
    wording: o.draft?.wording ? resolve(o.draft.wording) : null,
    gist: o.draft?.gist_en || null,
    risk: (o.risks || []).map((r) => both(`risk.${r}`))
  };
};
const options = S.targets.get(CLUSTER).option_ids.map((id) => optionOf(S.options.get(id).type));
const drafts = run.recorded.amendments[DECISIONS.merge.option_id];
const blocked = drafts.find((d) => d.expect_audit === "fail");
const verdict = auditText(blocked.wording, { ...S.auditContext(), lang: "de" });
if (verdict.pass) throw new Error("1.0.0's fact auditor no longer blocks the first draft");
const check = { blocked: resolve(blocked.wording), tokens: verdict.violations.map((v) => v.token), redraft: resolve(drafts.find((d) => d !== blocked).wording) };
if (auditText(drafts.find((d) => d !== blocked).wording, { ...S.auditContext(), lang: "de" }).pass !== true) throw new Error("1.0.0's fact auditor blocks the redraft");

// ---- the figures each decision leaves ------------------------------------------------------------------------
const coverage = (k) => ({
  reporting: { removed: k.coverage.reporting.removed, total: k.coverage.reporting.total },
  documentation: { removed: k.coverage.documentation.removed, total: k.coverage.documentation.total }
});
const outcomes = Object.fromEntries(Object.entries(runs).map(([choice, r]) => {
  const item = r.state.dossier.items[0] || null;
  const kept = r.state.dossier.kept;
  return [choice, {
    option: DECISIONS[choice].option_id,
    relief: -r.after.ea_addressed_eur,
    ...coverage(r.after),
    dossier: item ? { option: item.option_id, reason: item.reason_code, sections: item.paragraph_ids.map(cite) } : null,
    kept: kept.map((k) => ({ duty: k.duty_id, reason: k.reason_code }))
  }];
}));
const pending = -runs.merge.before.ea_pending_eur;

// ---- the agent's sentences in the replay ------------------------------------------------------------------------
const said = (step) => events.filter((e) => e.payload?.tool === "ui_progress" && e.payload.input.step === step).map((e) => ({ en: resolve(e.payload.input.message.en), de: resolve(e.payload.input.message.de) }));

const k = runs.merge.before;
const story = {
  version: "2.0.0",
  generatedFrom: { release: "1.0.0", commit: LEGACY_COMMIT, run: "R1", note: run.meta.note },
  slice: {
    retrieved: data.retrievedDate,
    norms: norms.length,
    paragraphs: norms.reduce((s, n) => s + n.paragraphs, 0),
    sentences: norms.reduce((s, n) => s + n.sentences, 0),
    source: "gesetze-im-internet.de"
  },
  families,
  norms,
  replay: { start: events[0].t_ms ?? 0, readFrom: extractAt[0].t, readTo: inventoryEnd, decisionAt: run.meta.duration_ms },
  totals: {
    candidates: S.candidates.size,
    duties: confirmed.length,
    rejected: S.candidates.size - confirmed.length,
    byType: countBy(confirmed, "type"),
    byAddressee: countBy(confirmed, "addressee"),
    clusters: [...S.clusters.values()].filter((c) => c.status !== "split").length,
    clustered: clustered.size
  },
  kpiBefore: { duties: k.duties_confirmed, ...coverage(k), relief: -k.ea_addressed_eur, pending },
  cluster: {
    id: CLUSTER,
    confidence: cluster.confidence,
    shared: cluster.shared_items.map(vocab),
    members,
    population: { en: pop.label_en, de: pop.label, units: pop.units, assumed: Boolean(pop.assumption) },
    register: { id: reg.id, en: reg.label_en, de: reg.label, availability: reg.availability, covers: cluster.register_candidate.covers_duty_ids },
    cases: S.facts.get(est.fallzahl).value,
    cost: S.facts.get(est.ea_annual_eur).value
  },
  inputs,
  guide,
  options,
  check,
  outcomes,
  said: { plan: run.events[0].payload.text, cluster: said("cluster"), price: said("price"), propose: said("propose"), decide: said("decide") }
};

const text = `// Generated by tools/build-story.mjs from Duty Radar ${story.generatedFrom.release} (commit ${LEGACY_COMMIT}), run R1:
// the figures and law texts the showcase shows, computed by 1.0.0's engines. Don't edit by hand; run
//   node tools/build-story.mjs --legacy <checkout of ${LEGACY_COMMIT}>
// tests/figures.mjs checks every figure in it against the cost method and the counts against each other.
window.DUTY_RADAR = ${JSON.stringify(story, null, 1)};
`;

if (flag("--check")) {
  const now = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (now !== text) { console.log("data/story.js differs from a fresh build from 1.0.0's engines. Run node tools/build-story.mjs to rewrite it."); process.exit(1); }
  console.log(`data/story.js equals a fresh build from 1.0.0's engines (${LEGACY}).\nSTORY DATA MATCHES 1.0.0`);
} else {
  writeFileSync(OUT, text);
  console.log(`Wrote data/story.js (${(text.length / 1024).toFixed(1)} KB) from ${LEGACY}: ${story.totals.duties} duties in ${story.slice.norms} laws, ${story.totals.clusters} clusters, ${options.length} options for ${CLUSTER}.`);
}
