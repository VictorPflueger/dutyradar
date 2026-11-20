// The published site (definition of done, item 2): GitHub Pages serves exactly the files of this
// checkout, and in a fresh browser profile with every other host blocked R1 replays end to end there.
// Run after a Pages build (the "live site" workflow does so after every build) or by hand.
//   files    the page, the app's main modules, both language files, the recording of R1, the snapshot's
//            index and a fixture of the self-test as served equal this checkout (Pages caches for up to
//            ten minutes, so it retries for up to twelve)
//   run      R1 in Simulation to its end in a new browser context: the decision, the approval of the
//            recorded intention, the tiles equal to the engines' figures computed here in Node, the
//            approved item in the dossier; "Run all tests" passes there too; no page error and no request
//            to any other host (up to three runs a minute apart, for a deployment the CDN still takes up)
// In GitHub Actions every problem is also printed as an annotation (::error / ::warning).
// Usage: node tests/live_site.mjs [url]   (default: the repository's GitHub Pages address; LIVE_URL;
//        LIVE_WAIT_MS sets the wait for the files, 0 for a local check)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { APP_ROOT, launchBrowser } from "./lib/harness.mjs";
import { replayStory } from "./lib/story-node.mjs";

const URL_BASE = (process.argv.slice(2).find((a) => !a.startsWith("--")) || process.env.LIVE_URL || "https://victorpflueger.github.io/dutyradar/").replace(/\/?$/, "/");
const FILES = [
  "index.html", "css/app.css", "css/print.css", "js/config.js", "js/main.js", "js/ui.js", "js/state.js", "js/simulation.js", "js/selftest.js",
  "js/i18n/en.json", "js/i18n/de.json", "data/runs/R1.json", "data/corpus/index.json", "config/slice.json", "tests/fixtures/golden-cases.json"
];
const WAIT_MS = Number(process.env.LIVE_WAIT_MS ?? 12 * 60 * 1000);
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const plain = (s) => String(s ?? "").replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const problems = [];

// 1. The files as served equal this checkout.
const deadline = Date.now() + WAIT_MS;
let stale = FILES;
while (true) {
  stale = [];
  for (const f of FILES) {
    try {
      const r = await fetch(`${URL_BASE}${f}?t=${Date.now()}`, { cache: "no-store" });
      const body = Buffer.from(await r.arrayBuffer());
      if (!r.ok || sha(body) !== sha(fs.readFileSync(path.join(APP_ROOT, f)))) stale.push(`${f} (${r.status})`);
    } catch (e) {
      stale.push(`${f} (${String(e.message || e).slice(0, 60)})`);
    }
  }
  if (!stale.length || Date.now() >= deadline) break;
  console.log(`waiting for the site to serve this checkout: ${stale.join(", ")}`);
  await new Promise((r) => setTimeout(r, 30000));
}
if (stale.length) problems.push(`the site does not serve this checkout: ${stale.join(", ")}`);
else console.log(`PASS  files: ${FILES.length} files as served equal this checkout`);

// 2. R1 replays there in a fresh profile with every other host blocked.
const story = await replayStory("R1", "en");
const pause = story.pauses.find((p) => p.kind === "option");
async function replayR1() {
  const found = [];
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: "en-GB" });
  const own = new URL(URL_BASE).host;
  const other = new Set();
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.host === own || u.protocol === "data:" || u.protocol === "blob:") return route.continue();
    other.add(u.host);
    return route.abort("blockedbyclient");
  });
  await context.addInitScript(() => { try { localStorage.setItem("dr.introSeen", "1"); } catch { /* storage blocked */ } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR_/.test(m.text())) errors.push(m.text()); });
  try {
    await page.goto(`${URL_BASE}?lang=en&speed=1000`, { waitUntil: "load" });
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 30000 });
    await page.selectOption("#run-select", "R1");
    await page.click("#btn-start");
    await page.click("#start-simulation");
    await page.waitForSelector("#btn-approve:not([disabled])", { timeout: 120000 });
    const choice = pause.choice;
    await page.locator(`article.option-card[id$="${choice.option_id}"] .option-pick`).click();
    await page.selectOption("#reason-code", choice.reason_code);
    await page.click("#btn-approve");
    await page.waitForFunction(() => document.querySelector("#status-pill")?.dataset.tone === "done", null, { timeout: 60000 });
    const tiles = {
      duties: plain(await page.textContent("#kpi-duties .kpi-value")), cost: plain(await page.textContent("#kpi-cost .kpi-value")),
      repShare: plain(await page.textContent("#kpi-reporting .kpi-gauge")), docShare: plain(await page.textContent("#kpi-documentation .kpi-gauge"))
    };
    for (const k of Object.keys(tiles)) if (tiles[k] !== story.final.tiles[k]) found.push(`tile ${k} reads "${tiles[k]}", the engine computes "${story.final.tiles[k]}"`);
    await page.click("#tab-outbox");
    const items = await page.$$eval("#panel-outbox .dossier-item", (els) => els.map((e) => e.id.replace(/^dossier-/, "")));
    if (JSON.stringify(items) !== JSON.stringify(story.final.items)) found.push(`the dossier holds ${items.join(", ") || "nothing"}, not ${story.final.items.join(", ")}`);
    if (!(await page.$('#mode-badge[data-mode="simulation"]'))) found.push("the badge does not say SIMULATION");
    // The self-test reads its fixtures from the site.
    await page.click("#btn-diagnostics");
    await page.click("#btn-selftest");
    await page.waitForSelector('#selftest-status[data-tone="success"], #selftest-status[data-tone="danger"]', { timeout: 30000 });
    const tone = await page.getAttribute("#selftest-status", "data-tone");
    if (tone !== "success") found.push(`Run all tests: ${plain(await page.textContent("#selftest-status"))}`);
  } catch (e) {
    found.push(`R1 did not replay to its end: ${String(e.message || e).split("\n")[0]}`);
  }
  if (other.size) found.push(`requests to other hosts: ${[...other].join(", ")}`);
  if (errors.length) found.push(`page errors: ${errors.slice(0, 3).join(" | ")}`);
  await browser.close();
  return found;
}

// In GitHub Actions each problem also becomes an annotation, readable without the job log.
const annotate = (level, text) => { if (process.env.GITHUB_ACTIONS === "true") console.log(`::${level} title=live site::${text.replace(/\r?\n/g, " ")}`); };

if (!stale.length) {
  const attempts = WAIT_MS ? 3 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const found = await replayR1();
    if (!found.length) { console.log(`PASS  run: R1 replays to its end on the published site with other hosts blocked${attempt > 1 ? ` (run ${attempt})` : ""}`); break; }
    if (attempt === attempts) { problems.push(...found); break; }
    for (const f of found) { console.log(`WARN  run ${attempt}: ${f}`); annotate("warning", `run ${attempt}: ${f}`); }
    await new Promise((r) => setTimeout(r, 60000));
  }
}

for (const p of problems) annotate("error", p);
for (const p of problems) console.log(`FAIL  ${p}`);
console.log(`${URL_BASE}: ${problems.length} problem${problems.length === 1 ? "" : "s"}.`);
if (!problems.length) console.log("LIVE SITE OK");
process.exit(problems.length ? 1 : 0);
