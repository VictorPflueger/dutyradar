// Assumptions & diagnostics (PLAN.md P-5): the shell's Diagnostics dialog, made wide. Sections:
// Assumptions (the cost parameters of the duties the run has priced, each with its source or the label
// Assumption, editable inline: an edit recomputes the facts, options and tiles and is logged as
// parameter_changed; before a run, the defaults per addressee group), the law snapshot, the network and
// security policy with the key's state, the model and caps, and the run's figures with the run
// checker's verdict on a recording. The self-test ("Run all tests") joins with version 1.0.0 (AC-28).

import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { t, lang } from "./i18n.js";
import { openModal } from "./modal.js";
import { APP, AGENT, FX_USD_EUR, RUN_DEFAULTS } from "./config.js";
import { formatCount, formatEur, formatNumber } from "./engine/format.js";
import { PARAM_FIELDS } from "./state.js";
import { citeText } from "./placeholders.js";
import { getKey, maskKey } from "./keystore.js";
import { sovereignStatus } from "./llm/openai-compat.js";
import { modelLabel } from "./agent.js";
import { checkRun } from "./run_check.js";

const longDate = (iso) => new Intl.DateTimeFormat(lang() === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
const row = (k, v) => h("tr", {}, h("th", { scope: "row" }, k), h("td", {}, v));
const table = (...rows) => h("table", { class: "vc-table diag-table" }, h("tbody", {}, rows));
const section = (id, titleKey, ...body) => h("section", { class: "diag-section", id: `diag-${id}` }, h("h3", {}, t(titleKey)), body);

/** "0,5" or "0.5" → 0.5; null when it is not a number of at least zero. */
export function parseLocalNumber(text) {
  const s = String(text).trim().replace(/\s/g, "");
  if (!/^\d+([.,]\d+)?$/.test(s)) return null;
  return Number(s.replace(",", "."));
}
const inputValue = (v) => (typeof v === "number" ? String(v).replace(".", lang() === "de" ? "," : ".") : "");

function basis(src) {
  if (!src) return "–";
  const why = lang() === "de" ? src.rationale || src.note : src.rationale_en || src.note_en || src.rationale || src.note;
  return h("span", { class: "param-basis" },
    src.edited ? h("span", { class: "vc-tag vc-tag--sm vc-tag--accent" }, t("diag.edited_tag")) : null,
    src.assumption ? h("span", { class: "vc-tag vc-tag--sm vc-tag--warning" }, t("badge.assumption")) : h("code", {}, src.source || "–"),
    why ? h("span", { class: "param-why" }, ` ${why}`) : null);
}

function assumptions(run, data, rerender) {
  const head = h("thead", {}, h("tr", {}, ["diag.col_duty", "diag.col_field", "diag.col_value", "diag.col_source"].map((k) => h("th", { scope: "col" }, t(k)))));
  if (!run || !run.state.params.size) {
    const rows = Object.entries(data.costParams.defaults || {}).flatMap(([group, d]) => PARAM_FIELDS.filter((f) => typeof d[f] === "number").map((f) =>
      h("tr", {}, h("th", { scope: "row" }, t(`addressee.${group}`)), h("td", {}, t(`param.${f}`)), h("td", { class: "num" }, formatNumber(d[f], lang(), 2)), h("td", {}, basis((d.sources || []).find((x) => x.field === f))))));
    return [h("p", {}, t("diag.assumptions_none")), h("div", { class: "diag-scroll" }, h("table", { class: "vc-table diag-params" }, head, h("tbody", {}, rows)))];
  }
  const msg = h("p", { class: "diag-msg", role: "status", "aria-live": "polite" });
  const rows = [];
  for (const dutyId of [...run.state.params.keys()].sort()) {
    const p = run.state.paramsFor(dutyId);
    const duty = run.state.duties.get(dutyId);
    for (const f of PARAM_FIELDS.filter((x) => typeof p[x] === "number")) {
      const input = h("input", { class: "vc-input vc-input--sm param-input", type: "text", inputmode: "decimal", value: inputValue(p[f]), "aria-label": t("diag.edit_label", { field: t(`param.${f}`), duty: dutyId }), dataset: { duty: dutyId, field: f } });
      const commit = () => {
        const value = parseLocalNumber(input.value);
        if (value === null) { msg.textContent = t("diag.edit_invalid"); msg.dataset.tone = "danger"; input.value = inputValue(run.state.paramsFor(dutyId)[f]); return; }
        if (value === run.state.paramsFor(dutyId)[f]) return;
        const change = run.state.editParam(dutyId, f, value);
        if (!change) return;
        run.audit.record("parameter_changed", { actor: "human", details: change });
        rerender(t("diag.edited", { changed: formatCount(change.changed.length, lang()), retired: formatCount(change.retired.length, lang()) }));
      };
      input.addEventListener("change", commit);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
      rows.push(h("tr", { dataset: { duty: dutyId, field: f } },
        h("th", { scope: "row" }, dutyId, h("span", { class: "param-cite" }, ` ${citeText(run.data, duty?.paragraph_id)}`)),
        h("td", {}, t(`param.${f}`)),
        h("td", { class: "num" }, input),
        h("td", {}, basis((p.sources || []).find((x) => x.field === f)))));
    }
  }
  return [h("p", {}, t("diag.assumptions_text")), msg, h("div", { class: "diag-scroll" }, h("table", { class: "vc-table diag-params" }, head, h("tbody", {}, rows)))];
}

function runFigures(run, cost) {
  if (!run) return [h("p", {}, t("diag.no_run"))];
  const l = lang();
  const st = run.state;
  const facts = st.facts.all().filter((f) => !f.retired).length;
  const rows = [
    row(t("diag.run"), `${run.runId} · ${t(`mode.${run.mode}`)} · ${run.lang.toUpperCase()}`),
    row(t("diag.events"), formatCount(run.events.length, l)),
    row(t("diag.audit_events"), formatCount(run.audit.events().length, l)),
    row(t("diag.facts"), formatCount(facts, l)),
    row(t("diag.decisions"), formatCount(st.decisions.length, l)),
    row(t("diag.dossier"), t("diag.dossier_value", { items: formatCount(st.dossier.items.length, l), kept: formatCount(st.dossier.kept.length, l) }))
  ];
  if (run.mode !== "simulation") rows.push(row(t("diag.calls"), t("controls.cost_meter", { calls: formatCount(cost?.calls || 0, l), max: formatCount(cost?.maxCalls || RUN_DEFAULTS.max_model_calls, l), eur: formatEur(cost?.eur || 0, l), budget: formatEur(cost?.budgetEur || RUN_DEFAULTS.max_cost_eur, l) })));
  if (run.recording) {
    const problems = checkRun(run.recording, { data: run.data });
    rows.push(row(t("diag.source"), run.recording.meta.source === "hand-authored" ? t("run.handwritten") : run.recording.meta.source));
    rows.push(row(t("diag.checker"), problems.length ? t("diag.checker_failed", { n: formatCount(problems.length, l), first: problems[0] }) : t("diag.checker_ok", { run: run.id })));
  }
  return [table(...rows)];
}

/** Opens the dialog. ctx: { index, data (base data loaded), run, cost, sovereign }. */
export function openDiagnostics({ index, data, run, cost, sovereign }) {
  const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || "";
  const tv = index.transport || {};
  const l = lang();
  const sov = sovereignStatus(sovereign);
  const assumptionsEl = h("div", {});
  const figuresEl = h("div", {});
  const render = (note = "") => {
    clear(assumptionsEl).append(...assumptions(run, data, render));
    if (note) { const m = assumptionsEl.querySelector(".diag-msg"); if (m) { m.textContent = note; m.dataset.tone = "success"; } }
    clear(figuresEl).append(...runFigures(run, cost));
  };
  render();
  openModal({
    title: t("screen.diagnostics"),
    size: "wide",
    className: "diag-modal",
    body: [
      section("assumptions", "diag.assumptions", assumptionsEl),
      section("snapshot", "diag.snapshot", table(
        row(t("diag.source"), index.source),
        row(t("diag.retrieved"), longDate(index.retrieved_at)),
        tv.kind === "archive" ? row(t("diag.archive"), `${tv.repository.replace("https://github.com/", "")} · ${tv.commit.slice(0, 12)}`) : null,
        row(t("start.slice_title"), `${index.slice_id} · ${formatCount(index.norms.length, l)}`),
        row(t("diag.links"), index.links.note ? t("diag.links_unchecked") : `${index.links.checked}`))),
      section("policy", "diag.policy", h("p", {}, t("diag.policy_text")),
        table(
          row(t("diag.key"), getKey() ? t("diag.key_set", { key: maskKey() }) : t("diag.key_none")),
          row(t("diag.sovereign"), sov.enabled ? `${sovereign.label || sovereign.base_url} · ${sovereign.model}` : t(sov.reason))),
        h("p", { class: "diag-label" }, t("diag.csp")), h("code", { class: "diag-code" }, policy)),
      section("model", "diag.model", table(
        row(t("diag.version"), `${APP.name} ${APP.version}`),
        row(t("diag.orchestrator"), t("diag.model_effort", { model: modelLabel(RUN_DEFAULTS.orchestrator_model), effort: t(`effort.${RUN_DEFAULTS.orchestrator_effort}`) })),
        row(t("diag.classifier"), t("diag.model_effort", { model: modelLabel(RUN_DEFAULTS.classifier_model), effort: t(`effort.${RUN_DEFAULTS.classifier_effort}`) })),
        row(t("diag.drafting"), t("diag.model_effort", { model: modelLabel(RUN_DEFAULTS.drafting_model), effort: t(`effort.${RUN_DEFAULTS.orchestrator_effort}`) })),
        row(t("diag.max_tokens"), t("diag.max_tokens_value", { orchestrator: formatCount(RUN_DEFAULTS.max_tokens_orchestrator, l), subcall: formatCount(RUN_DEFAULTS.max_tokens_subcall, l) })),
        row(t("diag.caps_label"), t("diag.caps", { calls: formatCount(RUN_DEFAULTS.max_model_calls, l), eur: formatEur(RUN_DEFAULTS.max_cost_eur, l) })),
        row(t("diag.soft"), t("diag.soft_value", { calls: formatCount(AGENT.softSteps, l), eur: formatEur(AGENT.softBudgetEur, l) })),
        row(t("diag.fx"), `1 USD = ${formatNumber(FX_USD_EUR, l, 3)} EUR`))),
      section("run", "diag.run_figures", figuresEl),
      h("p", { class: "cite-notice" }, icon("info", 16), t("cite.notice"))
    ]
  });
}
