// Progress rail. The sister apps show the agent's plan as five forward-only steps; Duty Radar's agent
// team works by role, so the app defines the steps and the rail becomes a role strip (REVIEW.md,
// adapted modules): one hexagon marker per role, from the corpus agent to the fact auditor, each idle
// (not yet called), active (one of its tools runs; fjord pulse) or done (called before; ink tick). A
// role turns active again whenever the agent returns to it. After the roles, the merlot step "Your
// decision" shows while an option decision or a cluster review waits. The orchestrator appears only
// in the console. Below 1920 px the labels shrink to the role's icon, with its name as tooltip and
// accessible name (css/app.css). Every string comes from the app's i18n and follows a language switch.

import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { t, onLangChange } from "./i18n.js";

/**
 * steps: [{ id, labelKey, icon }] in order; decisionKey: the i18n key of the decision step.
 * Returns { el, setActive(id), setDecision(waiting), finish(status), reset() }.
 */
export function createProgressRail({ steps, decisionKey = "rail.decision" }) {
  const el = h("ol", { class: "vc-stepper rail role-strip", "aria-label": t("rail.label") });
  const state = new Map(steps.map((s) => [s.id, "idle"]));
  let current = null;
  let waiting = false;
  let ended = null;

  function render() {
    clear(el);
    el.setAttribute("aria-label", t("rail.label"));
    for (const step of steps) {
      const s = state.get(step.id);
      const label = t(step.labelKey);
      el.appendChild(h("li", {
        class: ["vc-step", "rail-step", s === "done" ? "vc-step--done" : "", s === "active" ? "vc-step--current" : ""],
        dataset: { state: s, step: step.id },
        title: label,
        ...(s === "active" ? { "aria-current": "step" } : {})
      },
      h("span", { class: "vc-step__marker rail-dot", "aria-hidden": "true" }, icon(step.icon, 14)),
      h("span", { class: "vc-step__label rail-label" }, label),
      h("span", { class: "vc-visually-hidden" }, `: ${t(`rail.state.${s}`)}`)));
    }
    if (waiting && !ended) {
      el.appendChild(h("li", { class: "vc-step rail-step rail-decision", dataset: { state: "yours", step: "decision" }, "aria-current": "step" },
        h("span", { class: "vc-step__marker rail-dot", "aria-hidden": "true" }, icon("user", 14)),
        h("span", { class: "vc-tag vc-tag--solid rail-turn" }, t(decisionKey))));
    }
  }
  onLangChange(render);
  render();

  return {
    el,
    /** A role starts working: the previous active role is done. */
    setActive(id) {
      if (ended || !state.has(id)) return;
      if (current && current !== id) state.set(current, "done");
      state.set(id, "active");
      current = id;
      render();
    },
    /** An option decision or a cluster review waits (true) or was taken (false). */
    setDecision(v) {
      waiting = Boolean(v);
      render();
    },
    /** The run has ended: the active role is done, the decision step gone. */
    finish(status = "done") {
      ended = status;
      if (current) state.set(current, "done");
      current = null;
      waiting = false;
      render();
    },
    /** Back to all roles idle (Reset, or a new run). */
    reset() {
      for (const k of state.keys()) state.set(k, "idle");
      current = null;
      waiting = false;
      ended = null;
      render();
    },
    states: () => Object.fromEntries(state)
  };
}
