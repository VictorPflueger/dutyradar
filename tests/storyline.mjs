// Storyline suite (browser): the eight-minute storyline as the audience sees it (DEMO_SCRIPT.md), in
// English and in German, with every figure the test expects worked out by the engines in Node from the
// same recording and the same decisions (tests/lib/story-node.mjs). AC-17 and AC-18.
//   R1  the full slice: the intro asks the question and both gauges stand at 0 % with the note "Slice
//       only, not the national target"; Start agent opens the mode dialog and the run is labelled
//       SIMULATION throughout; every role of the team takes its turn, the duty map fills and the duties
//       tile counts up; a cell opens a duty card with the highlighted trigger phrase, the § link and the
//       legal-status note; the duplicates board leads with the top cluster (shared items, members with
//       citations and recipients, the simulated register, the € figure); the run pauses for the decision
//       with up to three costed options plus keep, after the fact auditor blocked an unsourced figure and
//       the agent re-drafted; the approval moves the tiles to the engine's figures; the dossier shows the
//       totals, citations and draft wording and downloads; "Nothing is sent."; the closing report; then
//       R3 replays as the closing act without a network.
//   R2  the rejection path: the cluster review waits with the recorded split, the split is in the audit,
//       the blocked figure in the console, the rejection with A1, the duty kept with A1 under the kept
//       duties and no relief item, with tiles equal to the engine's facts.
// No request leaves the page. --browser=firefox or --browser=webkit runs it in those browsers (AC-17).
// Usage: node tests/storyline.mjs [R1] [R2] [--browser=chromium|firefox|webkit]
import { readFile } from "node:fs/promises";
import { APP_ROOT, BROWSER_NAME, ONLY, launchBrowser, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";
import { waitDecision, waitReview, waitTone, decide, textOf } from "./lib/run-page.mjs";
import { replayStory, evidence, plain, t } from "./lib/story-node.mjs";
import { formatShare } from "../js/engine/format.js";

const DUTY_TYPES = ["MELDEPFLICHT", "NACHWEISPFLICHT", "INFORMATIONSPFLICHT", "DOKUMENTATIONSPFLICHT", "EVALUIERUNGSPFLICHT", "KONTROLLPFLICHT"];
const ROLES = ["corpus", "duty_extractor", "once_matcher", "cost", "signal", "drafting", "fact_auditor"];
const RUNS = ["R1", "R2"].filter((r) => ONLY.length === 0 || ONLY.includes(r));
const SPEED = 1000;
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL [${BROWSER_NAME}] ${label}${detail ? `\n  - ${String(detail).slice(0, 700)}` : ""}`); } };
const txt = async (page, sel) => plain(await textOf(page, sel));
const buttonOf = (d) => d.decision === "approved" ? "approve" : d.decision === "rejected" ? "reject" : "info";

/** Records, in the page, every value the duties tile shows and every role the strip marks as active. */
const watch = () => {
  window.__ticks = [];
  window.__roles = new Set();
  window.__badges = [];
  const kpis = document.getElementById("kpis");
  const read = () => {
    const v = document.querySelector("#kpi-duties .kpi-value")?.textContent.trim();
    if (v && v !== window.__ticks[window.__ticks.length - 1]) window.__ticks.push(v);
  };
  new MutationObserver(read).observe(kpis, { childList: true, subtree: true, characterData: true });
  const strip = document.querySelector(".role-strip");
  new MutationObserver(() => { for (const s of strip.querySelectorAll('.rail-step[data-state="active"]')) window.__roles.add(s.dataset.step); }).observe(strip, { childList: true, subtree: true, attributes: true });
  const badge = document.getElementById("mode-badge");
  new MutationObserver(() => window.__badges.push(badge.dataset.mode)).observe(badge, { attributes: true, childList: true, characterData: true, subtree: true });
};

/** The header's four tiles as the page shows them. */
async function pageTiles(page) {
  return {
    duties: await txt(page, "#kpi-duties .kpi-value"), cost: await txt(page, "#kpi-cost .kpi-value"),
    repShare: await txt(page, "#kpi-reporting .kpi-gauge"), repAtt: await txt(page, "#kpi-reporting .kpi-bench .fact-ref"),
    docShare: await txt(page, "#kpi-documentation .kpi-gauge"), docAtt: await txt(page, "#kpi-documentation .kpi-bench .fact-ref"),
    pending: (await page.$("#kpi-cost .kpi-pending .fact-ref")) ? await txt(page, "#kpi-cost .kpi-pending .fact-ref") : null
  };
}
const TILE_KEYS = ["duties", "cost", "repShare", "repAtt", "docShare", "docAtt", "pending"];
function compareTiles(where, got, want) {
  for (const k of TILE_KEYS) check(`${where}: tile ${k} equals the engine's fact`, got[k] === want[k], `${got[k]} vs ${want[k]}`);
}

/** Downloads what a click starts: { name, text }. */
async function download(page, selector) {
  const [d] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.click(selector)]);
  return { name: d.suggestedFilename(), text: await readFile(await d.path(), "utf8") };
}

/** The option cards of the decision as the page shows them. */
async function pageCards(page) {
  return page.$$eval("#panel-options article.option-card", (cards) => cards.map((c) => ({
    id: c.id.replace(/^option-/, ""), type: c.dataset.type,
    figures: [...c.querySelectorAll(".fact-ref")].map((b) => ({ id: b.dataset.fact, text: b.textContent.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim() }))
  })));
}

async function r1Story(browser, server, lang) {
  const where = `R1 ${lang.toUpperCase()}`;
  const story = await replayStory("R1", lang);
  const pause = story.pauses.find((p) => p.kind === "option");
  // ---- 0:00 Hook: a first visit opens the intro with the question; both gauges stand at 0 %.
  const { page, ctx, problems, csp } = await openApp(browser, server.base, { query: `?lang=${lang}&speed=${SPEED}`, viewport: { width: 1600, height: 1000 } });
  await page.waitForSelector(".intro-modal", { timeout: 5000 });
  check(`${where}: the intro asks the question`, (await txt(page, ".intro-modal .dialog-lead")) === t("start.question", {}, lang));
  const zero = plain(formatShare(0, lang));
  for (const id of ["reporting", "documentation"]) {
    check(`${where}: the ${id} gauge stands at 0 %`, (await txt(page, `#kpi-${id} .kpi-gauge`)) === zero, await txt(page, `#kpi-${id} .kpi-gauge`));
    check(`${where}: the ${id} gauge notes "slice only, not the national target"`, ((await page.getAttribute(`#kpi-${id}`, "title")) || "").includes(t("kpi.slice_note", {}, lang)));
  }
  await page.click(".intro-modal .vc-dialog__footer .vc-button");
  await page.waitForSelector(".intro-modal", { state: "detached", timeout: 5000 });
  check(`${where}: the start view asks the question too`, (await txt(page, ".start-question")) === t("start.question", {}, lang));
  await page.evaluate(watch);
  await page.selectOption("#run-select", "R1");
  await page.click("#btn-start");
  await page.waitForSelector(".mode-modal", { timeout: 5000 });
  check(`${where}: the mode dialog offers Simulation, Live and Sovereign`, (await page.$$eval(".mode-card", (c) => c.map((x) => x.dataset.mode).join())) === "simulation,live,sovereign");
  await page.click("#start-simulation");
  // ---- 0:45 Plan and inventory: the roles take turns, the map fills, the duties tile counts up.
  await waitDecision(page, 90000);
  await waitTone(page, "waiting", 10000);
  check(`${where}: the badge says SIMULATION`, (await txt(page, "#mode-badge")) === t("mode.simulation", {}, lang));
  check(`${where}: the console is watermarked SIMULATION`, await page.isVisible(".sim-watermark") && (await txt(page, ".sim-watermark")).startsWith(t("mode.simulation", {}, lang)));
  const roles = await page.evaluate(() => [...window.__roles]);
  check(`${where}: every role of the team was at work`, ROLES.every((r) => roles.includes(r)), roles.join());
  const ticks = await page.evaluate(() => window.__ticks);
  const nums = ticks.map((v) => Number(v.replace(/\D/g, "")));
  check(`${where}: the duties tile counted up to the engine's figure`, nums.length >= 3 && nums.every((n, i) => i === 0 || n >= nums[i - 1]) && ticks[ticks.length - 1] === pause.before.tiles.duties, ticks.join(" → "));
  const cells = await page.$$eval("tr[data-norm] td.map-cell button.map-count", (bs) => bs.map((b) => `${b.closest("tr").dataset.norm}|${b.closest("td").cellIndex}|${b.textContent.trim()}`));
  const want = [...pause.before.map.entries()].map(([k, n]) => { const [norm, type] = k.split("|"); return `${norm}|${DUTY_TYPES.indexOf(type) + 1}|${n}`; });
  check(`${where}: the duty map shows the engine's count in every cell`, JSON.stringify([...cells].sort()) === JSON.stringify([...want].sort()), `${cells.length} cells vs ${want.length}`);
  compareTiles(`${where} before the decision`, await pageTiles(page), pause.before.tiles);
  // ---- 2:00 Evidence: one cell opens a duty card.
  const lead = pause.before.top.members[0];
  const ev = evidence(story.state, story.data, lead.id);
  await page.click(`.centre-tab[data-view="dutymap"]`);
  await page.click(`tr[data-norm="${ev.norm_id}"] td.map-cell:nth-child(${DUTY_TYPES.indexOf(ev.type) + 2}) button.map-count`);
  const card = `.card-panel #card-${ev.id}`;
  await page.waitForSelector(card, { timeout: 5000 });
  check(`${where}: the duty card highlights the trigger phrase`, (await txt(page, `${card} mark.trigger`)) === plain(ev.phrase), `${await txt(page, `${card} mark.trigger`)} vs ${ev.phrase}`);
  check(`${where}: the duty card links the paragraph`, (await page.getAttribute(`${card} .duty-cite a`, "href")) === ev.href && (await txt(page, `${card} .duty-cite a`)) === plain(ev.cite));
  check(`${where}: the duty card says the text is not the official version`, (await txt(page, `${card} .cite-notice`)) === t("cite.notice", {}, lang));
  check(`${where}: the duty card's rationale is marked as model text in the run's language`, (await page.$(`${card} .duty-rationale .ai-chip`)) !== null && (await page.getAttribute(`${card} .duty-rationale .rationale-text`, "lang")) === lang && (await txt(page, `${card} .duty-rationale .lang-tag`)) === lang.toUpperCase());
  // ---- 3:00 Duplicate: the board leads with the top cluster.
  await page.click(`.centre-tab[data-view="duplicates"]`);
  const top = pause.before.top;
  const first = await page.$eval(".cluster-list .cluster-card", (c) => c.id.replace(/^cluster-/, ""));
  check(`${where}: the duplicates board leads with the engine's top cluster`, first === top.id, `${first} vs ${top.id}`);
  const tc = `#cluster-${top.id}`;
  check(`${where}: the top cluster shows the shared data items`, JSON.stringify(await page.$$eval(`${tc} .chips .vc-chip`, (els) => els.map((e) => e.textContent.trim()))) === JSON.stringify(top.shared));
  const members = plain(await textOf(page, `${tc} .members`));
  check(`${where}: the top cluster lists its members with citation and recipient`, top.members.every((m) => members.includes(plain(m.cite)) && members.includes(plain(m.recipient)) && members.includes(m.id)), members);
  if (top.register) check(`${where}: the register candidate is labelled simulated`, (await txt(page, `${tc} .cluster-meta .vc-tag`)).includes(top.register) && (await txt(page, `${tc} .cluster-meta .vc-tag`)).includes(t("badge.simulated", {}, lang)));
  check(`${where}: the top cluster's € figure is the engine's`, (await txt(page, `${tc} .cluster-figure .fact-ref`)) === top.figure, `${await txt(page, `${tc} .cluster-figure .fact-ref`)} vs ${top.figure}`);
  // ---- 4:30 Decide: the options with their figures; the blocked figure and the re-draft before them.
  check(`${where}: the options wait in the drawer`, (await page.getAttribute("#tab-options", "aria-selected")) === "true");
  const cardsShown = await pageCards(page);
  check(`${where}: up to three costed options plus keep`, cardsShown.length === pause.before.cards.length && cardsShown.length <= 4 && cardsShown.filter((c) => c.type !== "keep").length <= 3 && cardsShown.some((c) => c.type === "keep"), cardsShown.map((c) => c.type).join());
  for (const c of pause.before.cards) {
    const got = cardsShown.find((x) => x.id === c.id);
    const wantFigures = Object.values(c.figures).map((f) => `${f.id}=${f.text}`).sort();
    const gotFigures = (got?.figures || []).map((f) => `${f.id}=${f.text}`).sort();
    check(`${where}: option ${c.type} shows the engine's figures`, JSON.stringify(gotFigures) === JSON.stringify(wantFigures), `${gotFigures.join(", ")} vs ${wantFigures.join(", ")}`);
  }
  const log = await page.$$eval(".log .entry", (es) => es.map((e) => ({ type: e.dataset.type, role: e.dataset.role, text: e.textContent.replace(/\s+/g, " ").trim() })));
  const blocked = log.findIndex((e) => e.type === "audit_failed");
  check(`${where}: the console shows "Unsourced figure blocked"`, blocked >= 0 && log[blocked].text.includes(t("audit.blocked", {}, lang)), log.filter((e) => e.type === "audit_failed").map((e) => e.text).join(" | "));
  check(`${where}: the agent re-drafts after the block`, log.slice(blocked + 1).some((e) => e.type === "tool_call" && e.role === "drafting") && log.slice(blocked + 1).some((e) => e.type === "tool_call" && e.role === "fact_auditor"));
  const choice = pause.choice;
  check(`${where}: the blocked draft passed the auditor on its retry`, (await page.getAttribute(`#option-${choice.option_id} .audit-status`, "data-state")) === "passed");
  await decide(page, { option: choice.option_id, code: choice.reason_code, comment: choice.comment, button: buttonOf(choice) });
  await waitTone(page, "done", 60000);
  // The approval moved the tiles to the engine's figures.
  const after = await pageTiles(page);
  compareTiles(`${where} at the end`, after, story.final.tiles);
  check(`${where}: the decision moved the gauge and the cost tile`, after.repShare !== pause.before.tiles.repShare && after.cost !== pause.before.tiles.cost, `${pause.before.tiles.repShare} → ${after.repShare}, ${pause.before.tiles.cost} → ${after.cost}`);
  // ---- 6:00 Outbox: totals, citations and draft wording; the export; "Nothing is sent."
  await page.click("#tab-outbox");
  const items = await page.$$eval("#panel-outbox .dossier-item", (els) => els.map((e) => e.id.replace(/^dossier-/, "")));
  check(`${where}: the dossier holds the approved item`, JSON.stringify(items) === JSON.stringify(story.final.items), `${items} vs ${story.final.items}`);
  check(`${where}: the dossier shows the engine's totals`, (await txt(page, "#panel-outbox .dossier-totals")) === story.final.totals, `${await txt(page, "#panel-outbox .dossier-totals")} vs ${story.final.totals}`);
  const item = story.final.dossier[0];
  const box = `#panel-outbox #dossier-${item.option_id}`;
  check(`${where}: the item shows the engine's relief`, (await txt(page, `${box} .dossier-delta .fact-ref`)) === item.net);
  const meta = await txt(page, `${box}`);
  check(`${where}: the item cites its paragraphs`, item.cites.every((c) => meta.includes(plain(c))), meta);
  await page.click(`${box} details.option-draft summary`);
  const wording = await txt(page, `${box} .draft-wording`);
  check(`${where}: the item shows the German draft wording`, wording.endsWith(item.wording) && wording.endsWith("[Entwurf, rechtlich zu prüfen]"), `${wording} vs ${item.wording}`);
  check(`${where}: the dossier notes its assumptions`, (await txt(page, "#panel-outbox .dossier-footnote")) === plain(t("outbox.footnote", {}, lang)));
  const md = await download(page, "#export-dossier_md");
  check(`${where}: the dossier downloads under the name of the language`, new RegExp(`^${lang === "de" ? "entlastungsdossier" : "relief-dossier"}-R1-\\d{8}-\\d{4}\\.md$`).test(md.name), md.name);
  check(`${where}: the download holds the item and the totals`, md.text.includes(item.target) && plain(md.text).includes(story.final.totals));
  check(`${where}: "${t("outbox.notice", {}, lang)}"`, (await txt(page, "#panel-outbox .outbox-notice")) === t("outbox.notice", {}, lang));
  // The closing report, from the template with the run's facts.
  const report = await page.$eval('.log .narration[data-kind="report"]', (p) => p.textContent);
  check(`${where}: the closing report is the engine's`, plain(report).endsWith(story.report), `${plain(report)}\n  vs ${story.report}`);
  // ---- 7:00 Prove and scale, without a network: R3 replays as the closing act.
  const r3 = await replayStory("R3", lang);
  await page.selectOption("#run-select", "R3");
  await page.click("#btn-start");
  await page.waitForSelector(".mode-modal", { timeout: 5000 });
  await page.click("#start-simulation");
  for (const p of r3.pauses) {
    await waitDecision(page, 60000);
    await decide(page, { option: p.choice.option_id, code: p.choice.reason_code, comment: p.choice.comment, button: buttonOf(p.choice) });
  }
  await waitTone(page, "done", 60000);
  compareTiles(`${where} R3 at the end`, await pageTiles(page), r3.final.tiles);
  // From the start of the run to its end (and through R3) the badge never shows anything but SIMULATION.
  const badges = await page.evaluate(() => window.__badges);
  const from = badges.indexOf("simulation");
  check(`${where}: SIMULATION throughout`, from >= 0 && badges.slice(from).every((b) => b === "simulation"), [...new Set(badges)].join());
  check(`${where}: no CSP violation`, (await csp()).length === 0, (await csp()).join("; "));
  check(`${where}: no error and no request to another host`, problems.length === 0, problems.join("\n  - "));
  await ctx.close();
}

async function r2Story(browser, server, lang) {
  const where = `R2 ${lang.toUpperCase()}`;
  const story = await replayStory("R2", lang);
  const { page, ctx, problems, csp } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}&speed=${SPEED}`, viewport: { width: 1600, height: 1000 } });
  await page.evaluate(watch);
  await page.selectOption("#run-select", "R2");
  await page.click("#btn-start");
  await page.waitForSelector(".mode-modal", { timeout: 5000 });
  await page.click("#start-simulation");
  for (const p of story.pauses) {
    if (p.kind === "review") {
      await waitReview(page);
      const card = `#cluster-${p.cluster_id}`;
      check(`${where}: the review waits on the duplicates board`, (await page.getAttribute(`.centre-tab[data-view="duplicates"]`, "aria-pressed")) === "true" && (await page.getAttribute(card, "data-pending")) === "true");
      if (p.action === "split") {
        const preset = await page.$$eval(`${card} .member-check input`, (els) => els.filter((i) => i.checked).map((i) => i.value));
        check(`${where}: the recorded split preselects its members`, JSON.stringify(preset) === JSON.stringify(p.separate_ids), preset.join());
      }
      const [confirmBtn, splitBtn] = await page.$$(`${card} .cluster-actions button`);
      await (p.action === "split" ? splitBtn : confirmBtn).click();
      await page.waitForSelector(`${card}[data-pending="true"]`, { state: "detached", timeout: 10000 }).catch(() => {});
      continue;
    }
    await waitDecision(page);
    const cardsShown = await pageCards(page);
    for (const c of p.before.cards) {
      const got = cardsShown.find((x) => x.id === c.id);
      check(`${where}: option ${c.type} for ${p.target} shows the engine's relief`, got?.figures.find((f) => f.id === c.figures.net_delta.id)?.text === c.figures.net_delta.text, `${JSON.stringify(got?.figures)} vs ${c.figures.net_delta.text}`);
    }
    compareTiles(`${where} before ${p.choice.option_id}`, await pageTiles(page), p.before.tiles);
    await decide(page, { option: p.choice.option_id, code: p.choice.reason_code, comment: p.choice.comment, button: buttonOf(p.choice) });
    await page.waitForFunction((id) => !document.querySelector(`#option-${id}[data-status="proposed"], #option-${id}[data-status="under_review"]`), p.choice.option_id, { timeout: 10000 });
  }
  await waitTone(page, "done", 60000);
  compareTiles(`${where} at the end`, await pageTiles(page), story.final.tiles);
  const log = await page.$$eval(".log .entry", (es) => es.map((e) => ({ type: e.dataset.type, text: e.textContent.replace(/\s+/g, " ").trim() })));
  check(`${where}: the console reports the split`, log.some((e) => e.type === "cluster_split"));
  check(`${where}: the console shows "Unsourced figure blocked"`, log.some((e) => e.type === "audit_failed" && e.text.includes(t("audit.blocked", {}, lang))));
  await page.click("#tab-audit");
  const events = await page.$$eval("#panel-audit tbody tr", (rows) => rows.map((r) => r.dataset.event));
  check(`${where}: the split is in the audit`, events.includes("cluster_split"), events.join());
  const decisions = await page.$$eval('#panel-audit tbody tr[data-event="decision_recorded"] .audit-detail', (els) => els.map((e) => e.textContent));
  check(`${where}: the rejection with A1 is in the audit`, decisions.some((d) => d.includes(t("decision.rejected", {}, lang)) && d.includes("A1")), decisions.join(" | "));
  await page.click("#tab-outbox");
  check(`${where}: no relief item in the dossier`, (await page.$$("#panel-outbox .dossier-item")).length === 0 && story.final.items.length === 0);
  const kept = await page.$$eval("#panel-outbox .kept-item", (els) => els.map((e) => `${e.id.replace(/^kept-/, "")}:${e.querySelector(".kept-code").textContent.split(" ")[0]}`));
  const wantKept = story.final.kept.map((k) => `${k.duty_id}:${k.reason_code}`);
  check(`${where}: the duty kept with A1 under the kept duties`, JSON.stringify(kept) === JSON.stringify(wantKept) && wantKept.length >= 1 && wantKept.every((k) => k.endsWith(":A1")), `${kept} vs ${wantKept}`);
  check(`${where}: the kept duties' heading`, (await txt(page, "#panel-outbox .outbox-sub")) === t("dossier.kept", {}, lang));
  const report = await page.$eval('.log .narration[data-kind="report"]', (p) => p.textContent);
  check(`${where}: the closing report is the engine's`, plain(report).endsWith(story.report), `${plain(report)}\n  vs ${story.report}`);
  // From the start of the run to its end (and through R3) the badge never shows anything but SIMULATION.
  const badges = await page.evaluate(() => window.__badges);
  const from = badges.indexOf("simulation");
  check(`${where}: SIMULATION throughout`, from >= 0 && badges.slice(from).every((b) => b === "simulation"), [...new Set(badges)].join());
  check(`${where}: no CSP violation`, (await csp()).length === 0, (await csp()).join("; "));
  check(`${where}: no error and no request to another host`, problems.length === 0, problems.join("\n  - "));
  await ctx.close();
}

const server = await serveStatic(APP_ROOT, 8261);
const browser = await launchBrowser();
try {
  for (const runId of RUNS) {
    for (const lang of ["en", "de"]) {
      try {
        if (runId === "R1") await r1Story(browser, server, lang);
        else await r2Story(browser, server, lang);
      } catch (e) {
        check(`${runId} ${lang.toUpperCase()}: the storyline runs to its end`, false, e.stack || e.message);
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`STORYLINE OK (${RUNS.join(", ")} in ${BROWSER_NAME}, English and German, ${checks} checks)`);
