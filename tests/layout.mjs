// Layout suite (browser): from 1920 × 1080 down to 1280 × 720 in both languages, nothing scrolls
// sideways, the header, control bar, centrepiece, console and drawer bar are all on screen, and the
// header stays within a quarter of the height; at 360 px nothing scrolls sideways either.
// Usage: node tests/layout.mjs
import { APP_ROOT, launchBrowser, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";

const server = await serveStatic(APP_ROOT, 8233);
const browser = await launchBrowser();
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${detail}` : ""}`); } };
const SIZES = [[1920, 1080], [1600, 900], [1366, 768], [1280, 720]];
try {
  for (const [width, height] of SIZES) {
    for (const lang of ["en", "de"]) {
      const { page, ctx, problems } = await openApp(browser, server.base, { viewport: { width, height }, query: `?lang=${lang}`, skipIntro: true });
      const where = `${width}×${height} ${lang}`;
      check(`${where}: no sideways scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const boxes = await page.evaluate(() => Object.fromEntries(["header", "#controls", ".map-panel", "#console", ".drawer-tabs"].map((s) => {
        const r = document.querySelector(s)?.getBoundingClientRect();
        return [s, r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height } : null];
      })));
      for (const [sel, r] of Object.entries(boxes)) check(`${where}: ${sel} on screen`, r && r.height > 0 && r.top >= 0 && r.bottom <= height + 1 && r.left >= 0 && r.right <= width + 1, JSON.stringify(r));
      check(`${where}: the header takes at most a quarter of the height`, boxes.header && boxes.header.height <= height / 4, `${boxes.header?.height}`);
      check(`${where}: no errors`, problems.length === 0, problems.join("; "));
      await ctx.close();
    }
  }
  const { page, ctx } = await openApp(browser, server.base, { viewport: { width: 360, height: 740 }, skipIntro: true });
  check("360 px: no sideways scrolling", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${await page.evaluate(() => document.documentElement.scrollWidth)}`);
  await ctx.close();
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`LAYOUT OK (${checks} checks)`);
