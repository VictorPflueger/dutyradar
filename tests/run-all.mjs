// Runs every suite in order and prints a summary. The prototype itself needs none of this.
// Usage: node tests/run-all.mjs               (all suites)
//        node tests/run-all.mjs figures vici   (only the named suites)
// Options after the suite names are passed on: --require-vici to the suites that use Vici's checks,
// --require-legacy to the suites that rebuild or read release 1.0.0, as on GitHub Actions. There a failing suite's FAIL lines also
// become error annotations on the check run.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

const SUITES = [
  { id: "figures", what: "every euro again from the cost method, the counts, the key figures per step, every figure in the page and the docs; the data is 1.0.0's", file: "tests/figures.mjs", browser: false, legacy: true },
  { id: "files", what: "the page's files, the modules' imports, no lab left, vici/ unchanged", file: "tests/files.mjs", browser: false, vici: true },
  { id: "lean", what: "how small the app stays: modules, lines, buttons, no live-mode code, no connection, short docs", file: "tests/lean.mjs", browser: false },
  { id: "vici", what: "Vici's own guide, byline, writing, AI notice, policy, storage and record id checks on the page in both languages, every sentence and the docs", file: "tests/vici.mjs", browser: false, vici: true },
  { id: "ladder", what: "one rung per term from law to decision, each count equal to the data and the inventory, defined in one line, in both languages", file: "tests/ladder.mjs", browser: false },
  { id: "inventory", what: "the inventory behind every count: 745 duties, 125 discarded sentences, 48 clusters, by law, type and addressee, each phrase the exact slice of its sentence", file: "tests/inventory.mjs", browser: false },
  { id: "quotes", what: "every law quote on the comparison verbatim in 1.0.0's corpus text of its section", file: "tests/quotes.mjs", browser: false, legacy: true },
  { id: "derivation", what: "the derivation again from its inputs, R1's figures before the calibration, the cap, the sensitivity against 1.0.0's engines", file: "tests/derivation.mjs", browser: false, legacy: true },
  { id: "docs", what: "the six questions a first look raises in DEMO_SCRIPT.md in both languages; README, DESIGN and DATA_SOURCES describe 2.2.0", file: "tests/docs.mjs", browser: false },
  { id: "review", what: "the cold read and the partner review recorded in REVIEW.md, naming no one", file: "tests/review.mjs", browser: false, args: [] },
  { id: "partner", what: "the partner review's verdict, One Thing, cut, fix and keep lists", file: "tests/review.mjs", browser: false, args: ["partner"] },
  { id: "showcase", what: "the five steps by click, key and link, the bar that asks, the three decisions, no record id on a screen, the language switch, three window sizes, both themes", file: "tests/showcase.mjs", browser: true, vici: true },
  { id: "guide", what: "the guide of the page's language opens once per tab, focus and keys, ?guide=0 and ?guide=present, fits 1280 × 720", file: "tests/guide-behaviour.mjs", browser: true },
  { id: "contrast", what: "every visible text in the five steps and both guides meets WCAG 2.2 AA, light and dark", file: "tests/contrast.mjs", browser: true },
  { id: "hexagon", what: "nothing round in the app's files or the rendered page, light and dark", file: "tests/hexagon.mjs", browser: true },
  { id: "panels", what: "the laws in words, the legend, the lists behind every count, the links between map and story, the comparison, the derivation, who carries the duty", file: "tests/panels.mjs", browser: true },
  { id: "glossary", what: "one word per thing on every screen, each defined on the ladder, in both languages", file: "tests/glossary.mjs", browser: true },
  { id: "guide-render", what: "Vici's own check-guide-render on the served page", file: "tests/guide-render.mjs", browser: true, vici: true }
];

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith("-"));
const pass = args.filter((a) => a.startsWith("-"));
const unknown = only.filter((id) => !SUITES.some((s) => s.id === id));
if (unknown.length) {
  console.error(`Unknown suite${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. Available: ${SUITES.map((s) => s.id).join(", ")}.`);
  process.exit(1);
}
const chosen = SUITES.filter((s) => !only.length || only.includes(s.id));
const summary = [];
const ci = process.env.GITHUB_ACTIONS === "true";
for (const s of chosen) {
  console.log(`\n=== ${s.id}: ${s.what} ===`);
  const started = Date.now();
  const extra = pass.filter((a) => (a === "--require-vici" ? s.vici : a === "--require-legacy" ? s.legacy : true));
  const r = spawnSync(process.execPath, [path.join(APP_ROOT, s.file), ...(s.args || []), ...extra], { cwd: APP_ROOT, stdio: ci ? ["inherit", "pipe", "inherit"] : "inherit", env: process.env, maxBuffer: 64 * 1024 * 1024 });
  if (ci) {
    const text = String(r.stdout || "");
    process.stdout.write(text);
    if (r.status !== 0) for (const line of text.split("\n").filter((l) => /^FAIL\b/.test(l)).slice(0, 10)) console.log(`::error title=${s.id}::${line.slice(0, 3000).replace(/%/g, "%25")}`);
  }
  summary.push({ ...s, ok: r.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
  if (r.status === 2) { console.log("Playwright is missing; the browser suites are skipped. See tests/README.md."); break; }
}

console.log("\n=== Summary ===");
for (const s of summary) console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.id.padEnd(8)} ${String(s.seconds).padStart(4)} s  ${s.what}`);
const ok = summary.length === chosen.length && summary.every((s) => s.ok);
if (!ok) { console.log(`\n${summary.filter((s) => !s.ok).length || chosen.length - summary.length} suite(s) failed or did not run.`); process.exit(1); }
console.log(`\nAll ${chosen.length} suites passed.${chosen.length === SUITES.length ? "\nALL SUITES PASSED" : ""}`);
