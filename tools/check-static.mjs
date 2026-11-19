// Static checks of the site (AC-14 and AC-15, run from M1): the security policy in index.html is the
// specification's (as tools/set-csp.mjs writes it), no inline script or style, no script, style, font
// or image from another host, every storage key starts with "dr." (Vici's "vc-theme" is the one shared
// key), no fixed-point string conversion in js/engine/, both language files with identical keys, and
// no key-like string in any published file.
// Usage: node tools/check-static.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { policyFor } from "./set-csp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const problems = [];
const fail = (m) => problems.push(m);

// The security policy.
const html = read("index.html");
const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
const want = policyFor(JSON.parse(read("config/sovereign.json")));
if (!meta) fail("index.html has no Content-Security-Policy meta tag");
else if (meta[1] !== want) fail(`index.html's policy is not the specification's:\n  has  ${meta[1]}\n  want ${want}`);

// No inline code or style, nothing from another host.
for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!/\bsrc="/.test(m[1])) fail("index.html has an inline script");
  else if (/\bsrc="(?:https?:)?\/\//.test(m[1])) fail(`index.html loads a script from another host: ${m[1].trim()}`);
}
if (/<style\b/.test(html)) fail("index.html has an inline style block");
if (/\sstyle="/.test(html)) fail("index.html has a style attribute");
if (/\son[a-z]+="/.test(html)) fail("index.html has an inline event handler");
for (const m of html.matchAll(/<link\b[^>]*href="([^"]+)"/g)) if (/^(?:https?:)?\/\//.test(m[1])) fail(`index.html links a file from another host: ${m[1]}`);

// The app's own files.
const SKIP = new Set(["vici", "node_modules", ".git", "tests", "tools", "data"]);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name);
    if (statSync(path.join(ROOT, rel)).isDirectory()) { if (!SKIP.has(name) && !name.startsWith(".")) walk(rel); }
    else if (/\.(js|mjs|css|html)$/.test(name)) files.push(rel);
  }
})("");
for (const f of files) {
  const text = read(f);
  if (/\.(js|mjs)$/.test(f)) {
    for (const m of text.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*(["'`])([^"'`]+)\1/g)) {
      if (!m[2].startsWith("dr.") && m[2] !== "vc-theme") fail(`${f}: storage key "${m[2]}" does not start with "dr."`);
    }
    for (const m of text.matchAll(/\bfetch\(\s*(["'`])(https?:\/\/[^"'`]+)\1/g)) if (!m[2].startsWith("https://api.anthropic.com/")) fail(`${f}: fetches ${m[2]}`);
    if (f.startsWith(`js${path.sep}engine${path.sep}`) && /toFixed/.test(text)) fail(`${f}: fixed-point string conversion in an engine (round only for display, with Intl.NumberFormat)`);
    if (f.startsWith(`js${path.sep}engine${path.sep}`) && /\b(?:document|window|localStorage|sessionStorage)\b|\bfetch\(/.test(text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""))) fail(`${f}: an engine touches the DOM, storage or the network`);
  }
  if (/@import\s+url\((?:["']?)https?:/.test(text) || /url\((["']?)https?:\/\//.test(text)) fail(`${f}: loads a file from another host`);
}
// STORAGE keys in js/config.js.
const config = read("js/config.js");
for (const m of config.matchAll(/:\s*`\$\{P\}([^`]+)`/g)) if (!/^[a-z]/.test(m[1])) fail(`js/config.js: storage key ${m[1]}`);
if (!/const P = `\$\{APP\.id\}\.`;/.test(config) || !/id: "dr"/.test(config)) fail('js/config.js: the storage prefix is not "dr."');

// Language files: identical keys, no empty value.
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const en = new Map(flat(JSON.parse(read("js/i18n/en.json"))));
const de = new Map(flat(JSON.parse(read("js/i18n/de.json"))));
const diff = [...en.keys()].filter((k) => !de.has(k)).concat([...de.keys()].filter((k) => !en.has(k)));
if (diff.length) fail(`js/i18n: keys only in one language: ${diff.join(", ")}`);
for (const [lang, m] of [["en", en], ["de", de]]) for (const [k, v] of m) if (typeof v !== "string" || !v.trim()) fail(`js/i18n/${lang}.json: ${k} is empty`);

// No key-like string anywhere in the published files.
const KEYLIKE = /sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bghp_[A-Za-z0-9]{30,}|\bxox[abp]-[A-Za-z0-9-]{10,}/;
(function scan(dir) {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    if (name === "node_modules" || name === ".git") continue;
    const rel = path.join(dir, name);
    if (statSync(path.join(ROOT, rel)).isDirectory()) { scan(rel); continue; }
    if (!/\.(js|mjs|json|html|css|md|yml|txt|svg|xml)$/.test(name)) continue;
    const text = read(rel);
    // The test harness's mock key is a deliberate fake, marked as such.
    const cleaned = text.replace(/sk-ant-test-MOCKKEY-[A-Za-z0-9]+/g, "");
    if (KEYLIKE.test(cleaned)) fail(`${rel}: holds a key-like string`);
  }
})("");

for (const p of problems) console.log(`FAIL ${p}`);
if (problems.length) { console.log(`${problems.length} problem${problems.length === 1 ? "" : "s"}.`); process.exit(1); }
console.log(`STATIC OK (${files.length} app files, ${en.size} strings per language)`);
