// Runs every suite in order and prints a summary. The prototype itself needs none of this.
// Usage: node tests/run-all.mjs               (all suites)
//        node tests/run-all.mjs figures vici   (only the named suites)
// Options after the suite names are passed on: --require-vici to the suites that use Vici's checks,
// --require-legacy to the figures suite, as on GitHub Actions. There a failing suite's FAIL lines also
// become error annotations on the check run.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

const SUITES = [
  { id: "figures", what: "every euro again from the cost method, the counts, the key figures per step, every figure in the page and the docs; the data is 1.0.0's", file: "tests/figures.mjs", browser: false, legacy: true },
  { id: "files", what: "the page's files, the modules' imports, no lab left, vici/ unchanged", file: "tests/files.mjs", browser: false, vici: true },
  { id: "lean", what: "how small the app stays: modules, lines, buttons, no live-mode code, no connection, short docs", file: "tests/lean.mjs", browser: false },
  { id: "vici", what: "Vici's own guide, byline, writing, AI notice and record id checks on the page in both languages, every sentence and the docs", file: "tests/vici.mjs", browser: false, vici: true },
  { id: "showcase", what: "the five steps by click, key and link, the bar that asks, the three decisions, no record id on a screen, the language switch, three window sizes, both themes", file: "tests/showcase.mjs", browser: true, vici: true },
  { id: "guide", what: "the guide of the page's language opens once per tab, focus and keys, ?guide=0 and ?guide=present, fits 1280 × 720", file: "tests/guide-behaviour.mjs", browser: true },
  { id: "contrast", what: "every visible text in the five steps and both guides meets WCAG 2.2 AA, light and dark", file: "tests/contrast.mjs", browser: true },
  { id: "hexagon", what: "nothing round in the app's files or the rendered page, light and dark", file: "tests/hexagon.mjs", browser: true }
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
  const r = spawnSync(process.execPath, [path.join(APP_ROOT, s.file), ...extra], { cwd: APP_ROOT, stdio: ci ? ["inherit", "pipe", "inherit"] : "inherit", env: process.env, maxBuffer: 64 * 1024 * 1024 });
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
