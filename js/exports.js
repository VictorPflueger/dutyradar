// The exports: the relief dossier as Markdown and HTML (styles embedded), the audit log as JSON and the
// duty list as CSV (semicolons, byte order mark and decimal comma, so German Excel opens it in either
// language). File names follow the active language; timestamps use the browser's local time.

import { t, lang } from "./i18n.js";
import { renderPlaceholders, citeText } from "./placeholders.js";
import { downloadText } from "./dom.js";
import { RUN_DEFAULTS } from "./config.js";
import { recordedRun } from "./recorder.js";
import { dossierMeta } from "./outbox.js";

const pad = (n) => String(n).padStart(2, "0");
export function stamp(d = new Date(), withTime = true) {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return withTime ? `${date}-${pad(d.getHours())}${pad(d.getMinutes())}` : date;
}

/** File names in the active language. */
export function fileName(kind, { runId, sliceId, date = new Date() }) {
  const de = lang() === "de";
  switch (kind) {
    case "dossier_md": return `${de ? "entlastungsdossier" : "relief-dossier"}-${runId}-${stamp(date)}.md`;
    case "dossier_html": return `${de ? "entlastungsdossier" : "relief-dossier"}-${runId}-${stamp(date)}.html`;
    case "audit": return `${de ? "pflichten-radar-audit" : "duty-radar-audit"}-${runId}-${stamp(date)}.json`;
    case "duties": return `${de ? "pflichten-radar-pflichten" : "duty-radar-duties"}-${sliceId}-${stamp(date, false)}.csv`;
    case "run": return `${de ? "pflichten-radar-lauf" : "duty-radar-run"}-${runId}-${stamp(date)}.json`;
    default: return `${kind}.txt`;
  }
}

/** The dossier's content as structured lines (shared by Markdown and HTML). */
function dossierModel(run) {
  const { state, data } = run;
  const l = lang();
  const r = (text) => renderPlaceholders(text, { facts: state.facts, lang: l, data });
  const k = state.kpis();
  const items = state.dossier.items.map((x) => {
    const o = state.options.get(x.option_id);
    return {
      lapsed: Boolean(x.lapsed),
      title: `${t(`option_type.${o.type}`)} · ${x.target}`,
      cites: x.paragraph_ids.map((p) => citeText(data, p)).join(", "),
      delta: r(`{{fact:${o.facts.net_delta}}}`),
      by: ["wirtschaft", "verwaltung", "buerger"].filter((a) => o.facts[`${a}_delta`]).map((a) => `${t(`addressee.${a}`)} ${r(`{{fact:${o.facts[`${a}_delta`]}}}`)}`).join(" · "),
      oneOff: o.facts.one_off ? r(`{{fact:${o.facts.one_off}}}`) : null,
      removed: x.removed_duty_ids.join(", ") || "–",
      reason: `${x.reason_code} ${t(`code.${x.reason_code}`)}${x.comment ? ` · ${x.comment}` : ""}`,
      wording: x.wording ? r(x.wording) : null,
      gist: x.gist_en && l === "en" ? r(x.gist_en) : null
    };
  });
  const kept = state.dossier.kept.map((x) => ({
    title: `${x.duty_id} · ${citeText(data, state.duties.get(x.duty_id)?.paragraph_id)}`,
    reason: `${x.reason_code} ${t(`code.${x.reason_code}`)}${x.comment ? ` · ${x.comment}` : ""}`,
    uses: x.data_uses.map((u) => (l === "de" ? u.user : u.user_en || u.user)).join(", ") || t("outbox.no_uses")
  }));
  return {
    title: t("outbox.title"),
    meta: dossierMeta(run),
    totals: t("outbox.totals", { ea: r(`{{fact:${k.fact_ids.ea_addressed}}}`), reporting: r(`{{fact:${k.fact_ids.reporting_share}}}`), documentation: r(`{{fact:${k.fact_ids.documentation_share}}}`) }),
    items, kept,
    footnote: t("outbox.footnote"),
    notice: t("outbox.notice")
  };
}

export function dossierMarkdown(run) {
  const m = dossierModel(run);
  const out = [`# ${m.title}`, "", m.meta, "", `**${m.totals}**`, ""];
  if (!m.items.length) out.push(t("outbox.empty"), "");
  for (const x of m.items) {
    out.push(`## ${x.title}`, "");
    if (x.lapsed) out.push(`*${t("outbox.lapsed")}*`, "");
    out.push(`- ${t("outbox.cites")}: ${x.cites}`, `- ${t("options.delta")} ${x.delta} ${t("options.per_year")}${x.by ? ` (${x.by})` : ""}`);
    if (x.oneOff) out.push(`- ${t("options.one_off")} ${x.oneOff}`);
    out.push(`- ${t("outbox.removed")}: ${x.removed}`, `- ${t("outbox.reason")}: ${x.reason}`, "");
    if (x.wording) out.push(`> ${x.wording}`, "");
    if (x.gist) out.push(`*${t("options.gist")}* ${x.gist}`, "");
  }
  out.push(`## ${t("dossier.kept")}`, "");
  if (!m.kept.length) out.push(t("outbox.none_kept"), "");
  for (const x of m.kept) out.push(`- ${x.title}: ${x.reason}; ${t("outbox.uses")}: ${x.uses}`);
  out.push("", `*${m.footnote}*`, "", m.notice, "");
  return out.join("\n");
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function dossierHtml(run) {
  const m = dossierModel(run);
  const items = m.items.map((x) => `<section><h2>${esc(x.title)}</h2>${x.lapsed ? `<p><em>${esc(t("outbox.lapsed"))}</em></p>` : ""}<ul><li>${esc(t("outbox.cites"))}: ${esc(x.cites)}</li><li>${esc(t("options.delta"))} ${esc(x.delta)} ${esc(t("options.per_year"))}${x.by ? ` (${esc(x.by)})` : ""}</li>${x.oneOff ? `<li>${esc(t("options.one_off"))} ${esc(x.oneOff)}</li>` : ""}<li>${esc(t("outbox.removed"))}: ${esc(x.removed)}</li><li>${esc(t("outbox.reason"))}: ${esc(x.reason)}</li></ul>${x.wording ? `<blockquote lang="de">${esc(x.wording)}</blockquote>` : ""}${x.gist ? `<p><em>${esc(t("options.gist"))}</em> ${esc(x.gist)}</p>` : ""}</section>`).join("");
  const kept = m.kept.length ? `<ul>${m.kept.map((x) => `<li>${esc(x.title)}: ${esc(x.reason)}; ${esc(t("outbox.uses"))}: ${esc(x.uses)}</li>`).join("")}</ul>` : `<p>${esc(t("outbox.none_kept"))}</p>`;
  return `<!DOCTYPE html><html lang="${lang()}"><head><meta charset="utf-8"><title>${esc(m.title)}</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:52rem;margin:2rem auto;padding:0 1rem;color:#250010}h1,h2{line-height:1.2}blockquote{border-left:3px solid #8f2f42;margin:0;padding:.25rem 1rem;background:#fbf7f5}small{color:#5b4b4e}</style></head><body><h1>${esc(m.title)}</h1><p><small>${esc(m.meta)}</small></p><p><strong>${esc(m.totals)}</strong></p>${m.items.length ? items : `<p>${esc(t("outbox.empty"))}</p>`}<h2>${esc(t("dossier.kept"))}</h2>${kept}<p><small>${esc(m.footnote)}</small></p><p>${esc(m.notice)}</p></body></html>\n`;
}

/** The duty list: semicolons, a byte order mark, decimal comma; the same format in both languages. */
export function dutiesCsv(run) {
  const { state, data } = run;
  const cell = (v) => { const s = String(v ?? ""); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const dec = (v) => (typeof v === "number" ? String(v).replace(".", ",") : "");
  const head = ["id", "norm", "paragraph", "type", "addressee", "trigger", "frequency_per_year", "recipient", "data_items", "confidence", "status", "html_url"];
  const rows = [...state.duties.values()].map((d) => {
    const p = data.paragraphs.get(d.paragraph_id);
    return [d.id, p?.abbr || d.norm_id, p?.enbez || d.paragraph_id, d.type, d.addressee, d.trigger, dec(d.frequency_per_year), d.recipient ?? "", (d.data_items || []).join(","), dec(d.classification?.confidence), d.status, p?.html_url || ""].map(cell).join(";");
  });
  return `\uFEFF${[head.join(";"), ...rows].join("\r\n")}\r\n`;
}

/** Downloads one export and logs export_created. */
export async function exportFile(kind, run) {
  const names = { runId: run.runId, sliceId: run.data.sliceId };
  let text;
  let mime = "text/plain";
  if (kind === "dossier_md") { text = dossierMarkdown(run); mime = "text/markdown"; }
  else if (kind === "dossier_html") { text = dossierHtml(run); mime = "text/html"; }
  else if (kind === "audit") {
    const settings = { mode: run.mode, lang: run.lang, run: run.id, norm_ids: run.normIds || [], max_model_calls: RUN_DEFAULTS.max_model_calls, max_cost_eur: RUN_DEFAULTS.max_cost_eur };
    text = run.audit.exportJson({ model: run.model || null, settings, facts: run.state.facts.all(), decisions: run.state.decisions });
    mime = "application/json";
  }
  else if (kind === "duties") { text = dutiesCsv(run); mime = "text/csv"; }
  else if (kind === "run") { text = JSON.stringify(recordedRun(run), null, 1); mime = "application/json"; }
  const name = fileName(kind, names);
  downloadText(name, text, mime);
  await run.audit.record("export_created", { actor: "human", details: { kind, file: name } });
  return name;
}
