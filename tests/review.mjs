// The record of the reviews in REVIEW.md (DR-08). Node.js only.
//   cold read   for each question asked (q1 to q8, tile, price; all by default) the record holds the
//               question, the expected answer and the answer given from screenshots alone, in English and
//               in German; each pair matches, and each given answer carries the facts the screens state
//               (figures from data/story.js and the inventory, the words for what is assumed)
//   partner     "partner": the partner review's verdict is ready, with its One Thing, cut list, fix list and
//               keep list
//   names       the record names no one
// Usage: node tests/review.mjs [q1 … q8 tile price partner]
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";
import { D, I, F, checks } from "./lib/app.mjs";

const { check, finish } = checks();
const file = path.join(APP_ROOT, "REVIEW.md");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const QUESTIONS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "tile", "price"];
const asked = args.filter((a) => a !== "partner");
const want = asked.length || !args.includes("partner") ? (asked.length ? asked : QUESTIONS) : [];
const unknown = asked.filter((a) => !QUESTIONS.includes(a));
check(!unknown.length, `known questions${unknown.length ? `; unknown: ${unknown.join(", ")}` : ""}`);
if (!existsSync(file)) { check(false, "REVIEW.md exists"); finish("COLD READ MATCHES"); }
const text = readFileSync(file, "utf8");
const n = (x, lang) => new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB").format(x);

// What each given answer must say, as the screens state it.
const price = I.duties.filter((d) => d.law === "preisstatg").map((d) => d.section);
const FACTS = {
  q1: { en: [/dut(y|ies)/i, /relief|sav/i, /person|human/i], de: [/Pflicht/, /Entlast|spar/i, /Mensch|Person/] },
  q2: { en: [/reporting dut/i, /cluster/i, /type/i], de: [/Meldepflicht/, /Bündel/, /Art/] },
  q3: { en: [new RegExp(n(F.laws, "en")), new RegExp(n(F.duties, "en")), new RegExp(`\\b${n(F.clusters, "en")}\\b`)], de: [new RegExp(n(F.laws, "de")), new RegExp(n(F.duties, "de").replace(".", "\\.")), new RegExp(`\\b${n(F.clusters, "de")}\\b`)] },
  q4: { en: [/§\s*11/, /§\s*9/, /assum|not (shown|certain|known)/i], de: [/§\s*11/, /§\s*9/, /angenommen|nicht (belegt|sicher|bekannt)/i] },
  // "10 min", "10-minute" and "10-min-Meldung" all state the minutes.
  q5: { en: [/10[\s-]min/i, /38\.60/, /0\.50/, /assum/i, new RegExp(n(F.businesses, "en"))], de: [/10[\s-]min/i, /38,60/, /0,50/, /angenommen/i, new RegExp(n(F.businesses, "de").replace(".", "\\."))] },
  q6: { en: [new RegExp(n(F.businesses, "en")), /assum|at most|up to|not known/i, /business/i], de: [new RegExp(n(F.businesses, "de").replace(".", "\\.")), /angenommen|höchstens|bis zu|nicht bekannt/i, /Unternehmen|Betriebe/] },
  q7: { en: [/approv/i, new RegExp(n(F.target, "en")), /nothing is sent|not sent|dossier/i], de: [/freig/i, new RegExp(n(F.target, "de")), /nichts wird versendet|nicht versendet|Dossier/i] },
  q8: { en: [/real/i, /assum/i, /simulat|replay/i], de: [/echt/i, /angenommen/i, /simul|nachgespielt/i] },
  tile: { en: [/dut(y|ies)/i, /law/i], de: [/Pflicht/, /Vorschrift/] },
  price: { en: [/§/], de: [/§/] }
};
/** The question's section: its rows by language, with expected and given answers and the verdict. */
const section = (id) => {
  const m = text.match(new RegExp(`^### ${id}: (.+)$([\\s\\S]*?)(?=^### |^## |(?![\\s\\S]))`, "m"));
  if (!m) return null;
  const rows = [...m[2].matchAll(/^\| (English|German|Deutsch) \| (.+?) \| (.+?) \| (yes|no) \|$/gm)].map(([, lang, expected, given, match]) => ({ lang: lang === "English" ? "en" : "de", expected, given, match }));
  return { question: m[1], rows };
};
for (const id of want.filter((x) => QUESTIONS.includes(x))) {
  const s = section(id);
  if (!s) { check(false, `${id}: REVIEW.md holds the question`); continue; }
  const off = [];
  for (const lang of ["en", "de"]) {
    const r = s.rows.find((x) => x.lang === lang);
    if (!r) { off.push(`no ${lang} row`); continue; }
    if (r.match !== "yes") off.push(`${lang}: no match`);
    const facts = id === "price" ? [...FACTS.price[lang], ...[new RegExp(price.map((p) => p.replace(/[§ ]/g, "")).join("|"))]] : FACTS[id][lang];
    const missing = facts.filter((re) => !re.test(r.given) || !re.test(r.expected));
    if (missing.length) off.push(`${lang}: the answers don't state ${missing.map((re) => re.source).join(", ")}`);
    if (id === "price") {
      // Two duties may share a section (three of the law's nine are in § 3), so each mention counts.
      const named = [...r.given.matchAll(/§\s*(\d+[a-z]?)/g)].map((m) => `§ ${m[1]}`).filter((sec) => price.includes(sec));
      if (named.length < 2) off.push(`${lang}: names ${named.length} duties of the price statistics law`);
    }
  }
  check(!off.length, `${id}: "${s.question}" answered from the screens as expected, in English and German${off.length ? `; ${off.join("; ")}` : ""}`);
}
// The names the record must not hold are kept as SHA-256 hashes of the lower-case word, so this file names
// no one either. The last hash is a made-up word, planted below to prove the check catches a name.
const NAMES = new Set([
  "99bde068af2d49ed7fc8b8fa79abe13a6059e0db320bb73459fd96624bb4b33f", "cc8b16c658c641b07b57fde347e3809852b2d11198a95d7ee28c3dc75ee2c78e",
  "562f1a5e120b7136ea45002ef474983dc44977b676c3631590f1185c297aa7dd", "5a1fb158140f45023cb0b6bc651cd6af1e1a7b6f6b60fe8651739b713a6be89c",
  "ecddf9a511a725f5f825c3862aecdaf89ae4da175ff834fe0a7e2ac8fe01efa0", "006a0769fd309a0df754ccd7b4e48e5b658406aec03b6db72fdf487a6d016e8c"
]);
const namesIn = (s) => [...new Set(s.normalize("NFC").match(/\p{L}[\p{L}\p{M}]*/gu) || [])].filter((w) => NAMES.has(createHash("sha256").update(w.toLowerCase()).digest("hex")));
const handles = (s) => s.match(/@[\w.-]+\.\w+/g) || [];
check(namesIn("Read by Zyxwvut, then by the team.").length === 1 && !namesIn("Read by the agent, then by the team.").length && handles("mail a@b.de").length === 1, "names: control: a planted name and a planted address are caught, an ordinary sentence passes");
const anyone = [...namesIn(text), ...handles(text)];
check(!anyone.length, `names: REVIEW.md names no one${anyone.length ? `; found ${anyone.length} name(s) or address(es)` : ""}`);
if (want.length) finish(`COLD READ MATCHES (${want.join(", ")})`);
if (args.includes("partner")) {
  const p = (text.match(/^## Partner review$([\s\S]*?)(?=^## |(?![\s\S]))/m) || [])[1] || "";
  const parts = { verdict: /^Verdict: ready\b/m.test(p), one: /^One Thing: \S/m.test(p), cut: /^### Cut list$/m.test(p), fix: /^### Fix list$/m.test(p), keep: /^### Keep list$/m.test(p) };
  check(Object.values(parts).every(Boolean), `partner: the verdict is ready, with its One Thing, cut list, fix list and keep list${Object.values(parts).every(Boolean) ? "" : `; missing: ${Object.entries(parts).filter(([, v]) => !v).map(([k]) => k).join(", ")}`}`);
  finish("PARTNER REVIEW READY");
}
