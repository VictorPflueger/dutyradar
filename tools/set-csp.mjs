// Writes the content security policy into index.html: the specification's policy, with the origin
// of the sovereign endpoint from config/sovereign.json, or without one when no endpoint is enabled.
// Run after every change to config/sovereign.json: node tools/set-csp.mjs (npm run csp).
// node tools/set-csp.mjs --check only reports whether index.html carries the policy it should.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { policyFor } from "../js/policy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The policy itself lives in js/policy.js, which Assumptions & diagnostics checks the page against too.
export { POLICY, policyFor } from "../js/policy.js";

const META = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(">)/;

export function run(argv = process.argv.slice(2)) {
  const sovereign = JSON.parse(readFileSync(path.join(ROOT, "config/sovereign.json"), "utf8"));
  const want = policyFor(sovereign);
  const file = path.join(ROOT, "index.html");
  const html = readFileSync(file, "utf8");
  const m = html.match(META);
  if (!m) throw new Error("index.html has no Content-Security-Policy meta tag");
  if (argv.includes("--check")) {
    if (m[2] !== want) throw new Error(`index.html's policy differs from config/sovereign.json:\n  has  ${m[2]}\n  want ${want}`);
    console.log("CSP OK");
    return;
  }
  writeFileSync(file, html.replace(META, `$1${want}$3`));
  console.log(`index.html: ${want}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { run(); } catch (e) { console.error(e.message); process.exit(1); }
}
