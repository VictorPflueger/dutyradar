// Snapshot suite: the snapshot script against the fixture table of contents and the two-norm fixture
// slice (AC-08, AC-34). No network.
// Usage: node tests/snapshot.mjs [toc] [contract] [eu]
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseToc, resolveSlice, run, SnapshotError, euBasisFromText, parseEnbez } from "../tools/snapshot-laws.mjs";
import { normProblems } from "../tools/lib/norm-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FX = path.join(ROOT, "tests/fixtures");
const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${detail}` : ""}`); } };
const throwsSnapshot = (fn, re) => { try { fn(); return false; } catch (e) { return e instanceof SnapshotError && re.test(e.message); } };

const tocXml = readFileSync(path.join(FX, "toc-sample.xml"), "utf8");
const slice = JSON.parse(readFileSync(path.join(FX, "slice-mini/slice.json"), "utf8"));

if (want("toc")) {
  const toc = parseToc(tocXml);
  check("toc: three items with slugs", toc.length === 3 && toc.map((t) => t.slug).join() === "beispielg,musterv,testg_3", JSON.stringify(toc));
  const resolved = resolveSlice(slice.norms, toc);
  check("toc: the slice resolves, titles compared after collapsing white space", resolved.length === 2 && resolved[1].link === "http://www.gesetze-im-internet.de/musterv/xml.zip");
  check("toc: a missing slug stops the script", throwsSnapshot(() => resolveSlice([...slice.norms, { slug: "fehltg", expected_title: "Fehlendes Gesetz" }], toc), /slug "fehltg" is not in gii-toc\.xml/));
  check("toc: a title mismatch stops the script", throwsSnapshot(() => resolveSlice([{ ...slice.norms[0], expected_title: "Gesetz über ein anderes Beispiel" }], toc), /title of "beispielg" differs/));
  check("toc: malformed XML stops the script", throwsSnapshot(() => parseToc("<items><item><title>x</title></items>"), /not well-formed/));
  const lenient = resolveSlice([...slice.norms, { slug: "fehltg", expected_title: "x" }], toc, { lenient: true });
  check("toc: raw downloads list the problems instead", lenient.resolved.length === 2 && lenient.problems.length === 1);
  check("toc: enbez forms", parseEnbez("§ 14a")?.nr === "14a" && parseEnbez("Art 4")?.kind === "art" && parseEnbez("Anlage 1") === null);
}

let out = null;
if (want("contract") || want("eu")) {
  out = mkdtempSync(path.join(tmpdir(), "dr-snapshot-"));
  await run(["--from", path.join(FX, "slice-mini"), "--toc", path.join(FX, "toc-sample.xml"), "--slice", path.join(FX, "slice-mini/slice.json"), "--out", out, "--snapshot-md", path.join(out, "SNAPSHOT.md")], () => {});
}
const norm = (slug) => JSON.parse(readFileSync(path.join(out, `${slug}.json`), "utf8"));

if (want("contract")) {
  for (const slug of ["beispielg", "musterv"]) {
    const problems = normProblems(norm(slug), { slug });
    check(`contract: ${slug}.json satisfies the Norm contract`, problems.length === 0, problems.join("; "));
  }
  const b = norm("beispielg");
  const p20 = b.paragraphs.find((p) => p.id === "beispielg-p20");
  check("contract: Absatz markers kept, sentence 1 is 0–103", p20?.text.startsWith("(1) Gewerbetreibende") && p20.sentences[0].start === 0 && p20.sentences[0].end === 103, JSON.stringify(p20?.sentences[0]));
  check("contract: a list stays in its sentence, numbers tied by a no-break space", /enthält 1\. den Namen und die Anschrift des Betriebs, 2\. die Zahl der Beschäftigten am Stichtag und ist bis zum 15\. Tag/.test(p20?.text || ""), JSON.stringify(p20?.text));
  check("contract: abbreviations end no sentence", p20?.sentences.length === 3, JSON.stringify(p20?.sentences));
  check("contract: footnotes in their own field", p20?.footnotes.length === 1 && /Zur Anwendung/.test(p20.footnotes[0]) && !/Zur Anwendung/.test(p20.text));
  check("contract: html link pattern", p20?.html_url === "https://www.gesetze-im-internet.de/beispielg/__20.html");
  const p23a = b.paragraphs.find((p) => p.id === "beispielg-p23a");
  check("contract: editorial comments left out, text footnotes moved", p23a?.text === "Die Stelle veröffentlicht die Ergebnisse." && p23a.footnotes[0] === "Ergebnisse sind die Summen je Wirtschaftszweig.", JSON.stringify(p23a));
  check("contract: repealed paragraph, structure and annex not kept", b.paragraphs.map((p) => p.id).join() === "beispielg-p20,beispielg-p21,beispielg-p23a" && b.skipped.repealed === 1 && b.skipped.structure === 1 && b.skipped.annex === 1, JSON.stringify(b.skipped));
  const m = norm("musterv");
  check("contract: Art gets art_<nr>", m.paragraphs.find((p) => p.id === "musterv-art4")?.html_url === "https://www.gesetze-im-internet.de/musterv/art_4.html");
  check("contract: abbreviation, title and build date", m.abbr === "MusterV" && m.title === "Musterverordnung über betriebliche Meldungen" && m.builddate === "20261021090000");
  const index = JSON.parse(readFileSync(path.join(out, "index.json"), "utf8"));
  check("contract: index.json with slice id, retrieval time, build dates and counts", index.slice_id === "slice-mini" && index.retrieved_at && index.norms.length === 2 && index.norms[0].builddate === "20261020104500" && index.norms[0].paragraphs === 3, JSON.stringify(index).slice(0, 300));
  const md = readFileSync(path.join(out, "SNAPSHOT.md"), "utf8");
  check("contract: SNAPSHOT.md names source, date and counts", md.includes("gii-toc.xml") && md.includes(index.retrieved_at) && /2 norms, 5 paragraphs/.test(md), md.slice(0, 400));
}

if (want("eu")) {
  check("eu: filled from the EU footnote of a fixture norm", JSON.stringify(norm("musterv").eu_basis) === JSON.stringify(["32012L0019", "32024L0884"]), JSON.stringify(norm("musterv").eu_basis));
  check("eu: empty for a fixture norm without one", JSON.stringify(norm("beispielg").eu_basis) === "[]");
  check("eu: only the official hint counts", euBasisFromText("(+++ EU-Vollzitate: CELEX Nr: 32012L0019 +++)").length === 0);
  check("eu: the hint ends at its closing marks", JSON.stringify(euBasisFromText("(+++ Amtlicher Hinweis des Normgebers auf EG-Recht: EGRL 36/2005 (CELEX Nr: 32005L0036) +++) (+++ Zur Anwendung CELEX Nr: 32099L0001 +++)")) === '["32005L0036"]');
}

if (out) rmSync(out, { recursive: true, force: true });
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
const tokens = [];
if (want("toc") || want("contract")) tokens.push("SNAPSHOT OK");
if (want("eu")) tokens.push("EU BASIS OK");
console.log(`${tokens.join(", ")} (${checks} checks)`);
