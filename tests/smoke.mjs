// Smoke suite (browser): the app boots offline with every other host blocked, without a console
// error, a page error or a policy violation; the intro on a first visit, the views, the drawer, the
// Diagnostics dialog, the mode dialog behind Start agent, the keyboard path to the language switch,
// and a boot failure reported on screen.
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
  check("the page has one top-level heading, the product's name", await page.evaluate(() => document.querySelectorAll("h1").length === 1 && document.querySelector("h1").textContent.trim() === "Duty Radar"));
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
  check("diagnostics checks the page's policy against the specification's", (await page.getAttribute(".diag-policy-check", "data-tone")) === "success" && (await page.textContent(".diag-policy-check")) === "Checked: it is the specification's policy for this configuration.");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".diag-table", { state: "detached", timeout: 5000 });
  // The control: a policy that allows another host is reported as differing.
  const original = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', "content");
  await page.evaluate(() => { const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); m.setAttribute("content", m.getAttribute("content").replace("connect-src 'self'", "connect-src 'self' https://elsewhere.example")); });
  await page.click("#btn-diagnostics");
  await page.waitForSelector(".diag-table", { timeout: 5000 });
  check("control: a policy with another host is reported as differing", (await page.getAttribute(".diag-policy-check", "data-tone")) === "danger");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".diag-table", { state: "detached", timeout: 5000 });
  await page.evaluate((c) => document.querySelector('meta[http-equiv="Content-Security-Policy"]').setAttribute("content", c), original);
  // Start agent opens the mode dialog with its three modes; Escape closes it without starting a run.
  check("Start agent is enabled", (await page.getAttribute("#btn-start", "aria-disabled")) !== "true");
  await page.click("#btn-start");
  await page.waitForSelector(".mode-modal", { timeout: 5000 });
  check("Start agent opens the mode dialog with three modes", (await page.$$(".mode-modal .mode-card")).length === 3);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".mode-modal", { state: "detached", timeout: 5000 });
  check("closing the dialog starts no run", (await page.getAttribute("#mode-badge", "data-mode")) === "none" && (await page.textContent("#status-pill .text")) === "Ready");
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
  check("the failed boot screen stops its spinner and shows its help", (await broken.page.getAttribute("#boot", "data-state")) === "failed" && !(await broken.page.isVisible("#boot .boot-status .vc-spinner")) && await broken.page.isVisible("#boot .boot-help"));
  server.blockLocal.clear();
  await broken.ctx.close();
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`SMOKE OK (${checks} checks)`);
