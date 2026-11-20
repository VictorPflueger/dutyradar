// Session-only storage for the Sovereign endpoint's key, apart from the Anthropic key (js/keystore.js,
// a file shared with the sister apps, keeps that one). The two never share a slot: an Anthropic key is
// only ever sent to api.anthropic.com, and the endpoint's key only to the configured endpoint. Like the
// Anthropic key it lives in this tab's sessionStorage, is shown masked and is never logged or exported.

import { STORAGE } from "./config.js";

let memoryFallback = null;

export function getSovereignKey() {
  try {
    return sessionStorage.getItem(STORAGE.sovereignKey) || memoryFallback;
  } catch {
    return memoryFallback;
  }
}

export function setSovereignKey(raw) {
  const key = String(raw || "").trim();
  try {
    sessionStorage.setItem(STORAGE.sovereignKey, key);
    memoryFallback = null;
  } catch {
    memoryFallback = key; // private mode without storage: keep for this page only
  }
  return key;
}

export function forgetSovereignKey() {
  try { sessionStorage.removeItem(STORAGE.sovereignKey); } catch { /* ignore */ }
  memoryFallback = null;
}
