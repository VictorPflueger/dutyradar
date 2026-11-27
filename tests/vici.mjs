// Vici's own rules, checked with Vici's own functions: the How it works guide and its key figures
// (guideProblems), the byline (bylineProblems), the Writing guideline's checkable patterns
// (writingProblems: no eyebrow, no numbered middle-dot heading, no bold-label list item, no em dash as
// punctuation, no stock word), the AI notice (aiNoticeProblems: the page starts no live run, so it needs
// none), the security policy (policyProblems), the session-only data rule (storageProblems: only the
// language and theme modules touch web storage) and names, not record ids (recordIdProblems, with every
// id of data/story.js and data/inventory.js), on the page, on every sentence the steps, the ladder, the
// lists, the comparison and the derivation write, and on the docs. tests/showcase.mjs runs the record ids
// and the stored keys over the rendered screens too. Node.js only.
//
// The page carries one guide per language. A Vici that checks one guide per page gets the page once per
// language: the other language's guide taken out and the key figures named in that language
// (data-vc-kpi, or data-vc-kpi-de for German). A Vici that knows pages in two languages gets the page as
// it is. The German built-in words (the guide's buttons, count and rail, the byline) are compared with
// the table in Vici's writing guideline.
//
// The functions come from a checkout of ViciDesign next to this repository (../ViciDesign, or the
// folder in VICI_DIR). Without one the suite says so and passes, unless --require-vici is given, as on
// GitHub Actions, which checks ViciDesign out at the commit vici/ was copied from.
// Usage: node tests/vici.mjs [--require-vici]
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "./lib/harness.mjs";

const require = process.argv.includes("--require-vici");
const dir = [process.env.VICI_DIR, path.resolve(APP_ROOT, "..", "ViciDesign")].filter(Boolean).find((d) => existsSync(path.join(d, "scripts", "check-guide.mjs")));
if (!dir) {
  console.log(`${require ? "FAIL" : "SKIP"}  no ViciDesign checkout next to this repository (../ViciDesign) or in VICI_DIR`);
  process.exit(require ? 1 : 0);
}

// Vici's checks print their own report on import; it goes to stderr here, so this suite's lines stay together.
const log = console.log;
console.log = (...a) => console.error("  [vici]", ...a);
const load = async (lib, script, name) => {
  const file = [lib, script].map((f) => path.join(dir, "scripts", f)).find((f) => existsSync(f));
  return (await import(pathToFileURL(file).href))[name];
};
const guideProblems = await load("lib/guide.mjs", "check-guide.mjs", "guideProblems");
const bylineProblems = await load("lib/byline.mjs", "check-byline.mjs", "bylineProblems");
const writingProblems = await load("lib/writing.mjs", "check-docs.mjs", "writingProblems");
const aiNoticeProblems = await load("lib/ai.mjs", "check-ai.mjs", "aiNoticeProblems");
const recordIdProblems = await load("lib/ids.mjs", "check-ids.mjs", "recordIdProblems");
const policyProblems = await load("lib/policy.mjs", "check-policy.mjs", "policyProblems");
const storageProblems = await load("lib/storage.mjs", "check-storage.mjs", "storageProblems");
console.log = log;

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const html = readFileSync(path.join(APP_ROOT, "index.html"), "utf8");
const LANGS = { en: "English", de: "German" };

/** The page as a one-language Vici sees it: the other guide out, the key figures named in `lang`. */
const project = (page, lang) => page
  .replace(new RegExp(`<dialog\\b[^>]*\\bid="guide-${lang === "en" ? "de" : "en"}"[\\s\\S]*?</dialog>`), "")
  .replace(/data-vc-kpi="([^"]+)" data-vc-kpi-de="([^"]+)"/g, (_, e, d) => `data-vc-kpi="${lang === "de" ? d : e}"`);

// ---- the guides ---------------------------------------------------------------------------------------
const whole = guideProblems(html);
const twoLanguages = whole.length === 0;
check(twoLanguages || (whole.length === 1 && /2 guides, expected one/.test(whole[0])), twoLanguages
  ? "guides: this Vici knows pages in two languages, and the page passes as it is"
  : "guides: this Vici checks one guide per page, so each language is checked on its own");
for (const lang of Object.keys(LANGS)) {
  const g = guideProblems(project(html, lang));
  check(!g.length, `guides: the ${LANGS[lang]} guide follows Vici's standard and names the three key figures in ${LANGS[lang]}${g.length ? `: ${g.join("; ")}` : ""}`);
}
const dialog = (lang) => html.match(new RegExp(`<dialog\\b([^>]*\\bid="guide-${lang}"[^>]*)>([\\s\\S]*?)</dialog>`));
const [, enAttrs, enBody] = dialog("en");
const [, deAttrs, deBody] = dialog("de");
check(/<h2 class="vc-dialog__title" id="guide-en-title">How the prototype works<\/h2>/.test(enBody) && /<h2 class="vc-dialog__title" id="guide-de-title">So funktioniert der Prototyp<\/h2>/.test(deBody), "guides: titled for a prototype, as the website's card lists Duty Radar, in both languages");
check(/\blang="en-GB"/.test(enAttrs) && /\blang="de"/.test(deAttrs) && /data-vc-guide-auto/.test(enAttrs) && /data-vc-guide-auto/.test(deAttrs), "guides: each guide says its language (lang) and may open by itself; js/lang.js keeps the other one closed");
// Vici's built-in words in German (guidelines/writing.html, Built-in words in English and German).
const de = { count: /data-vc-guide-count="\{n\} von \{total\}"/.test(deAttrs), rail: /data-vc-guide-rail="Kapitel"/.test(deAttrs), back: />Zurück</.test(deBody), next: />Weiter</.test(deBody), done: /data-vc-guide-done="Starten"/.test(deBody), close: /aria-label="Schließen"/.test(deBody), button: /data-vc-guide-open="guide-de"[^>]*>[\s\S]*?So funktioniert's<\/button>/.test(html) };
check(Object.values(de).every(Boolean), `guides: the German guide uses Vici's German words for its count, rail, Back, Next, Start, Close and header button${Object.values(de).every(Boolean) ? "" : `; wrong: ${Object.entries(de).filter(([, v]) => !v).map(([k]) => k).join(", ")}`}`);

// ---- the byline -----------------------------------------------------------------------------------------
const b = bylineProblems(html);
check(!b.length, `byline: the page's byline follows Vici's standard${b.length ? `: ${b.join("; ")}` : ""}`);
const { COPY } = await import(pathToFileURL(path.join(APP_ROOT, "js/copy.js")).href);
const bylineOf = (lang) => html.match(/<p class="vc-byline">[\s\S]*?<\/p>/)[0]
  .replace(/(data-i18n="byline\.label">)[^<]*/, `$1${COPY[lang]["byline.label"]}`)
  .replace(/(data-i18n="byline\.linkedin">)[^<]*/, `$1${COPY[lang]["byline.linkedin"]}`)
  .replace(/aria-label="[^"]*"( data-i18n-attr="aria-label:byline\.website")/, `aria-label="${COPY[lang]["byline.website"]}"$1`);
const germanByline = bylineProblems(`<html lang="de"><body>${bylineOf("de")}</body></html>`);
const wordsOk = COPY.de["byline.label"] === "Erstellt von" && `Victor Pflüger${COPY.de["byline.linkedin"]}`.startsWith("Victor Pflüger auf LinkedIn") && COPY.de["byline.website"].startsWith("Website von Victor Pflüger") && COPY.de["byline.tip"] === "Website";
check(wordsOk && (!germanByline.length || (germanByline.length === 1 && germanByline[0] === 'no "Built by"')), `byline: the German byline reads "Erstellt von" with Vici's German link names${germanByline.length ? " (this Vici's check knows only \"Built by\"; the words follow its writing guideline)" : ", and Vici's check accepts it"}`);
check(!bylineProblems(`<html><body>${bylineOf("en")}</body></html>`).length, "byline: the English byline the language switch writes back passes Vici's check");

// ---- writing --------------------------------------------------------------------------------------------
const w = writingProblems(html);
check(!w.length, `writing: index.html, both guides included, keeps Vici's writing rules${w.length ? `: ${w.join("; ")}` : ""}`);
const S = await import(pathToFileURL(path.join(APP_ROOT, "js/story.js")).href);
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(APP_ROOT, "data/story.js"), "utf8"), sandbox);
const F = S.factsOf(sandbox.window.DUTY_RADAR);
const strings = (x) => (typeof x === "string" ? [x] : typeof x === "function" ? [] : x && typeof x === "object" ? Object.values(x).flatMap(strings) : []);
const X = existsSync(path.join(APP_ROOT, "js/explain.js")) ? await import(pathToFileURL(path.join(APP_ROOT, "js/explain.js")).href) : null;
check(Boolean(X), "writing: js/explain.js words the ladder, the lists, the comparison and the derivation");
/** Every sentence the panels write in one language: the ladder, the list labels, the comparison, both derivations. */
const explained = (lang) => {
  if (!X) return [];
  const e = X.explain(F, lang);
  return [...strings(e), ...e.ladder.flatMap((r) => [r.term, r.def, ...(r.sub || []).map((x) => x.text)]), ...strings(e.compare), ...["merge", "register_retrieval"].flatMap((t) => strings(e.derive(t)))].map(S.asText);
};
for (const lang of Object.keys(LANGS)) {
  const words = S.words(F, lang);
  const said = [...strings(words.steps), ...strings(words.outcome), ...strings(words.kpi), ...strings(words.evidence), ...Object.values(COPY[lang]), ...explained(lang)].map(S.asText);
  const p = writingProblems(`<html lang="${lang}"><body>${said.map((t) => `<p>${t}</p>`).join("")}</body></html>`);
  check(!p.length, `writing: the ${said.length} ${LANGS[lang]} sentences and labels the page writes keep the writing rules${p.length ? `: ${p.join("; ")}` : ""}`);
}
// ---- the AI notice and the record ids ---------------------------------------------------------------------
const ai = aiNoticeProblems(html);
check(!ai.length, `AI notice: the page can start no live run with a model, so it needs no notice${ai.length ? `: ${ai.join("; ")}` : ""}`);
const { recordIds } = await import(pathToFileURL(path.join(APP_ROOT, "tests/lib/ids.mjs")).href);
// The inventory's ids too: every duty, discarded sentence, cluster and population (its vocabulary's ids are
// words, "umsatz" for Umsatz, and stay out).
const inventory = (() => { const sb = { window: {} }; vm.createContext(sb); vm.runInContext(readFileSync(path.join(APP_ROOT, "data/inventory.js"), "utf8"), sb); return sb.window.DUTY_RADAR_INVENTORY; })();
const IDS = [...new Set([...recordIds(sandbox.window.DUTY_RADAR), ...inventory.duties.map((d) => d.id), ...inventory.discarded.map((d) => d.id), ...inventory.clusters.map((c) => c.id), ...Object.keys(inventory.populations)])];
for (const lang of Object.keys(LANGS)) {
  const words = S.words(F, lang);
  const D = sandbox.window.DUTY_RADAR;
  const said = [...strings(words.steps), ...strings(words.decided), ...strings(words.ask), ...strings(words.kpi), ...strings(words.evidence), ...D.cluster.members.flatMap((m) => [...words.evidence.chips(m), words.evidence.law(m)]), ...Object.keys(S.REASONS).map(words.evidence.reason), ...Object.values(COPY[lang]), ...explained(lang)].map(S.asText);
  const ids = [...recordIdProblems(said.join("\n"), IDS), ...recordIdProblems(html, IDS)];
  check(!ids.length, `record ids: none of the ${IDS.length} ids of data/story.js in the ${said.length} ${LANGS[lang]} sentences and labels or in index.html${ids.length ? `: ${ids.join("; ")}` : ""}`);
}
for (const doc of ["README.md", "DEMO_SCRIPT.md", "DESIGN.md", "DATA_SOURCES.md"]) {
  const text = readFileSync(path.join(APP_ROOT, doc), "utf8").replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
  const p = writingProblems(`<html lang="en-GB"><body><p>${text.replace(/</g, "&lt;")}</p></body></html>`);
  check(!p.length, `writing: ${doc} keeps the writing rules${p.length ? `: ${p.join("; ")}` : ""}`);
}

// ---- the policy and the stores -------------------------------------------------------------------------------
const pol = policyProblems(html);
check(!pol.length, `policy: the page's security policy follows Vici's standard${pol.length ? `: ${pol.join("; ")}` : ""}`);
const { readdirSync } = await import("node:fs");
const sources = Object.fromEntries([["index.html", html], ...readdirSync(path.join(APP_ROOT, "js")).filter((f) => f.endsWith(".js")).map((f) => [`js/${f}`, readFileSync(path.join(APP_ROOT, "js", f), "utf8")])]);
const STORES = ["js/lang.js", "js/main.js", "js/theme.js"];
const st = storageProblems(sources, { allow: STORES });
check(!st.length, `storage: only ${STORES.join(", ")} touch web storage, for the language and the theme; nothing else is stored${st.length ? `: ${st.join("; ")}` : ""}`);

// ---- the checks can fail ----------------------------------------------------------------------------------
check(guideProblems(project(html, "en").replace(/<dialog\b[^>]*vc-guide[\s\S]*?<\/dialog>/, "")).length > 0, "control: a page without its guide is caught");
check(guideProblems(project(html, "de").replace("<div class=\"kpis\"", "<p class=\"vc-stat\" data-vc-kpi=\"Meldungen je Stunde\">48</p><div class=\"kpis\"")).some((p) => /Meldungen je Stunde/.test(p)), "control: a key figure the German guide never names is caught");
const unnamed = project(html, "en").replace(/<dialog\b[\s\S]*?<\/dialog>/, (d) => d.replace(/Relief at stake a year/gi, "Relief a year"));
check(guideProblems(unnamed).some((p) => /Relief at stake a year/.test(p)), "control: an English guide that stops naming Relief at stake a year is caught");
check(aiNoticeProblems(html.replace('<button type="button" class="vc-button play', '<button type="button" data-vc-live class="vc-button play')).length > 0, "control: a control that starts a live run without the AI notice is caught");
check(recordIdProblems(`${S.words(F, "en").steps.twice.agent} (${sandbox.window.DUTY_RADAR.cluster.id})`, IDS).length > 0 && IDS.length >= 40, `control: the cluster's id planted in the agent's words is caught, among ${IDS.length} ids`);
check(bylineProblems(html.replace(/href="https:\/\/victorpflueger\.github\.io\/VIP\/index\.html"/, 'href="#"')).length > 0, "control: a byline without the website link is caught");
check(writingProblems('<html lang="en-GB"><body><p>Fast — and robust.</p></body></html>').length > 0, "control: an em dash and a stock word are caught");
check(policyProblems(html.replace("connect-src 'none'", "connect-src *")).length > 0 || policyProblems(html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")).length > 0, "control: a looser policy is caught");
check(storageProblems({ "js/view.js": "localStorage.setItem('dr.filters', '1')" }, { allow: STORES }).length > 0, "control: a module that isn't allowed to store is caught");
check(recordIdProblems(`Bündel ${inventory.clusters[1].id}`, IDS).length > 0, "control: an id of a cluster nobody priced is caught");

let failed = 0;
for (const [ok, what] of results) { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failed += 1; }
console.log(`(Vici's checks from ${path.relative(APP_ROOT, dir) || dir})`);
if (failed) { console.log(`\n${failed} of ${results.length} checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed.\nVICI STANDARDS OK`);
