// The five steps and every sentence they say, in English and German, with the figures filled in from
// data/story.js (computed by release 1.0.0's engines). Pure: no DOM, so Node tests import it as it is.
// It is also the one place that turns the data's ids into words (Vici, Names, not record ids).

import { count, millions, money, euros, millionsWord, minutes, longDate } from "./format.js";

export const STEP_IDS = ["target", "reads", "twice", "prices", "decide"];
export const CHOICES = ["merge", "register_retrieval", "keep"];
/** PflichtenLichten: at least a third fewer reporting duties, at least half fewer documentation duties. */
export const TARGET = { reporting: 1 / 3, documentation: 1 / 2 };

/** Names in words for the records the screen talks about; their ids stay in data/story.js. */
export const NAMES = {
  "C-046": { en: "the trade and production reports", de: "die Meldungen zu Handel und Produktion" },
  hdldlstatg: { en: "Trade and services statistics", de: "Handels- und Dienstleistungsstatistik" },
  prodgewstatg: { en: "Production statistics", de: "Produktionsstatistik" }
};
export function nameOf(id, lang) {
  if (!NAMES[id]) throw new Error(`No name in words for ${id}`);
  return NAMES[id][lang];
}
/** 1.0.0's reason codes as the screen says them: the reason, never the code. */
export const REASONS = {
  Z1: { en: "because both ask for the same data", de: "weil beide dieselben Daten abfragen" },
  Z2: { en: "because the register holds the data", de: "weil das Register die Daten führt" },
  A3: { en: "because the department needs both", de: "weil das Fachressort beide braucht" }
};

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
    paragraphs: D.slice.paragraphs,
    sentences: D.slice.sentences,
    retrieved: D.slice.retrieved,
    candidates: t.candidates,
    duties: t.duties,
    reporting,
    documentation,
    others: t.duties - reporting - documentation,
    clusters: t.clusters,
    clustered: t.clustered,
    waiting: t.clusters - 1,
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
  return {
    laws: n(F.laws), paragraphs: n(F.paragraphs), sentences: n(F.sentences), candidates: n(F.candidates),
    duties: n(F.duties), reporting: n(F.reporting), documentation: n(F.documentation), others: n(F.others),
    clusters: n(F.clusters), clustered: n(F.clustered), waiting: n(F.waiting), target: n(F.target), "doc-target": n(F.docTarget),
    businesses: n(F.businesses), "per-year": n(F.perYear), minutes: minutes(F.minutes, lang), "merged-minutes": minutes(F.mergedMinutes, lang),
    wage: euros(F.wage, lang, 2), "admin-wage": euros(F.adminWage, lang, 2), material: euros(F.material, lang, 2),
    "admin-minutes": minutes(F.adminMinutes, lang), "one-off": euros(F.oneOff, lang),
    "cases-each": n(F.casesEach), cases: n(F.cases), "cases-words": millionsWord(F.cases, lang),
    "report-cost": m(F.reportCost), "cluster-cost": m(F.clusterCost), stake: m(F.stake),
    merge: m(F.merge), register: m(F.register), "register-businesses": m(F.registerBusinesses), "register-admin": m(F.registerAdmin),
    "merge-left": m(F.clusterCost - F.merge), retrieved: longDate(F.retrieved, lang), token: F.D.check.tokens[0],
    removed: n(F.outcome.merge.reporting.removed)
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
 */
export function kpisAt(F, index, decision) {
  const decided = index === STEP_IDS.length - 1 && CHOICES.includes(decision) ? decision : null;
  const out = decided ? F.outcome[decided] : null;
  const taken = Boolean(out && out.relief > 0);
  return {
    twice: { value: F.clustered, of: F.duties },
    stake: { value: taken ? 0 : F.stake, was: taken ? F.stake : null, note: decided ? `decided_${decided}` : "pending", done: taken },
    cut: { value: out ? out.reporting.removed : 0, was: out && out.reporting.removed ? 0 : null, of: F.target }
  };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Every sentence of the page in one language, with the figures filled in. */
export function words(F, lang) {
  const de = lang === "de";
  const n = (x) => count(x, lang);
  const m = (x) => millions(x, lang);
  const o = F.outcome;
  const reports = nameOf(F.D.cluster.id, lang);
  const law = (mem) => nameOf(mem.norm, lang);
  const steps = {
    target: {
      label: de ? "Das Ziel" : "The target",
      hint: de ? `${n(F.laws)} Gesetze` : `${n(F.laws)} laws`,
      title: de ? `${n(F.laws)} Gesetze, ein Ziel: ein Drittel weniger Meldepflichten` : `${n(F.laws)} laws, one target: a third fewer reporting duties`,
      text: de
        ? `PflichtenLichten heißt der Plan von Bund und Ländern, Betrieben Pflichten abzunehmen. Der Agent liest ${n(F.laws)} Bundesgesetze und findet, wo man anfängt.`
        : `PflichtenLichten is the federal and state governments' plan to take duties off businesses. The agent reads ${n(F.laws)} federal laws to find where to start.`,
      agent: de
        ? `Mein Plan: die ${n(F.laws)} Gesetze lesen, jede Pflicht finden, Pflichten mit denselben Daten suchen, die vielversprechendste Überschneidung bepreisen und Entlastung vorschlagen.`
        : `My plan: read the ${n(F.laws)} laws, find every duty, look for duties that ask for the same data, price the most promising overlap and propose relief.`,
      ask: de ? `Lassen Sie den Agenten die ${n(F.laws)} Gesetze lesen.` : `Let the agent read the ${n(F.laws)} laws.`
    },
    reads: {
      label: de ? "Er liest" : "It reads",
      hint: de ? `${n(F.duties)} Pflichten` : `${n(F.duties)} duties`,
      title: de ? `${n(F.duties)} Pflichten in ${n(F.sentences)} Sätzen` : `${n(F.duties)} duties in ${n(F.sentences)} sentences`,
      text: de
        ? `Der Agent markiert ${n(F.candidates)} Sätze und behält ${n(F.duties)} Pflichten, davon ${n(F.reporting)} Meldepflichten. Zu jeder gehören der Satz und der Paragraf, in dem sie steht.`
        : `The agent flags ${n(F.candidates)} sentences and keeps ${n(F.duties)} duties, ${n(F.reporting)} of them reporting duties. Each comes with the sentence and section it was found in.`,
      agent: de
        ? "Das Inventar steht. Jetzt suche ich Pflichten, die dieselben Betriebe nach denselben Daten fragen."
        : "Inventory complete. Now I look for duties that ask the same businesses for the same data.",
      ask: de ? "Sehen Sie, welche Pflichten dieselben Daten doppelt abfragen." : "See which duties ask for the same data twice."
    },
    twice: {
      label: de ? "Doppelt gefragt" : "Asked twice",
      hint: de ? `${n(F.clusters)} Bündel` : `${n(F.clusters)} clusters`,
      title: de ? "Zwei Gesetze fragen dieselben Betriebe dasselbe" : "Two laws ask the same businesses for the same data",
      text: de
        ? `${n(F.clustered)} Pflichten erfragen Daten, die eine andere schon erhebt, in ${n(F.clusters)} Bündeln. Am vielversprechendsten: ${n(F.businesses)} Betriebe (angenommen) melden monatlich zweimal dieselben ${n(F.sharedCount)} Angaben.`
        : `${n(F.clustered)} duties ask for data another duty already collects, in ${n(F.clusters)} clusters. Most promising: ${n(F.businesses)} businesses (assumed) send the same ${n(F.sharedCount)} items twice a month.`,
      agent: de
        ? `${cap(reports)} fragen dieselben ${n(F.sharedCount)} Angaben ab.`
        : `${cap(reports)} ask for the same ${n(F.sharedCount)} items.`,
      ask: de ? "Lassen Sie den Agenten die Optionen bepreisen." : "Let the agent price the options."
    },
    prices: {
      label: de ? "Er bepreist" : "It prices",
      hint: de ? `${m(F.merge)} im Jahr` : `${m(F.merge)} a year`,
      title: de ? `Eine Meldung statt zwei spart ${m(F.merge)} im Jahr` : `One report instead of two saves ${m(F.merge)} a year`,
      text: de
        ? "Der Agent bepreist drei Optionen nach dem Leitfaden zum Erfüllungsaufwand. Die Entlastung bleibt offen, bis ein Mensch freigibt."
        : "The agent prices three options with the federal method for costing red tape. The relief stays at stake until a person approves one.",
      agent: de
        ? `Meine erste Formulierungshilfe nannte eine Frist von ${F.D.check.tokens[0]} Tagen ohne Quelle. Der Faktenprüfer blockierte sie, ich nahm sie heraus.`
        : `My first draft of the law change named a deadline of ${F.D.check.tokens[0]} days without a source. The fact checker blocked it, and I took it out.`,
      ask: de ? "Entscheiden Sie, was ins Dossier kommt." : "Decide what goes into the dossier."
    },
    decide: {
      label: de ? "Sie entscheiden" : "You decide",
      hint: de ? "das Dossier" : "the dossier",
      title: de ? "Sie entscheiden, was ins Dossier kommt" : "You decide what goes into the dossier",
      text: de
        ? "Der Agent schlägt vor, ein Mensch entscheidet. Nur eine Freigabe kommt ins Dossier, mit einer Formulierungshilfe. Nichts wird versendet."
        : "The agent proposes, a person decides. Only an approval enters the relief dossier, with draft wording for the law change. Nothing is sent.",
      agent: de ? `Die Optionen für ${reports} liegen zur Entscheidung vor.` : `The options for ${reports} are ready for your decision.`,
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
      title: de ? `Freigegeben: Die Betriebe sparen ${m(o.merge.relief)} im Jahr` : `Approved: businesses save ${m(o.merge.relief)} a year`,
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
    twice: { label: de ? "Doppelt gefragt" : "Asked twice", of: de ? "von" : "of", note: de ? `Pflichten in ${n(F.laws)} Gesetzen` : `duties in ${n(F.laws)} laws` },
    stake: {
      label: de ? "Offene Entlastung pro Jahr" : "Relief at stake a year",
      pending: de ? "bis ein Mensch freigibt" : "if a person approves the merge",
      decided_merge: de ? "Zusammenlegen freigegeben" : "merge approved",
      decided_register_retrieval: de ? "Registerabruf freigegeben" : "register lookup approved",
      decided_keep: de ? "beibehalten, keine Entlastung" : "kept, no relief"
    },
    cut: { label: de ? "Gestrichene Meldepflichten" : "Reporting duties cut", of: de ? "von" : "of", note: de ? `Ziel: ein Drittel von ${n(F.reporting)}` : `target: a third of ${n(F.reporting)}` }
  };
  const c = F.D.cluster;
  const evidence = {
    target: {
      label: de ? "Das Ziel von PflichtenLichten" : "The PflichtenLichten target",
      rows: [
        { share: "−⅓", name: de ? "Meldepflichten" : "Reporting duties", note: de ? "mindestens ein Drittel weniger" : "at least a third fewer" },
        { share: "−½", name: de ? "Dokumentationspflichten" : "Documentation duties", note: de ? "mindestens die Hälfte weniger" : "at least half fewer" }
      ],
      source: de ? "Beschlossen von Bund und Ländern in der Föderalen Modernisierungsagenda." : "Agreed by the federal and state governments in their joint modernisation agenda."
    },
    stage: de ? `${n(F.laws)} Bundesgesetze` : `${n(F.laws)} federal laws`,
    meta: de
      ? `${n(F.paragraphs)} Paragrafen, ${n(F.sentences)} Sätze, Stand ${longDate(F.retrieved, lang)}`
      : `${n(F.paragraphs)} paragraphs, ${n(F.sentences)} sentences, as of ${longDate(F.retrieved, lang)}`,
    legend: {
      unread: de ? "noch nicht gelesen" : "not read yet",
      reading: de ? "wird gelesen" : "being read",
      read: de ? "Pflichten je Gesetz" : "duties in each law",
      dim: de ? "keine doppelte Abfrage" : "nothing asked twice",
      pick: de ? "Auswahl des Agenten" : "the agent's pick"
    },
    example: de ? `Eine der ${n(F.duties)} Pflichten` : `One of the ${n(F.duties)} duties`,
    law,
    chips: (mem) => [
      de ? "Meldepflicht" : "Reporting duty",
      de ? mem.addressee.de : mem.addressee.en,
      de ? mem.frequency.de : mem.frequency.en,
      de ? `an die ${mem.recipient.de.replace(/^statistische /, "statistischen ")}` : "to the statistical offices of the federal states"
    ],
    // The law's sentence, in German on every screen, says this; an English screen gives it in English.
    gloss: de ? null : "In English: businesses must answer these surveys.",
    twinGloss: de ? null : "In English, both say: businesses must answer these surveys.",
    official: de ? "Konsolidierte Fassung von gesetze-im-internet.de, nicht amtlich." : "Consolidated text from gesetze-im-internet.de, not the official version.",
    newTab: de ? "öffnet in einem neuen Tab" : "opens in a new tab",
    twin: de ? "Derselbe Satz in zwei Gesetzen" : "The same sentence in two laws",
    shared: de ? "In beiden gefragt" : "Asked in both",
    together: de ? `Zusammen ${millionsWord(c.cases, lang)} Meldungen im Jahr, die ${m(c.cost)} kosten` : `Together ${millionsWord(c.cases, lang)} reports a year, costing businesses ${m(c.cost)}`,
    options: de ? "Entlastung pro Jahr, je Option" : "Relief a year, by option",
    option: {
      merge: { name: de ? "Zusammenlegen" : "Merge the two reports", detail: de ? `eine Meldung mit ${minutes(F.mergedMinutes, lang)} ersetzt zwei mit ${minutes(F.minutes, lang)}: ${m(F.clusterCost)} sinken auf ${m(F.clusterCost - F.merge)}` : `one report of ${minutes(F.mergedMinutes, lang)} replaces two of ${minutes(F.minutes, lang)}: ${m(F.clusterCost)} falls to ${m(F.clusterCost - F.merge)}` },
      register_retrieval: { name: de ? "Registerabruf" : "Take the data from the register", detail: de ? `Betriebe ${m(F.registerBusinesses)}, Verwaltung −${m(F.registerAdmin)}, einmalig ${euros(F.oneOff, lang)}; Register simuliert, muss aktuell sein` : `businesses ${m(F.registerBusinesses)}, administration −${m(F.registerAdmin)}, ${euros(F.oneOff, lang)} once; register simulated, must be up to date` },
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
  return { lang, steps, ask, decided, kpi, evidence, item: (id) => ITEMS[id][lang], money: (x) => money(x, lang), n, m, minutes: (x) => minutes(x, lang), date: longDate(F.retrieved, lang) };
}

/** A family of laws by name. German names may break before their last part (Produkt-verantwortung), so
 *  the names' column stays as narrow as the English one and the law map keeps its columns. */
export const familyName = (f, lang) => (lang === "de" ? f.de.replace(/(?<=\p{L}{4})(statistik|verantwortung|recht)$/u, "­$1") : f.en);

/** Short names for the data items the cluster's reports ask for (1.0.0's vocabulary ids). */
export const ITEMS = {
  unternehmensstammdaten: { en: "Company data", de: "Stammdaten" },
  beschaeftigte: { en: "Persons employed", de: "Beschäftigte" },
  umsatz: { en: "Turnover", de: "Umsatz" },
  branche: { en: "Sector", de: "Branche" },
  produktion: { en: "Production", de: "Produktion" }
};
