// The self-test behind "Run all tests" in Assumptions & diagnostics (AC-28): the golden cases of the cost
// engine, the fact auditor's cases and the cluster cases, read from the same fixture files as the Node
// suite (tests/fixtures/) and held to the same rules: raw values within ±0.005, display strings exactly
// once ICU's non-breaking spaces are made plain, the auditor's verdict and offending tokens, the links
// and clusters with their overlap and confidence. The display strings are formatted by this browser's
// own Intl, so the self-test also shows whether the browser formats figures as the engine expects.
// Pure: the fixtures come through the fetch function passed in, so tests/selftest.mjs runs it in Node.

import { dutyCost, deleteDelta, lowerFrequencyDelta, registerDelta, mergeDelta, sliceCoverage } from "./engine/cost.js";
import { formatEur, formatHours, formatShare, plain } from "./engine/format.js";
import { auditText } from "./engine/auditor.js";
import { clusterDuties } from "./engine/cluster.js";

/** The fixture files, relative to the page (GitHub Pages serves the repository as it is). */
export const FIXTURES = { golden: "tests/fixtures/golden-cases.json", audit: "tests/fixtures/audit-cases.json", cluster: "tests/fixtures/cluster-cases.json" };
const TOLERANCE = 0.005;

/** Collects the mismatches of one case: { field, expected, actual }. */
function recorder() {
  const out = [];
  return {
    out,
    value(field, expected, actual) {
      if (expected === undefined) return;
      if (typeof actual !== "number" || Math.abs(actual - expected) > TOLERANCE) out.push({ field, expected, actual });
    },
    text(field, expected, actual) {
      if (expected === undefined) return;
      if (plain(actual) !== plain(expected)) out.push({ field, expected, actual });
    },
    same(field, expected, actual) {
      if (JSON.stringify(expected) !== JSON.stringify(actual)) out.push({ field, expected: JSON.stringify(expected), actual: JSON.stringify(actual) });
    }
  };
}

/** One golden case: the engine's raw values and display strings against the fixture. */
function goldenCase(c) {
  const r = recorder();
  const show = (key, de, en) => { r.text(key, c.expect?.[key], de); r.text(`${key} (en)`, c.expect_en?.[key], en); };
  const e = c.expect || {};
  if (c.kind === "duty") {
    const x = dutyCost(c);
    for (const k of ["fallzahl", "personnel_eur", "material_eur", "ea_annual_eur"]) r.value(k, e[k], x[k]);
    r.value("hours", e.hours, x.hours_per_year);
    show("display_ea_annual_eur", formatEur(x.ea_annual_eur, "de"), formatEur(x.ea_annual_eur, "en"));
    show("display_hours", formatHours(x.hours_per_year, "de"), formatHours(x.hours_per_year, "en"));
  } else if (c.kind === "merge") {
    const x = mergeDelta(c.duties.map((d, i) => ({ duty_id: `D-g3-p${i + 1}-1`, params: d, overlap_share_with_lead: d.overlap_share_with_lead })));
    r.value("sum_before_eur", e.sum_before_eur, x.sum_before_eur);
    r.value("merged_minutes", e.merged_minutes, x.merged_minutes);
    r.value("ea_merged_eur", e.ea_merged_eur, x.ea_merged_eur);
    r.value("delta_eur", e.delta_eur, x.delta_ea_eur);
    r.value("duty_count_delta", e.duty_count_delta, x.duty_count_delta);
    show("display_delta_eur", formatEur(x.delta_ea_eur, "de"), formatEur(x.delta_ea_eur, "en"));
  } else if (c.kind === "register_retrieval") {
    const x = registerDelta({ ...c.duty, admin_minutes_per_case: c.admin_minutes_per_case, admin_wage_eur_per_hour: c.admin_wage_eur_per_hour }, { one_off_eur: c.one_off_eur });
    r.value("business_delta_eur", e.business_delta_eur, x.delta_by_addressee?.wirtschaft);
    r.value("admin_annual_eur", e.admin_annual_eur, x.admin_annual_eur);
    r.value("net_annual_delta_eur", e.net_annual_delta_eur, x.delta_ea_eur);
    r.value("one_off_eur", e.one_off_eur, x.one_off_eur);
    r.value("duty_count_delta", e.duty_count_delta, x.duty_count_delta);
  } else if (c.kind === "lower_frequency") {
    const x = lowerFrequencyDelta(c.duty, c.new_frequency_per_year);
    r.value("ea_before_eur", e.ea_before_eur, x.ea_before_eur);
    r.value("ea_after_eur", e.ea_after_eur, x.ea_after_eur);
    r.value("delta_eur", e.delta_eur, x.delta_ea_eur);
    r.value("duty_count_delta", e.duty_count_delta, x.duty_count_delta);
  } else if (c.kind === "delete") {
    const x = deleteDelta(c.duty);
    r.value("delta_eur", e.delta_eur, x.delta_ea_eur);
    r.value("duty_count_delta", e.duty_count_delta, x.duty_count_delta);
  } else if (c.kind === "coverage") {
    const x = sliceCoverage(c);
    for (const k of ["reporting_share", "reporting_target_attainment", "documentation_share", "documentation_target_attainment"]) r.value(k, e[k], x[k]);
    show("display_reporting_share", formatShare(x.reporting_share, "de"), formatShare(x.reporting_share, "en"));
    show("display_documentation_target_attainment", formatShare(x.documentation_target_attainment, "de"), formatShare(x.documentation_target_attainment, "en"));
  } else r.out.push({ field: "kind", expected: "a known kind", actual: c.kind });
  return r.out;
}

/** One auditor case: the verdict and the offending tokens. */
function auditCase(c, ctx) {
  const r = recorder();
  const x = auditText(c.text, { ...ctx, lang: c.language });
  r.same("pass", c.expect.pass, x.pass);
  r.same("tokens", c.expect.tokens, x.violations.map((v) => v.token));
  return r.out;
}

/** One cluster case: the links with their overlap, the clusters with members, shared items, overlap and confidence. */
function clusterCase(c, core) {
  const r = recorder();
  const x = clusterDuties(c.duties, { core });
  r.same("links", c.expect.links.map((l) => l.pair.join("+")), x.links.map((l) => `${l.a}+${l.b}`));
  c.expect.links.forEach((l, i) => r.value(`link ${i + 1} overlap`, l.overlap, x.links[i]?.overlap));
  r.same("clusters", c.expect.clusters.map((k) => k.duty_ids.join("+")), x.clusters.map((k) => k.duty_ids.join("+")));
  c.expect.clusters.forEach((k, i) => {
    r.same(`cluster ${i + 1} shared items`, k.shared_items, x.clusters[i]?.shared_items);
    r.value(`cluster ${i + 1} overlap`, k.overlap, x.clusters[i]?.overlap);
    r.value(`cluster ${i + 1} confidence`, k.confidence, x.clusters[i]?.confidence);
  });
  return r.out;
}

/** Runs one case and catches an engine that throws, so one broken case cannot hide the others. */
function run(id, fn) {
  try {
    const mismatches = fn();
    return { id, pass: mismatches.length === 0, mismatches };
  } catch (e) {
    return { id, pass: false, mismatches: [{ field: "error", expected: "no error", actual: String(e?.message || e) }] };
  }
}

/**
 * Loads the three fixture files with fetchFn(path) (a Response) and runs every case.
 * Returns { groups: [{ id, cases: [{ id, pass, mismatches }] }], total, failed }; throws when a file
 * cannot be loaded.
 */
export async function runSelfTest(fetchFn) {
  const load = async (p) => {
    const res = await fetchFn(p, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
    return res.json();
  };
  const [golden, audit, cluster] = await Promise.all([load(FIXTURES.golden), load(FIXTURES.audit), load(FIXTURES.cluster)]);
  const ctx = {
    facts: new Set(audit.context.facts), paragraphs: audit.context.paragraphs, clusters: audit.context.clusters,
    duties: audit.context.duties, complaints: new Set(audit.context.complaints), dates: new Set(audit.context.dates)
  };
  const core = new Set(cluster.vocabulary.core);
  const groups = [
    { id: "golden", cases: golden.golden_cases.map((c) => run(c.id, () => goldenCase(c))) },
    { id: "audit", cases: audit.cases.map((c) => run(c.id, () => auditCase(c, ctx))) },
    { id: "cluster", cases: cluster.cases.map((c) => run(c.id, () => clusterCase(c, core))) }
  ];
  const all = groups.flatMap((g) => g.cases);
  return { groups, total: all.length, failed: all.filter((c) => !c.pass).length };
}
