// Layout suite (browser): from 1920 × 1080 down to 1280 × 720 in both languages, on the start screen
// and with run R1 waiting for a decision (the duty map filled, the options open in the drawer), nothing
// scrolls sideways, no text is cut to an ellipsis or a line clamp, the header, control bar, centrepiece,
// console and drawer bar are all on screen, and the header stays within a quarter of the height; at
// 1920 × 1080 and 1280 × 720 all of that in the light and the dark theme too, each with a screenshot
// (sixteen in all, in the layout folder of the test output); at 360 px nothing scrolls sideways either.
// In the run, every step of the duty map's ink ramp keeps its printed count at 4.5:1 in both themes,
// and with a cell's duty cards open the map keeps its six columns beside them.
// The ellipsis check proves itself first on a control element that is cut on purpose.
// Usage: node tests/layout.mjs
import path from "node:path";
import { statSync } from "node:fs";
import { APP_ROOT, launchBrowser, outDir, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";
import { startRun, waitDecision } from "./lib/run-page.mjs";

const OUT = await outDir("layout");
const server = await serveStatic(APP_ROOT, 8233);
const browser = await launchBrowser();
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${detail}` : ""}`); } };
const SIZES = [[1920, 1080], [1600, 900], [1366, 768], [1280, 720]];
const SHOT_SIZES = new Set(["1920x1080", "1280x720"]);
const shots = [];

// Every visible element whose text the browser cuts: an ellipsis, or a line clamp that hides lines.
function cutText() {
  return [...document.querySelectorAll("body *")].filter((el) => {
    if (!el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden") return false;
    const ellipsis = s.textOverflow === "ellipsis" && s.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1;
    const clamp = s.webkitLineClamp && s.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1;
    return ellipsis || clamp;
  }).map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).join(".")}` : ""} "${el.textContent.trim().slice(0, 40)}"`);
}

/** The contrast of the printed count on each step of the duty map's ink ramp (1 to 6, and 0). */
function inkContrast() {
  const rgb = (css) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const x = c.getContext("2d");
    x.fillStyle = "#000";
    x.fillStyle = css;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const lum = (v) => { const f = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
  const host = document.querySelector(".map-table") || document.body;
  const out = {};
  for (const step of ["0", "1", "2", "3", "4", "5", "6"]) {
    const probe = document.createElement("span");
    probe.className = "map-count";
    probe.dataset.ink = step;
    probe.textContent = "12";
    host.append(probe);
    const s = getComputedStyle(probe);
    const [a, b] = [lum(rgb(s.color)), lum(rgb(s.backgroundColor))].sort((m, n) => n - m);
    out[step] = (a + 0.05) / (b + 0.05);
    probe.remove();
  }
  return out;
}

try {
  let controlled = false;
  for (const [width, height] of SIZES) {
    const key = `${width}x${height}`;
    for (const theme of SHOT_SIZES.has(key) ? ["light", "dark"] : ["light"]) {
      for (const lang of ["en", "de"]) {
        const { page, ctx, problems } = await openApp(browser, server.base, { viewport: { width, height }, query: `?lang=${lang}`, skipIntro: true, theme, colorScheme: theme });
        const where = `${width}×${height} ${theme} ${lang}`;
        await page.evaluate(() => document.fonts.ready);
        if (!controlled) {
          // The control: a span cut on purpose must be found, and is removed again before the checks.
          await page.evaluate(() => {
            const span = document.createElement("span");
            span.id = "cut-control";
            span.textContent = "a control text much wider than its box";
            Object.assign(span.style, { display: "inline-block", width: "24px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
            document.body.append(span);
          });
          const found = (await page.evaluate(cutText)).some((s) => s.startsWith("span#cut-control"));
          await page.evaluate(() => document.getElementById("cut-control")?.remove());
          check("the ellipsis check finds a control element cut on purpose", found);
          controlled = true;
        }
        check(`${where}: the ${theme} theme is applied`, await page.evaluate(() => document.documentElement.dataset.theme) === theme);
        check(`${where}: no sideways scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const cut = await page.evaluate(cutText);
        check(`${where}: no text cut to an ellipsis`, cut.length === 0, cut.join("; "));
        const boxes = await page.evaluate(() => Object.fromEntries(["header", "#controls", ".map-panel", "#console", ".drawer-tabs"].map((s) => {
          const r = document.querySelector(s)?.getBoundingClientRect();
          return [s, r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height } : null];
        })));
        for (const [sel, r] of Object.entries(boxes)) check(`${where}: ${sel} on screen`, r && r.height > 0 && r.top >= 0 && r.bottom <= height + 1 && r.left >= 0 && r.right <= width + 1, JSON.stringify(r));
        check(`${where}: the header takes at most a quarter of the height`, boxes.header && boxes.header.height <= height / 4, `${boxes.header?.height}`);
        if (SHOT_SIZES.has(key)) {
          const file = path.join(OUT, `vp-${key}-${theme}-${lang}.png`);
          await page.screenshot({ path: file });
          const ok = statSync(file, { throwIfNoEntry: false })?.size > 0;
          check(`${where}: screenshot written`, ok, file);
          if (ok) shots.push(file);
        }
        check(`${where}: no errors`, problems.length === 0, problems.join("; "));
        await ctx.close();

        // The same with run R1 waiting for a decision: the duty map filled, the options in the drawer.
        const run = await openApp(browser, server.base, { viewport: { width, height }, query: `?lang=${lang}&speed=1000`, skipIntro: true, theme, colorScheme: theme });
        const rwhere = `${where}, run waiting`;
        await startRun(run.page, { run: "R1" });
        await waitDecision(run.page);
        await run.page.waitForTimeout(300);
        await run.page.evaluate(() => document.fonts.ready);
        check(`${rwhere}: the duty map and the options are shown`, (await run.page.$$("button.map-count")).length > 10 && await run.page.isVisible("#panel-options .option-card"));
        check(`${rwhere}: no sideways scrolling`, await run.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const rcut = await run.page.evaluate(cutText);
        check(`${rwhere}: no text cut to an ellipsis`, rcut.length === 0, rcut.join("; "));
        const rboxes = await run.page.evaluate(() => Object.fromEntries(["header", "#controls", ".map-panel", "#console", ".drawer-tabs", "#btn-approve"].map((sel) => {
          const r = document.querySelector(sel)?.getBoundingClientRect();
          return [sel, r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height } : null];
        })));
        for (const [sel, r] of Object.entries(rboxes)) check(`${rwhere}: ${sel} on screen`, r && r.height > 0 && r.top >= 0 && r.bottom <= height + 1 && r.left >= 0 && r.right <= width + 1, JSON.stringify(r));
        check(`${rwhere}: the control bar keeps one row`, (await run.page.evaluate(() => document.querySelector("#controls").getBoundingClientRect().height)) <= 72);
        if (lang === "en") {
          const ink = await run.page.evaluate(inkContrast);
          for (const [step, ratio] of Object.entries(ink)) check(`${rwhere}: ink step ${step} keeps its count at 4.5:1`, ratio >= 4.5, ratio.toFixed(2));
        }
        if (SHOT_SIZES.has(key)) {
          const file = path.join(OUT, `run-${key}-${theme}-${lang}.png`);
          await run.page.screenshot({ path: file });
          const ok = statSync(file, { throwIfNoEntry: false })?.size > 0;
          check(`${rwhere}: screenshot written`, ok, file);
          if (ok) shots.push(file);
        }
        // The duty cards beside the map: the map's six columns still fit, nothing is cut.
        await run.page.click(".drawer-toggle");
        await run.page.click("button.map-count");
        await run.page.waitForSelector(".card-panel .duty-card", { timeout: 5000 });
        const fit = await run.page.evaluate(() => { const m = document.querySelector(".map-wrap"); return { scroll: m.scrollWidth, client: m.clientWidth }; });
        check(`${rwhere}: the map keeps its columns beside the duty cards`, fit.scroll <= fit.client + 1, JSON.stringify(fit));
        const ccut = await run.page.evaluate(cutText);
        check(`${rwhere}: with the duty cards open nothing is cut`, ccut.length === 0, ccut.join("; "));
        check(`${rwhere}: no errors`, run.problems.length === 0, run.problems.join("; "));
        await run.ctx.close();
      }
    }
  }
  const { page, ctx } = await openApp(browser, server.base, { viewport: { width: 360, height: 740 }, skipIntro: true });
  check("360 px: no sideways scrolling", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${await page.evaluate(() => document.documentElement.scrollWidth)}`);
  await ctx.close();
} finally {
  await browser.close();
  await server.close();
}
check("sixteen screenshots written", shots.length === 16, `${shots.length}`);
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`LAYOUT OK (${checks} checks, ${shots.length} screenshots in ${OUT})`);
