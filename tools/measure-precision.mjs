// AC-29: the precision of pattern plus classification on the gold set, from one Live run's recording
// (Record run, with ?record=1). The pattern stage is deterministic, so this script runs it again on the
// recorded run's norms to map each candidate to its sentence, takes the run's classifications (is_duty)
// and compares the gold sentences the run calls duties with their labels in
// tests/fixtures/gold-duties.json. Only gold sentences of the norms the run read count.
// Usage: node tools/measure-precision.mjs <recording.json>      (exit 0 at 85 % or more)
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildData } from "../js/data.js";
import { extractCandidates } from "../js/engine/patterns.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = (...p) => JSON.parse(readFileSync(path.join(ROOT, ...p), "utf8"));
export const TARGET = 0.85;

/** { precision, recall, tp, fp, fn, scope, unclassified } for a recording. */
export function measurePrecision(recording, gold = json("tests/fixtures/gold-duties.json")) {
  const index = json("data/corpus/index.json");
  const normIds = recording.meta?.norm_ids?.length ? recording.meta.norm_ids : index.norms.map((n) => n.id);
  const data = buildData({ index, slice: json("config/slice.json"), norms: normIds.map((id) => json("data/corpus", `${id}.json`)), patterns: json("data/patterns/duty-patterns.json") });
  const classified = recording.recorded?.classifications || {};
  const calledDuty = new Set();
  let unclassified = 0;
  for (const id of normIds) {
    for (const c of extractCandidates(data.norms.get(id), data.patterns)) {
      const cls = classified[c.candidate_id];
      if (!cls) { unclassified += 1; continue; }
      if (cls.is_duty) calledDuty.add(c.sentence_id);
    }
  }
  const scope = gold.items.filter((g) => normIds.includes(g.norm_id));
  const tp = scope.filter((g) => g.is_duty && calledDuty.has(g.id)).length;
  const fp = scope.filter((g) => !g.is_duty && calledDuty.has(g.id)).length;
  const fn = scope.filter((g) => g.is_duty && !calledDuty.has(g.id)).length;
  return { precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null, tp, fp, fn, scope: scope.length, unclassified };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("Usage: node tools/measure-precision.mjs <recording.json>"); process.exit(2); }
  const r = measurePrecision(JSON.parse(readFileSync(file, "utf8")));
  const pct = (x) => (x === null ? "n/a" : `${(x * 100).toFixed(1)} %`);
  console.log(`Gold sentences in the run's norms: ${r.scope}; candidates without a classification: ${r.unclassified}`);
  console.log(`Precision ${pct(r.precision)} (${r.tp} of ${r.tp + r.fp} sentences called duties are duties); recall ${pct(r.recall)} (${r.tp} of ${r.tp + r.fn} gold duties)`);
  const pass = r.precision !== null && r.precision >= TARGET;
  console.log(pass ? `PRECISION OK (target at least ${TARGET * 100} %)` : `PRECISION BELOW TARGET (at least ${TARGET * 100} %)`);
  process.exit(pass ? 0 : 1);
}
