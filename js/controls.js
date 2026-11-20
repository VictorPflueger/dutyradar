// The control bar (PLAN.md 3.2 and P-4): Start agent (it opens the mode dialog), the run, the slice and
// the Live model, the replay speeds and Pause, the run's status, the cost meter in Live and Sovereign
// mode ("N of 40 calls · €x.xx of €3"), Record run with ?record=1, Abort, Reset and Assumptions &
// diagnostics; below 900 px also Console, which opens the console as a drawer (css/app.css). Built once
// per language; update() sets what changes while a run goes on, so an open menu is never rebuilt under
// the presenter's pointer.

import { h, clear, setDisabled, isDisabled, withTooltip } from "./dom.js";
import { icon } from "./icons.js";
import { t, lang } from "./i18n.js";
import { MODELS } from "./config.js";
import { formatCount, formatEur } from "./engine/format.js";
import { RUN_STATES } from "./events.js";

export const RUNS = ["R1", "R2", "R3"];
export const SPEEDS = [1, 2, 4];
const TONE = { idle: "idle", running: "active", awaiting_decision: "waiting", awaiting_review: "waiting", paused: "idle", done: "done", stopped: "stopped", aborted: "stopped", error: "stopped", incomplete: "stopped" };

/**
 * handlers: { onStart, onRunChange(id), onModelChange(id), onSpeed(n), onPause(), onAbort(), onReset(),
 * onRecord(), onDiagnostics(), onConsole() }. get(): { run, status, runId, model, speed, cost,
 * recording, slice, consoleOpen }.
 */
export function createControls(root, handlers, get) {
  let el = {};

  const button = (id, iconName, label, cls = "vc-button vc-button--outline") => {
    const b = h("button", { class: cls, type: "button", id }, icon(iconName, 18), h("span", { class: "btn-text" }, label));
    return { b, anchor: withTooltip(b, label, { below: true }) };
  };
  const guard = (b, fn) => b.addEventListener("click", () => { if (!isDisabled(b)) fn(); });

  function build() {
    clear(root);
    root.setAttribute("aria-label", t("controls.label"));
    const s = get();
    const start = button("btn-start", "play", t("controls.start"), "vc-button");
    guard(start.b, handlers.onStart);
    const runSelect = h("select", { class: "vc-select control-select", id: "run-select", "aria-label": t("controls.run") }, RUNS.map((r) => h("option", { value: r, selected: r === s.runId }, t(`run.${r}`))));
    runSelect.addEventListener("change", () => handlers.onRunChange(runSelect.value));
    const sliceSelect = h("select", { class: "vc-select control-select control-select--narrow", id: "slice-select", "aria-label": t("controls.slice"), title: `${t("controls.slice")}: ${s.slice.id}` },
      h("option", { value: s.slice.id }, t("controls.slice_option", { norms: formatCount(s.slice.norms, lang()) })));
    const modelSelect = h("select", { class: "vc-select control-select control-select--narrow", id: "model-select", "aria-label": t("controls.model") },
      MODELS.map((m) => h("option", { value: m.id, selected: m.id === s.model }, m.label)));
    modelSelect.addEventListener("change", () => handlers.onModelChange(modelSelect.value));
    const speeds = h("div", { class: "segmented", id: "speeds", role: "group", "aria-label": t("controls.speed") },
      SPEEDS.map((n) => {
        const b = h("button", { type: "button", "aria-pressed": String(n === s.speed), "aria-label": t("controls.speed_x", { n }), dataset: { speed: String(n) } }, `×${n}`);
        b.addEventListener("click", () => { if (speeds.getAttribute("aria-disabled") !== "true") handlers.onSpeed(n); });
        return b;
      }));
    const pause = button("btn-pause", "pause", t("controls.pause"));
    guard(pause.b, handlers.onPause);
    const pill = h("div", { class: "vc-tag status-pill", id: "status-pill", role: "status", "aria-live": "polite", dataset: { tone: "idle" } }, h("span", { class: "dot", "aria-hidden": "true" }), h("span", { class: "text" }, t("state.idle")));
    const meter = h("span", { class: "vc-tag cost-meter", id: "cost-meter", hidden: true });
    const record = button("btn-record", "download", t("record.run"));
    guard(record.b, handlers.onRecord);
    const abort = button("btn-abort", "stop", t("controls.abort"));
    guard(abort.b, handlers.onAbort);
    const reset = button("btn-reset", "reset", t("controls.reset"), "vc-button vc-button--ghost");
    guard(reset.b, handlers.onReset);
    const diag = button("btn-diagnostics", "pulse", t("screen.diagnostics"));
    diag.b.addEventListener("click", handlers.onDiagnostics);
    const consoleBtn = button("btn-console", "console", t("console.open"));
    consoleBtn.b.setAttribute("aria-controls", "console");
    consoleBtn.b.addEventListener("click", () => handlers.onConsole?.());
    const field = (labelKey, select, hiddenLabel = false) => h("label", { class: "control-group control-field" }, h("span", { class: hiddenLabel ? "control-label speed-label" : "control-label" }, t(labelKey)), select);
    root.append(
      h("div", { class: "control-group" }, start.anchor, h("span", { class: "console-toggle" }, consoleBtn.anchor)),
      field("controls.run", runSelect),
      // One slice: its menu needs no visible label (the label stays for screen readers, the id in the tooltip).
      field("controls.slice", sliceSelect, true),
      field("controls.model", modelSelect),
      h("div", { class: "control-group", id: "speed-group" }, h("span", { class: "control-label speed-label" }, t("controls.speed")), speeds, pause.anchor),
      h("span", { class: "spacer" }),
      pill,
      meter,
      h("div", { class: "control-group", id: "record-group", hidden: true }, record.anchor),
      h("div", { class: "control-group" }, abort.anchor, reset.anchor, diag.anchor));
    el = { start: start.b, runSelect, modelSelect, speeds, speedGroup: root.querySelector("#speed-group"), pause: pause.b, pill, meter, record: record.b, recordGroup: root.querySelector("#record-group"), abort: abort.b, reset: reset.b, console: consoleBtn.b };
    update();
  }

  function update() {
    const s = get();
    const run = s.run;
    const active = Boolean(run && run.status === "running");
    const sim = run ? run.mode === "simulation" : true;
    setDisabled(el.start, active, t("controls.running"));
    el.runSelect.disabled = active;
    el.modelSelect.disabled = active;
    el.runSelect.value = s.runId;
    el.modelSelect.value = s.model;
    const speedsOff = !sim;
    el.speeds.setAttribute("aria-disabled", String(speedsOff));
    if (speedsOff) el.speeds.title = t("controls.sim_only"); else el.speeds.removeAttribute("title");
    for (const b of el.speeds.querySelectorAll("button")) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === s.speed));
    const paused = Boolean(run?.paused);
    setDisabled(el.pause, !(active && sim), sim ? t("controls.nothing_running") : t("controls.sim_only"));
    const pauseLabel = t(paused ? "controls.resume" : "controls.pause");
    el.pause.replaceChildren(icon(paused ? "play" : "pause", 18), h("span", { class: "btn-text" }, pauseLabel));
    if (el.pause.tooltip) el.pause.tooltip.textContent = pauseLabel;
    el.pause.setAttribute("aria-pressed", String(paused));
    const status = paused && active ? "paused" : s.status;
    el.pill.dataset.tone = TONE[status] || "idle";
    el.pill.querySelector(".text").textContent = t(RUN_STATES[status] || `state.${status}`);
    const metered = run && run.mode !== "simulation";
    // A Live or Sovereign run shows its cost meter where the replay's speeds stand.
    el.speedGroup.hidden = Boolean(metered);
    el.meter.hidden = !metered;
    if (metered) {
      const c = s.cost || { calls: 0, eur: 0, maxCalls: 40, budgetEur: 3 };
      const l = lang();
      el.meter.textContent = t("controls.cost_meter", { calls: formatCount(c.calls, l), max: formatCount(c.maxCalls, l), eur: formatEur(c.eur, l), budget: formatEur(c.budgetEur, l) });
      el.meter.title = t("controls.cost_title", { max: formatCount(c.maxCalls, l), budget: formatEur(c.budgetEur, l) });
      el.meter.dataset.tone = c.calls >= c.maxCalls || c.eur >= c.budgetEur ? "stopped" : "";
    }
    el.recordGroup.hidden = !(s.recording && metered);
    setDisabled(el.abort, !active, t("controls.nothing_running"));
    setDisabled(el.reset, !run, t("controls.nothing_running"));
    el.console.setAttribute("aria-expanded", String(Boolean(s.consoleOpen)));
  }

  build();
  return { build, update };
}
