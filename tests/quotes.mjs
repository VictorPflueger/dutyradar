// Every law quote on the comparison (DR-05) and every sentence of the priced duties, verbatim in release
// 1.0.0's snapshot of the law (data/corpus/ at commit 7377619, retrieved 19 November 2026): the text of
// its section, character for character. Node.js only.
//   quotes    each quote of data/story.js's comparison occurs in its section's text in 1.0.0's corpus
//   sections  each quote's section, short title and link are the corpus's for that section
//   members   the two priced duties' sentences occur in their sections
//   page      the comparison's words (js/explain.js) quote nothing of their own: every German line they show
//             as law is one of these quotes
// It needs a checkout of 1.0.0 (DR_LEGACY or ../dutyradar-1.0.0); without one it says so and passes,
// unless --require-legacy is given.
// Usage: node tests/quotes.mjs [--require-legacy]
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";
import { D, X, F, checks } from "./lib/app.mjs";

const { check, finish } = checks();
const legacy = [process.env.DR_LEGACY, path.resolve(APP_ROOT, "..", "dutyradar-1.0.0")].filter(Boolean).find((d) => existsSync(path.join(d, "data", "corpus")));
if (!legacy) {
  const required = process.argv.includes("--require-legacy");
  console.log(`${required ? "FAIL" : "SKIP"}  no checkout of 1.0.0 with data/corpus/ in DR_LEGACY or at ../dutyradar-1.0.0: the quotes were not checked`);
  process.exit(required ? 1 : 0);
}
const corpus = (law) => JSON.parse(readFileSync(path.join(legacy, "data", "corpus", `${law}.json`), "utf8"));
const paragraph = (id) => corpus(id.slice(0, id.lastIndexOf("-p"))).paragraphs.find((p) => p.id === id);

// The comparison holds quotes for both laws: who must report, what is asked, how often, to whom, the duty.
const quotes = Object.entries(D.compare || {}).flatMap(([law, c]) => [...c.who, ...c.what, ...c.when, ...c.whom, c.duty].map((q) => ({ law, ...q })));
check(quotes.length >= 10 && Object.keys(D.compare).sort().join() === D.cluster.members.map((m) => m.norm).sort().join(), `quotes: the comparison quotes both laws of the priced cluster (${quotes.length} quotes)`);
check(paragraph("hdldlstatg-p3")?.text.includes("Erhebungseinheiten") && !paragraph("hdldlstatg-p3").text.includes("(1) Erhebungseinheiten sind natürliche Personen"), "control: a quote that isn't in its section would be caught");
const missing = quotes.filter((q) => { const p = paragraph(q.paragraph); return !p || !p.text.includes(q.text); });
check(!missing.length, `quotes: every quote occurs verbatim in 1.0.0's corpus text of its section${missing.length ? `; not: ${missing.map((q) => q.id).join(", ")}` : ""}`);
const misplaced = quotes.filter((q) => { const p = paragraph(q.paragraph); const law = corpus(q.law); return !p || p.enbez !== q.section || law.abbr !== q.abbr || p.html_url !== q.url; });
check(!misplaced.length, `sections: each quote names its section, short title and link as the corpus does${misplaced.length ? `; off: ${misplaced.map((q) => q.id).join(", ")}` : ""}`);
check(new Set(quotes.map((q) => q.id)).size === quotes.length && quotes.every((q) => /^[ab]-[a-z]+$/.test(q.id)), "quotes: every quote has an id of its own, A for the first law, B for the second");
const members = D.cluster.members.filter((m) => { const pid = `${m.norm}-p${m.section.replace(/^§\s*/, "")}`; const p = paragraph(pid); return !p || !p.text.includes(m.sentence) || p.html_url !== m.url; });
check(!members.length, `members: both priced duties' sentences occur in their sections (${D.cluster.members.map((m) => `${m.section} ${m.abbr}`).join(", ")})`);
// The comparison's words quote only these: every German law line they carry is one of the quotes.
if (X) {
  for (const lang of ["en", "de"]) {
    const cmp = X.explain(F, lang).compare;
    const shown = cmp.rows.flatMap((r) => r.cells.flatMap((cell) => cell.quotes || []));
    const foreign = shown.filter((q) => !quotes.some((x) => x.id === q.id && x.text === q.text));
    const lines = cmp.rows.flatMap((r) => r.cells.flatMap((cell) => (cell.quotes || []).map((q) => q.en)));
    check(shown.length >= 8 && !foreign.length && (lang === "de" || lines.every((l) => l && l.length > 12)), `page: the ${lang === "en" ? "English" : "German"} comparison shows ${shown.length} quotes, all from the corpus${lang === "en" ? ", each with an English line" : ""}${foreign.length ? `; foreign: ${foreign.map((q) => q.id).join(", ")}` : ""}`);
  }
} else check(false, "page: js/explain.js words the comparison");
finish("QUOTES VERBATIM");
