// The closing report from the template in js/i18n/*.json, filled with the run's facts: Simulation
// always uses it (a recording holds no text that depends on a decision), and a Live run that stops at a
// cap uses it too, because no model call may follow (PLAN.md P-3).

import { t } from "./i18n.js";

const fact = (id) => `{{fact:${id}}}`;

/** Text with placeholders only, in the run's language. cap: null, "calls" or "cost". */
export function buildClosingReport(state, { cap = null } = {}) {
  const lang = state.lang;
  const k = state.kpis();
  const f = k.fact_ids;
  const lines = [t("report.inventory", { duties: fact(f.duties_confirmed), clusters: fact(f.clusters_found) }, lang)];
  // Relief that still counts; an approval an assumption edit withdrew has lapsed and is named as such.
  const approvedRelief = state.dossier.items.some((x) => !x.lapsed);
  const lapsed = state.dossier.items.filter((x) => x.lapsed).map((x) => x.option_id);
  if (approvedRelief) lines.push(t("report.approved", { ea: fact(f.ea_addressed), reporting: fact(f.reporting_share), documentation: fact(f.documentation_share) }, lang));
  else if (!lapsed.length) lines.push(t("report.none", {}, lang));
  if (lapsed.length) lines.push(t("report.lapsed", { options: lapsed.join(", ") }, lang));
  if (state.dossier.kept.length) lines.push(t("report.kept", {}, lang));
  if (cap) lines.push(t(cap === "cost" ? "report.capped_cost" : "report.capped_calls", {}, lang));
  lines.push(t("report.close", {}, lang));
  return lines.join(" ");
}
