// Starts the prototype: reads data/story.js, draws the first step and lets the presenter walk the five
// steps by click, key or address (?step=reads). Under each step a bar says what the page waits for and
// holds the one button that plays the agent's work up to the next step, which stops there so the room
// can talk; the decision at the last step is taken once, by the person at the screen. EN | DE in the
// header switches every word without a reload, and the address keeps the choice (?lang=de).

import { STEP_IDS, CHOICES, factsOf, words } from "./story.js";
import { t, applyCopy } from "./copy.js";
import { fillFigures, drawStepLabels, drawKpis, createLawMap, drawEvidence, drawStory } from "./view.js";

/** Real milliseconds Play takes from each step to the next; the last step comes at once. ?speed=2 to 20
 *  plays faster, for rehearsals and the tests. */
const SEGMENT_MS = [9000, 4000, 5000];
const SPEED = Math.min(20, Math.max(1, Number(new URL(window.location.href).searchParams.get("speed")) || 1));
const LAST = STEP_IDS.length - 1;
/** Idle time before the button to press starts to pulse. */
const IDLE_MS = 4000;
const $ = (id) => document.getElementById(id);

boot().catch((err) => failBoot(err));

async function boot() {
  const D = window.DUTY_RADAR;
  if (!D) throw new Error("data/story.js did not load. Deploy it next to index.html and reload.");
  const F = factsOf(D);
  const drawMap = createLawMap(F);
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
    drawKpis(F, w, state.index, state.p, state.decision);
    drawMap(state.index, state.p, w);
    drawEvidence(F, w, state.index, state.p, state.decision);
    if (story) drawStory(w, state.index, state.decision);
    ui.steps.forEach((b, i) => {
      b.li.classList.toggle("vc-step--current", i === state.index);
      b.li.classList.toggle("vc-step--done", i < state.index);
      if (i === state.index) b.button.setAttribute("aria-current", "step");
      else b.button.removeAttribute("aria-current");
      b.li.style.setProperty("--fill", i === state.index ? state.p.toFixed(4) : "0");
    });
  }

  /** The ask bar: what the page waits for, in words, and the one button. While the agent works it says
   *  so and the button pauses; at the last step the decision asks instead, so the bar goes. */
  function drawAsk() {
    ui.ask.hidden = state.index === LAST;
    if (state.index === LAST) return;
    ui.ask.dataset.state = state.playing ? "working" : "waiting";
    $("ask-lead").textContent = state.playing ? w.ask.working : w.ask.turn;
    $("ask-what").textContent = state.playing ? "" : w.steps[STEP_IDS[state.index]].ask;
    const icon = ui.play.querySelector(".play-icon");
    icon.classList.toggle("vc-icon--pause", state.playing);
    icon.classList.toggle("vc-icon--play", !state.playing);
    ui.play.querySelector(".play-text").textContent = state.playing ? w.ask.pause : w.ask.next(w.steps[STEP_IDS[state.index + 1]].label);
    // The button to press; it pulses once the page has been idle a few seconds (below).
    ui.play.dataset.attention = String(!state.playing);
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

  const togglePlay = () => (state.playing ? stop() : play());

  function decide(choice) {
    if (state.index !== LAST || state.decision || !CHOICES.includes(choice)) return;
    state.decision = choice;
    draw({ story: true });
    ui.announce.textContent = w.outcome[choice];
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
    if (remember) {
      try { window.localStorage.setItem("dr.lang", lang); } catch { /* storage blocked: the address keeps it */ }
      address({ lang });
    }
  }

  // ---- wiring

  ui.play.addEventListener("click", togglePlay);
  $("restart").addEventListener("click", restart);
  ui.steps.forEach((b, i) => b.button.addEventListener("click", () => goTo(i)));
  for (const btn of document.querySelectorAll("#decision [data-choice]")) btn.addEventListener("click", () => decide(btn.dataset.choice));
  for (const b of ui.langs) b.addEventListener("click", () => setLang(b.dataset.lang));
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.querySelector("dialog[open]")) return;
    const target = e.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]")) return;
    const onControl = target instanceof HTMLElement && target.closest("button, a");
    if (e.key === " " && !onControl) { e.preventDefault(); togglePlay(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); goTo(state.index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(state.index - 1); }
    else if (e.key === "Home") { e.preventDefault(); restart(); }
    else if (/^[1-5]$/.test(e.key)) { e.preventDefault(); goTo(Number(e.key) - 1); }
  });
  document.addEventListener("vc:guideclose", (e) => {
    if (e.target?.id?.startsWith("guide-") && e.detail?.returnValue === "done") (ui.ask.hidden ? $("story") : ui.play).focus();
  });

  // After a few seconds without a click, a key or a scroll, the button to press pulses; any of them calms
  // it again (Vici, Presenting step by step). The pulse itself is CSS, on :root[data-idle].
  let idle = 0;
  const calm = () => {
    delete document.documentElement.dataset.idle;
    clearTimeout(idle);
    idle = setTimeout(() => { document.documentElement.dataset.idle = "true"; }, IDLE_MS);
  };
  for (const type of ["pointerdown", "keydown", "wheel", "scroll", "touchstart"]) window.addEventListener(type, calm, { capture: true, passive: true });
  calm();

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
  window.dutyRadar = { F, state, goTo, play, stop, decide, setLang, restart };
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
