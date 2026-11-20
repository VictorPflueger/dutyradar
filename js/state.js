// The run state: the single source of truth for candidates, duty cards, clusters, cost parameters,
// facts, options, decisions and the dossier of one run. Pure (no DOM, no storage, no fetch): the
// tools, the Live loop, the replay and the screens all work on it, and Node tests drive it directly.
// It enforces the specification's review transitions: only a reviewer's decision changes an option's
// outcome, at most one option per target is approved (keep included), and no relief counts twice.

import { createFactRegistry } from "./engine/facts.js";
import { clusterDuties, splitCluster, bestRegister } from "./engine/cluster.js";
import { dutyCost, isInformationObligation, sliceCoverage } from "./engine/cost.js";
import { draftOptions } from "./engine/options.js";
import { auditText } from "./engine/auditor.js";

export const PARAM_FIELDS = ["population_units", "frequency_per_year", "cases_per_year", "minutes_per_case", "wage_eur_per_hour", "material_eur_per_case", "admin_minutes_per_case", "admin_wage_eur_per_hour"];
export const REASONS = {
  approved: ["Z1", "Z2", "Z3", "Z4", "Z5"],
  keep: ["A1", "A2", "A3", "A4", "A6"],
  rejected: ["A1", "A2", "A3", "A4", "A5", "A6"],
  needs_info: ["I1"]
};
export const COMMENT_REQUIRED = ["Z5", "A6"];
export const COMMENT_MAX = 500;
export const MAX_AUDIT_FAILURES = 3;
export const REVIEWER_ROLE = "Referentin (Demo)";

/** An invalid decision or review; code is an i18n key below error.decision.* with params. */
export class DecisionError extends Error {
  constructor(code, params = {}) {
    super(`${code} ${JSON.stringify(params)}`);
    this.name = "DecisionError";
    this.code = code;
    this.params = params;
  }
}

// KPI facts live on fixed ids above the tools' range, so the screens' timing never shifts a tool fact's id.
const KPI_FACTS = {
  duties_confirmed: ["F-9001", "COUNT"],
  reporting_share: ["F-9002", "SHARE"],
  reporting_attainment: ["F-9003", "SHARE"],
  documentation_share: ["F-9004", "SHARE"],
  documentation_attainment: ["F-9005", "SHARE"],
  ea_addressed: ["F-9006", "EUR_PER_YEAR"],
  ea_pending: ["F-9007", "EUR_PER_YEAR"],
  clusters_found: ["F-9008", "COUNT"]
};

const clone = (x) => JSON.parse(JSON.stringify(x));
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const paramInputs = (dutyId, p) => PARAM_FIELDS.filter((f) => p[f] !== null && p[f] !== undefined).map((f) => `param:${dutyId}.${f}`);

export function createRunState({ data, lang = "en", runId = "R1", mode = "simulation", now = () => new Date() } = {}) {
  const facts = createFactRegistry();
  for (const [measure, [id]] of Object.entries(KPI_FACTS)) facts.bind(id, `kpi|${runId}|${measure}`);

  const listeners = new Set();
  const waiters = new Set();
  let emitter = null;
  let decisionSeq = 0;

  const s = {
    data, lang, runId, mode, facts,
    candidates: new Map(),
    duties: new Map(),
    clusters: new Map(),
    params: new Map(),
    edits: new Map(),
    estimates: new Map(),
    options: new Map(),
    targets: new Map(),
    decisions: [],
    dossier: { items: [], kept: [] },
    signals: new Map(),
    report: null,
    auditFailures: 0,
    requests: [],
    clusteredOnce: false
  };

  const notify = (change) => { for (const fn of listeners) fn(change); for (const w of [...waiters]) w(); };
  const emit = (type, payload) => emitter?.(type, payload);

  // ---- candidates and duty cards ----------------------------------------------------------------
  s.addCandidates = (normId, list) => {
    for (const c of list) {
      const sentence = data.sentences.get(c.sentence_id);
      s.candidates.set(c.candidate_id, { ...c, norm_id: normId, paragraph_id: sentence?.paragraph_id || null });
    }
    notify({ type: "candidates", norm_id: normId });
  };
  s.setDuty = (card) => {
    s.duties.set(card.id, card);
    notify({ type: "duty", id: card.id });
  };
  s.confirmedDuties = () => [...s.duties.values()].filter((d) => d.status === "confirmed");

  // ---- clusters --------------------------------------------------------------------------------------
  const withParagraphs = (c) => ({ ...c, paragraph_ids: [...new Set(c.duty_ids.map((id) => s.duties.get(id)?.paragraph_id).filter(Boolean))] });

  /** Rules 2–7 over the confirmed duties; returns the clusters. Reviewed clusters keep their state. */
  s.cluster = (addressee = null) => {
    const reviewed = [...s.clusters.values()].some((c) => c.status !== "candidate");
    if (reviewed) return { ok: false, error: "clusters_reviewed" };
    const pool = s.confirmedDuties().filter((d) => !addressee || d.addressee === addressee);
    const keep = addressee ? [...s.clusters.values()].filter((c) => c.addressee !== addressee) : [];
    const start = keep.length + 1;
    const { clusters } = clusterDuties(pool, { core: data.core, start });
    s.clusters = new Map([...keep, ...clusters.map(withParagraphs)].map((c) => [c.id, c]));
    s.clusteredOnce = true;
    notify({ type: "clusters" });
    return { ok: true, clusters: [...s.clusters.values()] };
  };

  /** A cluster review: confirm, or split by the members to separate (rule 7). */
  s.reviewCluster = ({ cluster_id, action, separate_ids = [] }) => {
    const c = s.clusters.get(cluster_id);
    if (!c) throw new DecisionError("unknown_cluster", { cluster_id });
    if (c.status !== "candidate") throw new DecisionError("cluster_reviewed", { cluster_id });
    if (action === "confirm") {
      c.status = "confirmed";
      emit("cluster_confirmed", { cluster_id });
      notify({ type: "cluster_review", cluster_id, action });
      return { cluster_id, action: "confirmed", parts: [] };
    }
    if (action !== "split") throw new DecisionError("unknown_action", { action });
    const sep = separate_ids.filter((id) => c.duty_ids.includes(id));
    if (!sep.length || sep.length === c.duty_ids.length) throw new DecisionError("split_members", { cluster_id });
    const { parts } = splitCluster(c, sep, s.duties, { core: data.core });
    c.status = "split";
    c.separated = sep;
    for (const p of parts) s.clusters.set(p.id, withParagraphs(p));
    emit("cluster_split", { cluster_id, separate_ids: sep, parts: parts.map((p) => p.id) });
    notify({ type: "cluster_review", cluster_id, action: "split" });
    return { cluster_id, action: "split", parts: parts.map((p) => p.id) };
  };

  s.registerFor = (targetId) => {
    const t = resolveTarget(targetId);
    if (!t) return null;
    const reg = t.kind === "duty" ? bestRegister({ kind: "duty", duty: t.duty }, data.registers) : bestRegister({ kind: "cluster", members: t.members.map((m) => m.duty) }, data.registers);
    if (t.kind === "cluster" && reg.register_id) {
      t.cluster.register_candidate = { register_id: reg.register_id, covers_items: reg.covers_items, covers_duty_ids: reg.covers_duty_ids, availability: reg.availability };
      notify({ type: "cluster", id: targetId });
    }
    return reg;
  };

  // ---- cost parameters ----------------------------------------------------------------------------------
  const assumption = (field, de, en, extra = {}) => ({ field, assumption: true, rationale: de, rationale_en: en, ...extra });

  function buildParams(duty) {
    const entry = (data.costParams.duties || []).find((d) => d.duty_id === duty.id);
    let p;
    let warning = null;
    if (entry) {
      p = clone(entry);
      p.from = "entry";
      const cardFreq = duty.frequency_per_year;
      if ((duty.trigger && duty.trigger !== p.trigger) || (p.trigger === "periodisch" && cardFreq !== null && cardFreq !== undefined && cardFreq !== p.frequency_per_year)) warning = "params_mismatch";
    } else {
      const d = data.costParams.defaults?.[duty.addressee] || data.costParams.defaults?.wirtschaft || {};
      const pop = duty.population_id ? data.populationsById.get(duty.population_id) : null;
      const units = pop ? pop.units : d.population_units;
      const trigger = duty.trigger || "periodisch";
      const freq = trigger === "periodisch" ? (duty.frequency_per_year ?? 1) : null;
      p = {
        duty_id: duty.id, addressee: duty.addressee, trigger, population_id: duty.population_id ?? null,
        population_units: units,
        frequency_per_year: freq,
        cases_per_year: trigger === "anlassbezogen" ? units * (d.events_per_unit_per_year ?? 1) : null,
        minutes_per_case: d.minutes_per_case,
        wage_eur_per_hour: duty.addressee === "buerger" ? null : d.wage_eur_per_hour,
        material_eur_per_case: d.material_eur_per_case,
        admin_minutes_per_case: d.admin_minutes_per_case,
        admin_wage_eur_per_hour: d.admin_wage_eur_per_hour,
        admin_level: d.admin_level || "bund",
        from: "defaults"
      };
      const basis = (f) => (d.sources || []).find((x) => x.field === f)?.source || null;
      p.sources = [
        assumption("population_units", pop ? "Population der Pflicht, bis zur Kalibrierung angenommen" : "Standardwert der Adressatengruppe, bis zur Kalibrierung angenommen", pop ? "The duty's population, assumed until calibration" : "Default of the addressee group, assumed until calibration", { basis: pop ? `population:${pop.id}` : basis("population_units") })
      ];
      if (freq !== null) p.sources.push(assumption("frequency_per_year", duty.frequency_per_year !== null && duty.frequency_per_year !== undefined ? "Turnus aus der Klassifikation des Normtexts" : "Turnus nicht genannt, jährlich angenommen", duty.frequency_per_year !== null && duty.frequency_per_year !== undefined ? "Frequency from the classification of the law's text" : "Frequency not stated, yearly assumed", { basis: duty.evidence_span?.sentence_id ? `norm:${duty.evidence_span.sentence_id}` : null }));
      if (p.cases_per_year !== null) p.sources.push(assumption("cases_per_year", "Einheiten mal Anlässe je Einheit und Jahr, angenommen", "Units times events per unit and year, assumed"));
      for (const f of ["minutes_per_case", "wage_eur_per_hour", "material_eur_per_case", "admin_minutes_per_case", "admin_wage_eur_per_hour"]) {
        if (p[f] === null || p[f] === undefined) continue;
        p.sources.push(assumption(f, "Standardwert der Adressatengruppe, für diese Pflicht angenommen", "Default of the addressee group, assumed for this duty", { basis: basis(f) }));
      }
      p.sources.push(assumption("admin_level", "Abruf durch eine Bundesbehörde angenommen", "Retrieval by a federal authority assumed"));
    }
    for (const [k, v] of s.edits) {
      const [dutyId, field] = k.split("|");
      if (dutyId !== duty.id) continue;
      p[field] = v.value;
      p.sources = (p.sources || []).filter((x) => x.field !== field).concat([assumption(field, "In dieser Sitzung geändert", "Changed in this session", { edited: true, previous: v.previous })]);
    }
    return { params: p, warning };
  }

  s.paramsFor = (dutyId) => {
    const duty = s.duties.get(dutyId);
    if (!duty) return null;
    if (!s.params.has(dutyId)) {
      const { params, warning } = buildParams(duty);
      s.params.set(dutyId, params);
      if (warning && !duty.warnings?.includes(warning)) duty.warnings = [...(duty.warnings || []), warning];
    }
    return s.params.get(dutyId);
  };

  // ---- facts ----------------------------------------------------------------------------------------------
  const register = (key, value, unit, label, producedBy, inputs) => facts.register({ key, value, unit, label, produced_by: producedBy, inputs }).id;

  /** Prices a duty or cluster; returns { measure: fact id }. */
  s.estimate = (targetId) => {
    const t = resolveTarget(targetId);
    if (!t) return null;
    const out = {};
    const key = (m) => `cost_estimate|${targetId}|${m}`;
    if (t.kind === "duty") {
      const p = s.paramsFor(targetId);
      const c = dutyCost(p);
      const inputs = paramInputs(targetId, p);
      const lab = (code) => ({ code: `fact.duty.${code}`, params: { target: targetId } });
      out.fallzahl = register(key("fallzahl"), c.fallzahl, "COUNT", lab("fallzahl"), "cost_estimate", inputs);
      if (c.trigger === "einmalig") out.one_off_eur = register(key("one_off_eur"), c.one_off_eur, "EUR", lab("one_off"), "cost_estimate", inputs);
      else out.ea_annual_eur = register(key("ea_annual_eur"), c.ea_annual_eur, "EUR_PER_YEAR", lab("ea_annual"), "cost_estimate", inputs);
      if (p.addressee === "buerger") out.hours = register(key("hours"), c.hours_per_year, "HOURS_PER_YEAR", lab("hours"), "cost_estimate", inputs);
      if (isInformationObligation(t.duty.type, p.addressee) && c.trigger !== "einmalig") out.buerokratiekosten_eur = register(key("buerokratiekosten_eur"), c.ea_annual_eur, "EUR_PER_YEAR", lab("buerokratiekosten"), "cost_estimate", inputs);
    } else {
      const costs = t.members.map((m) => dutyCost(m.params));
      const inputs = t.members.flatMap((m) => paramInputs(m.duty.id, m.params));
      const lab = (code) => ({ code: `fact.cluster.${code}`, params: { target: targetId } });
      out.fallzahl = register(key("fallzahl"), costs.reduce((a, c) => a + c.fallzahl, 0), "COUNT", lab("fallzahl"), "cost_estimate", inputs);
      out.ea_annual_eur = register(key("ea_annual_eur"), costs.reduce((a, c) => a + c.ea_annual_eur, 0), "EUR_PER_YEAR", lab("ea_annual"), "cost_estimate", inputs);
    }
    s.estimates.set(targetId, out);
    notify({ type: "estimate", id: targetId });
    return out;
  };

  // ---- options ------------------------------------------------------------------------------------------------
  function resolveTarget(id) {
    if (s.duties.has(id)) {
      const duty = s.duties.get(id);
      return { kind: "duty", id, duty, params: duty.status === "confirmed" ? s.paramsFor(id) : null };
    }
    if (s.clusters.has(id)) {
      const cluster = s.clusters.get(id);
      return { kind: "cluster", id, cluster, members: cluster.duty_ids.map((d) => ({ duty: s.duties.get(d), params: s.paramsFor(d) })) };
    }
    return null;
  }
  s.resolveTarget = resolveTarget;

  /** Applies the option rules to a target and registers every option figure as a fact. */
  s.draftOptions = (targetId) => {
    const t = resolveTarget(targetId);
    if (!t) return { ok: false, error: { code: "unknown_target", params: { target: targetId } } };
    const res = t.kind === "duty"
      ? draftOptions({ kind: "duty", duty: t.duty, params: t.params }, { registers: data.registers, consumers: data.consumers, oneOff: data.oneOff })
      : draftOptions({ kind: "cluster", cluster: t.cluster, members: t.members }, { registers: data.registers, consumers: data.consumers, oneOff: data.oneOff });
    if (!res.ok) return res;
    const prev = s.targets.get(targetId);
    const nowIds = new Set(res.options.map((o) => o.id));
    // Options that no longer apply (after an assumption edit) are withdrawn; their facts retire.
    for (const id of prev?.option_ids || []) {
      if (nowIds.has(id)) continue;
      const old = s.options.get(id);
      if (!old) continue;
      old.status_before_withdrawal = old.status;
      old.status = "withdrawn";
      for (const k of old.fact_keys || []) facts.retire(k);
    }
    for (const o of res.options) {
      const factIds = {};
      for (const spec of o.facts) factIds[spec.key.split("|").pop()] = register(spec.key, spec.value, spec.unit, spec.label, spec.produced_by, spec.inputs);
      // Measures an earlier version had and this one lacks no longer apply.
      const old = s.options.get(o.id);
      const keys = o.facts.map((f) => f.key);
      for (const k of old?.fact_keys || []) if (!keys.includes(k)) facts.retire(k);
      const merged = {
        ...o,
        facts: factIds,
        fact_ids: Object.values(factIds),
        fact_keys: keys,
        status: old && old.status !== "withdrawn" ? old.status : o.status,
        draft: old?.draft || null,
        draft_text: old?.draft?.wording || null,
        audit: old?.audit || { failures: 0, passed: o.type === "keep" ? true : false, flag: null, last: null },
        target_decided: old?.target_decided || false
      };
      if (old?.status === "withdrawn") merged.status = old.status_before_withdrawal === "approved" ? "approved" : o.status;
      s.options.set(o.id, merged);
    }
    s.targets.set(targetId, { kind: t.kind, option_ids: res.options.map((o) => o.id), ineligible: res.ineligible, decided: prev?.decided || null });
    notify({ type: "options", target: targetId });
    return { ok: true, options: res.options.map((o) => s.options.get(o.id)), ineligible: res.ineligible };
  };

  s.setDraft = (optionId, { wording, gist_en }) => {
    const o = s.options.get(optionId);
    o.draft = { wording, gist_en: gist_en ?? null, attempt: (o.draft?.attempt || 0) + 1 };
    o.draft_text = wording;
    if (o.status === "needs_info") o.status = "draft";
    o.audit = { ...(o.audit || {}), passed: false, last: null };
    notify({ type: "option", id: optionId });
    return o.draft;
  };

  /** The auditor's view of this run: known facts, paragraphs, duties, clusters, complaints, dates. */
  s.auditContext = () => ({
    lang: s.lang,
    facts: { has: (id) => facts.has(id) || Boolean(facts.keyOf(id)) },
    paragraphs: data.paragraphs,
    duties: { has: (id) => s.duties.has(id) || s.candidates.has(id), get: (id) => s.duties.get(id) || s.candidates.get(id) },
    clusters: s.clusters,
    complaints: data.complaintsById,
    dates: new Set([data.retrievedDate].filter(Boolean))
  });
  s.audit = (text) => auditText(text, s.auditContext());

  /** Audits an option's draft; a pass makes it proposed, a third failure needs_info ("manual editing"). */
  s.auditOption = (optionId) => {
    const o = s.options.get(optionId);
    const texts = [o.draft?.wording, s.lang === "en" ? o.draft?.gist_en : null].filter((x) => typeof x === "string");
    const results = texts.map((x) => auditText(x, { ...s.auditContext(), lang: x === o.draft?.wording ? "de" : "en" }));
    const violations = results.flatMap((r) => r.violations);
    const pass = Boolean(o.draft) && violations.length === 0;
    if (pass) {
      o.audit = { ...o.audit, passed: true, last: "pass" };
      if (o.status === "draft") o.status = "proposed";
    } else {
      s.auditFailures += 1;
      o.audit = { ...o.audit, passed: false, failures: (o.audit?.failures || 0) + 1, last: "fail" };
      if (o.audit.failures >= MAX_AUDIT_FAILURES) { o.status = "needs_info"; o.audit.flag = "manual"; }
    }
    notify({ type: "option", id: optionId });
    return { pass, violations, failures: o.audit.failures || 0 };
  };

  s.openOption = (optionId) => {
    const o = s.options.get(optionId);
    if (o?.status === "proposed") { o.status = "under_review"; notify({ type: "option", id: optionId }); }
  };

  // ---- decisions --------------------------------------------------------------------------------------------------
  const targetOf = (o) => o.target.id;
  const isDecided = (targetId) => Boolean(s.targets.get(targetId)?.decided);
  const markDecided = (targetId, byOption) => {
    const t = s.targets.get(targetId) || { kind: s.clusters.has(targetId) ? "cluster" : "duty", option_ids: [], ineligible: [], decided: null };
    if (!t.decided) t.decided = byOption;
    s.targets.set(targetId, t);
    for (const id of t.option_ids) { const o = s.options.get(id); if (o && id !== byOption) o.target_decided = true; }
  };

  /** Validates and records a reviewer's decision; returns the Decision. Throws DecisionError. */
  s.decide = ({ option_id, decision, reason_code, comment = "" }) => {
    const o = s.options.get(option_id);
    if (!o) throw new DecisionError("unknown_option", { option_id });
    if (!["approved", "rejected", "needs_info"].includes(decision)) throw new DecisionError("unknown_decision", { decision });
    if (isDecided(targetOf(o)) || o.target_decided) throw new DecisionError("target_decided", { target: targetOf(o) });
    if (!["proposed", "under_review"].includes(o.status)) throw new DecisionError("not_open", { option_id, status: o.status });
    const allowed = decision === "approved" ? (o.type === "keep" ? REASONS.keep : REASONS.approved) : REASONS[decision];
    if (!reason_code) throw new DecisionError("reason_required", {});
    if (!allowed.includes(reason_code)) throw new DecisionError("reason_not_allowed", { reason_code, allowed: allowed.join(", ") });
    const text = String(comment || "").trim();
    if (COMMENT_REQUIRED.includes(reason_code) && !text) throw new DecisionError("comment_required", { reason_code });
    if (text.length > COMMENT_MAX) throw new DecisionError("comment_too_long", { max: COMMENT_MAX });

    decisionSeq += 1;
    const d = { id: `DEC-${String(decisionSeq).padStart(4, "0")}`, option_id, decision, reason_code, comment: text, decided_at: now().toISOString(), reviewer_role: REVIEWER_ROLE, target: targetOf(o) };
    s.decisions.push(d);
    o.status = decision;
    o.decision_id = d.id;
    if (decision === "approved") applyApproval(o, d);
    emit("decision_recorded", { decision: d });
    if (decision === "approved") emit("dossier_updated", { items: s.dossier.items.map((x) => x.option_id), kept: s.dossier.kept.map((x) => x.duty_id) });
    notify({ type: "decision", id: d.id });
    return d;
  };

  function applyApproval(o, d) {
    const targetId = targetOf(o);
    markDecided(targetId, o.id);
    const members = o.target.kind === "cluster" ? s.clusters.get(targetId)?.duty_ids || [] : [targetId];
    if (o.type === "keep") {
      for (const id of members) {
        const duty = s.duties.get(id);
        s.dossier.kept.push({
          duty_id: id, option_id: o.id, decision_id: d.id, reason_code: d.reason_code, comment: d.comment,
          data_uses: data.consumers.filter((c) => c.duty_id === id),
          eu_basis: data.norms.get(duty?.norm_id)?.eu_basis || [], protected_standard: duty?.protected_standard || null
        });
        if (o.target.kind === "cluster") markDecided(id, o.id);
      }
    } else {
      s.dossier.items.push({ option_id: o.id, target: targetId, type: o.type, decision_id: d.id, reason_code: d.reason_code, comment: d.comment, fact_ids: { ...o.facts }, removed_duty_ids: [...(o.removed_duty_ids || [])], wording: o.draft?.wording || null, gist_en: o.draft?.gist_en || null, paragraph_ids: paragraphsOf(targetId) });
      // A cluster option decides the members it changes; a duty option decides its clusters.
      if (o.target.kind === "cluster") for (const id of o.removed_duty_ids || []) markDecided(id, o.id);
    }
    if (o.target.kind === "duty") for (const c of s.clusters.values()) if (c.duty_ids.includes(targetId) && c.status !== "split") markDecided(c.id, o.id);
  }

  const paragraphsOf = (targetId) => (s.clusters.has(targetId) ? s.clusters.get(targetId).paragraph_ids : [s.duties.get(targetId)?.paragraph_id].filter(Boolean));

  /** Resolves when one of the given options receives a decision recorded after this call. */
  s.waitForDecision = (optionIds, signal) => {
    const before = s.decisions.length;
    return waitFor(() => s.decisions.slice(before).find((d) => optionIds.includes(d.option_id)) || null, signal);
  };
  /** Resolves when the cluster has been confirmed or split. */
  s.waitForReview = (clusterId, signal) => waitFor(() => {
    const c = s.clusters.get(clusterId);
    if (!c || c.status === "candidate") return null;
    return { cluster_id: clusterId, action: c.status === "split" ? "split" : "confirmed", parts: [...s.clusters.values()].filter((x) => x.id.startsWith(`${clusterId}-`)).map((x) => x.id) };
  }, signal);

  function waitFor(test, signal) {
    const now0 = test();
    if (now0) return Promise.resolve(now0);
    return new Promise((resolve, reject) => {
      const w = () => {
        const v = test();
        if (v) { waiters.delete(w); resolve(v); }
      };
      waiters.add(w);
      signal?.addEventListener("abort", () => { waiters.delete(w); reject(Object.assign(new Error("Aborted"), { name: "AbortError" })); }, { once: true });
    });
  }

  // ---- assumption edits ------------------------------------------------------------------------------------------
  /** Changes one parameter of a duty; recomputes its estimates and the options of its targets. */
  s.editParam = (dutyId, field, value) => {
    if (!s.duties.has(dutyId) || !PARAM_FIELDS.includes(field)) return null;
    const before = s.paramsFor(dutyId);
    const previous = before[field];
    s.edits.set(`${dutyId}|${field}`, { value, previous });
    s.params.delete(dutyId);
    const affected = [dutyId, ...[...s.clusters.values()].filter((c) => c.duty_ids.includes(dutyId) && c.status !== "split").map((c) => c.id)];
    const live = new Set(facts.all().filter((f) => !f.retired).map((f) => f.id));
    const valuesBefore = new Map(facts.all().map((f) => [f.id, f.value]));
    for (const t of affected) {
      if (s.estimates.has(t)) s.estimate(t);
      if (s.targets.has(t)) s.draftOptions(t);
    }
    const after = facts.all();
    const retired = after.filter((f) => f.retired && live.has(f.id)).map((f) => f.id);
    const changed = after.filter((f) => !f.retired && valuesBefore.has(f.id) && valuesBefore.get(f.id) !== f.value).map((f) => f.id);
    const change = { event: "parameter_changed", duty_id: dutyId, field, previous, value, changed, retired };
    emit("parameter_changed", change);
    notify({ type: "parameter_changed", duty_id: dutyId });
    return change;
  };

  // ---- KPIs --------------------------------------------------------------------------------------------------------
  /** The headline figures, from the decisions taken; registered as facts on fixed ids. */
  s.kpis = () => {
    const confirmed = s.confirmedDuties();
    const byType = {};
    for (const d of confirmed) byType[d.type] = (byType[d.type] || 0) + 1;
    const approved = s.decisions.filter((d) => d.decision === "approved").map((d) => s.options.get(d.option_id)).filter(Boolean);
    const removed = new Set(approved.flatMap((o) => o.removed_duty_ids || []));
    const count = (type) => confirmed.filter((d) => d.type === type && removed.has(d.id)).length;
    const cov = sliceCoverage({ reporting_total: byType.MELDEPFLICHT || 0, reporting_removed: count("MELDEPFLICHT"), documentation_total: byType.DOKUMENTATIONSPFLICHT || 0, documentation_removed: count("DOKUMENTATIONSPFLICHT") });
    const eaAddressed = approved.reduce((sum, o) => sum + (o.delta_ea_eur || 0), 0);
    let pending = 0;
    for (const [id, t] of s.targets) {
      if (t.decided) continue;
      const open = t.option_ids.map((x) => s.options.get(x)).filter((o) => o && o.type !== "keep" && ["proposed", "under_review"].includes(o.status));
      if (open.length) pending += Math.min(...open.map((o) => o.delta_ea_eur));
      void id;
    }
    const k = {
      duties_confirmed: confirmed.length,
      by_type: byType,
      coverage: {
        reporting: { share: cov.reporting_share, attainment: cov.reporting_target_attainment, removed: count("MELDEPFLICHT"), total: byType.MELDEPFLICHT || 0 },
        documentation: { share: cov.documentation_share, attainment: cov.documentation_target_attainment, removed: count("DOKUMENTATIONSPFLICHT"), total: byType.DOKUMENTATIONSPFLICHT || 0 }
      },
      ea_addressed_eur: eaAddressed,
      ea_pending_eur: pending,
      clusters_found: [...s.clusters.values()].filter((c) => c.status !== "split").length
    };
    const values = { duties_confirmed: k.duties_confirmed, reporting_share: cov.reporting_share, reporting_attainment: cov.reporting_target_attainment, documentation_share: cov.documentation_share, documentation_attainment: cov.documentation_target_attainment, ea_addressed: eaAddressed, ea_pending: pending, clusters_found: k.clusters_found };
    k.fact_ids = {};
    for (const [m, [id, unit]] of Object.entries(KPI_FACTS)) {
      const inputs = m.startsWith("ea") || m.includes("share") || m.includes("attainment") ? approved.map((o) => o.id) : [];
      facts.register({ key: `kpi|${runId}|${m}`, value: values[m], unit, label: { code: `fact.kpi.${m}` }, produced_by: "kpi", inputs });
      k.fact_ids[m] = id;
    }
    return k;
  };

  // ---- report, signals, listeners -------------------------------------------------------------------------------------
  s.setReport = (report) => { s.report = report; notify({ type: "report" }); };
  s.setSignals = (dutyId, ids) => { s.signals.set(dutyId, ids); notify({ type: "signals", id: dutyId }); };
  s.setEmitter = (fn) => { emitter = fn; };
  s.onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  s.paragraphsOf = paragraphsOf;
  s.sortedClusters = () => [...s.clusters.values()].sort((a, b) => cmp(a.id, b.id));
  return s;
}
