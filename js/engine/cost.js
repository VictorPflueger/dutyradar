// Cost engine: Erfüllungsaufwand (compliance cost) by the federal guide's basic scheme (pure).
//
// Symbols as in the specification: u affected units, f frequency per year, c cases per year,
// m minutes per case, w wage rate in € per hour, s material cost in € per case, m_adm and w_adm the
// administration's minutes and wage rate for a register retrieval, o_j the share of member j's data
// items already contained in the lead duty.
//
//   F = u·f (periodic), F = c (event-driven)       EA = F·(m/60·w + s)   (businesses, administration)
//   H = F·m/60, S = F·s                            (citizens: hours and material cost)
//   ΔEA delete = −EA, Δn = −1                      ΔEA lower = EA(f′) − EA(f), Δn = 0
//   ΔEA register = −EA_addressee + F·m_adm/60·w_adm, Δn = −1
//   m* = m_lead + Σ_{j≠lead} m_j(1 − o_j), s* = max_j s_j
//   ΔEA merge = F·(m*/60·w + s*) − Σ_j EA_j, Δn = −(N − 1)
//
// Every value stays at full precision; only js/engine/format.js rounds, and only for display.

export const ADDRESSEES = ["buerger", "wirtschaft", "verwaltung"];
export const INFORMATION_OBLIGATIONS = ["MELDEPFLICHT", "NACHWEISPFLICHT", "INFORMATIONSPFLICHT", "DOKUMENTATIONSPFLICHT"];
/** PflichtenLichten benchmarks: reporting duties −⅓, documentation duties −½. */
export const BENCHMARKS = { MELDEPFLICHT: 1 / 3, DOKUMENTATIONSPFLICHT: 1 / 2 };

const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const zeroByAddressee = () => ({ wirtschaft: 0, verwaltung: 0, buerger: 0 });

/** The trigger of a parameter set: stated, or event-driven when only a case number is given. */
export function triggerOf(p) {
  if (p.trigger) return p.trigger;
  return p.cases_per_year !== null && p.cases_per_year !== undefined && (p.frequency_per_year === null || p.frequency_per_year === undefined) ? "anlassbezogen" : "periodisch";
}

/** Fallzahl (case number): u·f for periodic duties, c for event-driven ones, u for one-off duties. */
export function fallzahl(p) {
  const t = triggerOf(p);
  if (t === "anlassbezogen") return num(p.cases_per_year);
  if (t === "einmalig") return num(p.population_units);
  return num(p.population_units) * num(p.frequency_per_year);
}

/**
 * Annual compliance cost of one duty. Citizens count hours and material cost; their € figure is the
 * material cost alone. A one-off duty has no annual cost; its cost is reported as one-off cost.
 */
export function dutyCost(p) {
  const trigger = triggerOf(p);
  const F = fallzahl(p);
  const citizen = p.addressee === "buerger";
  const hours = (F * num(p.minutes_per_case)) / 60;
  const personnel = citizen ? 0 : hours * num(p.wage_eur_per_hour);
  const material = F * num(p.material_eur_per_case);
  if (trigger === "einmalig") {
    return { trigger, fallzahl: F, hours_per_year: 0, personnel_eur: 0, material_eur: 0, ea_annual_eur: 0, one_off_eur: personnel + material, one_off_hours: citizen ? hours : 0 };
  }
  return { trigger, fallzahl: F, hours_per_year: hours, personnel_eur: personnel, material_eur: material, ea_annual_eur: personnel + material, one_off_eur: 0, one_off_hours: 0 };
}

/** ΔEA of deleting a duty. */
export function deleteDelta(p) {
  const c = dutyCost(p);
  const by = zeroByAddressee();
  by[p.addressee || "wirtschaft"] = -c.ea_annual_eur;
  return { delta_ea_eur: -c.ea_annual_eur, delta_hours: p.addressee === "buerger" ? -c.hours_per_year : 0, delta_by_addressee: by, duty_count_delta: -1, one_off_eur: 0 };
}

/** ΔEA of lowering a periodic duty's frequency from f to f′. */
export function lowerFrequencyDelta(p, newFrequency) {
  const before = dutyCost(p);
  const after = dutyCost({ ...p, trigger: "periodisch", frequency_per_year: newFrequency });
  const by = zeroByAddressee();
  by[p.addressee || "wirtschaft"] = after.ea_annual_eur - before.ea_annual_eur;
  return {
    ea_before_eur: before.ea_annual_eur,
    ea_after_eur: after.ea_annual_eur,
    delta_ea_eur: after.ea_annual_eur - before.ea_annual_eur,
    delta_hours: p.addressee === "buerger" ? after.hours_per_year - before.hours_per_year : 0,
    delta_by_addressee: by,
    duty_count_delta: 0,
    new_frequency_per_year: newFrequency,
    one_off_eur: 0
  };
}

/**
 * ΔEA of replacing a duty by a register retrieval: the duty's addressee is relieved of its own cost
 * (a citizen of hours and material cost), and the administration level in admin_level bears the
 * retrieval, F·m_adm/60·w_adm. The one-off cost of connecting the register is reported apart.
 */
export function registerDelta(p, { one_off_eur = 0 } = {}) {
  const c = dutyCost(p);
  const admin = (c.fallzahl * num(p.admin_minutes_per_case) * num(p.admin_wage_eur_per_hour)) / 60;
  const by = zeroByAddressee();
  by[p.addressee || "wirtschaft"] += -c.ea_annual_eur;
  by.verwaltung += admin;
  const level = p.admin_level || "bund";
  return {
    delta_ea_eur: -c.ea_annual_eur + admin,
    delta_hours: p.addressee === "buerger" ? -c.hours_per_year : 0,
    admin_annual_eur: admin,
    admin_level: level,
    admin_by_level: { bund: level === "bund" ? admin : 0, laender: level === "laender" ? admin : 0 },
    delta_by_addressee: by,
    duty_count_delta: -1,
    one_off_eur: num(one_off_eur)
  };
}

const isOther = (item) => String(item).startsWith("other:");

/** Share of a member's data items that the lead already asks for (other: items never count). */
export function shareContained(memberItems = [], leadItems = []) {
  if (!memberItems.length) return 0;
  const lead = new Set(leadItems.filter((i) => !isOther(i)));
  return memberItems.filter((i) => !isOther(i) && lead.has(i)).length / memberItems.length;
}

/** The merge lead: the member with the most minutes per case, ties by duty id. */
export function mergeLead(members) {
  return [...members].sort((a, b) => num(b.params.minutes_per_case) - num(a.params.minutes_per_case) || (a.duty_id < b.duty_id ? -1 : a.duty_id > b.duty_id ? 1 : 0))[0];
}

/**
 * Whether members can merge: they share population and wage rate, and either the same periodic
 * frequency or, for event-driven duties, the same cases per year.
 */
export function canMerge(members) {
  if (members.length < 2) return false;
  const p0 = members[0].params;
  const same = (k) => members.every((m) => num(m.params[k]) === num(p0[k]));
  const samePopulation = members.every((m) => (m.population_id ?? p0.population_id ?? null) === (members[0].population_id ?? p0.population_id ?? null)) && same("population_units");
  const sameAddressee = members.every((m) => m.params.addressee === p0.addressee);
  const triggers = new Set(members.map((m) => triggerOf(m.params)));
  if (triggers.size !== 1 || triggers.has("einmalig")) return false;
  const sameRate = triggers.has("periodisch") ? same("frequency_per_year") : same("cases_per_year");
  return sameAddressee && samePopulation && same("wage_eur_per_hour") && sameRate;
}

/**
 * ΔEA of merging N duties into the lead. members: [{ duty_id, params, overlap_share_with_lead?,
 * items? }]; o_j comes from overlap_share_with_lead or, without it, from the members' data items.
 */
export function mergeDelta(members) {
  const lead = mergeLead(members);
  const others = members.filter((m) => m !== lead);
  const shareOf = (m) => (m.overlap_share_with_lead !== undefined && m.overlap_share_with_lead !== null ? num(m.overlap_share_with_lead) : shareContained(m.items, lead.items));
  const mStar = num(lead.params.minutes_per_case) + others.reduce((sum, m) => sum + num(m.params.minutes_per_case) * (1 - shareOf(m)), 0);
  const sStar = Math.max(...members.map((m) => num(m.params.material_eur_per_case)));
  const merged = dutyCost({ ...lead.params, minutes_per_case: mStar, material_eur_per_case: sStar });
  const before = members.map((m) => dutyCost(m.params));
  const sumBefore = before.reduce((s, c) => s + c.ea_annual_eur, 0);
  const hoursBefore = before.reduce((s, c) => s + c.hours_per_year, 0);
  const citizen = lead.params.addressee === "buerger";
  const by = zeroByAddressee();
  by[lead.params.addressee || "wirtschaft"] = merged.ea_annual_eur - sumBefore;
  return {
    lead: lead.duty_id,
    merged_minutes: mStar,
    merged_material_eur_per_case: sStar,
    ea_merged_eur: merged.ea_annual_eur,
    sum_before_eur: sumBefore,
    delta_ea_eur: merged.ea_annual_eur - sumBefore,
    delta_hours: citizen ? merged.hours_per_year - hoursBefore : 0,
    delta_by_addressee: by,
    duty_count_delta: -(members.length - 1),
    removed_duty_ids: others.map((m) => m.duty_id),
    one_off_eur: 0
  };
}

/** Whether a duty's cost counts as Bürokratiekosten (businesses' information obligations). */
export const isInformationObligation = (type, addressee) => addressee === "wirtschaft" && INFORMATION_OBLIGATIONS.includes(type);

/** Bürokratiekosten: the businesses' compliance cost from the four information-obligation types. */
export function bureaucracyCost(entries) {
  return entries.reduce((sum, e) => sum + (isInformationObligation(e.type, e.addressee) ? num(e.ea_annual_eur) : 0), 0);
}

/**
 * Slice coverage: removed reporting duties over all reporting duties of the slice, and the same for
 * documentation; the gauges read each share against its benchmark (share ÷ ⅓, share ÷ ½).
 */
export function sliceCoverage({ reporting_total, reporting_removed, documentation_total, documentation_removed }) {
  const share = (removed, total) => (num(total) > 0 ? num(removed) / num(total) : 0);
  const reporting = share(reporting_removed, reporting_total);
  const documentation = share(documentation_removed, documentation_total);
  return {
    reporting_share: reporting,
    reporting_target_attainment: reporting / BENCHMARKS.MELDEPFLICHT,
    documentation_share: documentation,
    documentation_target_attainment: documentation / BENCHMARKS.DOKUMENTATIONSPFLICHT
  };
}

/**
 * Duties removed by approved options, counted by duty type: a delete removes its duty, a register
 * retrieval every duty it replaces, a merge N − 1, lower frequency and keep none. A duty counts once.
 */
export function removedByType(approvedOptions, dutiesById) {
  const removed = new Set();
  for (const o of approvedOptions) for (const id of o.removed_duty_ids || []) removed.add(id);
  const counts = {};
  for (const id of removed) {
    const type = dutiesById[id]?.type;
    if (type) counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}
