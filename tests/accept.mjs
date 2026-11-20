// Acceptance suite (browser). Live runs talk to the scripted stand-in (tests/lib/fake-claude.mjs) that
// answers api.anthropic.com inside the browser; no request reaches a real API and no key is real.
//   decisions  AC-19: no decision without a reason code; Z5 and A6 need a comment of at most 500
//              characters; keep needs A1 to A4 or A6; in English and German
//   caps       AC-22: a Live run whose model always asks for a tool never starts a 41st call; with high
//              usage no call starts once €3 are spent; both stops show and log cap_reached
//   key        AC-23: a dummy key never appears in localStorage, an export, the audit, a recording, the
//              page's text or the browser console
//   live       a Live run takes one norm end to end against the stand-in: tool calls in the console, a
//              decision, the dossier, the closing report, the cost meter and the audit with model, usage
//              and cost per call; the stand-in finds no protocol violation
//   modes      AC-31: the mode dialog offers Simulation, Live and Sovereign; Sovereign stays disabled
//              with "No sovereign endpoint configured"
//   exports    the four exports download with the names of the active language; the duty list has a
//              byte order mark, semicolons, the listed columns and decimal commas; the dossier holds
//              the approved item and the kept duties
// Usage: node tests/accept.mjs [section…]
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { APP_ROOT, launchBrowser, serveStatic, MOCK_KEY } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";
import { startRun, waitDecision, waitTone, decide, textOf, routeFakeClaude, enterKey } from "./lib/run-page.mjs";
import { createFakeClaude, toolUse } from "./lib/fake-claude.mjs";
import { liveScript } from "./lib/live-script.mjs";
import { usageCostUsd } from "../js/cost.js";
import { FX_USD_EUR } from "../js/config.js";
import { formatEur, formatCount } from "../js/engine/format.js";

const strings = { en: JSON.parse(readFileSync(path.join(APP_ROOT, "js/i18n/en.json"), "utf8")), de: JSON.parse(readFileSync(path.join(APP_ROOT, "js/i18n/de.json"), "utf8")) };
const tr = (lang, key, params = {}) => key.split(".").reduce((o, k) => o?.[k], strings[lang]).replace(/\{(\w+)\}/g, (m, n) => (params[n] ?? m));
const ONLY = process.argv.slice(2);
const want = (s) => ONLY.length === 0 || ONLY.includes(s);
const plain = (s) => String(s).replace(/[  ]/g, " ");
let failed = 0;
let checks = 0;
let sectionFailed = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; sectionFailed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${String(detail).slice(0, 700)}` : ""}`); } };
const section = async (name, token, fn) => {
  if (!want(name)) return;
  sectionFailed = 0;
  await fn();
  console.log(sectionFailed ? `${token.replace(" OK", "")} FAILED` : token);
};

/** Downloads what a click starts: { name, text }. */
async function download(page, selector) {
  const [d] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click(selector)]);
  return { name: d.suggestedFilename(), text: await readFile(await d.path(), "utf8") };
}

const server = await serveStatic(APP_ROOT, 8251);
const browser = await launchBrowser();
try {
  // ---------------------------------------------------------------------------------- decisions
  await section("decisions", "DECISIONS OK", async () => {
    for (const lang of ["en", "de"]) {
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}&speed=1000` });
      await startRun(page, { run: "R3" });
      await waitDecision(page);
      const err = async () => (await page.$("#panel-options .field-msg")) ? textOf(page, "#panel-options .field-msg") : "";
      const status = (id) => page.getAttribute(`#option-${id}`, "data-status");
      const lower = "O-D-enstatg_2017-p10-1-lower_frequency";
      const keep = "O-D-enstatg_2017-p10-1-keep";
      for (const button of ["approve", "reject", "info"]) {
        await decide(page, { option: lower, code: "", button });
        check(`${lang}: ${button} without a reason code is refused`, (await err()) === tr(lang, "error.decision.reason_required") && !["approved", "rejected", "needs_info"].includes(await status(lower)), `${await err()} / ${await status(lower)}`);
      }
      await decide(page, { option: lower, code: "Z5", comment: "" });
      check(`${lang}: Z5 without a comment is refused`, (await err()) === tr(lang, "error.decision.comment_required", { reason_code: "Z5" }));
      await decide(page, { option: lower, code: "Z5", comment: "x".repeat(501) });
      check(`${lang}: a comment of 501 characters is refused`, (await err()) === tr(lang, "error.decision.comment_too_long", { max: "500" }));
      await decide(page, { option: keep, code: "Z1" });
      check(`${lang}: keep with Z1 is refused`, (await err()).startsWith(tr(lang, "error.decision.reason_not_allowed", { reason_code: "Z1", allowed: "§" }).split("§")[0]) && (await status(keep)) !== "approved", await err());
      await decide(page, { option: keep, code: "A6", comment: "" });
      check(`${lang}: keep with A6 needs a comment`, (await err()) === tr(lang, "error.decision.comment_required", { reason_code: "A6" }));
      await decide(page, { option: keep, code: "A5" });
      check(`${lang}: keep with A5 is refused`, (await status(keep)) !== "approved" && (await err()) !== "");
      const comment = "y".repeat(500);
      await decide(page, { option: lower, code: "Z5", comment });
      await waitTone(page, "done");
      check(`${lang}: Z5 with a comment of 500 characters is saved`, (await status(lower)) === "approved");
      await page.click("#tab-outbox");
      check(`${lang}: the dossier item carries Z5 and the comment`, (await textOf(page, `#dossier-${lower}`)).includes(`Z5 ${tr(lang, "code.Z5")} · ${comment}`));
      check(`${lang}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------- modes
  await section("modes", "MODES OK", async () => {
    for (const lang of ["en", "de"]) {
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}` });
      await page.click("#btn-start");
      await page.waitForSelector(".mode-modal");
      const cards = await page.$$eval(".mode-card", (els) => els.map((e) => e.dataset.mode));
      check(`${lang}: three mode cards`, JSON.stringify(cards) === JSON.stringify(["simulation", "live", "sovereign"]), cards.join());
      check(`${lang}: Simulation and Live can start`, !(await page.isDisabled("#start-simulation")) && !(await page.isDisabled("#start-live")));
      check(`${lang}: Sovereign is disabled`, await page.isDisabled("#start-sovereign"));
      const reasonId = await page.getAttribute("#start-sovereign", "aria-describedby");
      check(`${lang}: its reason is "${tr(lang, "sovereign.none")}"`, reasonId && (await textOf(page, `#${reasonId}`)) === tr(lang, "sovereign.none"));
      check(`${lang}: Live says it needs a key`, (await textOf(page, ".mode-card[data-mode='live'] .mode-key")) === tr(lang, "mode.live_key_needed"));
      await page.keyboard.press("Escape");
      await page.waitForSelector(".mode-modal", { state: "detached" });
      check(`${lang}: no run starts from a closed dialog`, (await page.getAttribute("#mode-badge", "data-mode")) === "none");
      check(`${lang}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------- live
  await section("live", "LIVE E2E OK", async () => {
    const fake = createFakeClaude(liveScript());
    const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: "?lang=en" });
    await routeFakeClaude(page, fake);
    await startRun(page, { run: "R3", mode: "live" });
    await enterKey(page, MOCK_KEY);
    await page.waitForFunction(() => document.querySelector("#mode-badge")?.dataset.mode === "live", null, { timeout: 10000 });
    await waitDecision(page, 30000);
    check("the console shows the tool calls", (await page.$$(".log .entry[data-type='tool_call']")).length >= 10);
    check("the narration carries its AI label and EN tag", (await page.$$(".log .narration .ai-chip")).length >= 1 && (await textOf(page, ".log .narration .lang-tag")) === "EN");
    await decide(page, { option: "lower_frequency", code: "Z4" });
    await waitTone(page, "done", 30000);
    check("the stand-in found no protocol violation", fake.violations.length === 0, fake.violations.join("\n  - "));
    check("orchestrator and both sub-calls were called", fake.requests.filter((r) => r.kind === "classify").length === 1 && fake.requests.filter((r) => r.kind === "amend").length === 1);
    const eur = fake.requests.reduce((s, r) => s + usageCostUsd(r.req.model, { input_tokens: 1500, output_tokens: 600 }) * FX_USD_EUR, 0);
    const meter = plain(await textOf(page, "#cost-meter"));
    check("the cost meter shows the calls and the spend", meter === plain(tr("en", "controls.cost_meter", { calls: formatCount(fake.requests.length, "en"), max: "40", eur: formatEur(eur, "en"), budget: formatEur(3, "en") })), `${meter} (${fake.requests.length} requests, ${eur})`);
    check("the closing report is the model's", (await textOf(page, ".log .narration[data-kind='report']")).includes("Nothing is sent."));
    await page.click("#tab-outbox");
    check("the dossier holds the decision", (await page.$$("#panel-outbox .dossier-item")).length === 1 && (await textOf(page, "#panel-outbox .dossier-item")).includes("Z4"));
    await page.click("#tab-audit");
    const responses = await page.$$eval("#panel-audit tr[data-event='model_response'] .audit-detail", (els) => els.map((e) => e.textContent));
    check("the audit holds model, usage and cost for every call", responses.length === fake.requests.length && responses.every((d) => /(Sonnet|Haiku) 5\.5 · .*tokens in.* · €/.test(d)), responses.slice(0, 3).join(" | "));
    const requests = await page.$$eval("#panel-audit tr[data-event='model_request']", (els) => els.length);
    check("every call has its request in the audit", requests === fake.requests.length);
    check("no errors", problems.length === 0, problems.join("; "));
    await ctx.close();
  });

  // ---------------------------------------------------------------------------------- caps
  await section("caps", "CAPS OK", async () => {
    const always = (usage) => (n) => ({ blocks: [toolUse(`loop_${n}`, "law_list", { slice_id: "slice-1" })], stop: "tool_use", usage });
    const cases = [
      { name: "calls", usage: { input_tokens: 1500, output_tokens: 600 }, expect: 40 },
      { name: "cost", usage: { input_tokens: 400000, output_tokens: 600 } }
    ];
    const perCall = usageCostUsd("claude-sonnet-5-5", cases[1].usage) * FX_USD_EUR;
    cases[1].expect = Math.ceil(3 / perCall - 1e-9);
    for (const c of cases) {
      const fake = createFakeClaude([], { repeat: always(c.usage) });
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: "?lang=en" });
      await routeFakeClaude(page, fake);
      await startRun(page, { run: "R3", mode: "live" });
      await enterKey(page, MOCK_KEY);
      await waitTone(page, "stopped", 60000);
      await page.waitForTimeout(500);
      check(`${c.name} cap: exactly ${c.expect} calls were made`, fake.requests.length === c.expect, `${fake.requests.length} requests`);
      check(`${c.name} cap: the console shows cap_reached`, (await page.$$(".log .entry[data-type='cap_reached']")).length === 1);
      check(`${c.name} cap: the closing report comes from the template`, (await textOf(page, ".log .narration[data-kind='report']")).includes(tr("en", c.name === "cost" ? "report.capped_cost" : "report.capped_calls")));
      await page.click("#tab-audit");
      check(`${c.name} cap: the audit logs cap_reached`, (await page.$$("#panel-audit tr[data-event='cap_reached']")).length === 1);
      check(`${c.name} cap: the meter shows the stop`, (await page.getAttribute("#cost-meter", "data-tone")) === "stopped");
      check(`${c.name} cap: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------- key
  await section("key", "KEY PRIVACY OK", async () => {
    const key = `sk-ant-api03-${"DUMMYKEYdoNotUse".repeat(4)}-Q9`;
    const fake = createFakeClaude(liveScript());
    const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: "?lang=en&record=1" });
    const consoleText = [];
    page.on("console", (m) => consoleText.push(m.text()));
    await routeFakeClaude(page, fake);
    await startRun(page, { run: "R3", mode: "live" });
    await enterKey(page, key);
    await waitDecision(page, 30000);
    await decide(page, { option: "lower_frequency", code: "Z4" });
    await waitTone(page, "done", 30000);
    check("the key reached the stand-in", fake.requests.every((r) => r.headers["x-api-key"] === key));
    const files = [];
    await page.click("#tab-outbox");
    for (const kind of ["dossier_md", "dossier_html", "audit", "duties"]) files.push(await download(page, `#export-${kind}`));
    files.push(await download(page, "#btn-record"));
    check("five files downloaded", files.length === 5, files.map((f) => f.name).join());
    for (const f of files) check(`${f.name} holds no key`, !f.text.includes(key) && !/sk-ant-api03-[A-Za-z0-9_-]{20,}/.test(f.text));
    const recording = JSON.parse(files[4].text);
    check("the recording has no thinking block or signature", !/"thinking"|"signature"/.test(files[4].text) && recording.meta.source === "recorded");
    const audit = JSON.parse(files[2].text);
    check("the audit holds no authorization header value", !JSON.stringify(audit).includes(key) && audit.events.length > 0);
    check("control: the key is held in this tab's session storage", (await page.evaluate(() => sessionStorage.getItem("dr.anthropic.key"))) === key);
    const local = await page.evaluate(() => Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`).join("\n"));
    check("localStorage never holds the key", !local.includes(key), local);
    const mirrored = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("dr.audit.")).map((k) => sessionStorage.getItem(k)).join(""));
    check("the audit mirror in sessionStorage holds no key", mirrored.length > 0 && !mirrored.includes(key));
    check("the page's text never shows the key", !(await page.evaluate(() => document.body.innerText)).includes(key));
    check("the browser console never shows the key", !consoleText.join("\n").includes(key));
    check("no errors", problems.length === 0, problems.join("; "));
    await ctx.close();
  });

  // ---------------------------------------------------------------------------------- exports
  await section("exports", "EXPORTS OK", async () => {
    const stampRe = "\\d{8}-\\d{4}";
    // R1 in English: the approved merge.
    {
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: "?lang=en&speed=1000" });
      await startRun(page, { run: "R1" });
      await waitDecision(page);
      await decide(page, { option: "merge", code: "Z1" });
      await waitTone(page, "done");
      await page.click("#tab-outbox");
      const md = await download(page, "#export-dossier_md");
      const html = await download(page, "#export-dossier_html");
      const audit = await download(page, "#export-audit");
      const csv = await download(page, "#export-duties");
      check("English names", new RegExp(`^relief-dossier-R1-${stampRe}\\.md$`).test(md.name) && new RegExp(`^relief-dossier-R1-${stampRe}\\.html$`).test(html.name) && new RegExp(`^duty-radar-audit-R1-${stampRe}\\.json$`).test(audit.name) && /^duty-radar-duties-slice-1-\d{8}\.csv$/.test(csv.name), [md.name, html.name, audit.name, csv.name].join());
      check("the Markdown dossier holds the approved merge and the notice", md.text.includes("Merge · C-046") && md.text.includes("Z1 Duplicate collection") && md.text.includes("Nothing is sent."));
      check("the HTML dossier is a page of its own with the item", html.text.startsWith("<!DOCTYPE html>") && html.text.includes("Merge · C-046") && !/<script/i.test(html.text));
      const lines = csv.text.split("\r\n").filter(Boolean);
      check("the CSV starts with a byte order mark", csv.text.charCodeAt(0) === 0xfeff);
      check("the CSV has the listed columns, separated by semicolons", lines[0].replace(/^﻿/, "") === "id;norm;paragraph;type;addressee;trigger;frequency_per_year;recipient;data_items;confidence;status;html_url");
      const rows = lines.slice(1).map((l) => l.split(";"));
      check("every CSV row has twelve fields", rows.length > 500 && rows.every((r) => r.length === 12), `${rows.length} rows`);
      check("confidences use a decimal comma", rows.every((r) => r[9] === "" || /^\d(,\d+)?$/.test(r[9])) && rows.some((r) => r[9].includes(",")));
      const exported = JSON.parse(audit.text);
      check("the audit export holds the decision", exported.decisions.some((d) => d.option_id === "O-C-046-merge" && d.reason_code === "Z1"));
      await page.click("#tab-audit");
      check("each export is logged as export_created", (await page.$$("#panel-audit tr[data-event='export_created']")).length === 4);
      check("no errors (R1)", problems.length === 0, problems.join("; "));
      await ctx.close();
    }
    // R2 in German: the kept duty, German names.
    {
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: "?lang=de&speed=1000" });
      await startRun(page, { run: "R2" });
      const run = JSON.parse(readFileSync(path.join(APP_ROOT, "data/runs/R2.json"), "utf8"));
      for (const e of run.events.filter((x) => x.type === "tool_call" && x.payload.tool === "ui_request_decision")) {
        if (e.payload.input.cluster_id) {
          await page.waitForSelector('.cluster-card[data-pending="true"]', { timeout: 60000 });
          const buttons = await page.$$('.cluster-card[data-pending="true"] .cluster-actions button');
          await buttons[1].click();
          continue;
        }
        await waitDecision(page);
        const i = e.payload.intended;
        await decide(page, { option: i.option_id, code: i.reason_code, button: i.decision === "approved" ? "approve" : "reject" });
        await page.waitForFunction((id) => !document.querySelector(`#option-${id}[data-status="proposed"]`), i.option_id, { timeout: 10000 });
      }
      await waitTone(page, "done");
      await page.click("#tab-outbox");
      const md = await download(page, "#export-dossier_md");
      const csv = await download(page, "#export-duties");
      const audit = await download(page, "#export-audit");
      check("German names", new RegExp(`^entlastungsdossier-R2-${stampRe}\\.md$`).test(md.name) && /^pflichten-radar-pflichten-slice-1-\d{8}\.csv$/.test(csv.name) && new RegExp(`^pflichten-radar-audit-R2-${stampRe}\\.json$`).test(audit.name), [md.name, csv.name, audit.name].join());
      check("the German dossier lists the kept duty with A1", md.text.includes("Beibehaltene Pflichten") && /A1 EU-rechtlich vorgegeben/.test(md.text) && md.text.includes("Nichts wird versendet."));
      check("the same CSV columns in German", csv.text.split("\r\n")[0].replace(/^﻿/, "") === "id;norm;paragraph;type;addressee;trigger;frequency_per_year;recipient;data_items;confidence;status;html_url");
      check("no errors (R2)", problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`ACCEPT OK (${checks} checks)`);
