// Design suite (browser): the colour grammar of PLAN.md section 3.5 in the running app, in the light and
// the dark theme. Each rule names elements, a CSS property and the Vici token (or token expression) it
// must resolve to; a rule must find at least one element on screen, and every element it finds must
// match. The tokens are resolved in the page through a probe element, so a theme switch changes the
// expected colours with the actual ones.
//   merlot  the reviewer: Approve, the step "Your decision", the selected option, the decision request
//           and the decision in the console and the audit, the cluster under review and Confirm cluster
//   lilac   the AI's voice: AI labels, narration, the closing report, the classifier's rationale, the
//           draft wording, the AI disclosure
//   fjord   checking: the norm being read, an active role, the auditor's passed check, figure links,
//           citations and the highlighted trigger phrase
//   state   danger for a blocked figure, success for an approved option, each with its word
//   ink     the duty map's ramp, six steps of the text colour into the surface; SIMULATION's tape
// Usage: node tests/design.mjs [light|dark]
import { APP_ROOT, ONLY, launchBrowser, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";
import { startRun, waitDecision, waitReview, waitTone, decide } from "./lib/run-page.mjs";
import { t } from "./lib/story-node.mjs";

const THEMES = ["light", "dark"].filter((x) => ONLY.length === 0 || ONLY.includes(x));
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${String(detail).slice(0, 600)}` : ""}`); } };

const INK = { 1: 8, 2: 18, 3: 30, 4: 42, 5: 62, 6: 80 };
const RULES = {
  decision: [
    ["merlot", "Approve", "#btn-approve", "backgroundColor", "var(--vc-accent)"],
    ["merlot", "the step Your decision", ".role-strip .rail-decision .rail-dot", "backgroundColor", "var(--vc-accent)"],
    ["merlot", "the decision request in the console", '.log .entry[data-type="decision_requested"] .entry-mark', "color", "var(--vc-accent-text)"],
    ["merlot", "the selected option", '.option-card[data-selected="true"]', "borderTopColor", "var(--vc-accent)"],
    ["lilac", "the AI label of the narration", ".log .narration .ai-chip", "color", "var(--vc-feature-text)"],
    ["lilac", "the AI label's ground", ".log .narration .ai-chip", "backgroundColor", "var(--vc-feature-bg)"],
    ["lilac", "the draft wording's summary", "#panel-options .option-draft summary", "color", "var(--vc-feature-text)"],
    ["lilac", "the AI disclosure", ".ai-disclosure .vc-icon", "color", "var(--vc-feature-solid)"],
    ["fjord", "the norm being read", '.map-table tr[data-reading="true"] th[scope="row"]', "color", "var(--vc-info-text)"],
    ["fjord", "the auditor's passed check", '#panel-options .audit-status[data-state="passed"]', "color", "var(--vc-info-text)"],
    ["fjord", "figure links", ".fact-ref", "textDecorationColor", "var(--vc-info-text)"],
    ["danger", "the blocked figure", '.log .entry[data-type="audit_failed"] .entry-body strong', "color", "var(--vc-danger-text)", "audit.blocked"],
    ["neutral", "SIMULATION's tape", '#mode-badge[data-mode="simulation"]', "backgroundImage", "repeating-linear-gradient(-45deg, var(--vc-text) 0 6px, var(--vc-surface) 6px 12px)", null, null, "::before"],
    ...Object.entries(INK).map(([n, p]) => ["ink", `ramp step ${n}`, `.map-count[data-ink="${n}"]`, "backgroundColor", `color-mix(in oklab, var(--vc-text) ${p}%, var(--vc-surface))`])
  ],
  evidence: [
    ["fjord", "the duty card's § link", ".card-panel .duty-cite a", "color", "var(--vc-info-text)"],
    ["fjord", "the highlighted trigger phrase", ".card-panel mark.trigger", "backgroundColor", "var(--vc-info-bg)"],
    ["lilac", "the classifier's rationale", ".card-panel .duty-rationale", "color", "var(--vc-feature-text)"]
  ],
  after: [
    ["merlot", "the decision in the console", '.log .entry[data-type="decision_recorded"] .entry-body strong', "color", "var(--vc-accent-text)"],
    ["merlot", "the decision in the audit", '#panel-audit tr[data-event="decision_recorded"] .audit-event', "color", "var(--vc-accent-text)", null, "#tab-audit"],
    ["success", "the approved option", '#panel-options .option-card[data-status="approved"]', "backgroundColor", "var(--vc-success-bg)", "option_status.approved", "#tab-options"],
    ["lilac", "the closing report", '.log .narration[data-kind="report"]', "borderLeftColor", "var(--vc-feature-border)"],
    ["lilac", "the draft wording in the dossier", "#panel-outbox .draft-wording", "borderLeftColor", "var(--vc-feature-border)", null, "#tab-outbox"],
    ["fjord", "citations in the draft wording", "#panel-outbox .draft-wording .cite-ref", "color", "var(--vc-info-text)"]
  ],
  review: [
    ["merlot", "the cluster under review", '.cluster-card[data-pending="true"]', "borderTopColor", "var(--vc-accent)"],
    ["merlot", "Confirm cluster", '.cluster-card[data-pending="true"] .cluster-actions .vc-button:first-child', "backgroundColor", "var(--vc-accent)"]
  ]
};

/** Applies the rules of one moment in the page: { rule: [label, count, mismatches] }. */
function measure(rules) {
  const probe = document.createElement("i");
  probe.setAttribute("aria-hidden", "true");
  document.body.append(probe);
  const resolve = (prop, expr) => {
    if (prop === "backgroundImage") { probe.style.backgroundImage = expr; return getComputedStyle(probe).backgroundImage; }
    const css = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    probe.style.setProperty(css === "text-decoration-color" || css.startsWith("border") ? "color" : css === "background-color" ? "background-color" : "color", expr);
    return getComputedStyle(probe)[css === "background-color" ? "backgroundColor" : "color"];
  };
  const shown = (e) => e.getClientRects().length > 0 && !e.closest("[hidden]") && getComputedStyle(e).visibility !== "hidden";
  const out = [];
  for (const [family, label, sel, prop, expr, wordKey, , pseudo] of rules) {
    const want = resolve(prop, expr);
    const els = [...document.querySelectorAll(sel)].filter(shown);
    const bad = [];
    for (const e of els) {
      // Vici draws a tag's ground (and SIMULATION's tape) on its ::before.
      const got = getComputedStyle(e, pseudo || null)[prop];
      const ok = prop === "backgroundImage" ? got.startsWith(want) || got.includes(want) : got === want;
      if (!ok) bad.push(`${got} ≠ ${want}`);
    }
    out.push({ family, label, sel, count: els.length, bad, text: els[0]?.closest(".entry, .option-card")?.textContent || els[0]?.textContent || "", wordKey });
    probe.removeAttribute("style");
  }
  probe.remove();
  return out;
}

async function apply(page, moment, theme, lang) {
  for (const rule of RULES[moment]) {
    const [, , , , , , tab] = rule;
    if (tab && (await page.getAttribute(tab, "aria-selected")) !== "true") await page.click(tab);
    if (rule[2].includes(".draft-wording")) await page.evaluate((sel) => { for (const d of document.querySelectorAll(`${sel} details.option-draft`)) d.open = true; }, rule[2].split(" ")[0]);
    const [res] = await page.evaluate(measure, [rule]);
    const where = `${theme} ${moment}: ${res.family} ${res.label}`;
    check(`${where} is on screen`, res.count > 0, res.sel);
    check(`${where} wears its token`, res.bad.length === 0, res.bad.slice(0, 3).join("; "));
    if (res.wordKey) check(`${where} says it in words`, res.text.includes(t(res.wordKey, {}, lang)), res.text.slice(0, 120));
  }
}

const server = await serveStatic(APP_ROOT, 8271);
const browser = await launchBrowser();
try {
  for (const theme of THEMES) {
    const lang = "en";
    // R1: the decision, a duty card, the approval.
    {
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, theme, colorScheme: theme, query: `?lang=${lang}&speed=1000`, viewport: { width: 1920, height: 1080 } });
      check(`${theme}: the page shows the ${theme} theme`, (await page.evaluate(() => document.documentElement.dataset.theme)) === theme);
      // The check proves itself: a planted element in a colour of its own must not pass for merlot.
      await page.evaluate(() => { const e = document.createElement("span"); e.id = "planted"; e.textContent = "planted"; e.style.color = "rgb(1, 2, 3)"; document.querySelector(".brand").append(e); });
      const [planted] = await page.evaluate(measure, [["merlot", "planted", "#planted", "color", "var(--vc-accent-text)"]]);
      check(`${theme}: the check finds a planted colour that is not the token`, planted.count === 1 && planted.bad.length === 1, JSON.stringify(planted));
      await page.evaluate(() => document.getElementById("planted")?.remove());
      // An active role pulses in fjord: a role marker probed in the strip itself.
      const active = await page.evaluate(() => {
        const strip = document.querySelector(".role-strip");
        const li = document.createElement("li");
        li.className = "vc-step rail-step vc-step--current";
        li.dataset.state = "active";
        const dot = document.createElement("span");
        dot.className = "vc-step__marker rail-dot";
        li.append(dot);
        strip.append(li);
        const probe = document.createElement("i");
        document.body.append(probe);
        probe.style.backgroundColor = "var(--vc-info-solid)";
        const res = [getComputedStyle(dot).backgroundColor, getComputedStyle(probe).backgroundColor];
        li.remove(); probe.remove();
        return res;
      });
      check(`${theme}: an active role pulses in fjord`, active[0] === active[1], active.join(" ≠ "));
      await startRun(page, { run: "R1" });
      await waitDecision(page);
      await page.click('.centre-tab[data-view="dutymap"]');
      await apply(page, "decision", theme, lang);
      await page.click("tr[data-norm] td.map-cell button.map-count");
      await page.waitForSelector(".card-panel .duty-card", { timeout: 5000 });
      await apply(page, "evidence", theme, lang);
      await decide(page, { option: "merge", code: "Z1" });
      await waitTone(page, "done");
      await apply(page, "after", theme, lang);
      check(`${theme}: no errors (R1)`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
    // R2: the cluster review.
    {
      const { page, ctx, problems } = await openApp(browser, server.base, { skipIntro: true, theme, colorScheme: theme, query: `?lang=${lang}&speed=1000`, viewport: { width: 1920, height: 1080 } });
      await startRun(page, { run: "R2" });
      await waitReview(page);
      await apply(page, "review", theme, lang);
      check(`${theme}: no errors (R2)`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`DESIGN OK (${checks} checks, the colour grammar in ${THEMES.join(" and ")})`);
