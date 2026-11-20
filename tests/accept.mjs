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
//   exports    AC-24: the four exports download with the names of the active language; the duty list
//              has a byte order mark, semicolons, the listed columns and decimal commas; the dossier
//              holds the approved item and the kept duties
//   figures    AC-20: every figure in the tiles, the option cards and the dossier opens "Where does this
//              figure come from?" with the engine's value, its label and its inputs; in both languages
//   assumptions AC-21: editing an assumption in Assumptions & diagnostics recomputes the facts, the
//              option cards and the tiles to the engine's values (an option that becomes ineligible
//              shows "no longer applies") and logs parameter_changed; in both languages
//   keep       AC-33: keep needs A1 to A4 or A6, closes the target's other options ("Target decided")
//              and lists the duty, or every member of a cluster, with code, comment and data uses
//              under the kept duties; in both languages
//   other      AC-35: a decision other than the recorded intention yields the engine's tiles, dossier
//              and closing report for that decision, and no text after it names the intended outcome
//   disclosures AC-25: a browser set to German opens in English; both disclosure lines show on each of
//              the six screens in the active language; the outbox says "Nothing is sent." in English
//              and "Nichts wird versendet." in German
//   print      printing gives the relief dossier (items, totals, kept duties, the footnote, the notice)
//              and the disclosure lines without the controls, the console, the drawer or the tiles,
//              whichever tab is open and with the drawer closed
//   runfigures the Diagnostics' run figures: duplicate data requests found, duties inventoried, minutes
//              per review decision and the acceptance rate, aggregated over the run
// Every expected figure comes from the engines, replayed in Node with the same decisions
// (tests/lib/story-node.mjs).
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
import { formatEur, formatCount, formatShare, formatNumber } from "../js/engine/format.js";
import { replayStory, plain as plainText } from "./lib/story-node.mjs";

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

  // ---------------------------------------------------------------------------------- figures
  await section("figures", "FIGURES OK", async () => {
    /** Opens every figure under `scope` in turn and checks the dialog against the engine's facts at that moment. */
    async function openEach(page, scope, lang, details, where) {
      const n = (await page.$$(`${scope} .fact-ref`)).length;
      check(`${where}: figures to open`, n > 0, scope);
      for (let i = 0; i < n; i++) {
        const btn = (await page.$$(`${scope} .fact-ref`))[i];
        const id = await btn.getAttribute("data-fact");
        const want = details[id];
        const text = plainText(await btn.textContent());
        check(`${where}: ${id} shows the engine's value`, want && text === want.text, `${text} vs ${want?.text}`);
        await btn.click();
        await page.waitForSelector(".fact-modal", { timeout: 5000 });
        check(`${where}: ${id} opens "${tr(lang, "fact.where")}"`, plainText(await textOf(page, ".fact-modal .vc-dialog__title")) === tr(lang, "fact.where"));
        check(`${where}: ${id}'s dialog shows its value`, plainText(await textOf(page, ".fact-modal .fact-value")) === text);
        check(`${where}: ${id}'s dialog shows its label`, plainText(await textOf(page, ".fact-modal .fact-head strong")) === plainText(want?.label), `${await textOf(page, ".fact-modal .fact-head strong")} vs ${want?.label}`);
        const inputs = await page.$$eval(".fact-modal .fact-inputs li", (els) => els.map((e) => ({ text: e.textContent, basis: Boolean(e.querySelector("code, .vc-tag")) })));
        if (want?.inputs.length) {
          check(`${where}: ${id}'s dialog lists its inputs`, inputs.length === want.inputs.length, `${inputs.length} vs ${want.inputs.length}`);
          check(`${where}: each input of ${id} names its source or Assumption`, want.inputs.every((inp, k) => !inp.startsWith("param:") || inputs[k]?.basis));
        } else check(`${where}: ${id} says it has no inputs`, inputs.length === 0 && plainText(await textOf(page, ".fact-modal .vc-dialog__body")).includes(tr(lang, "fact.no_inputs")));
        await page.keyboard.press("Escape");
        await page.waitForSelector(".fact-modal", { state: "detached", timeout: 5000 });
      }
      return n;
    }
    for (const lang of ["en", "de"]) {
      const story = await replayStory("R1", lang);
      const pause = story.pauses.find((p) => p.kind === "option");
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}&speed=1000`, viewport: { width: 1600, height: 1000 } });
      await startRun(page, { run: "R1" });
      await waitDecision(page);
      const a = await openEach(page, "#kpis", lang, pause.before.details, `${lang} tiles`);
      const b = await openEach(page, "#panel-options .option-cards", lang, pause.before.details, `${lang} option cards`);
      const c = pause.choice;
      await decide(page, { option: c.option_id, code: c.reason_code, comment: c.comment });
      await waitTone(page, "done");
      await page.click("#tab-outbox");
      const d = await openEach(page, "#panel-outbox", lang, story.final.details, `${lang} dossier`);
      await openEach(page, "#kpis", lang, story.final.details, `${lang} tiles at the end`);
      check(`${lang}: the dossier's totals open their figures too`, (await page.$$("#panel-outbox .dossier-totals .fact-ref")).length === 3);
      check(`${lang}: figures opened in tiles, cards and dossier`, a >= 6 && b >= 6 && d >= 4, `${a}, ${b}, ${d}`);
      check(`${lang}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------- assumptions
  await section("assumptions", "ASSUMPTIONS OK", async () => {
    const duty = "D-enstatg_2017-p10-1";
    const base = await replayStory("R3", "en");
    const minutes = base.state.paramsFor(duty).minutes_per_case;
    const edits = [{ atPause: 0, duty, field: "minutes_per_case", value: minutes + 15 }, { atPause: 0, duty, field: "frequency_per_year", value: 1 }];
    for (const lang of ["en", "de"]) {
      // The run ends with keep: the edit took lower frequency out of the options.
      const story = await replayStory("R3", lang, { edits, choose: (req) => ({ option_id: req.option_ids.find((id) => id.endsWith("-keep")), decision: "approved", reason_code: "A3", comment: "" }) });
      const pause = story.pauses[0];
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}&speed=1000`, viewport: { width: 1600, height: 1000 } });
      await startRun(page, { run: "R3" });
      await waitDecision(page);
      await page.click("#btn-diagnostics");
      await page.waitForSelector(".diag-modal #diag-assumptions .param-input", { timeout: 10000 });
      for (const [k, e] of edits.entries()) {
        const input = `.diag-modal #diag-assumptions tr[data-duty="${e.duty}"][data-field="${e.field}"] input`;
        await page.fill(input, String(e.value).replace(".", lang === "de" ? "," : "."));
        await page.press(input, "Enter");
        const ch = pause.edits[k].change;
        await page.waitForFunction((s) => document.querySelector(".diag-modal #diag-assumptions .diag-msg")?.dataset.tone === "success" && document.querySelector(".diag-modal #diag-assumptions .diag-msg").textContent === s, tr(lang, "diag.edited", { changed: formatCount(ch.changed.length, lang), retired: formatCount(ch.retired.length, lang) }), { timeout: 5000 })
          .then(() => check(`${lang}: edit ${k + 1} reports the engine's recomputation`, true), async () => check(`${lang}: edit ${k + 1} reports the engine's recomputation`, false, await textOf(page, ".diag-modal #diag-assumptions .diag-msg")));
      }
      check(`${lang}: the edited fields are marked as changed`, (await page.$$(`.diag-modal #diag-assumptions tr[data-duty="${duty}"] .vc-tag--accent`)).length === edits.length);
      await page.keyboard.press("Escape");
      await page.waitForSelector(".diag-modal", { state: "detached", timeout: 5000 });
      await page.waitForTimeout(150);
      const cards = await page.$$eval("#panel-options article.option-card", (els) => els.map((c) => ({ id: c.id.replace(/^option-/, ""), figures: [...c.querySelectorAll(".fact-ref")].map((b) => `${b.dataset.fact}=${b.textContent.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim()}`).sort() })));
      for (const c of pause.afterEdit.cards) {
        const want = Object.values(c.figures).map((f) => `${f.id}=${f.text}`).sort();
        const got = cards.find((x) => x.id === c.id)?.figures || [];
        check(`${lang}: option ${c.type} recomputed to the engine's figures`, JSON.stringify(got) === JSON.stringify(want), `${got.join(", ")} vs ${want.join(", ")}`);
      }
      // The option the edit made ineligible leaves the cards with its reason; its retired facts say "no longer applies".
      const gone = pause.before.cards.filter((c) => !pause.afterEdit.cards.some((x) => x.id === c.id));
      const target = story.state.targets.get(pause.target);
      check(`${lang}: the edit makes an option ineligible in the engine`, gone.length === 1 && pause.edits.some((e) => e.change.retired.length > 0), gone.map((c) => c.type).join());
      for (const c of gone) {
        check(`${lang}: ${c.type} leaves the option cards`, !cards.some((x) => x.id === c.id));
        const reason = target.ineligible?.find((x) => x.type === c.type)?.reason;
        check(`${lang}: ${c.type} is listed as ineligible with the engine's reason`, Boolean(reason) && plainText(await textOf(page, "#panel-options .ineligible")).includes(`${tr(lang, `option_type.${c.type}`)}: ${tr(lang, `reason.${reason}`)}`), `${reason} / ${await textOf(page, "#panel-options .ineligible").catch(() => "none")}`);
      }
      const retiredIds = pause.edits.flatMap((e) => e.change.retired);
      const shownRetired = await page.$$eval(".fact-ref", (bs, ids) => bs.filter((b) => ids.includes(b.dataset.fact)).map((b) => b.textContent.trim()), retiredIds);
      check(`${lang}: a figure that no longer applies says "${tr(lang, "fact.retired")}" wherever it is cited`, shownRetired.every((x) => x === tr(lang, "fact.retired")), shownRetired.join(", "));
      const consoleFigures = await page.$$eval(".log .fact-ref", (bs) => bs.map((b) => [b.dataset.fact, b.textContent]));
      const stale = consoleFigures.filter(([id, text]) => plainText(text) !== pause.afterEdit.facts[id]);
      check(`${lang}: every figure in the console shows the engine's value after the edits`, consoleFigures.length > 0 && stale.length === 0, stale.map(([id, text]) => `${id}=${text} vs ${pause.afterEdit.facts[id]}`).join(", "));
      const tileText = async (sel) => plainText(await textOf(page, sel));
      check(`${lang}: the pending figure recomputed`, ((await page.$("#kpi-cost .kpi-pending .fact-ref")) ? await tileText("#kpi-cost .kpi-pending .fact-ref") : null) === pause.afterEdit.tiles.pending, `${pause.afterEdit.tiles.pending}`);
      check(`${lang}: the duties tile is the engine's`, (await tileText("#kpi-duties .kpi-value")) === pause.afterEdit.tiles.duties);
      await page.click("#tab-audit");
      const rows = await page.$$eval('#panel-audit tbody tr[data-event="parameter_changed"]', (els) => els.map((r) => r.dataset.actor));
      check(`${lang}: each edit is logged as parameter_changed by the reviewer`, rows.length === edits.length && rows.every((a) => a === "human"), rows.join());
      check(`${lang}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------- keep
  await section("keep", "KEEP OK", async () => {
    const keepWith = (code, comment) => (req) => ({ option_id: req.option_ids.find((id) => id.endsWith("-keep")), decision: "approved", reason_code: code, comment });
    const cases = [
      { lang: "en", run: "R3", code: "A3", comment: "Needed for the energy balance." },
      { lang: "de", run: "R3", code: "A3", comment: "Für die Energiebilanz notwendig." },
      { lang: "en", run: "R1", code: "A2", comment: "" }
    ];
    for (const k of cases) {
      const where = `${k.run} ${k.lang}`;
      const story = await replayStory(k.run, k.lang, { choose: keepWith(k.code, k.comment) });
      const pause = story.pauses.find((p) => p.kind === "option");
      const keep = pause.choice.option_id;
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${k.lang}&speed=1000`, viewport: { width: 1600, height: 1000 } });
      await startRun(page, { run: k.run });
      await waitDecision(page);
      const err = async () => (await page.$("#panel-options .field-msg")) ? textOf(page, "#panel-options .field-msg") : "";
      for (const bad of ["Z2", "A5", "I1"]) {
        await decide(page, { option: keep, code: bad, comment: "x" });
        check(`${where}: keep with ${bad} is refused`, (await page.getAttribute(`#option-${keep}`, "data-status")) !== "approved" && (await err()) !== "", await err());
      }
      await decide(page, { option: keep, code: k.code, comment: k.comment });
      await waitTone(page, "done");
      check(`${where}: keep with ${k.code} is approved`, (await page.getAttribute(`#option-${keep}`, "data-status")) === "approved");
      for (const id of pause.option_ids.filter((x) => x !== keep)) {
        check(`${where}: ${id} says "${tr(k.lang, "options.target_decided")}"`, plainText(await textOf(page, `#option-${id} .option-head .vc-tag`)) === tr(k.lang, "options.target_decided"));
        check(`${where}: ${id} can no longer be chosen`, await page.isDisabled(`#option-${id} input[name="option-choice"]`));
      }
      await page.click("#tab-outbox");
      check(`${where}: no relief item`, (await page.$$("#panel-outbox .dossier-item")).length === 0);
      const kept = await page.$$eval("#panel-outbox .kept-item", (els) => els.map((e) => ({ id: e.id.replace(/^kept-/, ""), text: e.textContent.replace(/\s+/g, " ") })));
      check(`${where}: the kept duties are the engine's`, JSON.stringify(kept.map((x) => x.id)) === JSON.stringify(story.final.kept.map((x) => x.duty_id)) && kept.length >= 1, `${kept.map((x) => x.id)} vs ${story.final.kept.map((x) => x.duty_id)}`);
      for (const want of story.final.kept) {
        const got = kept.find((x) => x.id === want.duty_id)?.text || "";
        check(`${where}: ${want.duty_id} shows its code, comment and data uses`, got.includes(`${k.code} ${tr(k.lang, `code.${k.code}`)}`) && (!k.comment || got.includes(k.comment)) && (want.uses.length ? want.uses.every((u) => got.includes(u)) : got.includes(tr(k.lang, "outbox.no_uses"))), got);
      }
      const tiles = { duties: plainText(await textOf(page, "#kpi-duties .kpi-value")), cost: plainText(await textOf(page, "#kpi-cost .kpi-value")), repShare: plainText(await textOf(page, "#kpi-reporting .kpi-gauge")) };
      check(`${where}: the tiles are the engine's`, tiles.duties === story.final.tiles.duties && tiles.cost === story.final.tiles.cost && tiles.repShare === story.final.tiles.repShare, `${JSON.stringify(tiles)} vs ${JSON.stringify(story.final.tiles)}`);
      check(`${where}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------- other
  await section("other", "OTHER DECISION OK", async () => {
    const cases = [
      { lang: "en", run: "R1", choose: (req) => ({ option_id: req.option_ids.find((id) => id.endsWith("-register_retrieval")), decision: "approved", reason_code: "Z2", comment: "" }) },
      { lang: "de", run: "R3", choose: (req) => ({ option_id: req.intended.option_id, decision: "rejected", reason_code: "A3", comment: "" }) }
    ];
    for (const k of cases) {
      const where = `${k.run} ${k.lang}`;
      const story = await replayStory(k.run, k.lang, { choose: k.choose });
      const pause = story.pauses.find((p) => p.kind === "option");
      const choice = pause.choice;
      const intent = pause.intended;
      check(`${where}: the decision differs from the recording's intention`, choice.option_id !== intent.option_id || choice.decision !== intent.decision);
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${k.lang}&speed=1000`, viewport: { width: 1600, height: 1000 } });
      await startRun(page, { run: k.run });
      await waitDecision(page);
      await decide(page, { option: choice.option_id, code: choice.reason_code, comment: choice.comment, button: choice.decision === "approved" ? "approve" : "reject" });
      await waitTone(page, "done");
      const tiles = {
        duties: plainText(await textOf(page, "#kpi-duties .kpi-value")), cost: plainText(await textOf(page, "#kpi-cost .kpi-value")),
        repShare: plainText(await textOf(page, "#kpi-reporting .kpi-gauge")), repAtt: plainText(await textOf(page, "#kpi-reporting .kpi-bench .fact-ref")),
        docShare: plainText(await textOf(page, "#kpi-documentation .kpi-gauge")), docAtt: plainText(await textOf(page, "#kpi-documentation .kpi-bench .fact-ref"))
      };
      for (const t of Object.keys(tiles)) check(`${where}: tile ${t} is the engine's for this decision`, tiles[t] === story.final.tiles[t], `${tiles[t]} vs ${story.final.tiles[t]}`);
      await page.click("#tab-outbox");
      const items = await page.$$eval("#panel-outbox .dossier-item", (els) => els.map((e) => e.id.replace(/^dossier-/, "")));
      check(`${where}: the dossier holds what was decided`, JSON.stringify(items) === JSON.stringify(story.final.items), `${items} vs ${story.final.items}`);
      const report = await page.$eval('.log .narration[data-kind="report"]', (p) => p.textContent);
      check(`${where}: the closing report is the engine's for this decision`, plainText(report).endsWith(story.report), `${plainText(report)}\n  vs ${story.report}`);
      // Nothing after the decision names the intended outcome.
      const after = await page.$$eval(".log .entry", (es) => { const i = es.findIndex((e) => e.dataset.type === "decision_recorded"); return es.slice(i + 1).map((e) => e.textContent.replace(/\s+/g, " ")); });
      const intendedOption = story.state.options.get(intent.option_id);
      const banned = [intent.option_id, `${intent.reason_code} ${tr(k.lang, `code.${intent.reason_code}`)}`];
      if (intent.decision !== choice.decision || intent.option_id !== choice.option_id) banned.push(`${tr(k.lang, `option_type.${intendedOption.type}`)} · ${pause.target}`);
      const hits = after.filter((x) => banned.some((b) => x.includes(b)));
      check(`${where}: no text after the decision names the intended outcome`, after.length >= 1 && hits.length === 0, hits.join(" | "));
      const md = await (async () => { const [d] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("#export-dossier_md")]); return readFile(await d.path(), "utf8"); })();
      check(`${where}: the exported dossier does not name the intended outcome`, !md.includes(intent.option_id) && !md.includes(`${intent.reason_code} ${tr(k.lang, `code.${intent.reason_code}`)}`));
      check(`${where}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------- disclosures
  await section("disclosures", "DISCLOSURES OK", async () => {
    {
      const { page, ctx, problems } = await openApp(browser, server.base, { locale: "de-DE" });
      check("a German browser's first visit opens in English", (await page.getAttribute("html", "lang")) === "en" && (await textOf(page, ".brand-sub")) === tr("en", "app.subtitle") && (await textOf(page, ".intro-modal .vc-dialog__title")) === tr("en", "intro.title"));
      check("no errors (first visit)", problems.length === 0, problems.join("; "));
      await ctx.close();
    }
    for (const lang of ["en", "de"]) {
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}&speed=1000`, viewport: { width: 1600, height: 1000 } });
      const lines = async (screen) => {
        for (const [sel, key] of [[".ai-disclosure", "disclosure.ai"], [".proto-disclosure", "disclosure.proto"]]) {
          const box = await page.locator(sel).boundingBox();
          const vh = page.viewportSize().height;
          check(`${lang} ${screen}: "${tr(lang, key)}" shows`, await page.isVisible(sel) && plainText(await textOf(page, sel)) === tr(lang, key) && box && box.y >= 0 && box.y + box.height <= vh, `${await textOf(page, sel)} ${JSON.stringify(box)}`);
        }
      };
      await lines("Start");
      await startRun(page, { run: "R1" });
      await waitDecision(page);
      await page.click('.centre-tab[data-view="dutymap"]');
      await lines("Duty map");
      await page.click('.centre-tab[data-view="duplicates"]');
      await lines("Duplicates");
      await page.click("#tab-options");
      if ((await page.getAttribute("#tab-options", "aria-selected")) !== "true") await page.click("#tab-options");
      await lines("Options & review");
      await decide(page, { option: "merge", code: "Z1" });
      await waitTone(page, "done");
      await page.click("#tab-outbox");
      await lines("Outbox");
      check(`${lang}: the outbox says "${tr(lang, "outbox.notice")}"`, plainText(await textOf(page, "#panel-outbox .outbox-notice")) === tr(lang, "outbox.notice") && tr(lang, "outbox.notice") === (lang === "de" ? "Nichts wird versendet." : "Nothing is sent."));
      await page.click("#btn-diagnostics");
      await page.waitForSelector(".diag-modal", { timeout: 5000 });
      await lines("Assumptions & diagnostics");
      check(`${lang}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------- print
  await section("print", "PRINT OK", async () => {
    for (const [lang, run] of [["en", "R1"], ["de", "R2"]]) {
      const story = await replayStory(run, lang);
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}&speed=1000`, viewport: { width: 1280, height: 720 } });
      await startRun(page, { run });
      for (const p of story.pauses) {
        if (p.kind === "review") {
          await page.waitForSelector('.cluster-card[data-pending="true"]', { timeout: 60000 });
          const buttons = await page.$$('.cluster-card[data-pending="true"] .cluster-actions button');
          await buttons[p.action === "split" ? 1 : 0].click();
          continue;
        }
        await waitDecision(page);
        await decide(page, { option: p.choice.option_id, code: p.choice.reason_code, comment: p.choice.comment, button: p.choice.decision === "approved" ? "approve" : "reject" });
        await page.waitForFunction((id) => !document.querySelector(`#option-${id}[data-status="proposed"], #option-${id}[data-status="under_review"]`), p.choice.option_id, { timeout: 10000 });
      }
      await waitTone(page, "done");
      // Another tab open and then the drawer closed: printing still gives the dossier.
      await page.click("#tab-audit");
      for (const closed of [false, true]) {
        if (closed) await page.evaluate(() => document.querySelector(".drawer-toggle")?.click());
        await page.emulateMedia({ media: "print" });
        const where = `${lang} ${run}${closed ? " with the drawer closed" : " with the audit tab open"}`;
        const shownSel = ["#print-dossier .outbox-title", "#print-dossier .dossier-totals", "#print-dossier .dossier-footnote", "#print-dossier .outbox-notice", ".brand-name", ".ai-disclosure", ".proto-disclosure"];
        if (story.final.items.length) shownSel.push("#print-dossier .dossier-item");
        if (story.final.kept.length) shownSel.push("#print-dossier .kept-item");
        for (const sel of shownSel) check(`${where}: ${sel} prints`, await page.isVisible(sel));
        for (const sel of ["#controls", "#console", "#drawer", "#centre", "#kpis", ".header-badges", ".skip-link", "#print-dossier button"]) check(`${where}: ${sel} does not print`, !(await page.isVisible(sel)));
        const printed = await page.$$eval("#print-dossier .dossier-item, #print-dossier .kept-item", (els) => els.map((e) => e.dataset.option || e.dataset.duty));
        check(`${where}: the printed dossier holds the engine's items and kept duties`, JSON.stringify(printed) === JSON.stringify([...story.final.items, ...story.final.kept.map((k) => k.duty_id)]), `${printed} vs ${story.final.items} ${story.final.kept.map((k) => k.duty_id)}`);
        check(`${where}: the printed totals are the engine's`, plainText(await textOf(page, "#print-dossier .dossier-totals")) === story.final.totals);
        check(`${where}: the printed dossier repeats no id of the screen`, await page.evaluate(() => [...document.querySelectorAll("#print-dossier [id]")].length === 0));
        const width = await page.evaluate(() => document.querySelector("#print-dossier").getBoundingClientRect().width / document.documentElement.clientWidth);
        check(`${where}: the dossier takes the page's width`, width > 0.9, String(width));
        await page.emulateMedia({ media: "screen" });
      }
      check(`${lang}: on screen the print copy stays hidden`, !(await page.isVisible("#print-dossier")));
      check(`${lang}: back on screen the controls are there again`, await page.isVisible("#controls") && await page.isVisible("#console"));
      check(`${lang}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });

  // ---------------------------------------------------------------------------------- runfigures
  await section("runfigures", "RUN FIGURES OK", async () => {
    for (const [lang, run] of [["de", "R2"], ["en", "R1"]]) {
      const story = await replayStory(run, lang);
      const relief = story.state.decisions.filter((d) => story.state.options.get(d.option_id)?.type !== "keep");
      const rate = relief.length ? plainText(formatShare(relief.filter((d) => d.decision === "approved").length / relief.length, lang)) : "–";
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}&speed=1000`, viewport: { width: 1600, height: 1000 } });
      await startRun(page, { run });
      for (const p of story.pauses) {
        if (p.kind === "review") {
          await page.waitForSelector('.cluster-card[data-pending="true"]', { timeout: 60000 });
          const buttons = await page.$$('.cluster-card[data-pending="true"] .cluster-actions button');
          await buttons[p.action === "split" ? 1 : 0].click();
          continue;
        }
        await waitDecision(page);
        await page.waitForTimeout(300);
        await decide(page, { option: p.choice.option_id, code: p.choice.reason_code, comment: p.choice.comment, button: p.choice.decision === "approved" ? "approve" : "reject" });
        await page.waitForFunction((id) => !document.querySelector(`#option-${id}[data-status="proposed"], #option-${id}[data-status="under_review"]`), p.choice.option_id, { timeout: 10000 });
      }
      await waitTone(page, "done");
      await page.click("#btn-diagnostics");
      await page.waitForSelector(".diag-modal #diag-run", { timeout: 5000 });
      const rows = Object.fromEntries(await page.$$eval(".diag-modal #diag-run tr", (trs) => trs.map((r) => [r.querySelector("th")?.textContent.trim(), r.querySelector("td")?.textContent.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim()])));
      const row = (key) => rows[tr(lang, key)];
      check(`${lang} ${run}: duplicate data requests found`, row("diag.fig_clusters") === story.final.clusters, `${row("diag.fig_clusters")} vs ${story.final.clusters}`);
      check(`${lang} ${run}: duties inventoried`, row("diag.fig_duties") === story.final.duties, `${row("diag.fig_duties")} vs ${story.final.duties}`);
      check(`${lang} ${run}: acceptance rate`, row("diag.fig_acceptance") === rate, `${row("diag.fig_acceptance")} vs ${rate}`);
      const minutes = row("diag.fig_minutes") || "";
      const pattern = new RegExp(`^${tr(lang, "diag.fig_minutes_value", { minutes: "§" }).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("§", lang === "de" ? "\\d+(,\\d)?" : "\\d+(\\.\\d)?")}$`);
      check(`${lang} ${run}: minutes per review decision, the median`, pattern.test(minutes), minutes);
      check(`${lang} ${run}: the figures are aggregated, never per person`, plainText(await textOf(page, ".diag-modal #diag-run .diag-note")) === tr(lang, "diag.fig_note"));
      check(`${lang}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  });
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`ACCEPT OK (${checks} checks)`);
