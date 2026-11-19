// Sentence splitter for law texts and model texts (pure; runs in the browser and under Node).
//
// A paragraph splits after ". " and "; " and at line ends, never after an abbreviation. The
// specification names Abs., Art., Nr., S., Satz, bzw., ggf., z. B., u. a., i. V. m., d. h., vgl. and
// Buchst.; the brief adds no., e.g., i.e. and cf. for English model text. Legal German needs a few
// more (TECH_NOTES §6): BGBl., ABl. (also written "ABI." and "ABL." in the source), Nrn., Halbs., Unterabs.,
// Abschn., Kap., Anh., Anl., lit., Ziff., gem., insb., bzgl., usw., sog., ff., ca., Mio., Mrd., evtl.,
// and every single letter that
// stands alone before a period (the parts of "z. B." or "i. V. m."). An ordinal number ends no
// sentence where it numbers a list item (at a line start or after a colon or semicolon) or a date
// ("1. Januar"). Only an ordinary space, a tab or a line end after the period or semicolon makes a
// boundary: the law snapshot ties each list number to its item with a no-break space (U+00A0), so a
// list stays inside its sentence (TECH_NOTES §5).
//
// Offsets index the original text: a sentence is { start, end, text } with end exclusive and the
// closing punctuation included.

const WORD_ABBR = ["Abs", "Art", "Nr", "Nrn", "S", "Satz", "bzw", "ggf", "vgl", "Buchst", "BGBl", "ABl", "ABI", "ABL", "Halbs", "Hs", "Unterabs", "Abschn", "Kap", "Anh", "Anl", "lit", "Ziff", "gem", "insb", "bzgl", "usw", "sog", "ff", "ca", "Mio", "Mrd", "evtl", "no", "No", "cf", "etc"];
const MONTHS = "Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
// Nouns an ordinal number stands before inside a phrase: "am 27. Tag", "des 50. Lebensjahres".
const ORDINAL_NOUNS = "Tag|Tages|Kalendertag|Kalendertages|Werktag|Werktages|Arbeitstag|Arbeitstages|Lebensjahr|Lebensjahres|Monat|Monats|Kalendermonat|Kalendermonats|Berichtsmonat|Berichtsmonats|Folgemonat|Folgemonats|Jahr|Jahres|Kalenderjahr|Kalenderjahres|Quartal|Quartals|Kalendervierteljahr|Kalendervierteljahres|Woche|Kalenderwoche|Stunde|Mal|Kapitel|Kapitels|Buch|Buches";
const BREAK = /[ \t\r\n]/;

/** The positions of periods (and semicolons) that never end a sentence, as a Set of indexes into `text`. */
export function maskedPeriods(text) {
  const masked = new Set();
  const add = (re, offsetInMatch) => {
    for (const m of text.matchAll(re)) masked.add(m.index + offsetInMatch(m));
  };
  // Word abbreviations: the whole word, not the end of a longer one ("Nr." but not "Kontrollnr.").
  const words = WORD_ABBR.map((w) => w.replace(".", "\\.")).join("|");
  add(new RegExp(`(?<![\\p{L}\\p{N}])(?:${words})\\.`, "gu"), (m) => m[0].length - 1);
  // English abbreviations with inner periods: e.g., i.e.
  add(/(?<![\p{L}\p{N}])(?:e\.g|i\.e)\./gu, (m) => m[0].length - 1);
  add(/(?<![\p{L}\p{N}])(?:e|i)\.(?=[gGeE]\.)/gu, () => 1);
  // A single letter standing alone before a period: z. B., u. a., i. V. m., d. h., e. V.
  add(/(?<![\p{L}\p{N}.])\p{L}\.(?=\s|$)/gu, () => 1);
  // Ordinals that number a list item or a day of a date.
  add(/(?:^|\n|[:;]\s*)(\d+[a-z]?)\.(?=\s)/gu, (m) => m[0].length - 1);
  add(new RegExp(`(?<![\\p{L}\\p{N}])\\d{1,2}\\.(?=\\s(?:${MONTHS})\\b)`, "gu"), (m) => m[0].length - 1);
  // An ordinal inside a phrase ("bis zum 15. Kalendertag") and any period before a lowercase word,
  // because no sentence starts with one ("bis zum 15. des Monats", "Ges. vom").
  add(new RegExp(`(?<![\\p{L}\\p{N}])\\d{1,3}\\.(?=[ \\u00A0](?:${ORDINAL_NOUNS})(?![\\p{L}\\p{N}]))`, "gu"), (m) => m[0].length - 1);
  add(/\.(?=[ \u00A0]+\p{Ll})/gu, () => 0);
  // A semicolon inside a citation of the EU's Official Journal: "S. 1; L 335 vom 20.12.2007".
  add(/;(?=\s+[LC]\s+\d+\s+vom\b)/gu, () => 0);
  return masked;
}

/** Splits `text` into sentences: [{ start, end, text }]. */
export function splitSentences(text) {
  const s = String(text ?? "");
  const masked = maskedPeriods(s);
  const out = [];
  let start = skipSpace(s, 0);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let cut = -1; // exclusive end of the sentence
    if (c === "\n") cut = i;
    else if ((c === "." || c === ";") && (i + 1 === s.length || BREAK.test(s[i + 1])) && !masked.has(i)) cut = i + 1;
    if (cut < 0) continue;
    const end = trimEnd(s, start, cut);
    if (end > start) out.push({ start, end, text: s.slice(start, end) });
    start = skipSpace(s, cut);
    i = Math.max(i, start - 1);
  }
  const end = trimEnd(s, start, s.length);
  if (end > start) out.push({ start, end, text: s.slice(start, end) });
  return out;
}

function skipSpace(s, i) {
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}

function trimEnd(s, start, end) {
  while (end > start && /\s/.test(s[end - 1])) end--;
  return end;
}
