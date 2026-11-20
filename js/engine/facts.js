// Fact registry: every number a tool produces becomes a Fact with a stable id (pure, in memory).
//
// A fact's key names its producing tool, target and measure ("draft_options|D-…|register_retrieval|
// wirtschaft_delta"). A new key gets the next free F-<nnnn>; the same key keeps its id when the value
// is recomputed; a number is never reused for another key. A fact whose key no longer applies is
// retired: it keeps its id and has no value, and its placeholders show "no longer applies". Replay
// binds recorded ids to their keys before the run, so a replay produces the same ids.

const UNITS = new Set(["EUR_PER_YEAR", "EUR", "HOURS_PER_YEAR", "COUNT", "SHARE", "MINUTES"]);
const idOf = (n) => `F-${String(n).padStart(4, "0")}`;

export function createFactRegistry() {
  const byId = new Map();
  const idByKey = new Map();
  const reserved = new Map(); // id → key, bound before the facts exist
  let next = 1;
  const nextFree = () => {
    while (byId.has(idOf(next)) || reserved.has(idOf(next))) next += 1;
    return idOf(next);
  };

  return {
    /** Binds a recorded id to its key (replay). Throws when the id already belongs to another key. */
    bind(id, key) {
      if (!/^F-\d{4}$/.test(id)) throw new Error(`Not a fact id: ${id}`);
      const owner = reserved.get(id) ?? byId.get(id)?.key;
      if (owner && owner !== key) throw new Error(`Fact ${id} belongs to ${owner}, not ${key}`);
      const existing = idByKey.get(key);
      if (existing && existing !== id) throw new Error(`Key ${key} already has fact ${existing}`);
      reserved.set(id, key);
      idByKey.set(key, id);
    },
    /** Registers or updates a fact; returns it with its id. */
    register({ key, value, unit, label, produced_by, inputs = [] }) {
      if (!key) throw new Error("A fact needs a key");
      if (!UNITS.has(unit)) throw new Error(`Unknown unit ${unit}`);
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Fact ${key} has no finite value`);
      const id = idByKey.get(key) || nextFree();
      idByKey.set(key, id);
      const fact = { id, value, unit, label, key, produced_by, inputs: [...inputs], retired: false };
      byId.set(id, fact);
      return fact;
    },
    /** Marks a fact whose key no longer applies; it keeps its id and loses its value. */
    retire(key) {
      const id = idByKey.get(key);
      if (!id || !byId.has(id)) return null;
      const fact = { ...byId.get(id), value: null, retired: true };
      byId.set(id, fact);
      return fact;
    },
    get: (id) => byId.get(id) || null,
    has: (id) => byId.has(id),
    /** The key an id belongs to, also for an id bound by a recording that this run never produced. */
    keyOf: (id) => byId.get(id)?.key || reserved.get(id) || null,
    idForKey: (key) => idByKey.get(key) || null,
    all: () => [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
    /** id → key for every fact, as a recording stores it. */
    keys: () => Object.fromEntries([...idByKey.entries()].map(([k, id]) => [id, k]))
  };
}
