// Repository hygiene for a public prototype: no file the repository would publish contains a term
// from a private list kept outside the repository, and no file carries an e-mail address.
// The private term list never enters the repository, in any form. It is read from, in order:
//   HYGIENE_TERMS        environment variable (a CI secret), one entry per line
//   HYGIENE_TERMS_FILE   environment variable naming a file
//   ../.hygiene-terms    a file next to the repository folder
// One entry per line: "term<TAB>what it is" or "/regex/flags<TAB>what it is"; lines starting with #
// are comments. A term matches case-insensitively from the start of a word, with up to three more
// letters (an inflection: "Term", "Terms", "Termen") and with any run of spaces, line breaks and
// comment marks between its words, so a phrase split across lines of a comment is found too. Without a
// list only the generic checks run, and the result says so ("HYGIENE GENERIC OK" instead of
// "HYGIENE OK"). The matcher checks itself first on made-up terms.
// Checks every file git would publish: tracked files and untracked files that are not ignored.
// Usage: node tests/hygiene.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

function privateList() {
  if (process.env.HYGIENE_TERMS) return { text: process.env.HYGIENE_TERMS, from: "HYGIENE_TERMS" };
  const file = process.env.HYGIENE_TERMS_FILE || path.join(APP_ROOT, "..", ".hygiene-terms");
  if (fs.existsSync(file)) return { text: fs.readFileSync(file, "utf8"), from: file };
  return null;
}
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A term's pattern: from a word's start, its words joined by any spaces, line breaks or comment marks,
    up to three letters of inflection after it. */
const termRe = (term) => new RegExp(`(?<![\\p{L}\\p{N}])${term.trim().split(/\s+/).map(escape).join("(?:[\\s/#*>|]+)")}\\p{L}{0,3}(?![\\p{L}])`, "giu");
const parse = (text) => text.split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [term, what = "a private term"] = l.split("\t");
    const m = term.match(/^\/(.+)\/([a-z]*)$/);
    return { re: m ? new RegExp(m[1], m[2].includes("g") ? m[2] : `${m[2]}g`) : termRe(term), what };
  });
// The matcher's own controls, on made-up terms.
{
  const [quux] = parse("Quuxwald Ministerium\tmade up");
  const hits = (text) => [...text.matchAll(quux.re)].length;
  const controls = [
    [hits("the Quuxwald Ministerium said"), 1, "the phrase"],
    [hits("// the Quuxwald\n// Ministerium said"), 1, "the phrase across lines of a comment"],
    [hits("des Quuxwald Ministeriums"), 1, "an inflected form"],
    [hits("QUUXWALD  MINISTERIUM"), 1, "another case and two spaces"],
    [hits("Quuxwald Ministeriumsgebäude"), 0, "a longer compound"],
    [hits("XQuuxwald Ministerium"), 0, "inside another word"]
  ];
  const bad = controls.filter(([got, want]) => got !== want);
  if (bad.length) { for (const [, , what] of bad) console.log(`FAIL the matcher control: ${what}`); process.exit(1); }
}
const list = privateList();
const TERMS = list ? parse(list.text) : [];
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g; // not "playwright@1.56.0"
const ALLOWED_EMAIL = new Set([]);
const BINARY = /\.(woff2|png|jpe?g|gif|ico|pdf)$/i;

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: APP_ROOT, encoding: "utf8" })
  .split("\n").filter(Boolean).filter((f) => !BINARY.test(f) && fs.existsSync(path.join(APP_ROOT, f)));

const problems = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(APP_ROOT, f), "utf8");
  for (const { re, what } of TERMS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) problems.push(`${f}:${text.slice(0, m.index).split("\n").length} names ${what}`);
  }
  for (const m of text.matchAll(EMAIL)) {
    if (ALLOWED_EMAIL.has(m[0].toLowerCase())) continue;
    const line = text.slice(0, m.index).split("\n").length;
    problems.push(`${f}:${line} carries an e-mail address`);
  }
}

for (const p of problems) console.log(`FAIL  ${p}`);
console.log(`${files.length} files checked against ${list ? `${TERMS.length} private terms (${list.from === "HYGIENE_TERMS" ? "from HYGIENE_TERMS" : "from a file outside the repository"}) and` : "no private term list, only"} the generic checks: ${problems.length} problem${problems.length === 1 ? "" : "s"}.`);
if (!problems.length) console.log(list && TERMS.length ? "HYGIENE OK" : "HYGIENE GENERIC OK");
process.exit(problems.length ? 1 : 0);
