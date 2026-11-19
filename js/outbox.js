// The outbox (drawer tab 2): "Relief dossier (draft)" with the approved options (their figures, the
// paragraphs they touch, the duties they remove, the reason code and comment, the German draft wording
// and its English gist in an English run), the kept duties with code, comment and data uses, the four
// exports and "Nothing is sent." Only the reviewer's approvals fill it.

import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { t, lang } from "./i18n.js";
import { citeText } from "./placeholders.js";
import { factButton, richText } from "./rich.js";

const EXPORTS = [["dossier_md", "outbox.export_md"], ["dossier_html", "outbox.export_html"], ["audit", "outbox.export_audit"], ["duties", "outbox.export_csv"]];

/** run: the current run or null; onExport(kind) downloads one export. */
export function renderOutbox(panel, run, { onExport }) {
  clear(panel);
  const l = lang();
  panel.append(h("h3", { class: "outbox-title" }, t("outbox.title")));
  const ctx = run ? { state: run.state, data: run.data, lang: l } : null;
  const items = run ? run.state.dossier.items : [];
  const kept = run ? run.state.dossier.kept : [];

  if (!items.length) panel.append(h("p", { class: "drawer-empty" }, t("outbox.empty")));
  else {
    panel.append(h("ol", { class: "dossier-items" }, items.map((x) => {
      const o = run.state.options.get(x.option_id);
      const by = ["wirtschaft", "verwaltung", "buerger"].filter((a) => o?.facts?.[`${a}_delta`]);
      return h("li", { class: "vc-card dossier-item", id: `dossier-${x.option_id}`, dataset: { type: x.type } },
        h("p", { class: "dossier-head" }, h("strong", {}, t(`option_type.${x.type}`)), ` · ${x.target}`),
        h("p", {}, t("options.delta"), " ", factButton(o.facts.net_delta, ctx, l), ` ${t("options.per_year")}`,
          by.length ? h("span", { class: "dossier-by" }, " (", by.map((a, i) => [i ? " · " : "", `${t(`addressee.${a}`)} `, factButton(o.facts[`${a}_delta`], ctx, l)]), ")") : null),
        o.facts.one_off ? h("p", {}, t("options.one_off"), " ", factButton(o.facts.one_off, ctx, l)) : null,
        h("p", { class: "dossier-meta" }, `${t("outbox.cites")}: ${x.paragraph_ids.map((p) => citeText(run.data, p)).join(", ")} · ${t("outbox.removed")}: ${x.removed_duty_ids.join(", ") || "–"}`),
        h("p", { class: "dossier-meta" }, `${t("outbox.reason")}: ${x.reason_code} ${t(`code.${x.reason_code}`)}${x.comment ? ` · ${x.comment}` : ""}`),
        x.wording ? h("details", { class: "option-draft" }, h("summary", {}, t("options.draft_title")),
          h("p", { lang: "de", class: "draft-wording" }, h("span", { class: "ai-chip" }, t("console.ai")), " ", richText(x.wording, { ...ctx, lang: "de" })),
          x.gist_en && l === "en" ? h("p", { lang: "en", class: "draft-gist" }, h("strong", {}, `${t("options.gist")} `), richText(x.gist_en, { ...ctx, lang: "en" })) : null) : null);
    })));
  }

  panel.append(h("h4", { class: "outbox-sub" }, t("dossier.kept")));
  if (!kept.length) panel.append(h("p", { class: "drawer-empty" }, t("outbox.none_kept")));
  else {
    panel.append(h("ul", { class: "kept-list" }, kept.map((k) => {
      const duty = run.state.duties.get(k.duty_id);
      const uses = k.data_uses.map((u) => (l === "de" ? u.user : u.user_en || u.user)).join(", ");
      return h("li", { class: "kept-item", id: `kept-${k.duty_id}` },
        h("strong", {}, k.duty_id), ` · ${citeText(run.data, duty?.paragraph_id)} · `,
        h("span", { class: "kept-code" }, `${k.reason_code} ${t(`code.${k.reason_code}`)}`),
        k.comment ? ` · ${k.comment}` : "",
        h("span", { class: "kept-uses" }, ` · ${t("outbox.uses")}: ${uses || t("outbox.no_uses")}`));
    })));
  }

  const buttons = EXPORTS.map(([kind, key]) => {
    const b = h("button", { type: "button", class: "vc-button vc-button--outline vc-button--sm", id: `export-${kind}`, disabled: !run }, icon("download", 16), h("span", {}, t(key)));
    b.addEventListener("click", () => onExport(kind));
    return b;
  });
  panel.append(h("h4", { class: "outbox-sub" }, t("outbox.exports")), h("div", { class: "export-buttons" }, buttons));
  if (!run) panel.append(h("p", { class: "drawer-empty" }, t("outbox.export_none")));
  panel.append(h("p", { class: "outbox-notice" }, icon("shield", 16), t("outbox.notice")));
}
