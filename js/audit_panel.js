// The audit tab (drawer tab 3): the run's AuditEvents, newest first, with the time, the event, who acted
// (the agent, the reviewer, the system), the tool or model with its usage and cost, and the decision's
// code; the export of the whole log as JSON. Keys never enter the log (js/audit.js redacts every event).

import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { t, lang } from "./i18n.js";
import { formatCount, formatEur } from "./engine/format.js";
import { modelLabel } from "./agent.js";

const time = (iso) => new Date(iso).toLocaleTimeString(lang() === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function detail(e) {
  const l = lang();
  const d = e.details || {};
  switch (e.event) {
    case "model_request": return `${modelLabel(e.model)} · ${t(`audit.kind.${d.kind || "orchestrator"}`)}`;
    case "model_response": return `${modelLabel(e.model)} · ${t("audit.usage", { input: formatCount(e.usage?.input_tokens || 0, l), output: formatCount(e.usage?.output_tokens || 0, l) })} · ${formatEur(e.cost_eur || 0, l)}`;
    case "tool_called": return `${e.tool} · ${t(`tool.label.${e.tool}`)}`;
    case "tool_result": return `${e.tool} · ${d.ok ? t("audit.ok") : t("audit.failed")}`;
    case "audit_failed": return `${e.tool || "–"}${d.tokens?.length ? ` · ${d.tokens.join(", ")}` : ""}`;
    case "decision_recorded": return `${d.option_id} · ${t(`decision.${d.decision}`)} · ${d.reason_code} ${t(`code.${d.reason_code}`)}`;
    case "cluster_split": return `${d.cluster_id} → ${(d.parts || []).join(", ")}`;
    case "parameter_changed": return `${d.duty_id} · ${t(`param.${d.field}`)}`;
    case "export_created": return d.file || d.kind || "";
    case "cap_reached": return t(`notice.cap_${d.cap === "cost" ? "cost" : "calls"}`);
    case "run_started": return [d.run, d.mode ? t(`mode.${d.mode}`) : null].filter(Boolean).join(" · ");
    case "mode_set": return d.mode ? t(`mode.${d.mode}`) : "";
    case "run_stopped": return d.status ? t(`state.${d.status === "incomplete" ? "incomplete" : d.status}`) : "";
    case "error": return d.message || d.type || "";
    default: return "";
  }
}

/** run: the current run or null; onExport() downloads the audit JSON. */
export function renderAuditPanel(panel, run, { onExport }) {
  clear(panel);
  const events = run ? run.audit.events() : [];
  const exportBtn = h("button", { type: "button", class: "vc-button vc-button--outline vc-button--sm", id: "export-audit-tab", disabled: !run }, icon("download", 16), h("span", {}, t("audit.export")));
  exportBtn.addEventListener("click", () => onExport());
  panel.append(h("div", { class: "audit-head" }, h("h3", { class: "outbox-title" }, t("audit.title")), exportBtn));
  if (!events.length) { panel.append(h("p", { class: "drawer-empty" }, t("audit.empty"))); return; }
  const actor = (a) => (a === "human" ? t("reviewer.role") : t(`audit.actor.${a}`));
  const rows = events.slice().reverse().map((e) => h("tr", { dataset: { event: e.event, actor: e.actor } },
    h("td", { class: "audit-time" }, time(e.ts)),
    h("td", {}, h("span", { class: "audit-event" }, t(`audit.event.${e.event}`))),
    h("td", {}, actor(e.actor)),
    h("td", { class: "audit-detail" }, detail(e)),
    h("td", { class: "audit-id" }, e.id)));
  panel.append(h("div", { class: "audit-wrap", tabindex: "0", role: "region", "aria-label": t("audit.title") }, h("table", { class: "vc-table audit-table" },
    h("caption", { class: "vc-visually-hidden" }, t("audit.title")),
    h("thead", {}, h("tr", {}, ["audit.col_time", "audit.col_event", "audit.col_actor", "audit.col_detail", "audit.col_id"].map((k) => h("th", { scope: "col" }, t(k))))),
    h("tbody", {}, rows))));
}
