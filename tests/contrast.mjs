// Contrast: every visible text meets WCAG 2.2 AA (4.5:1, large text 3:1) against what is painted
// behind it, in English and German, light and dark, at 1920 × 1080 and 1280 × 720, in seventeen states:
// the guide's first chapter and its talk track, the five steps, the three decisions, the agent at work
// with the bar that asks, and what opens beside the story: the ladder, a law's duties, the clusters, the
// comparison and both derivations, with a law selected and the counts of the story highlighted. The measure is tests/lib/contrast.mjs; it first proves itself on a
// planted page.
// Usage: NODE_PATH="$(npm root -g)" node tests/contrast.mjs
import { APP_ROOT, launchBrowser, serveStatic, NETWORK_NOISE } from "./lib/harness.mjs";
import { contrastShortfalls, settle } from "./lib/contrast.mjs";

const server = await serveStatic(APP_ROOT, 8463);
const browser = await launchBrowser();
const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const IDS = ["target", "reads", "twice", "prices", "decide"];
const CHOICES = ["merge", "register_retrieval", "keep"];

try {
  // The measure catches a grey on grey and passes ink on paper.
  {
    const page = await browser.newPage();
    await page.setContent('<body style="background:#fff"><p style="color:#bbb">Faint text</p><p style="color:#222">Ink</p></body>');
    const r = await contrastShortfalls(page);
    check(r.measured === 2 && r.below.length === 1 && r.below[0].text === "Faint text", "control: the measure catches #bbb on white and passes #222");
    await page.close();
  }
  for (const [width, height] of [[1920, 1080], [1280, 720]]) {
    for (const lang of ["en", "de"]) {
      for (const theme of ["light", "dark"]) {
        const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
        await ctx.addInitScript((t) => { try { localStorage.setItem("vc-theme", t); } catch { /* blocked */ } }, theme);
        await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort("blockedbyclient"));
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e.message || e)));
        page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
        await page.goto(`${server.base}${lang === "de" ? "?lang=de" : ""}`);
        await page.waitForFunction(() => document.documentElement.dataset.boot === "ready", null, { timeout: 15000 });
        await page.waitForTimeout(250);
        const below = [];
        let measured = 0;
        let states = 0;
        const measure = async (state) => {
          await settle(page);
          const r = await contrastShortfalls(page);
          measured += r.measured;
          states += 1;
          for (const b of r.below) below.push(`${state}: "${b.text}" ${b.ratio}:1 < ${b.need}:1 (${b.color} on ${b.bg})`);
        };
        await measure("guide, chapter 1");
        await page.click(`#guide-${lang} .vc-guide__rail .vc-step__button >> nth=-1`);
        await measure("guide, the talk track");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(150);
        for (const id of IDS) {
          await page.click(`#steps [data-step="${id}"] button`);
          await measure(id);
        }
        for (const choice of CHOICES) {
          await page.click(`#decision [data-choice="${choice}"]`);
          await measure(`decided: ${choice}`);
          await page.click("#restart");
          await page.click('#steps [data-step="decide"] button');
        }
        await page.click('#steps [data-step="target"] button');
        await page.click("#play");
        await page.waitForTimeout(3000);
        await measure("the agent reading");
        await page.click("#play");
        // What opens beside the story, each over the step it belongs to.
        const panels = [["twice", "#ladder-open", "the ladder"], ["twice", '#lawmap button.law[data-id="preisstatg"]', "a law's duties"], ["twice", '#story-text button.count[data-open="clusters"]', "the clusters"], ["twice", "#compare-open", "the comparison"], ["prices", '#evidence .opt[data-type="merge"] button[data-open]', "the merge's derivation"], ["prices", '#evidence .opt[data-type="register_retrieval"] button[data-open]', "the register's derivation"]];
        for (const [step, open, name] of panels) {
          await page.click(`#steps [data-step="${step}"] button`);
          await page.click(open);
          await page.waitForFunction(() => document.getElementById("panel")?.dataset.ready === "true", null, { timeout: 8000 });
          await measure(name);
          await page.keyboard.press("Escape");
        }
        check(states === 17 && measured > 600 && !below.length && !errors.length, `${width} × ${height}, ${lang.toUpperCase()}, ${theme}: ${measured} texts measured in ${states} states${below.length ? `; below AA: ${[...new Set(below)].slice(0, 8).join(" | ")}` : ", all at AA or better"}${errors.length ? `; errors: ${errors.join("; ")}` : ""}`);
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}

let failed = 0;
for (const [ok, what] of results) { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failed += 1; }
if (failed) { console.log(`\n${failed} of ${results.length} checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed.\nCONTRAST OK`);
