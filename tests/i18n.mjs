// Language suite (browser): English on a first visit whatever the browser's language; the switch
// changes every screen at once without a reload, updates <html lang> and is remembered; ?lang= wins and
// becomes the stored choice; the static texts follow the language files; nothing is cut to an ellipsis
// in German at 1280 × 720 (AC-25's first part, AC-38's checks that need no run).
// Usage: node tests/i18n.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT, launchBrowser, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";

const strings = { en: JSON.parse(readFileSync(path.join(APP_ROOT, "js/i18n/en.json"), "utf8")), de: JSON.parse(readFileSync(path.join(APP_ROOT, "js/i18n/de.json"), "utf8")) };
const t = (lang, key) => key.split(".").reduce((o, k) => o?.[k], strings[lang]);
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
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`I18N OK (${checks} checks)`);
