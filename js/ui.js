// The workspace in version 0.1.0: header with the four KPI tiles, the control bar, the centrepiece's
// start view (the question, what is real, the slice), its two views (duty map, duplicates) in their
// empty state, the console with the role strip, the drawer with its three tabs, the intro and the
// Assumptions & diagnostics dialog. Every string comes from js/i18n/*.json; a language switch
// re-renders every view without a reload. The agent runs arrive in version 0.2.0.

import { h, clear, setDisabled, withTooltip } from "./dom.js";
import { icon } from "./icons.js";
import { t, lang, setLang, onLangChange, applyStatic } from "./i18n.js";
import { createDrawer } from "./drawer.js";
import { createProgressRail } from "./progress.js";
import { openModal } from "./modal.js";
import { APP, AGENT, FX_USD_EUR, STORAGE } from "./config.js";
import { formatCount, formatEur, formatShare, formatNumber } from "./engine/format.js";

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
const DUTY_TYPES = ["MELDEPFLICHT", "NACHWEISPFLICHT", "INFORMATIONSPFLICHT", "DOKUMENTATIONSPFLICHT", "EVALUIERUNGSPFLICHT", "KONTROLLPFLICHT"];
const RUNS = ["R1", "R2", "R3"];

/** "2026-11-19T04:01:18Z" → "19 November 2026" / "19. November 2026". */
const longDate = (iso) => new Intl.DateTimeFormat(lang() === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

export function initUI({ corpusIndex, slice }) {
  const views = [];
  const view = (render) => {
    render();
    views.push(render);
  };
  onLangChange(() => {
    for (const render of views) render();
    syncLangSwitch();
  });

  // ---- header: language switch, intro, KPI tiles ----------------------------------------------
  const switchButtons = [...document.querySelectorAll(".lang-option")];
  function syncLangSwitch() {
    for (const b of switchButtons) b.setAttribute("aria-pressed", String(b.dataset.lang === lang()));
  }
  for (const b of switchButtons) b.addEventListener("click", () => setLang(b.dataset.lang));
  syncLangSwitch();
  document.getElementById("btn-intro")?.addEventListener("click", () => openIntro());

  const kpis = document.getElementById("kpis");
  view(() => renderKpis(kpis));

  // ---- control bar --------------------------------------------------------------------------
  const controls = document.getElementById("controls");
  view(() => renderControls(controls, { onDiagnostics: () => openDiagnostics(corpusIndex) }));

  // ---- centrepiece: start view, duty map, duplicates ---------------------------------------
  const centre = document.getElementById("centre");
  let activeView = "start";
  view(() => renderCentre(centre, { corpusIndex, slice, active: activeView }));
  centre.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn || !centre.contains(btn)) return;
    activeView = btn.dataset.view;
    renderCentre(centre, { corpusIndex, slice, active: activeView });
  });

  // ---- console with the role strip ---------------------------------------------------------
  const consoleEl = document.getElementById("console");
  const rail = createProgressRail({ steps: ROLES });
  view(() => renderConsole(consoleEl, rail));

  // ---- drawer -----------------------------------------------------------------------------
  const drawerEl = document.getElementById("drawer");
  const drawer = createDrawer(drawerEl, { tabs: [{ id: "options", labelKey: "screen.options" }, { id: "outbox", labelKey: "screen.outbox" }, { id: "audit", labelKey: "drawer.tab.audit" }] });
  view(() => {
    drawerEl.setAttribute("aria-label", `${t("screen.options")}, ${t("screen.outbox")}, ${t("drawer.tab.audit")}`);
    empty(drawer.panel("options"), "options.empty");
    renderOutbox(drawer.panel("outbox"));
    empty(drawer.panel("audit"), "audit.empty");
  });

  applyStatic();
  return {
    introOnFirstVisit() {
      let seen = false;
      try { seen = localStorage.getItem(STORAGE.introSeen) === "1"; } catch { /* storage blocked */ }
      if (!seen) openIntro();
    },
    drawer,
    rail
  };
}

// ---- KPI tiles -------------------------------------------------------------------------------

function tile(id, label, value, note, extra = null) {
  return h("div", { class: "vc-stat kpi", id: `kpi-${id}`, dataset: { tone: "muted" }, role: "group", "aria-label": label },
    h("div", { class: "vc-stat__label kpi-label" }, label),
    extra || h("div", { class: "vc-stat__value kpi-value" }, value),
    h("div", { class: "vc-stat__note kpi-sub" }, note));
}

/** A hexagonal gauge; its value is set through the CSSOM (the policy allows no style attribute). */
function gauge(label, share) {
  const percent = Math.max(0, Math.min(100, share * 100));
  const el = h("span", { class: "vc-progress-hex vc-progress-hex--sm kpi-gauge", role: "progressbar", "aria-label": label, "aria-valuenow": String(Math.round(percent)), "aria-valuemin": "0", "aria-valuemax": "100" }, formatShare(share, lang()));
  el.style.setProperty("--value", String(percent));
  return el;
}

function renderKpis(root) {
  clear(root);
  root.setAttribute("aria-label", t("kpis.label"));
  const duties = tile("duties", t("kpi.duties"), formatCount(0, lang()), t("kpi.per_type"));
  duties.title = DUTY_TYPES.map((d) => `${t(`duty_type_short.${d}`)}: ${formatCount(0, lang())}`).join(" · ");
  const reporting = tile("reporting", t("kpi.reporting"), null, t("kpi.of_benchmark", { value: formatShare(0, lang()) }), gauge(t("kpi.reporting"), 0));
  const documentation = tile("documentation", t("kpi.documentation"), null, t("kpi.of_benchmark", { value: formatShare(0, lang()) }), gauge(t("kpi.documentation"), 0));
  for (const g of [reporting, documentation]) g.title = t("kpi.slice_note");
  const cost = tile("cost", t("kpi.cost"), formatEur(0, lang()), t("kpi.estimate"));
  root.append(duties, reporting, documentation, cost);
}

// ---- control bar -----------------------------------------------------------------------------

function renderControls(root, { onDiagnostics }) {
  clear(root);
  root.setAttribute("aria-label", t("controls.label"));
  const start = h("button", { class: "vc-button", type: "button", id: "btn-start" }, icon("play", 18), h("span", {}, t("controls.start")));
  setDisabled(start, true, t("controls.start_later"));
  const runSelect = h("select", { class: "vc-select control-select", id: "run-select", "aria-label": t("controls.run") },
    RUNS.map((r) => h("option", { value: r }, t(`run.${r}`))));
  const speeds = h("div", { class: "segmented", role: "group", "aria-label": t("controls.speed") },
    [1, 2, 4].map((n) => h("button", { type: "button", "aria-pressed": String(n === 1), "aria-label": t("controls.speed_x", { n }) }, `×${n}`)));
  const pill = h("div", { class: "vc-tag status-pill", role: "status", "aria-live": "polite", dataset: { tone: "idle" } }, h("span", { class: "dot", "aria-hidden": "true" }), h("span", { class: "text" }, t("state.idle")));
  const diag = h("button", { class: "vc-button vc-button--outline", type: "button", id: "btn-diagnostics" }, icon("pulse", 18), h("span", { class: "btn-text" }, t("screen.diagnostics")));
  diag.addEventListener("click", onDiagnostics);
  root.append(
    h("div", { class: "control-group" }, start),
    h("label", { class: "control-group control-field" }, h("span", { class: "control-label" }, t("controls.run")), runSelect),
    h("div", { class: "control-group" }, h("span", { class: "control-label" }, t("controls.speed")), speeds),
    h("span", { class: "spacer" }),
    pill,
    h("div", { class: "control-group" }, withTooltip(diag, t("screen.diagnostics"), { below: true }))
  );
}

// ---- centrepiece -----------------------------------------------------------------------------

function renderCentre(root, { corpusIndex, slice, active }) {
  clear(root);
  const tabs = h("div", { class: "centre-tabs", role: "group", "aria-label": t("view.tabs") },
    ["start", "dutymap", "duplicates"].map((v) => h("button", { type: "button", class: "centre-tab", dataset: { view: v }, "aria-pressed": String(v === active) }, t(`screen.${v}`))));
  const title = h("h2", { class: "centre-title", id: "centre-title" }, t(`screen.${active}`));
  root.append(h("div", { class: "centre-head" }, title, tabs));
  if (active === "dutymap") root.append(emptyState("dutymap.empty", "layers"));
  else if (active === "duplicates") root.append(emptyState("duplicates.empty", "link"));
  else root.append(startView(corpusIndex, slice));
}

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

// ---- console ---------------------------------------------------------------------------------

function renderConsole(root, rail) {
  clear(root);
  root.setAttribute("aria-label", t("console.title"));
  const size = h("button", { class: "vc-button vc-button--ghost button-compact text-size", type: "button", "aria-pressed": String(root.dataset.text === "large") }, t("console.larger"));
  size.addEventListener("click", () => {
    root.dataset.text = root.dataset.text === "large" ? "" : "large";
    size.setAttribute("aria-pressed", String(root.dataset.text === "large"));
    try { localStorage.setItem(STORAGE.consoleText, root.dataset.text); } catch { /* storage blocked */ }
  });
  const log = h("div", { class: "log", role: "log", "aria-live": "polite", "aria-relevant": "additions" },
    h("div", { class: "log-empty" },
      h("p", {}, t("console.empty")),
      h("ul", { class: "run-list" }, RUNS.map((r) => h("li", {}, h("strong", {}, t(`run.${r}`)), " ", t(`run.${r}_desc`))))));
  root.append(
    h("div", { class: "console-head" }, h("div", { class: "console-title" }, h("h2", {}, t("console.title"))), h("div", { class: "console-head-actions" }, size)),
    rail.el,
    log);
}

// ---- drawer panels ---------------------------------------------------------------------------

function empty(panel, key) {
  clear(panel);
  panel.append(h("p", { class: "drawer-empty" }, t(key)));
}

function renderOutbox(panel) {
  clear(panel);
  panel.append(
    h("h3", { class: "outbox-title" }, t("outbox.title")),
    h("p", { class: "drawer-empty" }, t("outbox.empty")),
    h("p", { class: "outbox-notice" }, icon("shield", 16), t("outbox.notice")));
}

// ---- dialogs ---------------------------------------------------------------------------------

function openIntro() {
  const { close } = openModal({
    title: t("intro.title"),
    intro: t("start.question"),
    size: "intro",
    className: "intro-modal",
    body: [h("ol", { class: "intro-steps" }, ["inventory", "duplicates", "prices", "decision"].map((k) => h("li", {}, t(`intro.step.${k}`)))),
      h("p", { class: "intro-disclosure" }, t("disclosure.ai"), " ", t("disclosure.proto"))],
    footer: [h("button", { class: "vc-button", type: "button", autofocus: true, on: { click: () => close() } }, t("intro.close"))],
    onClose: () => { try { localStorage.setItem(STORAGE.introSeen, "1"); } catch { /* storage blocked */ } }
  });
}

function openDiagnostics(index) {
  const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || "";
  const tr = t;
  const row = (k, v) => h("tr", {}, h("th", { scope: "row" }, k), h("td", {}, v));
  const tv = index.transport || {};
  openModal({
    title: tr("screen.diagnostics"),
    size: "wide",
    className: "diag-modal",
    body: [
      h("section", { class: "diag-section" }, h("h3", {}, tr("diag.snapshot")),
        h("table", { class: "vc-table diag-table" }, h("tbody", {},
          row(tr("diag.source"), index.source),
          row(tr("diag.retrieved"), longDate(index.retrieved_at)),
          tv.kind === "archive" ? row(tr("diag.archive"), `${tv.repository.replace("https://github.com/", "")} · ${tv.commit.slice(0, 12)}`) : null,
          row(tr("start.slice_title"), `${index.slice_id} · ${formatCount(index.norms.length, lang())}`),
          row(tr("diag.links"), index.links.note ? tr("diag.links_unchecked") : `${index.links.checked}`)))),
      h("section", { class: "diag-section" }, h("h3", {}, tr("diag.policy")), h("p", {}, tr("diag.policy_text")),
        h("p", { class: "diag-label" }, tr("diag.csp")), h("code", { class: "diag-code" }, policy)),
      h("section", { class: "diag-section" }, h("h3", {}, tr("diag.model")),
        h("table", { class: "vc-table diag-table" }, h("tbody", {},
          row(tr("diag.version"), `${APP.name} ${APP.version}`),
          row(tr("diag.model"), tr("diag.caps", { calls: AGENT.maxSteps, eur: formatEur(AGENT.budgetEur, lang()) })),
          row(tr("diag.fx"), `1 USD = ${formatNumber(FX_USD_EUR, lang(), 3)} EUR`)))),
      h("p", { class: "cite-notice" }, icon("info", 16), tr("cite.notice"))
    ]
  });
}
