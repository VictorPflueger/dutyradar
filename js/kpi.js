// The four KPI tiles of the header, from the run state's facts (fixed ids F-9001 to F-9008): duties
// inventoried with the count per type, the two benchmark gauges (the share of the slice's reporting or
// documentation duties that approved options remove, filled towards the benchmark of −⅓ or −½) and the
// compliance cost addressed with the pending proposals as a faint second figure. Every figure opens
// "Where does this figure come from?"; before a run the tiles stand at zero.

import { h, clear } from "./dom.js";
import { t, lang } from "./i18n.js";
import { formatCount, formatEur, formatShare } from "./engine/format.js";
import { factButton } from "./rich.js";
import { openFactDetails } from "./popovers.js";
import { factText } from "./placeholders.js";

export const DUTY_TYPES = ["MELDEPFLICHT", "NACHWEISPFLICHT", "INFORMATIONSPFLICHT", "DOKUMENTATIONSPFLICHT", "EVALUIERUNGSPFLICHT", "KONTROLLPFLICHT"];

function tile(id, label, value, note) {
  return h("div", { class: "vc-stat kpi", id: `kpi-${id}`, dataset: { tone: "muted" }, role: "group", "aria-label": label },
    h("div", { class: "vc-stat__label kpi-label" }, label),
    value,
    h("div", { class: "vc-stat__note kpi-sub" }, note));
}

/** A hexagonal gauge; its fill is set through the CSSOM (the policy allows no style attribute). */
function gauge(label, attainment, text, { hidden = false } = {}) {
  const percent = Math.max(0, Math.min(100, attainment * 100));
  const el = h("span", hidden
    ? { class: "vc-progress-hex vc-progress-hex--sm kpi-gauge", "aria-hidden": "true", "aria-valuenow": String(Math.round(percent)) }
    : { class: "vc-progress-hex vc-progress-hex--sm kpi-gauge", role: "progressbar", "aria-label": label, "aria-valuenow": String(Math.round(percent)), "aria-valuemin": "0", "aria-valuemax": "100" }, text);
  el.style.setProperty("--value", String(percent));
  return el;
}

/** In a run the gauge is the button of the share it shows. */
function gaugeButton(label, cov, factId, ctx) {
  const shown = factText(ctx.state.facts, factId, ctx.lang);
  const btn = h("button", { type: "button", class: "fact-ref kpi-gauge-button", dataset: { fact: factId }, "aria-label": `${label}: ${shown}` }, gauge(label, cov.attainment, shown, { hidden: true }));
  btn.addEventListener("click", () => openFactDetails(factId, ctx));
  return btn;
}

/** run: { state, data } or null before a run. */
export function renderKpis(root, run) {
  clear(root);
  root.setAttribute("aria-label", t("kpis.label"));
  const l = lang();
  const ctx = run ? { state: run.state, data: run.data, lang: l } : null;
  const k = run ? run.state.kpis() : null;
  const big = (node) => h("div", { class: "vc-stat__value kpi-value" }, node);

  const duties = tile("duties", t("kpi.duties"), big(k ? factButton(k.fact_ids.duties_confirmed, ctx, l) : formatCount(0, l)), t("kpi.per_type"));
  duties.title = DUTY_TYPES.map((d) => `${t(`duty_type_short.${d}`)}: ${formatCount(k?.by_type[d] || 0, l)}`).join(" · ");

  const bench = (id, labelKey, cov, shareFact, attainmentFact) => {
    const label = t(labelKey);
    const value = k ? gaugeButton(label, cov, shareFact, ctx) : gauge(label, 0, formatShare(0, l));
    const note = h("span", { class: "kpi-bench" }, k ? factButton(attainmentFact, ctx, l) : formatShare(0, l), ` ${t("kpi.of_benchmark")}`);
    const el = tile(id, label, value, note);
    el.title = `${t("kpi.coverage_note", { removed: formatCount(cov?.removed || 0, l), total: formatCount(cov?.total || 0, l) })} · ${t("kpi.slice_note")}`;
    return el;
  };
  const reporting = bench("reporting", "kpi.reporting", k?.coverage.reporting, k?.fact_ids.reporting_share, k?.fact_ids.reporting_attainment);
  const documentation = bench("documentation", "kpi.documentation", k?.coverage.documentation, k?.fact_ids.documentation_share, k?.fact_ids.documentation_attainment);

  const pending = k && k.ea_pending_eur ? h("span", { class: "kpi-pending" }, `${t("kpi.pending")} `, factButton(k.fact_ids.ea_pending, ctx, l)) : t("kpi.estimate");
  const cost = tile("cost", t("kpi.cost"), big(k ? factButton(k.fact_ids.ea_addressed, ctx, l) : formatEur(0, l)), pending);
  for (const el of [duties, reporting, documentation, cost]) if (k) el.dataset.tone = "";
  root.append(duties, reporting, documentation, cost);
}
