// Sims suite (browser): R1 to R3 replayed in Simulation in Chromium, in English and in German, at
// ?speed=1000. Each run pauses at every decision (the status waits and the console stands still), a
// cluster review accepts only the recorded action ("Set by the simulation"), and at the end the KPI tiles
// show exactly the figures the engines compute in Node from the same decisions (the production modules
// replayed headless), the dossier holds the approved item and the kept duties, and R2 shows the split,
// the blocked figure, the rejection and the duty kept with A1. No request leaves the page.
// Usage: node tests/sims.mjs [R1|R2|R3 …]
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT, launchBrowser, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";
import { startRun, waitDecision, waitReview, waitTone, decide, textOf } from "./lib/run-page.mjs";
import { loadBundled } from "./lib/data-node.mjs";

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
globalThis.sessionStorage = memoryStorage();
globalThis.localStorage = memoryStorage();
globalThis.location = { search: "" };
const { loadI18n } = await import("../js/i18n.js");
const { createRunState } = await import("../js/state.js");
const { replayRun } = await import("../js/simulation.js");
const { formatFactValue } = await import("../js/engine/format.js");
await loadI18n(async (p) => new Response(readFileSync(path.join(APP_ROOT, p))));

const strings = { en: JSON.parse(readFileSync(path.join(APP_ROOT, "js/i18n/en.json"), "utf8")), de: JSON.parse(readFileSync(path.join(APP_ROOT, "js/i18n/de.json"), "utf8")) };
const tr = (lang, key) => key.split(".").reduce((o, k) => o?.[k], strings[lang]);
const ONLY = process.argv.slice(2);
const RUNS = ["R1", "R2", "R3"].filter((r) => ONLY.length === 0 || ONLY.includes(r));
const readRun = (id) => JSON.parse(readFileSync(path.join(APP_ROOT, "data/runs", `${id}.json`), "utf8"));
const plain = (s) => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${String(detail).slice(0, 600)}` : ""}`); } };

/** The run's pauses in order: reviews and option decisions with the recorded intention. */
function pausesOf(run) {
  const out = [];
  for (const e of run.events) {
    if (e.type !== "tool_call" || e.payload.tool !== "ui_request_decision") continue;
    if (e.payload.input.cluster_id) out.push({ kind: "review", cluster_id: e.payload.input.cluster_id });
    else out.push({ kind: "option", target: e.payload.input.target, intended: e.payload.intended });
  }
  return out;
}

/** The engines' figures in Node for the same decisions (the intentions). */
async function expected(runId, lang) {
  const run = readRun(runId);
  const data = loadBundled(run.meta.norm_ids);
  const state = createRunState({ data, lang, runId, mode: "simulation" });
  await replayRun({ run, data, state, lang, awaitDecision: async (req) => { const i = req.intended; return state.decide({ option_id: i.option_id, decision: i.decision, reason_code: i.reason_code, comment: i.comment || "" }); } });
  const k = state.kpis();
  const f = (id) => plain(formatFactValue(state.facts.get(id), lang));
  return {
    duties: f(k.fact_ids.duties_confirmed), cost: f(k.fact_ids.ea_addressed),
    repShare: f(k.fact_ids.reporting_share), repAtt: f(k.fact_ids.reporting_attainment),
    docShare: f(k.fact_ids.documentation_share), docAtt: f(k.fact_ids.documentation_attainment),
    items: state.dossier.items.map((x) => x.option_id), kept: state.dossier.kept.map((x) => `${x.duty_id}:${x.reason_code}`)
  };
}

const server = await serveStatic(APP_ROOT, 8241);
const browser = await launchBrowser();
try {
  for (const runId of RUNS) {
    const run = readRun(runId);
    const pauses = pausesOf(run);
    for (const lang of ["en", "de"]) {
      const where = `${runId} ${lang.toUpperCase()}`;
      const want = await expected(runId, lang);
      const { page, ctx, problems, csp } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}&speed=1000`, viewport: { width: 1600, height: 1000 } });
      await startRun(page, { run: runId, mode: "simulation" });
      check(`${where}: the mode badge says SIMULATION`, await page.waitForFunction(() => document.querySelector("#mode-badge")?.dataset.mode === "simulation", null, { timeout: 5000 }).then(() => true, () => false));
      for (const [n, p] of pauses.entries()) {
        if (p.kind === "review") {
          await waitReview(page);
          await waitTone(page, "waiting", 10000);
          const before = await page.$$eval(".log .entry", (e) => e.length);
          await page.waitForTimeout(1200);
          check(`${where}: the replay stands still while review ${n + 1} waits`, (await page.$$eval(".log .entry", (e) => e.length)) === before);
          const recorded = run.events.find((e) => (e.type === "cluster_split" || e.type === "cluster_confirmed") && e.payload.cluster_id === p.cluster_id);
          const action = recorded?.type === "cluster_split" ? "split" : "confirm";
          const card = `#cluster-${p.cluster_id}`;
          // The other action is disabled with "Set by the simulation", and refused even when forced.
          const [confirmBtn, splitBtn] = await page.$$(`${card} .cluster-actions button`);
          const other = action === "split" ? confirmBtn : splitBtn;
          check(`${where}: the action that was not recorded is disabled with its reason`, (await other.getAttribute("aria-disabled")) === "true" && (await other.getAttribute("title")) === tr(lang, "sim.preset"));
          await other.click({ force: true });
          await page.waitForSelector(`${card} .field-msg`, { timeout: 5000 });
          check(`${where}: the review refuses the action that was not recorded`, (await textOf(page, `${card} .field-msg`)) === tr(lang, "sim.preset") && (await page.getAttribute(card, "data-pending")) === "true");
          if (action === "split") {
            const preset = await page.$$eval(`${card} .member-check input`, (els) => els.filter((i) => i.checked && i.disabled).map((i) => i.value));
            check(`${where}: the recorded split preselects its members, read-only`, JSON.stringify(preset) === JSON.stringify(recorded.payload.separate_ids), preset.join());
          }
          const [confirmNow, splitNow] = await page.$$(`${card} .cluster-actions button`);
          await (action === "split" ? splitNow : confirmNow).click();
          await page.waitForSelector(`${card}[data-pending="true"]`, { state: "detached", timeout: 10000 }).catch(() => {});
          check(`${where}: the recorded ${action} is applied`, action === "split" ? (await page.$$(`.log .entry[data-type="cluster_split"]`)).length === 1 : (await page.$$(`.log .entry[data-type="cluster_confirmed"]`)).length === 1);
        } else {
          await waitDecision(page);
          await waitTone(page, "waiting", 10000);
          const before = await page.$$eval(".log .entry", (e) => e.length);
          await page.waitForTimeout(1200);
          check(`${where}: the replay stands still while decision ${n + 1} waits`, (await page.$$eval(".log .entry", (e) => e.length)) === before);
          const i = p.intended;
          await decide(page, { option: i.option_id, code: i.reason_code, comment: i.comment || "", button: i.decision === "approved" ? "approve" : i.decision === "rejected" ? "reject" : "info" });
          await page.waitForFunction((id) => !document.querySelector(`#option-${id}[data-status="proposed"], #option-${id}[data-status="under_review"]`), i.option_id, { timeout: 10000 });
        }
      }
      await waitTone(page, "done");
      // The tiles show what the engines compute from the same decisions.
      const tiles = {
        duties: plain(await textOf(page, "#kpi-duties .kpi-value")), cost: plain(await textOf(page, "#kpi-cost .kpi-value")),
        repShare: plain(await textOf(page, "#kpi-reporting .kpi-gauge")), repAtt: plain(await textOf(page, "#kpi-reporting .kpi-bench .fact-ref")),
        docShare: plain(await textOf(page, "#kpi-documentation .kpi-gauge")), docAtt: plain(await textOf(page, "#kpi-documentation .kpi-bench .fact-ref"))
      };
      for (const k of ["duties", "cost", "repShare", "repAtt", "docShare", "docAtt"]) check(`${where}: tile ${k} equals the engine's fact`, tiles[k] === want[k], `${tiles[k]} vs ${want[k]}`);
      await page.click("#tab-outbox");
      const items = await page.$$eval("#panel-outbox .dossier-item", (els) => els.map((e) => e.id.replace(/^dossier-/, "")));
      check(`${where}: the dossier holds the approved items`, JSON.stringify(items) === JSON.stringify(want.items), `${items} vs ${want.items}`);
      const kept = await page.$$eval("#panel-outbox .kept-item", (els) => els.map((e) => `${e.id.replace(/^kept-/, "")}:${e.querySelector(".kept-code").textContent.split(" ")[0]}`));
      check(`${where}: the kept duties with their codes`, JSON.stringify(kept) === JSON.stringify(want.kept), `${kept} vs ${want.kept}`);
      if (runId === "R1") check(`${where}: R1 ends with an approved relief item`, want.items.length === 1 && items.length === 1);
      if (runId === "R2") {
        check(`${where}: R2 shows the blocked figure in the console`, (await page.$$('.log .entry[data-type="audit_failed"]')).length >= 1);
        check(`${where}: R2 has no relief item and keeps a duty with A1`, items.length === 0 && kept.length >= 1 && kept.every((x) => x.endsWith(":A1")));
        await page.click("#tab-audit");
        const events = await page.$$eval("#panel-audit tbody tr", (rows) => rows.map((r) => r.dataset.event));
        const decisions = await page.$$eval('#panel-audit tbody tr[data-event="decision_recorded"] .audit-detail', (els) => els.map((e) => e.textContent));
        check(`${where}: R2's split is in the audit`, events.includes("cluster_split"));
        check(`${where}: R2's rejection is in the audit`, decisions.some((d) => d.includes(tr(lang, "decision.rejected")) && d.includes("A1")), decisions.join(" | "));
      }
      check(`${where}: the console ends with the closing report`, (await page.$$('.log .narration[data-kind="report"]')).length === 1);
      check(`${where}: no CSP violation`, (await csp()).length === 0, (await csp()).join("; "));
      check(`${where}: no error and no request to another host`, problems.length === 0, problems.join("\n  - "));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`SIMS OK (${checks} checks, ${RUNS.join(", ")} in English and German)`);
