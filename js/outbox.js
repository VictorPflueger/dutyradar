// The outbox (drawer tab 2): "Relief dossier (draft)" with the totals (compliance cost addressed and the
// two coverages, each a figure that opens its source), the approved options (their figures, the
// paragraphs they touch, the duties they remove, the reason code and comment, the German draft wording
// and its English gist in an English run), the kept duties with code, comment and data uses, the
// footnote on assumptions, the four exports and "Nothing is sent." Only the reviewer's approvals fill
// it. The same function draws the print copy of the dossier (css/print.css): without element ids, so
// nothing on screen is repeated, and without the exports.

import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { t, lang } from "./i18n.js";
import { citeText, factText, renderPlaceholders } from "./placeholders.js";
import { factButton, richText } from "./rich.js";

const EXPORTS = [["dossier_md", "outbox.export_md"], ["dossier_html", "outbox.export_html"], ["audit", "outbox.export_audit"], ["duties", "outbox.export_csv"]];

/**
 * run: the current run or null; onExport(kind) downloads one export. forPrint: the print copy, without
 * ids and exports, with every figure as plain text.
 */
export function renderOutbox(panel, run, { onExport, forPrint = false }) {
  clear(panel);
  const l = lang();
  const id = (value) => (forPrint ? null : value);
  panel.append(h("h3", { class: "outbox-title" }, t("outbox.title")));
  const ctx = run ? { state: run.state, data: run.data, lang: l } : null;
  // A figure on screen opens its source; on paper it is the figure.
  const figure = (factId) => (forPrint ? h("span", { class: "fact-print" }, factText(run.state.facts, factId, l)) : factButton(factId, ctx, l));
  const items = run ? run.state.dossier.items : [];
  const kept = run ? run.state.dossier.kept : [];
  if (run) {
    const f = run.state.kpis().fact_ids;
    const totals = h("p", { class: "dossier-totals" });
    // The sentence of the totals with its three figures in place: {ea}, {reporting}, {documentation}.
    const parts = t("outbox.totals", { ea: "\u0000ea\u0000", reporting: "\u0000reporting\u0000", documentation: "\u0000documentation\u0000" }).split("\u0000");
    const ids = { ea: f.ea_addressed, reporting: f.reporting_share, documentation: f.documentation_share };
    totals.append(...parts.map((p, i) => (i % 2 ? figure(ids[p]) : p)));
    panel.append(totals);
  }

  if (!items.length) panel.append(h("p", { class: "drawer-empty" }, t("outbox.empty")));
  else {
    panel.append(h("ol", { class: "dossier-items" }, items.map((x) => {
      const o = run.state.options.get(x.option_id);
      const by = ["wirtschaft", "verwaltung", "buerger"].filter((a) => o?.facts?.[`${a}_delta`]);
      return h("li", { class: "vc-card dossier-item", id: id(`dossier-${x.option_id}`), dataset: { type: x.type, option: x.option_id } },
        h("p", { class: "dossier-head" }, h("strong", {}, t(`option_type.${x.type}`)), ` · ${x.target}`),
        h("p", { class: "dossier-delta" }, t("options.delta"), " ", figure(o.facts.net_delta), ` ${t("options.per_year")}`,
          by.length ? h("span", { class: "dossier-by" }, " (", by.map((a, i) => [i ? " · " : "", `${t(`addressee.${a}`)} `, figure(o.facts[`${a}_delta`])]), ")") : null),
        o.facts.one_off ? h("p", {}, t("options.one_off"), " ", figure(o.facts.one_off)) : null,
        h("p", { class: "dossier-meta" }, `${t("outbox.cites")}: ${x.paragraph_ids.map((p) => citeText(run.data, p)).join(", ")} · ${t("outbox.removed")}: ${x.removed_duty_ids.join(", ") || "–"}`),
        h("p", { class: "dossier-meta" }, `${t("outbox.reason")}: ${x.reason_code} ${t(`code.${x.reason_code}`)}${x.comment ? ` · ${x.comment}` : ""}`),
        x.wording ? h("details", { class: "option-draft", open: forPrint }, h("summary", {}, t("options.draft_title")),
          h("p", { lang: "de", class: "draft-wording" }, h("span", { class: "ai-chip" }, t("console.ai")), " ", forPrint ? renderPlaceholders(x.wording, { facts: run.state.facts, lang: "de", data: run.data }) : richText(x.wording, { ...ctx, lang: "de" })),
          x.gist_en && l === "en" ? h("p", { lang: "en", class: "draft-gist" }, h("strong", {}, `${t("options.gist")} `), forPrint ? renderPlaceholders(x.gist_en, { facts: run.state.facts, lang: "en", data: run.data }) : richText(x.gist_en, { ...ctx, lang: "en" })) : null) : null);
    })));
  }

  panel.append(h("h4", { class: "outbox-sub" }, t("dossier.kept")));
  if (!kept.length) panel.append(h("p", { class: "drawer-empty" }, t("outbox.none_kept")));
  else {
    panel.append(h("ul", { class: "kept-list" }, kept.map((k) => {
      const duty = run.state.duties.get(k.duty_id);
      const uses = k.data_uses.map((u) => (l === "de" ? u.user : u.user_en || u.user)).join(", ");
      return h("li", { class: "kept-item", id: id(`kept-${k.duty_id}`), dataset: { duty: k.duty_id } },
        h("strong", {}, k.duty_id), ` · ${citeText(run.data, duty?.paragraph_id)} · `,
        h("span", { class: "kept-code" }, `${k.reason_code} ${t(`code.${k.reason_code}`)}`),
        k.comment ? ` · ${k.comment}` : "",
        h("span", { class: "kept-uses" }, ` · ${t("outbox.uses")}: ${uses || t("outbox.no_uses")}`));
    })));
  }

  if (run) panel.append(h("p", { class: "dossier-footnote" }, t("outbox.footnote")));
  if (!forPrint) {
    const buttons = EXPORTS.map(([kind, key]) => {
      const b = h("button", { type: "button", class: "vc-button vc-button--outline vc-button--sm", id: `export-${kind}`, disabled: !run }, icon("download", 16), h("span", {}, t(key)));
      b.addEventListener("click", () => onExport(kind));
      return b;
    });
    panel.append(h("h4", { class: "outbox-sub" }, t("outbox.exports")), h("div", { class: "export-buttons" }, buttons));
    if (!run) panel.append(h("p", { class: "drawer-empty" }, t("outbox.export_none")));
  }
  panel.append(h("p", { class: "outbox-notice" }, icon("shield", 16), t("outbox.notice")));
}
