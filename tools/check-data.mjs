// Checks the bundled data files (AC-09).
// Usage: node tools/check-data.mjs            the data files: every cost parameter has a source or an
//                                             assumption flag with its rationale in both languages,
//                                             every complaint is synthetic, every register "simuliert",
//                                             the slice has 25 to 35 norms, and every duty id the files
//                                             name is a duty candidate of the snapshot
//        node tools/check-data.mjs corpus     the law snapshot: every Norm file satisfies the contract,
//                                             index.json and SNAPSHOT.md match the files
//        node tools/check-data.mjs sources    every source key resolves (population, norm sentence,
//                                             guide table), every table is used, and DATA_SOURCES.md
//                                             names each document's address and digest, each table's
//                                             annex and page, and each file that holds assumptions
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normProblems } from "./lib/norm-contract.mjs";
import { compilePatterns, extractCandidates } from "../js/engine/patterns.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));
const mode = process.argv[2] || "data";
const problems = [];
const fail = (msg) => problems.push(msg);
const NUMERIC = ["population_units", "frequency_per_year", "cases_per_year", "minutes_per_case", "wage_eur_per_hour", "material_eur_per_case", "admin_minutes_per_case", "admin_wage_eur_per_hour", "events_per_unit_per_year"];
const ADDRESSEES = ["buerger", "wirtschaft", "verwaltung"];

/** Every numeric field with a value, and admin_level, has exactly one sources entry. */
function checkSources(where, p) {
  const fields = [...NUMERIC.filter((f) => p[f] !== null && p[f] !== undefined), ...(p.admin_level ? ["admin_level"] : [])];
  const entries = p.sources || [];
  for (const f of fields) {
    const e = entries.filter((s) => s.field === f);
    if (e.length !== 1) { fail(`${where}: ${f} has ${e.length} sources entries`); continue; }
    const s = e[0];
    if (s.assumption === true) {
      if (!s.rationale?.trim() || !s.rationale_en?.trim()) fail(`${where}: the assumption for ${f} needs a rationale in both languages`);
    } else if (!/^(norm|population|ondea|dip|leitfaden-2026):\S+$/.test(s.source || "")) fail(`${where}: ${f} has neither a source key nor an assumption flag`);
  }
  for (const s of entries) if (!fields.includes(s.field)) fail(`${where}: sources entry for ${s.field}, which has no value`);
}

const assumptionOk = (where, o) => {
  if (o.assumption === true) { if (!o.rationale?.trim() || !o.rationale_en?.trim()) fail(`${where}: an assumption needs a rationale in both languages`); }
  else if (!o.source) fail(`${where}: neither a source nor an assumption flag`);
};

function checkData() {
  const slice = json("config/slice.json");
  if (!(slice.norms.length >= 25 && slice.norms.length <= 35)) fail(`config/slice.json: ${slice.norms.length} norms, not 25 to 35`);
  const index = json("data/corpus/index.json");
  if (index.norms.map((n) => n.slug).join() !== slice.norms.map((n) => n.slug).join()) fail("data/corpus/index.json does not hold the slice's norms in order");

  const params = json("data/params/cost-params.json");
  for (const a of ADDRESSEES) {
    const d = params.defaults?.[a];
    if (!d) { fail(`cost-params: no defaults for ${a}`); continue; }
    checkSources(`cost-params defaults.${a}`, d);
  }
  const pops = json("data/params/populations.json");
  const popIds = new Set(pops.map((p) => p.id));
  for (const p of pops) {
    if (!/^pop-[a-z0-9-]+$/.test(p.id)) fail(`populations: id ${p.id}`);
    if (!ADDRESSEES.includes(p.addressee) || !(p.units > 0) || !p.label || !p.label_en) fail(`populations: ${p.id} incomplete`);
    assumptionOk(`populations ${p.id}`, p);
  }
  for (const d of params.duties || []) {
    checkSources(`cost-params ${d.duty_id}`, d);
    if (!ADDRESSEES.includes(d.addressee)) fail(`cost-params ${d.duty_id}: addressee`);
    if (!["periodisch", "anlassbezogen", "einmalig"].includes(d.trigger)) fail(`cost-params ${d.duty_id}: trigger`);
    if (d.population_id && !popIds.has(d.population_id)) fail(`cost-params ${d.duty_id}: unknown population ${d.population_id}`);
    if (d.trigger === "periodisch" && d.cases_per_year !== null) fail(`cost-params ${d.duty_id}: a periodic duty has no cases_per_year`);
  }
  for (const o of json("data/params/one-off.json")) {
    if (!["delete", "merge", "register_retrieval", "lower_frequency", "keep"].includes(o.option_type) || !(o.eur >= 0)) fail(`one-off: ${o.option_type}`);
    assumptionOk(`one-off ${o.option_type}`, o);
  }
  const vocab = json("data/vocab/data-items.json");
  const itemIds = new Set(vocab.items.map((i) => i.id));
  if (vocab.items.length < 20) fail(`vocabulary: ${vocab.items.length} items, fewer than 20`);
  for (const i of vocab.items) if (!i.label || !i.label_en || !Array.isArray(i.synonyms) || typeof i.core !== "boolean") fail(`vocabulary: ${i.id} incomplete`);
  for (const r of json("data/registers.json")) {
    if (r.availability !== "simuliert") fail(`registers: ${r.id} is not "simuliert"`);
    if (!r.label_en || !r.items.length || r.items.some((i) => !itemIds.has(i))) fail(`registers: ${r.id} incomplete or with an unknown item`);
  }
  for (const c of json("data/consumers.json")) {
    if (c.synthetic !== true) fail(`consumers: ${c.duty_id} is not marked synthetic`);
    if (!c.user_en || !c.purpose_en) fail(`consumers: ${c.duty_id} needs user_en and purpose_en`);
  }
  const complaints = json("data/signals/complaints.json");
  const CATEGORIES = ["Verwaltung digital", "Anträge", "Servicequalität", "Gesundheit & Soziales", "Einmal genügt", "Betriebe", "Steuern", "Weniger Bürokratie"];
  if (complaints.length < 30 || complaints.length > 50) fail(`complaints: ${complaints.length}, not 30 to 50`);
  for (const k of complaints) {
    if (k.synthetic !== true) fail(`complaints: ${k.id} is not marked synthetic`);
    if (!/^K-\d{3}$/.test(k.id) || !CATEGORIES.includes(k.category) || !k.text || !k.text_en || !Array.isArray(k.matched_duty_ids)) fail(`complaints: ${k.id} incomplete`);
  }
  // Every duty id the files name is a candidate of the pattern stage on the bundled snapshot.
  const compiled = compilePatterns(json("data/patterns/duty-patterns.json"));
  const candidates = new Set();
  for (const n of index.norms) for (const c of extractCandidates(json(`data/corpus/${n.slug}.json`), compiled)) candidates.add(c.candidate_id);
  const named = [...(params.duties || []).map((d) => d.duty_id), ...json("data/consumers.json").map((c) => c.duty_id), ...complaints.flatMap((k) => k.matched_duty_ids)];
  for (const id of named) if (!candidates.has(id)) fail(`${id} is named in the data files but is no duty candidate of the snapshot`);
  return `DATA OK (${slice.norms.length} norms, ${(params.duties || []).length} duty parameter sets, ${pops.length} populations, ${vocab.items.length} vocabulary items, ${complaints.length} synthetic complaints, ${candidates.size} duty candidates)`;
}

function checkCorpus() {
  const index = json("data/corpus/index.json");
  const files = readdirSync(path.join(ROOT, "data/corpus")).filter((f) => f.endsWith(".json") && f !== "index.json").map((f) => f.replace(/\.json$/, "")).sort();
  if (files.join() !== index.norms.map((n) => n.slug).sort().join()) fail("data/corpus/: the files differ from index.json");
  let paragraphs = 0;
  let sentences = 0;
  for (const n of index.norms) {
    const norm = json(`data/corpus/${n.slug}.json`);
    for (const p of normProblems(norm, { slug: n.slug })) fail(`${n.slug}.json: ${p}`);
    const ps = norm.paragraphs.length;
    const ss = norm.paragraphs.reduce((k, p) => k + p.sentences.length, 0);
    if (ps !== n.paragraphs || ss !== n.sentences) fail(`index.json: ${n.slug} counts ${n.paragraphs}/${n.sentences}, the file has ${ps}/${ss}`);
    if (JSON.stringify(norm.eu_basis) !== JSON.stringify(n.eu_basis) || norm.builddate !== n.builddate) fail(`index.json: ${n.slug} EU basis or build date differs from the file`);
    if (norm.retrieved_at !== index.retrieved_at) fail(`${n.slug}.json: retrieved_at differs from index.json`);
    paragraphs += ps;
    sentences += ss;
  }
  const md = existsSync(path.join(ROOT, "SNAPSHOT.md")) ? readFileSync(path.join(ROOT, "SNAPSHOT.md"), "utf8") : "";
  if (!md.includes(`${index.norms.length} norms, ${paragraphs} paragraphs, ${sentences} sentences`)) fail("SNAPSHOT.md does not state the corpus's counts");
  if (!md.includes(index.retrieved_at) || !md.includes(index.toc_sha256)) fail("SNAPSHOT.md does not name the retrieval time and the table of contents' digest");
  for (const n of index.norms) if (!md.includes(`| \`${n.slug}\` | ${n.abbr} |`)) fail(`SNAPSHOT.md has no row for ${n.slug}`);
  return `CORPUS OK (${index.norms.length} norms, ${paragraphs} paragraphs, ${sentences} sentences)`;
}

function checkSourceKeys() {
  const pops = new Set(json("data/params/populations.json").map((p) => p.id));
  const register = json("data/params/sources.json");
  const tables = new Set(register.tables.map((t) => t.key));
  const used = new Set();
  const params = json("data/params/cost-params.json");
  const sentenceExists = (sid) => {
    const slug = sid.replace(/-(?:p|art)[0-9a-z]+-s\d+$/, "");
    const file = path.join(ROOT, "data/corpus", `${slug}.json`);
    if (!existsSync(file)) return false;
    return JSON.parse(readFileSync(file, "utf8")).paragraphs.some((p) => p.sentences.some((s) => s.id === sid));
  };
  let n = 0;
  const all = [...Object.entries(params.defaults).map(([k, d]) => [`defaults.${k}`, d]), ...params.duties.map((d) => [d.duty_id, d])];
  for (const [where, p] of all) {
    for (const s of p.sources || []) {
      if (!s.source) continue;
      n += 1;
      const [kind, ...rest] = s.source.split(":");
      const id = rest.join(":");
      if (kind === "population" && !pops.has(id)) fail(`${where}: ${s.source} names no population`);
      else if (kind === "population" && p.population_id && p.population_id !== id) fail(`${where}: ${s.source} is not the duty's population ${p.population_id}`);
      else if (kind === "norm" && !sentenceExists(id)) fail(`${where}: ${s.source} names no sentence of the snapshot`);
      else if (kind === "leitfaden-2026" && !tables.has(s.source)) fail(`${where}: ${s.source} is not a table in data/params/sources.json`);
      if (tables.has(s.source)) used.add(s.source);
      else if (["ondea", "dip"].includes(kind)) fail(`${where}: ${s.source} — no calibration source is bundled yet`);
    }
  }
  for (const t of tables) if (!used.has(t)) fail(`data/params/sources.json: table ${t} is used by no cost parameter`);

  // DATA_SOURCES.md records each document, each table and each file of assumptions.
  const md = readFileSync(path.join(ROOT, "DATA_SOURCES.md"), "utf8");
  for (const d of register.documents) {
    if (!md.includes(d.sha256)) fail(`DATA_SOURCES.md does not record the digest of ${d.id}`);
    if (!md.includes(d.url)) fail(`DATA_SOURCES.md does not record the address of ${d.id}`);
  }
  for (const t of register.tables) {
    const annex = t.title.match(/^Anhang \d+/)?.[0];
    if (!annex || !md.includes(`${annex}, p. ${t.page}`)) fail(`DATA_SOURCES.md does not name ${t.key} as ${annex || "an annex"}, p. ${t.page}`);
  }
  const assumptionFiles = ["data/params/populations.json", "data/params/cost-params.json", "data/params/one-off.json"]
    .filter((f) => /"Annahme|"assumption"\s*:\s*true/.test(readFileSync(path.join(ROOT, f), "utf8")));
  for (const f of assumptionFiles) if (!md.includes(`| \`${f}\` |`)) fail(`DATA_SOURCES.md does not list ${f}, which holds assumptions`);
  return `SOURCES OK (${n} source keys resolved; DATA_SOURCES.md records ${register.documents.length} document${register.documents.length === 1 ? "" : "s"}, ${register.tables.length} tables and ${assumptionFiles.length} files of assumptions)`;
}

const result = mode === "corpus" ? checkCorpus() : mode === "sources" ? checkSourceKeys() : checkData();
for (const p of problems) console.log(`FAIL ${p}`);
if (problems.length) { console.log(`${problems.length} problem${problems.length === 1 ? "" : "s"}.`); process.exit(1); }
console.log(result);
