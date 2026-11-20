// Shared test harness: finds Playwright, serves the app folder over HTTP and opens pages on it that
// record console errors and block every other host. The prototype needs no CDN and no API, so any
// request to another site is a failure.
import { createRequire } from "node:module";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, mkdir } from "node:fs/promises";

/** The app folder: the parent of tests/. */
export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8"
};

/** Case names given on the command line (empty: run all cases); options such as --require-vici are not cases. */
export const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));
export const wanted = (name) => ONLY.length === 0 || ONLY.includes(name);

/** Where screenshots go (outside the app folder by default). */
export async function outDir(suite) {
  const dir = path.join(process.env.DR_TEST_OUT || path.join(os.tmpdir(), "duty-radar-tests"), suite);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Playwright is not part of the app. Install it once, globally or in any folder:
 *   npm install -g playwright@1.56.0 && npx playwright install chromium
 * and run with NODE_PATH="$(npm root -g)", or point PLAYWRIGHT_MODULE at its folder.
 */
export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core"].filter(Boolean)) {
    try { return require(c); } catch { /* try the next one */ }
  }
  console.error("Playwright was not found. Install it with `npm install -g playwright@1.56.0` and `npx playwright install chromium`,\nthen run the tests with NODE_PATH=\"$(npm root -g)\" (or set PLAYWRIGHT_MODULE to the playwright folder).");
  process.exit(2);
}

/** Chromium from Playwright, or the browser at CHROME_PATH. */
export async function launchBrowser() {
  const { chromium } = loadPlaywright();
  return chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
}

/** Serves `root` on 127.0.0.1:`port`. Returns { base, close }. */
export async function serveStatic(root, port) {
  const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(root, path.normalize(p));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  return { base: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => server.close(r)) };
}

/** Console noise that blocked external requests cause. */
export const NETWORK_NOISE = /Failed to load resource|net::ERR_|ERR_BLOCKED_BY_CLIENT|ERR_FAILED/;

/** The windows the layout is tested in: a 1080p projector, a 1366 laptop, a 1280 × 720 share. */
export const VIEWPORTS = [[1920, 1080], [1366, 768], [1280, 720]];

/**
 * A page on the prototype in a fresh context: theme and stored language set before the app runs,
 * console errors, page errors and security-policy violations recorded, every other host blocked.
 * Returns { page, ctx, errors, outside } once the app says it is ready.
 */
export async function openPage(browser, base, query = "", { width = 1920, height = 1080, theme = "light", storedLang = null, wait = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, locale: "de-DE" });
  await ctx.addInitScript(([t, l]) => {
    try { localStorage.setItem("vc-theme", t); if (l) localStorage.setItem("dr.lang", l); } catch { /* blocked */ }
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  }, [theme, storedLang]);
  const page = await ctx.newPage();
  const errors = [];
  const outside = [];
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith("data:")) return route.continue();
    outside.push(url);
    return route.abort();
  });
  await page.goto(`${base}${query}`);
  if (wait) {
    await page.waitForFunction(() => document.documentElement.dataset.boot === "ready", null, { timeout: 15000 });
    await page.waitForSelector("#boot", { state: "detached", timeout: 5000 });
  }
  const csp = () => page.evaluate(() => window.__csp || []);
  return { page, ctx, errors, outside, csp };
}

/** Closes whichever guide is open. */
export const closeGuide = async (page) => {
  if (await page.evaluate(() => [...document.querySelectorAll("dialog.vc-guide")].some((d) => d.open))) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
};
