// Placeholders in model text: {{fact:F-0412}} renders the fact's value for its unit in the language of
// the text, {{cite:beispielg-p20}} renders "§ 20 BeispielG". A fact that no longer applies (retired,
// or bound by a recording and never produced) renders "no longer applies" / "entfallen". The screens
// build nodes from the parts; exports and tests use the plain text.

import { formatFactValue } from "./engine/format.js";
import { t } from "./i18n.js";

const RE = /\{\{(fact|cite):([^{}\s]+)\}\}/g;

/** The text split into { type: "text" | "fact" | "cite", text | id } parts. */
export function placeholderParts(text) {
  const parts = [];
  let last = 0;
  for (const m of String(text ?? "").matchAll(RE)) {
    if (m.index > last) parts.push({ type: "text", text: text.slice(last, m.index) });
    parts.push({ type: m[1], id: m[2] });
    last = m.index + m[0].length;
  }
  if (last < String(text ?? "").length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

/** A fact's display string, or the retired label. */
export function factText(facts, id, lang) {
  const f = facts?.get(id);
  const shown = f && !f.retired ? formatFactValue(f, lang) : null;
  return shown ?? t("fact.retired", {}, lang);
}

/** "§ 20 BeispielG" for a paragraph id, or the id itself when the paragraph is not loaded. */
export function citeText(data, id) {
  const p = data?.paragraphs?.get(id);
  return p ? `${p.enbez} ${p.abbr}`.replace(/\s+/g, " ").trim() : id;
}

/** Plain text with every placeholder rendered. format "text" only (the screens use the parts). */
export function renderPlaceholders(text, { facts, lang = "en", data } = {}) {
  return placeholderParts(text).map((p) => (p.type === "text" ? p.text : p.type === "fact" ? factText(facts, p.id, lang) : citeText(data, p.id))).join("");
}
