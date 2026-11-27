// The words of what opens beside the story, in English and German: the ladder of terms (DR-01), the lists
// behind every count (DR-03), the comparison of the two duties (DR-05) and the derivation of every euro
// (DR-06). Every figure comes from data/story.js, where 1.0.0's engines put it. Pure: no DOM, so the Node
// tests check these words as the page shows them.

import { count, millions, euros, minutes, longDate, legal } from "./format.js";
import { lawName, plain, typeName, TYPE_ORDER, addresseeName, dueName, recipientName, itemName, nameOf } from "./story.js";

const DE = (lang) => lang === "de";
/** A number with up to `d` decimals, in the page's language. */
const num = (x, lang, d = 0) => new Intl.NumberFormat(DE(lang) ? "de-DE" : "en-GB", { maximumFractionDigits: d }).format(x);

/** Every sentence of the panels in one language. */
export function explain(F, lang) {
  const de = DE(lang);
  const D = F.D;
  const n = (x) => count(x, lang);
  const m = (x) => millions(x, lang);
  const eur = (x) => euros(x, lang, 2);
  const c = D.cluster;
  const [A, B] = c.members;
  const law = (id) => plain(lawName(id, lang));
  const byType = D.totals.byType;

  // ---- the ladder: one rung per term, from law to decision ----------------------------------------------
  const rung = (id, value, term, def, open, steps, extra = {}) => ({ id, value, count: n(value), term, def, open, steps, ...extra });
  const ladder = [
    rung("laws", F.laws, de ? "Vorschriften" : "laws", de ? `${n(F.acts)} Gesetze und ${n(F.ordinances)} Verordnungen, für diese Demo von Hand gewählt aus fünf Themen mit vielen Meldungen der Wirtschaft.` : `${n(F.acts)} acts and ${n(F.ordinances)} ordinances, chosen by hand for this demo from five topic areas full of business reporting.`, "laws", [0], { dfn: "law" }),
    rung("sections", F.paragraphs, de ? "Paragrafen" : "sections", de ? "Die nummerierten Paragrafen (§) dieser Vorschriften." : "The numbered sections (§) of those laws.", "laws", [0], { dfn: "section" }),
    rung("sentences", F.sentences, de ? "Sätze" : "sentences", de ? "Jeder Satz dieser Paragrafen. Der Agent liest jeden." : "Every sentence of those sections. The agent reads each one.", "laws", [0, 1], { dfn: "sentence" }),
    rung("flagged", F.candidates, de ? "markierte Sätze" : "sentences flagged", de ? "Ein Muster findet im selben Satz ein Pflichtwort und ein Signal wie „muss“ oder „verpflichtet“." : "A pattern finds a duty word and a marker such as “muss” or “verpflichtet” in the same sentence.", "flagged", [1]),
    rung("duties", F.duties, de ? "Pflichten" : "duties", de ? "Markierte Sätze, die der Agent bestätigt: Eine Vorschrift verlangt von jemandem etwas." : "Flagged sentences the agent confirms: a law makes someone do something.", "duties", [1],
      { dfn: "duty", sub: [{ value: F.rejected, text: de ? `${n(F.rejected)} verworfen` : `${n(F.rejected)} discarded`, open: "discarded" }] }),
    rung("types", F.reporting, de ? "Meldepflichten" : "reporting duties", de ? "Eine Art von Pflicht: einer Behörde etwas melden. Das Ziel kürzt sie um ein Drittel, Dokumentationspflichten um die Hälfte." : "One type of duty: report something to an authority. The target cuts them by a third, documentation duties by half.", "duties:MELDEPFLICHT", [1],
      { dfn: "reporting", sub: TYPE_ORDER.map((t) => ({ value: byType[t], text: `${n(byType[t])} ${typeName(t, lang, byType[t] !== 1)}`, open: `duties:${t}` })) }),
    rung("clusters", F.clusters, de ? "Bündel" : "clusters", de ? "Pflichten aus zwei Vorschriften oder an zwei Empfänger, die laut Agent dieselben Adressaten nach sich überschneidenden Angaben fragen. Verglichen werden nur Pflichten mit demselben Adressaten und derselben Grundgesamtheit, gleich welcher Art." : "Duties from two laws or to two recipients that the agent judged to ask the same addressees for overlapping items. It compares only duties with the same addressee and the same population, whatever their type.", "clusters", [2],
      { dfn: "cluster", note: { term: "item", word: de ? "Angabe" : "Item", text: de ? "ein Stück Daten, nach dem eine Pflicht fragt, etwa der Umsatz." : "one piece of data a duty asks for, such as turnover." }, sub: [{ value: F.clustered, text: de ? `${n(F.clustered)} Pflichten stehen darin` : `${n(F.clustered)} duties sit in them`, open: "clusters:duties" }] }),
    rung("priced", F.priced, de ? "Bündel bepreist" : "cluster priced", de ? `Das vielversprechendste: ${n(F.pricedDuties)} Meldepflichten, ${law(A.norm)} ${A.section} und ${law(B.norm)} ${B.section}.` : `The most promising: ${n(F.pricedDuties)} reporting duties, ${law(A.norm).toLowerCase()} ${A.section} and ${law(B.norm).toLowerCase()} ${B.section}.`, "compare", [2, 3]),
    rung("options", F.options, de ? "Optionen" : "options", de ? "Beide Meldungen zusammenlegen, die Daten aus dem Register abrufen oder beide behalten; jede nach der Methode des Bundes bepreist." : "Merge the two reports, take the data from the register, or keep both; each priced by the federal method.", "options", [3]),
    rung("decision", 1, de ? "Entscheidung" : "decision", de ? "Ein Mensch gibt eine Option frei oder behält beide, mit Begründung. Nichts wird versendet." : "A person approves one option or keeps both, with a reason. Nothing is sent.", "decide", [4])
  ];

  // ---- the lists -------------------------------------------------------------------------------------------
  const lists = {
    note: de
      ? "Konsolidierte Fassung, nicht amtlich. Die Lesarten des Agenten stammen in diesem nachgespielten Lauf aus festen Regeln, und manche sind falsch, etwa eine Pflicht einer Behörde als Pflicht der Wirtschaft gelesen. Prüfen Sie jede selbst."
      : "Consolidated text, not the official version. In this replay the agent's readings come from fixed rules, and some are wrong: a duty of an authority read as one of businesses, for one. Check each with your own eyes.",
    filters: { all: de ? "Alle" : "All", type: de ? "Art" : "Type", who: de ? "Wer" : "Who", law: de ? "Vorschrift" : "Law", allLaws: de ? "Alle Vorschriften" : "All laws", kept: de ? "als Pflicht behalten" : "kept as duties", gone: de ? "verworfen" : "discarded", status: de ? "Ergebnis" : "Result" },
    agent: (d) => (de ? `${typeName(d.type, lang)} der ${d.addressee === "verwaltung" ? "Verwaltung" : "Wirtschaft"}, ${dueName(d, lang)}` : `${typeName(d.type, lang)} of ${addresseeName(d.addressee, lang)}, ${dueName(d, lang)}`),
    discardedReading: de ? "Eine Befugnis oder ein Verweis, keine eigene Pflicht." : "A power or a cross-reference, not a duty of its own.",
    asks: de ? "Fragt nach" : "Asks for",
    population: (p, units, capped) => `${de ? "Betroffen" : "Who carries it"}: ${(de ? p.de : p.en).replace(/^./, (ch) => (de ? ch : ch.toLowerCase()))}, ${capped ? (de ? `höchstens ${n(units)} nach amtlichen Zählungen` : `at most ${n(units)} by public counts`) : `${n(units)}, ${de ? "angenommen" : "assumed"}`}`,
    inCluster: (size, laws, priced) => (de
      ? `Im Bündel mit ${n(size)} Pflichten aus ${laws}${priced ? ", dem bepreisten" : ", in diesem Lauf nicht bepreist"}`
      : `In a cluster of ${n(size)} duties from ${laws}${priced ? ", the one priced" : ", not priced in this run"}`),
    noCluster: de ? "In keinem Bündel" : "In no cluster",
    law,
    and: (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${de ? "und" : "and"} ${xs.at(-1)}`),
    cluster: (x, size) => (de ? `${n(size)} Pflichten · gemeinsam: ${x} · Sicherheit` : `${n(size)} duties · shared: ${x} · confidence`),
    priced: de ? "bepreist" : "priced",
    notPriced: de ? "in diesem Lauf nicht bepreist" : "not priced in this run",
    lawItem: (l) => (de
      ? `${l.kind === "act" ? "Gesetz" : "Verordnung"} · ${n(l.paragraphs)} Paragrafen · ${n(l.sentences)} Sätze · ${n(l.flagged)} markiert · ${n(l.duties)} Pflichten`
      : `${l.kind === "act" ? "Act" : "Ordinance"} · ${n(l.paragraphs)} sections · ${n(l.sentences)} sentences · ${n(l.flagged)} flagged · ${n(l.duties)} duties`),
    type: (t, many) => typeName(t, lang, many),
    who: (a) => addresseeName(a, lang),
    due: (d) => dueName(d, lang),
    to: (r) => recipientName(r, lang),
    item: (id) => itemName(id, lang),
    loading: de ? "Die Liste lädt…" : "Loading the list…",
    failed: de ? "Die Liste ließ sich nicht laden. Laden Sie die Seite neu." : "The list didn't load. Reload the page.",
    more: (x) => (de ? `${n(x)} weitere anzeigen` : `Show ${n(x)} more`)
  };

  // ---- the titles of what opens ---------------------------------------------------------------------------------
  const pricedName = nameOf(c.id, lang);
  const title = {
    ladder: [de ? "Von der Vorschrift zur Entlastung: was jede Zahl zählt" : "From law to relief: what each number counts", de ? "Jede Zahl zählt einen Teil der Zahl darüber. Drücken Sie eine Zahl, um aufzulisten, was sie zählt." : "Each number counts part of the one above it. Press a number to list what it counts."],
    laws: [de ? `${n(F.laws)} Vorschriften: ${n(F.acts)} Gesetze und ${n(F.ordinances)} Verordnungen` : `${n(F.laws)} laws: ${n(F.acts)} acts and ${n(F.ordinances)} ordinances`, de ? `Stand ${longDate(F.retrieved, lang)}, von gesetze-im-internet.de: konsolidierte Fassungen, nicht amtlich.` : `As of ${longDate(F.retrieved, lang)}, from gesetze-im-internet.de: consolidated texts, not the official version.`],
    law: (l, clustered) => [de ? `${law(l.id)}: ${n(l.duties)} Pflichten, ${n(clustered)} in Bündeln` : `${law(l.id)}: ${n(l.duties)} duties, ${n(clustered)} in clusters`, `${l.title} (${l.abbr})`],
    duties: [de ? `${n(F.duties)} Pflichten in ${n(F.laws)} Vorschriften` : `${n(F.duties)} duties in ${n(F.laws)} laws`, de ? "Jede mit ihrem Satz; markiert ist, was der Agent fand. Filtern Sie nach Art, Adressat oder Vorschrift." : "Each with its sentence; the marked phrase is what the agent found. Filter by type, addressee or law."],
    flagged: [de ? `${n(F.candidates)} markierte Sätze: ${n(F.duties)} als Pflicht behalten, ${n(F.rejected)} verworfen` : `${n(F.candidates)} sentences flagged: ${n(F.duties)} kept as duties, ${n(F.rejected)} discarded`, de ? "Ein Muster markierte sie; der Agent las jeden und entschied." : "A pattern flagged them; the agent read each one and decided."],
    discarded: [de ? `${n(F.rejected)} verworfene Sätze` : `${n(F.rejected)} sentences discarded`, de ? "Markiert, aber laut Agent keine eigene Pflicht." : "Flagged, but in the agent's reading not a duty of its own."],
    clusters: [de ? `${n(F.clusters)} Bündel mit ${n(F.clustered)} Pflichten` : `${n(F.clusters)} clusters holding ${n(F.clustered)} duties`, de ? "Das bepreiste zuerst, dann nach Größe. Jedes fragt dieselben Adressaten nach sich überschneidenden Angaben." : "The priced one first, then by size. Each asks the same addressees for overlapping items."],
    options: [de ? `${n(F.options)} Optionen für ${pricedName}` : `${n(F.options)} options for ${pricedName}`, de ? "Jede nach der Methode des Bundes bepreist; ein Mensch entscheidet." : "Each priced by the federal method; a person decides."],
    compare: [de ? "Fragen beide Meldungen dieselben Unternehmen?" : "Do the two reports ask the same businesses?", de ? `${law(A.norm)} ${A.section} und ${law(B.norm)} ${B.section}: erst der Gesetzestext, dann die Lesart des Agenten` : `${law(A.norm)} ${A.section} and ${law(B.norm)} ${B.section}: the law's text, then the agent's reading`],
    derive: (type) => [de ? `Woher kommen ${type === "merge" ? "bis zu " : ""}${m(-F.option[type].net)}?` : `Where does ${type === "merge" ? "up to " : ""}${m(-F.option[type].net)} come from?`, de ? `Entlastung im Jahr durch ${type === "merge" ? "das Zusammenlegen beider Meldungen" : "den Registerabruf"}, nach der Methode des Bundes zum Erfüllungsaufwand (${D.guide.publisher}, ${D.guide.edition.replace(/^.*?,\s*/, "")})` : `Relief a year from ${type === "merge" ? "merging the two reports" : "the register lookup"}, by the federal compliance-cost method (${D.guide.publisher}, guide of ${D.guide.edition.replace(/^.*?,\s*/, "").replace("Februar", "February")})`]
  };
  const option = {
    merge: de ? "Beide Meldungen zusammenlegen: Die Angaben der Produktionsmeldung reisen mit der Handelsmeldung." : "Merge the two reports: the production report's items travel with the trade report.",
    register_retrieval: de ? "Die Daten der Handelsmeldung aus dem Unternehmensregister abrufen; das Register ist simuliert." : "Take the trade report's data from the business register; the register is simulated.",
    keep: de ? "Beide Meldungen behalten." : "Keep both reports."
  };

  // ---- the comparison (DR-05) -----------------------------------------------------------------------------------
  const EN_LINES = {
    "a-units": "The survey units are legal units that produce for the market.",
    "a-scope": "The surveys cover units in these sectors; for the monthly surveys first trade and motor-vehicle repair, then transport, hospitality, information and further services, each above a size threshold (cut here).",
    "a-sample": "The surveys ask at most 45 per cent of the units § 3 (2) no. 1 names.",
    "a-items": "The monthly survey asks for turnover and the persons employed, each also by Land, and the unit's activity with its sector code.",
    "a-aux": "Auxiliary items: the unit's name and address, the first of a list (cut here).",
    "a-monthly": "The surveys run monthly, for the calendar month.",
    "a-whom": "For wholesale trade (sector 46) the Federal Statistical Office collects the data itself.",
    "a-duty": "Businesses must answer these surveys: the owners or heads of the units.",
    "b-scope": "Federal statistics are kept on production: mining and quarrying, manufacturing, energy and water supply, sewage and waste, and construction.",
    "b-sites": "The surveys ask the producing sites of at most 68,000 mining and manufacturing businesses, and the producing sites of businesses in other sectors, without construction, energy, water and waste sites.",
    "b-items": "Sites with 50 or more persons report monthly: persons employed, hours worked, wages and salaries, turnover, orders received and on hand, all production, and repair and processing work (cut here).",
    "b-aux": "Auxiliary items: the name and address of the business and the site, the first of a list (cut here).",
    "b-duty": "Businesses must answer these surveys: the owner or head of the sites and businesses of §§ 2 to 6a."
  };
  const quote = (q) => ({ id: q.id, text: q.text, section: q.section, abbr: q.abbr, url: q.url, cut: !/[.:;]$/.test(q.text.trim()), en: de ? null : EN_LINES[q.id] });
  const qa = D.compare[A.norm];
  const qb = D.compare[B.norm];
  const shared = c.shared.map((i) => itemName(i.id, lang));
  const onlyB = B.items.filter((i) => !c.shared.some((x) => x.id === i.id)).map((i) => itemName(i.id, lang));
  const row = (id, label, cells, wide = false) => ({ id, label, cells, wide });
  const cal = D.calibration;
  const compare = {
    title: title.compare,
    pair: { A: law(A.norm), B: law(B.norm) },
    rows: [
      row("who", de ? "Wer melden muss" : "Who must report", [{ quotes: qa.who.map(quote) }, { quotes: qb.who.map(quote) }]),
      row("what", de ? "Was gefragt wird" : "What is asked", [{ quotes: qa.what.map(quote) }, { quotes: qb.what.map(quote) }]),
      row("when", de ? "Wie oft" : "How often", [{ quotes: qa.when.map(quote) }, { text: de ? "Monatlich, wie die Liste in § 2 oben sagt (A. I.)." : "Monthly, as the list in § 2 above says (A. I.)." }]),
      row("whom", de ? "An wen" : "To whom", [{ quotes: qa.whom.map(quote), text: de ? `Sonst ${recipientName(A.recipient.de, lang).replace(/^an /, "")}, wie Lauf R1 es las.` : `Otherwise ${A.recipient.en}, as run R1 read it.` }, { text: de ? `${recipientName(B.recipient.de, lang).replace(/^an /, "").replace(/^./, (x) => x.toUpperCase())}, wie Lauf R1 es las.` : `${B.recipient.en.replace(/^./, (x) => x.toUpperCase())}, as run R1 read it.` }]),
      row("duty", de ? "Die Pflicht" : "The duty", [{ quotes: [quote(qa.duty)] }, { quotes: [quote(qb.duty)] }]),
      row("agent", de ? "Lesart des Agenten" : "The agent's reading", [{ text: de
        ? `Für beide dieselben Adressaten und dieselbe Grundgesamtheit: Unternehmen in den Stichproben der Unternehmensstatistiken, bis zu ${n(c.population.units)}. ${n(shared.length)} von ${n(B.items.length)} Angaben gemeinsam: ${shared.join(", ")}; ${onlyB.join(", ")} nur in B. Sicherheit ${num(c.confidence, lang, 2)}.`
        : `The same addressees and the same population for both: businesses in the samples of the business statistics, up to ${n(c.population.units)}. ${n(shared.length)} of ${n(B.items.length)} items shared: ${shared.join(", ").toLowerCase()}; ${onlyB.join(", ").toLowerCase()} only in B. Confidence ${num(c.confidence, lang, 2)}.` }], true),
      row("law", de ? "Was der Gesetzestext zeigt" : "What the law text shows", [{ text: de
        ? `Dieselben Unternehmen sind angenommen, nicht belegt. A fragt Unternehmen in Handel und Dienstleistungen über Größenschwellen, B produzierende Betriebe ab 50 tätigen Personen. Beide treffen dasselbe Unternehmen nur, wo ein Handels- oder Dienstleistungsunternehmen einen solchen Betrieb hat. Wie viele das sind, sagt das Gesetz nicht; amtliche Zählungen begrenzen sie auf ${n(cal.cap)}.`
        : `The same businesses are assumed, not shown. A asks businesses in trade and services above size thresholds, B asks producing sites with 50 or more persons. Both reach the same business only where a trade or services business runs such a site. The law doesn't say how many do; public counts cap them at ${n(cal.cap)}.` }], true),
      row("check", de ? "Vor dem Zusammenlegen prüfen" : "Before a merge, check", [{ text: de
        ? "Die Unternehmen zählen, die in beiden Stichproben stehen; prüfen, ob die gemeinsamen Angaben dasselbe meinen und denselben Monat abdecken; prüfen, was das Recht der EU von jeder Erhebung verlangt."
        : "Count the businesses that sit in both samples; check that the shared items mean the same and cover the same month; check what EU law requires of each survey." }], true)
    ],
    voice: de ? "Grau: die Lesart dieser Seite, nicht die des Agenten." : "Grey: this page's reading, not the agent's.",
    official: de ? `Zitate: konsolidierte Fassung vom ${longDate(F.retrieved, lang)}, nicht amtlich.` : `Quotes: consolidated text of ${longDate(F.retrieved, lang)}, not the official version.`,
    cut: de ? "gekürzt" : "cut here"
  };

  // ---- the derivation (DR-06) ------------------------------------------------------------------------------------
  const KIND = { cap: de ? "höchstens, amtliche Zählung" : "at most, public count", law: de ? "aus dem Gesetz" : "from the law", sourced: de ? "Destatis-Tabelle" : "Destatis table", assumed: de ? "angenommen" : "assumed", engine: de ? "berechnet" : "computed" };
  const I = D.inputs;
  const g = D.guide;
  const annex = (x) => (de ? `Leitfaden, Anhang ${x.source.title.match(/Anhang (\d+)/)[1]}, S. ${x.source.page}` : `guide, Annex ${x.source.title.match(/Anhang (\d+)/)[1]}, p. ${x.source.page}`);
  const reason = (x) => (de ? x.reason.de : x.reason.en);
  const PARTS = { einarbeitung_einfach: ["Getting familiar with it", "Einarbeitung"], daten_beschaffen_einfach: ["Getting the data", "Daten beschaffen"], formulare_einfach: ["Filling in the form", "Formulare ausfüllen"], pruefung_einfach: ["Checking", "Prüfung"], uebermittlung_einfach: ["Sending it", "Übermittlung"] };
  const input = (id, name, value, kind, source, link = null) => ({ id, name, value, kind, kindLabel: KIND[kind], source, link });
  const dv = D.derivation;
  const reports = dv.one.reports;
  const inputs = {
    businesses: input("businesses", de ? "Unternehmen, die beide Meldungen abgeben" : "Businesses that file both reports", n(I.businesses.value), "cap", de ? `höchstens so viele: ${n(cal.production.sites)} Betriebe fragt die Produktionserhebung (2025), rund ${n(cal.trade.count)} Unternehmen die Handelserhebung. Dass alle doppelt melden, ist angenommen; Lauf R1 nahm ${n(cal.before.businesses)} an.` : `at most this many: the production survey asks ${n(cal.production.sites)} sites (2025), the trade survey about ${n(cal.trade.count)} businesses. That all of them file both is assumed; run R1 assumed ${n(cal.before.businesses)}.`, cal.production.url),
    perYear: input("perYear", de ? "Meldungen im Jahr" : "Reports a year", n(I.perYear.value), "law", de ? "§ 4 HdlDlStatG: monatlich" : "§ 4 HdlDlStatG: monthly", qa.when[0]?.url),
    minutes: input("minutes", de ? "Minuten je Meldung" : "Minutes a report", minutes(I.minutes.value, lang), "sourced", de ? `${annex(I.minutes)}: fünf einfache Standardaktivitäten` : `${annex(I.minutes)}: five simple standard activities`, g.url),
    wage: input("wage", de ? "Lohnkosten der Wirtschaft je Stunde" : "Wage a business pays an hour", euros(I.wage.value, lang, 2), "sourced", `${annex(I.wage)}: ${reason(I.wage)}`, g.url),
    material: input("material", de ? "Sachkosten je Meldung" : "Material a report", euros(I.material.value, lang, 2), "assumed", reason(I.material)),
    mergedMinutes: input("mergedMinutes", de ? "Minuten der zusammengelegten Meldung" : "Minutes, merged report", minutes(I.mergedMinutes.value, lang), "engine", de ? `${n(I.minutes.value)} + ${n(I.minutes.value)} × (1 − ${n(dv.added.shared)}/${n(dv.added.items)}): B fügt ${n(dv.added.items - dv.added.shared)} von ${n(dv.added.items)} Angaben hinzu` : `${n(I.minutes.value)} + ${n(I.minutes.value)} × (1 − ${n(dv.added.shared)}/${n(dv.added.items)}): B adds ${n(dv.added.items - dv.added.shared)} item of ${n(dv.added.items)}`),
    adminMinutes: input("adminMinutes", de ? "Minuten je Registerabruf" : "Minutes a register lookup", minutes(I.adminMinutes.value, lang), "assumed", reason(I.adminMinutes)),
    // 1.0.0 says "career groups" (Laufbahngruppen); "levels" keeps "group" free for nothing but the glossary's avoid list.
    adminWage: input("adminWage", de ? "Lohnkosten der Bundesverwaltung je Stunde" : "Wage of the federal administration an hour", euros(I.adminWage.value, lang, 2), "sourced", `${annex(I.adminWage)}: ${de ? reason(I.adminWage) : reason(I.adminWage).replace("career groups", "career levels")}`, g.url),
    oneOff: input("oneOff", de ? "Anbindung des Registers, einmalig" : "Connecting the register, once", euros(I.oneOff.value, lang), "assumed", reason(I.oneOff))
  };
  const h = (x) => num(x, lang, 1);
  const derive = (type) => {
    const merge = type === "merge";
    const net = merge ? dv.relief : dv.registerNet;
    const steps = merge
      ? (de
        ? [`Meldungen im Jahr: ${n(I.businesses.value)} Unternehmen × ${n(I.perYear.value)} = ${n(reports)}`,
          `Eine Meldung: ${n(reports)} × ${minutes(I.minutes.value, lang)} = ${h(dv.one.hours)} Stunden × ${euros(I.wage.value, lang, 2)} = ${eur(dv.one.personnel)}, dazu ${euros(I.material.value, lang, 2)} je Meldung (${eur(dv.one.material)}) = ${eur(dv.one.cost)}`,
          `Beide Meldungen: 2 × ${eur(dv.one.cost)} = ${eur(dv.both)}`,
          `Zusammengelegt: ${n(reports)} × ${minutes(I.mergedMinutes.value, lang)} = ${h(dv.merged.hours)} Stunden × ${euros(I.wage.value, lang, 2)} = ${eur(dv.merged.personnel)}, dazu ${eur(dv.merged.material)} = ${eur(dv.merged.cost)}`,
          `Entlastung: ${eur(dv.both)} − ${eur(dv.merged.cost)} = ${eur(net)} im Jahr`]
        : [`Reports a year: ${n(I.businesses.value)} businesses × ${n(I.perYear.value)} = ${n(reports)}`,
          `One report: ${n(reports)} × ${minutes(I.minutes.value, lang)} = ${h(dv.one.hours)} hours × ${euros(I.wage.value, lang, 2)} = ${eur(dv.one.personnel)}, plus ${euros(I.material.value, lang, 2)} a report (${eur(dv.one.material)}) = ${eur(dv.one.cost)}`,
          `Both reports: 2 × ${eur(dv.one.cost)} = ${eur(dv.both)}`,
          `Merged: ${n(reports)} × ${minutes(I.mergedMinutes.value, lang)} = ${h(dv.merged.hours)} hours × ${euros(I.wage.value, lang, 2)} = ${eur(dv.merged.personnel)}, plus ${eur(dv.merged.material)} = ${eur(dv.merged.cost)}`,
          `Relief: ${eur(dv.both)} − ${eur(dv.merged.cost)} = ${eur(net)} a year`])
      : (de
        ? [`Meldungen im Jahr: ${n(I.businesses.value)} Unternehmen × ${n(I.perYear.value)} = ${n(reports)}`,
          `Die Unternehmen sparen eine Meldung: ${eur(dv.one.cost)}, wie beim Zusammenlegen gerechnet`,
          `Die Verwaltung ruft ab: ${n(reports)} × ${minutes(I.adminMinutes.value, lang)} = ${h(dv.admin.hours)} Stunden × ${euros(I.adminWage.value, lang, 2)} = ${eur(dv.admin.cost)}`,
          `Netto: ${eur(dv.one.cost)} − ${eur(dv.admin.cost)} = ${eur(net)} im Jahr, dazu einmalig ${euros(dv.oneOff, lang)}`]
        : [`Reports a year: ${n(I.businesses.value)} businesses × ${n(I.perYear.value)} = ${n(reports)}`,
          `Businesses save one report: ${eur(dv.one.cost)}, priced as for the merge`,
          `The administration looks the data up: ${n(reports)} × ${minutes(I.adminMinutes.value, lang)} = ${h(dv.admin.hours)} hours × ${euros(I.adminWage.value, lang, 2)} = ${eur(dv.admin.cost)}`,
          `Net: ${eur(dv.one.cost)} − ${eur(dv.admin.cost)} = ${eur(net)} a year, plus ${euros(dv.oneOff, lang)} once`]);
    const ids = merge ? ["businesses", "perYear", "minutes", "wage", "material", "mergedMinutes"] : ["businesses", "perYear", "minutes", "wage", "material", "adminMinutes", "adminWage", "oneOff"];
    return {
      title: title.derive(type),
      formula: de ? "Kosten im Jahr = Unternehmen × Meldungen im Jahr × (Minuten ÷ 60 × Lohn je Stunde + Sachkosten)" : "Cost a year = businesses × reports a year × (minutes ÷ 60 × wage an hour + material)",
      heads: de ? ["Eingabe", "Wert", "Art", "Quelle oder Grund"] : ["Input", "Value", "Kind", "Source or reason"],
      inputs: ids.map((id) => inputs[id]),
      partsTitle: de ? `Die ${minutes(I.minutes.value, lang)} je Meldung: einfache Standardaktivitäten aus ${annex(I.minutes)}` : `The ${minutes(I.minutes.value, lang)} a report: simple standard activities from the ${annex(I.minutes)}`,
      parts: Object.entries(I.minutes.source.parts).map(([k, v]) => ({ name: PARTS[k][de ? 1 : 0], minutes: v })),
      merged: de
        ? `Die zusammengelegte Meldung dauert ${minutes(I.mergedMinutes.value, lang)}: die ${minutes(I.minutes.value, lang)} einer Meldung plus den Anteil der Angaben, den die zweite hinzufügt. ${law(B.norm)} fragt ${n(dv.added.items)} Angaben, ${n(dv.added.shared)} davon fragt ${law(A.norm)} schon; es kommt ${n(dv.added.items - dv.added.shared)} von ${n(dv.added.items)} hinzu.`
        : `A merged report takes ${minutes(I.mergedMinutes.value, lang)}: the ${minutes(I.minutes.value, lang)} of one report plus the share of items the second adds. ${law(B.norm)} asks for ${n(dv.added.items)} items, ${n(dv.added.shared)} of which ${law(A.norm).toLowerCase()} already asks for, so it adds ${n(dv.added.items - dv.added.shared)} of ${n(dv.added.items)}.`,
      steps,
      rounding: de ? `Die Seite rundet auf zwei Stellen in Millionen: ${eur(net)} erscheint als ${m(net)}.` : `The page rounds to two decimals in millions: ${eur(net)} shows as ${m(net)}.`,
      sensTitle: de ? "Wenn weniger doppelt melden" : "If fewer file both",
      sensNote: de ? "Der Gesetzestext sagt nicht, wie viele beide Meldungen abgeben." : "The law text doesn't say how many file both reports.",
      sensitivity: merge ? D.sensitivity.map((r) => ({ share: r.share, label: de ? `${r.share === 1 ? "Alle" : r.share === 0.5 ? "Die Hälfte" : r.share === 0.25 ? "Ein Viertel" : "Jedes zehnte"}, ${n(r.businesses)}` : `${r.share === 1 ? "All" : r.share === 0.5 ? "Half" : r.share === 0.25 ? "A quarter" : "One in ten"}, ${n(r.businesses)}`, value: m(r.relief) })) : [],
      calibration: de
        ? `Lauf R1 nahm für jede Unternehmensstatistik ${n(cal.before.businesses)} Unternehmen an; damit wären es ${m(merge ? cal.before.merge : cal.before.register)}. Amtliche Zählungen, gelesen am ${longDate(cal.retrieved, lang)}, begrenzen sie auf ${n(cal.cap)}.`
        : `Run R1 assumed ${n(cal.before.businesses)} businesses for every business statistic, which gave ${m(merge ? cal.before.merge : cal.before.register)}. Public counts, read on ${longDate(cal.retrieved, lang)}, cap them at ${n(cal.cap)}.`,
      sources: [
        { text: de ? `${cal.production.publisher}: ${cal.production.title}, ${cal.production.year}, ${n(cal.production.lands)} Länder addiert` : `${cal.production.publisher}: ${cal.production.title}, ${cal.production.year}, the ${n(cal.production.lands)} Länder added up`, url: cal.production.url },
        { text: `${cal.trade.publisher}: ${cal.trade.title}, ${de ? "S." : "p."} ${cal.trade.page}`, url: cal.trade.url },
        { text: `${g.publisher}: ${g.title}, ${g.edition}`, url: g.url }
      ],
      engines: de ? "Berechnet von den Rechenmodulen aus Release 1.0.0, wie jede Zahl dieser Seite." : "Computed by release 1.0.0's engines, as every figure on this page."
    };
  };

  return { ladder, lists, title, option, compare, derive, legal };
}
