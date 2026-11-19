// The duplicates board: cluster cards sorted by € potential (the best option's relief once options
// exist, else the cluster's annual cost), with the shared data items, the member duties with their
// citations, recipients and frequencies, the register candidate (simulated), the confidence and the
// review actions. In Simulation a review offers only the recorded action; a recorded split preselects
// its members read-only.

import { h, clear, setDisabled } from "./dom.js";
import { t, lang } from "./i18n.js";
import { citeText } from "./placeholders.js";
import { formatCount, formatShare } from "./engine/format.js";
import { factButton } from "./rich.js";

function potential(run, c) {
  const target = run.state.targets.get(c.id);
  const deltas = (target?.option_ids || []).map((id) => run.state.options.get(id)).filter((o) => o && o.type !== "keep" && o.status !== "withdrawn").map((o) => o.delta_ea_eur);
  if (deltas.length) return { value: Math.min(...deltas), fact: null };
  const est = run.state.estimates.get(c.id);
  const fact = est?.ea_annual_eur ? run.state.facts.get(est.ea_annual_eur) : null;
  return { value: fact ? -fact.value : 0, fact: est?.ea_annual_eur || null };
}

/** review: { cluster_id, recorded } while a review waits; onReview({ cluster_id, action, separate_ids }). */
export function renderDuplicates(root, run, { review, onReview, error = null }) {
  clear(root);
  const l = lang();
  const { state, data } = run;
  const ctx = { state, data, lang: l };
  const clusters = [...state.clusters.values()].sort((a, b) => potential(run, a).value - potential(run, b).value || (a.id < b.id ? -1 : 1));
  if (!clusters.length) {
    root.append(h("div", { class: "centre-empty" }, h("p", {}, state.clusteredOnce ? t("duplicates.none") : t("duplicates.empty"))));
    return;
  }
  const label = (id) => { const v = data.vocabById.get(id); return v ? (l === "de" ? v.label : v.label_en || v.label) : String(id).replace(/^other:/, ""); };
  const cards = clusters.map((c) => {
    const pending = review?.cluster_id === c.id;
    const members = c.duty_ids.map((id) => state.duties.get(id)).filter(Boolean);
    const est = state.estimates.get(c.id);
    const target = state.targets.get(c.id);
    const best = (target?.option_ids || []).map((id) => state.options.get(id)).filter((o) => o && o.type !== "keep" && o.status !== "withdrawn").sort((a, b) => a.delta_ea_eur - b.delta_ea_eur)[0];
    const figure = best ? h("span", { class: "cluster-figure" }, t("duplicates.best", { type: t(`option_type.${best.type}`) }), " ", factButton(best.facts.net_delta, ctx, l))
      : est?.ea_annual_eur ? h("span", { class: "cluster-figure" }, t("duplicates.cost"), " ", factButton(est.ea_annual_eur, ctx, l)) : null;
    const checks = members.map((m) => {
      const preset = review?.recorded?.action === "split" && review.recorded.separate_ids.includes(m.id);
      return h("label", { class: "check-field member-check" },
        pending && run.mode === "simulation" ? h("input", { type: "checkbox", class: "vc-checkbox", value: m.id, checked: preset, disabled: true }) : pending ? h("input", { type: "checkbox", class: "vc-checkbox", value: m.id }) : null,
        h("span", {}, `${citeText(data, m.paragraph_id)} · `, h("span", { lang: "de" }, m.recipient || "–"), ` · ${m.frequency_term ? t(`frequency.${m.frequency_term}`) : t(`trigger.${m.trigger}`)}`),
        h("span", { class: "member-id" }, ` ${m.id}`));
    });
    const confirm = h("button", { type: "button", class: "vc-button vc-button--sm", on: { click: () => onReview({ cluster_id: c.id, action: "confirm" }) } }, t("cluster.confirm"));
    const split = h("button", { type: "button", class: "vc-button vc-button--outline vc-button--sm", on: { click: (e) => {
      const card = e.target.closest(".cluster-card");
      const sep = [...card.querySelectorAll(".member-check input")].filter((i) => i.checked).map((i) => i.value);
      onReview({ cluster_id: c.id, action: "split", separate_ids: sep });
    } } }, t("cluster.split"));
    if (pending && run.mode === "simulation") {
      if (review.recorded.action === "split") setDisabled(confirm, true, t("sim.preset"));
      else setDisabled(split, true, t("sim.preset"));
    }
    const conf = h("span", { class: "confidence", title: t("duplicates.confidence") },
      h("span", { class: "vc-progress-hex vc-progress-hex--sm conf-hex", role: "img", "aria-label": `${t("duplicates.confidence")} ${formatShare(c.confidence, l)}` }, formatShare(c.confidence, l)));
    conf.firstChild.style.setProperty("--value", String(Math.round(c.confidence * 100)));
    const decided = target?.decided ? state.options.get(target.decided) : null;
    return h("article", { class: "vc-card cluster-card", id: `cluster-${c.id}`, dataset: { status: c.status, pending: String(pending), decided: String(Boolean(decided)) } },
      h("header", { class: "cluster-head" },
        h("h3", {}, c.id),
        h("span", { class: "vc-tag vc-tag--sm", dataset: { status: c.status } }, t(`cluster_status.${c.status}`)),
        decided ? h("span", { class: "vc-tag vc-tag--sm vc-tag--success" }, t("duplicates.decided", { type: t(`option_type.${decided.type}`) })) : null,
        h("span", {}, `${t(`addressee.${c.addressee}`)} · ${(l === "de" ? data.populationsById.get(c.population_id)?.label : data.populationsById.get(c.population_id)?.label_en) || c.population_id}`),
        figure),
      h("p", { class: "chips" }, t("duplicates.shared"), " ", (c.shared_items || []).map((i) => h("span", { class: "vc-chip vc-chip--sm" }, label(i)))),
      h("div", { class: "members" }, checks),
      h("p", { class: "cluster-meta" },
        c.register_candidate ? h("span", { class: "vc-tag vc-tag--sm" }, `${t("duplicates.register")}: ${(l === "de" ? data.registersById.get(c.register_candidate.register_id)?.label : data.registersById.get(c.register_candidate.register_id)?.label_en) || c.register_candidate.register_id} · ${t("badge.simulated")}`) : null,
        conf,
        h("span", {}, t("duplicates.members", { n: formatCount(c.duty_ids.length, l) }))),
      pending ? h("div", { class: "cluster-actions" }, confirm, split, error ? h("p", { class: "field-msg", role: "alert" }, error) : null) : null);
  });
  root.append(h("div", { class: "cluster-list" }, cards));
}
