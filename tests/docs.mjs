// The documents describe 2.2.0 (DR-09). Node.js only.
//   questions   DEMO_SCRIPT.md answers the six questions the domain review raised, in English and German,
//               each with a short answer that carries the figures js/story.js computes
//   readme      README.md names version 2.2.0 and what it adds: the ladder, the law map in words, the lists
//               behind every count, the comparison, the derivation, the calibration
//   design      DESIGN.md no longer says the law names show on hover, and records the count that opens what it
//               counts, the ladder and the colours of a highlight and a selection
//   sources     DATA_SOURCES.md records each public source of the calibration with its date and what it
//               changed, and a host it couldn't reach as not probed
// Usage: node tests/docs.mjs
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";
import { D, F, W, norm, checks } from "./lib/app.mjs";

const { check, finish } = checks();
const read = (f) => (existsSync(path.join(APP_ROOT, f)) ? readFileSync(path.join(APP_ROOT, f), "utf8") : "");
const n = (x, lang) => new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB").format(x);

// ---- DEMO_SCRIPT.md: the six questions --------------------------------------------------------------------------
const script = read("DEMO_SCRIPT.md");
const QUESTIONS = {
  en: [
    [/Is a cluster the same as a law\?/, [/cluster/i, /two laws|duties/i]],
    [/How were the 31 laws chosen\?/, [/by hand|chosen/i, /five topic areas/i]],
    [/What is the difference between a duty and a reporting duty\?/, [/type/i, /third/i]],
    [/Do the same businesses really file both reports\?/, [/assum|not shown/i, new RegExp(n(F.businesses, "en"))]],
    [/Where do the 10 minutes come from, and why 12 after merging\?/, [/Destatis|guide/i, /3 \+ 2 \+ 3 \+ 1 \+ 1/, /1 (item )?of 5|one item of five|4 of 5|4\/5/i]],
    [/Is this an AI estimate\?/, [/\bno\b/i, /federal (compliance-cost )?method|cost method/i]]
  ],
  de: [
    [/Ist ein Bündel dasselbe wie eine Vorschrift\?/, [/Bündel/, /zwei Vorschriften|Pflichten/]],
    [/Wie wurden die 31 Vorschriften ausgewählt\?/, [/von Hand|gewählt/i, /fünf Themen/i]],
    [/Was unterscheidet eine Pflicht von einer Meldepflicht\?/, [/Art/, /Drittel/]],
    [/Geben wirklich dieselben Unternehmen beide Meldungen ab\?/, [/angenommen|nicht belegt/i, new RegExp(n(F.businesses, "de").replace(".", "\\."))]],
    [/Woher kommen die 10 Minuten, und warum 12 nach dem Zusammenlegen\?/, [/Destatis|Leitfaden/i, /3 \+ 2 \+ 3 \+ 1 \+ 1/, /1 (Angabe )?von 5|eine von fünf|4 von 5|4\/5/i]],
    [/Ist das eine KI-Schätzung\?/, [/\bnein\b/i, /Methode|Leitfaden/i]]
  ]
};
for (const [lang, heading] of [["en", "## Questions from the review"], ["de", "## Fragen aus dem Review"]]) {
  const part = script.split(heading)[1]?.split("\n## ")[0] || "";
  const off = [];
  for (const [q, facts] of QUESTIONS[lang]) {
    const m = part.match(new RegExp(`\\*\\*${q.source}\\*\\*([^\\n]*(?:\\n(?!\\*\\*)[^\\n]+)*)`));
    if (!m) { off.push(`no "${q.source.replace(/\\/g, "")}"`); continue; }
    const missing = facts.filter((re) => !re.test(m[1]));
    if (missing.length || norm(m[1]).split(" ").length > 80) off.push(`"${q.source.replace(/\\/g, "").slice(0, 40)}": ${missing.length ? `doesn't say ${missing.map((re) => re.source).join(", ")}` : "longer than 80 words"}`);
  }
  check(part && !off.length, `questions: DEMO_SCRIPT.md answers the six questions from the review in ${lang === "en" ? "English" : "German"}, each in short${off.length ? `; ${off.join("; ")}` : ""}`);
}
const flat = (x) => String(x).replace(/\u00a0/g, " ");
check(flat(script).includes(flat(W.en.money(F.merge))) && flat(script).includes(flat(W.de.money(F.merge))), `questions: the script states the relief at stake as the page does (${flat(W.en.money(F.merge))}, ${flat(W.de.money(F.merge))})`);

// ---- README.md -----------------------------------------------------------------------------------------------
const readme = read("README.md");
const adds = [/2\.2\.0/, /ladder/i, /names? (each|every) law|in words/i, /every count opens|opens (the )?list|opens what it counts/i, /comparison|compare/i, /derivation|where (does|each) (this )?figure come from/i, /calibrat/i];
const missingReadme = adds.filter((re) => !re.test(readme));
check(!missingReadme.length, `readme: README.md describes 2.2.0: the ladder, the laws in words, the lists behind every count, the comparison, the derivation and the calibration${missingReadme.length ? `; missing: ${missingReadme.map((re) => re.source).join(", ")}` : ""}`);

// ---- DESIGN.md -----------------------------------------------------------------------------------------------
const design = read("DESIGN.md");
check(!/show on hover|on hover only|shows? on hover/i.test(design) && /count/i.test(design) && /ladder/i.test(design) && /highlight/i.test(design) && /2\.2\.0/.test(design), "design: DESIGN.md no longer puts a law's name on hover and records the counts that open their lists, the ladder and the highlight, for 2.2.0");

// ---- DATA_SOURCES.md -----------------------------------------------------------------------------------------
const sources = read("DATA_SOURCES.md");
const c = D.calibration;
const facts = [
  c.production.url, c.trade.url, /OnDEA[\s\S]{0,200}not probed/i, /27 November 2026/,
  new RegExp(n(c.production.sites, "en")), new RegExp(n(c.trade.count, "en")), new RegExp(n(c.before.businesses, "en")),
  W.en.money(c.before.merge), W.en.money(F.merge)
];
const missingSources = facts.filter((f) => (typeof f === "string" ? !sources.includes(f) : !f.test(sources)));
check(!missingSources.length && /2\.2\.0/.test(sources), `sources: DATA_SOURCES.md records each public source of the calibration with its date, what changed (${W.en.money(c.before.merge)} → up to ${W.en.money(F.merge)}) and OnDEA as not probed${missingSources.length ? `; missing: ${missingSources.map(String).join(", ")}` : ""}`);
finish("DOCS OK");
