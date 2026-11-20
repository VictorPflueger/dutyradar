// The app's data in one object: the law snapshot, the patterns, the vocabulary and the slice's
// parameter files. Tools and engines get this object passed in and never fetch anything themselves
// (the specification's rule for testability); the browser fills it through createDataStore, the Node
// tests through tests/lib/data-node.mjs.

import { compilePatterns } from "./engine/patterns.js";

/** Paths of the data files, relative to the site. */
export const DATA_FILES = {
  index: "data/corpus/index.json",
  slice: "config/slice.json",
  patterns: "data/patterns/duty-patterns.json",
  vocab: "data/vocab/data-items.json",
  populations: "data/params/populations.json",
  costParams: "data/params/cost-params.json",
  oneOff: "data/params/one-off.json",
  registers: "data/registers.json",
  consumers: "data/consumers.json",
  complaints: "data/signals/complaints.json",
  sovereign: "config/sovereign.json",
  run: "config/run.json",
  norm: (id) => `data/corpus/${id}.json`,
  recording: (id) => `data/runs/${id}.json`
};

/**
 * Builds the data object from the raw files. raw: { index, slice, norms: [Norm], patterns, vocab,
 * populations, costParams, oneOff, registers, consumers, complaints }.
 */
export function buildData(raw) {
  const data = {
    index: raw.index,
    slice: raw.slice,
    sliceId: raw.index?.slice_id || raw.slice?.slice_id,
    retrievedDate: String(raw.index?.retrieved_at || "").slice(0, 10),
    norms: new Map(),
    paragraphs: new Map(),
    sentences: new Map(),
    patterns: compilePatterns(raw.patterns),
    vocab: raw.vocab,
    core: new Set((raw.vocab?.items || []).filter((i) => i.core).map((i) => i.id)),
    vocabById: new Map((raw.vocab?.items || []).map((i) => [i.id, i])),
    populations: raw.populations || [],
    populationsById: new Map((raw.populations || []).map((p) => [p.id, p])),
    costParams: raw.costParams || { defaults: {}, duties: [] },
    oneOff: raw.oneOff || [],
    registers: raw.registers || [],
    registersById: new Map((raw.registers || []).map((r) => [r.id, r])),
    consumers: raw.consumers || [],
    complaints: raw.complaints || [],
    complaintsById: new Map((raw.complaints || []).map((k) => [k.id, k]))
  };
  addNorms(data, raw.norms || []);
  return data;
}

/** Adds norms (loaded later, for example when a run needs more of the slice). */
export function addNorms(data, norms) {
  for (const n of norms) {
    if (data.norms.has(n.id)) continue;
    data.norms.set(n.id, n);
    for (const p of n.paragraphs) {
      data.paragraphs.set(p.id, { ...p, norm_id: n.id, abbr: n.abbr });
      for (const s of p.sentences) data.sentences.set(s.id, { id: s.id, start: s.start, end: s.end, norm_id: n.id, paragraph_id: p.id, text: p.text.slice(s.start, s.end) });
    }
  }
  return data;
}

/** Norm ids in the slice's order (the index), whether loaded or not. */
export const sliceNormIds = (data) => (data.index?.norms || []).map((n) => n.id);

/** The index entry of a norm (abbreviation, title, counts), loaded or not. */
export const indexEntry = (data, normId) => (data.index?.norms || []).find((n) => n.id === normId) || null;

/**
 * Browser store: fetchJson(path) → parsed JSON. load(normIds) loads the base files once and then the
 * norms not loaded yet; get() returns the data object.
 */
export function createDataStore(fetchJson) {
  let data = null;
  let base = null;
  return {
    async load(normIds = []) {
      if (!base) {
        base = (async () => {
          const names = ["index", "slice", "patterns", "vocab", "populations", "costParams", "oneOff", "registers", "consumers", "complaints"];
          const files = await Promise.all(names.map((n) => fetchJson(DATA_FILES[n])));
          data = buildData(Object.fromEntries(names.map((n, i) => [n, files[i]]).concat([["norms", []]])));
        })();
      }
      await base;
      const missing = normIds.filter((id) => !data.norms.has(id));
      if (missing.length) addNorms(data, await Promise.all(missing.map((id) => fetchJson(DATA_FILES.norm(id)))));
      return data;
    },
    get: () => data
  };
}
