// Helpers the browser suites share: a page on the local server with every other host blocked, CSP
// violations and page errors recorded, and an optional first-visit or language setting.
import { NETWORK_NOISE } from "./harness.mjs";

/**
 * Opens the app. opts: { viewport, locale, colorScheme, theme ("dark" stores Vici's choice), skipIntro,
 * lang (stored choice), query }.
 * Returns { page, ctx, problems } where problems lists console errors, page errors, CSP violations
 * and requests to other hosts.
 */
export async function openApp(browser, base, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1600, height: 900 }, locale: opts.locale || "en-GB", colorScheme: opts.colorScheme || "light" });
  const problems = [];
  await ctx.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    problems.push(`request to another host: ${url}`);
    return route.abort();
  });
  if (opts.skipIntro) await ctx.addInitScript(() => { try { localStorage.setItem("dr.introSeen", "1"); } catch { /* blocked */ } });
  if (opts.lang) await ctx.addInitScript((l) => { try { localStorage.setItem("dr.lang", l); } catch { /* blocked */ } }, opts.lang);
  if (opts.theme) await ctx.addInitScript((t) => { try { localStorage.setItem("vc-theme", t); } catch { /* blocked */ } }, opts.theme);
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) problems.push(`console error: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  await page.goto(`${base}${opts.query || ""}`);
  if (opts.waitBoot !== false) {
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    // The boot screen fades out and is then removed; checks and screenshots start after that.
    await page.waitForSelector("#boot", { state: "detached", timeout: 5000 });
  }
  return { page, ctx, problems, csp: () => page.evaluate(() => window.__csp || []) };
}
