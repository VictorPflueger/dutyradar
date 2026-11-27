// The page's fixed words in English and German: everything in index.html marked data-i18n (text) or
// data-i18n-attr (attributes), and the glossary. The steps' sentences, with their figures, are in
// js/story.js, the lists' in js/explain.js. The two guides are written out in index.html, one per language.

export const LANGS = ["en", "de"];

/**
 * One word per thing (DR-01), in English and German, and the words a screen must not use for it: the
 * ladder defines each, and tests/glossary.mjs reads every screen for the others. Law quotes, German on
 * every screen, keep the law's own words.
 */
export const GLOSSARY = {
  law: { en: ["law", "laws"], de: ["Vorschrift", "Vorschriften"], avoid: { en: ["statute", "statutes", "legislation"], de: ["Rechtsnorm", "Rechtsnormen", "Bundesgesetze", "Bundesgesetzen"] } },
  section: { en: ["section", "sections"], de: ["Paragraf", "Paragrafen"], avoid: { en: ["paragraph", "paragraphs"], de: ["Paragraph", "Paragraphen"] } },
  sentence: { en: ["sentence", "sentences"], de: ["Satz", "Sätze", "Sätzen"], avoid: { en: ["clause", "clauses"], de: ["Klausel", "Klauseln"] } },
  duty: { en: ["duty", "duties"], de: ["Pflicht", "Pflichten"], avoid: { en: ["obligation", "obligations", "requirement", "requirements"], de: ["Verpflichtung", "Verpflichtungen", "Obliegenheit"] } },
  reporting: { en: ["reporting duty", "reporting duties"], de: ["Meldepflicht", "Meldepflichten"], avoid: { en: ["notification duty", "notification duties", "reporting obligation", "report duty"], de: ["Anzeigepflicht", "Anzeigepflichten", "Berichtspflicht", "Berichtspflichten", "Mitteilungspflicht"] } },
  cluster: { en: ["cluster", "clusters"], de: ["Bündel", "Bündeln", "Bündels"], avoid: { en: ["group", "groups", "bundle", "bundles"], de: ["Cluster", "Gruppe", "Gruppen"] } },
  item: { en: ["item", "items"], de: ["Angabe", "Angaben"], avoid: { en: ["data point", "data points", "field", "fields", "attribute", "attributes"], de: ["Merkmal", "Merkmale", "Datenfeld", "Datenfelder", "Datenpunkt"] } }
};

export const COPY = {
  en: {
    "doc.title": "Duty Radar · bureaucracy relief prototype",
    "skip": "Skip to the story",
    "app.name": "Duty Radar",
    "sim.tip": "A replay of the agent's run on 31 real laws. Engines compute every figure; case numbers are assumed. Prototype, not an official federal government service.",
    "strip.note": "Finds where two laws ask businesses for the same items and prices the relief. Real law texts, a replayed agent run, assumed case numbers.",
    "theme.tip": "Dark or light theme",
    "lang.label": "Language",
    "kpis.label": "Key figures",
    "player.label": "Talk track",
    "restart.tip": "Back to the start",
    "ladder.open": "What each number counts",
    "panel.close": "Close the list",
    "agent.tag": "Agent",
    "decide.merge": "Approve merge",
    "decide.register_retrieval": "Approve register lookup",
    "decide.keep": "Keep both",
    "decide.lead": "Your turn:",
    "decide.ask": "Approve an option and one reporting duty goes.",
    "byline.label": "Built by",
    "byline.linkedin": " on LinkedIn (opens in a new tab)",
    "byline.website": "Victor Pflüger's website (opens in a new tab)",
    "byline.tip": "Website",
    "boot": "Starting Duty Radar…",
    "step": "Step"
  },
  de: {
    "doc.title": "Pflichten-Radar · Prototyp für Bürokratieabbau",
    "skip": "Zur Erzählung springen",
    "app.name": "Pflichten-Radar",
    "sim.tip": "Ein nachgespielter Lauf des Agenten auf 31 echten Vorschriften. Rechenmodule ermitteln jede Zahl; Fallzahlen sind angenommen. Prototyp, kein amtliches Angebot des Bundes.",
    "strip.note": "Findet Angaben, die zwei Vorschriften doppelt abfragen, und bepreist die Entlastung. Echte Gesetzestexte, nachgespielter Agentenlauf, angenommene Fallzahlen.",
    "theme.tip": "Dunkles oder helles Design",
    "lang.label": "Sprache",
    "kpis.label": "Kennzahlen",
    "player.label": "Gesprächsleitfaden",
    "restart.tip": "Zurück zum Anfang",
    "ladder.open": "Was jede Zahl zählt",
    "panel.close": "Liste schließen",
    "agent.tag": "Agent",
    "decide.merge": "Zusammenlegen freigeben",
    "decide.register_retrieval": "Registerabruf freigeben",
    "decide.keep": "Beide behalten",
    "decide.lead": "Sie sind dran:",
    "decide.ask": "Geben Sie eine Option frei, dann entfällt eine Meldepflicht.",
    "byline.label": "Erstellt von",
    "byline.linkedin": " auf LinkedIn (öffnet in einem neuen Tab)",
    "byline.website": "Website von Victor Pflüger (öffnet in einem neuen Tab)",
    "byline.tip": "Website",
    "boot": "Pflichten-Radar startet…",
    "step": "Schritt"
  }
};

/** A fixed word in a language. */
export const t = (lang, key) => COPY[lang]?.[key] ?? COPY.en[key] ?? key;

/** Writes the fixed words of one language into the page (data-i18n, data-i18n-attr="attr:key;…"). */
export function applyCopy(lang, root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(lang, el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr.trim(), t(lang, key.trim()));
    }
  }
  document.title = t(lang, "doc.title");
}
