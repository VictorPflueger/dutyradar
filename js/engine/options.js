// Option rules: which relief options a duty or a cluster may get, with their figures (pure).
//
// Engines return codes, never text: ineligibility reasons, risks and notes are codes that the
// interface renders through i18n (reason.*, risk.*, note.*), and every figure comes with a fact
// specification (key, unit, label code, inputs) for the fact registry.
//
// Duty target: register_retrieval when a register covers every data item; merge never;
// lower_frequency when periodic, at least four submissions a year and no protected standard (the
// largest step below the current frequency on the ladder 250, 52, 12, 4, 1; an EU-related duty gets
// the risk eu_frequency_check); delete when not EU-related, no protected standard and no known data
// use (with the note assumption_no_known_user); keep always.
// Cluster target: refused when split, or unconfirmed with confidence below 0.5; register_retrieval
// when the register covers every item of at least one member, replacing each member it covers fully;
// merge when the members share population, wage rate and frequency or cases per year; lower_frequency
// and delete never; keep always.
// Ranking: the most negative ΔEA first (for a citizen duty the change in hours first, then €), ties
// in the order register_retrieval, merge, lower_frequency, delete; keep last among equals.

import { triggerOf, deleteDelta, lowerFrequencyDelta, registerDelta, mergeDelta, canMerge } from "./cost.js";
import { bestRegister } from "./cluster.js";

export const LADDER = [250, 52, 12, 4, 1];
export const TIE_ORDER = ["register_retrieval", "merge", "lower_frequency", "delete", "keep"];
export const MIN_CLUSTER_CONFIDENCE = 0.5;
export const MIN_FREQUENCY_TO_LOWER = 4;
const EPS = 1e-6;

/** The largest step on the ladder below a frequency, or null. */
export const lowerStep = (f) => LADDER.find((x) => x < f) ?? null;

const oneOffFor = (type, oneOff) => (oneOff || []).find((o) => o.option_type === type)?.eur ?? 0;
const PARAM_FIELDS = ["population_units", "frequency_per_year", "cases_per_year", "minutes_per_case", "wage_eur_per_hour", "material_eur_per_case"];
const ADMIN_FIELDS = ["admin_minutes_per_case", "admin_wage_eur_per_hour"];
const paramInputs = (dutyId, params, extra = []) => [...PARAM_FIELDS, ...extra].filter((f) => params[f] !== null && params[f] !== undefined).map((f) => `param:${dutyId}.${f}`);

/** Fact specifications for an option's figures; keys follow draft_options|<target>|<type>|<measure>. */
function factSpecs(targetId, type, o, inputs) {
  const key = (measure) => `draft_options|${targetId}|${type}|${measure}`;
  const spec = (measure, value, unit) => ({ key: key(measure), value, unit, label: { code: `fact.option.${type}.${measure}` }, produced_by: "draft_options", inputs });
  const out = [spec("net_delta", o.delta_ea_eur, "EUR_PER_YEAR")];
  for (const a of ["wirtschaft", "verwaltung", "buerger"]) if (Math.abs(o.delta_by_addressee[a]) > EPS) out.push(spec(`${a}_delta`, o.delta_by_addressee[a], "EUR_PER_YEAR"));
  if (Math.abs(o.delta_hours || 0) > EPS) out.push(spec("buerger_hours_delta", o.delta_hours, "HOURS_PER_YEAR"));
  out.push(spec("duty_count_delta", o.duty_count_delta, "COUNT"));
  if (o.one_off_eur > 0) out.push(spec("one_off", o.one_off_eur, "EUR"));
  return out;
}

function makeOption(target, type, figures, extra = {}) {
  const o = {
    id: `O-${target.id}-${type}`,
    target: { kind: target.kind, id: target.id },
    type,
    eligible: true,
    ineligible_reason: null,
    delta_ea_eur: figures.delta_ea_eur,
    delta_hours: figures.delta_hours || 0,
    delta_by_addressee: figures.delta_by_addressee,
    duty_count_delta: figures.duty_count_delta,
    removed_duty_ids: extra.removed || [],
    one_off_eur: figures.one_off_eur || 0,
    fact_ids: [],
    draft_text: null,
    risks: extra.risks || [],
    notes: extra.notes || [],
    details: extra.details || {},
    status: type === "keep" ? "proposed" : "draft"
  };
  o.facts = factSpecs(target.id, type, o, extra.inputs || []);
  return o;
}

const keepFigures = () => ({ delta_ea_eur: 0, delta_hours: 0, delta_by_addressee: { wirtschaft: 0, verwaltung: 0, buerger: 0 }, duty_count_delta: 0, one_off_eur: 0 });

function rank(options, citizen) {
  return options.sort((a, b) => {
    if (citizen && Math.abs(a.delta_hours - b.delta_hours) > EPS) return a.delta_hours - b.delta_hours;
    if (Math.abs(a.delta_ea_eur - b.delta_ea_eur) > EPS) return a.delta_ea_eur - b.delta_ea_eur;
    return TIE_ORDER.indexOf(a.type) - TIE_ORDER.indexOf(b.type);
  });
}

function dutyOptions({ duty, params }, { registers, consumers, oneOff }) {
  const target = { kind: "duty", id: duty.id };
  const options = [];
  const ineligible = [];
  const uses = (consumers || []).filter((c) => c.duty_id === duty.id);

  const reg = bestRegister({ kind: "duty", duty }, registers);
  if (reg.register_id) {
    options.push(makeOption(target, "register_retrieval", registerDelta(params, { one_off_eur: oneOffFor("register_retrieval", oneOff) }), {
      removed: [duty.id], risks: ["register_currency"], inputs: paramInputs(duty.id, params, ADMIN_FIELDS),
      details: { register_id: reg.register_id, covers_items: reg.covers_items, availability: reg.availability, admin_level: params.admin_level || "bund" }
    }));
  } else ineligible.push({ type: "register_retrieval", reason: "no_register", params: { uncovered_items: reg.uncovered_items } });

  ineligible.push({ type: "merge", reason: "no_cluster" });

  const f = Number(params.frequency_per_year);
  if (duty.protected_standard) ineligible.push({ type: "lower_frequency", reason: "protected_standard", params: { standard: duty.protected_standard } });
  else if (triggerOf(params) !== "periodisch") ineligible.push({ type: "lower_frequency", reason: "not_periodic" });
  else if (!(f >= MIN_FREQUENCY_TO_LOWER)) ineligible.push({ type: "lower_frequency", reason: "less_than_quarterly" });
  else {
    const step = lowerStep(f);
    options.push(makeOption(target, "lower_frequency", lowerFrequencyDelta(params, step), {
      risks: duty.eu_related ? ["eu_frequency_check"] : [], inputs: paramInputs(duty.id, params),
      details: { frequency_per_year: f, new_frequency_per_year: step }
    }));
  }

  if (duty.eu_related) ineligible.push({ type: "delete", reason: "eu_related" });
  else if (duty.protected_standard) ineligible.push({ type: "delete", reason: "protected_standard", params: { standard: duty.protected_standard } });
  else if (uses.length) ineligible.push({ type: "delete", reason: "data_use_known", params: { uses: uses.length } });
  else options.push(makeOption(target, "delete", deleteDelta(params), { removed: [duty.id], notes: ["assumption_no_known_user"], inputs: paramInputs(duty.id, params) }));

  options.push(makeOption(target, "keep", keepFigures(), { details: { justification_basis: { data_uses: uses, eu_related: Boolean(duty.eu_related), protected_standard: duty.protected_standard || null } } }));
  return { ok: true, options: rank(options, params.addressee === "buerger"), ineligible };
}

function clusterOptions({ cluster, members }, { registers, consumers, oneOff }) {
  if (cluster.status === "split") return { ok: false, error: { code: "cluster_split", params: { cluster_id: cluster.id } } };
  if (cluster.status !== "confirmed" && !((cluster.confidence ?? 0) >= MIN_CLUSTER_CONFIDENCE)) return { ok: false, error: { code: "cluster_review_needed", params: { cluster_id: cluster.id } } };
  const target = { kind: "cluster", id: cluster.id };
  const options = [];
  const ineligible = [];

  const reg = bestRegister({ kind: "cluster", members: members.map((m) => m.duty) }, registers);
  if (reg.register_id) {
    const covered = members.filter((m) => reg.covers_duty_ids.includes(m.duty.id));
    const sum = { delta_ea_eur: 0, delta_hours: 0, delta_by_addressee: { wirtschaft: 0, verwaltung: 0, buerger: 0 }, duty_count_delta: 0, one_off_eur: oneOffFor("register_retrieval", oneOff) };
    for (const m of covered) {
      const d = registerDelta(m.params);
      sum.delta_ea_eur += d.delta_ea_eur;
      sum.delta_hours += d.delta_hours;
      for (const a of Object.keys(sum.delta_by_addressee)) sum.delta_by_addressee[a] += d.delta_by_addressee[a];
      sum.duty_count_delta += d.duty_count_delta;
    }
    options.push(makeOption(target, "register_retrieval", sum, {
      removed: covered.map((m) => m.duty.id), risks: ["register_currency"],
      inputs: covered.flatMap((m) => paramInputs(m.duty.id, m.params, ADMIN_FIELDS)),
      details: { register_id: reg.register_id, covers_items: reg.covers_items, covers_duty_ids: reg.covers_duty_ids, availability: reg.availability }
    }));
  } else ineligible.push({ type: "register_retrieval", reason: "no_register", params: { uncovered_items: reg.uncovered_items } });

  const mergeMembers = members.map((m) => ({ duty_id: m.duty.id, params: m.params, population_id: m.duty.population_id, items: m.duty.data_items, overlap_share_with_lead: m.overlap_share_with_lead }));
  if (canMerge(mergeMembers)) {
    const d = mergeDelta(mergeMembers);
    options.push(makeOption(target, "merge", d, {
      removed: d.removed_duty_ids, inputs: members.flatMap((m) => paramInputs(m.duty.id, m.params)),
      details: { lead: d.lead, merged_minutes: d.merged_minutes, merged_material_eur_per_case: d.merged_material_eur_per_case }
    }));
  } else ineligible.push({ type: "merge", reason: "members_differ" });

  ineligible.push({ type: "lower_frequency", reason: "single_duties_only" });
  ineligible.push({ type: "delete", reason: "single_duties_only" });

  const uses = (consumers || []).filter((c) => cluster.duty_ids.includes(c.duty_id));
  options.push(makeOption(target, "keep", keepFigures(), { details: { justification_basis: { data_uses: uses, eu_related: members.some((m) => m.duty.eu_related), protected_standard: members.map((m) => m.duty.protected_standard).find(Boolean) || null } } }));
  return { ok: true, options: rank(options, members[0]?.params.addressee === "buerger"), ineligible };
}

/**
 * The eligible options plus keep for a target, ranked, and one reason code for each ineligible type.
 * target: { kind: "duty", duty, params } or { kind: "cluster", cluster, members: [{ duty, params }] }.
 * ctx: { registers, consumers, oneOff }. A refused cluster returns { ok: false, error: { code, params } }.
 */
export function draftOptions(target, ctx = {}) {
  const c = { registers: ctx.registers || [], consumers: ctx.consumers || [], oneOff: ctx.oneOff || [] };
  return target.kind === "cluster" ? clusterOptions(target, c) : dutyOptions(target, c);
}
