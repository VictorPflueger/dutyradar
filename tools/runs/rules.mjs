// Authoring rules for the hand-authored runs R1 to R3 (decision D7: no API key, so no recording). They
// stand in for the classification sub-call's output: categories and short texts per duty candidate,
// worked out from the candidate's sentence, its paragraph, its norm and the slice family, as a
// classifier would read them. The duties the storylines turn on are written by hand in overrides.json.
// Used only at build time by tools/author-runs.mjs; the app never runs these rules.

const AUTHORITY = /(Statistische[ns]? Bundesamt|statistischen Ämter|Bundesregierung|Bundesministerium|Bundesministerin|Bundesagentur|Bundesamt|Bundesnetzagentur|Behörden? der Zollverwaltung|Zollverwaltung|zuständige[n]? (?:Behörde|Stelle)|Behörde|Industrie- und Handelskammer|Gewerbeamt|Stiftung|Zentrale Stelle|Landesbehörde|Registerbehörde|Bundeskartellamt|Umweltbundesamt|Bundesanstalt)/;
const SUBJECT_AUTHORITY = new RegExp(`^(?:\\(\\d+[a-z]?\\)\\s*)?(?:Die|Das|Der|Den)\\s+(?:[\\p{L}-]+\\s+){0,2}${AUTHORITY.source}`, "u");
const PERMISSION = /\b(kann|können|darf|dürfen|ist berechtigt|sind berechtigt|wird ermächtigt|werden ermächtigt)\b/;
const STRONG = /\b(hat|haben|ist verpflichtet|sind verpflichtet|muss|müssen|obliegt|besteht Auskunftspflicht|sind auskunftspflichtig|ist auskunftspflichtig)\b/;
const FREQ = [["täglich", /\btäglich\b|\barbeitstäglich\b/], ["wöchentlich", /\bwöchentlich\b/], ["monatlich", /\bmonatlich\b/], ["vierteljährlich", /\bvierteljährlich\b|\bquartalsweise\b/], ["halbjährlich", /\bhalbjährlich\b/], ["jährlich", /(?<![\p{L}])jährlich\b|\beinmal im Jahr\b/u]];
const RECIPIENTS = [
  [/Statistischen Bundesamt/, "Statistisches Bundesamt"], [/statistischen Ämter/, "statistische Ämter"], [/Behörden der Zollverwaltung|Zollverwaltung/, "Behörden der Zollverwaltung"],
  [/Bundesnetzagentur/, "Bundesnetzagentur"], [/Zentralen Stelle|Zentrale Stelle/, "Zentrale Stelle"], [/Stiftung/, "Stiftung Elektro-Altgeräte Register"],
  [/Industrie- und Handelskammer/, "Industrie- und Handelskammer"], [/zuständigen Behörde|zuständige Behörde/, "zuständige Behörde"], [/zuständigen Stelle|zuständige Stelle/, "zuständige Stelle"]
];
export const TYPE_DE = { MELDEPFLICHT: "Meldepflicht", NACHWEISPFLICHT: "Nachweispflicht", INFORMATIONSPFLICHT: "Informations- und Auskunftspflicht", DOKUMENTATIONSPFLICHT: "Dokumentationspflicht", EVALUIERUNGSPFLICHT: "Evaluierungspflicht", KONTROLLPFLICHT: "Kontrollpflicht" };
export const TYPE_EN = { MELDEPFLICHT: "Reporting duty", NACHWEISPFLICHT: "Proof duty", INFORMATIONSPFLICHT: "Information duty", DOKUMENTATIONSPFLICHT: "Documentation duty", EVALUIERUNGSPFLICHT: "Evaluation duty", KONTROLLPFLICHT: "Control duty" };
const FREQ_EN = { täglich: "daily", wöchentlich: "weekly", monatlich: "monthly", vierteljährlich: "quarterly", halbjährlich: "half-yearly", jährlich: "yearly" };
const ADDR_DE = { wirtschaft: "der Wirtschaft", verwaltung: "der Verwaltung", buerger: "der Bürger" };
const ADDR_EN = { wirtschaft: "of businesses", verwaltung: "of the administration", buerger: "of citizens" };

/** The population of a business duty, by norm and sentence. */
export function populationFor(normId, family, sentence) {
  if (family === "statistics") return "pop-erhebungseinheiten-statistik";
  if (family === "energy") return "pop-energieunternehmen";
  if (normId === "arbzg") return "pop-arbeitgeber-arbzg";
  if (family === "worktime") return /Sitz im Ausland/.test(sentence) ? "pop-arbeitgeber-ausland" : "pop-arbeitgeber-aufzeichnung";
  if (normId === "verpackdg") return "pop-hersteller-verpackungen";
  if (normId === "elektrog_2015") return "pop-hersteller-elektro";
  if (["finvermv", "versvermv_2018", "immvermv", "gewo_34cdv"].includes(normId)) return "pop-vermittler";
  if (normId === "gewo") return /angezeigt|anzuzeigen|Anzeige/.test(sentence) ? "pop-gewerbetreibende-anzeige" : "pop-gewerbebetriebe";
  if (["bewachv_2019", "bewachrv", "spielv", "schauhv"].includes(normId)) return "pop-gewerbebetriebe";
  return null;
}

/** Vocabulary ids named in a text by label or synonym. */
export function itemsIn(text, vocab) {
  const low = String(text).toLocaleLowerCase("de-DE");
  return vocab.items.filter((i) => [i.label, ...(i.synonyms || [])].some((s) => s && low.includes(s.toLocaleLowerCase("de-DE")))).map((i) => i.id);
}

/**
 * The authored classification of one candidate: { candidate_id, is_duty, type, addressee, trigger,
 * frequency_term, population_id, recipient, data_items, protected_standard, certainty,
 * rationale: { de, en } }.
 */
export function classify(c, { data, normText, family }) {
  const sentence = data.sentences.get(c.sentence_id)?.text || "";
  const paragraph = data.paragraphs.get(c.paragraph_id)?.text || "";
  const normId = c.norm_id;
  const selfMarking = c.pattern_ids.some((p) => ["PI-08"].includes(p)) || /Auskunftspflicht|auskunftspflichtig/.test(sentence);
  const authoritySubject = SUBJECT_AUTHORITY.test(sentence);
  const permission = PERMISSION.test(sentence) && !STRONG.test(sentence);
  // Exemptions, cross-references and the naming of who must answer (when the paragraph already states
  // "besteht Auskunftspflicht") are not duties of their own.
  const exemption = /keine Auskunftspflicht|Befreiung von der Auskunftspflicht|befreit/.test(sentence);
  const addresseeOnly = /^\s*(?:\(\d+[a-z]?\)\s*)?Auskunftspflichtig (?:ist|sind)\b/.test(sentence) && /besteht Auskunftspflicht/.test(paragraph);
  const isDuty = !permission && !exemption && !addresseeOnly && !/^\s*(?:\(\d+[a-z]?\)\s*)?(?:Die Vorschriften|Dies gilt|Satz \d)/.test(sentence);
  const addressee = authoritySubject ? "verwaltung" : "wirtschaft";
  let type = c.type_hint;
  if (type === "KONTROLLPFLICHT" && !authoritySubject) {
    const other = c.pattern_ids.find((p) => !p.startsWith("PK"));
    if (other) type = { PM: "MELDEPFLICHT", PN: "NACHWEISPFLICHT", PI: "INFORMATIONSPFLICHT", PD: "DOKUMENTATIONSPFLICHT", PE: "EVALUIERUNGSPFLICHT" }[other.slice(0, 2)] || type;
  }
  const freqText = selfMarking && family === "statistics" ? normText : `${sentence} ${paragraph}`;
  const freq = FREQ.find(([, re]) => re.test(freqText))?.[0] || null;
  const trigger = freq ? "periodisch" : "anlassbezogen";
  const population = addressee === "wirtschaft" ? populationFor(normId, family, sentence) : null;
  const recipient = type === "DOKUMENTATIONSPFLICHT" ? "keine Stelle (Aufbewahrung im Betrieb)" : RECIPIENTS.find(([re]) => re.test(sentence) || re.test(paragraph))?.[1] || "zuständige Stelle";
  // An Auskunftspflicht covers the survey's characteristics, listed elsewhere in the law; any other
  // duty of a statistics law asks for what its own sentence names.
  const scope = selfMarking && ["statistics", "energy"].includes(family) ? normText : family === "statistics" ? sentence : `${sentence} ${paragraph}`;
  let items = itemsIn(scope, data.vocab);
  if (!items.length) items = ["other:Angaben nach der Vorschrift"];
  const protectedStandard = family === "worktime" && type === "DOKUMENTATIONSPFLICHT" ? "arbeitnehmerrechte"
    : ["finvermv", "versvermv_2018", "immvermv"].includes(normId) && type === "INFORMATIONSPFLICHT" ? "verbraucherrechte" : null;
  const certainty = !isDuty ? "mittel" : selfMarking || STRONG.test(sentence) ? "hoch" : c.score >= 1 ? "hoch" : c.score >= 0.5 ? "mittel" : "niedrig";
  const termDe = freq || "anlassbezogen";
  const termEn = freq ? FREQ_EN[freq] : "event-driven";
  return {
    candidate_id: c.candidate_id, is_duty: isDuty, type, addressee, trigger, frequency_term: freq,
    population_id: population, recipient, data_items: items, protected_standard: protectedStandard, certainty,
    rationale: isDuty
      ? { de: `${TYPE_DE[type]} ${ADDR_DE[addressee]}, ${termDe}`, en: `${TYPE_EN[type]} ${ADDR_EN[addressee]}, ${termEn}` }
      : { de: "Befugnis oder Verweis, keine eigene Pflicht", en: "A power or a cross-reference, not a duty of its own" }
  };
}
