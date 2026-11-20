// "Where does this figure come from?": the fact's label, value, producing tool and inputs, with each
// input's value and its source or the label Assumption. Opened from every figure on screen.

import { h } from "./dom.js";
import { t, lang } from "./i18n.js";
import { openModal } from "./modal.js";
import { formatFactValue, formatNumber } from "./engine/format.js";

/** A fact label { code, params } in the active language. */
export const factLabel = (fact) => (fact?.label?.code ? t(fact.label.code, fact.label.params || {}) : fact?.key || "");

function inputRow(input, state) {
  const m = /^param:(.+)\.([a-z_]+)$/.exec(input);
  if (!m) {
    const opt = state.options.get(input);
    return h("li", {}, opt ? `${t(`option_type.${opt.type}`)} (${input})` : input);
  }
  const [, dutyId, field] = m;
  const p = state.paramsFor(dutyId);
  const src = (p?.sources || []).find((s) => s.field === field);
  const value = p?.[field];
  const shown = typeof value === "number" ? formatNumber(value, lang(), 2) : String(value ?? "–");
  const basis = src?.assumption
    ? h("span", { class: "vc-tag vc-tag--warning vc-tag--sm" }, t("badge.assumption"))
    : h("code", {}, src?.source || "–");
  const why = src ? (lang() === "de" ? src.rationale || src.note : src.rationale_en || src.note_en || src.rationale || src.note) : null;
  return h("li", {}, h("span", { class: "fact-input" }, `${dutyId} · ${t(`param.${field}`)}: ${shown}`), " ", basis, why ? h("span", { class: "fact-why" }, ` ${why}`) : null);
}

export function openFactDetails(id, { state }) {
  const fact = state?.facts.get(id);
  const value = fact && !fact.retired ? formatFactValue(fact, lang()) : t("fact.retired");
  openModal({
    title: t("fact.where"),
    className: "fact-modal",
    body: [
      h("p", { class: "fact-head" }, h("strong", {}, factLabel(fact) || id), " ", h("span", { class: "fact-value" }, value)),
      h("dl", { class: "fact-meta" },
        h("dt", {}, t("fact.id")), h("dd", {}, id),
        h("dt", {}, t("fact.produced_by")), h("dd", {}, fact?.produced_by ? t(`tool.label.${fact.produced_by}`, {}, lang()) : "–"),
        h("dt", {}, t("fact.key")), h("dd", {}, h("code", {}, fact?.key || state?.facts.keyOf(id) || "–"))),
      fact?.inputs?.length ? h("div", {}, h("p", { class: "fact-inputs-title" }, t("fact.inputs")), h("ul", { class: "fact-inputs" }, fact.inputs.map((i) => inputRow(i, state)))) : h("p", {}, t("fact.no_inputs"))
    ]
  });
}
