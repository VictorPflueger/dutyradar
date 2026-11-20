// A duty card: the sentence with the trigger phrase highlighted, the § link and the legal-status note,
// the badges "EU-related" and "Protected standard", the categories, the data items, the classifier's
// rationale with its AI label (or "Text blocked"), the warnings and the provenance.

import { h } from "./dom.js";
import { t, lang } from "./i18n.js";
import { citeText } from "./placeholders.js";
import { formatCount, formatShare } from "./engine/format.js";
import { icon } from "./icons.js";

const itemLabel = (data, id) => {
  if (String(id).startsWith("other:")) return String(id).slice(6);
  const v = data.vocabById.get(id);
  return v ? (lang() === "de" ? v.label : v.label_en || v.label) : id;
};

export function renderDutyCard(d, run) {
  const { data, state } = run;
  const l = lang();
  const para = data.paragraphs.get(d.paragraph_id);
  const sentence = data.sentences.get(d.evidence_span?.sentence_id);
  const quote = h("blockquote", { class: "duty-quote", lang: "de" });
  if (sentence && para) {
    const s = d.evidence_span.start - sentence.start;
    const e = d.evidence_span.end - sentence.start;
    const text = sentence.text;
    if (s >= 0 && e <= text.length && s < e) quote.append(text.slice(0, s), h("mark", { class: "trigger" }, text.slice(s, e)), text.slice(e));
    else quote.append(text);
  }
  const blocked = (field) => d.blocked_fields?.includes(field);
  const rows = [
    [t("dutycard.type"), t(`duty_type.${d.type}`)],
    [t("dutycard.addressee"), d.addressee ? t(`addressee.${d.addressee}`) : "–"],
    [t("dutycard.trigger"), d.trigger ? `${t(`trigger.${d.trigger}`)}${d.frequency_term ? ` · ${t(`frequency.${d.frequency_term}`)}` : ""}` : "–"],
    [t("dutycard.recipient"), blocked("recipient") ? t("audit.text_blocked") : h("span", { lang: "de" }, d.recipient || "–")],
    [t("dutycard.items"), h("span", { class: "chips" }, (d.data_items || []).map((i) => h("span", { class: "vc-chip vc-chip--sm" }, itemLabel(data, i))), blocked("data_items") ? h("span", { class: "vc-tag vc-tag--sm vc-tag--danger" }, t("audit.text_blocked")) : null)],
    [t("dutycard.population"), d.population_id ? (lang() === "de" ? data.populationsById.get(d.population_id)?.label : data.populationsById.get(d.population_id)?.label_en) || d.population_id : "–"],
    [t("dutycard.confidence"), `${formatShare(d.classification?.confidence ?? 0, l)} · ${d.classification?.certainty ? t(`certainty.${d.classification.certainty}`) : "–"}`]
  ];
  const signals = state.signals.get(d.id) || [];
  return h("article", { class: "vc-card duty-card", dataset: { status: d.status }, id: `card-${d.id}` },
    h("header", { class: "duty-card-head" },
      h("h4", {}, d.id),
      h("span", { class: "vc-tag vc-tag--sm", dataset: { status: d.status } }, t(`duty_status.${d.status}`)),
      d.eu_related ? h("span", { class: "vc-tag vc-tag--sm", title: (data.norms.get(d.norm_id)?.eu_basis || []).join(", ") }, t("badge.eu")) : null,
      d.protected_standard ? h("span", { class: "vc-tag vc-tag--sm vc-tag--warning" }, `${t("badge.protected")}: ${t(`protected.${d.protected_standard}`)}`) : null),
    quote,
    h("p", { class: "duty-cite" }, para?.html_url ? h("a", { href: para.html_url, target: "_blank", rel: "noopener noreferrer" }, citeText(data, d.paragraph_id), " ", icon("external", 14)) : citeText(data, d.paragraph_id)),
    h("p", { class: "cite-notice" }, icon("info", 14), t("cite.notice")),
    h("dl", { class: "duty-facts" }, rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
    // The rationale is model text: the AI label, and the language it was written in (the run's), as in
    // the console; it keeps that language when the page switches.
    h("p", { class: "duty-rationale" }, h("span", { class: "ai-chip" }, t("console.ai")), " ",
      blocked("rationale") || !d.classification?.rationale
        ? (blocked("rationale") ? t("audit.text_blocked") : "–")
        : [h("span", { class: "vc-tag vc-tag--sm lang-tag", title: t(`lang.${state.lang}_name`) }, state.lang.toUpperCase()), " ", h("span", { class: "rationale-text", lang: state.lang }, d.classification.rationale)]),
    (d.warnings || []).length ? h("p", { class: "vc-tag vc-tag--warning vc-tag--sm" }, d.warnings.map((w) => t(`warning.${w}`)).join(" · ")) : null,
    signals.length ? h("p", { class: "duty-signals" }, t("dutycard.signals", { count: formatCount(signals.length, l), ids: signals.join(", ") })) : null,
    h("p", { class: "duty-provenance" }, t("dutycard.provenance", { tool: d.provenance?.tool || "–", run: d.provenance?.run_id || "–", method: d.classification?.model ? d.classification.model : t("dutycard.recorded") })));
}
