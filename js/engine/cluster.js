// Clustering: duties that ask the same addressees for overlapping data (pure).
//
// Rules of the specification:
// 1. Data items map to vocabulary ids by synonym; unmatched items become other:<text>, which count in
//    the union but never as shared.
// 2. Only confirmed duties with the same addressee and the same (non-null) population, from
//    different paragraphs, are compared.
// 3. Overlap = shared items ÷ items in the union.
// 4. Two duties link when overlap ≥ 0.5, or when they share a core item and overlap ≥ 0.3.
// 5. Clusters grow greedily over the links in descending overlap (ties by the two duty ids): a link
//    between two unclustered duties starts a cluster; a duty joins a cluster only if it links to every
//    member and the items shared by all members stay non-empty. A finished cluster needs duties from
//    two norms or two recipients.
// 6. Cluster overlap = items shared by all ÷ union of all; confidence = that overlap, unrounded, ×
//    the lowest member confidence, rounded to two decimals.
// 7. A split dissolves the cluster; each part that still meets rule 5 becomes C-<nnn>-a, -b, … in
//    member order.
// 8. Registers: for a duty, the register covering every item (ties by id); for a cluster, the one
//    covering most members fully, then most of the members' items, then the lowest id.

export const LINK_OVERLAP = 0.5;
export const CORE_LINK_OVERLAP = 0.3;

const isOther = (item) => String(item).startsWith("other:");
const round2 = (x) => Math.round(x * 100) / 100;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const norm = (s) => String(s).toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();

/** Maps free-text data items to vocabulary ids by id, label or synonym; others become other:<text>. */
export function mapItems(rawItems, vocabulary) {
  const index = new Map();
  for (const item of vocabulary?.items || []) {
    for (const name of [item.id, item.label, ...(item.synonyms || [])]) index.set(norm(name), item.id);
  }
  const out = [];
  for (const raw of rawItems || []) {
    const s = String(raw);
    const id = s.startsWith("other:") ? null : index.get(norm(s));
    const mapped = id || (s.startsWith("other:") ? s : `other:${s}`);
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out;
}

const confidenceOf = (d) => d.confidence ?? d.classification?.confidence ?? 0;

/** Shared items (never other:), union and overlap of two item lists. */
export function overlapOf(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  const union = new Set([...A, ...B]);
  const shared = [...A].filter((i) => B.has(i) && !isOther(i)).sort(cmp);
  return { shared, union: union.size, overlap: union.size ? shared.length / union.size : 0 };
}

/** Rule 2: whether two duties may be compared at all. */
export function comparable(a, b) {
  return a.status === "confirmed" && b.status === "confirmed" && a.addressee === b.addressee && a.population_id != null && a.population_id === b.population_id && a.paragraph_id !== b.paragraph_id;
}

/** Rule 4. */
function linked(o, core) {
  return o.overlap >= LINK_OVERLAP || (o.overlap >= CORE_LINK_OVERLAP && o.shared.some((i) => core.has(i)));
}

/** All links between comparable duties, in descending overlap, ties by the two duty ids. */
export function linkDuties(duties, { core = new Set() } = {}) {
  const sorted = [...duties].sort((x, y) => cmp(x.id, y.id));
  const links = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (!comparable(a, b)) continue;
      const o = overlapOf(a.data_items || [], b.data_items || []);
      if (linked(o, core)) links.push({ a: a.id, b: b.id, overlap: o.overlap, shared: o.shared });
    }
  }
  return links.sort((x, y) => y.overlap - x.overlap || cmp(x.a, y.a) || cmp(x.b, y.b));
}

/** Items shared by all members, union of all, overlap and confidence (rule 6). */
export function clusterMeasures(members) {
  const sets = members.map((m) => new Set(m.data_items || []));
  const union = new Set(sets.flatMap((s) => [...s]));
  const shared = [...sets[0]].filter((i) => !isOther(i) && sets.every((s) => s.has(i))).sort(cmp);
  const overlap = union.size ? shared.length / union.size : 0;
  const lowest = Math.min(...members.map(confidenceOf));
  return { shared_items: shared, union_items: [...union].sort(cmp), overlap_raw: overlap, overlap: round2(overlap), confidence: round2(overlap * lowest) };
}

/** A finished cluster needs duties from two norms or two recipients. */
const spansTwo = (members) => new Set(members.map((m) => m.norm_id)).size >= 2 || new Set(members.map((m) => m.recipient ?? null)).size >= 2;

function makeCluster(id, members) {
  const ordered = [...members].sort((x, y) => cmp(x.id, y.id));
  return { id, duty_ids: ordered.map((m) => m.id), addressee: ordered[0].addressee, population_id: ordered[0].population_id, ...clusterMeasures(ordered), register_candidate: null, status: "candidate" };
}

/** Rules 2–6: links and clusters. Cluster ids count from `start` in the order the clusters form. */
export function clusterDuties(duties, { core = new Set(), start = 1 } = {}) {
  const byId = new Map(duties.map((d) => [d.id, d]));
  const links = linkDuties(duties, { core });
  const linkSet = new Set(links.map((l) => `${l.a}|${l.b}`));
  const isLinked = (x, y) => linkSet.has(x < y ? `${x}|${y}` : `${y}|${x}`);
  const groups = [];
  const groupOf = new Map();
  for (const l of links) {
    const ga = groupOf.get(l.a);
    const gb = groupOf.get(l.b);
    if (!ga && !gb) {
      const g = [l.a, l.b];
      groups.push(g);
      groupOf.set(l.a, g);
      groupOf.set(l.b, g);
    } else if (ga && !gb) tryJoin(ga, l.b);
    else if (!ga && gb) tryJoin(gb, l.a);
  }
  function tryJoin(group, id) {
    if (!group.every((m) => isLinked(m, id))) return;
    if (!clusterMeasures([...group, id].map((x) => byId.get(x))).shared_items.length) return;
    group.push(id);
    groupOf.set(id, group);
  }
  const clusters = [];
  let n = start;
  for (const g of groups) {
    const members = g.map((x) => byId.get(x));
    if (!spansTwo(members)) continue;
    clusters.push(makeCluster(`C-${String(n).padStart(3, "0")}`, members));
    n += 1;
  }
  return { links, clusters };
}

/** Whether a set of duties still meets rule 5 as one cluster. */
function meetsRule5(members, core) {
  if (members.length < 2 || !spansTwo(members)) return false;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      if (!comparable(a, b) || !linked(overlapOf(a.data_items || [], b.data_items || []), core)) return false;
    }
  }
  return clusterMeasures(members).shared_items.length > 0;
}

/**
 * Rule 7: splits a cluster by the members to separate. The cluster dissolves; each part that still
 * meets rule 5 becomes <id>-a, <id>-b in member order.
 */
export function splitCluster(cluster, separateIds, dutiesById, { core = new Set() } = {}) {
  const sep = new Set(separateIds);
  const members = cluster.duty_ids.map((id) => dutiesById[id] || dutiesById.get?.(id));
  const stay = members.filter((m) => !sep.has(m.id));
  const go = members.filter((m) => sep.has(m.id));
  // Parts in member order: the part that holds the first member comes first.
  const partsInOrder = sep.has(cluster.duty_ids[0]) ? [go, stay] : [stay, go];
  const parts = [];
  for (const part of partsInOrder) {
    if (!meetsRule5(part, core)) continue;
    parts.push(makeCluster(`${cluster.id}-${String.fromCharCode(97 + parts.length)}`, part));
  }
  return { dissolved: cluster.id, parts };
}

const covers = (register, items) => items.length > 0 && items.every((i) => !isOther(i) && register.items.includes(i));

/**
 * Rule 8. target: { kind: "duty", duty } or { kind: "cluster", members }. Returns { register_id,
 * covers_items, covers_duty_ids, availability } or { register_id: null, uncovered_items }.
 */
export function bestRegister(target, registers) {
  const regs = [...(registers || [])].sort((a, b) => cmp(a.id, b.id));
  if (target.kind === "duty") {
    const items = target.duty.data_items || [];
    const hit = regs.find((r) => covers(r, items));
    if (hit) return { register_id: hit.id, covers_items: [...items], covers_duty_ids: [target.duty.id], availability: hit.availability };
    return { register_id: null, uncovered_items: uncovered(items, regs) };
  }
  const members = target.members || [];
  const allItems = [...new Set(members.flatMap((m) => m.data_items || []))];
  let best = null;
  for (const r of regs) {
    const full = members.filter((m) => covers(r, m.data_items || []));
    if (!full.length) continue;
    const itemsCovered = allItems.filter((i) => r.items.includes(i)).length;
    if (!best || full.length > best.full.length || (full.length === best.full.length && itemsCovered > best.itemsCovered)) best = { r, full, itemsCovered };
  }
  if (!best) return { register_id: null, uncovered_items: uncovered(allItems, regs) };
  return {
    register_id: best.r.id,
    covers_items: allItems.filter((i) => best.r.items.includes(i)).sort(cmp),
    covers_duty_ids: best.full.map((m) => m.id).sort(cmp),
    availability: best.r.availability
  };
}

/** The items the best partly covering register leaves open (all items when none covers any). */
function uncovered(items, regs) {
  let best = null;
  for (const r of regs) {
    const n = items.filter((i) => r.items.includes(i)).length;
    if (n > 0 && (!best || n > best.n)) best = { r, n };
  }
  return items.filter((i) => !best || !best.r.items.includes(i)).sort(cmp);
}
