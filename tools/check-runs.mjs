// Checks the recorded runs data/runs/R1.json to R3.json (AC-16): js/run_check.js on every run, then a
// replay in both languages with the recorded intentions, in which every bound fact must be produced
// and still apply, no tool may fail except the audits the run blocks on purpose, and the run's
// cluster ids must be the ones the replay forms.
// Usage: node tools/check-runs.mjs [R1 R2 R3]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildData } from "../js/data.js";
import { createRunState } from "../js/state.js";
import { replayRun } from "../js/simulation.js";
import { checkRun } from "../js/run_check.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = (...p) => JSON.parse(readFileSync(path.join(ROOT, ...p), "utf8"));
const load = (normIds) => buildData({
  index: json("data/corpus/index.json"), slice: json("config/slice.json"), norms: normIds.map((id) => json("data/corpus", `${id}.json`)),
  patterns: json("data/patterns/duty-patterns.json"), vocab: json("data/vocab/data-items.json"), populations: json("data/params/populations.json"),
  costParams: json("data/params/cost-params.json"), oneOff: json("data/params/one-off.json"), registers: json("data/registers.json"),
  consumers: json("data/consumers.json"), complaints: json("data/signals/complaints.json")
});

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["R1", "R2", "R3"];
const problems = [];
let events = 0;
for (const id of ids) {
  const run = json("data/runs", `${id}.json`);
  const data = load(run.meta.norm_ids);
  for (const p of checkRun(run, { data })) problems.push(`${id}: ${p}`);
  for (const lang of ["en", "de"]) {
    const state = createRunState({ data, lang, runId: id, mode: "simulation" });
    const out = [];
    const res = await replayRun({ run, data, state, lang, emit: (e) => out.push(e), awaitDecision: async (req) => state.decide({ option_id: req.intended.option_id, decision: req.intended.decision, reason_code: req.intended.reason_code, comment: "" }) });
    if (res.status !== "done") problems.push(`${id} ${lang}: the replay ended ${res.status}`);
    for (const e of out) if (e.type === "tool_result" && !e.payload.ok && !/^Fact audit failed/.test(e.payload.content || "")) problems.push(`${id} ${lang}: ${e.payload.tool} failed: ${e.payload.content}`);
    for (const [fid, key] of Object.entries(run.facts)) {
      const f = state.facts.get(fid);
      if (!f || f.key !== key || f.retired) problems.push(`${id} ${lang}: ${fid} (${key}) is not produced by the replay`);
    }
    const formed = [...state.clusters.keys()].sort().join();
    if (formed !== Object.keys(run.meta.clusters || {}).sort().join()) problems.push(`${id} ${lang}: the run's cluster ids are not the ones the replay forms`);
    events += out.length;
  }
}
for (const p of problems) console.log(`FAIL ${p}`);
if (problems.length) { console.log(`${problems.length} problem${problems.length === 1 ? "" : "s"}.`); process.exit(1); }
console.log(`RUNS OK (${ids.length} runs replayed in both languages, ${events} events)`);
