// Options & review (drawer tab 1): the option cards of the target the agent asked about, with ΔEA per
// year in total and by addressee, the change in the number of duties, the one-off cost, the German draft
// wording with its English gist in an English run, the audit status and the risks; the keep card with
// its justification basis; the reason code, the comment and Approve, Reject, Ask for information.

import { h, clear } from "./dom.js";
import { t, lang } from "./i18n.js";
import { factButton, richText } from "./rich.js";
import { DecisionError, REASONS } from "./state.js";


/** request: the open decision request { target, option_ids } or null; ui: { selected, error } kept by the caller. */
export function renderOptions(panel, run, { request, ui, onChange }) {
  clear(panel);
  const l = lang();
  if (!run) { panel.append(h("p", { class: "drawer-empty" }, t("options.empty"))); return; }
  const { state, data } = run;
  const ctx = { state, data, lang: l };
  const targetId = request?.target || ui.lastTarget;
  const target = targetId ? state.targets.get(targetId) : null;
  if (!target) { panel.append(h("p", { class: "drawer-empty" }, t("options.empty"))); return; }
  ui.lastTarget = targetId;
  const ids = (request?.option_ids || target.option_ids).filter((id) => state.options.get(id));
  if (!ui.selected || !ids.includes(ui.selected)) ui.selected = ids.find((id) => ["proposed", "under_review"].includes(state.options.get(id).status)) || null;

  const fig = (o, m) => (o.facts?.[m] ? factButton(o.facts[m], ctx, l) : null);
  const cards = target.option_ids.map((id) => state.options.get(id)).filter(Boolean).map((o) => {
    const open = ids.includes(o.id) && ["proposed", "under_review"].includes(o.status) && !o.target_decided && !target.decided;
    const radio = h("input", { type: "radio", name: "option-choice", value: o.id, class: "vc-radio", checked: ui.selected === o.id, disabled: !open, "aria-label": t(`option_type.${o.type}`), on: { change: () => { ui.selected = o.id; state.openOption(o.id); onChange(); } } });
    const rows = [];
    rows.push(h("p", { class: "option-delta" }, t("options.delta"), " ", fig(o, "net_delta"), ` ${t("options.per_year")}`));
    const by = ["wirtschaft", "verwaltung", "buerger"].filter((a) => o.facts?.[`${a}_delta`]);
    if (by.length) rows.push(h("p", { class: "option-by" }, by.map((a) => h("span", {}, `${t(`addressee.${a}`)} `, fig(o, `${a}_delta`), " "))));
    if (o.facts?.buerger_hours_delta) rows.push(h("p", {}, t("options.hours"), " ", fig(o, "buerger_hours_delta")));
    rows.push(h("p", {}, t("options.duty_count"), " ", fig(o, "duty_count_delta")));
    if (o.facts?.one_off) rows.push(h("p", {}, t("options.one_off"), " ", fig(o, "one_off")));
    if (o.type === "keep") {
      const b = o.details?.justification_basis || {};
      rows.push(h("div", { class: "keep-basis" }, h("p", {}, h("strong", {}, t("options.keep_basis"))),
        h("ul", {},
          // The uses by name (a count here would be a figure without a source).
          h("li", {}, t("options.uses", { uses: (b.data_uses || []).length ? b.data_uses.map((u) => (l === "de" ? u.user : u.user_en || u.user)).join(", ") : t("options.uses_none") })),
          h("li", {}, b.eu_related ? t("badge.eu") : t("options.no_eu")),
          h("li", {}, b.protected_standard ? `${t("badge.protected")}: ${t(`protected.${b.protected_standard}`)}` : t("options.no_standard")))));
    }
    if (o.draft?.wording) {
      rows.push(h("details", { class: "option-draft" }, h("summary", {}, t("options.draft_title")),
        h("p", { lang: "de", class: "draft-wording" }, h("span", { class: "ai-chip" }, t("console.ai")), " ", richText(o.draft.wording, { ...ctx, lang: "de" })),
        o.draft.gist_en && l === "en" ? h("p", { lang: "en", class: "draft-gist" }, h("strong", {}, `${t("options.gist")} `), richText(o.draft.gist_en, { ...ctx, lang: "en" })) : null));
    }
    if (o.type !== "keep") rows.push(h("p", { class: "audit-status", dataset: { state: o.audit?.flag === "manual" ? "manual" : o.audit?.passed ? "passed" : o.audit?.last === "fail" ? "failed" : "pending" } },
      o.audit?.flag === "manual" ? t("audit.manual") : o.audit?.passed ? t("options.audit_passed") : o.audit?.last === "fail" ? t("audit.blocked") : t("options.audit_pending")));
    for (const r of o.risks || []) rows.push(h("p", { class: "vc-tag vc-tag--sm vc-tag--warning" }, t(`risk.${r}`)));
    for (const n of o.notes || []) rows.push(h("p", { class: "vc-tag vc-tag--sm" }, t(`note.${n}`)));
    return h("article", { class: "vc-card option-card", dataset: { type: o.type, status: o.status, selected: String(ui.selected === o.id) }, id: `option-${o.id}` },
      h("header", { class: "option-head" }, h("label", { class: "option-pick" }, radio, h("strong", {}, t(`option_type.${o.type}`))),
        h("span", { class: "vc-tag vc-tag--sm", dataset: { status: o.status } }, o.target_decided && o.status !== "approved" ? t("options.target_decided") : t(`option_status.${o.status === "withdrawn" ? "draft" : o.status}`))),
      rows);
  });
  const ineligible = target.ineligible?.length && target.option_ids.length - 1 < 3
    ? h("div", { class: "ineligible" }, h("p", {}, h("strong", {}, t("options.ineligible"))), h("ul", {}, target.ineligible.map((x) => h("li", {}, `${t(`option_type.${x.type}`)}: ${t(`reason.${x.reason}`)}`))))
    : null;

  const group = (labelKey, codes) => h("optgroup", { label: t(labelKey) }, codes.map((c) => h("option", { value: c, selected: ui.reason === c }, `${c} ${t(`code.${c}`)}`)));
  const reason = h("select", { class: "vc-select", id: "reason-code", "aria-label": t("options.reason") },
    h("option", { value: "" }, t("options.reason_choose")),
    group("options.codes_approve", REASONS.approved),
    group("options.codes_reject", REASONS.rejected),
    group("options.codes_info", REASONS.needs_info));
  reason.addEventListener("change", () => { ui.reason = reason.value; });
  const comment = h("textarea", { class: "vc-textarea", id: "decision-comment", rows: "2", "aria-label": t("options.comment") });
  comment.value = ui.comment || "";
  comment.addEventListener("input", () => { ui.comment = comment.value; });
  const decide = (decision) => {
    ui.error = null;
    try {
      state.decide({ option_id: ui.selected, decision, reason_code: reason.value, comment: comment.value });
      ui.reason = ""; ui.comment = "";
    } catch (e) {
      if (!(e instanceof DecisionError)) throw e;
      ui.error = t(`error.decision.${e.code}`, e.params);
    }
    onChange();
  };
  const disabled = !request || !ui.selected;
  const form = h("div", { class: "decision-form" },
    h("label", { class: "vc-field" }, h("span", { class: "vc-label" }, t("options.reason")), reason),
    h("label", { class: "vc-field" }, h("span", { class: "vc-label" }, t("options.comment")), comment, h("span", { class: "vc-help" }, t("options.comment_help"))),
    h("div", { class: "decision-buttons" },
      h("button", { type: "button", class: "vc-button", id: "btn-approve", disabled, on: { click: () => decide("approved") } }, t("options.approve")),
      h("button", { type: "button", class: "vc-button vc-button--outline", id: "btn-reject", disabled, on: { click: () => decide("rejected") } }, t("options.reject")),
      h("button", { type: "button", class: "vc-button vc-button--ghost", id: "btn-info", disabled, on: { click: () => decide("needs_info") } }, t("options.info"))),
    ui.error ? h("p", { class: "field-msg", role: "alert" }, ui.error) : null);
  panel.append(h("div", { class: "options-layout" },
    h("div", { class: "options-main" },
      h("h3", { class: "options-title" }, t("options.for_target", { target: targetId })),
      h("div", { class: "option-cards" }, cards),
      ineligible),
    request ? form : h("p", { class: "drawer-empty options-side" }, t("options.no_request"))));
}
