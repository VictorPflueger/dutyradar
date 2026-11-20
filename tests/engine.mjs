// Engine suite: the specification's golden cases (AC-01, AC-05), fact-auditor cases (AC-02),
// cluster cases (AC-03), option cases (AC-04), sentence splitting and patterns (AC-07), and the
// gold set (AC-06). Pure Node, no browser.
// Usage: node tests/engine.mjs                       every section
//        node tests/engine.mjs golden audit ...     only the named sections:
//        golden, audit, cluster, options, coverage, patterns, recall, gold, mappings, facts
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitSentences } from "../js/engine/sentences.js";
import { formatEur, formatHours, formatShare, plain, parseLocalNumber } from "../js/engine/format.js";
import { dutyCost, deleteDelta, lowerFrequencyDelta, registerDelta, mergeDelta, sliceCoverage, removedByType } from "../js/engine/cost.js";
import { auditText } from "../js/engine/auditor.js";
import { clusterDuties, splitCluster, bestRegister } from "../js/engine/cluster.js";
import { draftOptions } from "../js/engine/options.js";
import { compilePatterns, matchSentence, extractCandidates } from "../js/engine/patterns.js";
import { mapClassification, FREQUENCY_PER_YEAR, CONFIDENCE } from "../js/engine/mappings.js";
import { createFactRegistry } from "../js/engine/facts.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));
const only = process.argv.slice(2);
const run = (name) => !only.length || only.includes(name);
const close = (a, b, tol = 0.005) => typeof a === "number" && Math.abs(a - b) <= tol;

let failures = 0;
let section = { name: "", checks: 0, failed: 0 };
function begin(name) { section = { name, checks: 0, failed: 0 }; }
function check(label, ok, detail = "") {
  section.checks += 1;
  if (ok) return;
  section.failed += 1;
  failures += 1;
  console.log(`FAIL ${section.name} ${label}${detail ? `\n  - ${detail}` : ""}`);
}
function end(token, extra = "") {
  if (section.failed) console.log(`${section.name}: ${section.failed} of ${section.checks} checks failed`);
  else console.log(`${token} (${section.checks} checks${extra ? `; ${extra}` : ""})`);
}

const i18n = { en: json("js/i18n/en.json"), de: json("js/i18n/de.json") };

// ---- AC-01: golden cases G1–G8, raw values within ±0.005, displays exactly in both languages ----------
if (run("golden")) {
  begin("golden");
  const { golden_cases: cases } = json("tests/fixtures/golden-cases.json");
  check("eight cases", cases.length === 8);
  const want = (c, key, got) => check(`${c.id} ${key}`, close(got, c.expect[key]), `expected ${c.expect[key]}, got ${got}`);
  const display = (c, key, de, en) => {
    if (c.expect[key] !== undefined) check(`${c.id} ${key} (de)`, plain(de) === plain(c.expect[key]), `expected "${c.expect[key]}", got "${de}"`);
    if (c.expect_en?.[key] !== undefined) check(`${c.id} ${key} (en)`, plain(en) === plain(c.expect_en[key]), `expected "${c.expect_en[key]}", got "${en}"`);
  };
  for (const c of cases) {
    if (c.kind === "duty") {
      const r = dutyCost(c);
      for (const k of ["fallzahl", "personnel_eur", "material_eur", "ea_annual_eur"]) if (c.expect[k] !== undefined) want(c, k, r[k]);
      if (c.expect.hours !== undefined) want(c, "hours", r.hours_per_year);
      display(c, "display_ea_annual_eur", formatEur(r.ea_annual_eur, "de"), formatEur(r.ea_annual_eur, "en"));
      display(c, "display_hours", formatHours(r.hours_per_year, "de"), formatHours(r.hours_per_year, "en"));
    } else if (c.kind === "merge") {
      const r = mergeDelta(c.duties.map((d, i) => ({ duty_id: `D-g3-p${i + 1}-1`, params: d, overlap_share_with_lead: d.overlap_share_with_lead })));
      want(c, "sum_before_eur", r.sum_before_eur);
      want(c, "merged_minutes", r.merged_minutes);
      want(c, "ea_merged_eur", r.ea_merged_eur);
      want(c, "delta_eur", r.delta_ea_eur);
      want(c, "duty_count_delta", r.duty_count_delta);
      display(c, "display_delta_eur", formatEur(r.delta_ea_eur, "de"), formatEur(r.delta_ea_eur, "en"));
    } else if (c.kind === "register_retrieval") {
      const r = registerDelta({ ...c.duty, admin_minutes_per_case: c.admin_minutes_per_case, admin_wage_eur_per_hour: c.admin_wage_eur_per_hour }, { one_off_eur: c.one_off_eur });
      want(c, "business_delta_eur", r.delta_by_addressee.wirtschaft);
      want(c, "admin_annual_eur", r.admin_annual_eur);
      want(c, "net_annual_delta_eur", r.delta_ea_eur);
      want(c, "one_off_eur", r.one_off_eur);
      want(c, "duty_count_delta", r.duty_count_delta);
    } else if (c.kind === "lower_frequency") {
      const r = lowerFrequencyDelta(c.duty, c.new_frequency_per_year);
      want(c, "ea_before_eur", r.ea_before_eur);
      want(c, "ea_after_eur", r.ea_after_eur);
      want(c, "delta_eur", r.delta_ea_eur);
      want(c, "duty_count_delta", r.duty_count_delta);
    } else if (c.kind === "delete") {
      const r = deleteDelta(c.duty);
      want(c, "delta_eur", r.delta_ea_eur);
      want(c, "duty_count_delta", r.duty_count_delta);
    } else if (c.kind === "coverage") {
      const r = sliceCoverage(c);
      for (const k of ["reporting_share", "reporting_target_attainment", "documentation_share", "documentation_target_attainment"]) want(c, k, r[k]);
      display(c, "display_reporting_share", formatShare(r.reporting_share, "de"), formatShare(r.reporting_share, "en"));
      display(c, "display_documentation_target_attainment", formatShare(r.documentation_target_attainment, "de"), formatShare(r.documentation_target_attainment, "en"));
    } else check(`${c.id} kind`, false, `unknown kind ${c.kind}`);
  }
  // Rounding happens for display only: small euro amounts keep two decimals, large ones none.
  check("small euro amount", plain(formatEur(12.5, "de")) === "12,50 €" && plain(formatEur(12.5, "en")) === "€12.50", `${formatEur(12.5, "de")} | ${formatEur(12.5, "en")}`);
  check("no rounding inside the engine", dutyCost({ addressee: "wirtschaft", population_units: 3, frequency_per_year: 1, minutes_per_case: 1, wage_eur_per_hour: 1, material_eur_per_case: 0 }).ea_annual_eur === 3 / 60);
  end("GOLDEN OK");
}

// ---- AC-05: slice coverage counts removed duties per option type -----------------------------------
if (run("coverage")) {
  begin("coverage");
  const duties = {
    "D-a-p1-1": { type: "MELDEPFLICHT" }, "D-b-p1-1": { type: "MELDEPFLICHT" }, "D-c-p1-1": { type: "DOKUMENTATIONSPFLICHT" },
    "D-d-p1-1": { type: "MELDEPFLICHT" }, "D-e-p1-1": { type: "DOKUMENTATIONSPFLICHT" }, "D-f-p1-1": { type: "MELDEPFLICHT" }
  };
  const approved = [
    { type: "merge", removed_duty_ids: ["D-b-p1-1", "D-c-p1-1"], duty_count_delta: -2 },      // N = 3 members, the lead stays
    { type: "register_retrieval", removed_duty_ids: ["D-d-p1-1", "D-e-p1-1"], duty_count_delta: -2 },
    { type: "lower_frequency", removed_duty_ids: [], duty_count_delta: 0 },
    { type: "keep", removed_duty_ids: [], duty_count_delta: 0 },
    { type: "delete", removed_duty_ids: ["D-f-p1-1"], duty_count_delta: -1 }
  ];
  const r = removedByType(approved, duties);
  check("merge removes N − 1, register every duty it replaces, delete one, lower and keep none", r.MELDEPFLICHT === 3 && r.DOKUMENTATIONSPFLICHT === 2, JSON.stringify(r));
  const merge = mergeDelta([
    { duty_id: "D-a-p1-1", params: { addressee: "wirtschaft", population_units: 10, frequency_per_year: 4, minutes_per_case: 30, wage_eur_per_hour: 40, material_eur_per_case: 0 }, overlap_share_with_lead: 1 },
    { duty_id: "D-b-p1-1", params: { addressee: "wirtschaft", population_units: 10, frequency_per_year: 4, minutes_per_case: 20, wage_eur_per_hour: 40, material_eur_per_case: 0 }, overlap_share_with_lead: 0.5 },
    { duty_id: "D-c-p1-1", params: { addressee: "wirtschaft", population_units: 10, frequency_per_year: 4, minutes_per_case: 10, wage_eur_per_hour: 40, material_eur_per_case: 0 }, overlap_share_with_lead: 0.5 }
  ]);
  check("merge of three: duty count −2, lead kept", merge.duty_count_delta === -2 && merge.lead === "D-a-p1-1" && merge.removed_duty_ids.join() === "D-b-p1-1,D-c-p1-1", JSON.stringify(merge));
  const g7 = sliceCoverage({ reporting_total: 30, reporting_removed: 9, documentation_total: 20, documentation_removed: 8 });
  check("G7 through the coverage function", close(g7.reporting_target_attainment, 0.9) && close(g7.documentation_target_attainment, 0.8));
  check("an empty slice has no coverage", sliceCoverage({ reporting_total: 0, reporting_removed: 0, documentation_total: 0, documentation_removed: 0 }).reporting_share === 0);
  end("COVERAGE OK");
}

// ---- AC-21: an assumption typed in the active language --------------------------------------------
if (run("parse")) {
  begin("parse");
  const cases = [
    ["de", "9.000", 9000], ["de", "9 000", 9000], ["de", "9\u202F000", 9000], ["de", "1.234.567,5", 1234567.5], ["de", "1,5", 1.5], ["de", "45", 45], ["de", " 0,25 ", 0.25],
    ["en", "9,000", 9000], ["en", "9 000", 9000], ["en", "1,234,567.5", 1234567.5], ["en", "1.5", 1.5], ["en", "45", 45],
    ["de", "1.5", null], ["en", "1,5", null], ["de", "9.00", null], ["en", "9,00", null], ["de", "9.000.0", null], ["en", "1.000,5", null],
    ["de", "-3", null], ["en", "abc", null], ["en", "", null], ["de", "1,5,2", null], ["en", "1e3", null], ["en", "12 34", null]
  ];
  for (const [lang, text, want] of cases) check(`${lang} "${text}" → ${want}`, parseLocalNumber(text, lang) === want, String(parseLocalNumber(text, lang)));
  end("PARSE OK");
}

// ---- AC-02: fact-auditor cases A01–A31 -------------------------------------------------------------
if (run("audit")) {
  begin("audit");
  const { context, cases } = json("tests/fixtures/audit-cases.json");
  check("31 cases", cases.length === 31);
  const ctx = {
    facts: new Set(context.facts),
    paragraphs: context.paragraphs,
    clusters: context.clusters,
    duties: context.duties,
    complaints: new Set(context.complaints),
    dates: new Set(context.dates)
  };
  for (const c of cases) {
    const r = auditText(c.text, { ...ctx, lang: c.language });
    const tokens = r.violations.map((v) => v.token);
    check(`${c.id} pass`, r.pass === c.expect.pass, `expected pass=${c.expect.pass}, got ${r.pass} (${JSON.stringify(tokens)})`);
    check(`${c.id} tokens`, JSON.stringify(tokens) === JSON.stringify(c.expect.tokens), `expected ${JSON.stringify(c.expect.tokens)}, got ${JSON.stringify(tokens)}`);
  }
  // Rule 6 and unknown ids beyond the fixture.
  const extra = [
    ["Bündel C-007 ist das größte.", false, ["C-007"]],
    ["Bündel C-099 betrifft {{cite:beispielg-p20}}.", false, ["C-099"]],
    ["Beschwerde K-999 betrifft {{cite:beispielg-p20}}.", false, ["K-999"]],
    ["Siehe {{cite:gibtsnicht-p1}}.", false, ["gibtsnicht-p1"]],
    ["Pflicht D-beispielg-p20-1 steht in {{cite:beispielg-p20}}.", true, []],
    ["Pflicht D-beispielg-p20-1 steht in {{cite:beispielg-p21}}.", false, ["D-beispielg-p20-1"]],
    ["Nach {{cite:beispielg-p20}} Absatz 1 Satz 2 Nummer 3 gilt das.", true, []],
    ["Nach § 20 BeispielG und {{cite:beispielg-p20}} gilt das.", true, []],
    ["Nach § 21 BeispielG und {{cite:beispielg-p20}} gilt das.", false, ["21"]],
    ["Die Meldung entfällt vierteljährlich, Code A1 und I1.", true, []],
    ["Das sind dreizehn Meldungen.", false, ["dreizehn"]],
    ["That is thirteen reports.", false, ["thirteen"]],
    ["Two thirds of the duties stay.", false, ["Two thirds"]],
    ["Die Daten bleiben außer Acht.", true, []],
    ["Lauf R1 zeigt {{fact:F-0412}}.", true, []],
    // German compounds count as numbers; "einmal", "einfach", "achten" and frequency words do not.
    ["Das spart zweihundert Euro bei fünfundzwanzig Meldungen.", false, ["zweihundert", "fünfundzwanzig"]],
    ["Hunderttausende Betriebe melden zweimal, dreitausend davon dreifach.", false, ["Hunderttausende", "zweimal", "dreitausend", "dreifach"]],
    ["Ein Dutzend Register, Dutzende Meldungen, einhundert Felder.", false, ["Dutzend", "Dutzende", "einhundert"]],
    ["Die Meldung entfällt einmal; das ist einfach, und die Länder achten darauf, halbjährlich wie zweijährlich.", true, []],
    ["It is filed twice a year by a dozen offices, a tenfold burden.", false, ["twice", "dozen", "tenfold"], "en"],
    ["That saves zweihundert euros.", false, ["zweihundert"], "en"],
    // A number dressed as an id is a number; an id must name something the run holds.
    ["Option O-1500000 entfällt.", false, ["1500000"]],
    ["Die Entscheidung DEC-2026 gilt.", false, ["DEC-2026"]],
    ["Die Entscheidung DEC-0001 gilt für O-C-007-merge.", true, []],
    ["Die Option O-C-008-merge gilt.", false, ["O-C-008-merge"]]
  ];
  const runCtx = { ...ctx, options: new Set(["O-C-007-merge"]), decisions: new Set(["DEC-0001"]) };
  for (const [text, pass, tokens, language] of extra) {
    const lang = language || (/^(That|Two)/.test(text) ? "en" : "de");
    const r = auditText(text, { ...runCtx, lang });
    const got = r.violations.map((v) => v.token);
    check(`extra "${text}"`, r.pass === pass && JSON.stringify(got) === JSON.stringify(tokens), `expected ${pass} ${JSON.stringify(tokens)}, got ${r.pass} ${JSON.stringify(got)}`);
  }
  end("AUDIT OK");
}

// ---- AC-03: cluster cases K1–K9 -----------------------------------------------------------------------
if (run("cluster")) {
  begin("cluster");
  const fx = json("tests/fixtures/cluster-cases.json");
  const core = new Set(fx.vocabulary.core);
  check("nine cases", fx.cases.length === 9);
  for (const c of fx.cases) {
    const r = clusterDuties(c.duties, { core });
    const links = r.links.map((l) => ({ pair: [l.a, l.b], overlap: l.overlap }));
    check(`${c.id} link count`, links.length === c.expect.links.length, `expected ${JSON.stringify(c.expect.links)}, got ${JSON.stringify(links)}`);
    c.expect.links.forEach((e, i) => check(`${c.id} link ${i + 1}`, links[i] && links[i].pair.join() === e.pair.join() && close(links[i].overlap, e.overlap), `expected ${JSON.stringify(e)}, got ${JSON.stringify(links[i])}`));
    check(`${c.id} cluster count`, r.clusters.length === c.expect.clusters.length, `expected ${c.expect.clusters.length}, got ${JSON.stringify(r.clusters)}`);
    c.expect.clusters.forEach((e, i) => {
      const k = r.clusters[i];
      check(`${c.id} cluster ${i + 1}`, k && k.duty_ids.join() === e.duty_ids.join() && k.shared_items.join() === e.shared_items.join() && close(k.overlap, e.overlap) && close(k.confidence, e.confidence),
        `expected ${JSON.stringify(e)}, got ${JSON.stringify(k)}`);
      if (k) check(`${c.id} cluster id and status`, k.id === `C-${String(i + 1).padStart(3, "0")}` && k.status === "candidate" && k.population_id === "pop-test", JSON.stringify(k));
    });
  }
  // Rule 5: four duties grow one cluster link by link, then a split into C-001-a and C-001-b.
  const three = [
    { id: "D-alpha-p1-1", norm_id: "alpha", paragraph_id: "alpha-p1", status: "confirmed", addressee: "wirtschaft", population_id: "pop-test", recipient: "Amt A", data_items: ["a", "b"], confidence: 0.9 },
    { id: "D-beta-p1-1", norm_id: "beta", paragraph_id: "beta-p1", status: "confirmed", addressee: "wirtschaft", population_id: "pop-test", recipient: "Amt B", data_items: ["a", "b"], confidence: 0.9 },
    { id: "D-gamma-p1-1", norm_id: "gamma", paragraph_id: "gamma-p1", status: "confirmed", addressee: "wirtschaft", population_id: "pop-test", recipient: "Amt C", data_items: ["a", "b", "x"], confidence: 0.7 },
    { id: "D-delta-p1-1", norm_id: "delta", paragraph_id: "delta-p1", status: "confirmed", addressee: "wirtschaft", population_id: "pop-test", recipient: "Amt D", data_items: ["a", "b", "y"], confidence: 0.9 }
  ];
  const big = clusterDuties(three, { core });
  check("four linked duties form one cluster", big.clusters.length === 1 && big.clusters[0].duty_ids.join() === "D-alpha-p1-1,D-beta-p1-1,D-delta-p1-1,D-gamma-p1-1" && close(big.clusters[0].overlap, 0.5) && close(big.clusters[0].confidence, 0.35), JSON.stringify(big.clusters));
  const byId = Object.fromEntries(three.map((d) => [d.id, d]));
  const split = splitCluster(big.clusters[0], ["D-gamma-p1-1", "D-delta-p1-1"], byId, { core });
  check("split dissolves into C-001-a and C-001-b in member order", split.parts.map((p) => `${p.id}:${p.duty_ids.join("+")}`).join(" ") === "C-001-a:D-alpha-p1-1+D-beta-p1-1 C-001-b:D-delta-p1-1+D-gamma-p1-1", JSON.stringify(split.parts));
  const lone = splitCluster(big.clusters[0], ["D-alpha-p1-1"], byId, { core });
  check("a part of one duty is no cluster", lone.parts.length === 1 && lone.parts[0].id === "C-001-a" && lone.parts[0].duty_ids.length === 3, JSON.stringify(lone.parts));
  // Rule 8: registers.
  const regs = [
    { id: "reg-b", items: ["a", "b"], availability: "simuliert" },
    { id: "reg-a", items: ["a", "b", "x"], availability: "simuliert" },
    { id: "reg-c", items: ["y"], availability: "simuliert" }
  ];
  check("duty: the register covering every item, ties by id", bestRegister({ kind: "duty", duty: three[0] }, regs)?.register_id === "reg-a");
  const forCluster = bestRegister({ kind: "cluster", members: three }, regs);
  check("cluster: the register covering most members fully", forCluster?.register_id === "reg-a" && forCluster.covers_duty_ids.join() === "D-alpha-p1-1,D-beta-p1-1,D-gamma-p1-1", JSON.stringify(forCluster));
  const none = bestRegister({ kind: "duty", duty: { ...three[0], data_items: ["z", "other:Messwerte"] } }, regs);
  check("no register: null with the uncovered items", none.register_id === null && none.uncovered_items.join() === "other:Messwerte,z", JSON.stringify(none));
  end("CLUSTER OK");
}

// ---- AC-04: option cases O1–O6, reasons as codes rendered in both languages --------------------------
if (run("options")) {
  begin("options");
  const fx = json("tests/fixtures/option-cases.json");
  check("six cases", fx.cases.length === 6);
  const tr = (lang, key) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), i18n[lang]);
  for (const c of fx.cases) {
    const r = draftOptions(c.target, { registers: c.registers, consumers: c.consumers, oneOff: fx.one_off });
    check(`${c.id} ok`, r.ok === true, JSON.stringify(r.error));
    if (!r.ok) continue;
    const got = r.options.map((o) => `${o.type} ${o.delta_ea_eur} ${o.duty_count_delta}`);
    const exp = c.expect.options.map((o) => `${o.type} ${o.delta_ea_eur} ${o.duty_count_delta}`);
    check(`${c.id} options in order`, got.length === exp.length && got.every((g, i) => {
      const [t, d, n] = g.split(" ");
      const [et, ed, en] = exp[i].split(" ");
      return t === et && close(Number(d), Number(ed)) && Number(n) === Number(en);
    }), `expected ${JSON.stringify(exp)}, got ${JSON.stringify(got)}`);
    c.expect.options.forEach((e) => {
      const o = r.options.find((x) => x.type === e.type);
      if (!o) return;
      if (e.delta_by_addressee) check(`${c.id} ${e.type} by addressee`, Object.entries(e.delta_by_addressee).every(([k, v]) => close(o.delta_by_addressee[k], v)), JSON.stringify(o.delta_by_addressee));
      if (e.one_off_eur !== undefined) check(`${c.id} ${e.type} one-off`, close(o.one_off_eur, e.one_off_eur), String(o.one_off_eur));
      if (e.replaces) check(`${c.id} ${e.type} replaces`, o.removed_duty_ids.join() === e.replaces.join(), JSON.stringify(o.removed_duty_ids));
      if (e.lead) check(`${c.id} ${e.type} lead`, o.details?.lead === e.lead && close(o.details?.merged_minutes, e.merged_minutes), JSON.stringify(o.details));
      if (e.new_frequency_per_year) check(`${c.id} ${e.type} step`, o.details?.new_frequency_per_year === e.new_frequency_per_year, JSON.stringify(o.details));
      for (const code of e.risks_include || []) check(`${c.id} ${e.type} risk ${code}`, o.risks.includes(code), JSON.stringify(o.risks));
      for (const code of e.risks_exclude || []) check(`${c.id} ${e.type} no risk ${code}`, !o.risks.includes(code), JSON.stringify(o.risks));
      for (const code of e.notes || []) check(`${c.id} ${e.type} note ${code}`, o.notes.includes(code), JSON.stringify(o.notes));
      check(`${c.id} ${e.type} id and status`, o.id === `O-${c.target.kind === "duty" ? c.target.duty.id : c.target.cluster.id}-${e.type}` && o.status === (e.type === "keep" ? "proposed" : "draft"), `${o.id} ${o.status}`);
    });
    const inel = Object.fromEntries(r.ineligible.map((x) => [x.type, x.reason]));
    check(`${c.id} ineligible types`, Object.keys(inel).sort().join() === c.expect.ineligible.map((x) => x.type).sort().join(), JSON.stringify(r.ineligible));
    for (const x of c.expect.ineligible) {
      check(`${c.id} ${x.type} reason code`, inel[x.type] === x.reason, `expected ${x.reason}, got ${inel[x.type]}`);
      check(`${c.id} ${x.type} reason (de)`, tr("de", `reason.${x.reason}`) === x.de, `got "${tr("de", `reason.${x.reason}`)}"`);
      check(`${c.id} ${x.type} reason (en)`, tr("en", `reason.${x.reason}`) === x.en, `got "${tr("en", `reason.${x.reason}`)}"`);
    }
    for (const o of r.options) for (const code of [...o.risks, ...o.notes]) check(`${c.id} ${o.type} ${code} rendered`, Boolean(tr("de", `risk.${code}`) || tr("de", `note.${code}`)) && Boolean(tr("en", `risk.${code}`) || tr("en", `note.${code}`)));
  }
  for (const [code, [de, en]] of Object.entries(fx.risk_codes)) check(`risk ${code}`, tr("de", `risk.${code}`) === de && tr("en", `risk.${code}`) === en);
  for (const [code, [de, en]] of Object.entries(fx.note_codes)) check(`note ${code}`, tr("de", `note.${code}`) === de && tr("en", `note.${code}`) === en);
  // Refusals for clusters.
  const o6 = fx.cases.find((c) => c.id === "O6");
  const unconfirmed = draftOptions({ ...o6.target, cluster: { ...o6.target.cluster, status: "candidate", confidence: 0.4 } }, { registers: o6.registers, consumers: [], oneOff: fx.one_off });
  check("unconfirmed cluster below 0.5 is refused", unconfirmed.ok === false && unconfirmed.error.code === "cluster_review_needed", JSON.stringify(unconfirmed));
  const split = draftOptions({ ...o6.target, cluster: { ...o6.target.cluster, status: "split" } }, { registers: o6.registers, consumers: [], oneOff: fx.one_off });
  check("split cluster is refused", split.ok === false && split.error.code === "cluster_split", JSON.stringify(split));
  const confirmedLow = draftOptions({ ...o6.target, cluster: { ...o6.target.cluster, status: "confirmed", confidence: 0.4 } }, { registers: o6.registers, consumers: [], oneOff: fx.one_off });
  check("a confirmed cluster below 0.5 is accepted", confirmedLow.ok === true);
  // A Bürger duty ranks by hours first; event-driven duties cannot lower their frequency.
  const citizen = draftOptions({ kind: "duty", duty: { id: "D-x-p1-1", addressee: "buerger", trigger: "anlassbezogen", data_items: ["a"], eu_related: false, protected_standard: null, status: "confirmed" }, params: { addressee: "buerger", trigger: "anlassbezogen", cases_per_year: 50000, minutes_per_case: 20, material_eur_per_case: 2, admin_minutes_per_case: 2, admin_wage_eur_per_hour: 45, admin_level: "laender" } }, { registers: [{ id: "reg-a", items: ["a"], availability: "simuliert" }], consumers: [], oneOff: fx.one_off });
  check("citizen duty: hours first, then euros", citizen.ok && citizen.options.map((o) => o.type).join() === "delete,register_retrieval,keep", JSON.stringify(citizen.options?.map((o) => [o.type, o.delta_hours, o.delta_ea_eur])));
  check("citizen duty: lower_frequency not periodic", citizen.ineligible.find((x) => x.type === "lower_frequency")?.reason === "not_periodic");
  const reg = citizen.options.find((o) => o.type === "register_retrieval");
  check("citizen register retrieval: hours relief, administration cost on the Länder", close(reg.delta_hours, -50000 * 20 / 60) && close(reg.delta_by_addressee.verwaltung, 50000 * 2 / 60 * 45) && reg.details.admin_level === "laender", JSON.stringify(reg));
  const yearly = draftOptions({ kind: "duty", duty: { ...fx.cases[0].target.duty }, params: { ...fx.cases[0].target.params, frequency_per_year: 1 } }, { registers: [], consumers: [{ duty_id: fx.cases[0].target.duty.id, synthetic: true }], oneOff: fx.one_off });
  check("yearly duty: less often than quarterly", yearly.ineligible.find((x) => x.type === "lower_frequency")?.reason === "less_than_quarterly", JSON.stringify(yearly.ineligible));
  end("OPTIONS OK");
}

// ---- Classification mappings and fact registry (used by the tools in M2) ----------------------------
if (run("mappings")) {
  begin("mappings");
  check("frequency table", FREQUENCY_PER_YEAR.täglich === 250 && FREQUENCY_PER_YEAR.wöchentlich === 52 && FREQUENCY_PER_YEAR.monatlich === 12 && FREQUENCY_PER_YEAR.vierteljährlich === 4 && FREQUENCY_PER_YEAR.halbjährlich === 2 && FREQUENCY_PER_YEAR.jährlich === 1);
  check("confidence table", CONFIDENCE.hoch === 0.9 && CONFIDENCE.mittel === 0.7 && CONFIDENCE.niedrig === 0.5);
  const m = mapClassification({ is_duty: true, trigger: "periodisch", frequency_term: "täglich", certainty: "niedrig" });
  check("täglich is an assumption, niedrig goes to review", m.frequency_per_year === 250 && m.frequency_assumption === "working_days" && m.confidence === 0.5 && m.status === "needs_review", JSON.stringify(m));
  check("event-driven: no frequency", mapClassification({ is_duty: true, trigger: "anlassbezogen", frequency_term: null, certainty: "hoch" }).frequency_per_year === null);
  check("no duty: rejected", mapClassification({ is_duty: false, certainty: "hoch" }).status === "rejected");
  check("mittel: confirmed", mapClassification({ is_duty: true, trigger: "periodisch", frequency_term: "jährlich", certainty: "mittel" }).status === "confirmed");
  end("MAPPINGS OK");
}
if (run("facts")) {
  begin("facts");
  const reg = createFactRegistry();
  const a = reg.register({ key: "cost_estimate|D-x-p1-1|ea_annual", value: 1220000, unit: "EUR_PER_YEAR", label: { code: "fact.duty.ea_annual" }, produced_by: "cost_estimate", inputs: [] });
  const b = reg.register({ key: "cost_estimate|D-x-p1-1|fallzahl", value: 40000, unit: "COUNT", label: { code: "fact.duty.fallzahl" }, produced_by: "cost_estimate", inputs: [] });
  check("ids in order", a.id === "F-0001" && b.id === "F-0002", `${a.id} ${b.id}`);
  const a2 = reg.register({ key: "cost_estimate|D-x-p1-1|ea_annual", value: 915000, unit: "EUR_PER_YEAR", label: { code: "fact.duty.ea_annual" }, produced_by: "cost_estimate", inputs: [] });
  check("same key keeps its id and updates the value", a2.id === "F-0001" && reg.get("F-0001").value === 915000);
  reg.retire("cost_estimate|D-x-p1-1|fallzahl");
  check("a retired fact keeps its id and shows no value", reg.get("F-0002").retired === true && reg.get("F-0002").value === null);
  const replay = createFactRegistry();
  replay.bind("F-0412", "draft_options|D-b-p20-1|register_retrieval|wirtschaft_delta");
  const c = replay.register({ key: "draft_options|D-b-p20-1|register_retrieval|wirtschaft_delta", value: -1220000, unit: "EUR_PER_YEAR", label: { code: "fact.option.register_retrieval.wirtschaft_delta" }, produced_by: "draft_options", inputs: [] });
  const d = replay.register({ key: "other|key", value: 1, unit: "COUNT", label: { code: "x" }, produced_by: "t", inputs: [] });
  check("replay binds recorded ids to their keys and never reuses a number", c.id === "F-0412" && d.id !== "F-0412", `${c.id} ${d.id}`);
  let threw = false;
  try { replay.bind("F-0412", "another|key"); } catch { threw = true; }
  check("an id cannot change its key", threw);
  end("FACTS OK");
}

// ---- AC-07: sentence splitting and pattern boundaries ----------------------------------------------
const patternFile = existsSync(path.join(ROOT, "data/patterns/duty-patterns.json")) ? json("data/patterns/duty-patterns.json") : null;
const compiled = patternFile ? compilePatterns(patternFile) : null;
if (run("patterns")) {
  begin("patterns");
  const texts = (t) => splitSentences(t).map((s) => s.text);
  check("Abs. never ends a sentence", texts("Die Angaben nach Abs. 2 sind zu melden. Danach nicht.").length === 2);
  check("Nr. never ends a sentence", texts("Die Angaben nach Nr. 3 sind zu melden. Danach nicht.").length === 2);
  check("z. B. never ends a sentence", texts("Daten wie z. B. Umsätze sind zu melden. Danach nicht.").length === 2);
  check("the specification's other abbreviations", texts("Art. 3 bzw. S. 4 ggf. u. a. i. V. m. d. h. vgl. Buchst. a sowie Satz 2. Ende.").length === 2);
  check("English no., e.g., i.e. and cf.", texts("See no. 4, e.g. here, i.e. there, cf. above. End.").length === 2);
  check("splits on '. ', '; ' and line ends", texts("Eins ist zu melden. Zwei ist zu melden; drei auch\nvier.").length === 4);
  const spec = "(1) Gewerbetreibende haben der zuständigen Stelle vierteljährlich die Zahl der Beschäftigten zu melden. (2) …";
  const s1 = splitSentences(spec)[0];
  check("the specification's example ends at 103", s1.start === 0 && s1.end === 103, JSON.stringify(s1));
  check("a list item number tied by a no-break space ends no sentence", texts("Der Arbeitgeber hat 1. den Namen, 2. die Anschrift zu melden. Ende.").length === 2);
  check("a day before a month ends no sentence", texts("Die Meldung ist bis zum 1. Januar abzugeben. Ende.").length === 2);
  if (!compiled) check("pattern file exists", false, "data/patterns/duty-patterns.json is missing");
  else {
    const ids = (t) => matchSentence(t, compiled).matches.map((m) => m.pattern_id);
    check("'zu übermitteln' matches its pattern", ids("Die Betriebe haben die Angaben zu übermitteln.").some((id) => /^PM-/.test(id)), JSON.stringify(ids("Die Betriebe haben die Angaben zu übermitteln.")));
    check("'zu prüfenden' does not match 'zu prüfen'", !ids("Die zu prüfenden Unterlagen liegen vor.").includes("PK-01"), JSON.stringify(ids("Die zu prüfenden Unterlagen liegen vor.")));
    check("'zu prüfen' matches", ids("Die Behörde hat die Unterlagen zu prüfen.").includes("PK-01"));
    check("a trigger without a marker is no candidate", matchSentence("Die Meldung erfolgt elektronisch.", compiled).candidate === false);
    check("a noun trigger gets half weight", matchSentence("Die Meldepflicht ist zu beachten.", compiled).matches.find((m) => m.kind === "noun")?.weight === 0.5 * (patternFile.patterns.find((p) => p.id === "PM-06")?.weight ?? 1));
    check("an authority's present tense marks an evaluation duty", matchSentence("Die Bundesregierung evaluiert die Wirkungen dieses Gesetzes.", compiled).candidate === true);
    check("a present tense without an authority marks nothing", matchSentence("Das Unternehmen evaluiert seine Prozesse.", compiled).candidate === false);
    check("umlauts at the boundary: 'übermitteln' inside a word does not match", !ids("Die Datenübermittlungsstelle hat geöffnet.").some((id) => /^PM-04$/.test(id)));
    for (const p of patternFile.patterns) {
      const r = matchSentence(p.example, compiled);
      check(`${p.id} matches its own example`, r.matches.some((m) => m.pattern_id === p.id), p.example);
    }
    const idsOk = patternFile.patterns.every((p) => /^P[MNIDEK]-\d{2}$/.test(p.id)) && new Set(patternFile.patterns.map((p) => p.id)).size === patternFile.patterns.length;
    check("pattern ids are unique and well-formed", idsOk);
    const fixtureNorm = { id: "beispielg", paragraphs: [{ id: "beispielg-p20", text: spec, sentences: splitSentences(spec).map((s, i) => ({ id: `beispielg-p20-s${i + 1}`, start: s.start, end: s.end })) }] };
    const cands = extractCandidates(fixtureNorm, compiled);
    check("candidate ids count the paragraph's candidates", cands.length === 1 && cands[0].candidate_id === "D-beispielg-p20-1" && cands[0].sentence_id === "beispielg-p20-s1", JSON.stringify(cands));
    check("the evidence span is 'zu melden' at 93–102", cands[0]?.span.start === 93 && cands[0]?.span.end === 102 && cands[0]?.span.phrase === "zu melden", JSON.stringify(cands[0]?.span));
    check("type hint and marker", cands[0]?.type_hint === "MELDEPFLICHT" && cands[0]?.marker === "haben", JSON.stringify(cands[0]));
  }
  end("PATTERNS OK");
}

// ---- AC-06: the pattern stage finds at least 95 % of the 40 gold duties ------------------------------
if (run("recall") || run("gold")) {
  const gold = json("tests/fixtures/gold-duties.json");
  if (run("gold")) {
    begin("gold");
    check("60 items", gold.items.length === 60);
    check("40 duties and 20 non-duties", gold.items.filter((i) => i.is_duty).length === 40 && gold.items.filter((i) => !i.is_duty).length === 20);
    check("unique sentences", new Set(gold.items.map((i) => i.id)).size === 60);
    const TYPES = ["MELDEPFLICHT", "NACHWEISPFLICHT", "INFORMATIONSPFLICHT", "DOKUMENTATIONSPFLICHT", "EVALUIERUNGSPFLICHT", "KONTROLLPFLICHT"];
    for (const it of gold.items) {
      const norm = json(`data/corpus/${it.norm_id}.json`);
      const p = norm.paragraphs.find((x) => x.id === it.paragraph_id);
      const s = p?.sentences.find((x) => x.id === it.id);
      check(`${it.id} matches the corpus`, Boolean(s) && p.text.slice(s.start, s.end) === it.text);
      if (it.is_duty) check(`${it.id} type and addressee`, TYPES.includes(it.type) && ["buerger", "wirtschaft", "verwaltung"].includes(it.addressee));
      else check(`${it.id} no type`, it.type === null && it.addressee === null);
    }
    check("status is stated", ["unconfirmed", "confirmed"].includes(gold.status));
    end("GOLD SET OK");
  }
  if (run("recall")) {
    begin("recall");
    if (!compiled) check("pattern file exists", false);
    else {
      const found = [];
      const missed = [];
      const flagged = [];
      for (const it of gold.items) {
        const r = matchSentence(it.text, compiled);
        if (it.is_duty) (r.candidate ? found : missed).push(it.id);
        else if (r.candidate) flagged.push(it.id);
      }
      const recall = found.length / 40;
      check("recall at least 95 %", recall >= 0.95, `${found.length} of 40; missed: ${missed.join(", ")}`);
      const precision = found.length / (found.length + flagged.length);
      end("RECALL OK", `${found.length} of 40 gold duties found (${(recall * 100).toFixed(1)} %); pattern-stage precision on the gold set ${(precision * 100).toFixed(1)} % (${flagged.length} of 20 non-duties flagged${flagged.length ? `: ${flagged.join(", ")}` : ""})`);
    }
  }
}

if (failures) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
