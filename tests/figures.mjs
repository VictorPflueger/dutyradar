// The figures, recomputed. Node.js only.
//   legacy    data/story.js is byte for byte what release 1.0.0's engines compute when its run R1 is
//             replayed (tools/build-story.mjs --check), given a checkout of 1.0.0 in DR_LEGACY or at
//             ../dutyradar-1.0.0; without one it says so and passes, unless --require-legacy is given
//   method    every euro figure again from the federal compliance-cost method and its inputs:
//             a report costs businesses × reports a year × (minutes / 60 × wage + material); merging
//             keeps the lead report and adds the minutes of the data it didn't already ask for; a
//             register retrieval drops the covered report and costs the administration its minutes
//   counts    the laws, duties, kinds of duty, clusters and the target add up, and the inventory behind the
//             lists (data/inventory.js) counts what the ladder counts
//   steps     the three key figures at every step, before and after each of the three decisions: they
//             answer first, from the first screen, and only the decision moves them
//   page      every figure written into index.html (both guides, the step buttons, the first state of
//             the key figures and the story) equals the computed one, in its language
//   docs      every euro in the four documents is a computed one, the README's table of the key figures
//             carries the computed counts, and DEMO_SCRIPT.md's talk track is the guide's, in both
//             languages
// Usage: node tests/figures.mjs [--require-legacy]
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "./lib/harness.mjs";

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(APP_ROOT, "data/story.js"), "utf8"), sandbox);
const D = sandbox.window.DUTY_RADAR;
const S = await import(pathToFileURL(path.join(APP_ROOT, "js/story.js")).href);
const F = S.factsOf(D);
const close = (a, b) => Math.abs(a - b) < 1e-6;

// ---- legacy: the data is 1.0.0's -------------------------------------------------------------------
const requireLegacy = process.argv.includes("--require-legacy");
const legacy = [process.env.DR_LEGACY, path.resolve(APP_ROOT, "..", "dutyradar-1.0.0")].filter(Boolean).find((d) => existsSync(path.join(d, "js", "state.js")));
if (legacy) {
  const r = spawnSync(process.execPath, [path.join(APP_ROOT, "tools/build-story.mjs"), "--check", "--legacy", legacy], { encoding: "utf8" });
  check(r.status === 0 && /STORY DATA MATCHES 1\.0\.0/.test(r.stdout), `legacy: data/story.js equals a fresh build from 1.0.0's engines${r.status ? `: ${(r.stdout + r.stderr).trim().split("\n").pop()}` : ""}`);
} else {
  check(!requireLegacy, `legacy: ${requireLegacy ? "no" : "(skipped) no"} checkout of 1.0.0 in DR_LEGACY or at ../dutyradar-1.0.0 to rebuild the data from`);
}
check(D.generatedFrom.release === "1.0.0" && D.generatedFrom.run === "R1", `legacy: the data names its source, release ${D.generatedFrom.release}, run ${D.generatedFrom.run}`);

// ---- method: every euro again ------------------------------------------------------------------------
const I = Object.fromEntries(Object.entries(D.inputs).map(([k, v]) => [k, v.value]));
const reportCost = (cases, minutes) => cases * ((minutes / 60) * I.wage + I.material);
const casesEach = I.businesses * I.perYear;
const one = reportCost(casesEach, I.minutes);
const [m0, m1] = D.cluster.members;
check(I.businesses === D.calibration.cap && m0.cases === casesEach && m1.cases === casesEach, `method: ${I.businesses} businesses (the cap of the public counts) × ${I.perYear} reports a year = ${casesEach} reports per law`);
check(close(m0.cost, one) && close(m1.cost, one) && close(F.reportCost, one), `method: one report costs ${one} € a year (${I.minutes} min at ${I.wage} € an hour + ${I.material} €), as 1.0.0 priced both`);
check(D.cluster.cases === 2 * casesEach && close(D.cluster.cost, 2 * one), `method: the two reports, ${D.cluster.cases} a year, cost ${D.cluster.cost} €`);
check(I.minutes === Object.values(D.inputs.minutes.source.parts).reduce((a, b) => a + b, 0) && I.wage === D.inputs.wage.source.value && I.adminWage === D.inputs.adminWage.source.value, "method: the minutes and both wage rates are the Destatis guide's table values");
const option = Object.fromEntries(D.options.map((o) => [o.type, o]));
// Merge: the lead keeps its report; the removed one's data it didn't ask for adds its share of minutes.
const removed = D.cluster.members.find((m) => option.merge.removes.includes(m.duty));
const lead = D.cluster.members.find((m) => m !== removed);
const leadItems = new Set(lead.items.map((x) => x.id));
const overlap = removed.items.filter((x) => leadItems.has(x.id)).length / removed.items.length;
const merged = I.minutes + I.minutes * (1 - overlap);
const mergeRelief = D.cluster.cost - reportCost(casesEach, merged);
check(close(merged, I.mergedMinutes) && close(-option.merge.net, mergeRelief) && close(F.merge, mergeRelief) && option.merge.duties === -1, `method: merging leaves one report of ${merged} min (${lead.abbr} already asks ${Math.round(overlap * 100)} % of ${removed.abbr}'s data): ${mergeRelief} € a year`);
const covered = D.cluster.members.filter((m) => D.cluster.register.covers.includes(m.duty));
const saved = covered.reduce((s, m) => s + m.cost, 0);
const admin = covered.reduce((s, m) => s + m.cases * (I.adminMinutes / 60) * I.adminWage, 0);
check(covered.length === 1 && close(-option.register_retrieval.businesses, saved) && close(option.register_retrieval.administration, admin) && close(-option.register_retrieval.net, saved - admin) && option.register_retrieval.oneOff === I.oneOff, `method: a register retrieval saves businesses ${saved} €, costs the administration ${admin} €: ${saved - admin} € net, plus ${I.oneOff} € once`);
check(option.keep.net === 0 && option.keep.duties === 0, "method: keeping both changes nothing");
check(D.options.map((o) => o.type).join() === "merge,register_retrieval,keep", "method: the options in 1.0.0's order, the largest relief first");

// ---- counts ----------------------------------------------------------------------------------------
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const t = D.totals;
check(sum(D.norms.map((n) => n.duties)) === t.duties && sum(Object.values(t.byType)) === t.duties && sum(Object.values(t.byAddressee)) === t.duties, `counts: ${t.duties} duties, by law, by kind and by addressee`);
check(sum(D.norms.map((n) => n.candidates)) === t.candidates && t.rejected === t.candidates - t.duties, `counts: ${t.candidates} sentences flagged, ${t.rejected} sorted out`);
check(sum(D.norms.map((n) => n.clustered)) === t.clustered && t.clustered <= t.duties && t.clusters === 48, `counts: ${t.clustered} duties asked twice in ${t.clusters} clusters`);
check(D.norms.length === 31 && sum(D.norms.map((n) => n.paragraphs)) === D.slice.paragraphs && sum(D.norms.map((n) => n.sentences)) === D.slice.sentences, `counts: ${D.norms.length} laws, ${D.slice.paragraphs} paragraphs, ${D.slice.sentences} sentences`);
const inFamilies = D.families.flatMap((f) => f.norms);
check(inFamilies.length === 31 && new Set(inFamilies).size === 31 && D.norms.every((n) => inFamilies.includes(n.id)), "counts: every law in exactly one of the five families");
let target = 0;
while (target < F.reporting / 3) target += 1;
let docTarget = 0;
while (docTarget < F.documentation / 2) docTarget += 1;
check(F.target === target && target === 107 && F.docTarget === docTarget && F.others === t.duties - F.reporting - F.documentation, `counts: a third of ${F.reporting} reporting duties is at least ${target}, half of ${F.documentation} documentation duties ${docTarget}`);
const sorted = D.norms.every((n, i) => n.readFrom < n.readAt && (i === 0 || D.norms[i - 1].readAt <= n.readFrom)) && D.norms.at(-1).readAt === D.replay.readTo;
check(sorted, "counts: the replay reads the laws one after another, in the slice's order");
const r0 = S.readingAt(F, 0);
const rHalf = S.readingAt(F, 0.5);
const r1 = S.readingAt(F, 1);
check(r0.found === 0 && r0.laws.every((l) => l.state === "unread") && r1.found === t.duties && r1.laws.every((l) => l.state === "read") && rHalf.found > 0 && rHalf.found < t.duties && rHalf.laws.some((l) => l.state === "reading"), `counts: before Play nothing is read; halfway ${rHalf.found} duties in ${rHalf.done} laws; at the end all ${t.duties}`);

// The inventory behind the lists counts what the ladder counts (DR-03).
const inv = (() => { const sb = { window: {} }; vm.createContext(sb); vm.runInContext(readFileSync(path.join(APP_ROOT, "data/inventory.js"), "utf8"), sb); return sb.window.DUTY_RADAR_INVENTORY; })();
const X = existsSync(path.join(APP_ROOT, "js/explain.js")) ? await import(pathToFileURL(path.join(APP_ROOT, "js/explain.js")).href) : null;
const ladder = X ? Object.fromEntries(X.explain(F, "en").ladder.flatMap((r) => [[r.id, r.value], ...(r.sub || []).map((x) => [x.open, x.value])])) : {};
const invCounts = { laws: inv.laws.length, sections: sum(inv.laws.map((l) => l.paragraphs)), sentences: sum(inv.laws.map((l) => l.sentences)), flagged: inv.duties.length + inv.discarded.length, duties: inv.duties.length, discarded: inv.discarded.length, clusters: inv.clusters.length, "clusters:duties": sum(inv.clusters.map((c) => c.duties.length)), ...Object.fromEntries(Object.keys(t.byType).map((type) => [`duties:${type}`, inv.duties.filter((d) => d.type === type).length])) };
const offLadder = Object.entries(invCounts).filter(([k, v]) => ladder[k] !== v);
check(X && !offLadder.length, `counts: the inventory counts what the ladder counts (${Object.entries(invCounts).map(([k, v]) => `${k} ${v}`).join(", ")})${offLadder.length ? `; off: ${offLadder.map(([k, v]) => `${k} ${v} ≠ ${ladder[k]}`).join(", ")}` : ""}`);

// ---- the three key figures, step by step --------------------------------------------------------------
// Answer first: before anything runs they show what the case puts at stake (203 of 745 asked twice, the
// merge's relief, 0 of the 107 duties the target asks for); an approval takes the relief at stake off the
// table and strikes the old value through, keeping both leaves it.
const k = (index, decision = null) => S.kpisAt(F, index, decision);
const before = [203, 745, mergeRelief, null, "pending", 0, null, 107];
const expect = [
  [k(0), before], [k(1), before], [k(2), before], [k(3), before], [k(4), before],
  [k(4, "merge"), [203, 745, 0, mergeRelief, "decided_merge", 1, 0, 107]],
  [k(4, "register_retrieval"), [203, 745, 0, mergeRelief, "decided_register_retrieval", 1, 0, 107]],
  [k(4, "keep"), [203, 745, mergeRelief, null, "decided_keep", 0, null, 107]],
  // A decision belongs to the last step: back at "It prices" the relief is at stake again.
  [k(3, "merge"), before]
];
const bad = expect.filter(([got, [twice, of, stake, was, note, cut, cutWas, target]]) => got.twice.value !== twice || got.twice.of !== of || !close(got.stake.value, stake) || (was === null ? got.stake.was !== null : !close(got.stake.was, was)) || got.stake.note !== note || got.cut.value !== cut || got.cut.was !== cutWas || got.cut.of !== target);
check(!bad.length && F.clustered === 203 && F.duties === 745 && close(F.stake, mergeRelief), `steps: the key figures at each step and after each decision${bad.length ? `; wrong: ${bad.map(([g]) => JSON.stringify(g)).join(" | ")}` : ""}`);
const o = D.outcomes;
check(close(o.merge.relief, mergeRelief) && o.merge.reporting.removed === 1 && removed.type === "MELDEPFLICHT" && o.register_retrieval.reporting.removed === 1 && o.keep.relief === 0 && o.keep.kept.length === 2 && o.keep.kept.every((x) => x.reason === "A3"), "steps: 1.0.0's dossier after each decision: a merge or a retrieval removes one reporting duty, keeping both keeps them with A3");
check(close(D.kpiBefore.pending, mergeRelief), "steps: before the decision 1.0.0 shows the merge's relief as pending");

// ---- the page --------------------------------------------------------------------------------------
const html = readFileSync(path.join(APP_ROOT, "index.html"), "utf8");
const guide = (lang) => html.match(new RegExp(`<dialog\\b[^>]*id="guide-${lang}"[\\s\\S]*?</dialog>`))[0];
const text = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'");
for (const lang of ["en", "de"]) {
  const figs = S.figures(F, lang);
  const spans = [...guide(lang).matchAll(/<span data-fig="([^"]+)">([\s\S]*?)<\/span>/g)];
  const wrong = spans.filter(([, key, value]) => figs[key] !== text(value)).map(([, key, value]) => `${key}: "${text(value)}" ≠ "${figs[key]}"`);
  // The key figures' values in How it works and the talk track's figures must be among them.
  const keys = new Set(spans.map(([, key]) => key));
  const absent = ["duties", "merge", "stake", "removed", "target", "clustered", "report-cost", "sentences", "cases-words"].filter((k) => !keys.has(k));
  check(spans.length >= 30 && !wrong.length && !absent.length, `page: the ${spans.length} figures in the ${lang === "en" ? "English" : "German"} guide${wrong.length ? `; wrong: ${wrong.join("; ")}` : " equal the computed ones"}${absent.length ? `; missing: ${absent.join(", ")}` : ""}`);
}
const en = S.words(F, "en");
const de = S.words(F, "de");
const hints = [...html.matchAll(/<li class="vc-step" data-step="([^"]+)"[^>]*>[\s\S]*?<span class="step-name">([^<]+)<\/span><span class="vc-step__hint">([^<]+)<\/span>/g)];
check(hints.length === 5 && hints.every(([, id, name, hint]) => en.steps[id].label === name && en.steps[id].hint === hint.replace(/&nbsp;/g, " ")), `page: the five step buttons as js/story.js names them (${hints.map((h) => h[3]).join(", ")})`);
// Each tile as index.html writes it before any script runs: label, value (with its "of" part) and note.
const tile = (id) => {
  const m = html.match(new RegExp(`<button\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)</button>`));
  if (!m) return null;
  const part = (cls) => (m[1].match(new RegExp(`class="${cls}"[^>]*>([^<]*)<`)) || [])[1];
  return [part("vc-stat__label"), `${part("kpi-pre") ? `${part("kpi-pre")} ` : ""}${part("kpi-main")}${part("kpi-of") || ""}`, part("vc-stat__note kpi-note")].map((x) => (x || "").replace(/&nbsp;/g, " "));
};
const first = S.kpisAt(F, 0, null);
const want = [
  ["kpi-twice", en.kpi.twice.label, `${en.n(first.twice.value)} ${en.kpi.twice.of} ${en.n(first.twice.of)}`, en.kpi.twice.note],
  ["kpi-stake", en.kpi.stake.label, `${en.kpi.stake.upTo} ${en.money(first.stake.value)}`, en.kpi.stake.pending],
  ["kpi-cut", en.kpi.cut.label, `${en.n(first.cut.value)} ${en.kpi.cut.of} ${en.n(first.cut.of)}`, en.kpi.cut.note]
];
check(want.every(([id, ...vals]) => JSON.stringify(tile(id)) === JSON.stringify(vals)), `page: the key figures start as the first step shows them, answering first (${want.map((w) => `${w[1]} ${w[2]}`).join(", ")})`);
check(want.some(([, , value]) => /[1-9]/.test(value.split(/ of /)[0])), "page: not every key figure starts at zero");
const kpiNames = [...html.matchAll(/data-vc-kpi="([^"]+)" data-vc-kpi-de="([^"]+)"/g)].map((m) => [m[1], m[2]]);
check(JSON.stringify(kpiNames) === JSON.stringify([[en.kpi.twice.label, de.kpi.twice.label], [en.kpi.stake.label, de.kpi.stake.label], [en.kpi.cut.label, de.kpi.cut.label]]), `page: the key figures carry their names in both languages (${kpiNames.map((x) => x.join(" / ")).join(", ")})`);
check(html.includes(`<h2 class="story-title" id="story-title">${en.steps.target.title}</h2>`) && html.includes(`<p class="stage-meta" id="stage-meta">${S.asText(en.evidence.meta)}</p>`) && html.includes(`<h2 id="stage-title">${S.asText(en.evidence.stage)}</h2>`), "page: the first step's title and the law map's heading are written in as js/story.js words them");

// Every sentence the steps say, in both languages, is whole: no hole where a figure belongs.
const strings = (x) => (typeof x === "string" ? [x] : typeof x === "function" ? [] : x && typeof x === "object" ? Object.values(x).flatMap(strings) : []);
for (const [lang, w] of [["en", en], ["de", de]]) {
  const all = [...strings(w.steps), ...strings(w.decided), ...strings(w.ask), ...strings(w.kpi), ...strings(w.evidence), ...w.evidence.chips(D.cluster.members[0]), ...D.cluster.members.map(w.evidence.law), ...Object.keys(S.REASONS).map(w.evidence.reason), ...D.norms.flatMap((n) => [0, 1, 2, 3, 4].map((i) => w.relation(n, i)))].map(S.asText);
  const holes = all.filter((s) => /undefined|NaN|null|\[object|\{\{/.test(s));
  const figs = S.figures(F, lang);
  check(all.length > 60 && !holes.length && w.steps.prices.title.includes(figs.merge) && w.decided.merge.title.includes(figs.merge) && w.decided.merge.text.includes(figs.target) && w.steps.reads.title.includes(figs.sentences), `page: the ${all.length} ${lang === "en" ? "English" : "German"} sentences and labels are whole and carry the computed figures${holes.length ? `; holes: ${holes.slice(0, 3).join(" | ")}` : ""}`);
}

// ---- the docs --------------------------------------------------------------------------------------
// The documents state the run's figures as the page does: every euro in them is a computed one, the
// README's table of the three key figures carries the computed counts, and the demo script's talk
// track is the guide's, line by line, in both languages.
const DOCS = ["README.md", "DEMO_SCRIPT.md", "DESIGN.md", "DATA_SOURCES.md"];
const plain = (s) => String(s).replace(/ /g, " ");
const doc = (f) => plain(readFileSync(path.join(APP_ROOT, f), "utf8"));
const computed = new Set(["en", "de"].flatMap((lang) => [...Object.values(S.figures(F, lang)), S.words(F, lang).money(0)]).map(plain));
const moneyIn = (s) => [...s.matchAll(/€\d[\d,]*(?:\.\d+)?m?|\b\d[\d.]*(?:,\d+)? (?:Mio\. )?€/g)].map((m) => m[0]);
check(moneyIn("Merge €4.07m, plus €250,000 once; 4,07 Mio. € und 250.000 €").length === 4, "docs: control: the euro pattern finds amounts in both languages' formats");
const stray = DOCS.flatMap((f) => moneyIn(doc(f)).filter((v) => !computed.has(v)).map((v) => `${f}: ${v}`));
const amounts = DOCS.reduce((n, f) => n + moneyIn(doc(f)).length, 0);
check(amounts >= 20 && !stray.length, `docs: the ${amounts} euro amounts in the four documents are all computed ones${stray.length ? `; not computed: ${stray.join(", ")}` : ""}`);
const fe = S.figures(F, "en");
const claims = [
  `${fe.clustered} of ${fe.duties} duties in ${fe.laws} laws sit in ${fe.clusters} clusters`,
  `Merge up to ${fe.merge}; register lookup ${fe.register} net (businesses save ${fe["register-businesses"]}, the administration spends ${fe["register-admin"]}, plus ${fe["one-off"]} once)`,
  `A third of ${fe.reporting} is ${fe.target}; one approval cuts ${fe.removed}`
].map(plain);
const missing = claims.filter((c) => !doc("README.md").includes(c));
check(!missing.length, `docs: the README's table of the three key figures carries the computed figures${missing.length ? `; missing: ${missing.join(" | ")}` : ""}`);
const unquote = (s) => plain(s).replace(/[“”„"]/g, "").replace(/\s+/g, " ").trim();
for (const [lang, heading] of [["en", "## Talk track"], ["de", "## Gesprächsleitfaden"]]) {
  const figs = S.figures(F, lang);
  // A line may carry a figure in its action too ("open “745 duties”"): the figures go in first.
  const filled = guide(lang).replace(/<span data-fig="([^"]+)">[^<]*<\/span>/g, (_, key) => figs[key]);
  const fromGuide = [...filled.matchAll(/<li><strong>([^<]+)<\/strong> <span class="vc-guide__say">([^<]*)<\/span> <span class="vc-guide__time">/g)]
    .map(([, strong, say]) => ({ strong: unquote(text(strong)), say: unquote(text(say)) }));
  const section = doc("DEMO_SCRIPT.md").split(heading)[1].split("\n## ")[0];
  const rows = [...section.matchAll(/^\| (\d) ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$/gm)].map(([, , name, act, say]) => ({ strong: unquote(`${name}: ${act}`), say: unquote(say) }));
  const off = fromGuide.map((g, i) => [g, rows[i]]).filter(([g, r]) => !r || g.strong.toLowerCase() !== r.strong.toLowerCase() || g.say !== r.say).map(([g, r]) => `guide "${g.strong} ${g.say}" ≠ script "${r ? `${r.strong} ${r.say}` : "nothing"}"`);
  check(fromGuide.length === 5 && rows.length === 5 && !off.length, `docs: DEMO_SCRIPT.md's ${lang === "en" ? "English" : "German"} talk track is the guide's, line by line${off.length ? `; ${off.join("; ")}` : ""}`);
}

let failed = 0;
for (const [ok, what] of results) { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failed += 1; }
if (failed) { console.log(`\n${failed} of ${results.length} checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed.\nFIGURES OK`);
