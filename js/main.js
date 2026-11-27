// Starts the prototype: reads data/story.js, draws the first step and lets the presenter walk the five
// steps by click, key or address (?step=reads). Under each step a bar says what the page waits for and
// holds the one button that plays the agent's work up to the next step, which stops there so the room
// can talk; the decision at the last step is taken once, by the person at the screen, and then the bar
// offers a new start. Every count opens what it counts beside the story and marks its laws on the map;
// a law picked on the map says in the story how it relates to the step. EN | DE in the header switches
// every word without a reload, and the address keeps the choice (?lang=de).

import { STEP_IDS, CHOICES, factsOf, words } from "./story.js";
import { t, applyCopy } from "./copy.js";
import { fillFigures, drawStepLabels, drawKpis, createLawMap, drawEvidence, drawStory, lawsOf } from "./view.js";
import { createPanel } from "./panel.js";

/** Real milliseconds Play takes from each step to the next; the last step comes at once. ?speed=2 to 20
 *  plays faster, for rehearsals and the tests. */
const SEGMENT_MS = [9000, 4000, 5000];
const SPEED = Math.min(20, Math.max(1, Number(new URL(window.location.href).searchParams.get("speed")) || 1));
const LAST = STEP_IDS.length - 1;
/** After a Pause, the quiet time before the button to press draws the eye again (Vici's vc-attention). */
const IDLE_MS = 4000;
const $ = (id) => document.getElementById(id);

boot().catch((err) => failBoot(err));

async function boot() {
  const D = window.DUTY_RADAR;
  if (!D) throw new Error("data/story.js did not load. Deploy it next to index.html and reload.");
  const F = factsOf(D);
  const map = createLawMap(F);
  fillFigures(F);

  const ui = {
    play: $("play"),
    ask: $("ask"),
    steps: [...document.querySelectorAll("#steps .vc-step")].map((li) => ({ li, button: li.querySelector("button"), id: li.dataset.step })),
    langs: [...document.querySelectorAll(".lang-option")],
    announce: $("announce")
  };
  const state = { index: 0, p: 0, playing: false, decision: null, raf: 0, lang: document.documentElement.dataset.lang === "de" ? "de" : "en" };
  let w = words(F, state.lang);

  // ---- drawing

  function draw({ story = false } = {}) {
    drawKpis(F, w, state.index, state.decision);
    map.draw(state.index, state.p, w);
    drawEvidence(F, w, state.index, state.p, state.decision);
    if (story) drawStory(F, w, state.index, state.decision, map.selected);
    ui.steps.forEach((b, i) => {
      b.li.classList.toggle("vc-step--current", i === state.index);
      b.li.classList.toggle("vc-step--done", i < state.index);
      if (i === state.index) b.button.setAttribute("aria-current", "step");
      else b.button.removeAttribute("aria-current");
      b.li.style.setProperty("--vc-step-fill", i === state.index ? state.p.toFixed(4) : "0");
    });
  }

  /** The ask bar: what the page waits for, in words, and the one button. While the agent works it says
   *  so and the button pauses; at the last step the decision asks instead, so the bar goes until the
   *  person has decided; then the story is over and the bar offers a new start. */
  function drawAsk() {
    const done = state.index === LAST && Boolean(state.decision);
    ui.ask.hidden = state.index === LAST && !done;
    ui.ask.dataset.state = done ? "done" : state.playing ? "working" : "waiting";
    const icon = ui.play.querySelector(".play-icon");
    icon.classList.toggle("vc-icon--pause", state.playing);
    icon.classList.toggle("vc-icon--refresh", done);
    icon.classList.toggle("vc-icon--play", !state.playing && !done);
    ui.play.classList.toggle("vc-button--secondary", done);
    if (done) {
      $("ask-lead").textContent = w.ask.done;
      $("ask-what").textContent = w.ask.over;
      ui.play.querySelector(".play-text").textContent = w.ask.again;
    } else if (!ui.ask.hidden) {
      $("ask-lead").textContent = state.playing ? w.ask.working : w.ask.turn;
      $("ask-what").textContent = state.playing ? "" : w.steps[STEP_IDS[state.index]].ask;
      ui.play.querySelector(".play-text").textContent = state.playing ? w.ask.pause : w.ask.next(w.steps[STEP_IDS[state.index + 1]].label);
    }
    // The button to press draws the eye (vc-attention): at once where a step waits for the person, after
    // a few quiet seconds where Pause stopped the agent half-way, never while it works or once it is over.
    attend(!done && !state.playing && !ui.ask.hidden, state.p > 0 ? IDLE_MS : 0);
  }

  let attention = 0;
  function attend(on, delay) {
    clearTimeout(attention);
    ui.play.classList.remove("vc-attention");
    if (!on) return;
    // A reflow between removing and adding the class starts its three pulses again.
    const mark = () => { void ui.play.offsetWidth; ui.play.classList.add("vc-attention"); };
    if (delay) attention = setTimeout(mark, delay);
    else mark();
  }

  const announce = () => {
    const s = w.steps[STEP_IDS[state.index]];
    ui.announce.textContent = `${t(state.lang, "step")} ${state.index + 1}, ${s.label}. ${s.title}.`;
  };

  function address(params) {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    window.history.replaceState(null, "", url);
  }

  // ---- moving between steps

  function goTo(index, { quiet = false } = {}) {
    stop();
    panel.close();
    const hadFocus = document.activeElement === ui.play;
    state.index = Math.max(0, Math.min(LAST, index));
    state.p = 0;
    draw({ story: true });
    drawAsk();
    // The bar goes at the decision; the focus moves to the story rather than to a decision button, so a
    // repeated Enter can't approve an option by accident.
    if (hadFocus && ui.ask.hidden) $("story").focus({ preventScroll: true });
    if (!quiet) announce();
    address({ step: STEP_IDS[state.index] });
  }

  function stop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    if (state.playing) { state.playing = false; drawAsk(); }
  }

  function restart() {
    state.decision = null;
    map.select(null);
    goTo(0);
  }

  function play() {
    if (state.index === LAST) return;
    if (state.index === LAST - 1) { goTo(LAST); return; }
    const i = state.index;
    const duration = SEGMENT_MS[i] / SPEED;
    // Resume where a pause left off.
    const startedAt = performance.now() - state.p * duration;
    state.playing = true;
    drawAsk();
    const frame = (now) => {
      state.p = Math.min(1, (now - startedAt) / duration);
      draw();
      if (state.p >= 1) { goTo(i + 1); return; }
      state.raf = requestAnimationFrame(frame);
    };
    state.raf = requestAnimationFrame(frame);
  }

  // A second click right after the first (a double click) doesn't pause what it just started.
  let pressedAt = 0;
  const togglePlay = () => {
    if (state.index === LAST && state.decision) { restart(); return; }
    if (!state.playing) { pressedAt = performance.now(); play(); return; }
    if (performance.now() - pressedAt > 400) stop();
  };

  function decide(choice) {
    if (state.index !== LAST || state.decision || !CHOICES.includes(choice)) return;
    state.decision = choice;
    draw({ story: true });
    drawAsk();
    ui.announce.textContent = `${w.decided[choice].title}. ${w.decided[choice].text}`;
    $("decision-outcome").focus({ preventScroll: true });
  }

  // ---- the language

  function setLang(lang, { remember = true } = {}) {
    if (lang !== "en" && lang !== "de") return;
    state.lang = lang;
    w = words(F, lang);
    const root = document.documentElement;
    root.setAttribute("lang", lang === "de" ? "de" : "en-GB");
    root.dataset.lang = lang;
    applyCopy(lang);
    drawStepLabels(w);
    for (const b of ui.langs) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    for (const b of document.querySelectorAll("[data-vc-guide-open]")) b.hidden = b.dataset.vcGuideOpen !== `guide-${lang}`;
    draw({ story: true });
    drawAsk();
    panel.redraw();
    if (remember) {
      try { window.localStorage.setItem("dr.lang", lang); } catch { /* storage blocked: the address keeps it */ }
      address({ lang });
    }
  }

  // ---- what a count counts, beside the story

  const panel = createPanel({
    F,
    getState: () => ({ lang: state.lang, index: state.index, w }),
    onMark: (kind) => map.mark(kind ? lawsOf(F, kind) : []),
    onSelect: (id) => { map.select(id); drawStory(F, w, state.index, state.decision, id); },
    onGo: (index) => goTo(index)
  });
  // A count opens what it counts; while nothing is open, pointing at it or focusing it marks its laws.
  document.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target.closest("[data-open]") : null;
    if (!el || document.querySelector("dialog.vc-guide[open]")) return;
    e.preventDefault();
    stop();
    panel.open(el.dataset.open, el);
  });
  const preview = (e, on) => {
    const el = e.target instanceof Element ? e.target.closest("button.count[data-open], button.kpi[data-open]") : null;
    if (el && !panel.isOpen()) map.mark(on ? lawsOf(F, el.dataset.open) : []);
  };
  for (const [type, on] of [["pointerover", true], ["focusin", true], ["pointerout", false], ["focusout", false]]) document.addEventListener(type, (e) => preview(e, on));

  // ---- wiring

  ui.play.addEventListener("click", togglePlay);
  $("restart").addEventListener("click", restart);
  ui.steps.forEach((b, i) => b.button.addEventListener("click", () => goTo(i)));
  for (const btn of document.querySelectorAll("#decision [data-choice]")) btn.addEventListener("click", () => decide(btn.dataset.choice));
  for (const b of ui.langs) b.addEventListener("click", () => setLang(b.dataset.lang));
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.querySelector("dialog.vc-guide[open]")) return;
    const target = e.target;
    if (panel.isOpen() && e.key === "Escape") { e.preventDefault(); panel.close(); return; }
    // Inside the panel the keys belong to the list: its buttons, filters and links.
    if (target instanceof HTMLElement && target.closest("#panel, input, textarea, select, [contenteditable]")) return;
    const onControl = target instanceof HTMLElement && target.closest("button, a");
    // Space plays or pauses; at the last step it does nothing, so it can neither decide nor start over.
    if (e.key === " " && !onControl) { e.preventDefault(); if (state.index < LAST) togglePlay(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); goTo(state.index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(state.index - 1); }
    else if (e.key === "Home") { e.preventDefault(); restart(); }
    else if (/^[1-5]$/.test(e.key)) { e.preventDefault(); goTo(Number(e.key) - 1); }
  });
  document.addEventListener("vc:guideclose", (e) => {
    if (e.target?.id?.startsWith("guide-") && e.detail?.returnValue === "done") (ui.ask.hidden ? $("story") : ui.play).focus();
  });

  // Below 960 px the bar is fixed to the bottom of the screen, and the page keeps room for it.
  const room = new ResizeObserver(() => {
    const bar = [ui.ask, $("decision-bar")].find((el) => el.getClientRects().length && getComputedStyle(el).position === "fixed");
    document.documentElement.style.setProperty("--ask-room", bar ? `${Math.ceil(bar.getBoundingClientRect().height)}px` : "0px");
  });
  for (const el of [ui.ask, $("decision-bar")]) room.observe(el);

  setLang(state.lang, { remember: false });
  const asked = STEP_IDS.indexOf(new URL(window.location.href).searchParams.get("step"));
  goTo(Math.max(0, asked), { quiet: true });
  document.documentElement.dataset.boot = "ready";
  window.dutyRadar = { F, state, goTo, play, stop, decide, setLang, restart, openPanel: (kind) => panel.open(kind), closePanel: () => panel.close() };
  hideBoot();
}

function hideBoot() {
  const el = document.getElementById("boot");
  if (!el) return;
  el.dataset.state = "done";
  setTimeout(() => el.remove(), 400);
}

function failBoot(err) {
  console.error("[Duty Radar] Start-up failed:", err);
  const el = document.getElementById("boot");
  if (!el) return;
  el.dataset.state = "failed";
  const status = document.getElementById("boot-status");
  if (status) status.textContent = document.documentElement.dataset.lang === "de" ? "Pflichten-Radar konnte nicht starten." : "Duty Radar could not start.";
  const detail = document.getElementById("boot-detail");
  if (detail) { detail.textContent = String(err?.message || err); detail.hidden = false; }
}
