// The prototype in Chromium, as a presenter uses it.
//   boot      the page starts without a console error, a security-policy violation or a request to
//             another site; a first visit in a German browser opens in English with the English guide
//   steps     each of the five steps by click, by key (1 to 5, arrows, Home) and by address (?step=):
//             its title, the step button marked current, the address following
//   play      the bar under the story says what the page waits for ("Your turn: …") and its button,
//             which names where it leads ("Next: It reads"), runs the agent to that step and stops there;
//             while the agent works the bar says so and the button pauses; from "It prices" it goes
//             straight to the decision, where the decision's own bar asks instead and the focus moves to
//             the story, not to an option; the same in German; the button the page waits for carries
//             Vici's vc-attention at once, loses it while the agent works and gets it back a few seconds
//             after a Pause; a double click doesn't pause what it started; the person's step has a merlot
//             marker
//   kpis      the three key figures (data-vc-kpi), top right, answering first with the values
//             js/story.js computes at every step, before and after each decision
//   decide    each of the three decisions: the title states the result, the outcome says why in words,
//             the key figures, the dossier (the reports named in words, the reason in words, the draft
//             wording); the bar says the story is over and Start again starts it over; the decision stays
//             when the presenter steps back and forth, and Back to the start clears it
//   ids       no record id of data/story.js on any screen, every step and every decision, both languages
//   language  EN | DE switches every visible word without a reload, also while the agent works; the address
//             and the browser keep the choice; ?lang= wins over the stored choice
//   layout    at 1920 × 1080, 1366 × 768 and 1280 × 720, in English and German, light and dark, in
//             all five steps and after a decision: nothing scrolls or overflows, no count leaves its tile,
//             the bar that asks and the decision's buttons are in view, every option shows in full above
//             the decision's bar, the header keeps one row; at 375 px the page reflows without sideways
//             scrolling and the bar keeps to the bottom of the screen without covering the end of the step
// Usage: NODE_PATH="$(npm root -g)" node tests/showcase.mjs [case …]
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT, launchBrowser, serveStatic, wanted, outDir, openPage, closeGuide, VIEWPORTS } from "./lib/harness.mjs";

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(APP_ROOT, "data/story.js"), "utf8"), sandbox);
const S = await import(pathToFileURL(path.join(APP_ROOT, "js/story.js")).href);
const { COPY } = await import(pathToFileURL(path.join(APP_ROOT, "js/copy.js")).href);
const F = S.factsOf(sandbox.window.DUTY_RADAR);
const { recordIds } = await import(pathToFileURL(path.join(APP_ROOT, "tests/lib/ids.mjs")).href);
const IDS_OF_DATA = recordIds(sandbox.window.DUTY_RADAR);
const W = { en: S.words(F, "en"), de: S.words(F, "de") };
const IDS = S.STEP_IDS;

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const out = await outDir("showcase");
const server = await serveStatic(APP_ROOT, 8461);
const browser = await launchBrowser();
const open = (query = "", opts = {}) => openPage(browser, server.base, query, opts);

/** What the page shows: step, playback, decision, the story's title and the three tiles. */
const view = (page) => page.evaluate(() => {
  const dr = window.dutyRadar;
  const tile = (id) => {
    const el = document.getElementById(id);
    const of = el.querySelector(".kpi-of");
    const was = el.querySelector(".vc-stat__was");
    return { label: el.querySelector(".vc-stat__label").textContent, value: el.querySelector(".kpi-main").textContent + (of && !of.hidden ? of.textContent : ""), was: was && !was.hidden ? was.textContent : null, note: el.querySelector(".kpi-note").textContent };
  };
  return {
    index: dr.state.index, playing: dr.state.playing, decision: dr.state.decision, p: dr.state.p,
    step: new URL(location.href).searchParams.get("step"), lang: document.documentElement.lang,
    current: [...document.querySelectorAll("#steps .vc-step__button")].findIndex((b) => b.getAttribute("aria-current") === "step"),
    title: document.getElementById("story-title").textContent,
    twice: tile("kpi-twice"), stake: tile("kpi-stake"), cut: tile("kpi-cut"),
    play: document.querySelector("#play .play-text").textContent,
    ask: (() => {
      const bar = document.getElementById("ask");
      return { hidden: bar.hidden, state: bar.dataset.state, lead: document.getElementById("ask-lead").textContent, what: document.getElementById("ask-what").textContent, attention: document.getElementById("play").classList.contains("vc-attention") };
    })(),
    read: document.querySelectorAll('.law[data-state="read"]').length,
    decisionAsk: document.getElementById("decision-bar").getClientRects().length ? document.getElementById("decision-ask").textContent.replace(/\s+/g, " ").trim() : null,
    focus: document.activeElement && document.activeElement.id
  };
});
/** The three tiles as js/story.js words them at a step, after a decision. */
const expected = (lang, index, decision = null) => {
  const w = W[lang];
  const k = S.kpisAt(F, index, decision);
  return {
    twice: { label: w.kpi.twice.label, value: `${w.n(k.twice.value)} ${w.kpi.twice.of} ${w.n(k.twice.of)}`, was: null, note: w.kpi.twice.note },
    stake: { label: w.kpi.stake.label, value: w.money(k.stake.value), was: k.stake.was === null ? null : w.money(k.stake.was), note: w.kpi.stake[k.stake.note] },
    cut: { label: w.kpi.cut.label, value: `${w.n(k.cut.value)} ${w.kpi.cut.of} ${w.n(k.cut.of)}`, was: k.cut.was === null ? null : w.n(k.cut.was), note: w.kpi.cut.note }
  };
};
const tilesMatch = (v, e) => ["twice", "stake", "cut"].every((t) => v[t].label === e[t].label && v[t].value === e[t].value && v[t].was === e[t].was && v[t].note === e[t].note);
const show = (v) => `${v.twice.value} / ${v.stake.was === null ? "" : `${v.stake.was} → `}${v.stake.value} (${v.stake.note}) / ${v.cut.was === null ? "" : `${v.cut.was} → `}${v.cut.value}`;
/** Text as read: every run of spaces, no-break spaces included, as one space. */
const norm = (text) => String(text).replace(/\s+/g, " ").trim();

try {
  // ---- boot ----------------------------------------------------------------------------------------
  if (wanted("boot")) {
    const { page, ctx, errors, outside, csp } = await open("");
    const s = await page.evaluate(() => ({ en: document.getElementById("guide-en").open, de: document.getElementById("guide-de").open, enBtn: !document.querySelector('[data-vc-guide-open="guide-en"]').hidden, deBtn: !document.querySelector('[data-vc-guide-open="guide-de"]').hidden }));
    check(s.en && !s.de && s.enBtn && !s.deBtn, "boot: a first visit in a German browser opens in English, with the English guide open and its button shown");
    await closeGuide(page);
    const v = await view(page);
    check(v.index === 0 && v.lang === "en-GB" && v.title === W.en.steps.target.title && tilesMatch(v, expected("en", 0)), `boot: the first step, its title and the key figures at their start (${show(v)})`);
    check(!errors.length && !outside.length && !(await csp()).length, `boot: no console error, no policy violation, no request to another site${errors.length || outside.length ? `; ${[...errors, ...outside].join("; ")}` : ""}`);
    await page.screenshot({ path: path.join(out, "boot-guide-closed.png") });
    await ctx.close();
  }

  // ---- steps by click, key and address -----------------------------------------------------------------
  if (wanted("steps")) {
    const { page, ctx } = await open("?guide=0");
    let ok = true;
    for (const [i, id] of IDS.entries()) {
      await page.click(`#steps [data-step="${id}"] button`);
      const v = await view(page);
      if (v.index !== i || v.step !== id || v.current !== i || v.title !== W.en.steps[id].title) ok = false;
    }
    check(ok, "steps: each step by its button: its title, the button marked current, ?step= in the address");
    const keys = [];
    for (const [key, want] of [["Home", 0], ["3", 2], ["ArrowRight", 3], ["ArrowLeft", 2], ["5", 4], ["ArrowRight", 4], ["1", 0], ["ArrowLeft", 0]]) {
      await page.keyboard.press(key);
      keys.push((await view(page)).index === want);
    }
    check(keys.every(Boolean), `steps: the keys 1 to 5, the arrows and Home move between the steps and stop at the ends (${keys.map((k) => (k ? "✓" : "✗")).join("")})`);
    await ctx.close();
    const direct = [];
    for (const [i, id] of IDS.entries()) {
      const { page: p2, ctx: c2 } = await open(`?guide=0&step=${id}`);
      const v = await view(p2);
      direct.push(v.index === i && tilesMatch(v, expected("en", i)));
      await c2.close();
    }
    check(direct.every(Boolean), "steps: ?step= opens each step with its key figures");
  }

  // ---- play ------------------------------------------------------------------------------------------
  if (wanted("play")) {
    // What the bar asks at each step, as the brief words it; the button is named after the next step.
    const ASKS = {
      en: [`Let the agent read the ${F.laws} laws.`, "See which duties ask for the same data twice.", "Let the agent price the options.", "Decide what goes into the dossier."],
      de: [`Lassen Sie den Agenten die ${F.laws} Gesetze lesen.`, "Sehen Sie, welche Pflichten dieselben Daten doppelt abfragen.", "Lassen Sie den Agenten die Optionen bepreisen.", "Entscheiden Sie, was ins Dossier kommt."]
    };
    const NEXT = { en: ["Next: It reads", "Next: Asked twice", "Next: It prices", "Next: You decide"], de: ["Weiter: Er liest", "Weiter: Doppelt gefragt", "Weiter: Er bepreist", "Weiter: Sie entscheiden"] };
    const LEAD = { en: "Your turn:", de: "Sie sind dran:" };
    const DECISION = { en: "Your turn: Approve one option or keep both.", de: "Sie sind dran: Geben Sie eine Option frei oder behalten Sie beide." };
    for (const lang of ["en", "de"]) {
      const { page, ctx, errors } = await open(`?guide=0&speed=20&lang=${lang}`);
      const visits = [];
      const asked = [];
      for (let i = 0; i < 4; i++) {
        const v = await view(page);
        asked.push(!v.ask.hidden && v.ask.lead === LEAD[lang] && v.ask.what === ASKS[lang][i] && v.play === NEXT[lang][i] && v.ask.attention === true && v.decisionAsk === null);
        await page.click("#play");
        if (i < 3) await page.waitForFunction((n) => window.dutyRadar.state.index === n && !window.dutyRadar.state.playing, i + 1, { timeout: 5000 });
        visits.push((await view(page)).index);
      }
      const last = await view(page);
      check(asked.every(Boolean), `play: ${lang.toUpperCase()}: at each of the first four steps the bar says "${LEAD[lang]}" and what to do, and its button names where it leads (${asked.map((a) => (a ? "✓" : "✗")).join("")})`);
      check(visits.join() === "1,2,3,4" && last.index === 4 && !last.playing && last.ask.hidden && last.decisionAsk === DECISION[lang] && last.focus === "story", `play: ${lang.toUpperCase()}: the button stops at each step (${visits.join(", ")}) and goes straight from the fourth to the decision, where the decision's own bar asks "${last.decisionAsk}" and the focus moves to the story (${last.focus || "nothing"}), not to an option`);
      await page.keyboard.press(" ");
      await page.waitForTimeout(150);
      const spaced = await view(page);
      check(spaced.index === 4 && spaced.decision === null && !spaced.playing, `play: ${lang.toUpperCase()}: Space at the decision neither approves an option nor starts over`);
      check(!errors.length, `play: ${lang.toUpperCase()}: no console error`);
      await ctx.close();
    }
    // Pause while the agent reads, at normal speed.
    const { page: p2, ctx: c2, errors } = await open("?guide=0");
    await p2.click("#play");
    await p2.waitForTimeout(1500);
    const working = await view(p2);
    check(working.playing && working.ask.lead === "The agent is at work." && working.ask.what === "" && working.play === "Pause" && working.ask.attention === false, `play: while the agent reads, the bar says "${working.ask.lead}" and its button reads ${working.play}, without drawing the eye`);
    await p2.waitForTimeout(2000);
    await p2.click("#play");
    const paused = await view(p2);
    await p2.waitForTimeout(800);
    const still = await view(p2);
    const midway = paused.read;
    check(!paused.playing && paused.index === 0 && paused.p > 0.2 && paused.p < 0.8 && midway > 0 && midway < F.laws && still.p === paused.p && still.read === midway && paused.play === "Next: It reads" && paused.ask.lead === "Your turn:", `play: Pause holds the reading at ${Math.round(paused.p * 100)} % with ${midway} of ${F.laws} laws read, and the bar asks again`);
    await p2.click("#play");
    await p2.waitForTimeout(600);
    check((await view(p2)).p > paused.p, "play: the button resumes where Pause left off");
    check(!errors.length, "play: no console error while playing");
    await c2.close();
    // vc-attention: the button the page waits for draws the eye at once, three pulses and then a frame;
    // it goes while the agent works, and after a Pause it comes back a few quiet seconds later. A double
    // click doesn't pause what it just started.
    const { page: p3, ctx: c3 } = await open("?guide=0");
    const ring = () => p3.evaluate(() => { const b = document.getElementById("play"); const cs = getComputedStyle(b); return { on: b.classList.contains("vc-attention"), animation: cs.animationName, frame: cs.boxShadow !== "none" }; });
    const atOnce = await ring();
    await p3.click("#play");
    await p3.waitForTimeout(800);
    const busy = await ring();
    await p3.click("#play");
    const pausedRing = await ring();
    await p3.waitForTimeout(4600);
    const back = await ring();
    check(atOnce.on && atOnce.animation === "vc-attention" && atOnce.frame && !busy.on && !pausedRing.on && back.on && back.frame, `play: vc-attention at once where the page waits (${atOnce.animation}), not while the agent works, back ${back.on ? "a few seconds" : "never"} after a Pause`);
    await p3.dblclick("#play");
    await p3.waitForTimeout(300);
    check((await view(p3)).playing, "play: a double click on the button starts the agent and doesn't pause it at once");
    await p3.evaluate(() => window.dutyRadar.goTo(0));
    await p3.emulateMedia({ reducedMotion: "reduce" });
    await p3.evaluate(() => window.dutyRadar.goTo(1));
    await p3.waitForTimeout(300);
    const quiet = await ring();
    check(quiet.on && quiet.frame, "play: with reduced motion the button keeps its ring as a still frame");
    const marker = await p3.evaluate(() => {
      const color = (sel) => getComputedStyle(document.querySelector(sel), "::before").backgroundColor;
      return { person: color('#steps [data-step="decide"] .vc-step__marker'), other: color('#steps [data-step="prices"] .vc-step__marker'), accent: getComputedStyle(document.documentElement).getPropertyValue("--vc-accent-text").trim() };
    });
    check(marker.person !== marker.other, `play: the person's step has a marker of its own colour (${marker.person}, the others ${marker.other})`);
    await c3.close();
  }

  // ---- key figures, step by step ----------------------------------------------------------------------
  if (wanted("kpis")) {
    for (const lang of ["en", "de"]) {
      const { page, ctx } = await open(`?guide=0&lang=${lang}`);
      const wrong = [];
      for (const [i, id] of IDS.entries()) {
        await page.click(`#steps [data-step="${id}"] button`);
        const v = await view(page);
        if (!tilesMatch(v, expected(lang, i))) wrong.push(`${id}: ${show(v)}`);
      }
      check(!wrong.length, `kpis: ${lang.toUpperCase()}, the three key figures at each step${wrong.length ? `; wrong: ${wrong.join(" | ")}` : ""}`);
      const where = await page.evaluate(() => [...document.querySelectorAll("[data-vc-kpi]")].map((el) => { const r = el.getBoundingClientRect(); return { name: el.dataset.vcKpi, top: r.top, left: r.left, right: r.right }; }));
      check(where.length === 3 && where.every((t) => t.top < 40 && t.left > 1920 * 0.55) && where.map((t) => t.name).join() === "Asked twice,Relief at stake a year,Reporting duties cut", `kpis: ${lang.toUpperCase()}, the three tiles marked data-vc-kpi sit top right (${where.map((t) => `${t.name} at ${Math.round(t.left)} px`).join(", ")})`);
      await ctx.close();
    }
  }

  // ---- the three decisions ---------------------------------------------------------------------------------
  if (wanted("decide")) {
    for (const choice of S.CHOICES) {
      const { page, ctx, errors } = await open("?guide=0&step=decide");
      const before = await view(page);
      const buttons = await page.evaluate(() => [...document.querySelectorAll("#decision [data-choice]")].map((b) => b.offsetParent !== null));
      await page.click(`#decision [data-choice="${choice}"]`);
      const v = await view(page);
      const shown = await page.evaluate(() => ({
        title: document.getElementById("story-title").textContent,
        outcome: document.getElementById("decision-outcome").textContent,
        outcomeShown: !document.getElementById("decision-outcome").hidden,
        actionsShown: document.getElementById("decision-bar").getClientRects().length > 0,
        dossier: document.querySelector(".ev-dossier")?.textContent.replace(/\s+/g, " ").trim() || "",
        focus: document.activeElement?.id
      }));
      const o = F.option[choice];
      const w = W.en;
      const named = shown.dossier.includes(norm(w.evidence.entry[choice])) && shown.dossier.includes(w.evidence.reason(o.reason.code)) && !shown.dossier.includes(o.reason.code);
      const dossierOk = named && (choice === "keep" ? shown.dossier.includes(norm(w.evidence.keptText)) : shown.dossier.includes(norm(o.wording)) && shown.dossier.includes("[Entwurf, rechtlich zu prüfen]") && shown.dossier.includes(norm(o.gist)));
      const over = v.ask.state === "done" && !v.ask.hidden && v.ask.lead === w.ask.done && v.ask.what === w.ask.over && v.play === w.ask.again && !v.ask.attention;
      check(buttons.every(Boolean) && tilesMatch(before, expected("en", 4)) && v.decision === choice && tilesMatch(v, expected("en", 4, choice)) && shown.title === w.decided[choice].title && shown.outcome === w.decided[choice].text && shown.outcomeShown && !shown.actionsShown && dossierOk && over && shown.focus === "decision-outcome", `decide: ${choice}: the title "${shown.title}", the outcome, the key figures (${show(v)}), the dossier${dossierOk ? "" : " (dossier wrong)"} and the bar that says it is over${over ? "" : " (bar wrong)"}`);
      await page.keyboard.press("ArrowLeft");
      const back = await view(page);
      await page.keyboard.press("ArrowRight");
      const again = await view(page);
      check(back.index === 3 && tilesMatch(back, expected("en", 3)) && again.decision === choice && tilesMatch(again, expected("en", 4, choice)), `decide: ${choice}: back at "It prices" the relief is at stake again; at the decision the answer is still there`);
      await page.screenshot({ path: path.join(out, `decided-${choice}.png`) });
      await page.click("#play");
      const anew = await view(page);
      check(anew.index === 0 && anew.decision === null && anew.ask.state === "waiting" && anew.ask.attention === true && tilesMatch(anew, expected("en", 0)), `decide: ${choice}: Start again goes back to the target, the decision cleared`);
      await page.click('#steps [data-step="decide"] button');
      await page.click(`#decision [data-choice="${choice}"]`);
      await page.click("#restart");
      await page.click('#steps [data-step="decide"] button');
      const cleared = await view(page);
      check(cleared.decision === null && tilesMatch(cleared, expected("en", 4)) && await page.evaluate(() => document.getElementById("decision-bar").getClientRects().length > 0), `decide: ${choice}: Back to the start clears the decision and its bar asks again`);
      check(!errors.length, `decide: ${choice}: no console error`);
      await ctx.close();
    }
  }

  // ---- the language ------------------------------------------------------------------------------------
  if (wanted("language")) {
    const { page, ctx, errors } = await open("?guide=0&step=twice");
    await page.click('.lang-option[data-lang="de"]');
    const de = await view(page);
    const text = await page.evaluate(() => document.body.innerText);
    const english = Object.entries(COPY.en).filter(([k, v]) => k !== "doc.title" && v !== COPY.de[k] && v.length > 3).map(([, v]) => v.trim()).filter((v) => text.includes(v));
    const german = [W.de.steps.twice.title, W.de.steps.twice.text, W.de.kpi.twice.label, W.de.kpi.stake.label, W.de.evidence.stage, W.de.evidence.shared, COPY.de["strip.note"], COPY.de["byline.label"]].filter((v) => !text.includes(v));
    const state = await page.evaluate(() => ({ url: new URL(location.href).searchParams.get("lang"), stored: localStorage.getItem("dr.lang"), title: document.title, guideDe: !document.querySelector('[data-vc-guide-open="guide-de"]').hidden, guideEn: !document.querySelector('[data-vc-guide-open="guide-en"]').hidden, pressed: document.querySelector('.lang-option[data-lang="de"]').getAttribute("aria-pressed") }));
    check(de.lang === "de" && de.index === 2 && tilesMatch(de, expected("de", 2)) && !english.length && !german.length, `language: DE switches every word in place, at the same step${english.length ? `; still English: ${english.join(" | ")}` : ""}${german.length ? `; missing German: ${german.join(" | ")}` : ""}`);
    check(state.url === "de" && state.stored === "de" && state.title === COPY.de["doc.title"] && state.guideDe && !state.guideEn && state.pressed === "true", "language: the address says ?lang=de, the browser remembers it, the tab title and the guide's button are German");
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.boot === "ready");
    check((await view(page)).lang === "de", "language: a reload keeps German");
    await page.goto(`${server.base}?guide=0&lang=en`);
    await page.waitForFunction(() => document.documentElement.dataset.boot === "ready");
    check((await view(page)).lang === "en-GB", "language: ?lang=en wins over the stored German");
    // Switching while the agent works.
    await page.click('#steps [data-step="target"] button');
    await page.click("#play");
    await page.waitForTimeout(1500);
    await page.click('.lang-option[data-lang="de"]');
    const mid = await view(page);
    await page.waitForFunction(() => window.dutyRadar.state.index === 1 && !window.dutyRadar.state.playing, null, { timeout: 15000 });
    const arrived = await view(page);
    check(mid.playing && mid.twice.label === W.de.kpi.twice.label && mid.ask.lead === "Der Agent arbeitet." && mid.play === "Pause" && arrived.title === W.de.steps.reads.title && arrived.ask.what === "Sehen Sie, welche Pflichten dieselben Daten doppelt abfragen." && tilesMatch(arrived, expected("de", 1)), "language: switching to German while the agent reads keeps it working, the bar says so in German, and it arrives in German");
    check(!errors.length, `language: no console error${errors.length ? `; ${errors.join("; ")}` : ""}`);
    await ctx.close();
  }

  // ---- record ids --------------------------------------------------------------------------------------------
  if (wanted("ids")) {
    const recordIdProblems = await (async () => {
      const dir = [process.env.VICI_DIR, path.resolve(APP_ROOT, "..", "ViciDesign")].filter(Boolean).find((d) => existsSync(path.join(d, "scripts", "lib", "ids.mjs")));
      return dir ? (await import(pathToFileURL(path.join(dir, "scripts", "lib", "ids.mjs")).href)).recordIdProblems : null;
    })();
    if (!recordIdProblems) {
      check(!process.argv.includes("--require-vici"), "ids: (skipped) no ViciDesign checkout with scripts/lib/ids.mjs at ../ViciDesign or in VICI_DIR");
    } else {
      const found = [];
      let screens = 0;
      for (const lang of ["en", "de"]) {
        const { page, ctx } = await open(`?guide=0&lang=${lang}`);
        const states = [...IDS.map((id, i) => [id, i, null]), ...S.CHOICES.map((c) => [`decided ${c}`, 4, c])];
        for (const [name, i, decision] of states) {
          await page.evaluate((n) => { window.dutyRadar.restart(); window.dutyRadar.goTo(n); }, i);
          if (decision) await page.click(`#decision [data-choice="${decision}"]`);
          await page.waitForTimeout(150);
          screens += 1;
          for (const p of recordIdProblems(await page.evaluate(() => document.body.innerText), IDS_OF_DATA)) found.push(`${lang} ${name}: ${p}`);
        }
        await ctx.close();
      }
      const planted = recordIdProblems(`${W.en.steps.decide.agent} ${F.D.cluster.id}`, IDS_OF_DATA).length > 0;
      check(planted && screens === 16 && !found.length, `ids: none of the ${IDS_OF_DATA.length} ids of data/story.js on ${screens} screens, every step and every decision in both languages, after a planted id is caught${found.length ? `; found: ${found.slice(0, 4).join(" | ")}` : ""}`);
    }
  }

  // ---- layout ---------------------------------------------------------------------------------------------
  if (wanted("layout")) {
    const measure = (page) => page.evaluate(() => {
      const se = document.scrollingElement;
      const over = (el) => el && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
      const cut = [...document.querySelectorAll(".law-count, .kpi .vc-stat__label, .kpi-value, .kpi-note, .vc-step__label, .opt-name, .opt-value, .brand-name")].filter((el) => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.trim().slice(0, 24));
      const lawOut = [...document.querySelectorAll(".law")].filter((li) => { const r = li.getBoundingClientRect(); const a = li.querySelector(".law-count").getBoundingClientRect(); return a.right > r.right + 0.5 || a.bottom > r.bottom + 0.5; }).map((li) => li.dataset.id);
      const story = document.getElementById("story").getBoundingClientRect();
      const buttons = [...document.querySelectorAll("#decision [data-choice]")].filter((b) => b.offsetParent !== null).map((b) => b.getBoundingClientRect());
      const hidden = buttons.filter((r) => r.bottom > story.bottom + 0.5 || r.top < story.top).length;
      // The bar that asks, whichever shows, sits inside the story and on the screen.
      const bar = ["ask", "decision-bar"].map((id) => document.getElementById(id)).find((el) => el.getClientRects().length);
      const b = bar && bar.getBoundingClientRect();
      const askOut = Boolean(b) && (b.bottom > story.bottom + 0.5 || b.top < story.top - 0.5 || b.bottom > innerHeight + 0.5);
      // At the decision every option shows in full above the bar that asks for it (Vici: the bar never
      // covers what it asks about).
      const covered = bar && bar.id === "decision-bar" ? [...document.querySelectorAll(".opt")].filter((el) => el.getBoundingClientRect().bottom > b.top + 0.5 || el.getBoundingClientRect().top < story.top).length : 0;
      const done = bar && bar.id === "ask" && bar.dataset.state === "done";
      const range = document.createRange(); range.selectNodeContents(document.querySelector(".strip-note")); const note = range.getBoundingClientRect();
      const by = document.querySelector(".app-strip .vc-byline").getBoundingClientRect();
      const footerOverlap = note.right > by.left + 0.5 && by.right > note.left + 0.5 && note.bottom > by.top + 0.5 && by.bottom > note.top + 0.5;
      // One header row: the brand, the buttons and the key figures side by side, and the buttons on one line.
      const parts = [".brand", ".header-actions", ".kpis"].map((sel) => document.querySelector(sel).getBoundingClientRect());
      const mids = [...document.querySelector(".header-actions").children].filter((c) => c.getClientRects().length).map((c) => { const r = c.getBoundingClientRect(); return r.top + r.height / 2; });
      const buttonsOneLine = Math.max(...mids) - Math.min(...mids) < 4;
      return {
        page: se.scrollHeight > innerHeight + 1 || se.scrollWidth > innerWidth + 1,
        stage: over(document.querySelector(".stage")), story: over(document.getElementById("story")),
        cut, lawOut, hidden, askOut, covered, asking: Boolean(bar) && !done, done, footerOverlap, buttonsOneLine, oneRow: Math.max(...parts.map((r) => r.top)) < Math.min(...parts.map((r) => r.bottom))
      };
    });
    // Every size in both languages, light and dark; the tightest size once more with text set 1 % of an
    // em wider, as another browser may set it: CI's Chromium needed that room where Chrome here did not.
    const runs = [];
    for (const [width, height] of VIEWPORTS) for (const lang of ["en", "de"]) for (const theme of width === 1366 ? ["light"] : ["light", "dark"]) runs.push({ width, height, lang, theme, wider: false });
    for (const lang of ["en", "de"]) runs.push({ width: 1280, height: 720, lang, theme: "light", wider: true });
    for (const { width, height, lang, theme, wider } of runs) {
      {
        {
          const { page, ctx, errors } = await open(`?guide=0&lang=${lang}`, { width, height, theme });
          if (wider) await page.evaluate(() => { document.documentElement.style.letterSpacing = "0.01em"; });
          const problems = [];
          const states = [...IDS.map((id, i) => [id, i, null]), ["decided", 4, "merge"]];
          for (const [name, i, decision] of states) {
            await page.evaluate(([n]) => window.dutyRadar.goTo(n), [i]);
            if (decision) await page.click(`#decision [data-choice="${decision}"]`);
            await page.waitForTimeout(950);
            const m = await measure(page);
            if (m.page) problems.push(`${name}: the page scrolls`);
            if (m.stage) problems.push(`${name}: the law map overflows`);
            if (m.story) problems.push(`${name}: the story overflows`);
            if (m.cut.length) problems.push(`${name}: cut text ${m.cut.join(", ")}`);
            if (m.lawOut.length) problems.push(`${name}: a law's count leaves its tile (${m.lawOut.join(", ")})`);
            if (m.hidden) problems.push(`${name}: ${m.hidden} decision button(s) out of view`);
            if (m.askOut) problems.push(`${name}: the bar under the story is out of view`);
            if (m.covered) problems.push(`${name}: ${m.covered} option(s) not in full above the decision's bar`);
            if (m.asking === (name === "decided")) problems.push(`${name}: ${m.asking ? "a bar still asks after the decision" : "no bar asks"}`);
            if (m.done !== (name === "decided")) problems.push(`${name}: ${m.done ? "the bar says it is over before the decision" : "no bar says the story is over"}`);
            if (!m.oneRow) problems.push(`${name}: the header wraps to a second row`);
            if (!m.buttonsOneLine) problems.push(`${name}: the header's buttons wrap`);
            if (m.footerOverlap) problems.push(`${name}: the sentence under the header runs into the byline`);
            if (theme === "light" && !wider && (name === "twice" || name === "decide" || name === "decided")) await page.screenshot({ path: path.join(out, `${width}x${height}-${lang}-${name}.png`) });
          }
          check(!problems.length && !errors.length, `layout: ${width} × ${height}, ${lang.toUpperCase()}, ${theme}${wider ? ", text 1 % wider" : ""}: five steps and a decision fit without scrolling${problems.length ? `; ${problems.join("; ")}` : ""}${errors.length ? `; errors: ${errors.join("; ")}` : ""}`);
          await ctx.close();
        }
      }
    }
    // A phone: the page reflows and scrolls down, never sideways, and the sentence under the header keeps
    // clear of the byline (in German, whose sentence is the longest).
    const { page, ctx } = await open("?guide=0&lang=de", { width: 375, height: 812 });
    const sideways = [];
    const pinned = [];
    for (const [i] of IDS.entries()) {
      await page.evaluate((n) => window.dutyRadar.goTo(n), i);
      await page.waitForTimeout(400);
      if (await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1)) sideways.push(IDS[i]);
      // The bar keeps to the bottom of the screen at the top of the page, and at the end of the page it
      // leaves the step's last line in view above it.
      pinned.push(await page.evaluate(async () => {
        const bar = ["ask", "decision-bar"].map((id) => document.getElementById(id)).find((el) => el.getClientRects().length);
        window.scrollTo(0, 0);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const top = bar.getBoundingClientRect();
        window.scrollTo(0, document.scrollingElement.scrollHeight);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const end = bar.getBoundingClientRect();
        const story = [...document.getElementById("story").children].filter((el) => el.getClientRects().length && !el.contains(bar) && el !== bar);
        const lastLine = Math.max(...story.map((el) => el.getBoundingClientRect().bottom));
        window.scrollTo(0, 0);
        return Math.abs(top.bottom - innerHeight) <= 1 && Math.abs(end.bottom - innerHeight) <= 1 && lastLine <= end.top + 0.5;
      }));
    }
    await page.evaluate(() => window.dutyRadar.goTo(4));
    await page.locator("#decide-merge").scrollIntoViewIfNeeded();
    await page.click("#decide-merge");
    const footer = await page.evaluate(() => {
      const range = document.createRange(); range.selectNodeContents(document.querySelector(".strip-note")); const note = range.getBoundingClientRect();
      const by = document.querySelector(".app-strip .vc-byline").getBoundingClientRect();
      return { overlap: note.right > by.left + 0.5 && by.right > note.left + 0.5 && note.bottom > by.top + 0.5 && by.bottom > note.top + 0.5, width: Math.round(note.width) };
    });
    check(!sideways.length && (await view(page)).decision === "merge" && !footer.overlap && footer.width >= 300, `layout: at 375 px the page reflows without sideways scrolling, the decision can be taken and the sentence under the header (${footer.width} px wide) keeps clear of the byline${sideways.length ? `; sideways in ${sideways.join(", ")}` : ""}${footer.overlap ? "; the sentence runs into the byline" : ""}`);
    check(pinned.every(Boolean), `layout: at 375 px the bar that asks keeps to the bottom of the screen at every step and leaves the end of the step in view above it (${pinned.map((x) => (x ? "✓" : "✗")).join("")})`);
    await page.screenshot({ path: path.join(out, "375-decided.png"), fullPage: true });
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}

let failed = 0;
for (const [ok, what] of results) { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failed += 1; }
console.log(`(screenshots in ${out})`);
if (failed) { console.log(`\n${failed} of ${results.length} checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed.\nSHOWCASE OK`);
