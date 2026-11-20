// The files: everything the page, the modules, the tests and the workflow name is there, nothing of
// 1.0.0's lab is left in the app, and vici/ is Vici unchanged. Node.js only.
//   page       every local file index.html loads (stylesheets, scripts, images, the icon) exists;
//              js/lang.js runs at the end of the body, after both guides and before vici.js
//   modules    every import of every module resolves to a file that exports the imported names, and
//              every module is loaded by the page or imported by one that is
//   tests      every suite the runner lists and every script the workflow runs exists
//   data       data/ holds the generated story only, with its header naming tools/build-story.mjs
//   lab        none of 1.0.0's lab in the tree: no engines, tools, runs, law snapshot or plan files;
//              they are in the git history at release 1.0.0
//   vici       vici/ holds exactly the files vici/README.md lists, each byte for byte as in ViciDesign at
//              the commit the README names, which is on its main branch, the commit CI checks out
//              (with a ViciDesign checkout at ../ViciDesign or VICI_DIR; without one it says so and
//              passes, unless --require-vici is given)
// Usage: node tests/files.mjs [--require-vici]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const exists = (f) => existsSync(path.join(APP_ROOT, f));

// ---- the page --------------------------------------------------------------------------------------
const html = read("index.html");
const local = [...html.matchAll(/\b(?:href|src)="([^"#?]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:|data:)/.test(u));
const missingPage = local.filter((f) => !exists(f));
check(local.length >= 8 && !missingPage.length, `page: the ${local.length} local files index.html loads exist${missingPage.length ? `; missing: ${missingPage.join(", ")}` : ""}`);
const at = (s) => html.indexOf(s);
check(at('<script src="js/lang.js"></script>') > at('id="guide-de"') && at('id="guide-de"') > at('id="guide-en"') && /<script src="vici\/dist\/vici\.js" defer><\/script>/.test(html) && !/js\/lang\.js"[^>]*\b(defer|async|type="module")/.test(html), "page: js/lang.js runs after both guides and before the deferred vici.js, so the right guide opens by itself");

// ---- the modules -----------------------------------------------------------------------------------
const modules = readdirSync(path.join(APP_ROOT, "js")).filter((f) => f.endsWith(".js"));
const exportsOf = (src) => {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) for (const part of m[1].split(",")) names.add(part.trim().split(/\s+as\s+/).pop());
  return names;
};
const broken = [];
let imports = 0;
for (const f of modules) {
  const src = read(`js/${f}`);
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
    imports += 1;
    const target = path.join("js", m[2]);
    if (!exists(target)) { broken.push(`${f} imports ${m[2]}, which is missing`); continue; }
    const have = exportsOf(read(target));
    for (const name of m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (!have.has(name)) broken.push(`${f} imports ${name} from ${m[2]}, which doesn't export it`);
  }
}
check(imports >= 6 && !broken.length, `modules: the ${imports} imports of ${modules.length} modules resolve${broken.length ? `; ${broken.join("; ")}` : ""}`);
const loaded = new Set(local.filter((f) => f.startsWith("js/")).map((f) => f.slice(3)));
const reachable = new Set();
const walk = (f) => { if (reachable.has(f) || !exists(`js/${f}`)) return; reachable.add(f); for (const m of read(`js/${f}`).matchAll(/from\s*"\.\/([^"]+)"/g)) walk(m[1]); };
for (const f of loaded) walk(f);
const orphans = modules.filter((f) => !reachable.has(f));
check(!orphans.length, `modules: every module is loaded by the page or imported by one that is${orphans.length ? `; unused: ${orphans.join(", ")}` : ""}`);

// ---- the tests and the workflow --------------------------------------------------------------------
const runner = read("tests/run-all.mjs");
const suites = [...runner.matchAll(/file:\s*"([^"]+)"/g)].map((m) => m[1]);
check(suites.length >= 8 && suites.every(exists), `tests: the ${suites.length} suites the runner lists exist${suites.filter((f) => !exists(f)).map((f) => `; missing ${f}`).join("")}`);
const workflow = read(".github/workflows/tests.yml");
const named = [...workflow.matchAll(/\bnode\s+(tests\/[\w./-]+\.mjs|tools\/[\w./-]+\.mjs)/g)].map((m) => m[1]);
check(named.length >= 1 && named.every(exists), `workflow: the scripts it runs exist (${named.join(", ")})`);
const testsReadme = read("tests/README.md");
const listedInReadme = [...testsReadme.matchAll(/^\| (\w[\w-]*) \| `node (tests\/[\w.-]+\.mjs)`/gm)].map((m) => m[2]);
check(suites.every((f) => listedInReadme.includes(f)), `tests: tests/README.md lists every suite (${listedInReadme.length})`);

// ---- the data --------------------------------------------------------------------------------------
const dataFiles = readdirSync(path.join(APP_ROOT, "data"));
check(dataFiles.join() === "story.js" && /^\/\/ Generated by tools\/build-story\.mjs from Duty Radar 1\.0\.0 \(commit [0-9a-f]{7}\)/.test(read("data/story.js")) && exists("tools/build-story.mjs"), `data: data/ holds the story generated by tools/build-story.mjs only (${dataFiles.join(", ")})`);
const legacyCommit = (read("tools/build-story.mjs").match(/LEGACY_COMMIT = "([0-9a-f]{7,40})"/) || [])[1];
const workflowLegacy = (workflow.match(/ref:\s*([0-9a-f]{7,40})\s*\n\s*path:\s*legacy/) || [])[1];
check(!!legacyCommit && !!workflowLegacy && workflowLegacy.startsWith(legacyCommit), `data: CI rebuilds the story from the same 1.0.0 commit the tool names (${legacyCommit}, CI ${workflowLegacy ? workflowLegacy.slice(0, 7) : "none"})`);

// ---- 1.0.0's lab is gone from the tree -----------------------------------------------------------------
const LAB = ["js/engine", "js/tools", "js/llm", "js/i18n", "data/corpus", "data/runs", "data/params", "config", "PLAN.md", "TECH_NOTES.md", "SNAPSHOT.md", "REVIEW.md", "package.json", "tools/snapshot-laws.mjs", "tools/author-runs.mjs"];
const left = LAB.filter(exists);
check(!left.length, `lab: none of 1.0.0's engines, tools, runs, law snapshot, config or plan in the tree${left.length ? `; still here: ${left.join(", ")}` : ""}`);
const top = readdirSync(APP_ROOT).filter((f) => !f.startsWith(".")).sort();
const WANT = ["DATA_SOURCES.md", "DEMO_SCRIPT.md", "DESIGN.md", "README.md", "css", "data", "favicon.svg", "index.html", "js", "tests", "tools", "vici"];
check(JSON.stringify(top) === JSON.stringify(WANT), `lab: the top level holds the page, its folders and four documents (${top.join(", ")})`);

// ---- vici/ -----------------------------------------------------------------------------------------
const readme = read("vici/README.md");
const commit = (readme.match(/commit \*\*`([0-9a-f]{7,40})`\*\*/) || [])[1];
const listed = [...readme.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
const all = (dir) => readdirSync(path.join(APP_ROOT, dir)).flatMap((e) => (statSync(path.join(APP_ROOT, dir, e)).isDirectory() ? all(`${dir}/${e}`) : [`${dir}/${e}`]));
const present = all("vici").map((f) => f.slice("vici/".length)).filter((f) => f !== "README.md").sort();
const matches = (pattern, f) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`).test(f);
const unlisted = present.filter((f) => !listed.some((p) => matches(p, f)));
const unmatched = listed.filter((p) => !present.some((f) => matches(p, f)));
check(!!commit && !unlisted.length && !unmatched.length, `vici: its README names the commit (${commit}) and lists exactly the ${present.length} files${unlisted.length ? `; not listed: ${unlisted.join(", ")}` : ""}${unmatched.length ? `; listed, not present: ${unmatched.join(", ")}` : ""}`);
const requireVici = process.argv.includes("--require-vici");
const dir = [process.env.VICI_DIR, path.resolve(APP_ROOT, "..", "ViciDesign")].filter(Boolean).find((d) => existsSync(path.join(d, ".git")));
if (!dir) {
  check(!requireVici, `vici: ${requireVici ? "no" : "(skipped) no"} ViciDesign checkout at ../ViciDesign or in VICI_DIR to compare with`);
} else {
  const show = (f) => { try { return execFileSync("git", ["-C", dir, "show", `${commit}:${f}`], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
  const differ = present.filter((f) => { const theirs = show(f); return !theirs || !theirs.equals(readFileSync(path.join(APP_ROOT, "vici", f))); });
  check(!differ.length, `vici: all ${present.length} files are byte for byte ViciDesign's at ${commit}${differ.length ? `; differ: ${differ.join(", ")}` : ""}`);
  // The copy comes from Vici's main branch, not from a branch that may never be merged.
  const onMain = ["origin/main", "main"].some((ref) => { try { execFileSync("git", ["-C", dir, "merge-base", "--is-ancestor", commit, ref], { stdio: "ignore" }); return true; } catch { return false; } });
  check(onMain, `vici: commit ${commit} is on ViciDesign's main branch`);
  const workflowRef = (workflow.match(/repository:\s*VictorPflueger\/ViciDesign[\s\S]*?ref:\s*([0-9a-f]{40})/) || [])[1];
  check(!!workflowRef && workflowRef.startsWith(commit), `vici: CI checks ViciDesign out at the same commit (${workflowRef ? workflowRef.slice(0, 7) : "none"})`);
}
// What Vici ships, the app takes from Vici: the guide, the byline, the stepper, the pause icon.
const appCss = read("css/app.css");
check(!/data:image\/svg\+xml/.test(appCss) && !/\.vc-guide__chapter\s*>\s*h3:focus/.test(appCss) && /vc-icon--pause/.test(read("js/main.js")) && /class="vc-dialog vc-guide"/.test(html) && /class="vc-byline"/.test(html), "vici: the app draws no icon of its own and takes the guide, the byline and the pause icon from Vici");

let failed = 0;
for (const [ok, what] of results) { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failed += 1; }
if (failed) { console.log(`\n${failed} of ${results.length} checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed.\nFILES OK`);
