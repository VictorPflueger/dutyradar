// Entry point. Loads the strings and the law snapshot's index, then imports and starts the UI. The UI
// is imported dynamically so that a failed module load is reported on the boot screen instead of
// leaving a blank page. Browsers never run this module from file:// — the boot screen in index.html
// explains that case on its own. Nothing is loaded from a third party: every file comes from this site.
// The boot messages start as the static English texts of index.html (data attributes of #boot-status);
// once the strings are loaded, applyStatic sets them in the chosen language.

import { APP, DATA } from "./config.js";

const statusEl = () => document.getElementById("boot-status");
const bootText = (name) => statusEl()?.dataset[name] || "";

boot().catch((err) => failBoot(err));

async function boot() {
  setBootStatus(bootText("loadingStrings"));
  let i18n;
  try {
    i18n = await import("./i18n.js");
    await i18n.loadI18n();
  } catch (err) {
    throw new Error(`${bootText("failedData")} (${err?.message || err})`);
  }
  i18n.applyStatic();

  setBootStatus(bootText("loadingData"));
  let corpusIndex;
  let slice;
  try {
    [corpusIndex, slice] = await Promise.all([getJson(DATA.corpusIndex), getJson(DATA.slice)]);
  } catch (err) {
    throw new Error(`${bootText("failedData")} (${err?.message || err})`);
  }

  setBootStatus(bootText("starting"));
  let ui;
  try {
    ui = await import("./ui.js");
  } catch (err) {
    throw new Error(`${bootText("failedModule")} (${err?.message || err})`);
  }
  const app = ui.initUI({ corpusIndex, slice });
  document.documentElement.dataset.boot = "ready";
  hideBoot();
  app.introOnFirstVisit();
  console.info(`[${APP.name}] ${APP.fullName} ${APP.version} ready.`);
}

async function getJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// ---- boot screen ------------------------------------------------------------------------------

function setBootStatus(text) {
  const el = statusEl();
  if (el && text) el.textContent = text;
}

function hideBoot() {
  const el = document.getElementById("boot");
  if (!el) return;
  el.dataset.state = "done";
  setTimeout(() => el.remove(), 400);
}

function failBoot(err) {
  const el = document.getElementById("boot");
  const detail = document.getElementById("boot-detail");
  // "failed" is the state the shell's stylesheet knows: the spinner stops and the help shows.
  if (el) el.dataset.state = "failed";
  if (detail) {
    detail.hidden = false;
    detail.textContent = String(err?.message || err);
  }
  document.documentElement.dataset.boot = "failed";
  console.error(`[${APP.name}] boot failed:`, err);
}
