// The agent console: one line per tool call (its role, a plain sentence, the result when it arrives,
// the tool's English message behind Details when it failed), the narration with its AI label and its
// language tag, "Unsourced figure blocked" when the fact auditor stops a text, the decision requests
// and decisions, caps, notices and the closing report. A language switch re-renders the lines; model
// text keeps the language it was written in.

import { h, clear } from "./dom.js";
import { t } from "./i18n.js";
import { bus, roleOfTool } from "./events.js";
import { icon } from "./icons.js";
import { richText, factButton } from "./rich.js";
import { formatCount } from "./engine/format.js";

const TONE = { audit_failed: "danger", cap_reached: "warning", decision_requested: "yours", decision_recorded: "yours", cluster_split: "yours", cluster_confirmed: "yours" };
const MARK = { corpus: "book", duty_extractor: "search", once_matcher: "link", cost: "chart", signal: "bell", drafting: "edit", fact_auditor: "check", ui: "layers", orchestrator: "hub", human: "user" };

const clock = (ms) => { const s = Math.floor((ms || 0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

/** A tool result's summary sentence; counts are formatted by code, never by the model. */
function summaryText(summary, lng) {
  if (!summary?.code) return "";
  const p = { ...(summary.params || {}) };
  for (const k of Object.keys(p)) if (typeof p[k] === "number") p[k] = formatCount(p[k], lng);
  if (p.decision) p.decision = t(`decision.${p.decision}`, {}, lng);
  if (p.action) p.action = t(`review.${p.action}`, {}, lng);
  if (p.from) p.from = t(`params_from.${p.from}`, {}, lng);
  if (p.code && summary.code === "tool.error") p.code = String(p.code);
  return t(summary.code, p, lng);
}

/**
 * root: the .log element. ctx(): { state, data, lang, mode } of the current run. onOpen(kind, id) opens
 * the options drawer or the duplicates view from a decision request.
 */
export function createConsole(root, { ctx, onOpen }) {
  const events = [];
  const byCall = new Map();

  function line(ev) {
    const c = ctx();
    const lng = c.lang;
    const role = ev.type === "tool_call" || ev.type === "tool_result" ? roleOfTool(ev.payload.tool) : ev.agent || "orchestrator";
    const body = h("div", { class: "entry-body" });
    const entry = h("div", { class: "entry", dataset: { type: ev.type, tone: TONE[ev.type] || "", role } },
      h("span", { class: "entry-time" }, clock(ev.t_ms)),
      h("span", { class: "entry-mark", "aria-hidden": "true" }, icon(MARK[role] || "hub", 16)),
      body);
    const tag = (l) => h("span", { class: "vc-tag vc-tag--sm lang-tag", title: t(`lang.${l}_name`) }, l.toUpperCase());
    const ai = () => h("span", { class: "ai-chip" }, t("console.ai"));
    switch (ev.type) {
      case "tool_call":
        body.append(h("p", {}, h("strong", {}, `${t(`agent.${role}`)} `), t(`tool.label.${ev.payload.tool}`)));
        break;
      case "plan":
      case "agent_text": {
        const text = ev.payload.text;
        const kind = ev.type === "plan" ? "plan" : ev.payload.kind || "narration";
        const textLang = ev.payload.lang || lng;
        if (kind === "reasoning") {
          // The model's reasoning summary: behind a disclosure, in the language it was written in.
          body.append(h("details", { class: "reasoning" }, h("summary", {}, icon("chevronRight", 14), t("console.reasoning"), " ", tag(textLang)),
            h("p", { class: "reasoning-text", lang: textLang }, text)));
          break;
        }
        // A report the app rewrote after an assumption edit carries no AI label: no model wrote it.
        const updated = kind === "report" && ev.payload.updated === true;
        body.append(h("p", { class: "narration", dataset: updated ? { kind, updated: "true" } : { kind }, lang: textLang }, updated ? null : [ai(), " "], tag(textLang), " ",
          kind === "report" ? h("strong", {}, `${t(updated ? "console.report_updated" : "console.report")} `) : null,
          richText(text, { ...c, lang: textLang })));
        break;
      }
      case "audit_failed":
        body.append(h("p", {}, h("strong", {}, t("audit.blocked")), ev.payload.tokens?.length ? ` · ${ev.payload.tokens.join(", ")}` : "", ev.payload.field ? ` · ${t(`blocked_field.${ev.payload.field}`)}` : ""));
        break;
      case "decision_requested": {
        const cluster = ev.payload.kind === "cluster";
        const btn = h("button", { type: "button", class: "vc-button vc-button--sm", on: { click: () => onOpen(cluster ? "cluster" : "options", cluster ? ev.payload.cluster_id : ev.payload.target) } }, t(cluster ? "console.open_review" : "console.open_options"));
        body.append(h("p", {}, h("strong", {}, t(cluster ? "console.awaiting_review" : "console.awaiting_decision", { target: cluster ? ev.payload.cluster_id : ev.payload.target })), " "), btn);
        break;
      }
      case "decision_recorded": {
        const d = ev.payload.decision;
        body.append(h("p", {}, h("strong", {}, t("console.your_decision")), " ", t(`decision.${d.decision}`), ` · ${d.reason_code} ${t(`code.${d.reason_code}`)} · ${d.option_id}`));
        break;
      }
      case "cluster_split":
        body.append(h("p", {}, t("console.cluster_split", { cluster: ev.payload.cluster_id, parts: (ev.payload.parts || []).join(", ") || "–" })));
        break;
      case "cluster_confirmed":
        body.append(h("p", {}, t("console.cluster_confirmed", { cluster: ev.payload.cluster_id })));
        break;
      case "cap_reached":
        body.append(h("p", {}, h("strong", {}, t(`notice.cap_${ev.payload.cap === "cost" ? "cost" : "calls"}`))));
        break;
      case "notice":
        entry.dataset.tone = ev.payload.level === "error" ? "danger" : ev.payload.level === "warn" ? "warning" : "";
        body.append(h("p", {}, t(ev.payload.code, ev.payload.params || {}, lng)));
        break;
      case "run_finished":
        body.append(h("p", {}, h("strong", {}, t(`console.finished.${ev.payload.status || "done"}`))));
        break;
      case "run_started":
        body.append(h("p", {}, h("strong", {}, t("console.started", { run: ev.payload.run_id || "" })), " ", t(`mode.${ev.mode || "simulation"}`)));
        break;
      default:
        return null;
    }
    return entry;
  }

  function attachResult(entry, ev) {
    const body = entry.querySelector(".entry-body");
    body.querySelector(".tool-result")?.remove();
    const c = ctx();
    const fact = ev.payload.ok ? ev.payload.summary?.params?.fact : null;
    const res = h("p", { class: "tool-result", dataset: { ok: String(ev.payload.ok) } }, ev.payload.ok ? summaryText(ev.payload.summary, c.lang) : t("console.tool_error"),
      fact && c.state?.facts.get(fact) ? [" ", factButton(fact, c, c.lang)] : null);
    body.append(res);
    if (!ev.payload.ok && (ev.payload.content || ev.payload.error)) {
      body.append(h("details", { class: "tool-details" }, h("summary", {}, t("console.details")), h("p", { lang: "en" }, ev.payload.content || ev.payload.error)));
    }
  }

  const QUIET = new Set(["ui_progress", "ui_report"]);
  function add(ev, scroll = true) {
    // The narration and the report carry these two tools; a blocked text has its own line.
    if ((ev.type === "tool_call" || ev.type === "tool_result") && QUIET.has(ev.payload?.tool)) return;
    if (ev.type === "tool_result") {
      const entry = byCall.get(ev.payload.tool_use_id);
      if (entry) attachResult(entry, ev);
      return;
    }
    const entry = line(ev);
    if (!entry) return;
    // A newer closing report supersedes the earlier ones; they stay in the log, marked.
    if (ev.type === "agent_text" && ev.payload?.kind === "report") {
      for (const p of root.querySelectorAll('.narration[data-kind="report"]:not([data-superseded])')) {
        p.dataset.superseded = "true";
        p.querySelector("strong")?.after(h("span", { class: "vc-tag vc-tag--sm superseded-tag" }, t("console.superseded")), " ");
      }
    }
    if (ev.type === "tool_call") byCall.set(ev.payload.tool_use_id, entry);
    root.querySelector(".log-empty")?.remove();
    root.append(entry);
    if (scroll) root.scrollTop = root.scrollHeight;
  }

  const KEEP = new Set(["run_started", "plan", "tool_call", "tool_result", "agent_text", "audit_failed", "decision_requested", "decision_recorded", "cluster_split", "cluster_confirmed", "cap_reached", "run_finished", "notice"]);
  const off = bus.onAny((ev) => {
    if (!KEEP.has(ev.type)) return;
    const stored = { type: ev.type, payload: ev.payload, agent: ev.agent, t_ms: ev.t_ms, mode: ev.mode };
    events.push(stored);
    add(stored);
  });

  return {
    /** Re-renders every line (language switch). */
    rerender() {
      byCall.clear();
      for (const el of [...root.querySelectorAll(".entry")]) el.remove();
      for (const ev of events) add(ev, false);
      root.scrollTop = root.scrollHeight;
    },
    clear(emptyNode) {
      events.length = 0;
      byCall.clear();
      clear(root);
      if (emptyNode) root.append(emptyNode);
    },
    count: () => events.length,
    destroy: off
  };
}
