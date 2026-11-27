// The inventory behind every count (DR-03): data/inventory.js, which the page loads when a list first
// opens, against data/story.js and against itself. Node.js only.
//   counts    745 duties, 125 discarded sentences and 48 clusters holding 203 duties, by law, by type and by
//             addressee, as data/story.js and the ladder count them
//   phrases   every exported phrase is the exact slice of its sentence: inside it, whole words, the same
//             slice data/story.js shows for the two priced duties
//   links     every duty's law, population and cluster exist; every cluster's duties exist, sit in at least
//             two sections and name it; the priced cluster comes first; every law has a name in words
//   sizes     every duty carries its population's size, but for the two the calibration capped
// Usage: node tests/inventory.mjs
import { D, I, S, F, checks } from "./lib/app.mjs";

const { check, finish } = checks();
if (!I) { check(false, "data/inventory.js exists"); finish("INVENTORY OK"); }
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const by = (list, key) => { const m = {}; for (const x of list) m[x[key]] = (m[x[key]] || 0) + 1; return m; };
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

// ---- counts ------------------------------------------------------------------------------------------------
check(I.duties.length === D.totals.duties && I.discarded.length === D.totals.rejected && I.duties.length + I.discarded.length === D.totals.candidates, `counts: ${I.duties.length} duties and ${I.discarded.length} discarded sentences, ${I.duties.length + I.discarded.length} flagged, as data/story.js says`);
check(same(by(I.duties, "type"), D.totals.byType) && same(by(I.duties, "addressee"), D.totals.byAddressee), `counts: the duties by type (${Object.entries(by(I.duties, "type")).map(([k, v]) => `${k} ${v}`).join(", ")}) and by addressee as data/story.js says`);
const perLaw = D.norms.filter((n) => {
  const law = I.laws.find((l) => l.id === n.id);
  const mine = I.duties.filter((d) => d.law === n.id);
  const gone = I.discarded.filter((d) => d.law === n.id);
  const twice = mine.filter((d) => d.cluster);
  return !law || law.duties !== n.duties || mine.length !== n.duties || gone.length !== n.candidates - n.duties || law.flagged !== n.candidates || twice.length !== n.clustered || law.clustered !== n.clustered || !same(by(mine, "type"), n.byType) || law.paragraphs !== n.paragraphs || law.sentences !== n.sentences;
});
check(I.laws.length === 31 && !perLaw.length, `counts: for each of the ${I.laws.length} laws its duties, discarded sentences, types and duties in clusters equal the map's${perLaw.length ? `; off: ${perLaw.map((n) => n.id).join(", ")}` : ""}`);
check(I.clusters.length === D.totals.clusters && sum(I.clusters.map((c) => c.duties.length)) === D.totals.clustered && new Set(I.clusters.flatMap((c) => c.duties)).size === D.totals.clustered, `counts: ${I.clusters.length} clusters holding ${sum(I.clusters.map((c) => c.duties.length))} duties, none in two clusters`);
check(F.duties === I.duties.length && F.clusters === I.clusters.length && F.clustered === D.totals.clustered && F.rejected === I.discarded.length, "counts: the figures js/story.js derives for the page agree");

// ---- phrases -------------------------------------------------------------------------------------------------
const WORD = /[\p{L}\p{N}]/u;
/** A phrase lies inside its sentence and starts and ends on whole words. */
const whole = (sentence, [a, b]) => {
  if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && a < b && b <= sentence.length)) return false;
  const slice = sentence.slice(a, b);
  if (!WORD.test(slice[0]) && !/[„(]/.test(slice[0])) return false;
  if (a > 0 && WORD.test(sentence[a - 1]) && WORD.test(slice[0])) return false;
  return !(b < sentence.length && WORD.test(sentence[b]) && WORD.test(slice.at(-1)));
};
check(whole("Für die Erhebungen besteht Auskunftspflicht.", [19, 43]) && !whole("Für die Erhebungen besteht Auskunftspflicht.", [21, 43]) && !whole("Für die Erhebungen besteht Auskunftspflicht.", [19, 40]) && !whole("kurz", [2, 9]), "control: a phrase cut inside a word or past its sentence is caught");
const bad = [...I.duties, ...I.discarded].filter((d) => !whole(d.sentence, d.phrase));
check(!bad.length, `phrases: all ${I.duties.length + I.discarded.length} marked phrases lie inside their sentence and start and end on whole words${bad.length ? `; off: ${bad.slice(0, 5).map((d) => d.id).join(", ")}` : ""}`);
const members = D.cluster.members.map((m) => { const d = I.duties.find((x) => x.id === m.duty); return d && d.sentence === m.sentence && d.phrase[0] === m.phrase.start && d.phrase[1] === m.phrase.end && d.sentence.slice(...d.phrase) === m.phrase.text; });
check(members.length === 2 && members.every(Boolean), "phrases: the two priced duties carry the same sentence and phrase as data/story.js");
const sentenceOnce = I.duties.filter((d) => !d.sentence.trim() || /\{\{|undefined/.test(d.sentence));
check(!sentenceOnce.length, "phrases: every duty carries its sentence in full");

// ---- links ---------------------------------------------------------------------------------------------------
const laws = new Set(I.laws.map((l) => l.id));
const unknown = I.duties.filter((d) => !laws.has(d.law) || (d.population && !I.populations[d.population]) || (d.cluster && !I.clusters.some((c) => c.id === d.cluster && c.duties.includes(d.id)))).map((d) => d.id);
check(!unknown.length, `links: every duty's law, population and cluster exist${unknown.length ? `; off: ${unknown.slice(0, 5).join(", ")}` : ""}`);
const dutyIds = new Set(I.duties.map((d) => d.id));
const lonely = I.clusters.filter((c) => c.duties.length < 2 || !c.duties.every((id) => dutyIds.has(id) && I.duties.find((d) => d.id === id).cluster === c.id) || !c.shared.length || !c.laws.length || !(c.confidence > 0 && c.confidence <= 1));
check(!lonely.length, `links: every cluster holds at least two duties that name it, shares at least one item and has a confidence${lonely.length ? `; off: ${lonely.map((c) => c.id).join(", ")}` : ""}`);
check(I.clusters[0].priced && I.clusters[0].id === D.cluster.id && I.clusters.filter((c) => c.priced).length === 1 && I.clusters.slice(1).every((c, i, a) => i === 0 || a[i - 1].duties.length >= c.duties.length), "links: the priced cluster comes first, then the others by size");
const vocab = new Set(Object.keys(I.vocab));
const items = I.duties.flatMap((d) => d.items).filter((x) => !x.startsWith("other:") && !vocab.has(x));
check(!items.length && I.clusters.every((c) => c.shared.every((x) => vocab.has(x))), `links: every item a duty or cluster names is in the vocabulary${items.length ? `; off: ${[...new Set(items)].join(", ")}` : ""}`);
const nameless = I.laws.filter((l) => { try { return !S.lawName(l.id, "en") || !S.lawName(l.id, "de"); } catch { return true; } });
check(!nameless.length, `links: every law has a name in words in both languages${nameless.length ? `; not: ${nameless.map((l) => l.id).join(", ")}` : ""}`);
check(I.laws.filter((l) => l.kind === "act").length === D.slice.acts && I.laws.filter((l) => l.kind === "ordinance").length === D.slice.ordinances && D.slice.acts + D.slice.ordinances === 31, `links: ${D.slice.acts} acts and ${D.slice.ordinances} ordinances`);

// ---- sizes ---------------------------------------------------------------------------------------------------
const capped = I.duties.filter((d) => d.population && d.units !== I.populations[d.population].units);
const cap = D.calibration?.cap;
check(capped.length === 2 && capped.every((d) => d.units === cap && D.cluster.members.some((m) => m.duty === d.id)) && I.duties.every((d) => (d.population ? Number.isFinite(d.units) : d.units === null)), `sizes: every duty carries its population's size, but the two priced ones, capped at ${cap}`);
finish("INVENTORY OK");
