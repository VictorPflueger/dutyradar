// The How it works guide behaves as Vici's standard says (components/guide.html, Behaviour and
// Opening), in each language, checked the way Vici's own scripts/check-guide-render.mjs checks its
// starters, here over http because the page's modules don't run from a file:
//   en        in a new tab, a German browser included, the English guide opens by itself with focus on
//             Next, no live region, Back disabled and "1 of 4"; Enter moves to chapter 2 and focus to
//             its heading; the rail jumps to the talk track, whose button reads Start; Escape closes;
//             the header button reopens it at chapter 1; Start closes it, gives focus back and leaves
//             the page on the first step; a reload in the same tab doesn't open it again, and neither
//             does a reload after switching to German: the two guides are one guide in two languages
//   de        the same in German (?lang=de): "1 von 4", the rail "Kapitel", Weiter, Zurück, Starten;
//             the English guide stays closed and its header button hidden; a returning visitor who
//             chose German gets the German guide in a new tab
//   address   ?guide=0 keeps it closed; ?guide=present opens the talk track; in either language
//   content   the How it works chapter explains each key figure in a row of its own: the name as on its
//             tile, what it measures, and the value the tile shows once a person approves the merge;
//             and the talk track has one line per step, each starting with that step's name
//   fit       at 375 px the guide fills the screen; at 1280 × 720 and 1366 × 768 every chapter of both
//             guides, the talk track included, fits without scrolling
// Usage: NODE_PATH="$(npm root -g)" node tests/guide-behaviour.mjs [case …]
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT, launchBrowser, serveStatic, wanted, outDir, NETWORK_NOISE } from "./lib/harness.mjs";

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(APP_ROOT, "data/story.js"), "utf8"), sandbox);
const S = await import(pathToFileURL(path.join(APP_ROOT, "js/story.js")).href);
const F = S.factsOf(sandbox.window.DUTY_RADAR);
const W = { en: S.words(F, "en"), de: S.words(F, "de") };
const WORDS = {
  en: { count: "1 of 4", rail: "Chapters", next: "Next", back: "Back", done: "Start", how: "How it works" },
  de: { count: "1 von 4", rail: "Kapitel", next: "Weiter", back: "Zurück", done: "Starten", how: "So arbeitet er" }
};

const out = await outDir("guide");
const server = await serveStatic(APP_ROOT, 8462);
const browser = await launchBrowser();
const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const errors = [];

/** A new tab in `ctx` on the page, once the app is ready and vici.js has had time to open a guide. */
async function tab(ctx, query = "") {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort("blockedbyclient"));
  await page.goto(`${server.base}${query}`);
  await ready(page);
  return page;
}
const ready = async (page) => {
  await page.waitForFunction(() => document.documentElement.dataset.boot === "ready", null, { timeout: 15000 });
  await page.waitForTimeout(250);
};
const context = (opts = {}) => browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "de-DE", ...opts });

/** One guide as the visitor meets it. */
const state = (page, lang) => page.evaluate((l) => {
  const d = document.getElementById(`guide-${l}`);
  const other = document.getElementById(`guide-${l === "en" ? "de" : "en"}`);
  const shown = [...d.querySelectorAll(".vc-guide__chapter")].filter((c) => !c.hidden);
  const a = document.activeElement;
  return {
    open: d.open, otherOpen: other.open, lang: document.documentElement.lang,
    chapters: d.querySelectorAll(".vc-guide__chapter").length, shown: shown.map((c) => c.dataset.vcChapter),
    count: d.querySelector(".vc-guide__count").textContent,
    active: a && (a.matches("[data-vc-guide-next]") ? "next" : `${a.tagName}:${a.textContent.trim().slice(0, 40)}`),
    back: d.querySelector("[data-vc-guide-back]").disabled, backText: d.querySelector("[data-vc-guide-back]").textContent.trim(),
    next: d.querySelector("[data-vc-guide-next]").textContent.trim(),
    rail: d.querySelectorAll(".vc-guide__rail .vc-step__button").length, railName: d.querySelector(".vc-guide__rail")?.getAttribute("aria-label"),
    current: d.querySelector('.vc-step__button[aria-current="step"]')?.textContent.trim(), live: d.querySelectorAll("[aria-live]").length,
    opener: !document.querySelector(`[data-vc-guide-open="guide-${l}"]`).hidden, otherOpener: !document.querySelector(`[data-vc-guide-open="guide-${l === "en" ? "de" : "en"}"]`).hidden
  };
}, lang);
const anyOpen = (page) => page.evaluate(() => [...document.querySelectorAll("dialog.vc-guide")].filter((d) => d.open).map((d) => d.id));

/** The whole walk through one guide, in a new context so the stored language starts empty. */
async function walk(lang) {
  const w = WORDS[lang];
  const ctx = await context();
  const p = await tab(ctx, lang === "de" ? "?lang=de" : "");
  let s = await state(p, lang);
  check(s.open && !s.otherOpen && s.lang === (lang === "de" ? "de" : "en-GB") && s.opener && !s.otherOpener, `${lang}: a new tab${lang === "en" ? " in a German browser" : ""} opens the ${lang === "en" ? "English" : "German"} guide by itself, the other stays closed and only this guide's header button shows`);
  check(s.shown.join() === "what" && s.active === "next" && s.back && s.count === w.count && s.rail === 4 && s.chapters === 4 && s.railName === w.rail && s.live === 0 && s.backText === w.back && s.next.startsWith(w.next), `${lang}: chapter 1 alone, focus on ${w.next}, ${w.back} disabled, "${s.count}", the rail "${s.railName}" with ${s.rail} chapters, no live region`);
  await p.screenshot({ path: path.join(out, `${lang}-chapter-1.png`) });
  await p.keyboard.press("Enter");
  await p.waitForTimeout(100);
  s = await state(p, lang);
  check(s.shown.join() === "how" && /^H3:/.test(s.active) && !s.back && s.current?.includes(w.how), `${lang}: Enter moves to chapter 2, focus to its heading, the rail marks "${s.current}"`);
  await p.click(`#guide-${lang} .vc-guide__rail .vc-step__button >> nth=-1`);
  await p.waitForTimeout(100);
  s = await state(p, lang);
  check(s.shown.join() === "present" && s.next === w.done, `${lang}: the rail jumps to the talk track, whose button reads ${s.next}`);
  await p.screenshot({ path: path.join(out, `${lang}-talk-track.png`) });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  check(!(await state(p, lang)).open, `${lang}: Escape closes the guide`);
  await p.click(`[data-vc-guide-open="guide-${lang}"]`);
  await p.waitForTimeout(150);
  s = await state(p, lang);
  check(s.open && s.shown.join() === "what", `${lang}: the header button reopens it at chapter 1`);
  for (let i = 0; i < 4; i++) { await p.click(`#guide-${lang} [data-vc-guide-next]`); await p.waitForTimeout(60); }
  s = await state(p, lang);
  const after = await p.evaluate(() => ({ focus: document.activeElement && (document.activeElement.hasAttribute("data-vc-guide-open") || document.activeElement.id === "play"), step: new URL(location.href).searchParams.get("step") }));
  check(!s.open && after.focus && after.step === "target", `${lang}: ${w.done} on the last chapter closes it, focus goes back to the page and the page is at the first step (${after.step})`);
  await p.reload();
  await ready(p);
  check(!(await anyOpen(p)).length, `${lang}: a reload in the same tab doesn't open it again`);
  const otherLang = lang === "en" ? "de" : "en";
  await p.click(`.lang-option[data-lang="${otherLang}"]`);
  await p.reload();
  await ready(p);
  const switched = await p.evaluate(() => document.documentElement.dataset.lang);
  check(switched === otherLang && !(await anyOpen(p)).length, `${lang}: after switching to ${otherLang === "de" ? "German" : "English"}, a reload doesn't open the other language's guide either: one guide per tab`);
  await ctx.close();
}

try {
  if (wanted("en")) await walk("en");
  if (wanted("de")) {
    await walk("de");
    const ctx = await context();
    await ctx.addInitScript(() => { try { localStorage.setItem("dr.lang", "de"); } catch { /* blocked */ } });
    const p = await tab(ctx, "");
    check((await anyOpen(p)).join() === "guide-de", "de: a returning visitor who chose German gets the German guide in a new tab");
    await ctx.close();
  }

  if (wanted("address")) {
    const ctx = await context();
    for (const lang of ["en", "de"]) {
      const q = lang === "de" ? "&lang=de" : "";
      const off = await tab(ctx, `?guide=0${q}`);
      check(!(await anyOpen(off)).length, `address: ?guide=0 keeps the ${lang === "en" ? "English" : "German"} guide closed`);
      const present = await tab(ctx, `?guide=present${q}`);
      const s = await state(present, lang);
      check(s.open && !s.otherOpen && s.shown.join() === "present", `address: ?guide=present opens the ${lang === "en" ? "English" : "German"} talk track`);
    }
    await ctx.close();
  }

  if (wanted("content")) {
    const ctx = await context();
    for (const lang of ["en", "de"]) {
      const p = await tab(ctx, `?guide=0&step=decide${lang === "de" ? "&lang=de" : ""}`);
      await p.click('#decision [data-choice="merge"]');
      const c = await p.evaluate((l) => {
        const d = document.getElementById(`guide-${l}`);
        const flat = (s) => s.replace(/\s+/g, " ").trim();
        return {
          tiles: [...document.querySelectorAll(".kpi")].map((k) => ({ name: flat(k.querySelector(".vc-stat__label").textContent), value: flat(k.querySelector(".kpi-main").textContent + (k.querySelector(".kpi-of")?.hidden === false ? k.querySelector(".kpi-of").textContent : "")) })),
          rows: [...d.querySelectorAll('[data-vc-chapter="how"] tbody tr')].map((r) => ({ name: flat(r.querySelector("th").textContent), cells: [...r.querySelectorAll("td")].map((td) => flat(td.textContent)) })),
          track: [...d.querySelectorAll('[data-vc-chapter="present"] .vc-guide__path > li > strong')].map((e) => e.textContent.trim())
        };
      }, lang);
      const off = c.tiles.filter((tile) => {
        const row = c.rows.find((r) => r.name === tile.name);
        return !row || row.cells.length !== 2 || row.cells[0].length < 20 || row.cells[1] !== tile.value;
      });
      check(c.tiles.length === 3 && c.rows.length === 3 && !off.length, `content: the ${lang === "en" ? "English" : "German"} How it works chapter has a row for each key figure, named as on its tile, saying what it measures and the value the tile shows after the merge (${c.tiles.map((x) => `${x.name} ${x.value}`).join(", ")})${off.length ? `; off: ${off.map((x) => x.name).join(", ")}` : ""}`);
      const labels = S.STEP_IDS.map((id) => W[lang].steps[id].label);
      const wrong = c.track.filter((line, i) => !line.startsWith(`${labels[i]}:`));
      check(c.track.length === 5 && !wrong.length, `content: the ${lang === "en" ? "English" : "German"} talk track has a line per step, each starting with its name (${labels.join(", ")})${wrong.length ? `; off: ${wrong.join(" | ")}` : ""}`);
    }
    await ctx.close();
  }

  if (wanted("fit")) {
    const phone = await context({ viewport: { width: 375, height: 760 } });
    for (const lang of ["en", "de"]) {
      const p = await tab(phone, lang === "de" ? "?lang=de" : "");
      const box = await p.evaluate((l) => { const r = document.getElementById(`guide-${l}`).getBoundingClientRect(); return [r.width, r.height, document.documentElement.scrollWidth]; }, lang);
      check(box[0] >= 374 && box[1] >= 759 && box[2] <= 376, `fit: at 375 px the ${lang === "en" ? "English" : "German"} guide fills the screen (${box.map(Math.round).join(" × ")})`);
      await p.screenshot({ path: path.join(out, `375-${lang}.png`) });
    }
    await phone.close();
    for (const [width, height] of [[1280, 720], [1366, 768]]) {
      for (const lang of ["en", "de"]) {
        for (const theme of ["light", "dark"]) {
          const ctx = await context({ viewport: { width, height }, colorScheme: theme });
          await ctx.addInitScript((t) => { try { localStorage.setItem("vc-theme", t); } catch { /* blocked */ } }, theme);
          const p = await tab(ctx, `?guide=what${lang === "de" ? "&lang=de" : ""}`);
          const over = await p.evaluate((l) => {
            const d = document.getElementById(`guide-${l}`);
            const scroller = d.querySelector(".vc-guide__chapters");
            const dialogOver = () => d.scrollHeight - d.clientHeight;
            return [...d.querySelectorAll(".vc-guide__rail .vc-step__button")].map((b, i) => {
              b.click();
              const chapter = d.querySelectorAll(".vc-guide__chapter")[i];
              return { id: chapter.dataset.vcChapter, over: Math.max(scroller.scrollHeight - scroller.clientHeight, dialogOver()) };
            }).filter((x) => x.over > 1);
          }, lang);
          check(!over.length, `fit: at ${width} × ${height}, ${theme}, every chapter of the ${lang === "en" ? "English" : "German"} guide fits without scrolling${over.length ? `; scrolls in ${over.map((x) => `"${x.id}" by ${x.over} px`).join(", ")}` : ""}`);
          if (width === 1280 && theme === "light") {
            await p.click(`#guide-${lang} .vc-guide__rail .vc-step__button >> nth=-1`);
            await p.screenshot({ path: path.join(out, `1280x720-${lang}-talk-track.png`) });
          }
          await ctx.close();
        }
      }
    }
  }
  check(!errors.length, `no console or page error${errors.length ? `: ${[...new Set(errors)].join(" | ")}` : ""}`);
} finally {
  await browser.close();
  await server.close();
}

let failed = 0;
for (const [ok, what] of results) { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failed += 1; }
console.log(`(screenshots in ${out})`);
if (failed) { console.log(`\n${failed} of ${results.length} checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed.\nGUIDE OK`);
