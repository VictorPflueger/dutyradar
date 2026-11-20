// Layout suite (browser): from 1920 × 1080 down to 1280 × 720 in both languages, on the start screen
// and with run R1 waiting for a decision (the duty map filled, the options open in the drawer), nothing
// scrolls sideways, no text is cut to an ellipsis or a line clamp, the header, control bar, centrepiece,
// console and drawer bar are all on screen, and the header stays within a quarter of the height; at
// 1920 × 1080 and 1280 × 720 all of that in the light and the dark theme too, each with a screenshot
// (sixteen in all, in the layout folder of the test output). In the run, every step of the duty map's
// ink ramp keeps its printed count at 4.5:1 in both themes, and with a cell's duty cards open the map
// keeps its six columns beside them. The ellipsis check proves itself first on a control element that
// is cut on purpose.
// Section small (AC-27), at 360 × 740 and 820 × 1000 in both languages: the views are one select menu
// (Duty map, Duplicates, Options & review, Outbox, Audit) that switches the centrepiece and opens the
// drawer's panels; the console is a modal drawer opened from a Console button (the focus stays inside
// it, the rest of the page is inert; Escape closes it and gives the
// focus back); the four tiles sit two by two; nothing scrolls sideways, idle, in a run waiting for its
// decision, with the console open and in every view; a screenshot of each state in light and dark.
// Usage: node tests/layout.mjs [wide] [small]
import path from "node:path";
import { statSync } from "node:fs";
import { APP_ROOT, ONLY, launchBrowser, outDir, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";
import { startRun, waitDecision, decide, waitTone } from "./lib/run-page.mjs";
import { readFileSync } from "node:fs";
const EN = JSON.parse(readFileSync(path.join(APP_ROOT, "js/i18n/en.json"), "utf8"));
const DE = JSON.parse(readFileSync(path.join(APP_ROOT, "js/i18n/de.json"), "utf8"));

const OUT = await outDir("layout");
const server = await serveStatic(APP_ROOT, 8233);
const browser = await launchBrowser();
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${detail}` : ""}`); } };
const SIZES = [[1920, 1080], [1600, 900], [1366, 768], [1280, 720]];
const SHOT_SIZES = new Set(["1920x1080", "1280x720"]);
const shots = [];
const want = (x) => ONLY.length === 0 || ONLY.includes(x);
const smallShots = [];

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
  for (const [width, height] of want("wide") ? SIZES : []) {
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
        const rboxes = await run.page.evaluate(() => Object.fromEntries(["header", "#controls", ".map-panel", "#console", ".drawer-tabs", "#btn-approve", "#btn-reject", "#btn-info"].map((sel) => {
          const r = document.querySelector(sel)?.getBoundingClientRect();
          return [sel, r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height } : null];
        })));
        for (const [sel, r] of Object.entries(rboxes)) check(`${rwhere}: ${sel} on screen`, r && r.height > 0 && r.top >= 0 && r.bottom <= height + 1 && r.left >= 0 && r.right <= width + 1, JSON.stringify(r));
        check(`${rwhere}: the control bar keeps one row`, (await run.page.evaluate(() => document.querySelector("#controls").getBoundingClientRect().height)) <= 72);
        // Beside the decision the console keeps its log in view: at least two lines of entries.
        const logView = await run.page.evaluate(() => { const l = document.querySelector("#console .log"); const s = getComputedStyle(l); return { content: l.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom), line: parseFloat(getComputedStyle(l.querySelector(".entry-body p") || l).lineHeight) || 20 }; });
        check(`${rwhere}: the console log shows at least two lines beside the open drawer`, logView.content >= 2 * logView.line, JSON.stringify(logView));
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
  // ---- small screens (AC-27) ------------------------------------------------------------------
  if (want("small")) {
    const before = failed;
    const VIEWS = ["dutymap", "duplicates", "options", "outbox", "audit"];
    // Nothing reaches past the window's right edge (the duty map, the slice table, Diagnostics and the
    // audit table included), and no scroll region scrolls sideways inside it.
    const sideways = (page) => page.evaluate(() => ({
      doc: document.documentElement.scrollWidth, vw: innerWidth,
      wide: [...document.querySelectorAll("body *")].filter((e) => { if (!e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest(".vc-visually-hidden"); }).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}.${String(e.className).split(" ")[0]} ${Math.round(e.getBoundingClientRect().right)}`),
      scrolls: [...document.querySelectorAll(".map-wrap, .slice-table-wrap, .diag-scroll, .audit-scroll, .audit-wrap, .log, .drawer-panel")].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).map((e) => `${e.className.split(" ")[0]} ${e.scrollWidth}/${e.clientWidth}`)
    }));
    const noSideways = async (page, where) => { const r = await sideways(page); check(`${where}: nothing scrolls sideways`, r.doc <= r.vw && r.wide.length === 0 && r.scrolls.length === 0, JSON.stringify(r)); };
    const shot = async (page, name) => { const file = path.join(OUT, `small-${name}.png`); await page.screenshot({ path: file, fullPage: false }); if (statSync(file, { throwIfNoEntry: false })?.size > 0) smallShots.push(file); };
    for (const [width, height] of [[360, 740], [820, 1000]]) {
      for (const theme of width === 360 ? ["light", "dark"] : ["light"]) {
        for (const lang of ["en", "de"]) {
          const where = `${width} px ${theme} ${lang}`;
          const { page, ctx, problems } = await openApp(browser, server.base, { viewport: { width, height }, query: `?lang=${lang}&speed=1000`, skipIntro: true, theme, colorScheme: theme });
          await page.evaluate(() => document.fonts.ready);
          // The select menu instead of the tabs.
          check(`${where}: the view menu is shown`, await page.isVisible("#view-select"));
          check(`${where}: the centre's tabs and the drawer's tab list give way to it`, !(await page.isVisible(".centre-tabs")) && !(await page.isVisible(".drawer-tablist")));
          const labels = await page.$$eval("#view-select option:not([hidden])", (os) => os.map((o) => o.textContent.trim()));
          const wantLabels = ["screen.dutymap", "screen.duplicates", "screen.options", "screen.outbox", "drawer.tab.audit"].map((k) => k.split(".").reduce((o, x) => o[x], lang === "de" ? DE : EN));
          check(`${where}: the menu offers Duty map, Duplicates, Options & review, Outbox and Audit`, JSON.stringify(labels) === JSON.stringify(wantLabels), labels.join(" | "));
          check(`${where}: the menu has a label`, Boolean(await page.$eval("#view-select", (s) => s.labels?.[0]?.textContent.trim() || s.getAttribute("aria-label"))));
          // The console drawer.
          check(`${where}: the console is closed`, !(await page.isVisible("#console")));
          check(`${where}: a Console button opens it`, await page.isVisible("#btn-console") && (await page.getAttribute("#btn-console", "aria-expanded")) === "false" && (await page.getAttribute("#btn-console", "aria-controls")) === "console");
          // The tiles two by two.
          const tiles = await page.$$eval("#kpis .kpi", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left)]; }));
          const rows = [...new Set(tiles.map(([top]) => top))];
          check(`${where}: the four tiles sit two by two`, tiles.length === 4 && rows.length === 2 && tiles.filter(([top]) => top === rows[0]).length === 2, JSON.stringify(tiles));
          await noSideways(page, `${where} idle`);
          if (width === 360 && lang === "en") await shot(page, `idle-${theme}`);
          // A run waiting for its decision.
          await startRun(page, { run: "R1" });
          await waitDecision(page);
          await page.waitForTimeout(200);
          check(`${where}: the decision opens the options in the drawer`, await page.isVisible("#panel-options .option-card"));
          check(`${where}: the menu shows Options & review`, (await page.$eval("#view-select", (s) => s.value)) === "options");
          await noSideways(page, `${where} run waiting`);
          if (width === 360 && lang === "en") await shot(page, `options-${theme}`);
          for (const v of VIEWS) {
            await page.selectOption("#view-select", v);
            await page.waitForTimeout(120);
            if (["dutymap", "duplicates"].includes(v)) check(`${where}: ${v} from the menu shows in the centre`, (await page.getAttribute(`.centre-tab[data-view="${v}"]`, "aria-pressed")) === "true" && (await page.getAttribute("#drawer", "data-open")) === "false");
            else check(`${where}: ${v} from the menu opens its panel`, (await page.getAttribute("#drawer", "data-open")) === "true" && await page.isVisible(`#panel-${v}`));
            await noSideways(page, `${where} ${v}`);
            if (width === 360 && lang === "en" && ["dutymap", "duplicates", "outbox"].includes(v)) await shot(page, `${v}-${theme}`);
          }
          // The console drawer: open, read, close with Escape.
          await page.click("#btn-console");
          await page.waitForTimeout(150);
          check(`${where}: the Console button opens the console`, await page.isVisible("#console .log") && (await page.getAttribute("#btn-console", "aria-expanded")) === "true");
          check(`${where}: the console takes the focus`, await page.evaluate(() => Boolean(document.activeElement?.closest("#console"))));
          const box = await page.locator("#console").boundingBox();
          check(`${where}: the console drawer fits the screen`, box && box.x >= 0 && box.x + box.width <= width + 1 && box.height > height / 2, JSON.stringify(box));
          await noSideways(page, `${where} console open`);
          if (width === 360 && lang === "en") await shot(page, `console-${theme}`);
          // A modal drawer: a dialog, the page behind it inert, the focus kept inside both ways.
          check(`${where}: the open console is a modal dialog`, (await page.getAttribute("#console", "role")) === "dialog" && (await page.getAttribute("#console", "aria-modal")) === "true");
          check(`${where}: the page behind the console is inert`, await page.evaluate(() => [".app-header", "#controls", ".map-panel", "#drawer", ".skip-link"].every((s) => document.querySelector(s)?.inert === true)));
          const escaped = [];
          for (const key of [...Array(14).fill("Tab"), ...Array(14).fill("Shift+Tab")]) {
            await page.keyboard.press(key);
            const inside = await page.evaluate(() => Boolean(document.activeElement?.closest("#console")));
            if (!inside) escaped.push(`${key} → ${await page.evaluate(() => `${document.activeElement?.tagName}#${document.activeElement?.id}.${document.activeElement?.className}`)}`);
          }
          check(`${where}: Tab and Shift+Tab keep the focus in the console`, escaped.length === 0, escaped.slice(0, 3).join("; "));
          await page.keyboard.press("Escape");
          await page.waitForTimeout(150);
          check(`${where}: Escape closes the console`, !(await page.isVisible("#console")) && (await page.getAttribute("#btn-console", "aria-expanded")) === "false");
          check(`${where}: the focus goes back to the Console button`, await page.evaluate(() => document.activeElement?.id === "btn-console"));
          check(`${where}: closed, the console is no dialog and the page is live again`, (await page.getAttribute("#console", "role")) === null && await page.evaluate(() => [".app-header", "#controls", ".map-panel", "#drawer"].every((s) => document.querySelector(s)?.inert === false)));
          // The console's close button.
          await page.click("#btn-console");
          await page.click("#console .console-close");
          check(`${where}: the console's close button closes it`, !(await page.isVisible("#console")));
          // With relief approved the largest figures stand in the tiles: every text stays inside its tile.
          await page.selectOption("#view-select", "options");
          await decide(page, { option: "O-C-046-merge", code: "Z1" });
          await waitTone(page, "done");
          const spill = await page.evaluate(() => [...document.querySelectorAll("#kpis .kpi *")].filter((e) => e.children.length === 0 && e.textContent.trim() && e.getClientRects().length).filter((e) => { const tile = e.closest(".kpi").getBoundingClientRect(); const r = e.getBoundingClientRect(); return e.scrollWidth > e.clientWidth + 1 || r.right > tile.right + 1 || r.left < tile.left - 1; }).map((e) => `"${e.textContent.trim()}" ${Math.round(e.getBoundingClientRect().right)}`));
          check(`${where}: every label and figure stays inside its tile`, spill.length === 0, spill.join("; "));
          if (width === 360 && lang === "de") { await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); document.querySelector("#kpis").scrollIntoView({ block: "start" }); }); await shot(page, `tiles-${theme}`); }
          // Diagnostics fits too.
          await page.click("#btn-diagnostics");
          await page.waitForSelector(".diag-modal", { timeout: 5000 });
          await noSideways(page, `${where} Diagnostics`);
          await page.keyboard.press("Escape");
          check(`${where}: no errors`, problems.length === 0, problems.join("; "));
          await ctx.close();
        }
      }
    }
    // Wide screens keep the tabs and the console in place.
    {
      const { page, ctx } = await openApp(browser, server.base, { viewport: { width: 1280, height: 720 }, skipIntro: true });
      check("1280 px: the tabs and the console stay, the menu and the Console button are not shown", await page.isVisible(".centre-tabs") && await page.isVisible(".drawer-tablist") && await page.isVisible("#console") && !(await page.isVisible("#view-select")) && !(await page.isVisible("#btn-console")));
      // A window that widens with the console drawer open gives the page back.
      await page.setViewportSize({ width: 360, height: 740 });
      await page.click("#btn-console");
      await page.waitForTimeout(100);
      const modal = await page.evaluate(() => document.querySelector(".app-header").inert);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(150);
      check("a console drawer open at 360 px is modal, and no longer once the window is 1280 px wide", modal === true && await page.evaluate(() => !document.querySelector(".app-header").inert && !document.getElementById("console").hasAttribute("role")));
      await ctx.close();
    }
    check("small-screen screenshots written", smallShots.length === 14, `${smallShots.length}`);
    console.log(failed > before ? "SMALL SCREEN FAILED" : `SMALL SCREEN OK (${smallShots.length} screenshots in ${OUT})`);
  }
} finally {
  await browser.close();
  await server.close();
}
if (want("wide")) check("sixteen screenshots written", shots.length === 16, `${shots.length}`);
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`LAYOUT OK (${checks} checks, ${shots.length + smallShots.length} screenshots in ${OUT})`);
