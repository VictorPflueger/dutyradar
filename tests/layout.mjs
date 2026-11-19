// Layout suite (browser): from 1920 × 1080 down to 1280 × 720 in both languages, nothing scrolls
// sideways, no text is cut to an ellipsis or a line clamp, the header, control bar, centrepiece,
// console and drawer bar are all on screen, and the header stays within a quarter of the height; at
// 1920 × 1080 and 1280 × 720 all of that in the light and the dark theme too, each with a screenshot
// (eight in all, in the layout folder of the test output); at 360 px nothing scrolls sideways either.
// The ellipsis check proves itself first on a control element that is cut on purpose.
// Usage: node tests/layout.mjs
import path from "node:path";
import { statSync } from "node:fs";
import { APP_ROOT, launchBrowser, outDir, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";

const OUT = await outDir("layout");
const server = await serveStatic(APP_ROOT, 8233);
const browser = await launchBrowser();
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${detail}` : ""}`); } };
const SIZES = [[1920, 1080], [1600, 900], [1366, 768], [1280, 720]];
const SHOT_SIZES = new Set(["1920x1080", "1280x720"]);
const shots = [];

// Every visible element whose text the browser cuts: an ellipsis, or a line clamp that hides lines.
function cutText() {
  return [...document.querySelectorAll("body *")].filter((el) => {
    if (!el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden") return false;
    const ellipsis = s.textOverflow === "ellipsis" && s.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1;
    const clamp = s.webkitLineClamp && s.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1;
    return ellipsis || clamp;
  }).map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).join(".")}` : ""} "${el.textContent.trim().slice(0, 40)}"`);
}

try {
  let controlled = false;
  for (const [width, height] of SIZES) {
    const key = `${width}x${height}`;
    for (const theme of SHOT_SIZES.has(key) ? ["light", "dark"] : ["light"]) {
      for (const lang of ["en", "de"]) {
        const { page, ctx, problems } = await openApp(browser, server.base, { viewport: { width, height }, query: `?lang=${lang}`, skipIntro: true, theme, colorScheme: theme });
        const where = `${width}×${height} ${theme} ${lang}`;
        await page.evaluate(() => document.fonts.ready);
        if (!controlled) {
          // The control: a span cut on purpose must be found, and is removed again before the checks.
          await page.evaluate(() => {
            const span = document.createElement("span");
            span.id = "cut-control";
            span.textContent = "a control text much wider than its box";
            Object.assign(span.style, { display: "inline-block", width: "24px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
            document.body.append(span);
          });
          const found = (await page.evaluate(cutText)).some((s) => s.startsWith("span#cut-control"));
          await page.evaluate(() => document.getElementById("cut-control")?.remove());
          check("the ellipsis check finds a control element cut on purpose", found);
          controlled = true;
        }
        check(`${where}: the ${theme} theme is applied`, await page.evaluate(() => document.documentElement.dataset.theme) === theme);
        check(`${where}: no sideways scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const cut = await page.evaluate(cutText);
        check(`${where}: no text cut to an ellipsis`, cut.length === 0, cut.join("; "));
        const boxes = await page.evaluate(() => Object.fromEntries(["header", "#controls", ".map-panel", "#console", ".drawer-tabs"].map((s) => {
          const r = document.querySelector(s)?.getBoundingClientRect();
          return [s, r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height } : null];
        })));
        for (const [sel, r] of Object.entries(boxes)) check(`${where}: ${sel} on screen`, r && r.height > 0 && r.top >= 0 && r.bottom <= height + 1 && r.left >= 0 && r.right <= width + 1, JSON.stringify(r));
        check(`${where}: the header takes at most a quarter of the height`, boxes.header && boxes.header.height <= height / 4, `${boxes.header?.height}`);
        if (SHOT_SIZES.has(key)) {
          const file = path.join(OUT, `vp-${key}-${theme}-${lang}.png`);
          await page.screenshot({ path: file });
          const ok = statSync(file, { throwIfNoEntry: false })?.size > 0;
          check(`${where}: screenshot written`, ok, file);
          if (ok) shots.push(file);
        }
        check(`${where}: no errors`, problems.length === 0, problems.join("; "));
        await ctx.close();
      }
    }
  }
  const { page, ctx } = await openApp(browser, server.base, { viewport: { width: 360, height: 740 }, skipIntro: true });
  check("360 px: no sideways scrolling", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${await page.evaluate(() => document.documentElement.scrollWidth)}`);
  await ctx.close();
} finally {
  await browser.close();
  await server.close();
}
check("eight screenshots written", shots.length === 8, `${shots.length}`);
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`LAYOUT OK (${checks} checks, ${shots.length} screenshots in ${OUT})`);
