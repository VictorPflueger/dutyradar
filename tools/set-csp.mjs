// Writes the content security policy into index.html: the specification's policy, with the origin
// of the sovereign endpoint from config/sovereign.json, or without one when no endpoint is enabled.
// Run after every change to config/sovereign.json: node tools/set-csp.mjs (npm run csp).
// node tools/set-csp.mjs --check only reports whether index.html carries the policy it should.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const POLICY = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.anthropic.com SOVEREIGN_ORIGIN; base-uri 'self'; form-action 'none'; object-src 'none'";

/** The policy for a sovereign configuration: its origin, or nothing when it is disabled or empty. */
export function policyFor(sovereign) {
  let origin = "";
  if (sovereign?.enabled && sovereign.base_url) {
    const u = new URL(sovereign.base_url);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") throw new Error(`The sovereign endpoint must use https: ${sovereign.base_url}`);
    origin = u.origin;
  }
  return POLICY.replace(" SOVEREIGN_ORIGIN", origin ? ` ${origin}` : "");
}

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
