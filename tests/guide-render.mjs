// Vici's own check of the How it works guide in a browser (scripts/check-guide-render.mjs in ViciDesign),
// run on this page served over http, as the prototype brief asks: it opens once per tab, focus and keys
// behave, ?guide=0 and ?guide=present work, it fills a phone screen, no console error. The check opens the
// page's first guide, the English one. With CHROME_PATH set, Vici's script gets that browser through a
// small preload, since it launches Playwright's own Chromium; on GitHub Actions that one is installed.
// It needs a ViciDesign checkout at ../ViciDesign or in VICI_DIR; without one it says so and fails.
// Usage: NODE_PATH="$(npm root -g)" node tests/guide-render.mjs
import { existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ROOT, serveStatic } from "./lib/harness.mjs";

const dir = [process.env.VICI_DIR, path.resolve(APP_ROOT, "..", "ViciDesign")].filter(Boolean).find((d) => existsSync(path.join(d, "scripts", "check-guide-render.mjs")));
if (!dir) { console.log("FAIL  no ViciDesign checkout with scripts/check-guide-render.mjs at ../ViciDesign or in VICI_DIR"); process.exit(1); }
const server = await serveStatic(APP_ROOT, 8473);
let preload = [];
if (process.env.CHROME_PATH) {
  const shim = path.join(mkdtempSync(path.join(os.tmpdir(), "dr-guide-")), "chrome.mjs");
  const module = process.env.PLAYWRIGHT_MODULE || "playwright";
  writeFileSync(shim, `import { createRequire } from "node:module";
const require = createRequire(${JSON.stringify(pathToFileURL(path.join(dir, "scripts", "x.mjs")).href)});
const pw = require(${JSON.stringify(module)});
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = (o = {}) => launch({ executablePath: ${JSON.stringify(process.env.CHROME_PATH)}, ...o });
`);
  preload = ["--import", pathToFileURL(shim).href];
}
// The check runs in a child process while this one serves the page, so it must not block.
const r = await new Promise((resolve) => {
  const child = spawn(process.execPath, [...preload, path.join(dir, "scripts", "check-guide-render.mjs"), server.base], { cwd: dir, env: process.env });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => { stdout += d; });
  child.stderr.on("data", (d) => { stderr += d; });
  const timer = setTimeout(() => child.kill("SIGKILL"), 180000);
  child.on("close", (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
});
await server.close();
const output = `${r.stdout || ""}${r.stderr || ""}`.trim();
if (process.env.DR_DEBUG) console.log(output);
const ok = r.status === 0 && /GUIDE BEHAVIOUR OK/.test(r.stdout || "");
console.log(`${ok ? "PASS" : "FAIL"}  Vici's check-guide-render on the served page: ${output.split("\n").filter(Boolean).slice(-3).join(" | ")}`);
if (!ok) process.exit(1);
console.log("\nGUIDE RENDER OK");
