// Fact auditor: no number reaches the screen without a source (pure).
//
// Rules (the specification's review section, with the brief's English additions):
// 2. Numbers in model text only inside {{fact:ID}} placeholders whose ids exist in the run's registry.
//    A digit is any Unicode number character, fractions such as ⅓ included.
// 3. Bare digits are allowed only in: § and Art. references that match a paragraph cited with
//    {{cite:…}} in the same text; "Absatz", "Satz", "Nummer" (in English also "subsection",
//    "sentence", "number", "no.") references directly after such a citation; German quotes „…“ that
//    appear verbatim in a cited paragraph; ISO dates of the snapshot; reason codes; and the ids of
//    duties, clusters, options, facts, complaints, decisions and runs. An id has its exact shape and
//    names something the run holds, so a number dressed as an id ("O-1500000", "DEC-2026") is a number.
// 4. Number words count as numbers, except inside verbatim quotes. German text is checked against the
//    German list, English text against the English list and the German one. German compounds of
//    number words count too ("zweihundert", "fünfundzwanzig", "Hunderttausende", "zweimal",
//    "Dutzende"); "einmal", "einfach", "vierteljährlich" and "außer Acht" do not.
// 6. A sentence that names a duty or a cluster must cite one of its paragraphs; an unknown cite, duty,
//    cluster or complaint id is a violation.
// Each violation carries the offending token and an English message for the model.

import { splitSentences } from "./sentences.js";

const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";

// German number words: the specification's list (zwei to zwölf, zwanzig, hundert, tausend, Million,
// Milliarde, Mio., Mrd., Prozent, Hälfte, Drittel, Viertel, with inflected forms), plus the teens and
// tens (TECH_NOTES §7). Whole words only, so "vierteljährlich" passes.
const DE_WORDS = [
  "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf",
  "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn",
  "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig",
  "hundert", "hunderte", "hunderten", "tausend", "tausende", "tausenden",
  "million", "millionen", "milliarde", "milliarden", "prozent",
  "hälfte", "hälften", "drittel", "dritteln", "drittels", "viertel", "vierteln", "viertels"
];
const DE_RE = new RegExp(`${B}(?:${DE_WORDS.join("|")})${E}|${B}(?:Mio|Mrd)\\.`, "giu");

// German compounds: a word made only of number morphemes, with an optional suffix ("mal", "fach", an
// inflection). "ein", "eins" and "und" join a compound but make none on their own ("einmal",
// "einfach"), and "und" only joins; an inflection follows only the words that take one as numbers
// ("Hunderte", "Tausenden", "Dutzende"), so "achten" (to heed) and "elfen" stay words.
const DE_MORPHS = [
  "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn",
  "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig",
  "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf",
  "hundert", "tausend", "millionen", "million", "milliarden", "milliarde", "dutzend", "eins", "ein", "und"
];
const DE_JOINERS = new Set(["ein", "eins", "und"]);
const DE_INFLECTED = new Set(["hundert", "tausend", "dutzend", "million", "millionen", "milliarde", "milliarden"]);
const DE_SUFFIX_RE = /^(?:mal(?:ig(?:e|en|er|es)?)?|fach(?:e|en|er|es)?|prozentig(?:e|en|er|es)?|e|en|er|es|n|s)$/u;
const DE_INFLECTION_RE = /^(?:e|en|er|es|n|s)$/u;
const WORD_RE = /(?<![\p{L}\p{N}])\p{L}+(?![\p{L}\p{N}])/gu;

/** The morphemes and suffix of a German number compound, or null. */
export function deCompound(word) {
  const w = String(word).toLocaleLowerCase("de-DE");
  const walk = (at, morphs) => {
    if (at === w.length) return morphs.length ? { morphs, suffix: "" } : null;
    for (const m of DE_MORPHS) {
      if (!w.startsWith(m, at)) continue;
      const r = walk(at + m.length, [...morphs, m]);
      if (r) return r;
    }
    if (morphs.length && DE_SUFFIX_RE.test(w.slice(at))) return { morphs, suffix: w.slice(at) };
    return null;
  };
  const r = walk(0, []);
  if (!r || r.morphs.every((m) => DE_JOINERS.has(m))) return null;
  if (r.morphs[0] === "und" || r.morphs.at(-1) === "und") return null;
  if (DE_INFLECTION_RE.test(r.suffix) && !DE_INFLECTED.has(r.morphs.at(-1))) return null;
  return r;
}

// English number words (brief §5.4), plus the teens and tens.
const EN_BASE = [
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
  "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
  "hundred", "thousand", "million", "billion"
];
const EN_TENS_PLURAL = ["twenties", "thirties", "forties", "fifties", "sixties", "seventies", "eighties", "nineties"];
const SP = "[ \\u00A0]+";
const SPH = "[ \\u00A0-]+";
const EN_RE = new RegExp([
  `${B}(?:${EN_BASE.join("|")})s?${E}`,
  `${B}(?:${EN_BASE.join("|")})fold${E}`,
  `${B}(?:twice|thrice|dozens?)${E}`,
  `${B}(?:${EN_TENS_PLURAL.join("|")})${E}`,
  `${B}(?:bn|mn|percent)${E}`,
  `${B}per${SP}cent${E}`,
  `${B}halves${E}`,
  `${B}half(?![\\p{L}\\p{N}-])`,
  `${B}(?:thirds|quarters)${E}`
].join("|"), "giu");
const FRACTION_RE = new RegExp(`${B}(?:(?:a|one)${SPH}(?:third|quarter)|two${SPH}thirds|three${SPH}quarters)${E}`, "giu");
const FRACTION_EXCEPT_AFTER = new RegExp(`^${SPH}(?:party|parties|country|countries)${E}`, "iu");

// Option ids come first: they contain a duty id ("O-D-beispielg-p20-1-delete") or a cluster id
// ("O-C-001-a-merge"), then the option type.
const DUTY_ID = "D-[a-z0-9_-]+?-(?:p|art)[0-9]+[a-z]?-\\d+";
const CLUSTER_ID = "C-\\d{3}(?:-[a-z])?";
const ID_RES = [
  { kind: "option", re: new RegExp(`${B}O-(?:${CLUSTER_ID}|${DUTY_ID})-[a-z_]+${E}`, "gu") },
  { kind: "duty", re: new RegExp(`(?<![\\p{L}\\p{N}-])D-[a-z0-9_-]+?-(?:p|art)[0-9]+[a-z]?-\\d+${E}`, "gu") },
  { kind: "cluster", re: new RegExp(`(?<![\\p{L}\\p{N}-])C-\\d{3}(?:-[a-z])?${E}`, "gu") },
  { kind: "fact", re: new RegExp(`${B}F-\\d{4}${E}`, "gu") },
  { kind: "complaint", re: new RegExp(`${B}K-\\d{3}${E}`, "gu") },
  { kind: "decision", re: new RegExp(`${B}DEC-\\d{4}${E}`, "gu") },
  { kind: "run", re: new RegExp(`${B}R[1-3]${E}`, "gu") },
  { kind: "reason", re: new RegExp(`${B}(?:Z[1-5]|A[1-6]|I1)${E}`, "gu") }
];
const DIGITS_RE = /\p{N}+(?:[.,]\p{N}+)*/gu;
const PLACEHOLDER_RE = /\{\{(fact|cite):([^{}\s]*)\}\}/g;
const CHAIN_RE = /(?:[  ]+(?:Absatz|Satz|Nummer|subsection|sentence|number|no\.)[  ]+\d+[a-z]?)+/y;
const REF_RE = /(§§?|Art\.|Artikel)[  ]*(\d+[a-z]?)/g;
const QUOTE_RE = /„([^„“]*)“/g;
const DATE_RE = /(?<![\p{L}\p{N}])\d{4}-\d{2}-\d{2}(?![\p{L}\p{N}])/gu;

const has = (set, id) => Boolean(set && (typeof set.has === "function" ? set.has(id) : Object.prototype.hasOwnProperty.call(set, id)));
const get = (map, id) => (map ? (typeof map.get === "function" ? map.get(id) : map[id]) : undefined);
const squash = (s) => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

/** The kind and number of a paragraph's enbez: "§ 20" → p:20, "Art 4" → art:4. */
function refKey(enbez) {
  const s = squash(enbez);
  let m = s.match(/^§§?\s*(\d+[a-z]?)/i);
  if (m) return `p:${m[1].toLowerCase()}`;
  m = s.match(/^Art(?:ikel|\.)?\s*(\d+[a-z]?)/i);
  return m ? `art:${m[1].toLowerCase()}` : null;
}

const MESSAGES = {
  unknown_fact: (t) => `Unknown fact ${t}. Cite only fact ids that tools returned, as {{fact:ID}}.`,
  unknown_cite: (t) => `Unknown paragraph ${t}. Cite only paragraph ids that tools returned, as {{cite:ID}}.`,
  unknown_id: (t) => `Unknown id ${t}. Use only ids that tools returned.`,
  bare_number: (t) => `Bare number "${t}". Never write a number: cite it as {{fact:ID}}.`,
  number_word: (t) => `Number word "${t}". Never write a number, also not in words: cite it as {{fact:ID}}.`,
  uncited_reference: (t) => `The sentence names ${t} without citing one of its paragraphs. Add its {{cite:ID}}.`
};

/**
 * Audits a model text. ctx: { lang ("de" | "en"), facts (Set or registry with has), paragraphs
 * ({ id: { enbez, text } }), clusters ({ id: { paragraph_ids } }), duties ({ id: { paragraph_id } }),
 * complaints (Set), dates (Set of ISO dates) }. Returns { pass, violations: [{ rule, kind, token,
 * start, end, message }] } in text order.
 */
export function auditText(text, ctx = {}) {
  const s = String(text ?? "");
  const lang = ctx.lang === "de" ? "de" : "en";
  const masked = [];
  const violations = [];
  const mask = (start, end) => masked.push([start, end]);
  const isMasked = (start, end) => masked.some(([a, b]) => start < b && end > a);
  const violate = (rule, kind, token, start) => violations.push({ rule, kind, token, start, end: start + token.length, message: MESSAGES[kind](token) });

  // Placeholders, and the chain "Absatz 1 Satz 2" directly after a citation.
  const cited = new Set();
  for (const m of s.matchAll(PLACEHOLDER_RE)) {
    const [whole, kind, id] = m;
    mask(m.index, m.index + whole.length);
    if (kind === "fact") {
      if (!has(ctx.facts, id)) violate(2, "unknown_fact", id, m.index + whole.indexOf(id));
    } else if (!has(ctx.paragraphs, id)) violate(6, "unknown_cite", id, m.index + whole.indexOf(id));
    else {
      cited.add(id);
      CHAIN_RE.lastIndex = m.index + whole.length;
      const chain = CHAIN_RE.exec(s);
      if (chain) mask(chain.index, chain.index + chain[0].length);
    }
  }
  const citedParas = [...cited].map((id) => get(ctx.paragraphs, id)).filter(Boolean);
  const citedRefs = new Set(citedParas.map((p) => refKey(p.enbez)).filter(Boolean));

  // § and Art. references to a cited paragraph, with their chain.
  for (const m of s.matchAll(REF_RE)) {
    const key = `${m[1].startsWith("§") ? "p" : "art"}:${m[2].toLowerCase()}`;
    if (!citedRefs.has(key)) continue;
    let end = m.index + m[0].length;
    CHAIN_RE.lastIndex = end;
    const chain = CHAIN_RE.exec(s);
    if (chain) end = chain.index + chain[0].length;
    mask(m.index, end);
  }

  // German quotes that appear verbatim in a cited paragraph.
  const citedTexts = citedParas.map((p) => squash(p.text));
  for (const m of s.matchAll(QUOTE_RE)) {
    const inner = squash(m[1]);
    if (inner && citedTexts.some((t) => t.includes(inner))) mask(m.index, m.index + m[0].length);
  }

  // Snapshot dates, ids and reason codes.
  for (const m of s.matchAll(DATE_RE)) if (has(ctx.dates, m[0])) mask(m.index, m.index + m[0].length);
  const named = [];
  for (const { kind, re } of ID_RES) {
    for (const m of s.matchAll(re)) {
      if (isMasked(m.index, m.index + m[0].length)) continue;
      mask(m.index, m.index + m[0].length);
      // Options are checked when the run's options are given (a recording's texts name none); a
      // decision id must name a decision of the run.
      const known = kind === "duty" ? has(ctx.duties, m[0]) : kind === "cluster" ? has(ctx.clusters, m[0]) : kind === "complaint" ? has(ctx.complaints, m[0]) : kind === "fact" ? has(ctx.facts, m[0])
        : kind === "option" ? (ctx.options ? has(ctx.options, m[0]) : true) : kind === "decision" ? has(ctx.decisions, m[0]) : true;
      if (!known) violate(kind === "fact" ? 2 : 6, kind === "fact" ? "unknown_fact" : "unknown_id", m[0], m.index);
      else if (kind === "duty" || kind === "cluster") named.push({ kind, id: m[0], start: m.index });
    }
  }

  // Number words: fractions first (one token), then single words; overlaps keep the longest span.
  const words = [];
  for (const m of s.matchAll(FRACTION_RE)) {
    const after = s.slice(m.index + m[0].length);
    const before = s.slice(Math.max(0, m.index - 6), m.index);
    if (lang !== "en" || FRACTION_EXCEPT_AFTER.test(after) || (/^a/i.test(m[0]) && /once[  ]+$/i.test(before) && /quarter$/i.test(m[0]))) continue;
    words.push({ start: m.index, token: m[0] });
  }
  if (lang === "en") for (const m of s.matchAll(EN_RE)) words.push({ start: m.index, token: m[0] });
  const ausserAcht = (start, token) => /^acht$/i.test(token) && /außer[ \u00A0\u202F]+$/i.test(s.slice(Math.max(0, start - 8), start));
  for (const m of s.matchAll(DE_RE)) {
    if (ausserAcht(m.index, m[0])) continue;
    words.push({ start: m.index, token: m[0] });
  }
  for (const m of s.matchAll(WORD_RE)) {
    if (ausserAcht(m.index, m[0]) || !deCompound(m[0])) continue;
    words.push({ start: m.index, token: m[0] });
  }
  words.sort((a, b) => a.start - b.start || b.token.length - a.token.length);
  let reach = -1;
  for (const w of words) {
    const end = w.start + w.token.length;
    if (w.start < reach || isMasked(w.start, end)) continue;
    // Skip the shorter words inside a fraction ("two" in "two thirds").
    reach = end;
    violate(4, "number_word", w.token, w.start);
  }

  // Bare digits.
  for (const m of s.matchAll(DIGITS_RE)) if (!isMasked(m.index, m.index + m[0].length)) violate(2, "bare_number", m[0], m.index);

  // Rule 6: a sentence naming a duty or a cluster cites one of its paragraphs.
  if (named.length) {
    for (const sentence of splitSentences(s)) {
      const inside = named.filter((n) => n.start >= sentence.start && n.start < sentence.end);
      if (!inside.length) continue;
      const citesHere = new Set([...sentence.text.matchAll(PLACEHOLDER_RE)].filter((m) => m[1] === "cite").map((m) => m[2]));
      for (const n of inside) {
        const paras = n.kind === "duty" ? [get(ctx.duties, n.id)?.paragraph_id] : get(ctx.clusters, n.id)?.paragraph_ids || [];
        if (!paras.some((p) => citesHere.has(p))) violate(6, "uncited_reference", n.id, n.start);
      }
    }
  }

  violations.sort((a, b) => a.start - b.start);
  return { pass: violations.length === 0, violations };
}
