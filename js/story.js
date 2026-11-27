// The five steps and every sentence they say, in English and German, with the figures filled in from
// data/story.js (computed by release 1.0.0's engines). Pure: no DOM, so Node tests import it as it is.
// It is also the one place that turns the data's ids into words (Vici, Names, not record ids): laws,
// clusters, types, recipients and items all get their names here.

import { count, millions, money, euros, millionsWord, minutes, longDate } from "./format.js";

export const STEP_IDS = ["target", "reads", "twice", "prices", "decide"];
export const CHOICES = ["merge", "register_retrieval", "keep"];
/** PflichtenLichten: at least a third fewer reporting duties, at least half fewer documentation duties. */
export const TARGET = { reporting: 1 / 3, documentation: 1 / 2 };

/** Each law in words, one short name per language (D5): the map, the lists and the story say the same. */
export const LAWS = {
  bstatg_1987: ["Federal statistics", "Bundesstatistik"],
  prodgewstatg: ["Production statistics", "Produktionsstatistik"],
  hdldlstatg: ["Trade and services statistics", "Handels- und Dienst­leistungs­statistik"],
  kostrukstatg: ["Cost structure statistics", "Kostenstrukturstatistik"],
  preisstatg: ["Price statistics", "Preisstatistik"],
  verdstatg: ["Earnings statistics", "Verdienststatistik"],
  hwstatg_1994: ["Crafts statistics", "Handwerksstatistik"],
  gwstatg: ["Global value chains", "Globale Wertschöpfungsketten"],
  ahstatg: ["Foreign trade statistics", "Außenhandelsstatistik"],
  ahstatdv_2022: ["Foreign trade ordinance", "Außenhandelsverordnung"],
  statregg: ["Statistics register", "Statistikregister"],
  vwdvg_2010: ["Administrative data", "Verwaltungsdaten"],
  enstatg_2017: ["Energy statistics", "Energiestatistik"],
  milog: ["Minimum wage", "Mindestlohn"],
  miloaufzv: ["Time recording ordinance", "Aufzeichnungsverordnung"],
  milodokv_2015: ["Documentation ordinance", "Dokumentationsverordnung"],
  milomeldv: ["Notification ordinance", "Meldeverordnung"],
  arbzg: ["Working time", "Arbeitszeit"],
  aentg_2009: ["Posted workers", "Arbeitnehmer-Entsendung"],
  verpackdg: ["Packaging", "Verpackungen"],
  elektrog_2015: ["Electrical equipment", "Elektrogeräte"],
  battdg: ["Batteries", "Batterien"],
  gewo: ["Trade regulation code", "Gewerbeordnung"],
  gewo_34cdv: ["Brokers and developers", "Makler und Bauträger"],
  finvermv: ["Investment brokers", "Finanzanlagenvermittlung"],
  versvermv_2018: ["Insurance brokers", "Versicherungsvermittlung"],
  immvermv: ["Property loan brokers", "Immobiliardarlehen"],
  bewachv_2019: ["Security services", "Bewachungsgewerbe"],
  bewachrv: ["Security register", "Bewacherregister"],
  spielv: ["Gaming machines", "Spielgeräte"],
  schauhv: ["Fairground insurance", "Schaustellerhaftpflicht"]
};
/** The five topic areas of the slice. */
export const TOPICS = {
  statistics: ["business statistics", "Wirtschaftsstatistik"],
  energy: ["energy statistics", "Energiestatistik"],
  worktime: ["minimum wage and working time", "Mindestlohn und Arbeitszeit"],
  products: ["product responsibility", "Produktverantwortung"],
  trade: ["trade regulation", "Gewerberecht"]
};
const L = (lang) => (lang === "de" ? 1 : 0);
/** A law's name in words; soft hyphens let a long German name break, and a search ignores them. */
export const lawName = (id, lang) => { if (!LAWS[id]) throw new Error(`No name in words for ${id}`); return LAWS[id][L(lang)]; };
export const plain = (s) => String(s).replace(/­/g, "");

/** Names in words for the records the screen talks about; their ids stay in the data files. */
export const NAMES = {
  "C-046": { en: "the trade and production reports", de: "die Meldungen zu Handel und Produktion" }
};
export function nameOf(id, lang) {
  if (LAWS[id]) return plain(lawName(id, lang));
  if (!NAMES[id]) throw new Error(`No name in words for ${id}`);
  return NAMES[id][lang];
}
/** 1.0.0's reason codes as the screen says them: the reason, never the code. */
export const REASONS = {
  Z1: { en: "because both ask for the same items", de: "weil beide dieselben Angaben abfragen" },
  Z2: { en: "because the register holds the data", de: "weil das Register die Daten führt" },
  A3: { en: "because the department needs both", de: "weil das Fachressort beide braucht" }
};
/** The six types of duty: [singular, plural] per language. */
export const TYPES = {
  MELDEPFLICHT: { en: ["reporting duty", "reporting duties"], de: ["Meldepflicht", "Meldepflichten"] },
  INFORMATIONSPFLICHT: { en: ["information duty", "information duties"], de: ["Informationspflicht", "Informationspflichten"] },
  NACHWEISPFLICHT: { en: ["proof duty", "proof duties"], de: ["Nachweispflicht", "Nachweispflichten"] },
  DOKUMENTATIONSPFLICHT: { en: ["documentation duty", "documentation duties"], de: ["Dokumentationspflicht", "Dokumentationspflichten"] },
  KONTROLLPFLICHT: { en: ["control duty", "control duties"], de: ["Kontrollpflicht", "Kontrollpflichten"] },
  EVALUIERUNGSPFLICHT: { en: ["evaluation duty", "evaluation duties"], de: ["Evaluierungspflicht", "Evaluierungspflichten"] }
};
export const TYPE_ORDER = Object.keys(TYPES);
export const typeName = (type, lang, many = false) => TYPES[type][lang][many ? 1 : 0];
const ADDRESSEES = { wirtschaft: ["businesses", "Unternehmen"], verwaltung: ["the administration", "Verwaltung"], buerger: ["citizens", "Bürger"] };
export const addresseeName = (a, lang) => ADDRESSEES[a][L(lang)];
const FREQUENCIES = { täglich: ["daily", "täglich"], wöchentlich: ["weekly", "wöchentlich"], monatlich: ["monthly", "monatlich"], vierteljährlich: ["quarterly", "vierteljährlich"], halbjährlich: ["half-yearly", "halbjährlich"], jährlich: ["yearly", "jährlich"] };
/** How often a duty falls due: its frequency, or when something happens. */
export const dueName = (d, lang) => (d.frequency ? FREQUENCIES[d.frequency][L(lang)] : d.trigger === "einmalig" ? ["once", "einmalig"][L(lang)] : ["when it occurs", "anlassbezogen"][L(lang)]);
/** Where a duty's report goes, as run R1 read it: [English, German with its article]. */
const RECIPIENTS = {
  "Statistisches Bundesamt": ["the Federal Statistical Office", "das Statistische Bundesamt"],
  "statistische Ämter": ["the statistical offices", "die statistischen Ämter"],
  "statistische Ämter der Länder": ["the statistical offices of the Länder", "die statistischen Ämter der Länder"],
  "zuständige Stelle": ["the competent body", "die zuständige Stelle"],
  "zuständige Behörde": ["the competent authority", "die zuständige Behörde"],
  Bundesnetzagentur: ["the Federal Network Agency", "die Bundesnetzagentur"],
  "Industrie- und Handelskammer": ["the chamber of commerce", "die Industrie- und Handelskammer"],
  "Behörden der Zollverwaltung": ["the customs authorities", "die Zollbehörden"],
  "Stiftung Elektro-Altgeräte Register": ["the register of electrical equipment", "die Stiftung Elektro-Altgeräte Register"],
  "Zentrale Stelle": ["the packaging register", "die Zentrale Stelle Verpackungsregister"]
};
const KEPT_AT_HOME = "keine Stelle (Aufbewahrung im Betrieb)";
export function recipientName(r, lang) {
  if (r === KEPT_AT_HOME) return ["kept at the business", "im Betrieb aufbewahrt"][L(lang)];
  const name = RECIPIENTS[r]?.[L(lang)] || r;
  return lang === "de" ? `an ${name}` : `to ${name}`;
}
/** The data items a duty asks for (1.0.0's vocabulary), short; "other:" items are what the section names. */
export const ITEMS = {
  unternehmensstammdaten: { en: "Company data", de: "Stammdaten" },
  beschaeftigte: { en: "Persons employed", de: "Beschäftigte" },
  umsatz: { en: "Turnover", de: "Umsatz" },
  branche: { en: "Sector", de: "Branche" },
  produktion: { en: "Production", de: "Produktion" },
  energieverbrauch: { en: "Energy use", de: "Energieverbrauch" },
  arbeitszeit: { en: "Working time", de: "Arbeitszeit" },
  arbeitnehmer_identitaet: { en: "Employees' details", de: "Angaben zu Beschäftigten" },
  beschaeftigungsort: { en: "Place of work", de: "Beschäftigungsort" },
  beschaeftigungsdauer: { en: "Start and length of work", de: "Beginn und Dauer" },
  arbeitsentgelt: { en: "Wages", de: "Löhne" },
  arbeitsstunden: { en: "Hours worked", de: "Arbeitsstunden" },
  investitionen: { en: "Investment", de: "Investitionen" },
  warenverkehr: { en: "Goods traded", de: "Warenverkehr" },
  energieerzeugung: { en: "Energy produced", de: "Energieerzeugung" },
  verpackungsmengen: { en: "Packaging sold", de: "Verpackungsmengen" },
  geraetemengen: { en: "Equipment sold", de: "Gerätemengen" },
  batteriemengen: { en: "Batteries sold", de: "Batteriemengen" },
  registriernummer: { en: "Registration number", de: "Registrierungsnummer" },
  steuernummer: { en: "Tax numbers", de: "Steuernummern" }
};
export const itemName = (id, lang) => (id.startsWith("other:") ? ["items its section names", "Angaben der Vorschrift"][L(lang)] : ITEMS[id]?.[lang] || id);

/** The figures the page states, derived from the data once. */
export function factsOf(D) {
  const t = D.totals;
  const reporting = t.byType.MELDEPFLICHT;
  const documentation = t.byType.DOKUMENTATIONSPFLICHT;
  const option = Object.fromEntries(D.options.map((o) => [o.type, o]));
  const c = D.cluster;
  return {
    D, option,
    laws: D.slice.norms,
    acts: D.slice.acts,
    ordinances: D.slice.ordinances,
    paragraphs: D.slice.paragraphs,
    sentences: D.slice.sentences,
    retrieved: D.slice.retrieved,
    candidates: t.candidates,
    duties: t.duties,
    rejected: t.rejected,
    byType: t.byType,
    reporting,
    documentation,
    others: t.duties - reporting - documentation,
    clusters: t.clusters,
    clustered: t.clustered,
    waiting: t.clusters - 1,
    priced: 1,
    pricedDuties: c.members.length,
    options: D.options.length,
    // "At least a third": the smallest whole number of duties that reaches it.
    target: Math.ceil(reporting * TARGET.reporting - 1e-9),
    docTarget: Math.ceil(documentation * TARGET.documentation - 1e-9),
    businesses: D.inputs.businesses.value,
    perYear: D.inputs.perYear.value,
    minutes: D.inputs.minutes.value,
    mergedMinutes: D.inputs.mergedMinutes.value,
    wage: D.inputs.wage.value,
    adminWage: D.inputs.adminWage.value,
    material: D.inputs.material.value,
    adminMinutes: D.inputs.adminMinutes.value,
    oneOff: D.inputs.oneOff.value,
    casesEach: c.members[0].cases,
    reportCost: c.members[0].cost,
    cases: c.cases,
    clusterCost: c.cost,
    sharedCount: c.shared.length,
    merge: -option.merge.net,
    register: -option.register_retrieval.net,
    registerBusinesses: -option.register_retrieval.businesses,
    registerAdmin: option.register_retrieval.administration,
    // What 1.0.0 shows as pending before the decision: the merge's relief, at stake until a person approves.
    stake: D.kpiBefore.pending,
    outcome: D.outcomes
  };
}

/**
 * The figures the guides and the step buttons write, by their data-fig names, in one language.
 * index.html holds them as text already; js/main.js writes them again and tests/figures.mjs compares.
 */
export function figures(F, lang) {
  const n = (x) => count(x, lang);
  const m = (x) => millions(x, lang);
  const low = F.D.sensitivity[F.D.sensitivity.length - 1];
  const cal = F.D.calibration;
  const dv = F.D.derivation;
  return {
    laws: n(F.laws), acts: n(F.acts), ordinances: n(F.ordinances), paragraphs: n(F.paragraphs), sentences: n(F.sentences), candidates: n(F.candidates),
    duties: n(F.duties), rejected: n(F.rejected), reporting: n(F.reporting), documentation: n(F.documentation), others: n(F.others),
    clusters: n(F.clusters), clustered: n(F.clustered), waiting: n(F.waiting), target: n(F.target), "doc-target": n(F.docTarget),
    priced: n(F.priced), "priced-duties": n(F.pricedDuties), options: n(F.options),
    businesses: n(F.businesses), "per-year": n(F.perYear), minutes: minutes(F.minutes, lang), "merged-minutes": minutes(F.mergedMinutes, lang),
    wage: euros(F.wage, lang, 2), "admin-wage": euros(F.adminWage, lang, 2), material: euros(F.material, lang, 2),
    "admin-minutes": minutes(F.adminMinutes, lang), "one-off": euros(F.oneOff, lang),
    "cases-each": n(F.casesEach), cases: n(F.cases), "cases-words": millionsWord(F.cases, lang),
    "report-cost": m(F.reportCost), "cluster-cost": m(F.clusterCost), stake: m(F.stake),
    merge: m(F.merge), register: m(F.register), "register-businesses": m(F.registerBusinesses), "register-admin": m(F.registerAdmin),
    "merge-left": m(F.clusterCost - F.merge), retrieved: longDate(F.retrieved, lang), token: F.D.check.tokens[0],
    removed: n(F.outcome.merge.reporting.removed),
    "low-share": `${n(low.share * 100)}${lang === "de" ? " %" : "%"}`, "low-relief": m(low.relief),
    // The calibration (DR-06): the public counts and what R1 assumed before them.
    sites: n(cal.production.sites), "trade-units": n(cal.trade.count), "before-businesses": n(cal.before.businesses),
    "before-merge": m(cal.before.merge), "before-register": m(cal.before.register),
    "before-merge-exact": euros(cal.before.merge, lang), "before-register-exact": euros(cal.before.register, lang),
    ...Object.fromEntries(F.D.sensitivity.map((r) => [`relief-${Math.round(r.share * 100)}`, m(r.relief)])),
    // The derivation's exact amounts, as the documents may quote them.
    "one-exact": euros(dv.one.cost, lang, 2), "both-exact": euros(dv.both, lang, 2), "merged-exact": euros(dv.merged.cost, lang, 2),
    "merge-exact": euros(dv.relief, lang, 2), "admin-exact": euros(dv.admin.cost, lang, 2), "register-exact": euros(dv.registerNet, lang, 2),
    reports: n(dv.one.reports)
  };
}

/** Where the replay is at progress p (0 to 1) of the reading: each law's state and the duties found so far. */
export function readingAt(F, p) {
  const r = F.D.replay;
  const t = r.readFrom + Math.max(0, Math.min(1, p)) * (r.readTo - r.readFrom);
  let found = 0;
  let done = 0;
  const laws = F.D.norms.map((n) => {
    const state = n.readAt <= t ? "read" : n.readFrom < t ? "reading" : "unread";
    if (state === "read") { found += n.duties; done += 1; }
    return { id: n.id, state };
  });
  return { laws, found, done };
}

/**
 * What the three key figures show at step `index` (0 to 4) after `decision` (null, or one of CHOICES).
 * They answer first: from the first screen they show what the case puts at stake, and only the decision
 * at the last step moves them. An approval takes the relief at stake off the table; keeping both leaves
 * it there. `was` is the value before the decision, which the tile keeps struck through (vc-stat__was).
 * The relief rests on an assumed overlap, so it reads "up to" until a decision settles it.
 */
export function kpisAt(F, index, decision) {
  const decided = index === STEP_IDS.length - 1 && CHOICES.includes(decision) ? decision : null;
  const out = decided ? F.outcome[decided] : null;
  const taken = Boolean(out && out.relief > 0);
  return {
    twice: { value: F.clustered, of: F.duties },
    stake: { value: taken ? 0 : F.stake, was: taken ? F.stake : null, note: decided ? `decided_${decided}` : "pending", done: taken, upTo: !taken },
    cut: { value: out ? out.reporting.removed : 0, was: out && out.reporting.removed ? 0 : null, of: F.target }
  };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A sentence with counts that open what they count: a list of strings and { text, open } parts. The view
 * turns each { text, open } into a button marked data-open (DR-03) that also points at its laws (DR-04).
 */
const parts = (strings, ...counts) => strings.flatMap((s, i) => (i < counts.length ? [s, counts[i]] : [s])).filter((x) => x !== "");
export const asText = (p) => (Array.isArray(p) ? p.map((x) => (typeof x === "string" ? x : x.text)).join("") : p);

/** Every sentence of the page in one language, with the figures filled in. */
export function words(F, lang) {
  const de = lang === "de";
  const n = (x) => count(x, lang);
  const m = (x) => millions(x, lang);
  const o = F.outcome;
  const c = F.D.cluster;
  const reports = nameOf(c.id, lang);
  const law = (mem) => plain(lawName(mem.norm, lang));
  const c1 = (text, open) => ({ text, open });
  const lawsWord = de ? "Vorschriften" : "laws";
  const upTo = de ? "bis zu " : "up to ";
  const steps = {
    target: {
      label: de ? "Das Ziel" : "The target",
      hint: de ? `${n(F.laws)} Vorschriften · ${n(F.sentences)} Sätze` : `${n(F.laws)} laws · ${n(F.sentences)} sentences`,
      title: de ? `${n(F.laws)} Vorschriften, ein Ziel: ein Drittel weniger Meldepflichten` : `${n(F.laws)} laws, one target: a third fewer reporting duties`,
      text: de
        ? parts`PflichtenLichten heißt der Plan von Bund und Ländern, Betrieben Pflichten abzunehmen. Die ${c1(`${n(F.laws)} Vorschriften`, "laws")} sind für diese Demo von Hand gewählt, aus fünf Themen mit vielen Meldungen der Wirtschaft. Der Agent liest jeden Satz darin.`
        : parts`PflichtenLichten is the federal and state governments' plan to take duties off businesses. The ${c1(`${n(F.laws)} laws`, "laws")} were chosen by hand for this demo from five topic areas full of business reporting. The agent reads every sentence in them.`,
      agent: de
        ? `Mein Plan: die ${n(F.laws)} Vorschriften lesen, jede Pflicht finden, Pflichten mit denselben Daten suchen, die vielversprechendste Überschneidung bepreisen und Entlastung vorschlagen.`
        : `My plan: read the ${n(F.laws)} laws, find every duty, look for duties that ask for the same data, price the most promising overlap and propose relief.`,
      ask: de ? `Lassen Sie den Agenten die ${n(F.laws)} Vorschriften lesen.` : `Let the agent read the ${n(F.laws)} laws.`
    },
    reads: {
      label: de ? "Er liest" : "It reads",
      hint: de ? `${n(F.candidates)} markiert · ${n(F.duties)} Pflichten` : `${n(F.candidates)} flagged · ${n(F.duties)} duties`,
      title: de ? `${n(F.duties)} Pflichten in ${n(F.sentences)} Sätzen` : `${n(F.duties)} duties in ${n(F.sentences)} sentences`,
      text: de
        ? parts`Der Agent markiert ${c1(`${n(F.candidates)} Sätze`, "flagged")} mit einem Pflichtwort und einem Wort wie „muss“. ${c1(n(F.duties), "duties")} behält er als Pflichten, also als etwas, das eine Vorschrift jemandem auferlegt; ${c1(n(F.rejected), "discarded")} verwirft er. ${c1(`${n(F.reporting)} sind Meldepflichten`, "duties:MELDEPFLICHT")}, die Art, die das Ziel kürzt.`
        : parts`The agent flags ${c1(`${n(F.candidates)} sentences`, "flagged")} with a duty word and a word such as “muss”. It keeps ${c1(n(F.duties), "duties")} as duties, things a law makes someone do, and discards ${c1(n(F.rejected), "discarded")}. ${c1(`${n(F.reporting)} are reporting duties`, "duties:MELDEPFLICHT")}, the type the target cuts.`,
      agent: de
        ? "Das Inventar steht. Jetzt suche ich Pflichten, die dieselben Betriebe nach denselben Daten fragen."
        : "Inventory complete. Now I look for duties that ask the same businesses for the same data.",
      ask: de ? "Sehen Sie, welche Pflichten dieselben Angaben doppelt abfragen." : "See which duties ask for the same items twice."
    },
    twice: {
      label: de ? "Doppelt gefragt" : "Asked twice",
      hint: de ? `${n(F.clustered)} Pflichten in ${n(F.clusters)} Bündeln` : `${n(F.clustered)} duties in ${n(F.clusters)} clusters`,
      title: de ? `Zwei Monatsmeldungen fragen dieselben ${n(F.sharedCount)} Angaben ab` : `Two monthly reports ask for the same ${n(F.sharedCount)} items`,
      text: de
        ? parts`${c1(`${n(F.clustered)} Pflichten`, "clusters:duties")} fragen Angaben ab, die eine andere schon erhebt. Sie bilden ${c1(`${n(F.clusters)} Bündel`, "clusters")}: Pflichten, die dieselben Adressaten nach überlappenden Angaben fragen. Der Agent nimmt das vielversprechendste.`
        : parts`${c1(`${n(F.clustered)} duties`, "clusters:duties")} ask for items another duty already asks for. They form ${c1(`${n(F.clusters)} clusters`, "clusters")}: duties that ask the same addressees for overlapping items. The agent takes the most promising.`,
      // The cluster's name opens the comparison and marks its two laws on the map (DR-04).
      agent: de
        ? parts`${c1(cap(reports), "compare")} fragen dieselben ${n(F.sharedCount)} Angaben ab.`
        : parts`${c1(cap(reports), "compare")} ask for the same ${n(F.sharedCount)} items.`,
      ask: de ? "Lassen Sie den Agenten die Optionen bepreisen." : "Let the agent price the options."
    },
    prices: {
      label: de ? "Er bepreist" : "It prices",
      hint: de ? `${n(F.priced)} Bündel · ${n(F.options)} Optionen` : `${n(F.priced)} cluster · ${n(F.options)} options`,
      title: de ? `Eine Meldung statt zwei spart ${upTo}${m(F.merge)} im Jahr` : `One report instead of two saves ${upTo}${m(F.merge)} a year`,
      text: de
        ? parts`Der Agent bepreist ${c1(`${n(F.options)} Optionen`, "options")} nach dem Leitfaden zum Erfüllungsaufwand, mit Minuten und Lohnkosten aus den Tabellen von Destatis. Jeder Betrag zeigt, woher er kommt.`
        : parts`The agent prices ${c1(`${n(F.options)} options`, "options")} with the federal method for costing red tape, with minutes and wages from the Destatis tables. Every amount shows where it comes from.`,
      agent: de
        ? `Mein erster Entwurf nannte eine Frist von ${F.D.check.tokens[0]} Tagen ohne Quelle; der Faktenprüfer blockierte ihn.`
        : `My first draft named a deadline of ${F.D.check.tokens[0]} days without a source; the fact checker blocked it.`,
      ask: de ? "Entscheiden Sie, was ins Dossier kommt." : "Decide what goes into the dossier."
    },
    decide: {
      label: de ? "Sie entscheiden" : "You decide",
      hint: de ? `${n(1)} Entscheidung` : `${n(1)} decision`,
      title: de ? "Sie entscheiden, was ins Dossier kommt" : "You decide what goes into the dossier",
      text: de
        ? "Der Agent schlägt vor, ein Mensch entscheidet. Nur eine Freigabe kommt ins Dossier, mit einer Formulierungshilfe. Nichts wird versendet."
        : "The agent proposes, a person decides. Only an approval enters the relief dossier, with draft wording for the law change. Nothing is sent.",
      agent: de ? `Die ${n(F.options)} Optionen liegen zur Entscheidung vor.` : `The ${n(F.options)} options are ready for your decision.`,
      ask: de ? "Geben Sie eine Option frei, dann entfällt eine Meldepflicht." : "Approve an option and one reporting duty goes."
    }
  };
  // The bar's words: what the page waits for, said where the eye is, and the button that names where it
  // leads (Vici, Presenting step by step). Once decided, the story is over and the bar offers a new start.
  const ask = {
    turn: de ? "Sie sind dran:" : "Your turn:", next: (step) => (de ? `Weiter: ${step}` : `Next: ${step}`), working: de ? "Der Agent arbeitet." : "The agent is at work.", pause: "Pause",
    done: de ? "Fertig:" : "Done:", over: de ? `${n(F.waiting)} weitere Bündel warten auf einen Menschen.` : `${n(F.waiting)} more clusters are waiting for a person.`, again: de ? "Neu starten" : "Start again"
  };
  const cut = (x) => (de ? `Das streicht eine Meldepflicht: ${n(x)} der ${n(F.target)}, die das Ziel verlangt.` : `That cuts one reporting duty: ${n(x)} of the ${n(F.target)} the target asks for.`);
  // After the decision the step's title states the result, and the box under it says why and what it moved.
  const decided = {
    merge: {
      title: de ? `Freigegeben: Die Betriebe sparen ${upTo}${m(o.merge.relief)} im Jahr` : `Approved: businesses save ${upTo}${m(o.merge.relief)} a year`,
      text: de ? `Aus zwei Meldungen wird eine, ${REASONS.Z1.de}. ${cut(o.merge.reporting.removed)}` : `The two reports become one, ${REASONS.Z1.en}. ${cut(o.merge.reporting.removed)}`
    },
    register_retrieval: {
      title: de ? `Freigegeben: netto ${m(o.register_retrieval.relief)} Entlastung im Jahr` : `Approved: ${m(o.register_retrieval.relief)} a year of relief, net`,
      text: de
        ? `Das Register liefert die Daten: Die Betriebe sparen ${m(F.registerBusinesses)} im Jahr, die Verwaltung wendet ${m(F.registerAdmin)} auf, dazu einmalig ${euros(F.oneOff, lang)}. ${cut(o.register_retrieval.reporting.removed)}`
        : `The register supplies the data: businesses save ${m(F.registerBusinesses)} a year, the administration spends ${m(F.registerAdmin)}, plus ${euros(F.oneOff, lang)} once. ${cut(o.register_retrieval.reporting.removed)}`
    },
    keep: {
      title: de ? "Beibehalten: Beide Meldungen bleiben" : "Kept: both reports stay",
      text: de ? `Keine Entlastung, ${REASONS.A3.de}. Das Dossier hält den Grund fest.` : `No relief, ${REASONS.A3.en}. The dossier records why.`
    }
  };
  const kpi = {
    twice: { label: de ? "Doppelt gefragt" : "Asked twice", of: de ? "von" : "of", note: de ? "Pflichten in Bündeln" : "duties in clusters" },
    stake: {
      label: de ? "Offene Entlastung pro Jahr" : "Relief at stake a year",
      upTo: de ? "bis zu" : "up to",
      pending: de ? `angenommen: ${n(F.businesses)} melden doppelt` : `assumed: ${n(F.businesses)} file both`,
      decided_merge: de ? `bis zu ${m(o.merge.relief)} freigegeben` : `up to ${m(o.merge.relief)} approved`,
      decided_register_retrieval: de ? `${m(o.register_retrieval.relief)} freigegeben` : `${m(o.register_retrieval.relief)} approved`,
      decided_keep: de ? "beibehalten, keine Entlastung" : "kept, no relief"
    },
    cut: { label: de ? "Gestrichene Meldepflichten" : "Reporting duties cut", of: de ? "von" : "of", note: de ? `Ziel: ein Drittel von ${n(F.reporting)}` : `target: a third of ${n(F.reporting)}` }
  };
  const evidence = {
    target: {
      label: de ? "Das Ziel von PflichtenLichten" : "The PflichtenLichten target",
      rows: [
        { share: "−⅓", name: de ? "Meldepflichten" : "Reporting duties", note: de ? "mindestens ein Drittel weniger" : "at least a third fewer" },
        { share: "−½", name: de ? "Dokumentationspflichten" : "Documentation duties", note: de ? "mindestens die Hälfte weniger" : "at least half fewer" }
      ],
      source: de ? "Beschlossen von Bund und Ländern in der Föderalen Modernisierungsagenda." : "Agreed by the federal and state governments in their joint modernisation agenda."
    },
    stage: [c1(de ? `${n(F.laws)} Vorschriften` : `${n(F.laws)} laws`, "laws")],
    meta: de
      ? parts`${n(F.acts)} Gesetze und ${n(F.ordinances)} Verordnungen · ${c1(`${n(F.paragraphs)} Paragrafen`, "laws")} · Stand ${longDate(F.retrieved, lang)}`
      : parts`${n(F.acts)} acts and ${n(F.ordinances)} ordinances · ${c1(`${n(F.paragraphs)} sections`, "laws")} · as of ${longDate(F.retrieved, lang)}`,
    columns: { law: de ? "Vorschrift" : "Law", duties: de ? "Pflichten" : "Duties", twice: de ? "in Bündeln" : "in clusters" },
    topic: (id, size) => (de ? `Thema: ${TOPICS[id][1]} · ${n(size)} ${size === 1 ? "Vorschrift" : "Vorschriften"}` : `Topic: ${TOPICS[id][0]} · ${n(size)} ${size === 1 ? "law" : "laws"}`),
    lawCount: (x, k) => (de ? `${n(x)} Pflichten, ${n(k)} in Bündeln` : `${n(x)} duties, ${n(k)} in clusters`),
    // The map's encodings in words (DR-02): the unit, the bar, the second column and each state.
    legend: {
      unit: de ? "Pflichten: in jeder Vorschrift gefunden" : "Duties: found in each law",
      bar: de ? `Balken: Pflichten gemessen an der größten Vorschrift (${n(Math.max(...F.D.norms.map((x) => x.duties)))})` : `bar: duties against the largest law (${n(Math.max(...F.D.norms.map((x) => x.duties)))})`,
      twice: de ? "in Bündeln: ihre Pflichten in einem Bündel" : "in clusters: its duties in a cluster",
      unread: de ? "gestrichelt: noch nicht gelesen" : "dashed: not read yet",
      reading: de ? "blau: wird gelesen" : "blue: being read",
      dim: de ? "blass: keine in einem Bündel" : "pale: none in a cluster",
      pick: de ? "A, B: die zwei bepreisten Vorschriften" : "A, B: the two laws priced",
      hl: de ? "lila: was die gewählte Zahl zählt" : "lilac: what the chosen count counts",
      selected: de ? "weinrot: die gewählte Vorschrift" : "merlot: the law you picked"
    },
    example: de ? `Eine der ${n(F.duties)} Pflichten` : `One of the ${n(F.duties)} duties`,
    law,
    chips: (mem) => [
      de ? "Meldepflicht" : "Reporting duty",
      de ? mem.addressee.de : mem.addressee.en,
      de ? mem.frequency.de : mem.frequency.en,
      de ? `an die ${mem.recipient.de.replace(/^statistische /, "statistischen ")}` : "to the statistical offices of the Länder"
    ],
    // The law's sentence, in German on every screen, says this; an English screen gives it in English.
    gloss: de ? null : "In English: businesses must answer these surveys.",
    twinGloss: de ? null : "In English, both say: businesses must answer these surveys.",
    official: de ? "Konsolidierte Fassung von gesetze-im-internet.de, nicht amtlich." : "Consolidated text from gesetze-im-internet.de, not the official version.",
    newTab: de ? "öffnet in einem neuen Tab" : "opens in a new tab",
    twin: de ? "Derselbe Satz in zwei Vorschriften" : "The same sentence in two laws",
    compare: de ? "Vergleich: wer, was, wie oft" : "Compare: who, what, how often",
    shared: de ? "In beiden gefragt" : "Asked in both",
    // Who carries the duty and how many (DR-07): the line a presenter reads out at steps 3 to 5.
    who: de
      ? parts`Wer: Unternehmen in beiden Erhebungen, bis zu ${c1(n(c.population.units), "derive:businesses")}: so viele Betriebe fragt die Produktionserhebung. Dass alle doppelt melden, ist angenommen. Monatlich, bis zu ${millionsWord(c.cases, lang)} Meldungen im Jahr.`
      : parts`Who: businesses in both surveys, up to ${c1(n(c.population.units), "derive:businesses")}: the sites the production survey asks. That all of them file both is assumed. Monthly, up to ${millionsWord(c.cases, lang)} reports a year.`,
    options: de ? "Entlastung pro Jahr, je Option" : "Relief a year, by option",
    where: de ? "Woher kommt diese Zahl?" : "Where does this figure come from?",
    option: {
      merge: { name: de ? "Zusammenlegen" : "Merge the two reports", detail: de ? `bis zu; eine Meldung mit ${minutes(F.mergedMinutes, lang)} ersetzt zwei mit ${minutes(F.minutes, lang)}` : `up to; one report of ${minutes(F.mergedMinutes, lang)} replaces two of ${minutes(F.minutes, lang)}` },
      register_retrieval: { name: de ? "Registerabruf" : "Take the data from the register", detail: de ? `Unternehmen ${m(F.registerBusinesses)}, Verwaltung −${m(F.registerAdmin)}, je gerundet; einmalig ${euros(F.oneOff, lang)}; simuliert` : `businesses ${m(F.registerBusinesses)}, administration −${m(F.registerAdmin)}, each rounded; ${euros(F.oneOff, lang)} once; simulated` },
      keep: { name: de ? "Beide behalten" : "Keep both", detail: null }
    },
    dossier: de ? "Entlastungsdossier (Entwurf)" : "Relief dossier (draft)",
    // What the dossier records, with the reports named in words.
    entry: {
      merge: de ? "Meldungen zu Handel und Produktion zusammenlegen" : `Merge ${reports}`,
      register_retrieval: de ? "Daten der Handelsmeldung aus dem Register abrufen" : "Take the trade report's data from the register",
      keep: de ? "Meldungen zu Handel und Produktion beibehalten" : `Keep ${reports}`
    },
    nothingSent: de ? "Nichts wird versendet." : "Nothing is sent.",
    approved: de ? "Freigegeben" : "Approved",
    kept: de ? "Entschieden" : "Decided",
    reason: (code) => REASONS[code][lang],
    gist: de ? null : "In English: ",
    keptText: de ? "Beide Meldungen bleiben, wie sie sind." : "Both reports stay as they are."
  };
  // How a law relates to the step on screen, said in the story when someone picks it on the map (DR-04).
  const pair = Object.fromEntries(c.members.map((mem, i) => [mem.norm, "AB"[i]]));
  const relation = (norm, index) => {
    const name = plain(lawName(norm.id, lang));
    const kind = norm.kind === "act" ? (de ? "ein Gesetz" : "an act") : (de ? "eine Verordnung" : "an ordinance");
    const rep = norm.byType.MELDEPFLICHT || 0;
    if (index === 0) return de ? `${name} ist ${kind}: ${n(norm.paragraphs)} Paragrafen, ${n(norm.sentences)} Sätze. Der Agent hat noch nichts davon gelesen.` : `${name} is ${kind}: ${n(norm.paragraphs)} sections, ${n(norm.sentences)} sentences. The agent hasn't read it yet.`;
    if (index === 1) return de ? `Der Agent markierte ${n(norm.candidates)} der ${n(norm.sentences)} Sätze in ${name} und behielt ${n(norm.duties)} als Pflichten, davon ${n(rep)} Meldepflichten.` : `The agent flagged ${n(norm.candidates)} of the ${n(norm.sentences)} sentences in ${name} and kept ${n(norm.duties)} as duties, ${n(rep)} of them reporting duties.`;
    if (pair[norm.id]) return de ? `${name} ist ${pair[norm.id]}: ${n(norm.clustered)} ihrer ${n(norm.duties)} Pflichten ${norm.clustered === 1 ? "steht" : "stehen"} in Bündeln, darunter die Monatsmeldung, die der Agent bepreist.` : `${name} is ${pair[norm.id]}: ${n(norm.clustered)} of its ${n(norm.duties)} duties ${norm.clustered === 1 ? "is" : "are"} in clusters, among them the monthly report the agent prices.`;
    if (!norm.clustered) return de ? `Keine der ${n(norm.duties)} Pflichten in ${name} steht in einem Bündel.` : `None of the ${n(norm.duties)} duties in ${name} is in a cluster.`;
    return de ? `${n(norm.clustered)} der ${n(norm.duties)} Pflichten in ${name} stehen in Bündeln; bepreist ist davon in diesem Lauf keine.` : `${n(norm.clustered)} of the ${n(norm.duties)} duties in ${name} are in clusters; none of them is priced in this run.`;
  };
  return {
    lang, steps, ask, decided, kpi, evidence, relation, pair, lawsWord,
    item: (id) => itemName(id, lang), money: (x) => money(x, lang), n, m, minutes: (x) => minutes(x, lang), date: longDate(F.retrieved, lang)
  };
}

/** A topic area by name; long German compounds may break before their last part (Produkt-verantwortung). */
export const familyName = (f, lang) => (lang === "de" ? f.de.replace(/(?<=\p{L}{4})(statistik|verantwortung|recht)$/u, "­$1") : f.en);
