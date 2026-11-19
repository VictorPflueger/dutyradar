// The duty map: norms (rows, grouped by family) × the six duty types, the count of duty cards in each
// cell on Vici's ink ramp (seven steps, the count printed), filters for addressee, minimum confidence
// and "needs review". A cell opens its duty cards in a panel over the map's right side.

import { h, clear } from "./dom.js";
import { t, lang } from "./i18n.js";
import { formatCount } from "./engine/format.js";
import { DUTY_TYPES } from "./kpi.js";
import { renderDutyCard } from "./dutycard.js";

const FILTERS = { addressee: "all", minConfidence: 0, needsReview: false };

/** The ink step of a count: 0 empty, then 1 to 6 by the largest count on the map. */
const step = (n, max) => (n <= 0 ? 0 : Math.max(1, Math.min(6, Math.ceil((n / Math.max(1, max)) * 6))));

export function renderDutyMap(root, run, { slice, onSelect, selected = null, reading = null }) {
  clear(root);
  const l = lang();
  const index = run.data.index;
  const duties = [...run.state.duties.values()].filter((d) => {
    if (FILTERS.needsReview) return d.status === "needs_review";
    if (d.status !== "confirmed") return false;
    if (FILTERS.addressee !== "all" && d.addressee !== FILTERS.addressee) return false;
    return (d.classification?.confidence ?? 0) >= FILTERS.minConfidence;
  });
  const count = new Map();
  for (const d of duties) count.set(`${d.norm_id}|${d.type}`, (count.get(`${d.norm_id}|${d.type}`) || 0) + 1);
  const max = Math.max(1, ...count.values());
  const scanned = new Set([...run.state.candidates.values()].map((c) => c.norm_id));

  const filterBar = h("div", { class: "map-filters", role: "group", "aria-label": t("dutymap.filters") },
    h("label", { class: "control-field" }, h("span", { class: "control-label" }, t("dutymap.addressee")),
      h("select", { class: "vc-select control-select", on: { change: (e) => { FILTERS.addressee = e.target.value; onSelect(selected, true); } } },
        ["all", "wirtschaft", "verwaltung", "buerger"].map((a) => h("option", { value: a, selected: FILTERS.addressee === a }, a === "all" ? t("dutymap.all") : t(`addressee.${a}`))))),
    h("label", { class: "control-field" }, h("span", { class: "control-label" }, t("dutymap.confidence")),
      h("select", { class: "vc-select control-select", on: { change: (e) => { FILTERS.minConfidence = Number(e.target.value); onSelect(selected, true); } } },
        [0, 0.7, 0.9].map((c) => h("option", { value: String(c), selected: FILTERS.minConfidence === c }, c ? t("dutymap.at_least", { value: t(`certainty.${c === 0.9 ? "hoch" : "mittel"}`) }) : t("dutymap.all"))))),
    h("label", { class: "check-field" }, h("input", { type: "checkbox", class: "vc-checkbox", checked: FILTERS.needsReview, on: { change: (e) => { FILTERS.needsReview = e.target.checked; onSelect(selected, true); } } }), t("dutymap.needs_review")));

  const head = h("tr", {}, h("th", { scope: "col" }, t("start.col_norm")), DUTY_TYPES.map((d) => h("th", { scope: "col", title: t(`duty_type.${d}`) }, t(`duty_type_short.${d}`))));
  const rows = [];
  const families = [...new Set(index.norms.map((n) => n.family))];
  for (const f of families) {
    rows.push(h("tr", { class: "family-row" }, h("th", { colspan: String(DUTY_TYPES.length + 1), scope: "colgroup" }, slice.families?.[f]?.[l] || f)));
    for (const n of index.norms.filter((x) => x.family === f)) {
      const cells = DUTY_TYPES.map((d) => {
        const c = count.get(`${n.id}|${d}`) || 0;
        const key = `${n.id}|${d}`;
        const label = `${n.abbr}, ${t(`duty_type.${d}`)}: ${formatCount(c, l)}`;
        return h("td", { class: "map-cell" }, c
          ? h("button", { type: "button", class: "map-count", dataset: { ink: String(step(c, max)) }, "aria-label": label, "aria-pressed": String(selected === key), on: { click: () => onSelect(key) } }, formatCount(c, l))
          : h("span", { class: "map-count", dataset: { ink: "0" }, "aria-label": label }, scanned.has(n.id) ? "0" : "·"));
      });
      rows.push(h("tr", { dataset: { norm: n.id, reading: String(reading === n.id) } }, h("th", { scope: "row" }, n.abbr), cells));
    }
  }
  const grid = h("div", { class: "map-wrap" }, h("table", { class: "vc-table map-table" }, h("caption", { class: "vc-visually-hidden" }, t("dutymap.caption")), h("thead", {}, head), h("tbody", {}, rows)));
  const layout = h("div", { class: "map-layout", dataset: { open: String(Boolean(selected)) } }, grid);
  if (selected) {
    const [normId, type] = selected.split("|");
    const cards = duties.filter((d) => d.norm_id === normId && d.type === type);
    const norm = index.norms.find((x) => x.id === normId);
    layout.append(h("aside", { class: "card-panel", "aria-label": t("dutycard.panel", { norm: norm?.abbr || normId, type: t(`duty_type.${type}`) }) },
      h("div", { class: "card-panel-head" }, h("h3", {}, `${norm?.abbr || normId} · ${t(`duty_type.${type}`)}`),
        h("button", { type: "button", class: "vc-button vc-button--ghost vc-button--sm", on: { click: () => onSelect(null) } }, t("dutycard.close"))),
      h("div", { class: "card-list" }, cards.map((d) => renderDutyCard(d, run)))));
  }
  root.append(filterBar, layout);
}
