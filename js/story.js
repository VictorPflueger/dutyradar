// The five steps and every sentence they say, in English and German, with the figures filled in from
// data/story.js (computed by release 1.0.0's engines). Pure: no DOM, so Node tests import it as it is.

import { count, millions, money, euros, millionsWord, minutes, longDate, legal } from "./format.js";

export const STEP_IDS = ["target", "reads", "twice", "prices", "decide"];
export const CHOICES = ["merge", "register_retrieval", "keep"];
/** PflichtenLichten: at least a third fewer reporting duties, at least half fewer documentation duties. */
export const TARGET = { reporting: 1 / 3, documentation: 1 / 2 };

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
    "report-cost": m(F.reportCost), "cluster-cost": m(F.clusterCost),
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
 * What the three key figures show at step `index` (0 to 4) with progress p toward the next step, and
 * the decision taken (null, or one of CHOICES). Numbers only; words() names them. `was` is the value
 * before a decision moved the figure, which the tile keeps struck through (Vici's vc-stat__was).
 */
export function kpisAt(F, index, p, decision) {
  const reading = index === 0 ? readingAt(F, p) : null;
  const read = index >= 1;
  const duties = read ? F.duties : reading.found;
  const dutiesNote = index >= 2 || (index === 1 && p >= 0.5) ? "twice" : read ? "split" : "laws";
  const priced = index >= 3 || (index === 2 && p >= 0.6);
  const decided = index === 4 && decision ? F.outcome[decision] : null;
  return {
    duties: { value: duties, note: dutiesNote },
    relief: { value: decided ? decided.relief : 0, was: decided && decided.relief !== 0 ? 0 : null, note: decided ? `decided_${decision}` : priced ? "proposed" : "none", done: Boolean(decided && decided.relief > 0) },
    cut: { value: decided ? decided.reporting.removed : 0, was: decided && decided.reporting.removed !== 0 ? 0 : null, of: read || (index === 0 && p >= 1) ? F.target : null, note: read ? "of" : "target" }
  };
}

/** Every sentence of the page in one language, with the figures filled in. */
export function words(F, lang) {
  const de = lang === "de";
  const n = (x) => count(x, lang);
  const m = (x) => millions(x, lang);
  const sec = (i) => legal(`${F.D.cluster.members[i].section} ${F.D.cluster.members[i].abbr} `).trim();
  const lead = sec(0);
  const steps = {
    target: {
      label: de ? "Das Ziel" : "The target",
      hint: de ? `${n(F.laws)} Gesetze` : `${n(F.laws)} laws`,
      title: de ? `${n(F.laws)} Gesetze, ein Ziel: ein Drittel weniger Meldepflichten` : `${n(F.laws)} laws, one target: a third fewer reporting duties`,
      text: de
        ? `Mit PflichtenLichten wollen Bund und Länder mindestens ein Drittel der Meldepflichten und die Hälfte der Dokumentationspflichten streichen. Der Agent liest ${n(F.laws)} Bundesgesetze und findet, wo man anfängt.`
        : `Under PflichtenLichten, the federal and state governments want at least a third fewer reporting duties and half the documentation duties. The agent reads ${n(F.laws)} federal laws to find where to start.`,
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
        ? `Der Agent markiert ${n(F.candidates)} Sätze und behält ${n(F.duties)} Pflichten: ${n(F.reporting)} Melde-, ${n(F.documentation)} Dokumentations- und ${n(F.others)} andere Pflichten. Jede behält ihren Satz und Paragrafen, etwa ${lead}.`
        : `The agent flags ${n(F.candidates)} sentences and keeps ${n(F.duties)} duties: ${n(F.reporting)} reporting, ${n(F.documentation)} documentation and ${n(F.others)} of other kinds. Each keeps its sentence and section, such as ${lead}.`,
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
        : `${n(F.clustered)} duties ask for data another duty already collects, in ${n(F.clusters)} clusters. The most promising: ${n(F.businesses)} businesses (assumed) report the same ${n(F.sharedCount)} items twice every month.`,
      agent: de ? `Bündel ${F.D.cluster.id}: zwei Monatsmeldungen, dieselben ${n(F.sharedCount)} Angaben.` : `Cluster ${F.D.cluster.id}: two monthly reports, the same ${n(F.sharedCount)} items.`,
      ask: de ? "Lassen Sie den Agenten die Optionen bepreisen." : "Let the agent price the options."
    },
    prices: {
      label: de ? "Er bepreist" : "It prices",
      hint: de ? `${m(F.merge)} im Jahr` : `${m(F.merge)} a year`,
      title: de ? `Eine Meldung statt zwei spart ${m(F.merge)} im Jahr` : `One report instead of two saves ${m(F.merge)} a year`,
      text: de
        ? `Der Agent bepreist drei Optionen nach der Methode des Bundes zum Erfüllungsaufwand. Die Entlastung pro Jahr bleibt bei ${money(0, lang)}, bis ein Mensch eine freigibt.`
        : `The agent prices three options with the federal compliance-cost method. Relief a year stays at ${money(0, lang)} until a person approves one.`,
      agent: de
        ? `Mein erster Entwurf nannte eine Frist von ${F.D.check.tokens[0]} Tagen ohne Quelle. Der Faktenprüfer blockierte sie, ich habe sie gestrichen.`
        : `My first draft named a deadline of ${F.D.check.tokens[0]} days without a source. The fact checker blocked it, and I redrafted without it.`,
      ask: de ? "Entscheiden Sie, was ins Dossier kommt." : "Decide what goes into the dossier."
    },
    decide: {
      label: de ? "Sie entscheiden" : "You decide",
      hint: de ? "das Dossier" : "the dossier",
      title: de ? "Sie entscheiden, was ins Dossier kommt" : "You decide what goes into the dossier",
      text: de
        ? "Der Agent schlägt vor, ein Mensch entscheidet. Nur eine Freigabe kommt ins Entlastungsdossier, mit einem Entwurf für die Legistik. Nichts wird versendet."
        : "The agent proposes, a person decides. Only an approval enters the relief dossier, with draft wording for the legal drafters. Nothing is sent.",
      agent: de ? `Die Optionen für Bündel ${F.D.cluster.id} liegen zur Entscheidung vor.` : `The options for cluster ${F.D.cluster.id} are ready for your decision.`,
      ask: de ? "Geben Sie eine Option frei oder behalten Sie beide." : "Approve one option or keep both."
    }
  };
  // The ask bar's lead words: what the page waits for, said where the eye is.
  const ask = { move: de ? "Sie sind dran:" : "Your move:", decision: de ? "Ihre Entscheidung:" : "Your decision:", working: de ? "Der Agent arbeitet." : "The agent is at work.", pause: de ? "Pause" : "Pause" };
  const reason = (type) => { const r = F.option[type].reason; return `${r.code} ${de ? r.de : r.en.toLowerCase()}`; };
  const o = F.outcome;
  const outcome = {
    merge: de
      ? `Freigegeben: Zusammenlegen, Begründung ${reason("merge")}. ${m(o.merge.relief)} Entlastung im Jahr und eine Meldepflicht weniger, ${n(o.merge.reporting.removed)} der ${n(F.target)}, die das Ziel verlangt. ${n(F.waiting)} weitere Bündel warten.`
      : `Approved: merge, reason ${reason("merge")}. ${m(o.merge.relief)} a year of relief and one reporting duty fewer, ${n(o.merge.reporting.removed)} of the ${n(F.target)} the target asks for. ${n(F.waiting)} more clusters are waiting.`,
    register_retrieval: de
      ? `Freigegeben: Registerabruf, Begründung ${reason("register_retrieval")}. Die Betriebe sparen ${m(F.registerBusinesses)} im Jahr, die Verwaltung wendet ${m(F.registerAdmin)} auf, netto ${m(o.register_retrieval.relief)}, dazu einmalig ${euros(F.oneOff, lang)}. Eine Meldepflicht weniger, ${n(o.register_retrieval.reporting.removed)} von ${n(F.target)}. ${n(F.waiting)} weitere Bündel warten.`
      : `Approved: register retrieval, reason ${reason("register_retrieval")}. Businesses save ${m(F.registerBusinesses)} a year and the administration spends ${m(F.registerAdmin)}, ${m(o.register_retrieval.relief)} net, plus ${euros(F.oneOff, lang)} once. One reporting duty fewer, ${n(o.register_retrieval.reporting.removed)} of ${n(F.target)}. ${n(F.waiting)} more clusters are waiting.`,
    keep: de
      ? `Beibehalten: Beide Meldungen bleiben, Begründung ${reason("keep")}. Keine Entlastung, das Dossier hält den Grund fest. ${n(F.waiting)} weitere Bündel warten.`
      : `Kept: both reports stay, reason ${reason("keep")}. No relief, and the dossier records why. ${n(F.waiting)} more clusters are waiting.`
  };
  const kpi = {
    duties: {
      label: de ? "Gefundene Pflichten" : "Duties found",
      laws: de ? `in ${n(F.laws)} Gesetzen` : `in ${n(F.laws)} laws`,
      split: de ? `davon ${n(F.reporting)} Meldepflichten` : `${n(F.reporting)} of them reporting`,
      twice: de ? `${n(F.clustered)} doppelt gefragt` : `${n(F.clustered)} asked twice`
    },
    relief: {
      label: de ? "Entlastung pro Jahr" : "Relief a year",
      none: de ? "bisher freigegeben" : "approved so far",
      proposed: de ? `${m(F.merge)} vorgeschlagen` : `${m(F.merge)} proposed`,
      decided_merge: de ? "Zusammenlegen freigegeben" : "merge approved",
      decided_register_retrieval: de ? "Registerabruf freigegeben, netto" : "register retrieval approved, net",
      decided_keep: de ? "beibehalten" : "kept, no relief"
    },
    cut: {
      label: de ? "Gestrichene Meldepflichten" : "Reporting duties cut",
      of: de ? "von" : "of",
      target: de ? "Ziel: ein Drittel weniger" : "target: a third fewer",
      ofNote: de ? `ein Drittel von ${n(F.reporting)}` : `a third of ${n(F.reporting)}`
    }
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
      read: de ? "Pflichten gefunden" : "duties found",
      dim: de ? "keine doppelte Abfrage" : "nothing asked twice",
      pick: de ? "Auswahl des Agenten" : "the agent's pick"
    },
    example: de ? `Eine der ${n(F.duties)} Pflichten` : `One of the ${n(F.duties)} duties`,
    chips: (mem) => [
      de ? "Meldepflicht" : "Reporting duty",
      de ? mem.addressee.de : mem.addressee.en,
      de ? mem.frequency.de : mem.frequency.en,
      de ? `an die ${mem.recipient.de.replace(/^statistische /, "statistischen ")}` : `to ${mem.recipient.en}`
    ],
    official: de ? "Konsolidierte Fassung von gesetze-im-internet.de, nicht amtlich." : "Consolidated text from gesetze-im-internet.de, not the official version.",
    newTab: de ? "öffnet in einem neuen Tab" : "opens in a new tab",
    twin: de ? "Derselbe Satz in zwei Gesetzen" : "The same sentence in two laws",
    perMember: (mem) => (de ? `${n(mem.cases)} Meldungen im Jahr` : `${n(mem.cases)} reports a year`),
    shared: de ? "In beiden gefragt" : "Asked in both",
    together: de ? `Zusammen ${n(c.cases)} Meldungen im Jahr, die ${m(c.cost)} kosten` : `Together ${n(c.cases)} reports a year, costing businesses ${m(c.cost)}`,
    options: de ? "Entlastung pro Jahr, je Option" : "Relief a year, by option",
    option: {
      merge: { name: de ? "Zusammenlegen" : "Merge the two reports", detail: de ? `eine Meldung mit ${minutes(F.mergedMinutes, lang)} statt zwei mit ${minutes(F.minutes, lang)}` : `one report of ${minutes(F.mergedMinutes, lang)} instead of two of ${minutes(F.minutes, lang)}` },
      register_retrieval: { name: de ? "Registerabruf" : "Take the data from the register", detail: de ? `Betriebe ${m(F.registerBusinesses)}, Verwaltung −${m(F.registerAdmin)}, einmalig ${euros(F.oneOff, lang)}, Register simuliert` : `businesses ${m(F.registerBusinesses)}, administration −${m(F.registerAdmin)}, ${euros(F.oneOff, lang)} once, register simulated` },
      keep: { name: de ? "Beide behalten" : "Keep both", detail: de ? "keine Änderung" : "no change" }
    },
    dossier: de ? "Entlastungsdossier (Entwurf)" : "Relief dossier (draft)",
    nothingSent: de ? "Nichts wird versendet." : "Nothing is sent.",
    approved: de ? "Freigegeben" : "Approved",
    kept: de ? "Beibehalten" : "Kept",
    gist: de ? null : "In English: ",
    keptText: de ? "Beide Meldungen bleiben. Keine Entlastung; das Dossier hält die Begründung fest." : "Both reports stay. No relief; the dossier records the reason.",
    dutyFewer: de ? "eine Meldepflicht weniger" : "one reporting duty fewer",
    perYear: de ? "im Jahr" : "a year"
  };
  return { lang, steps, ask, outcome, kpi, evidence, item: (id) => ITEMS[id][lang], money: (x) => money(x, lang), n, m, minutes: (x) => minutes(x, lang), date: longDate(F.retrieved, lang) };
}

/** A family of laws by name. German names may break before their last part (Produkt-verantwortung), so
 *  the names' column stays as narrow as the English one and the law map keeps its columns. */
export const familyName = (f, lang) => (lang === "de" ? f.de.replace(/(?<=\p{L}{4})(statistik|verantwortung|recht)$/u, "\u00ad$1") : f.en);

/** Short names for the data items the cluster's reports ask for (1.0.0's vocabulary ids). */
export const ITEMS = {
  unternehmensstammdaten: { en: "Company data", de: "Stammdaten" },
  beschaeftigte: { en: "Persons employed", de: "Beschäftigte" },
  umsatz: { en: "Turnover", de: "Umsatz" },
  branche: { en: "Sector", de: "Branche" },
  produktion: { en: "Production", de: "Produktion" }
};
