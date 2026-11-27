// Writes data/story.js and data/inventory.js: every figure and law text the showcase shows, computed by
// release 1.0.0's own engines. It replays 1.0.0's run R1 headless once for each decision a presenter can
// take (merge, register retrieval, keep), with the modules of a checkout of commit 7377619, and keeps what
// the five steps need (data/story.js). The whole inventory behind the counts (745 duties, the 125
// flagged sentences the agent discarded, 48 clusters) goes into data/inventory.js, which the page loads
// the first time a list opens. The page itself runs no engine; it plays these results.
//
// Usage: node tools/build-story.mjs [--legacy <folder>] [--check]
//   --legacy  a checkout of Duty Radar 1.0.0 (git worktree add ../dutyradar-1.0.0 7377619);
//             default: $DR_LEGACY, else ../dutyradar-1.0.0 next to this repository
//   --check   write nothing; exit 1 unless both files equal a fresh build
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const LEGACY_COMMIT = "7377619";
const VERSION = "2.2.0";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "story.js");
const OUT_INVENTORY = path.join(ROOT, "data", "inventory.js");

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
/** The shares of the assumed businesses that file both reports, for the sensitivity of the merge (D4). */
const SHARES = [1, 0.5, 0.25, 0.1];

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
const clusterList = [...S.clusters.values()].filter((c) => c.status !== "split");
const clustered = new Set(clusterList.flatMap((c) => c.duty_ids));
const clusterOf = new Map(clusterList.flatMap((c) => c.duty_ids.map((d) => [d, c.id])));
const byNorm = (list) => { const m = {}; for (const d of list) m[d.norm_id] = (m[d.norm_id] || 0) + 1; return m; };
const countBy = (list, key) => { const m = {}; for (const d of list) m[d[key]] = (m[d[key]] || 0) + 1; return m; };
const dutiesOf = byNorm(confirmed);
const clusteredOf = byNorm([...clustered].map((id) => S.duties.get(id)));
const candidatesOf = byNorm([...S.candidates.values()]);
const TYPES = ["MELDEPFLICHT", "INFORMATIONSPFLICHT", "NACHWEISPFLICHT", "DOKUMENTATIONSPFLICHT", "KONTROLLPFLICHT", "EVALUIERUNGSPFLICHT"];
const typesOf = (normId) => { const m = {}; for (const t of TYPES) { const n = confirmed.filter((d) => d.norm_id === normId && d.type === t).length; if (n) m[t] = n; } return m; };
// An act or an ordinance: every ordinance's title in the slice starts with "Verordnung"; the two acts that
// carry out EU regulations ("Gesetz zur Durchführung der Verordnung (EU) …") are acts.
const kindOf = (title) => (/^Verordnung\b/.test(title) ? "ordinance" : "act");

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
  kind: kindOf(n.title),
  family: familyOf[n.id],
  paragraphs: n.paragraphs,
  sentences: n.sentences,
  url: `https://www.gesetze-im-internet.de/${n.slug}/`,
  candidates: candidatesOf[n.id] || 0,
  duties: dutiesOf[n.id] || 0,
  clustered: clusteredOf[n.id] || 0,
  byType: typesOf(n.id),
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
/** The marked phrase of a duty, with offsets into its sentence (1.0.0 counts them from the paragraph). */
const phraseOf = (d) => {
  const sentence = data.sentences.get(d.evidence_span.sentence_id);
  const start = d.evidence_span.start - sentence.start;
  const end = d.evidence_span.end - sentence.start;
  if (sentence.text.slice(start, end) !== d.evidence_span.phrase) throw new Error(`The marked phrase of ${d.id} is not where its offsets say`);
  return { sentence: sentence.text, start, end, text: d.evidence_span.phrase };
};
const memberOf = (id) => {
  const d = S.duties.get(id);
  const p = data.paragraphs.get(d.paragraph_id);
  const ph = phraseOf(d);
  const params = S.paramsFor(id);
  return {
    duty: id,
    norm: d.norm_id,
    abbr: p.abbr,
    section: p.enbez,
    title: p.title,
    url: p.html_url,
    sentence: ph.sentence,
    phrase: { start: ph.start, end: ph.end, text: ph.text },
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

// ---- the cost inputs, their sources and the reasons for the assumed ones ---------------------------------------
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
// 1.0.0 prices both reports with the business defaults (data/params/cost-params.json): its reasons, in both
// languages, are what the derivation shows beside each value.
const defaults = data.costParams.defaults.wirtschaft.sources;
const why = (field) => { const s = defaults.find((x) => x.field === field); return { en: s.rationale_en || s.note_en, de: s.rationale || s.note }; };
// 1.0.0's default time per report: the guide's simple standard activities, added up.
const SIMPLE = ["einarbeitung_einfach", "daten_beschaffen_einfach", "formulare_einfach", "pruefung_einfach", "uebermittlung_einfach"];
const times = table("leitfaden-2026:zeitwerte-wirtschaft");
const minutesSource = { table: times.key, page: times.page, title: times.title, parts: Object.fromEntries(SIMPLE.map((k) => [k, times.values[k]])), value: SIMPLE.reduce((s, k) => s + times.values[k], 0) };
const oneOff = data.oneOff.find((o) => o.option_type === "register_retrieval");
const inputs = {
  businesses: { value: lead.population_units, kind: "assumed", en: pop.label_en, de: pop.label, reason: { en: pop.rationale_en, de: pop.rationale } },
  perYear: { value: lead.frequency_per_year, kind: "law", en: "monthly, § 4 HdlDlStatG", de: "monatlich, § 4 HdlDlStatG" },
  minutes: { value: lead.minutes_per_case, kind: "sourced", source: minutesSource, reason: why("minutes_per_case") },
  wage: { value: lead.wage_eur_per_hour, kind: "sourced", source: sourced("leitfaden-2026:lohnkosten-wirtschaft", "gesamtwirtschaft_durchschnitt"), reason: why("wage_eur_per_hour") },
  material: { value: lead.material_eur_per_case, kind: "assumed", reason: why("material_eur_per_case") },
  adminMinutes: { value: lead.admin_minutes_per_case, kind: "assumed", reason: why("admin_minutes_per_case") },
  adminWage: { value: lead.admin_wage_eur_per_hour, kind: "sourced", source: sourced("leitfaden-2026:lohnkosten-verwaltung", "bund_durchschnitt"), reason: why("admin_wage_eur_per_hour") },
  mergedMinutes: { value: merge.details.merged_minutes, kind: "engine" },
  oneOff: { value: oneOff.eur, kind: "assumed", reason: { en: oneOff.rationale_en, de: oneOff.rationale } }
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

// ---- how far the merge's relief rests on the assumed businesses (D4) --------------------------------------------
// Only businesses that file both reports gain from merging them. 1.0.0's assumption editor sets both members'
// population to a share of the assumed businesses, and its engines price the options again.
const sensitivity = [];
for (const share of SHARES) {
  const { state } = await replay("keep");
  const units = Math.round(lead.population_units * share);
  for (const id of cluster.duty_ids) state.editParam(id, "population_units", units);
  const m = state.options.get(DECISIONS.merge.option_id);
  if (m.status === "withdrawn") throw new Error(`The merge stops applying at ${share}`);
  sensitivity.push({ share, businesses: units, relief: -state.facts.get(m.facts.net_delta).value });
}
if (sensitivity[0].relief !== -factValue(merge, "net_delta")) throw new Error("The sensitivity at 100 % differs from the merge's relief");

// ---- the two laws side by side: quotes cut from the corpus, never retyped (DR-05) --------------------------------
// Each quote is the exact text of its section between two anchors; a space in an anchor matches any run of
// spaces, so the no-break spaces of the official layout stay in the quote.
const anchor = (s) => new RegExp(s.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\u00a0]+"));
const cut = (id, pid, from, to) => {
  const p = data.paragraphs.get(pid);
  const a = p.text.match(anchor(from));
  if (!a) throw new Error(`Quote ${id}: "${from}" is not in ${pid}`);
  const rest = p.text.slice(a.index);
  const b = rest.match(anchor(to));
  if (!b) throw new Error(`Quote ${id}: "${to}" does not follow in ${pid}`);
  return { id, paragraph: pid, section: p.enbez, abbr: p.abbr, url: p.html_url, text: rest.slice(0, b.index + b[0].length) };
};
const compare = {
  hdldlstatg: {
    who: [
      cut("a-units", "hdldlstatg-p3", "(1) Erhebungseinheiten sind", "Marktproduzenten handelt."),
      cut("a-scope", "hdldlstatg-p3", "(2) Die Erhebungen erstrecken sich", "Instandhaltung und Reparatur von Kraftfahrzeugen"),
      cut("a-sample", "hdldlstatg-p5", "(2) Die Erhebungen werden bei höchstens 45 Prozent", "Erhebungseinheiten durchgeführt.")
    ],
    what: [
      cut("a-items", "hdldlstatg-p6", "Erhebungsmerkmale für konjunkturstatistische Erhebungen sind:", "Klassifikation der Wirtschaftszweige."),
      cut("a-aux", "hdldlstatg-p10", "Hilfsmerkmale sind:", "Name und Anschrift der Erhebungseinheit")
    ],
    when: [cut("a-monthly", "hdldlstatg-p4", "(1) Die konjunkturstatistischen Erhebungen werden monatlich durchgeführt.", "Berichtszeitraum für die Erhebungen ist der Kalendermonat.")],
    whom: [cut("a-whom", "hdldlstatg-p15", "Die Angaben zu den konjunktur- und strukturstatistischen Erhebungen im Wirtschaftszweig 46", "erhoben und aufbereitet.")],
    duty: cut("a-duty", "hdldlstatg-p11", "(1) Für die Erhebungen besteht Auskunftspflicht.", "Leiter und Leiterinnen der Erhebungseinheiten.")
  },
  prodgewstatg: {
    who: [
      cut("b-scope", "prodgewstatg-p1", "Im Produzierenden Gewerbe, das", "als Bundesstatistik durchgeführt."),
      cut("b-sites", "prodgewstatg-p2", "Die Erhebungen werden durchgeführt bei den produzierenden Betrieben", "Beseitigung von Umweltverschmutzungen.")
    ],
    what: [
      cut("b-items", "prodgewstatg-p2", "A. bei Betrieben mit 50 und mehr tätigen Personen", "Lohnveredelungsarbeiten"),
      cut("b-aux", "prodgewstatg-p7", "(2) Hilfsmerkmale der Erhebungen sind:", "Name und Anschrift des Unternehmens und des Betriebs")
    ],
    when: [],
    whom: [],
    duty: cut("b-duty", "prodgewstatg-p9", "(1) Für die Erhebungen besteht Auskunftspflicht.", "in § 7 Abs. 2 Nr. 4 bezeichneten Einheiten.")
  }
};
for (const law of Object.keys(compare)) if (!members.some((m) => m.norm === law)) throw new Error(`${law} is not in ${CLUSTER}`);

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
  version: VERSION,
  generatedFrom: { release: "1.0.0", commit: LEGACY_COMMIT, run: "R1", note: run.meta.note },
  slice: {
    retrieved: data.retrievedDate,
    norms: norms.length,
    acts: norms.filter((n) => n.kind === "act").length,
    ordinances: norms.filter((n) => n.kind === "ordinance").length,
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
    clusters: clusterList.length,
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
  sensitivity,
  compare,
  check,
  outcomes,
  said: { plan: run.events[0].payload.text, cluster: said("cluster"), price: said("price"), propose: said("propose"), decide: said("decide") }
};

// ---- the inventory behind every count ---------------------------------------------------------------------------
// R1's classifier wrote a short reading of every flagged sentence in English and German; the lists show it
// beside the German sentence, as the agent's reading, never as a translation.
const readings = run.recorded.classifications;
const readingOf = (id) => { const r = readings[id]?.rationale; if (!r?.en || !r?.de) throw new Error(`R1 holds no reading for ${id}`); return { en: r.en, de: r.de }; };
const dutyRow = (d) => {
  const p = data.paragraphs.get(d.paragraph_id);
  const ph = phraseOf(d);
  return {
    id: d.id, law: d.norm_id, section: p.enbez, title: p.title || "", url: p.html_url, sentence: ph.sentence, phrase: [ph.start, ph.end],
    type: d.type, addressee: d.addressee, trigger: d.trigger, frequency: d.frequency_term, perYear: d.frequency_per_year, recipient: d.recipient,
    items: d.data_items, population: d.population_id, cluster: clusterOf.get(d.id) || null, confidence: d.classification?.confidence ?? null,
    reading: readingOf(d.id)
  };
};
const discardedRow = (d) => {
  const p = data.paragraphs.get(d.paragraph_id);
  const ph = phraseOf(d);
  return { id: d.id, law: d.norm_id, section: p.enbez, title: p.title || "", url: p.html_url, sentence: ph.sentence, phrase: [ph.start, ph.end], type: d.type, reading: readingOf(d.id) };
};
// Lists follow the law: the slice's order of laws, then the order of sections, then the sentences.
const lawOrder = new Map(norms.map((n, i) => [n.id, i]));
const sectionOrder = new Map([...data.paragraphs.keys()].map((pid, i) => [pid, i]));
const nth = (d) => Number(d.id.slice(d.id.lastIndexOf("-") + 1));
const inDocumentOrder = (a, b) => lawOrder.get(a.norm_id) - lawOrder.get(b.norm_id) || sectionOrder.get(a.paragraph_id) - sectionOrder.get(b.paragraph_id) || nth(a) - nth(b);
const discarded = [...S.duties.values()].filter((d) => d.status !== "confirmed");
const inventory = {
  version: VERSION,
  generatedFrom: { release: "1.0.0", commit: LEGACY_COMMIT, run: "R1", note: run.meta.note },
  vocab: Object.fromEntries(data.vocab.items.map((v) => [v.id, { en: v.label_en, de: v.label, core: Boolean(v.core) }])),
  populations: Object.fromEntries(data.populations.map((p) => [p.id, { en: p.label_en, de: p.label, units: p.units, assumed: Boolean(p.assumption), reason: { en: p.rationale_en, de: p.rationale } }])),
  laws: norms.map((n) => ({ id: n.id, abbr: n.abbr, title: n.title.replace(/\s+/g, " "), kind: n.kind, url: n.url, paragraphs: n.paragraphs, sentences: n.sentences, flagged: n.candidates, duties: n.duties, discarded: n.candidates - n.duties, clustered: n.clustered, byType: n.byType })),
  duties: [...confirmed].sort(inDocumentOrder).map(dutyRow),
  discarded: discarded.sort(inDocumentOrder).map(discardedRow),
  clusters: clusterList.map((c) => ({
    id: c.id, duties: c.duty_ids, shared: c.shared_items, confidence: c.confidence, overlap: c.overlap, population: c.population_id,
    laws: [...new Set(c.duty_ids.map((id) => S.duties.get(id).norm_id))].sort((a, b) => lawOrder.get(a) - lawOrder.get(b)),
    priced: c.id === CLUSTER
  })).sort((a, b) => (b.priced - a.priced) || b.duties.length - a.duties.length || a.id.localeCompare(b.id))
};
// The inventory must add up to the figures the story shows.
if (inventory.duties.length !== story.totals.duties || inventory.discarded.length !== story.totals.rejected) throw new Error("The inventory's duties differ from the story's totals");
if (inventory.clusters.length !== story.totals.clusters || inventory.clusters.reduce((s, c) => s + c.duties.length, 0) !== story.totals.clustered) throw new Error("The inventory's clusters differ from the story's totals");

const header = (what) => `// Generated by tools/build-story.mjs from Duty Radar ${story.generatedFrom.release} (commit ${LEGACY_COMMIT}), run R1:
// ${what} Don't edit by hand; run
//   node tools/build-story.mjs --legacy <checkout of ${LEGACY_COMMIT}>
`;
const text = `${header("the figures and law texts the showcase shows, computed by 1.0.0's engines.")}// tests/figures.mjs checks every figure in it against the cost method and the counts against each other.
window.DUTY_RADAR = ${JSON.stringify(story, null, 1)};
`;
// One duty per line keeps the file readable and its diffs small.
const rows = (list) => `[\n${list.map((x) => JSON.stringify(x)).join(",\n")}\n]`;
const inventoryText = `${header("every duty, discarded sentence and cluster behind the showcase's counts, as 1.0.0's engines left them.")}// The page loads it when a list first opens; tests/inventory.mjs checks it against data/story.js.
window.DUTY_RADAR_INVENTORY = {
"version": ${JSON.stringify(inventory.version)},
"generatedFrom": ${JSON.stringify(inventory.generatedFrom)},
"vocab": ${JSON.stringify(inventory.vocab)},
"populations": ${JSON.stringify(inventory.populations)},
"laws": ${rows(inventory.laws)},
"duties": ${rows(inventory.duties)},
"discarded": ${rows(inventory.discarded)},
"clusters": ${rows(inventory.clusters)}
};
`;

if (flag("--check")) {
  const now = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  const nowInventory = existsSync(OUT_INVENTORY) ? readFileSync(OUT_INVENTORY, "utf8") : "";
  let bad = 0;
  if (now !== text) { console.log("data/story.js differs from a fresh build from 1.0.0's engines. Run node tools/build-story.mjs to rewrite it."); bad++; }
  if (nowInventory !== inventoryText) { console.log("data/inventory.js differs from a fresh build from 1.0.0's engines. Run node tools/build-story.mjs to rewrite it."); bad++; }
  if (bad) process.exit(1);
  console.log(`data/story.js and data/inventory.js equal a fresh build from 1.0.0's engines (${LEGACY}).\nSTORY DATA MATCHES 1.0.0\nINVENTORY MATCHES 1.0.0`);
} else {
  writeFileSync(OUT, text);
  writeFileSync(OUT_INVENTORY, inventoryText);
  console.log(`Wrote data/story.js (${(text.length / 1024).toFixed(1)} KB) and data/inventory.js (${(inventoryText.length / 1024).toFixed(1)} KB) from ${LEGACY}: ${story.totals.duties} duties in ${story.slice.norms} laws, ${story.totals.clusters} clusters, ${options.length} options for ${CLUSTER}.`);
}
