// Language suite (browser): English on a first visit whatever the browser's language; the switch
// changes every screen at once without a reload, updates <html lang> and is remembered; ?lang= wins and
// becomes the stored choice; the static texts follow the language files; nothing is cut to an ellipsis
// in German at 1280 × 720; once the strings are loaded, a failed boot is reported in the chosen language
// (AC-25's first part). Version 0.2.0 (AC-38): a Live run against the scripted stand-in waits for a
// decision in English; the switch to German changes the control bar, tiles, views, console, drawer and
// dialogs at once, while the model's narration and report keep their English text and EN tag; German
// fits at 1280 × 720 on every screen of the run.
// Usage: node tests/i18n.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT, launchBrowser, serveStatic, MOCK_KEY } from "./lib/harness.mjs";
import { openApp, cutText } from "./lib/page.mjs";
import { startRun, waitDecision, waitTone, decide, textOf, routeFakeClaude, enterKey } from "./lib/run-page.mjs";
import { createFakeClaude } from "./lib/fake-claude.mjs";
import { liveScript } from "./lib/live-script.mjs";

const strings = { en: JSON.parse(readFileSync(path.join(APP_ROOT, "js/i18n/en.json"), "utf8")), de: JSON.parse(readFileSync(path.join(APP_ROOT, "js/i18n/de.json"), "utf8")) };
const t = (lang, key) => key.split(".").reduce((o, k) => o?.[k], strings[lang]);
const tp = (lang, key, params = {}) => t(lang, key).replace(/\{(\w+)\}/g, (m, n) => (params[n] ?? m));
const server = await serveStatic(APP_ROOT, 8232);
const browser = await launchBrowser();
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${detail}` : ""}`); } };

/** Every element marked data-i18n shows its string in `lang`. */
async function staticTexts(page, lang) {
  const marked = await page.$$eval("[data-i18n]", (els) => els.map((e) => [e.dataset.i18n, e.textContent]));
  return marked.filter(([k, text]) => text !== t(lang, k)).map(([k, text]) => `${k}: "${text}"`);
}

try {
  // A German browser still opens in English.
  const a = await openApp(browser, server.base, { locale: "de-DE", skipIntro: true });
  check("first visit with a German browser: English", (await a.page.evaluate(() => document.documentElement.lang)) === "en" && (await a.page.textContent(".brand-name")) === "Duty Radar");
  check("English static texts", (await staticTexts(a.page, "en")).length === 0, (await staticTexts(a.page, "en")).join("; "));
  check("EN is pressed", (await a.page.getAttribute('.lang-option[data-lang="en"]', "aria-pressed")) === "true");
  await a.page.evaluate(() => { window.__noReload = true; });
  await a.page.click('.lang-option[data-lang="de"]');
  await a.page.waitForFunction(() => document.documentElement.lang === "de");
  check("the switch needs no reload", await a.page.evaluate(() => window.__noReload === true));
  check("German everywhere: header, tiles, controls, views, console, drawer", (await a.page.textContent(".brand-name")) === "Pflichten-Radar"
    && (await a.page.textContent("#kpi-duties .kpi-label")) === t("de", "kpi.duties")
    && (await a.page.textContent("#btn-start")).includes(t("de", "controls.start"))
    && (await a.page.textContent(".centre-title")) === t("de", "screen.start")
    && (await a.page.textContent(".console-title h2")) === t("de", "console.title")
    && (await a.page.textContent("#tab-options")).includes(t("de", "screen.options"))
    && (await a.page.textContent(".drawer-note")).includes(t("de", "drawer.note")));
  check("German static texts", (await staticTexts(a.page, "de")).length === 0, (await staticTexts(a.page, "de")).join("; "));
  check("German number formats", (await a.page.textContent(".slice-meta")).includes("4.904 Sätze"));
  check("the choice is stored", (await a.page.evaluate(() => localStorage.getItem("dr.lang"))) === "de");
  await a.page.reload();
  await a.page.waitForSelector('html[data-boot="ready"]');
  check("the choice survives a reload", (await a.page.evaluate(() => document.documentElement.lang)) === "de");
  check("no errors", a.problems.length === 0, a.problems.join("; "));
  await a.ctx.close();

  // ?lang= wins over the stored choice and becomes it.
  const b = await openApp(browser, server.base, { lang: "de", query: "?lang=en", skipIntro: true });
  check("?lang=en wins over a stored German", (await b.page.evaluate(() => document.documentElement.lang)) === "en");
  check("?lang= becomes the stored choice", (await b.page.evaluate(() => localStorage.getItem("dr.lang"))) === "en");
  await b.ctx.close();

  // German at 1280 × 720: nothing cut to an ellipsis, nothing scrolls sideways.
  const c = await openApp(browser, server.base, { query: "?lang=de", skipIntro: true, viewport: { width: 1280, height: 720 } });
  const cut = await c.page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => {
    const s = getComputedStyle(el);
    return el.offsetParent !== null && s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1;
  }).map((el) => `${el.className || el.tagName}: ${el.textContent.trim().slice(0, 40)}`));
  check("German at 1280 × 720: no text cut to an ellipsis", cut.length === 0, cut.join("; "));
  check("German at 1280 × 720: no sideways scrolling", await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await c.ctx.close();

  // Version 0.2.0: a Live run (scripted stand-in) waits for a decision in English; then German.
  {
    const fake = createFakeClaude(liveScript());
    const e = await openApp(browser, server.base, { skipIntro: true, query: "?lang=en", viewport: { width: 1280, height: 720 } });
    await routeFakeClaude(e.page, fake);
    await startRun(e.page, { run: "R3", mode: "live" });
    await enterKey(e.page, MOCK_KEY);
    await waitDecision(e.page, 30000);
    const narration = await textOf(e.page, '.log .narration[data-kind="narration"]');
    check("run: the narration is English with its EN tag", narration.includes("I price the monthly report") && (await textOf(e.page, '.log .narration[data-kind="narration"] .lang-tag')) === "EN");
    await e.page.evaluate(() => { window.__noReload = true; });
    await e.page.click('.lang-option[data-lang="de"]');
    await e.page.waitForFunction(() => document.documentElement.lang === "de");
    await e.page.waitForTimeout(150);
    const p = e.page;
    check("run: the switch needs no reload", await p.evaluate(() => window.__noReload === true));
    check("run: the control bar in German", (await textOf(p, "#status-pill .text")) === t("de", "state.awaiting_decision") && (await textOf(p, "#btn-abort .btn-text")) === t("de", "controls.abort") && (await textOf(p, '#run-select option[value="R3"]')) === t("de", "run.R3"));
    check("run: the cost meter in German", /von 40 Aufrufen · \d+,\d{2}\s€ von 3,00\s€/.test((await textOf(p, "#cost-meter")).replace(/[\u00a0\u202f]/g, " ")), await textOf(p, "#cost-meter"));
    check("run: the tiles in German", (await textOf(p, "#kpi-cost .kpi-label")) === t("de", "kpi.cost") && (await textOf(p, "#kpi-duties .kpi-label")) === t("de", "kpi.duties"));
    check("run: the duty map in German", (await textOf(p, ".centre-title")) === t("de", "screen.dutymap") && (await textOf(p, ".map-table thead th:nth-child(2)")) === t("de", "duty_type_short.MELDEPFLICHT"));
    const toolLine = await textOf(p, '.log .entry[data-type="tool_call"]');
    check("run: the console's tool lines in German", toolLine.includes(t("de", "agent.corpus")) && toolLine.includes(t("de", "tool.label.law_list")), toolLine);
    const after = await textOf(p, '.log .narration[data-kind="narration"]');
    const body = (x) => x.replace(/^\S+ EN /, "");
    check("run: the model's narration keeps its English text and EN tag; its AI label follows the UI", body(after) === body(narration) && after.startsWith(`${t("de", "console.ai")} EN `) && (await textOf(p, '.log .narration[data-kind="narration"] .lang-tag')) === "EN", `${narration} / ${after}`);
    check("run: the options in German", (await textOf(p, "#panel-options .options-title")) === tp("de", "options.for_target", { target: "D-enstatg_2017-p10-1" }) && (await textOf(p, "#btn-approve")) === t("de", "options.approve") && (await textOf(p, "#reason-code option")) === t("de", "options.reason_choose"));
    check("run: the drawer's tabs in German", (await textOf(p, "#tab-outbox .drawer-tab-label")) === t("de", "screen.outbox") && (await textOf(p, "#tab-audit .drawer-tab-label")) === t("de", "drawer.tab.audit"));
    // German fits at 1280 × 720 on every screen of the run.
    const fits = async (where) => {
      const cut = await p.evaluate(cutText);
      check(`German at 1280 × 720, ${where}: nothing cut`, cut.length === 0, cut.join("; "));
      check(`German at 1280 × 720, ${where}: no sideways scrolling`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    };
    await fits("duty map and options");
    await p.click('.centre-tab[data-view="duplicates"]');
    await fits("duplicates");
    await p.click('.map-panel .centre-tab[data-view="dutymap"]');
    const cell = await p.$("button.map-count");
    if (cell) { await cell.click(); await p.waitForSelector(".card-panel .duty-card"); }
    check("run: a duty card opens from the map", Boolean(cell) && (await textOf(p, ".card-panel .duty-card .duty-facts dt")) === t("de", "dutycard.type"));
    await fits("duty cards");
    await p.click('.centre-tab[data-view="start"]');
    await fits("start view during the run");
    await decide(p, { option: "lower_frequency", code: "Z4" });
    await waitTone(p, "done", 30000);
    const report = await textOf(p, '.log .narration[data-kind="report"]');
    check("run: the model's closing report stays English, tagged EN, in the German UI", report.includes("Nothing is sent.") && (await textOf(p, '.log .narration[data-kind="report"] .lang-tag')) === "EN", report);
    await p.click("#tab-outbox");
    check("run: the outbox in German", (await textOf(p, "#panel-outbox .outbox-title")) === t("de", "outbox.title"));
    await fits("outbox");
    await p.click("#tab-audit");
    check("run: the audit in German", (await textOf(p, "#panel-audit thead th")) === t("de", "audit.col_time"));
    await fits("audit");
    await p.click("#btn-diagnostics");
    await p.waitForSelector(".diag-modal #diag-assumptions .param-input");
    check("run: Assumptions & diagnostics in German", (await textOf(p, ".diag-modal #diag-assumptions h3")) === t("de", "diag.assumptions"));
    await fits("Assumptions & diagnostics");
    await p.keyboard.press("Escape");
    await p.click("#btn-start");
    await p.waitForSelector(".mode-modal");
    check("run: the mode dialog in German", (await textOf(p, ".mode-modal .vc-dialog__title")) === t("de", "mode.dialog_title"));
    await fits("mode dialog");
    await p.keyboard.press("Escape");
    check("run: no errors", e.problems.length === 0 && fake.violations.length === 0, e.problems.concat(fake.violations).join("; "));
    await e.ctx.close();
  }
  {
    // The key dialog in German at 1280 × 720.
    const k = await openApp(browser, server.base, { skipIntro: true, query: "?lang=de", viewport: { width: 1280, height: 720 } });
    await k.page.click("#btn-start");
    await k.page.waitForSelector(".mode-modal");
    await k.page.click("#start-live");
    await k.page.waitForSelector(".key-modal");
    check("the key dialog in German", (await textOf(k.page, ".key-modal .vc-dialog__title")) === t("de", "key.title") && (await textOf(k.page, "#key-check")) === t("de", "key.check"));
    const cut = await k.page.evaluate(cutText);
    check("German at 1280 × 720, key dialog: nothing cut", cut.length === 0, cut.join("; "));
    await k.ctx.close();
  }

  // Once the strings are loaded, the boot screen speaks the chosen language: a missing data file, in German.
  server.blockLocal.add("/data/corpus/index.json");
  const d = await openApp(browser, server.base, { query: "?lang=de", waitBoot: false, skipIntro: true });
  await d.page.waitForSelector('html[data-boot="failed"]', { timeout: 15000 });
  const detail = await d.page.textContent("#boot-detail");
  check("a missing data file is reported in German", detail.startsWith("Eine Datendatei wurde nicht geladen."), detail);
  server.blockLocal.clear();
  await d.ctx.close();
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`I18N OK (${checks} checks)`);
