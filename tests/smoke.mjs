// Smoke suite (browser): the app boots offline with every other host blocked, without a console
// error, a page error or a policy violation; the intro on a first visit, the views, the drawer, the
// Diagnostics dialog, the keyboard path to the language switch, and a boot failure reported on screen.
// Usage: node tests/smoke.mjs
import { APP_ROOT, launchBrowser, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";

const server = await serveStatic(APP_ROOT, 8231);
const browser = await launchBrowser();
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${detail}` : ""}`); } };

try {
  // First visit: the intro opens by itself and closes with Escape; the choice is remembered.
  const first = await openApp(browser, server.base);
  const { page } = first;
  await page.waitForSelector(".intro-modal", { timeout: 10000 });
  check("intro opens on a first visit", await page.isVisible(".intro-modal"));
  await page.keyboard.press("Escape");
  await page.waitForSelector(".intro-modal", { state: "detached", timeout: 5000 });
  check("intro closes with Escape and is remembered", (await page.evaluate(() => localStorage.getItem("dr.introSeen"))) === "1");
  check("name and subtitle", (await page.textContent(".brand-name")) === "Duty Radar" && (await page.textContent(".brand-sub")) === "Find, cluster and price duties");
  check("both disclosure lines", (await page.textContent(".ai-disclosure")).includes("You are interacting with an AI system.") && (await page.textContent(".proto-disclosure")) === "Prototype – not an official federal government service");
  check("four KPI tiles, two gauges at 0", (await page.$$(".kpi")).length === 4 && (await page.$$eval(".kpi-gauge", (g) => g.map((x) => x.getAttribute("aria-valuenow")).join())) === "0,0");
  check("the slice table lists 31 norms", (await page.$$eval(".slice-table tbody tr:not(.family-row)", (r) => r.length)) === 31);
  check("the role strip shows seven roles, all idle", (await page.$$eval(".role-strip .rail-step", (s) => s.map((x) => x.dataset.state).join())) === "idle,idle,idle,idle,idle,idle,idle");
  await page.click('.centre-tab[data-view="dutymap"]');
  check("duty map view", (await page.textContent(".centre-title")) === "Duty map" && (await page.isVisible(".centre-empty")));
  await page.click('.centre-tab[data-view="duplicates"]');
  check("duplicates view", (await page.textContent(".centre-title")) === "Duplicates");
  await page.click("#tab-outbox");
  check("outbox: Nothing is sent.", (await page.textContent("#panel-outbox")).includes("Nothing is sent."));
  await page.click("#tab-outbox");
  check("a second click closes the drawer", (await page.getAttribute("#drawer", "data-open")) === "false");
  await page.click("#btn-diagnostics");
  await page.waitForSelector(".diag-table", { timeout: 5000 });
  const diag = await page.textContent(".diag-modal");
  check("diagnostics: snapshot source and policy", diag.includes("gii-toc.xml") && diag.includes("connect-src 'self' https://api.anthropic.com"));
  await page.keyboard.press("Escape");
  await page.waitForSelector(".diag-table", { state: "detached", timeout: 5000 });
  check("the start button waits for version 0.2.0", (await page.getAttribute("#btn-start", "aria-disabled")) === "true");
  // Keyboard: the language switch is reachable and works with Enter.
  await page.focus('.lang-option[data-lang="de"]');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.documentElement.lang === "de");
  check("the language switch works by keyboard", (await page.textContent(".brand-name")) === "Pflichten-Radar");
  check("no CSP violation", (await first.csp()).length === 0, (await first.csp()).join("; "));
  check("no error and no request to another host", first.problems.length === 0, first.problems.join("\n  - "));
  await first.ctx.close();

  // A missing data file is reported on the boot screen.
  server.blockLocal.add("/data/corpus/index.json");
  const broken = await openApp(browser, server.base, { waitBoot: false, skipIntro: true });
  await broken.page.waitForSelector('html[data-boot="failed"]', { timeout: 15000 });
  check("a missing data file is reported on the boot screen", /data file failed to load/.test(await broken.page.textContent("#boot-detail")));
  server.blockLocal.clear();
  await broken.ctx.close();
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`SMOKE OK (${checks} checks)`);
