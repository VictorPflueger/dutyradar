// What every suite reads: the story, the inventory, the words of js/story.js and js/explain.js, and, for
// the browser suites, a page at a step with helpers to open what a count counts. Node.js only.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "./harness.mjs";

const load = (file, name) => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(APP_ROOT, file), "utf8"), sandbox);
  return sandbox.window[name];
};
export const D = load("data/story.js", "DUTY_RADAR");
export const I = existsSync(path.join(APP_ROOT, "data/inventory.js")) ? load("data/inventory.js", "DUTY_RADAR_INVENTORY") : null;
export const S = await import(pathToFileURL(path.join(APP_ROOT, "js/story.js")).href);
export const X = existsSync(path.join(APP_ROOT, "js/explain.js")) ? await import(pathToFileURL(path.join(APP_ROOT, "js/explain.js")).href) : null;
export const C = await import(pathToFileURL(path.join(APP_ROOT, "js/copy.js")).href);
export const F = S.factsOf(D);
export const W = { en: S.words(F, "en"), de: S.words(F, "de") };
export const LANGS = ["en", "de"];
export const NAME = { en: "English", de: "German" };
/** Text as read: soft hyphens out, every run of spaces (no-break ones included) as one space. */
export const norm = (s) => String(s ?? "").replace(/­/g, "").replace(/\s+/g, " ").trim();
export const close = (a, b) => Math.abs(a - b) < 1e-6;

/** A suite's checks, printed as PASS/FAIL lines; ends the process with the marker or exit 1. */
export function checks() {
  const results = [];
  const check = (ok, what) => { results.push([!!ok, what]); return !!ok; };
  const finish = (marker) => {
    let failed = 0;
    for (const [ok, what] of results) { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failed += 1; }
    if (failed || !results.length) { console.log(`\n${failed} of ${results.length} checks failed.`); process.exit(1); }
    console.log(`\nAll ${results.length} checks passed.\n${marker}`);
  };
  return { check, finish, results };
}

// ---- in the browser ---------------------------------------------------------------------------------------

/** Goes to step `index` (0 to 4), optionally decides, and waits for the page to settle. */
export async function atStep(page, index, decision = null) {
  await page.evaluate(([i]) => { window.dutyRadar.closePanel?.(); window.dutyRadar.restart(); window.dutyRadar.goTo(i); }, [index]);
  if (decision) await page.click(`#decision [data-choice="${decision}"]`);
  await page.waitForTimeout(120);
}

/** Clicks the element and waits until the panel shows a finished list of that kind. */
export async function openFrom(page, selector, { key = false } = {}) {
  const el = page.locator(selector).first();
  if (key) { await el.focus(); await page.keyboard.press("Enter"); } else await el.click();
  await page.waitForFunction(() => { const p = document.getElementById("panel"); return p && p.open && p.dataset.ready === "true"; }, null, { timeout: 8000 });
  return panelState(page);
}

/** What the panel shows: its kind, title, items and filters. */
export const panelState = (page) => page.evaluate(() => {
  const p = document.getElementById("panel");
  const text = (el) => (el ? el.textContent.replace(/­/g, "").replace(/\s+/g, " ").trim() : "");
  return {
    open: p.open, kind: p.dataset.kind, title: text(document.getElementById("panel-title")), sub: text(document.getElementById("panel-sub")),
    duties: [...p.querySelectorAll("li.duty")].filter((li) => !li.hidden).map((li) => li.dataset.id),
    discarded: [...p.querySelectorAll("li.discarded")].filter((li) => !li.hidden).map((li) => li.dataset.id),
    clusters: [...p.querySelectorAll("li.cluster")].map((li) => ({ members: li.querySelectorAll("li.member").length, priced: li.dataset.priced === "true", text: text(li) })),
    filters: [...p.querySelectorAll("button.filter")].map((b) => ({ id: b.dataset.filter, pressed: b.getAttribute("aria-pressed") === "true", count: Number(b.dataset.count), text: text(b) })),
    body: text(document.getElementById("panel-body"))
  };
});

export const closePanel = async (page) => { await page.keyboard.press("Escape"); await page.waitForTimeout(80); };

/** The laws the map marks highlighted, selected and paired. */
export const mapState = (page) => page.evaluate(() => {
  const rows = [...document.querySelectorAll("#lawmap button.law")];
  return {
    hl: rows.filter((r) => r.dataset.hl === "true").map((r) => r.dataset.id).sort(),
    selected: rows.filter((r) => r.dataset.selected === "true").map((r) => r.dataset.id),
    pair: Object.fromEntries(rows.filter((r) => r.dataset.pick).map((r) => [r.dataset.id, r.dataset.pick])),
    shown: Object.fromEntries(rows.map((r) => [r.dataset.id, { name: r.querySelector(".law-name").textContent.replace(/­/g, ""), duties: r.querySelector(".law-duties").textContent.replace(/\D/g, ""), twice: r.querySelector(".law-twice").textContent.replace(/\D/g, "") }]))
  };
});
