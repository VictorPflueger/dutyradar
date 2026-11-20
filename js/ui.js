// The workspace (version 0.2.0): the header with the mode badge and the four KPI tiles, the control bar,
// the centrepiece (start view, duty map, duplicates), the agent console with the role strip, the drawer
// (Options & review, Outbox, Audit) and the dialogs. One run at a time comes from js/run_controller.js;
// every view reads the run state and re-renders when it changes, the console appends the RunEvents as
// they arrive. Every string comes from js/i18n/*.json; a language switch re-renders every view without
// a reload, while model text keeps the language it was written in.

import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { t, lang, setLang, onLangChange, applyStatic } from "./i18n.js";
import { createDrawer } from "./drawer.js";
import { createProgressRail } from "./progress.js";
import { STORAGE, DEFAULT_MODEL, MODELS, RUN_DEFAULTS } from "./config.js";
import { formatCount } from "./engine/format.js";
import { bus } from "./events.js";
import { createDataStore, DATA_FILES } from "./data.js";
import { createRunController, LIVE_NORMS } from "./run_controller.js";
import { createControls, RUNS, SPEEDS } from "./controls.js";
import { openIntro, openModeDialog, keyRejected } from "./dialogs.js";
import { openDiagnostics } from "./diagnostics.js";
import { createConsole } from "./console.js";
import { renderKpis } from "./kpi.js";
import { renderDutyMap } from "./dutymap.js";
import { renderDuplicates } from "./duplicates.js";
import { renderOptions } from "./options_panel.js";
import { renderOutbox } from "./outbox.js";
import { renderAuditPanel } from "./audit_panel.js";
import { exportFile } from "./exports.js";
import { recordingEnabled } from "./recorder.js";
import { DecisionError } from "./state.js";

/** The seven roles of the agent team, in the order of the role strip (PLAN.md section 3.6). */
export const ROLES = [
  { id: "corpus", labelKey: "agent.corpus", icon: "book" },
  { id: "duty_extractor", labelKey: "agent.duty_extractor", icon: "search" },
  { id: "once_matcher", labelKey: "agent.once_matcher", icon: "link" },
  { id: "cost", labelKey: "agent.cost", icon: "chart" },
  { id: "signal", labelKey: "agent.signal", icon: "bell" },
  { id: "drafting", labelKey: "agent.drafting", icon: "edit" },
  { id: "fact_auditor", labelKey: "agent.fact_auditor", icon: "check" }
];
const FINAL = new Set(["done", "stopped", "aborted", "error", "incomplete"]);

/** "2026-11-19T04:01:18Z" → "19 November 2026" / "19. November 2026". */
const longDate = (iso) => new Intl.DateTimeFormat(lang() === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* storage blocked */ } }
};

async function getJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** A form field the presenter is typing in or choosing from: the view waits until it is left. */
const editing = (root) => {
  const a = document.activeElement;
  if (!a || !root.contains(a)) return false;
  return a.tagName === "TEXTAREA" || a.tagName === "SELECT" || (a.tagName === "INPUT" && !["radio", "checkbox", "button"].includes(a.type));
};

export function initUI({ corpusIndex, slice }) {
  const store = createDataStore(getJson);
  let sovereign = null;
  getJson(DATA_FILES.sovereign).then((c) => { sovereign = c; }).catch(() => { sovereign = null; });
  const controller = createRunController({ store, fetchJson: getJson, onKeyRejected: () => keyRejected() });
  const recording = recordingEnabled();
  const freshOptions = () => ({ selected: null, reason: "", comment: "", error: null, lastTarget: null });
  const storedModel = session.get(STORAGE.model);
  // ?speed=n (up to 1000) replays faster than the menu's ×4: for rehearsals and the browser tests.
  const urlSpeed = Number(new URLSearchParams(globalThis.location?.search || "").get("speed"));
  const storedSpeed = urlSpeed > 0 && urlSpeed <= 1000 ? urlSpeed : Number(session.get(STORAGE.speed));
  const ui = {
    view: "start", cell: null, reading: null, runId: "R1",
    model: MODELS.some((m) => m.id === storedModel) ? storedModel : DEFAULT_MODEL,
    speed: SPEEDS.includes(storedSpeed) || (urlSpeed > 0 && urlSpeed <= 1000) ? storedSpeed : 1,
    status: "idle", cost: null, request: null, review: null, reviewError: null, options: freshOptions()
  };
  controller.setSpeed(ui.speed);
  const run = () => controller.current();
  const dirty = new Set();

  // ---- header: language switch, intro, mode badge, KPI tiles -----------------------------------
  const switchButtons = [...document.querySelectorAll(".lang-option")];
  const syncLangSwitch = () => { for (const b of switchButtons) b.setAttribute("aria-pressed", String(b.dataset.lang === lang())); };
  for (const b of switchButtons) b.addEventListener("click", () => setLang(b.dataset.lang));
  syncLangSwitch();
  document.getElementById("btn-intro")?.addEventListener("click", () => openIntro());
  const badge = document.getElementById("mode-badge");
  function renderBadge() {
    const mode = run()?.mode || "none";
    badge.dataset.mode = mode;
    badge.dataset.i18n = `mode.${mode}`;
    badge.className = mode === "live" ? "vc-tag vc-tag--accent vc-tag--solid mode-badge" : mode === "sovereign" ? "vc-tag vc-tag--feature mode-badge" : "vc-tag mode-badge";
    badge.textContent = t(`mode.${mode}`);
    if (mode === "live") badge.prepend(h("span", { class: "mode-dot", "aria-hidden": "true" }));
  }
  const kpis = document.getElementById("kpis");

  // ---- control bar ----------------------------------------------------------------------------
  const sliceInfo = { id: corpusIndex.slice_id, norms: corpusIndex.norms.length };
  const controls = createControls(document.getElementById("controls"), {
    onStart: () => openModeDialog({ runId: ui.runId, norms: liveNorms(ui.runId), sovereign, onStart: ({ mode }) => startRun(mode) }),
    onRunChange: (id) => { ui.runId = id; },
    onModelChange: (id) => { ui.model = id; session.set(STORAGE.model, id); },
    onSpeed: (n) => { ui.speed = n; session.set(STORAGE.speed, String(n)); controller.setSpeed(n); controls.update(); },
    onPause: () => { const r = run(); if (r) controller.pause(!r.paused); },
    onAbort: () => controller.abort(),
    onReset: () => controller.reset(),
    onRecord: () => { const r = run(); if (r) exportFile("run", r).then(schedule); },
    onDiagnostics: () => store.load([]).then((data) => openDiagnostics({ index: corpusIndex, data, run: run(), cost: ui.cost, sovereign })).catch((e) => notice("notice.error", { message: e.message }))
  }, () => ({ run: run(), status: ui.status, runId: ui.runId, model: ui.model, speed: ui.speed, cost: ui.cost, recording, slice: sliceInfo }));

  /** The norms a Live run of a scripted run reads, for the mode dialog. */
  function liveNorms(runId) {
    const ids = LIVE_NORMS[runId];
    if (!ids) return t("mode.live_all", { n: formatCount(corpusIndex.norms.length, lang()) });
    return ids.map((id) => corpusIndex.norms.find((n) => n.id === id)?.abbr || id).join(", ");
  }

  // ---- centrepiece: start view, duty map, duplicates ------------------------------------------
  const centre = document.getElementById("centre");
  /** force: the presenter's own action (a tab, a cell, a filter, a review), which re-renders at once. */
  function renderCentre({ force = false } = {}) {
    if (!force && editing(centre)) { dirty.add("centre"); return; }
    dirty.delete("centre");
    const scroll = centre.scrollTop;
    clear(centre);
    const tabs = h("div", { class: "centre-tabs", role: "group", "aria-label": t("view.tabs") },
      ["start", "dutymap", "duplicates"].map((v) => h("button", { type: "button", class: "centre-tab", dataset: { view: v }, "aria-pressed": String(v === ui.view) }, t(`screen.${v}`))));
    centre.append(h("div", { class: "centre-head" }, h("h2", { class: "centre-title", id: "centre-title" }, t(`screen.${ui.view}`)), tabs));
    const body = h("div", { class: "centre-body" });
    centre.append(body);
    const r = run();
    if (ui.view === "dutymap") {
      if (r) renderDutyMap(body, r, { slice, selected: ui.cell, reading: r.status === "running" ? ui.reading : null, onSelect: (key) => { ui.cell = key; renderCentre({ force: true }); } });
      else body.append(emptyState("dutymap.empty", "layers"));
    } else if (ui.view === "duplicates") {
      if (r) renderDuplicates(body, r, { review: ui.review ? { cluster_id: ui.review.cluster_id, recorded: r.review?.cluster_id === ui.review.cluster_id ? r.review.recorded : null } : null, onReview, error: ui.reviewError });
      else body.append(emptyState("duplicates.empty", "link"));
    } else body.append(startView(corpusIndex, slice));
    centre.scrollTop = scroll;
  }
  centre.addEventListener("click", (e) => {
    const btn = e.target.closest(".centre-tab[data-view]");
    if (!btn) return;
    ui.view = btn.dataset.view;
    renderCentre({ force: true });
  });

  function onReview({ cluster_id, action, separate_ids = [] }) {
    const r = run();
    if (!r) return;
    ui.reviewError = null;
    const recorded = r.mode === "simulation" && r.review?.cluster_id === cluster_id ? r.review.recorded : null;
    if (recorded && recorded.action !== action) { ui.reviewError = t("sim.preset"); schedule(); return; }
    try {
      controller.review({ cluster_id, action, separate_ids: recorded?.action === "split" ? recorded.separate_ids : separate_ids });
    } catch (e) {
      if (!(e instanceof DecisionError)) throw e;
      ui.reviewError = t(`error.decision.${e.code}`, e.params);
    }
    schedule();
  }

  // ---- console with the role strip --------------------------------------------------------------
  const consoleEl = document.getElementById("console");
  try { consoleEl.dataset.text = localStorage.getItem(STORAGE.consoleText) || ""; } catch { /* storage blocked */ }
  const rail = createProgressRail({ steps: ROLES });
  const consoleHead = h("div", { class: "console-head" });
  const watermark = h("div", { class: "sim-watermark", hidden: true });
  const log = h("div", { class: "log", role: "log", "aria-live": "polite", "aria-relevant": "additions", tabindex: "0" });
  consoleEl.append(consoleHead, rail.el, watermark, log);
  function renderConsoleHead() {
    consoleEl.setAttribute("aria-label", t("console.title"));
    log.setAttribute("aria-label", t("console.title"));
    const size = h("button", { class: "vc-button vc-button--ghost button-compact text-size", type: "button", "aria-pressed": String(consoleEl.dataset.text === "large") }, t("console.larger"));
    size.addEventListener("click", () => {
      consoleEl.dataset.text = consoleEl.dataset.text === "large" ? "" : "large";
      size.setAttribute("aria-pressed", String(consoleEl.dataset.text === "large"));
      try { localStorage.setItem(STORAGE.consoleText, consoleEl.dataset.text); } catch { /* storage blocked */ }
    });
    clear(consoleHead).append(h("div", { class: "console-title" }, h("h2", {}, t("console.title"))), h("div", { class: "console-head-actions" }, size));
    clear(watermark).append(t("mode.simulation"), " ", h("span", {}, t("console.sim_note")));
  }
  const consoleEmpty = () => h("div", { class: "log-empty" },
    h("p", {}, t("console.empty")),
    h("ul", { class: "run-list" }, RUNS.map((r) => h("li", {}, h("strong", {}, t(`run.${r}`)), " ", t(`run.${r}_desc`)))));
  renderConsoleHead();
  log.append(consoleEmpty());
  const consoleView = createConsole(log, {
    ctx: () => ({ state: run()?.state, data: run()?.data, lang: lang(), mode: run()?.mode }),
    onOpen: (kind, id) => {
      if (kind === "cluster") { ui.view = "duplicates"; renderCentre({ force: true }); document.getElementById(`cluster-${id}`)?.scrollIntoView({ block: "nearest" }); }
      else drawer.show("options");
    }
  });
  const notice = (code, params = {}, level = "error") => bus.emit("notice", { level, code, params, text: t(code, params) });

  // ---- drawer ---------------------------------------------------------------------------------
  const drawerEl = document.getElementById("drawer");
  const drawer = createDrawer(drawerEl, { tabs: [{ id: "options", labelKey: "screen.options" }, { id: "outbox", labelKey: "screen.outbox" }, { id: "audit", labelKey: "drawer.tab.audit" }] });
  const doExport = (kind) => { const r = run(); if (r) exportFile(kind, r).then(schedule).catch((e) => notice("notice.error", { message: e.message })); };
  function renderDrawer() {
    drawerEl.setAttribute("aria-label", `${t("screen.options")}, ${t("screen.outbox")}, ${t("drawer.tab.audit")}`);
    const r = run();
    const panels = [
      ["options", (p) => renderOptions(p, r, { request: ui.request, ui: ui.options, onChange: schedule })],
      ["outbox", (p) => renderOutbox(p, r, { onExport: doExport })],
      ["audit", (p) => renderAuditPanel(p, r, { onExport: () => doExport("audit") })]
    ];
    for (const [id, render] of panels) {
      const p = drawer.panel(id);
      if (editing(p)) { dirty.add(id); continue; }
      dirty.delete(id);
      const scroll = p.scrollTop;
      render(p);
      p.scrollTop = scroll;
    }
    const open = ui.request ? ui.request.option_ids.filter((id) => ["proposed", "under_review"].includes(r?.state.options.get(id)?.status)).length : 0;
    drawer.setCount("options", open, Boolean(ui.request));
    drawer.setCount("outbox", r ? r.state.dossier.items.length + r.state.dossier.kept.length : 0);
    drawer.setCount("audit", r ? r.audit.events().length : 0);
  }

  // ---- rendering --------------------------------------------------------------------------------
  function renderAll() {
    renderBadge();
    renderKpis(kpis, run());
    controls.update();
    renderCentre();
    renderDrawer();
  }
  let timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; renderAll(); }, 30);
  }
  for (const root of [centre, drawerEl]) root.addEventListener("focusout", () => setTimeout(() => { if (dirty.size && !editing(root)) schedule(); }, 200));

  onLangChange(() => {
    syncLangSwitch();
    controls.build();
    renderConsoleHead();
    if (!consoleView.count()) consoleView.clear(consoleEmpty());
    else consoleView.rerender();
    renderAll();
  });

  // ---- runs -------------------------------------------------------------------------------------
  async function startRun(mode) {
    consoleView.clear();
    log.dataset.sim = String(mode === "simulation");
    watermark.hidden = mode !== "simulation";
    rail.reset();
    Object.assign(ui, { status: "running", request: null, review: null, reviewError: null, cell: null, view: "dutymap", options: freshOptions(),
      cost: mode === "simulation" ? null : { calls: 0, eur: 0, maxCalls: RUN_DEFAULTS.max_model_calls, budgetEur: RUN_DEFAULTS.max_cost_eur } });
    schedule();
    try {
      await controller.start({ runId: ui.runId, mode, settings: { orchestrator_model: ui.model }, sovereign: mode === "sovereign" ? sovereign : null });
    } catch (e) {
      ui.status = "error";
      notice("notice.error", { message: e?.message || String(e) });
    }
    schedule();
  }

  let lastRun = null;
  let auditOff = null;
  controller.onChange((r) => {
    if (r !== lastRun) {
      auditOff?.();
      auditOff = r ? r.audit.onRecord(() => schedule()) : null;
      lastRun = r;
    }
    if (r && FINAL.has(r.status)) ui.status = r.status;
    schedule();
  });
  bus.on("state_changed", schedule);
  bus.on("state_change", (ev) => { ui.status = ev.payload.state; schedule(); });
  bus.on("role_active", (ev) => rail.setActive(ev.payload.role));
  // The norm the agent reads, for the duty map's fjord marker.
  bus.on("tool_call", (ev) => {
    const input = ev.payload?.input || {};
    const norm = input.norm_id || (Array.isArray(input.candidate_ids) && input.candidate_ids.length ? run()?.state.candidates.get(input.candidate_ids[0])?.norm_id : null);
    if (norm && norm !== ui.reading) { ui.reading = norm; schedule(); }
  });
  bus.on("cost_update", (ev) => { ui.cost = ev.payload; controls.update(); });
  bus.on("decision_requested", (ev) => {
    const p = ev.payload;
    if (p.kind === "cluster") {
      ui.review = { cluster_id: p.cluster_id };
      ui.reviewError = null;
      ui.view = "duplicates";
      // The board needs the height: the drawer has nothing to decide during a review.
      drawer.setOpen(false);
      setTimeout(() => {
        document.getElementById(`cluster-${p.cluster_id}`)?.scrollIntoView({ block: "start" });
        document.querySelector(`#cluster-${p.cluster_id} .cluster-actions`)?.scrollIntoView({ block: "nearest" });
      }, 80);
    } else {
      ui.request = { target: p.target, option_ids: p.option_ids };
      ui.options = { ...freshOptions(), lastTarget: p.target };
      drawer.show("options");
    }
    rail.setDecision(true);
    schedule();
  });
  bus.on("decision_recorded", (ev) => {
    const id = ev.payload?.decision?.option_id || ev.payload?.option_id;
    if (ui.request && ui.request.option_ids.includes(id)) ui.request = null;
    rail.setDecision(false);
    schedule();
  });
  for (const type of ["cluster_split", "cluster_confirmed"]) bus.on(type, () => { ui.review = null; ui.reviewError = null; rail.setDecision(false); schedule(); });
  bus.on("run_end", (ev) => { ui.status = ev.payload.status === "done" ? "done" : ev.payload.status; ui.request = null; ui.review = null; rail.finish(ev.payload.status); schedule(); });
  bus.on("run_reset", () => {
    consoleView.clear(consoleEmpty());
    log.dataset.sim = "false";
    watermark.hidden = true;
    rail.reset();
    Object.assign(ui, { status: "idle", cost: null, request: null, review: null, reviewError: null, cell: null, view: "start", options: freshOptions() });
    schedule();
  });

  renderAll();
  applyStatic();
  return {
    introOnFirstVisit() {
      let seen = false;
      try { seen = localStorage.getItem(STORAGE.introSeen) === "1"; } catch { /* storage blocked */ }
      if (!seen) openIntro();
    },
    drawer,
    rail,
    controller
  };
}

// ---- start view -----------------------------------------------------------------------------------

function emptyState(key, iconName) {
  return h("div", { class: "centre-empty" }, h("span", { class: "vc-cell vc-cell--lg", "aria-hidden": "true" }, icon(iconName, 0)), h("p", {}, t(key)));
}

function startView(index, slice) {
  const total = (k) => index.norms.reduce((s, n) => s + n[k], 0);
  const famLabel = (f) => slice.families?.[f]?.[lang()] || f;
  const families = [...new Set(slice.norms.map((n) => n.family))];
  const rows = [];
  for (const f of families) {
    rows.push(h("tr", { class: "family-row" }, h("th", { colspan: "5", scope: "colgroup" }, famLabel(f))));
    for (const n of index.norms.filter((x) => x.family === f)) {
      rows.push(h("tr", {},
        h("th", { scope: "row" }, n.abbr),
        h("td", { class: "slice-title" }, n.title),
        h("td", { class: "num" }, formatCount(n.paragraphs, lang())),
        h("td", { class: "num" }, formatCount(n.sentences, lang())),
        h("td", {}, n.eu_basis.length ? h("span", { class: "vc-tag vc-tag--sm", title: n.eu_basis.join(", ") }, t("badge.eu")) : "–")));
    }
  }
  return h("div", { class: "start-view" },
    h("p", { class: "start-question" }, t("start.question")),
    h("div", { class: "start-grid" },
      h("section", { class: "vc-card start-real", "aria-labelledby": "real-title" },
        h("h3", { id: "real-title" }, t("start.what_real")),
        h("ul", {}, ["start.real", "start.assumed", "start.never"].map((k) => h("li", {}, t(k)))),
        h("p", { class: "start-benchmarks" }, t("start.benchmarks"))),
      h("section", { class: "vc-card start-slice", "aria-labelledby": "slice-title" },
        h("h3", { id: "slice-title" }, t("start.slice_title"), " ",
          slice.status === "provisional" ? h("span", { class: "vc-tag vc-tag--warning vc-tag--sm slice-status" }, t("slice.provisional")) : null),
        h("p", { class: "slice-meta" }, t("start.slice_meta", { norms: formatCount(index.norms.length, lang()), paragraphs: formatCount(total("paragraphs"), lang()), sentences: formatCount(total("sentences"), lang()), date: longDate(index.retrieved_at) })),
        h("div", { class: "slice-table-wrap" },
          h("table", { class: "vc-table slice-table" },
            h("caption", { class: "vc-visually-hidden" }, t("start.table_caption")),
            h("thead", {}, h("tr", {}, ["start.col_norm", "start.col_title", "start.col_paragraphs", "start.col_sentences", "start.col_eu"].map((k) => h("th", { scope: "col" }, t(k))))),
            h("tbody", {}, rows))),
        h("p", { class: "cite-notice" }, icon("info", 16), t("cite.notice")))));
}
