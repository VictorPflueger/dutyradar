// How lean the prototype stays: limits a change has to argue with. Node.js only.
//   app        at most 8 JavaScript modules, 1,000 lines of app JavaScript and 500 lines of app CSS
//              (vici/ is Vici's, data/ is generated, tests/ and tools/ aren't the app)
//   no lab     no live-mode, API-key or network code in the app: no fetch, no XMLHttpRequest, no
//              WebSocket, no model host, no key, nothing stored under a key, token or secret; 1.0.0's
//              lab stays in the history
//   policy     the page's content security policy connects nowhere (connect-src 'none')
//   controls   one screen: the header's buttons, the five steps, Play and Back to the start, the
//              decision's three buttons, and nothing else to press
//   docs       README.md at most 1,000 words, DEMO_SCRIPT.md at most 1,000 (it holds both languages)
// Each rule is first tried on a planted example that must break it.
// Usage: node tests/lean.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

const LIMITS = { modules: 8, jsLines: 1000, cssLines: 500, readmeWords: 1000, scriptWords: 1000, buttons: 15 };
const LAB = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|api\.anthropic|anthropic-version|x-api-key|sk-ant-|openai|(?:session|local)Storage\.setItem\(\s*["'`][^"'`]*(?:key|token|secret)/i;

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const lines = (text) => text.split("\n").length;
const words = (text) => text.replace(/```[\s\S]*?```/g, " ").replace(/[|#*`>-]/g, " ").split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß0-9€]/.test(w)).length;
const connectNone = (html) => /content="[^"]*\bconnect-src 'none'/.test(html);
const buttonsOf = (html) => (html.replace(/<dialog\b[\s\S]*?<\/dialog>/g, "").match(/<button\b/g) || []).length;

// The rules catch what they are for.
check(LAB.test('await fetch("https://api.anthropic.com/v1/messages")') && LAB.test('sessionStorage.setItem("dr.key", k)') && LAB.test("localStorage.setItem('anthropic_token', t)") && !LAB.test("const fetched = items.filter(Boolean); localStorage.getItem('dr.lang'); sessionStorage.setItem(seen(lang), \"1\");"), "control: the lab pattern catches a model call and a stored key or token, and passes ordinary code");
check(!connectNone(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' https://api.anthropic.com">`), "control: a policy that connects to a host is caught");

const js = readdirSync(path.join(APP_ROOT, "js")).filter((f) => f.endsWith(".js"));
const jsLines = js.reduce((n, f) => n + lines(read(`js/${f}`)), 0);
const css = readdirSync(path.join(APP_ROOT, "css")).filter((f) => f.endsWith(".css"));
const cssLines = css.reduce((n, f) => n + lines(read(`css/${f}`)), 0);
check(js.length <= LIMITS.modules, `app: ${js.length} JavaScript modules, at most ${LIMITS.modules} (1.0.0: 78)`);
check(jsLines <= LIMITS.jsLines, `app: ${jsLines} lines of JavaScript, at most ${LIMITS.jsLines} (1.0.0: 7,272)`);
check(cssLines <= LIMITS.cssLines, `app: ${cssLines} lines of CSS in ${css.length} file(s), at most ${LIMITS.cssLines} (1.0.0: 1,650)`);
const lab = [...js.map((f) => `js/${f}`), "index.html"].filter((f) => LAB.test(read(f)));
check(!lab.length, `no lab: no network, key or model code in the app${lab.length ? `; found in ${lab.join(", ")}` : ""}`);
const html = read("index.html");
check(connectNone(html), "policy: the page connects nowhere (connect-src 'none')");
const buttons = buttonsOf(html);
check(buttons <= LIMITS.buttons, `controls: ${buttons} buttons on the page outside the guides, at most ${LIMITS.buttons}: two guide buttons (one per language), theme, EN and DE, Play, five steps, Back to the start, three decisions`);
const readme = words(read("README.md"));
const script = words(read("DEMO_SCRIPT.md"));
check(readme <= LIMITS.readmeWords, `docs: README.md has ${readme} words, at most ${LIMITS.readmeWords}`);
check(script <= LIMITS.scriptWords, `docs: DEMO_SCRIPT.md has ${script} words, at most ${LIMITS.scriptWords}`);

let failed = 0;
for (const [ok, what] of results) { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failed += 1; }
if (failed) { console.log(`\n${failed} of ${results.length} checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed.\nLEAN OK`);
