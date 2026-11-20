// Numbers and money as Vici's writing guideline writes them, in English (en-GB) or German:
// 4,904 and 4.904, €4.07m and 4,07 Mio. €, €250,000 and 250.000 €, a minus sign for negatives and a
// no-break space between a number and its unit.

export const NBSP = " ";
const MINUS = "−";
const LOCALE = { en: "en-GB", de: "de-DE" };

const number = (n, lang, digits = 0) =>
  new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(n));
const sign = (n) => (n < 0 ? MINUS : "");

/** A count: 4,904 or 4.904. */
export const count = (n, lang) => `${sign(n)}${number(n, lang)}`;

/** Millions of euros, two decimals: €4.07m or 4,07 Mio. €. */
export const millions = (eur, lang) =>
  lang === "de" ? `${sign(eur)}${number(eur / 1e6, lang, 2)}${NBSP}Mio.${NBSP}€` : `${sign(eur)}€${number(eur / 1e6, lang, 2)}m`;

/** Euros: €250,000 or 250.000 €; digits for cents, as in €38.60. */
export const euros = (eur, lang, digits = 0) =>
  lang === "de" ? `${sign(eur)}${number(eur, lang, digits)}${NBSP}€` : `${sign(eur)}€${number(eur, lang, digits)}`;

/** Money as the page shows it: millions from one million, whole euros below. */
export const money = (eur, lang) => (Math.abs(eur) >= 1e6 ? millions(eur, lang) : euros(eur, lang));

/** A count in millions in words: 1.44 million or 1,44 Millionen. */
export const millionsWord = (n, lang) => `${number(n / 1e6, lang, 2)}${NBSP}${lang === "de" ? "Millionen" : "million"}`;

/** Minutes: 10 min. */
export const minutes = (m, lang) => `${number(m, lang)}${NBSP}min`;

/** A date in running text: 19 November 2026 or 19. November 2026. */
export const longDate = (iso, lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Keeps "§ 11 HdlDlStatG" on one line: no-break spaces after the section sign and after its number. */
export const legal = (text) => String(text).replace(/§ (\S+) /g, "§\u00a0$1\u00a0");
