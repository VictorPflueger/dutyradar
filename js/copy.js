// The page's fixed words in English and German: everything in index.html marked data-i18n (text) or
// data-i18n-attr (attributes). The steps' sentences, with their figures, are in js/story.js. The two
// guides are written out in index.html, one per language.

export const LANGS = ["en", "de"];

export const COPY = {
  en: {
    "doc.title": "Duty Radar · bureaucracy relief prototype",
    "skip": "Skip to the story",
    "app.name": "Duty Radar",
    "sim.tip": "A replay of the agent's run on 31 real federal laws. Engines compute every figure; case numbers are assumed. A prototype, not an official government service.",
    "strip.note": "Finds where two federal laws ask businesses for the same data and prices the relief. Real federal law, a replayed agent run, assumed case numbers.",
    "theme.tip": "Dark or light theme",
    "lang.label": "Language",
    "kpis.label": "Key figures",
    "player.label": "Talk track",
    "restart.tip": "Back to the start",
    "agent.tag": "Agent",
    "decide.merge": "Approve merge",
    "decide.register_retrieval": "Approve register lookup",
    "decide.keep": "Keep both",
    "decide.lead": "Your turn:",
    "decide.ask": "Approve one option or keep both.",
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
    "sim.tip": "Ein nachgespielter Lauf des Agenten auf 31 echten Bundesgesetzen. Rechenmodule ermitteln jede Zahl; Fallzahlen sind angenommen. Ein Prototyp, kein amtliches Angebot.",
    "strip.note": "Findet Daten, die zwei Bundesgesetze doppelt abfragen, und bepreist die Entlastung. Echtes Bundesrecht, nachgespielter Agentenlauf, angenommene Fallzahlen.",
    "theme.tip": "Dunkles oder helles Design",
    "lang.label": "Sprache",
    "kpis.label": "Kennzahlen",
    "player.label": "Gesprächsleitfaden",
    "restart.tip": "Zurück zum Anfang",
    "agent.tag": "Agent",
    "decide.merge": "Zusammenlegen freigeben",
    "decide.register_retrieval": "Registerabruf freigeben",
    "decide.keep": "Beide behalten",
    "decide.lead": "Sie sind dran:",
    "decide.ask": "Geben Sie eine Option frei oder behalten Sie beide.",
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
