// A price anyone can check (DR-06): the derivation the page shows, computed again from its inputs with
// the federal compliance-cost method, and the sensitivity against 1.0.0's engines. Node.js only.
//   inputs      every input of the brief's section 3 is there with its value, its kind and its source:
//               the businesses (capped by public counts), reports a year (the law), minutes and wages (the
//               Destatis guide's tables, with page), material, register minutes and one-off cost (assumed,
//               with a reason), the merged report's minutes (computed)
//   method      one report = businesses × reports a year × (minutes ÷ 60 × wage + material); both reports;
//               the merged report of 10 + 10 × (1 − 4/5) = 12 minutes; the relief; the register's saving,
//               the administration's cost and the net; each equal to data/story.js and the options
//   before      R1's own figures at its assumed 60,000 businesses: exactly €4,065,600 and €3,926,400
//   calibration the cap is the smaller of the two public counts (the production survey's sites, the sum of
//               the 16 Länder; the trade and services survey's units), below R1's assumption
//   sensitivity each row is the relief for its share of the cap, by the method; with --require-legacy,
//               tools/build-story.mjs --check proves the rows equal 1.0.0's engines' output
//   words       the derivation's arithmetic, step by step in both languages, carries these figures and says
//               how the page rounds them
// Usage: node tests/derivation.mjs [--require-legacy]
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";
import { D, X, F, W, LANGS, NAME, norm, close, checks } from "./lib/app.mjs";

const { check, finish } = checks();
const I = Object.fromEntries(Object.entries(D.inputs).map(([k, v]) => [k, v.value]));
const K = D.inputs;

// ---- inputs ------------------------------------------------------------------------------------------------
check(K.businesses.kind === "cap" && K.perYear.kind === "law" && K.minutes.kind === "sourced" && K.wage.kind === "sourced" && K.adminWage.kind === "sourced" && K.material.kind === "assumed" && K.adminMinutes.kind === "assumed" && K.oneOff.kind === "assumed" && K.mergedMinutes.kind === "engine", `inputs: each input has its kind (${Object.entries(K).map(([k, v]) => `${k} ${v.kind}`).join(", ")})`);
check(K.minutes.source.page === 69 && K.wage.source.page === 72 && K.adminWage.source.page === 76 && Object.values(K.minutes.source.parts).join("+") === "3+2+3+1+1" && I.minutes === 10 && I.wage === 38.6 && I.adminWage === 44.4, "inputs: 10 minutes as the five simple standard activities of Annex 4 (3 + 2 + 3 + 1 + 1, p. 69), €38.60 (Annex 6, p. 72) and €44.40 an hour (Annex 8, p. 76)");
check([K.material, K.adminMinutes, K.oneOff].every((x) => x.reason?.en && x.reason?.de) && I.material === 0.5 && I.adminMinutes === 2 && I.oneOff === 250000 && I.perYear === 12, "inputs: the assumed €0.50, 2 minutes and €250,000 carry their reasons in both languages; 12 reports a year from § 4 HdlDlStatG");

// ---- the method ----------------------------------------------------------------------------------------------
const per = (minutes, wage, material) => (minutes / 60) * wage + material;
const reports = I.businesses * I.perYear;
const one = reports * per(I.minutes, I.wage, I.material);
const removed = D.cluster.members.find((m) => D.options.find((o) => o.type === "merge").removes.includes(m.duty));
const lead = D.cluster.members.find((m) => m !== removed);
const shared = removed.items.filter((x) => lead.items.some((y) => y.id === x.id)).length;
const merged = I.minutes + I.minutes * (1 - shared / removed.items.length);
const relief = 2 * one - reports * per(merged, I.wage, I.material);
const admin = reports * per(I.adminMinutes, I.adminWage, 0);
const dv = D.derivation;
const opt = Object.fromEntries(D.options.map((o) => [o.type, o]));
check(close(dv.one.reports, reports) && close(dv.one.hours, (reports * I.minutes) / 60) && close(dv.one.cost, one) && close(dv.both, 2 * one), `method: one report costs ${reports} reports × (${I.minutes} min ÷ 60 × €${I.wage} + €${I.material}) = €${one.toFixed(2)}; both €${(2 * one).toFixed(2)}`);
check(merged === I.mergedMinutes && shared === 4 && removed.items.length === 5 && close(dv.merged.cost, reports * per(merged, I.wage, I.material)), `method: the merged report takes ${I.minutes} + ${I.minutes} × (1 − ${shared}/${removed.items.length}) = ${merged} minutes: the second report adds 1 item of ${removed.items.length}`);
check(close(dv.relief, relief) && close(-opt.merge.net, relief) && close(F.merge, relief) && close(D.kpiBefore.pending, relief), `method: merging relieves businesses of €${relief.toFixed(2)} a year, as the merge, the key figure and the derivation say`);
check(close(dv.admin.cost, admin) && close(-opt.register_retrieval.businesses, one) && close(opt.register_retrieval.administration, admin) && close(dv.registerNet, one - admin) && close(-opt.register_retrieval.net, one - admin) && dv.oneOff === I.oneOff, `method: the register saves businesses €${one.toFixed(2)}, costs the administration €${admin.toFixed(2)}: €${(one - admin).toFixed(2)} net, plus €${I.oneOff} once`);

// ---- before the calibration: R1's own figures -----------------------------------------------------------------
const b = D.calibration?.before || {};
const r1 = b.businesses * I.perYear;
const r1One = r1 * per(I.minutes, I.wage, I.material);
const r1Relief = 2 * r1One - r1 * per(merged, I.wage, I.material);
const r1Net = r1One - r1 * per(I.adminMinutes, I.adminWage, 0);
check(b.businesses === 60000 && Math.round(r1Relief * 100) === 406560000 && Math.round(r1Net * 100) === 392640000 && b.merge === 4065600 && b.register === 3926400, `before: at R1's assumed ${b.businesses} businesses the method gives exactly €${r1Relief.toFixed(2)} and €${r1Net.toFixed(2)}, as 1.0.0's engines did`);

// ---- the calibration -----------------------------------------------------------------------------------------
const c = D.calibration || {};
check(c.cap === Math.min(c.production?.sites, c.trade?.count) && c.cap === I.businesses && c.production.lands === 16 && c.cap < b.businesses && /^\d{4}-\d{2}-\d{2}$/.test(c.retrieved) && /^https:\/\//.test(c.production.url) && /^https:\/\//.test(c.trade.url) && c.trade.page > 0, `calibration: the cap is the smaller survey, ${c.production?.sites} sites (16 Länder, ${c.production?.year}) against about ${c.trade?.count} units (${c.trade?.year}), read on ${c.retrieved}, below R1's ${b.businesses}`);

// ---- sensitivity ---------------------------------------------------------------------------------------------
const rows = D.sensitivity || [];
const offRows = rows.filter((r) => r.businesses !== Math.round(I.businesses * r.share) || !close(r.relief, (relief * r.businesses) / I.businesses));
check(rows.map((r) => r.share).join() === "1,0.5,0.25,0.1" && !offRows.length && close(rows[0].relief, relief), `sensitivity: the relief if 100 %, 50 %, 25 % or 10 % of the ${I.businesses} file both: ${rows.map((r) => `${r.businesses} → €${r.relief.toFixed(2)}`).join(", ")}`);
const legacy = [process.env.DR_LEGACY, path.resolve(APP_ROOT, "..", "dutyradar-1.0.0")].filter(Boolean).find((d) => existsSync(path.join(d, "js", "state.js")));
if (legacy) {
  const r = spawnSync(process.execPath, [path.join(APP_ROOT, "tools/build-story.mjs"), "--check", "--legacy", legacy], { encoding: "utf8" });
  check(r.status === 0 && /STORY DATA MATCHES 1\.0\.0/.test(r.stdout), `sensitivity: the rows, the derivation and the calibration equal a fresh run of 1.0.0's engines (build-story --check)${r.status ? `: ${(r.stdout + r.stderr).trim().split("\n").pop()}` : ""}`);
} else {
  check(!process.argv.includes("--require-legacy"), "sensitivity: (skipped) no checkout of 1.0.0 to run its engines");
}

// ---- the words -----------------------------------------------------------------------------------------------
if (!X) check(false, "words: js/explain.js words the derivation");
else {
  for (const lang of LANGS) {
    const w = W[lang];
    const de = lang === "de";
    const fmt = (x, d = 0) => new Intl.NumberFormat(de ? "de-DE" : "en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
    const eur = (x) => (de ? `${fmt(x, 2)} €` : `€${fmt(x, 2)}`);
    for (const type of ["merge", "register_retrieval"]) {
      const d = X.explain(F, lang).derive(type);
      const text = norm([d.formula, ...d.steps, d.rounding].join(" | "));
      const need = type === "merge"
        ? [fmt(reports), eur(one), eur(2 * one), eur(reports * per(merged, I.wage, I.material)), eur(relief), w.money(relief)]
        : [fmt(reports), eur(one), eur(admin), eur(one - admin), w.money(one - admin)];
      const absent = need.filter((x) => !text.includes(norm(x)));
      check(!absent.length && d.steps.length >= 3 && /round|rund/i.test(d.rounding), `words: ${NAME[lang]}, ${type}: the arithmetic step by step with every figure and the rounding${absent.length ? `; missing: ${absent.join(", ")}` : ""}`);
      const ids = d.inputs.map((x) => x.id);
      const needIds = type === "merge" ? ["businesses", "perYear", "minutes", "wage", "material", "mergedMinutes"] : ["businesses", "perYear", "minutes", "wage", "material", "adminMinutes", "adminWage", "oneOff"];
      const kinds = d.inputs.filter((x) => !x.kind || !x.source || !x.value);
      check(needIds.every((id) => ids.includes(id)) && !kinds.length, `words: ${NAME[lang]}, ${type}: every input with its value, kind and source (${ids.join(", ")})${kinds.length ? `; bare: ${kinds.map((x) => x.id).join(", ")}` : ""}`);
    }
    const m = X.explain(F, lang).derive("merge");
    check(m.parts.length === 5 && m.parts.map((p) => p.minutes).join("+") === "3+2+3+1+1" && m.parts.every((p) => p.name.length > 3) && norm(m.merged).includes(fmt(12)), `words: ${NAME[lang]}: the five standard activities behind the 10 minutes, by name, and why the merged report takes 12`);
    check(m.sensitivity.length === 4 && m.sensitivity.every((r, i) => norm(r.value) === norm(w.m(rows[i].relief))), `words: ${NAME[lang]}: the sensitivity table shows the four reliefs (${m.sensitivity.map((r) => norm(r.value)).join(", ")})`);
  }
}
finish("DERIVATION OK");
