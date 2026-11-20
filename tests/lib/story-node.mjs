// The engines' side of the browser suites: replays a recorded run in Node with the production modules
// (js/simulation.js, js/state.js and the engines) and the presenter's choices, and returns what the
// screen must show at every pause and at the end: the option figures, the top cluster, the duty map's
// counts, the tiles before and after, the dossier, the kept duties and the closing report. The browser
// suites compare the page with these values, so every expected figure is worked out by the engines in
// the test and none is copied from the page or written by hand.
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./harness.mjs";
import { loadBundled } from "./data-node.mjs";

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
globalThis.sessionStorage ??= memoryStorage();
globalThis.localStorage ??= memoryStorage();
globalThis.location ??= { search: "" };
const { loadI18n, t } = await import("../../js/i18n.js");
const { createRunState } = await import("../../js/state.js");
const { replayRun } = await import("../../js/simulation.js");
const { formatFactValue } = await import("../../js/engine/format.js");
const { renderPlaceholders, citeText, factText } = await import("../../js/placeholders.js");
await loadI18n(async (p) => new Response(readFileSync(path.join(APP_ROOT, p))));

export { t, citeText };

/** A display string with its spaces made plain (ICU's non-breaking and narrow spaces) and collapsed. */
export const plain = (s) => String(s ?? "").replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

export const readRun = (id) => JSON.parse(readFileSync(path.join(APP_ROOT, "data/runs", `${id}.json`), "utf8"));

/** The recorded intention of a request: what R1 to R3 were scripted around (never applied by the app). */
export const intended = (req) => ({ option_id: req.intended.option_id, decision: req.intended.decision, reason_code: req.intended.reason_code, comment: req.intended.comment || "" });

/** A fact's display string as the page shows it ("no longer applies" for a retired fact). */
export const shown = (state, id, lang) => plain(factText(state.facts, id, lang));

/** The four tiles: the figures the header shows, from the fixed KPI facts. */
export function tiles(state, lang) {
  const k = state.kpis();
  const f = (id) => plain(formatFactValue(state.facts.get(id), lang));
  return {
    duties: f(k.fact_ids.duties_confirmed), cost: f(k.fact_ids.ea_addressed),
    repShare: f(k.fact_ids.reporting_share), repAtt: f(k.fact_ids.reporting_attainment),
    docShare: f(k.fact_ids.documentation_share), docAtt: f(k.fact_ids.documentation_attainment),
    pending: k.ea_pending_eur ? f(k.fact_ids.ea_pending) : null
  };
}

/** Every registered fact as the page shows it, by id. */
export const factsSnapshot = (state, lang) => Object.fromEntries(state.facts.all().map((f) => [f.id, shown(state, f.id, lang)]));

/** Every registered fact as "Where does this figure come from?" shows it: value, label and inputs. */
export const factDetails = (state, lang) => Object.fromEntries(state.facts.all().map((f) => [f.id, { text: shown(state, f.id, lang), label: f.label?.code ? t(f.label.code, f.label.params || {}, lang) : f.key || f.id, inputs: [...(f.inputs || [])] }]));

/** A fact's label as "Where does this figure come from?" shows it, in `lang`. */
export const factLabelOf = (state, id, lang) => { const f = state.facts.get(id); return f?.label?.code ? t(f.label.code, f.label.params || {}, lang) : f?.key || id; };

/** The duty map's counts with the default filters: confirmed duties per "norm|type" cell. */
export function mapCounts(state) {
  const count = new Map();
  for (const d of state.duties.values()) if (d.status === "confirmed") count.set(`${d.norm_id}|${d.type}`, (count.get(`${d.norm_id}|${d.type}`) || 0) + 1);
  return count;
}

/** The duplicates board's order: the best option's relief, else the cluster's annual cost; ties by id. */
function potential(state, c) {
  const target = state.targets.get(c.id);
  const deltas = (target?.option_ids || []).map((id) => state.options.get(id)).filter((o) => o && o.type !== "keep" && o.status !== "withdrawn").map((o) => o.delta_ea_eur);
  if (deltas.length) return Math.min(...deltas);
  const est = state.estimates.get(c.id);
  const fact = est?.ea_annual_eur ? state.facts.get(est.ea_annual_eur) : null;
  return fact ? -fact.value : 0;
}

/** The top cluster as its card shows it: id, shared items, members, register, the € figure. */
function topCluster(state, data, lang) {
  const clusters = [...state.clusters.values()].sort((a, b) => potential(state, a) - potential(state, b) || (a.id < b.id ? -1 : 1));
  const c = clusters[0];
  if (!c) return null;
  const label = (id) => { const v = data.vocabById.get(id); return v ? (lang === "de" ? v.label : v.label_en || v.label) : String(id).replace(/^other:/, ""); };
  const target = state.targets.get(c.id);
  const best = (target?.option_ids || []).map((id) => state.options.get(id)).filter((o) => o && o.type !== "keep" && o.status !== "withdrawn").sort((a, b) => a.delta_ea_eur - b.delta_ea_eur)[0];
  const est = state.estimates.get(c.id);
  const figure = best ? shown(state, best.facts.net_delta, lang) : est?.ea_annual_eur ? shown(state, est.ea_annual_eur, lang) : null;
  const register = c.register_candidate ? data.registersById.get(c.register_candidate.register_id) : null;
  return {
    id: c.id,
    order: clusters.map((x) => x.id),
    shared: (c.shared_items || []).map(label),
    members: c.duty_ids.map((id) => state.duties.get(id)).filter(Boolean).map((m) => ({ id: m.id, cite: citeText(data, m.paragraph_id), recipient: m.recipient || "–", norm_id: m.norm_id, type: m.type })),
    register: register ? (lang === "de" ? register.label : register.label_en || register.label) : null,
    figure
  };
}

/** The option cards of a request: per option its type, status and every figure the card shows. */
function optionCards(state, req, lang) {
  const target = state.targets.get(req.target);
  return target.option_ids.map((id) => state.options.get(id)).filter(Boolean).map((o) => ({
    id: o.id, type: o.type, status: o.status,
    figures: Object.fromEntries(Object.entries(o.facts || {}).map(([m, fid]) => [m, { id: fid, text: shown(state, fid, lang) }]))
  }));
}

/** The evidence a duty card shows: the trigger phrase, the citation and its link. */
export function evidence(state, data, dutyId) {
  const d = state.duties.get(dutyId);
  const sentence = data.sentences.get(d.evidence_span.sentence_id);
  const s = d.evidence_span.start - sentence.start;
  const e = d.evidence_span.end - sentence.start;
  const para = data.paragraphs.get(d.paragraph_id);
  return { id: d.id, phrase: sentence.text.slice(s, e), cite: citeText(data, d.paragraph_id), href: para.html_url, norm_id: d.norm_id, type: d.type };
}

/**
 * Replays run `runId` in `lang`. choose(req, state) returns the presenter's decision for an option
 * request ({ option_id, decision, reason_code, comment }); by default the recorded intention. A cluster
 * review takes the recorded action (Simulation allows no other). edits: [{ atPause, duty, field, value }]
 * applied before the decision of that pause, as an assumption edit in Diagnostics.
 * Returns { run, data, state, pauses, final, report, events }.
 */
export async function replayStory(runId, lang, { choose = intended, edits = [] } = {}) {
  const run = readRun(runId);
  const data = loadBundled(run.meta.norm_ids);
  const state = createRunState({ data, lang, runId, mode: "simulation" });
  const pauses = [];
  const events = [];
  await replayRun({
    run, data, state, lang,
    emit: (ev) => events.push(ev),
    awaitReview: async (req, recorded) => {
      pauses.push({ kind: "review", cluster_id: req.cluster_id, action: recorded.action, separate_ids: recorded.separate_ids || [], tilesBefore: tiles(state, lang) });
      return state.reviewCluster({ cluster_id: req.cluster_id, action: recorded.action, separate_ids: recorded.separate_ids || [] });
    },
    awaitDecision: async (req) => {
      const n = pauses.length;
      const before = { tiles: tiles(state, lang), cards: optionCards(state, req, lang), top: topCluster(state, data, lang), map: mapCounts(state), facts: factsSnapshot(state, lang), details: factDetails(state, lang) };
      const applied = [];
      for (const e of edits.filter((x) => x.atPause === n)) {
        const change = state.editParam(e.duty, e.field, e.value);
        applied.push({ ...e, change });
      }
      const choice = choose(req, state);
      const pause = { kind: "option", target: req.target, option_ids: req.option_ids, intended: req.intended, choice, before, edits: applied };
      if (applied.length) pause.afterEdit = { tiles: tiles(state, lang), cards: optionCards(state, req, lang), facts: factsSnapshot(state, lang) };
      pauses.push(pause);
      return state.decide(choice);
    }
  });
  const reportEv = events.find((e) => e.type === "agent_text" && e.payload.kind === "report");
  return {
    run, data, state, pauses, events,
    final: {
      tiles: tiles(state, lang),
      facts: factsSnapshot(state, lang),
      details: factDetails(state, lang),
      items: state.dossier.items.map((x) => x.option_id),
      kept: state.dossier.kept.map((x) => ({ duty_id: x.duty_id, reason_code: x.reason_code, comment: x.comment, uses: x.data_uses.map((u) => (lang === "de" ? u.user : u.user_en || u.user)) })),
      dossier: state.dossier.items.map((x) => {
        const o = state.options.get(x.option_id);
        return { option_id: x.option_id, type: x.type, target: x.target, cites: x.paragraph_ids.map((p) => citeText(data, p)), net: shown(state, o.facts.net_delta, lang), wording: x.wording ? plain(renderPlaceholders(x.wording, { facts: state.facts, lang: "de", data })) : null };
      }),
      totals: plain(t("outbox.totals", { ea: shown(state, state.kpis().fact_ids.ea_addressed, lang), reporting: shown(state, state.kpis().fact_ids.reporting_share, lang), documentation: shown(state, state.kpis().fact_ids.documentation_share, lang) }, lang)),
      clusters: shown(state, state.kpis().fact_ids.clusters_found, lang),
      duties: shown(state, state.kpis().fact_ids.duties_confirmed, lang)
    },
    report: reportEv ? plain(renderPlaceholders(reportEv.payload.text, { facts: state.facts, lang, data })) : null
  };
}
