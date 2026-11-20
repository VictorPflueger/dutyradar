// The documentation set is complete and consistent with the code:
//   - README, DESIGN, DEMO_SCRIPT, DATA_SOURCES, TECH_NOTES, REVIEW and tests/README exist, are
//     substantial and carry their required sections;
//   - every section the code cites ("TECH_NOTES §3", "DATA_SOURCES.md §4", "DESIGN.md §8") exists;
//   - every repository path a document names (in backticks or as a relative link) exists;
//   - the README links the live site.
// Usage: node tests/docs.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { APP_ROOT } from "./lib/harness.mjs";

const DOCS = {
  "README.md": { words: 900, sections: ["What it is", "How it works", "What is real, assumed or synthetic", "The law snapshot", "Measured recall", "Run it", "Tests", "Status", "Acceptance record", "Files"] },
  "DEMO_SCRIPT.md": { words: 1500, sections: ["Before the talk", "Checking the venue", "Talk track in English", "Gesprächsleitfaden auf Deutsch", "Offline fallback", "After the talk", "Questions and short answers", "Fragen und kurze Antworten"] },
  "DESIGN.md": { words: 450, numbered: 6 },
  "TECH_NOTES.md": { words: 1200, numbered: 8 },
  "DATA_SOURCES.md": { words: 450, numbered: 4 },
  "REVIEW.md": { words: 350, sections: ["Parity checklist", "Adapted shell modules"] },
  "SNAPSHOT.md": { words: 150 },
  "tests/README.md": { words: 250, sections: ["What runs", "Setup for the browser suites"] }
};
const LIVE_URL = "https://victorpflueger.github.io/dutyradar/";

const problems = [];
const text = {};
for (const [f, rule] of Object.entries(DOCS)) {
  const p = path.join(APP_ROOT, f);
  if (!fs.existsSync(p)) { problems.push(`${f} is missing`); continue; }
  const t = fs.readFileSync(p, "utf8");
  text[f] = t;
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words < rule.words) problems.push(`${f} has ${words} words (at least ${rule.words} expected)`);
  const heads = [...t.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1].trim());
  for (const s of rule.sections || []) if (!heads.some((h) => h.startsWith(s) || h.includes(s))) problems.push(`${f} lacks the section "${s}"`);
  if (rule.numbered) for (let n = 1; n <= rule.numbered; n++) if (!heads.some((h) => h.startsWith(`${n}. `))) problems.push(`${f} lacks section ${n}`);
}

// Sections the code cites.
const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: APP_ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
const sources = tracked.filter((f) => /\.(m?js|css|html)$/.test(f));
const DOC_OF = { TECH_NOTES: "TECH_NOTES.md", DESIGN: "DESIGN.md", DATA_SOURCES: "DATA_SOURCES.md" };
for (const f of sources) {
  const t = fs.readFileSync(path.join(APP_ROOT, f), "utf8");
  for (const m of t.matchAll(/\b(TECH_NOTES|DESIGN|DATA_SOURCES)(?:\.md)? ?§ ?(\d+)(?:[–-](\d+))?(?: and §(\d+))?/g)) {
    const doc = DOC_OF[m[1]];
    const nums = [Number(m[2]), m[3] ? Number(m[3]) : null, m[4] ? Number(m[4]) : null].filter((x) => x !== null);
    const all = m[3] ? Array.from({ length: Number(m[3]) - Number(m[2]) + 1 }, (_, i) => Number(m[2]) + i) : nums;
    for (const n of all) if (text[doc] && !new RegExp(`^#{2,3} ${n}\\. `, "m").test(text[doc])) problems.push(`${f} cites ${doc} §${n}, which does not exist`);
  }
}

// Paths the documents name.
const EXT = /\.(m?js|css|html|md|json|svg|yml|txt|jpg|woff2)$/;
const FOLDERS = ["", "js", "js/engine", "js/i18n", "css", "config", "data", "data/corpus", "data/params", "data/patterns", "data/vocab", "data/signals", "tests", "tests/lib", "tests/fixtures", "tools", "tools/lib", "vici", "vici/dist", ".github/workflows"];
for (const [f, t] of Object.entries(text)) {
  const base = path.dirname(path.join(APP_ROOT, f));
  const names = new Set();
  for (const m of t.matchAll(/`([^`\s]+)`/g)) names.add(m[1]);
  for (const m of t.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) if (!/^[a-z]+:/i.test(m[1])) names.add(m[1]);
  for (const n of names) {
    const clean = n.replace(/[.,;:]$/, "");
    if (/[<>*{}$]|^~|^\/|^https?:|^-/.test(clean)) continue;
    if (/^[\w-]+(\.[\w-]+)*\.(io|com|org|net|de|dev|ai)(\/|$)/i.test(clean)) continue; // a web address, not a path
    if (!clean.includes("/") && !EXT.test(clean)) continue;
    if (!/^[\w./ -]+$/.test(clean) || !(EXT.test(clean) || clean.endsWith("/") || /^(js|css|config|data|tests|tools|vici)(\/|$)/.test(clean))) continue;
    // A bare file name ("sync.js") may live in any of the app's folders.
    const candidates = clean.includes("/")
      ? [path.join(APP_ROOT, clean), path.join(base, clean)]
      : FOLDERS.map((d) => path.join(APP_ROOT, d, clean));
    if (!candidates.some((c) => fs.existsSync(c))) problems.push(`${f} names ${clean}, which does not exist`);
  }
}

if (text["README.md"] && !text["README.md"].includes(LIVE_URL)) problems.push(`README.md does not link the live site (${LIVE_URL})`);

for (const p of problems) console.log(`FAIL  ${p}`);
console.log(`${Object.keys(DOCS).length} documents checked, ${problems.length} problem${problems.length === 1 ? "" : "s"}.`);
if (!problems.length) console.log("DOCS OK");
process.exit(problems.length ? 1 : 0);
