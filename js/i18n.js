// Two languages: English on every first visit, German one click away. ?lang=de or ?lang=en in the
// address wins and becomes the stored choice (dr.lang); <html lang> follows. Every user-visible string
// lives in js/i18n/en.json and js/i18n/de.json with identical keys; index.html keeps the English texts
// as static defaults, and this module replaces them at runtime (elements with data-i18n="key", and
// data-i18n-attr="attribute:key;…" for attributes). Switching re-renders every view without a reload.

import { STORAGE, DATA } from "./config.js";

export const LANGS = ["en", "de"];
const strings = { en: null, de: null };
const listeners = new Set();
let current = "en";

const storage = () => {
  try { return window.localStorage; } catch { return null; }
};

/** The language to start with: ?lang= wins (and is stored), then the stored choice, then English. */
export function initialLang(search = globalThis.location?.search ?? "") {
  const asked = new URLSearchParams(search).get("lang");
  if (LANGS.includes(asked)) {
    try { storage()?.setItem(STORAGE.lang, asked); } catch { /* storage blocked */ }
    return asked;
  }
  let stored = null;
  try { stored = storage()?.getItem(STORAGE.lang); } catch { /* storage blocked */ }
  return LANGS.includes(stored) ? stored : "en";
}

/** Loads both string tables (the switch is instant afterwards) and sets the starting language. */
export async function loadI18n(fetchFn = fetch) {
  const [en, de] = await Promise.all(LANGS.map(async (l) => {
    const res = await fetchFn(DATA.i18n[l], { cache: "no-cache" });
    if (!res.ok) throw new Error(`${DATA.i18n[l]}: HTTP ${res.status}`);
    return res.json();
  }));
  strings.en = en;
  strings.de = de;
  current = initialLang();
  if (typeof document !== "undefined") document.documentElement.lang = current;
  return current;
}

/** The active language, "en" or "de". */
export const lang = () => current;

const lookup = (table, key) => key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), table);

/**
 * The string for `key` in the active language (or `lng`), with {name} placeholders filled from
 * params. A missing key shows the key itself, so a gap is visible rather than blank.
 */
export function t(key, params = {}, lng = current) {
  let s = lookup(strings[lng] || {}, key);
  if (typeof s !== "string") s = lookup(strings.en || {}, key);
  if (typeof s !== "string") return key;
  return s.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined && params[name] !== null ? String(params[name]) : m));
}

/** Whether a key exists in both tables. */
export const has = (key) => typeof lookup(strings.en || {}, key) === "string" && typeof lookup(strings.de || {}, key) === "string";

/** Switches the language: stores it, updates <html lang>, the static texts and every view. */
export function setLang(next) {
  if (!LANGS.includes(next) || next === current) return;
  current = next;
  try { storage()?.setItem(STORAGE.lang, next); } catch { /* storage blocked */ }
  document.documentElement.lang = next;
  applyStatic();
  for (const fn of listeners) fn(next);
}

/** Calls fn(lang) after every language switch; returns the unsubscribe function. */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fills the static texts and attributes marked with data-i18n and data-i18n-attr. */
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
}
