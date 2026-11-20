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
  const approvedRelief = state.decisions.some((d) => d.decision === "approved" && state.options.get(d.option_id)?.type !== "keep");
  lines.push(approvedRelief
    ? t("report.approved", { ea: fact(f.ea_addressed), reporting: fact(f.reporting_share), documentation: fact(f.documentation_share) }, lang)
    : t("report.none", {}, lang));
  if (state.dossier.kept.length) lines.push(t("report.kept", {}, lang));
  if (cap) lines.push(t(cap === "cost" ? "report.capped_cost" : "report.capped_calls", {}, lang));
  lines.push(t("report.close", {}, lang));
  return lines.join(" ");
}
