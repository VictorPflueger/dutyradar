// Display formatting for both languages (pure; runs in the browser and under Node).
//
// The engines compute at full precision; only display rounds, through Intl.NumberFormat with
// de-DE or en-GB, never with fixed-point string conversion. Euros from 1,000 upward show no decimals, smaller amounts
// two; hours show no decimals and " Std." or " h"; shares are percentages with one decimal.

export const LOCALES = { de: "de-DE", en: "en-GB" };
const locale = (lang) => LOCALES[lang] || LOCALES.en;
const cache = new Map();
function nf(lang, options) {
  const key = `${lang}|${JSON.stringify(options)}`;
  if (!cache.has(key)) cache.set(key, new Intl.NumberFormat(locale(lang), options));
  return cache.get(key);
}

/** Replaces no-break and narrow no-break spaces with normal spaces (for comparisons in tests). */
export const plain = (s) => String(s).replace(/[  ]/g, " ");

/** "1.220.000 €" / "€1,220,000"; "12,50 €" / "€12.50". */
export function formatEur(value, lang = "en") {
  const digits = Math.abs(value) >= 1000 ? 0 : 2;
  return nf(lang, { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** "16.667 Std." / "16,667 h". */
export function formatHours(value, lang = "en") {
  return `${nf(lang, { maximumFractionDigits: 0 }).format(value)}${lang === "de" ? " Std." : " h"}`;
}

/** "30,0 %" / "30.0%". */
export function formatShare(value, lang = "en") {
  return nf(lang, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/** Whole counts: "40.000" / "40,000". */
export function formatCount(value, lang = "en") {
  return nf(lang, { maximumFractionDigits: 0 }).format(value);
}

/** Minutes per case: "45 Min." / "45 min". */
export function formatMinutes(value, lang = "en") {
  return `${nf(lang, { maximumFractionDigits: 1 }).format(value)}${lang === "de" ? " Min." : " min"}`;
}

/** A plain number with up to two decimals (wage rates, rates per case). */
export function formatNumber(value, lang = "en", maxDigits = 2) {
  return nf(lang, { maximumFractionDigits: maxDigits }).format(value);
}

/** A fact's value for its unit; a retired fact has no value and renders as null. */
export function formatFactValue(fact, lang = "en") {
  if (!fact || fact.value === null || fact.value === undefined) return null;
  switch (fact.unit) {
    case "EUR_PER_YEAR":
    case "EUR":
      return formatEur(fact.value, lang);
    case "HOURS_PER_YEAR":
      return formatHours(fact.value, lang);
    case "SHARE":
      return formatShare(fact.value, lang);
    case "MINUTES":
      return formatMinutes(fact.value, lang);
    case "COUNT":
    default:
      return formatCount(fact.value, lang);
  }
}
