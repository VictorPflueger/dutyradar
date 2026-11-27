// The ladder from law to relief (DR-01): one rung per term, each with its count and a one-line
// definition, in English and German. Node.js only.
//   counts    every rung's count equals data/story.js and the inventory, counted again here: 31 laws, their
//             sections and sentences, the flagged sentences (kept and discarded), the duties by type, the
//             duties in clusters, the cluster priced and its duties, the options, the decision
//   words     every rung says its count in the page's number format, names its term as the glossary does
//             and defines it in one line; the definitions say what 1.0.0's code does (the pattern stage,
//             the classifier, rule 2 of the cluster engine: same addressee, same population, any type)
//   steps     each step highlights the rungs it is about, every rung belongs to a step, and each count
//             opens what it counts
// Usage: node tests/ladder.mjs
import { D, I, X, C, F, LANGS, NAME, norm, checks } from "./lib/app.mjs";

const { check, finish } = checks();
if (!X || !I) {
  check(false, `the ladder needs js/explain.js and data/inventory.js${X ? "" : " (no js/explain.js)"}${I ? "" : " (no data/inventory.js)"}`);
  finish("LADDER OK");
}
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const byType = {};
for (const d of I.duties) byType[d.type] = (byType[d.type] || 0) + 1;
const priced = I.clusters.filter((c) => c.priced);
const counted = {
  laws: I.laws.length,
  sections: sum(I.laws.map((l) => l.paragraphs)),
  sentences: sum(I.laws.map((l) => l.sentences)),
  flagged: I.duties.length + I.discarded.length,
  duties: I.duties.length,
  discarded: I.discarded.length,
  reporting: byType.MELDEPFLICHT,
  clusters: I.clusters.length,
  clustered: sum(I.clusters.map((c) => c.duties.length)),
  priced: priced.length,
  pricedDuties: sum(priced.map((c) => c.duties.length)),
  options: D.options.length,
  decision: 1
};
// The story says the same.
check(counted.laws === D.slice.norms && counted.sections === D.slice.paragraphs && counted.sentences === D.slice.sentences && counted.flagged === D.totals.candidates && counted.duties === D.totals.duties && counted.discarded === D.totals.rejected && counted.clusters === D.totals.clusters && counted.clustered === D.totals.clustered && priced.length === 1 && counted.pricedDuties === D.cluster.members.length && Object.entries(byType).every(([t, n]) => D.totals.byType[t] === n), `counts: the inventory and data/story.js agree (${Object.entries(counted).map(([k, v]) => `${k} ${v}`).join(", ")})`);
check(counted.laws === 31 && counted.sections === 778 && counted.sentences === 4904 && counted.flagged === 870 && counted.duties === 745 && counted.discarded === 125 && counted.clusters === 48 && counted.clustered === 203 && counted.options === 3, "counts: the figures of the brief's section 3, measured again");

const ORDER = ["laws", "sections", "sentences", "flagged", "duties", "types", "clusters", "priced", "options", "decision"];
const want = (id) => ({ laws: counted.laws, sections: counted.sections, sentences: counted.sentences, flagged: counted.flagged, duties: counted.duties, types: counted.reporting, clusters: counted.clusters, priced: counted.priced, options: counted.options, decision: counted.decision })[id];
for (const lang of LANGS) {
  const L = X.explain(F, lang).ladder;
  const n = (x) => new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB").format(x);
  check(Array.isArray(L) && L.map((r) => r.id).join() === ORDER.join(), `words: ${NAME[lang]}: ten rungs from law to decision, in order (${(L || []).map((r) => r.id).join(", ")})`);
  if (!Array.isArray(L)) continue;
  const off = L.filter((r) => r.value !== want(r.id) || norm(r.count) !== n(want(r.id)));
  check(!off.length, `counts: ${NAME[lang]}: every rung's count equals the data${off.length ? `; off: ${off.map((r) => `${r.id} ${r.count} ≠ ${n(want(r.id))}`).join(", ")}` : ""}`);
  // The rungs under a count: 125 discarded, the six types, 203 duties in the clusters.
  const subs = Object.fromEntries(L.flatMap((r) => (r.sub || []).map((s) => [s.open, s])));
  const typeOff = Object.entries(byType).filter(([t, v]) => !subs[`duties:${t}`] || subs[`duties:${t}`].value !== v || !norm(subs[`duties:${t}`].text).startsWith(n(v)));
  check(Object.keys(byType).length === 6 && !typeOff.length && subs.discarded?.value === counted.discarded && subs["clusters:duties"]?.value === counted.clustered, `counts: ${NAME[lang]}: under the rungs, ${n(counted.discarded)} discarded, the six types (${Object.entries(byType).map(([t, v]) => `${t.toLowerCase().slice(0, 4)} ${v}`).join(", ")}) and ${n(counted.clustered)} duties in clusters${typeOff.length ? `; off: ${typeOff.map(([t]) => t).join(", ")}` : ""}`);
  // Each rung names its term as the glossary does, defined in one line.
  const G = C.GLOSSARY;
  const term = { laws: "law", sections: "section", sentences: "sentence", duties: "duty", types: "reporting", clusters: "cluster" };
  const missing = Object.entries(term).filter(([id, g]) => { const r = L.find((x) => x.id === id); return !r || !G[g] || !G[g][lang].some((w) => norm(r.term).toLowerCase().includes(w.toLowerCase())); });
  check(!missing.length, `words: ${NAME[lang]}: the rungs name laws, sections, sentences, duties, reporting duties and clusters in the glossary's words${missing.length ? `; not: ${missing.map(([id]) => id).join(", ")}` : ""}`);
  const long = L.filter((r) => !r.def || /\n/.test(r.def) || norm(r.def).split(" ").length > 36 || /undefined|NaN|\{\{/.test(r.def));
  check(!long.length, `words: ${NAME[lang]}: each rung defines its term in one line of at most 36 words${long.length ? `; not: ${long.map((r) => r.id).join(", ")}` : ""}`);
  // The definitions say what 1.0.0 does, in the glossary's words: the flagging pattern and its markers,
  // the classifier keeping a duty, and rule 2 of the cluster engine.
  const def = (id) => norm(L.find((r) => r.id === id)?.def || "");
  const facts = lang === "en"
    ? [[def("flagged"), /\bmuss\b/], [def("flagged"), /verpflichtet/], [def("duties"), /confirms/], [def("clusters"), /same addressee/], [def("clusters"), /same population/], [def("clusters"), /whatever (its|their) type|any type/], [def("types"), /\bthird\b/], [def("decision"), /person/], [def("laws"), /19 acts and 12 ordinances/], [def("laws"), /chosen/]]
    : [[def("flagged"), /\bmuss\b/], [def("flagged"), /verpflichtet/], [def("duties"), /bestätigt/], [def("clusters"), /demselben Adressaten|denselben Adressaten/], [def("clusters"), /derselben Grundgesamtheit|dieselbe Grundgesamtheit/], [def("clusters"), /gleich welche[rs]? Art|jeder Art/], [def("types"), /Drittel/], [def("decision"), /Mensch/], [def("laws"), /19 Gesetze und 12 Verordnungen/], [def("laws"), /gewählt/]];
  const unsaid = facts.filter(([text, re]) => !re.test(text));
  check(!unsaid.length, `words: ${NAME[lang]}: the definitions say what 1.0.0 does: flagged by a duty word and a marker such as “muss” or “verpflichtet”, kept by the classifier, clustered only with the same addressee and population whatever the type${unsaid.length ? `; missing: ${unsaid.map(([, re]) => re.source).join(", ")}` : ""}`);
  // Each step highlights the rungs it is about, and every rung belongs to a step.
  const steps = [0, 1, 2, 3, 4].map((i) => L.filter((r) => r.steps.includes(i)).map((r) => r.id));
  check(steps.every((s) => s.length) && L.every((r) => r.steps.length) && steps[0].includes("laws") && steps[1].includes("duties") && steps[2].includes("clusters") && steps[3].includes("options") && steps[4].includes("decision"), `steps: ${NAME[lang]}: each step highlights its rungs (${steps.map((s, i) => `${i + 1}: ${s.join(" ")}`).join("; ")})`);
  const OPEN = /^(laws|flagged|duties(:[A-Z]+)?|discarded|clusters(:duties)?|compare|options|derive:\w+|decide)$/;
  check(L.every((r) => OPEN.test(r.open || "")) && L.flatMap((r) => r.sub || []).every((s) => OPEN.test(s.open || "")), `steps: ${NAME[lang]}: every count on the ladder opens what it counts (${L.map((r) => r.open).join(", ")})`);
}
// The glossary keeps one word per thing in both languages.
const G = C.GLOSSARY || {};
const WANT = { duty: ["duty", "Pflicht"], reporting: ["reporting duty", "Meldepflicht"], cluster: ["cluster", "Bündel"], sentence: ["sentence", "Satz"], section: ["section", "Paragraf"], item: ["item", "Angabe"], law: ["law", "Vorschrift"] };
const wrongTerms = Object.entries(WANT).filter(([id, [en, de]]) => !G[id] || G[id].en[0] !== en || G[id].de[0] !== de || !Array.isArray(G[id].avoid?.en) || !Array.isArray(G[id].avoid?.de));
check(!wrongTerms.length, `glossary: js/copy.js keeps one word per thing: ${Object.values(WANT).map(([en, de]) => `${en} and ${de}`).join(", ")}${wrongTerms.length ? `; off: ${wrongTerms.map(([id]) => id).join(", ")}` : ""}`);
finish("LADDER OK");
