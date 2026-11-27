// One word per thing (DR-01): every glossary term of js/copy.js that a screen shows is defined on the ladder,
// and no other word for it appears, on any screen, in English and German. Run in Chromium over the five
// steps, the three decisions and every kind of list, the comparison and the derivation. Quotes of the law,
// German on every screen, are the law's words and are left out.
// Usage: NODE_PATH="$(npm root -g)" node tests/glossary.mjs
import { APP_ROOT, launchBrowser, serveStatic, openPage } from "./lib/harness.mjs";
import { C, LANGS, NAME, checks, atStep, openFrom, closePanel } from "./lib/app.mjs";

const { check, finish } = checks();
const G = C.GLOSSARY || {};
check(Object.keys(G).length >= 7, `the glossary in js/copy.js holds ${Object.keys(G).length} terms`);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (w) => new RegExp(`(^|[^\\p{L}])${esc(w)}(?=$|[^\\p{L}])`, "iu");
/** The glossary's own words found in a text, and the words it says to avoid. */
const scan = (text, lang) => {
  const used = Object.entries(G).filter(([, g]) => g[lang].some((w) => word(w).test(text))).map(([id]) => id);
  const avoided = Object.entries(G).flatMap(([id, g]) => g.avoid[lang].filter((w) => word(w).test(text)).map((w) => `${id}: "${w}"`));
  return { used, avoided };
};
// The check catches what it is for.
const planted = scan("The agent found 48 groups of obligations in 31 statutes.", "en");
check(planted.avoided.length >= 2, `control: a planted text with other words for cluster and duty is caught (${planted.avoided.join(", ")})`);
check(!scan("Two monthly reports ask for the same items.", "en").avoided.length, "control: a sentence in the glossary's words passes");

const server = await serveStatic(APP_ROOT, 8472);
const browser = await launchBrowser();
// The page's text as a reader sees it: visible, without the law's own words (quotes and marked phrases).
const visible = (page) => page.evaluate(() => {
  const skip = (el) => el.closest("blockquote, q, .law-text, [data-quote], .quote-text, .vc-visually-hidden, dialog.vc-guide, script, style");
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const out = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || skip(el) || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible" || Number(cs.opacity) === 0) continue;
    out.push(n.textContent);
  }
  return out.join(" ").replace(/­/g, "").replace(/\s+/g, " ");
});
const KINDS = [
  [0, '#story-text button.count[data-open="laws"]'], [1, '#story-text button.count[data-open="duties"]'], [1, '#story-text button.count[data-open="flagged"]'],
  [1, '#story-text button.count[data-open="discarded"]'], [2, '#story-text button.count[data-open="clusters"]'], [2, "#compare-open"], [2, '#lawmap button.law[data-id="preisstatg"]'],
  [3, "#kpi-stake"], [3, '#evidence .opt[data-type="register_retrieval"] button[data-open]'], [3, '#story-text button.count[data-open="options"]'], [0, "#ladder-open"]
];
try {
  for (const lang of LANGS) {
    const { page, ctx, errors } = await openPage(browser, server.base, `?guide=0&lang=${lang}`, { width: 1280, height: 720 });
    const used = new Set();
    const found = [];
    let screens = 0;
    const look = async (where) => { const r = scan(await visible(page), lang); r.used.forEach((u) => used.add(u)); found.push(...r.avoided.map((a) => `${where}: ${a}`)); screens += 1; };
    for (const [i, d] of [[0], [1], [2], [3], [4], [4, "merge"], [4, "register_retrieval"], [4, "keep"]]) { await atStep(page, i, d || null); await look(`step ${i + 1}${d ? ` ${d}` : ""}`); }
    for (const [step, sel] of KINDS) {
      await atStep(page, step);
      const p = await openFrom(page, sel);
      await look(p.kind);
      await closePanel(page);
    }
    // Every term a screen shows is defined on the ladder.
    await openFrom(page, "#ladder-open");
    const defined = await page.$$eval("#panel dfn[data-term]", (els) => els.map((e) => e.dataset.term));
    const undefinedTerms = [...used].filter((t) => !defined.includes(t));
    check(screens === 19 && !found.length, `${NAME[lang]}: no other word for a glossary term on ${screens} screens${found.length ? `; found: ${[...new Set(found)].slice(0, 6).join("; ")}` : ""}`);
    check(used.size >= 6 && !undefinedTerms.length, `${NAME[lang]}: every term the screens show is defined on the ladder (${[...used].join(", ")})${undefinedTerms.length ? `; not defined: ${undefinedTerms.join(", ")}` : ""}`);
    check(!errors.length, `${NAME[lang]}: no console error${errors.length ? `: ${errors.join("; ")}` : ""}`);
    await ctx.close();
  }
} catch (e) {
  check(false, `the suite ran to the end: ${e.message.split("\n")[0]}`);
} finally {
  await browser.close();
  await server.close();
}
finish("GLOSSARY OK");
