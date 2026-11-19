// Loads the app's data for the Node suites, through the same js/data.js the browser uses: the bundled
// slice from data/, or the two-norm fixture slice of invented laws (tests/fixtures/slice-mini), whose
// Norm files the snapshot script builds from its XML, so the fixture never drifts from the parser.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildData } from "../../js/data.js";
import { parseNormXml } from "../../tools/snapshot-laws.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const json = (...p) => JSON.parse(readFileSync(path.join(ROOT, ...p), "utf8"));

/** The raw files of the bundled slice; norms: the ids to load (all by default). */
export function rawBundled(normIds = null) {
  const index = json("data/corpus/index.json");
  const ids = normIds || index.norms.map((n) => n.id);
  return {
    index,
    slice: json("config/slice.json"),
    norms: ids.map((id) => json("data/corpus", `${id}.json`)),
    patterns: json("data/patterns/duty-patterns.json"),
    vocab: json("data/vocab/data-items.json"),
    populations: json("data/params/populations.json"),
    costParams: json("data/params/cost-params.json"),
    oneOff: json("data/params/one-off.json"),
    registers: json("data/registers.json"),
    consumers: json("data/consumers.json"),
    complaints: json("data/signals/complaints.json")
  };
}

export const loadBundled = (normIds = null) => buildData(rawBundled(normIds));

/** The two-norm fixture slice: invented laws, the golden cases' parameters, real patterns and vocabulary. */
export function rawFixture() {
  const dir = "tests/fixtures/slice-mini";
  const slice = json(dir, "slice.json");
  const retrieved = "2026-10-24T09:00:00Z";
  const norms = slice.norms.map((n) => parseNormXml(readFileSync(path.join(ROOT, dir, `${n.slug}.xml`), "utf8"), {
    slug: n.slug, source_xml_url: `https://www.gesetze-im-internet.de/${n.slug}/xml.zip`, builddate: null, retrieved_at: retrieved
  }));
  return {
    index: {
      slice_id: slice.slice_id, slice_status: slice.status, retrieved_at: retrieved,
      norms: norms.map((n) => ({ id: n.id, abbr: n.abbr, title: n.title, paragraphs: n.paragraphs.length, eu_basis: n.eu_basis }))
    },
    slice,
    norms,
    patterns: json("data/patterns/duty-patterns.json"),
    vocab: json("data/vocab/data-items.json"),
    populations: json(dir, "data/params/populations.json"),
    costParams: json(dir, "data/params/cost-params.json"),
    oneOff: json(dir, "data/params/one-off.json"),
    registers: json(dir, "data/registers.json"),
    consumers: json(dir, "data/consumers.json"),
    complaints: json(dir, "data/signals/complaints.json")
  };
}

export const loadFixture = () => buildData(rawFixture());
export const fixtureRecorded = () => json("tests/fixtures/slice-mini/recorded.json");
