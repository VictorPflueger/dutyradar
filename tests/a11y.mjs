// Accessibility suite (browser), AC-26.
//   axe       axe-core (the development dependency, injected before the app) finds no serious or
//             critical violation on the six screens (Start, Duty map, Duplicates, Options & review,
//             Outbox, Assumptions & diagnostics) in the light and the dark theme, in English and in
//             German; the check proves itself first on a page with two planted violations
//   keyboard  the storyline by keyboard alone, with Tab, Shift+Tab, the arrow keys, Enter and Escape:
//             start R1 in Simulation from the mode dialog, open a cell's duty cards and close them with
//             Escape, reach the options from the console's "Review options", choose an option with the
//             arrow keys (the choice and the focus survive the panel's re-render), choose the reason code,
//             approve, open the outbox and export the dossier; Escape closes the drawer and the
//             Diagnostics dialog and gives the focus back; every stop shows a visible focus
// Usage: node tests/a11y.mjs [axe] [keyboard]
import path from "node:path";
import { readFile } from "node:fs/promises";
import { APP_ROOT, ONLY, launchBrowser, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";
import { startRun, waitDecision, waitTone, decide } from "./lib/run-page.mjs";

const AXE = { path: path.join(APP_ROOT, "node_modules/axe-core/axe.min.js") };
const want = (s) => ONLY.length === 0 || ONLY.includes(s);
let failed = 0;
let checks = 0;
let sectionFailed = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; sectionFailed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${String(detail).slice(0, 900)}` : ""}`); } };

/** Runs axe in the page: the serious and critical violations as "rule (impact): target". */
const axeRun = async (page) => page.evaluate(async () => {
  const res = await window.axe.run(document, { resultTypes: ["violations"] });
  return res.violations.filter((v) => ["serious", "critical"].includes(v.impact)).flatMap((v) => v.nodes.slice(0, 4).map((n) => `${v.id} (${v.impact}): ${n.target.join(" ")} – ${(n.failureSummary || "").split("\n").slice(1, 3).join(" ").trim()}`));
});

const server = await serveStatic(APP_ROOT, 8281);
const browser = await launchBrowser();
try {
  // ------------------------------------------------------------------------------------------- axe
  if (want("axe")) {
    sectionFailed = 0;
    {
      const { page, ctx } = await openApp(browser, server.base, { skipIntro: true, initScripts: [AXE] });
      check("axe-core is loaded in the page", await page.evaluate(() => typeof window.axe?.run === "function"));
      await page.evaluate(() => {
        const b = document.createElement("button");
        b.id = "planted-button";
        const i = document.createElement("img");
        i.id = "planted-img";
        i.src = "favicon.svg";
        document.querySelector(".centre").append(b, i);
      });
      const planted = await axeRun(page);
      check("the check finds the planted unnamed button and the image without alt", planted.some((v) => v.startsWith("button-name") && v.includes("#planted-button")) && planted.some((v) => v.startsWith("image-alt") && v.includes("#planted-img")), planted.join("\n  "));
      await ctx.close();
    }
    for (const theme of ["light", "dark"]) {
      for (const lang of ["en", "de"]) {
        const where = `${theme} ${lang}`;
        const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, theme, colorScheme: theme, initScripts: [AXE], query: `?lang=${lang}&speed=1000`, viewport: { width: 1600, height: 1000 } });
        const screen = async (name) => {
          const v = await axeRun(page);
          check(`${where} ${name}: no serious or critical violation`, v.length === 0, v.join("\n  "));
        };
        await screen("Start");
        await startRun(page, { run: "R1" });
        await waitDecision(page);
        await page.click('.centre-tab[data-view="dutymap"]');
        await page.click("tr[data-norm] td.map-cell button.map-count");
        await page.waitForSelector(".card-panel .duty-card", { timeout: 5000 });
        await screen("Duty map with its duty cards");
        await page.click('.centre-tab[data-view="duplicates"]');
        await screen("Duplicates");
        if ((await page.getAttribute("#tab-options", "aria-selected")) !== "true") await page.click("#tab-options");
        await page.evaluate(() => { for (const d of document.querySelectorAll("#panel-options details")) d.open = true; });
        await screen("Options & review");
        await decide(page, { option: "merge", code: "Z1" });
        await waitTone(page, "done");
        await page.click("#tab-outbox");
        await page.evaluate(() => { for (const d of document.querySelectorAll("#panel-outbox details")) d.open = true; });
        await screen("Outbox");
        await page.click("#btn-diagnostics");
        await page.waitForSelector(".diag-modal #diag-assumptions", { timeout: 5000 });
        await page.click("#btn-selftest");
        await page.waitForSelector('#selftest-status[data-tone="success"], #selftest-status[data-tone="danger"]', { timeout: 30000 });
        await screen("Assumptions & diagnostics");
        check(`${where}: no errors`, problems.length === 0, problems.join("; "));
        await ctx.close();
      }
    }
    console.log(sectionFailed ? "AXE FAILED" : "AXE OK");
  }

  // ------------------------------------------------------------------------------------ keyboard
  if (want("keyboard")) {
    sectionFailed = 0;
    for (const lang of ["en", "de"]) {
      const where = `keyboard ${lang}`;
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}&speed=1000`, viewport: { width: 1600, height: 1000 } });
      const focus = () => page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return { sel: "body" };
        const s = getComputedStyle(a);
        const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
        return { sel: `${a.tagName.toLowerCase()}${a.id ? `#${a.id}` : ""}${a.name ? `[name=${a.name}]` : ""}`, ring, visible: a.matches(":focus-visible") };
      });
      /** Presses Tab (or Shift+Tab) until the focus matches `selector`; false after `max` presses. */
      const tabTo = async (selector, { max = 900, back = false } = {}) => {
        for (let i = 0; i < max; i++) {
          if (await page.evaluate((s) => document.activeElement?.matches(s), selector)) return true;
          await page.keyboard.press(back ? "Shift+Tab" : "Tab");
        }
        return page.evaluate((s) => document.activeElement?.matches(s), selector);
      };
      const reach = async (selector, label, opts) => {
        const ok = await tabTo(selector, opts);
        const f = await focus();
        check(`${where}: ${label} is reached by Tab`, ok, f.sel);
        if (ok) check(`${where}: ${label} shows a visible focus`, f.ring && f.visible, JSON.stringify(f));
        return ok;
      };
      // Start R1 in Simulation.
      if (await reach("#btn-start", "Start agent")) await page.keyboard.press("Enter");
      await page.waitForSelector(".mode-modal", { timeout: 5000 });
      if (await reach("#start-simulation", "Start the simulation")) await page.keyboard.press("Enter");
      await waitDecision(page);
      await waitTone(page, "waiting", 10000);
      // A duty card by keyboard, closed with Escape; the focus goes back to its cell.
      if (await reach('.centre-tab[data-view="dutymap"]', "the Duty map view")) await page.keyboard.press("Enter");
      if (await reach("tr[data-norm] td.map-cell button.map-count", "a cell of the duty map")) {
        const cell = await page.evaluate(() => { const b = document.activeElement; return `${b.closest("tr").dataset.norm}|${b.closest("td").cellIndex}`; });
        await page.keyboard.press("Enter");
        await page.waitForSelector(".card-panel .duty-card", { timeout: 5000 });
        check(`${where}: the duty cards take the focus`, await page.evaluate(() => Boolean(document.activeElement?.closest(".card-panel"))), (await focus()).sel);
        await page.keyboard.press("Escape");
        await page.waitForSelector(".card-panel", { state: "detached", timeout: 5000 }).catch(() => {});
        check(`${where}: Escape closes the duty cards`, !(await page.$(".card-panel")));
        check(`${where}: the focus goes back to the cell`, await page.evaluate((c) => { const b = document.activeElement; return b?.matches("button.map-count") && `${b.closest("tr").dataset.norm}|${b.closest("td").cellIndex}` === c; }, cell), (await focus()).sel);
      }
      // The console's "Review options" leads into the options.
      if (await reach('.log .entry[data-type="decision_requested"] button', "Review options in the console")) await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
      check(`${where}: Review options moves the focus into the options`, await page.evaluate(() => Boolean(document.activeElement?.closest("#panel-options"))), (await focus()).sel);
      if (await reach('#panel-options input[name="option-choice"]', "the options")) {
        const before = await page.evaluate(() => document.activeElement.value);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        const moved = await page.evaluate(() => ({ focus: document.activeElement?.value, checked: document.querySelector('input[name="option-choice"]:checked')?.value }));
        check(`${where}: an arrow key chooses the next option and keeps the focus through the re-render`, moved.focus && moved.focus !== before && moved.checked === moved.focus, JSON.stringify(moved));
        await page.keyboard.press("ArrowUp");
        await page.waitForTimeout(200);
        const back = await page.evaluate(() => ({ focus: document.activeElement?.value, checked: document.querySelector('input[name="option-choice"]:checked')?.value }));
        check(`${where}: and back to the merge`, back.focus === before && back.checked === before && before.endsWith("-merge"), JSON.stringify(back));
      }
      if (await reach("#reason-code", "the reason code")) {
        for (let i = 0; i < 20 && (await page.$eval("#reason-code", (s) => s.value)) !== "Z1"; i++) await page.keyboard.press("ArrowDown");
        check(`${where}: Z1 is chosen by keyboard`, (await page.$eval("#reason-code", (s) => s.value)) === "Z1");
      }
      if (await reach("#btn-approve", "Approve", { max: 10 })) await page.keyboard.press("Enter");
      await waitTone(page, "done", 30000);
      check(`${where}: the merge is approved`, (await page.getAttribute('article.option-card[id$="-merge"]', "data-status")) === "approved");
      // The outbox and the export.
      if (await reach("#tab-outbox", "the Outbox tab", { max: 900, back: true })) await page.keyboard.press("Enter");
      check(`${where}: the outbox opens`, (await page.getAttribute("#tab-outbox", "aria-selected")) === "true");
      if (await reach("#export-dossier_md", "the Markdown export")) {
        const [d] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.keyboard.press("Enter")]);
        const text = await readFile(await d.path(), "utf8");
        check(`${where}: the dossier is exported by keyboard`, text.includes("C-046"), d.suggestedFilename());
      }
      // Escape closes the drawer and gives the focus to its tab.
      await page.keyboard.press("Escape");
      check(`${where}: Escape closes the drawer`, (await page.getAttribute("#drawer", "data-open")) === "false");
      check(`${where}: the focus goes to the drawer's tab`, await page.evaluate(() => document.activeElement?.id === "tab-outbox"), (await focus()).sel);
      // Escape closes the Diagnostics dialog and gives the focus back.
      if (await reach("#btn-diagnostics", "Diagnostics", { back: true })) await page.keyboard.press("Enter");
      await page.waitForSelector(".diag-modal", { timeout: 5000 });
      await page.keyboard.press("Escape");
      await page.waitForSelector(".diag-modal", { state: "detached", timeout: 5000 }).catch(() => {});
      check(`${where}: Escape closes Diagnostics`, !(await page.$(".diag-modal")));
      check(`${where}: the focus goes back to Diagnostics`, await page.evaluate(() => document.activeElement?.id === "btn-diagnostics"), (await focus()).sel);
      check(`${where}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
    console.log(sectionFailed ? "KEYBOARD STORYLINE FAILED" : "KEYBOARD STORYLINE OK");
  }
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`A11Y OK (${checks} checks)`);
