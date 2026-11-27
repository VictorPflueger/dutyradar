// What opens beside the story, in Chromium: the law map in words, the lists behind every count, the links
// between map and story, the comparison, the derivation and who carries the duty (DR-02 to DR-07).
//   names       DR-02: every law's name in words on the map, visible, in both languages, at 1280 × 720 and
//               1920 × 1080, never cut, never ellipsed, never only in a title attribute
//   legend      DR-02: the legend says the unit and every encoding in words; the topics read as topic
//               areas with their size; the first step says how the 31 laws were chosen
//   lists       DR-03: each law's list holds as many duties as the map shows; the cluster list has 48 rows
//               holding 203 duties, the priced one first; each type filter's count equals its rung and
//               filters to that many
//   keys        DR-03: a count opens its list by click and by Enter; Esc closes it and focus returns to it
//   links       DR-04: at step 3 the story's "48 clusters" highlights exactly the laws with duties in clusters
//               and opens the cluster list; the cluster's name highlights exactly its two laws
//   tile-story  DR-04: selecting a law tells in the story how it relates to the step, in both languages
//   compare     DR-05: both laws' scope sections, A and B as on the map and in the story, and whether the
//               same businesses are shown or assumed, in both languages
//   derive      DR-06: the key figure and each option open their derivation: every input with its kind and
//               source, the five activities, the 12 minutes, the arithmetic, the rounding, the sensitivity
//   kpis        DR-06: "up to" before the relief at stake while the overlap is assumed, the assumption marked
//               where it is used, in both languages
//   affected    DR-07: who carries the duty and how many, at steps 3 to 5, equal to the data, and moved by a
//               decision only where the engines move it
//   addressees  DR-07: every duty in the lists shows its addressee and, where run R1 gave one, its
//               population with size and kind
// Usage: NODE_PATH="$(npm root -g)" node tests/panels.mjs [case …]
import path from "node:path";
import { APP_ROOT, launchBrowser, serveStatic, wanted, outDir, openPage, ONLY } from "./lib/harness.mjs";
import { D, I, S, X, F, W, LANGS, NAME, norm, checks, atStep, openFrom, panelState, closePanel, mapState } from "./lib/app.mjs";

const { check, finish } = checks();
const out = await outDir("panels");
const server = await serveStatic(APP_ROOT, 8471);
const browser = await launchBrowser();
const open = (lang, size = [1280, 720], theme = "light") => openPage(browser, server.base, `?guide=0&lang=${lang}`, { width: size[0], height: size[1], theme });
const CASES = ["names", "legend", "lists", "keys", "links", "tile-story", "compare", "derive", "kpis", "affected", "addressees"];
const ran = [];
const fmt = (x, lang) => new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB").format(x);
const twiceLaws = D.norms.filter((n) => n.clustered > 0).map((n) => n.id).sort();
const pairLaws = D.cluster.members.map((m) => m.norm).sort();
const errorsSeen = [];

try {
  // ---- names -----------------------------------------------------------------------------------------------
  if (wanted("names")) {
    ran.push("names");
    for (const size of [[1280, 720], [1920, 1080]]) {
      for (const lang of LANGS) {
        const { page, ctx, errors } = await open(lang, size);
        const problems = [];
        for (const step of [0, 2]) {
          await atStep(page, step);
          await page.waitForTimeout(300);
          const rows = await page.evaluate(() => {
            const stage = document.querySelector(".stage").getBoundingClientRect();
            return [...document.querySelectorAll("#lawmap button.law")].map((b) => {
              const name = b.querySelector(".law-name");
              const r = name.getBoundingClientRect();
              const cs = getComputedStyle(name);
              const titled = [b, ...b.querySelectorAll("*")].some((el) => el.hasAttribute("title"));
              return { id: b.dataset.id, text: name.textContent.replace(/­/g, "").trim(), w: r.width, h: r.height, inside: r.left >= stage.left - 0.5 && r.right <= stage.right + 0.5 && r.top >= stage.top - 0.5 && r.bottom <= stage.bottom + 0.5 && r.bottom <= innerHeight + 0.5, over: name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1, ellipsis: cs.textOverflow === "ellipsis", hidden: cs.visibility !== "visible" || Number(cs.opacity) < 0.5 || cs.display === "none", titled };
            });
          });
          if (rows.length !== 31) problems.push(`step ${step + 1}: ${rows.length} laws on the map`);
          for (const r of rows) {
            const want = S.plain(S.lawName(r.id, lang));
            if (r.text !== want) problems.push(`${r.id}: "${r.text}" ≠ "${want}"`);
            if (!r.w || !r.h || r.hidden || !r.inside) problems.push(`${r.id}: name not visible on the screen`);
            if (r.over || r.ellipsis) problems.push(`${r.id}: name cut`);
            if (r.titled) problems.push(`${r.id}: a title attribute`);
          }
        }
        await page.screenshot({ path: path.join(out, `names-${size[0]}-${lang}.png`) });
        check(!problems.length && !errors.length, `names: ${size[0]} × ${size[1]}, ${NAME[lang]}: all 31 laws named in words on the map, visible, uncut, with no title attribute${problems.length ? `; ${[...new Set(problems)].slice(0, 6).join("; ")}` : ""}${errors.length ? `; errors: ${errors.join("; ")}` : ""}`);
        errorsSeen.push(...errors);
        await ctx.close();
      }
    }
  }

  // ---- legend ----------------------------------------------------------------------------------------------
  if (wanted("legend")) {
    ran.push("legend");
    for (const lang of LANGS) {
      const { page, ctx } = await open(lang);
      const legend = async () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#legend li[data-item]")].filter((li) => li.getClientRects().length).map((li) => [li.dataset.item, li.textContent.replace(/­/g, "").replace(/\s+/g, " ").trim()])));
      await atStep(page, 0);
      const first = { legend: await legend(), story: norm(await page.textContent("#story-text")), topics: await page.$$eval(".topic-name", (els) => els.map((e) => e.textContent.replace(/­/g, "").replace(/\s+/g, " ").trim())) };
      await atStep(page, 2);
      const third = await legend();
      const unit = lang === "de" ? /Pflichten/ : /duties/i;
      const words = lang === "de"
        ? { bar: /Balken/, twice: /Bündel/, dim: /blass/, pick: /\bA\b.*\bB\b/, unread: /nicht gelesen|noch nicht/ }
        : { bar: /\bbar\b/, twice: /cluster/, dim: /pale/, pick: /\bA\b.*\bB\b/, unread: /not read/ };
      const missing = [];
      if (!unit.test(first.legend.unit || "") || !unit.test(third.unit || "")) missing.push("unit");
      for (const k of ["bar", "twice", "dim", "pick"]) if (!words[k].test(third[k] || "")) missing.push(k);
      if (!words.unread.test(first.legend.unread || "")) missing.push("unread");
      check(!missing.length, `legend: ${NAME[lang]}: the unit and every encoding in words (${Object.keys(third).join(", ")}; at the start ${Object.keys(first.legend).join(", ")})${missing.length ? `; missing: ${missing.join(", ")}` : ""}`);
      const topicWant = D.families.map((f) => (lang === "de" ? `Thema: ${S.TOPICS[f.id][1]} · ${fmt(f.norms.length, lang)} ${f.norms.length === 1 ? "Vorschrift" : "Vorschriften"}` : `Topic: ${S.TOPICS[f.id][0]} · ${fmt(f.norms.length, lang)} ${f.norms.length === 1 ? "law" : "laws"}`));
      check(JSON.stringify([...first.topics].sort()) === JSON.stringify([...topicWant].sort()), `legend: ${NAME[lang]}: the groups read as topic areas with their size (${first.topics.join(" | ")})`);
      const chosen = lang === "de" ? [/von Hand/, /fünf Themen/, /liest jeden Satz/] : [/chosen by hand/, /five topic areas/, /reads every sentence/];
      check(chosen.every((re) => re.test(first.story)) && !/(found|fand|findet) (the|die) (31|laws|Vorschriften)/i.test(first.story), `legend: ${NAME[lang]}: the first step says how the 31 laws were chosen and that the agent reads every sentence, not that it found them`);
      await ctx.close();
    }
  }

  // ---- lists -----------------------------------------------------------------------------------------------
  if (wanted("lists")) {
    ran.push("lists");
    const { page, ctx, errors } = await open("en");
    await atStep(page, 2);
    const shown = (await mapState(page)).shown;
    const off = [];
    for (const n of D.norms) {
      const p = await openFrom(page, `#lawmap button.law[data-id="${n.id}"]`);
      if (p.kind !== `law:${n.id}` || p.duties.length !== Number(shown[n.id].duties) || p.duties.length !== n.duties) off.push(`${n.id}: shows ${shown[n.id].duties}, lists ${p.duties.length} (${p.kind})`);
      if (n.id === "preisstatg") await page.screenshot({ path: path.join(out, "list-price-statistics.png") });
      await closePanel(page);
    }
    check(!off.length, `lists: for each of the 31 laws its list holds as many duties as the map shows${off.length ? `; off: ${off.slice(0, 5).join("; ")}` : ""}`);
    const cl = await openFrom(page, '#story-text button.count[data-open="clusters"]');
    const members = cl.clusters.reduce((a, c) => a + c.members, 0);
    check(cl.kind === "clusters" && cl.clusters.length === 48 && members === 203 && cl.clusters[0].priced && cl.clusters.filter((c) => c.priced).length === 1, `lists: the cluster list has ${cl.clusters.length} rows holding ${members} duties, the priced one first`);
    const notPriced = cl.clusters.filter((c) => !c.priced && !/not priced in this run/.test(c.text));
    check(!notPriced.length, `lists: every cluster nobody priced says "not priced in this run"${notPriced.length ? ` (${notPriced.length} don't)` : ""}`);
    await page.screenshot({ path: path.join(out, "list-clusters.png") });
    await closePanel(page);
    // The type filters of the duty list against the rungs of the ladder.
    await atStep(page, 1);
    const all = await openFrom(page, '#story-text button.count[data-open="duties"]');
    const rungs = Object.fromEntries(X.explain(F, "en").ladder.flatMap((r) => r.sub || []).filter((s) => s.open.startsWith("duties:")).map((s) => [s.open.slice(7), s.value]));
    const typeFilters = all.filters.filter((f) => f.id.startsWith("type:"));
    const filterOff = [];
    for (const f of typeFilters) {
      const t = f.id.slice(5);
      if (f.count !== rungs[t]) filterOff.push(`${t}: filter ${f.count}, rung ${rungs[t]}`);
      await page.click(`#panel button.filter[data-filter="${f.id}"]`);
      await page.waitForTimeout(60);
      const n = (await panelState(page)).duties.length;
      if (n !== f.count) filterOff.push(`${t}: filters to ${n}`);
      await page.click(`#panel button.filter[data-filter="${f.id}"]`);
    }
    check(all.duties.length === 745 && typeFilters.length === 6 && !filterOff.length, `lists: the ${all.duties.length} duties filter by type, and each filter's count equals its rung (${typeFilters.map((f) => `${f.id.slice(5, 9).toLowerCase()} ${f.count}`).join(", ")})${filterOff.length ? `; off: ${filterOff.join("; ")}` : ""}`);
    check(all.filters.some((f) => f.id === "addressee:wirtschaft") && all.filters.some((f) => f.id === "addressee:verwaltung") && await page.$("#panel select.filter-law") !== null, "lists: the duty list also filters by addressee and by law");
    await closePanel(page);
    const discarded = await openFrom(page, '#story-text button.count[data-open="discarded"]');
    check(discarded.kind === "discarded" && discarded.discarded.length === D.totals.rejected, `lists: the ${discarded.discarded.length} discarded sentences open from their count`);
    await closePanel(page);
    errorsSeen.push(...errors);
    await ctx.close();
  }

  // ---- keys ------------------------------------------------------------------------------------------------
  if (wanted("keys")) {
    ran.push("keys");
    const { page, ctx, errors } = await open("en");
    await atStep(page, 1);
    const sel = '#story-text button.count[data-open="duties"]';
    const byKey = await openFrom(page, sel, { key: true });
    const inside = await page.evaluate(() => document.getElementById("panel").contains(document.activeElement));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    const after = await page.evaluate((s) => ({ open: document.getElementById("panel").open, back: document.activeElement === document.querySelector(s) }), sel);
    check(byKey.kind === "duties" && inside && !after.open && after.back, `keys: Enter on "${W.en.n(F.duties)} duties" opens the list with focus inside; Esc closes it and focus returns to the count`);
    const byClick = await openFrom(page, sel);
    await page.click("#panel-close");
    await page.waitForTimeout(100);
    const closed = await page.evaluate((s) => ({ open: document.getElementById("panel").open, back: document.activeElement === document.querySelector(s) }), sel);
    check(byClick.kind === "duties" && !closed.open && closed.back, "keys: a click opens it too, and the close button gives focus back to the count");
    await atStep(page, 2);
    const law = '#lawmap button.law[data-id="milog"]';
    const fromMap = await openFrom(page, law, { key: true });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    check(fromMap.kind === "law:milog" && await page.evaluate((s) => document.activeElement === document.querySelector(s), law), "keys: Enter on a law on the map opens its duties; Esc returns focus to the law");
    const tile = await openFrom(page, "#kpi-stake", { key: true });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    check(tile.kind === "derive:merge" && await page.evaluate(() => document.activeElement?.id === "kpi-stake"), "keys: Enter on Relief at stake a year opens its derivation; Esc returns focus to the tile");
    const counts = await page.evaluate(() => [...document.querySelectorAll("button.count, button.kpi, button.law")].filter((b) => b.getClientRects().length).every((b) => b.tagName === "BUTTON" && b.type === "button" && !b.disabled && b.dataset.open));
    check(counts, "keys: every count is a button that says what it opens (data-open)");
    errorsSeen.push(...errors);
    await ctx.close();
  }

  // ---- links -----------------------------------------------------------------------------------------------
  if (wanted("links")) {
    ran.push("links");
    for (const lang of LANGS) {
      const { page, ctx, errors } = await open(lang);
      await atStep(page, 2);
      const forty = await page.$$eval('#story-text button.count[data-open="clusters"]', (bs) => bs.map((b) => b.textContent));
      const p = await openFrom(page, `#story-text button.count[data-open="clusters"] >> text=/${fmt(48, lang)}/`);
      const hl = (await mapState(page)).hl;
      check(p.kind === "clusters" && JSON.stringify(hl) === JSON.stringify(twiceLaws), `links: ${NAME[lang]}: "${forty.find((t) => t.includes("48"))}" in the story opens the cluster list and highlights exactly the ${twiceLaws.length} laws with duties in clusters (${hl.length} highlighted)`);
      await closePanel(page);
      const cleared = (await mapState(page)).hl;
      const name = await openFrom(page, '#agent-text button.count[data-open="compare"]');
      const pair = (await mapState(page)).hl;
      check(!cleared.length && name.kind === "compare" && JSON.stringify(pair) === JSON.stringify(pairLaws), `links: ${NAME[lang]}: the cluster's name highlights exactly its two laws (${pair.join(", ")}) and opens their comparison; closing a list clears the highlight`);
      await closePanel(page);
      const marks = await page.evaluate(() => ({ map: Object.fromEntries([...document.querySelectorAll("#lawmap button.law[data-pick]")].filter((b) => b.dataset.pick).map((b) => [b.dataset.id, b.querySelector(".law-pair").textContent.trim()])), story: [...document.querySelectorAll("#evidence .pair-mark")].map((m) => m.textContent.trim()) }));
      const sorted = (o) => JSON.stringify(Object.entries(o).sort());
      check(sorted(marks.map) === sorted(S.words(F, lang).pair) && marks.story.join() === "A,B", `links: ${NAME[lang]}: at step 3 the two laws carry A and B on the map and in the story (${Object.entries(marks.map).map(([k, v]) => `${v} ${k}`).join(", ")})`);
      errorsSeen.push(...errors);
      await ctx.close();
    }
  }

  // ---- tile-story ------------------------------------------------------------------------------------------
  if (wanted("tile-story")) {
    ran.push("tile-story");
    const { page, ctx, errors } = await open("en");
    const off = [];
    for (const [step, id] of [[0, "preisstatg"], [1, "preisstatg"], [2, "preisstatg"], [2, "hdldlstatg"], [3, "gewo"]]) {
      await atStep(page, step);
      await page.click(`#lawmap button.law[data-id="${id}"]`);
      await page.waitForFunction(() => document.getElementById("panel").dataset.ready === "true");
      await closePanel(page);
      const norm0 = D.norms.find((n) => n.id === id);
      const en = norm(await page.textContent("#law-line"));
      const selected = (await mapState(page)).selected;
      await page.evaluate(() => window.dutyRadar.setLang("de"));
      await page.waitForTimeout(80);
      const de = norm(await page.textContent("#law-line"));
      await page.evaluate(() => window.dutyRadar.setLang("en"));
      if (en !== norm(W.en.relation(norm0, step)) || de !== norm(W.de.relation(norm0, step)) || selected.join() !== id) off.push(`step ${step + 1}, ${id}: "${en}" | "${de}" | ${selected.join()}`);
    }
    check(!off.length, `tile-story: selecting a law marks it and tells in the story how it relates to the step, in English and German${off.length ? `; off: ${off.join(" || ")}` : ""}`);
    errorsSeen.push(...errors);
    await ctx.close();
  }

  // ---- compare ---------------------------------------------------------------------------------------------
  if (wanted("compare")) {
    ran.push("compare");
    for (const lang of LANGS) {
      const { page, ctx, errors } = await open(lang);
      await atStep(page, 2);
      const p = await openFrom(page, "#compare-open");
      const c = await page.evaluate(() => {
        const t = document.querySelector("#panel table.compare");
        const links = (row) => [...t.querySelectorAll(`tr[data-row="${row}"] a`)].map((a) => a.getAttribute("href"));
        return {
          heads: [...t.querySelectorAll("thead th[data-pair]")].map((th) => ({ pair: th.dataset.pair, text: th.textContent.replace(/­/g, "").replace(/\s+/g, " ").trim() })),
          who: links("who"), rows: [...t.querySelectorAll("tbody tr[data-row]")].map((r) => r.dataset.row),
          quotes: [...t.querySelectorAll("blockquote[data-quote]")].map((q) => ({ id: q.dataset.quote, text: q.querySelector(".quote-text").textContent })),
          verdict: t.querySelector('tr[data-row="law"]')?.textContent.replace(/\s+/g, " ").trim() || ""
        };
      });
      const want = S.words(F, lang).pair;
      const headsOk = c.heads.length === 2 && c.heads.every((h) => want[D.cluster.members.find((m) => h.text.includes(S.plain(S.lawName(m.norm, lang))))?.norm] === h.pair);
      check(p.kind === "compare" && headsOk, `compare: ${NAME[lang]}: two columns, A and B, named as on the map (${c.heads.map((h) => `${h.pair} ${h.text}`).join(" | ")})`);
      check(c.who.some((h) => h.endsWith("hdldlstatg/__3.html")) && c.who.some((h) => h.endsWith("prodgewstatg/__1.html")) && c.who.some((h) => h.endsWith("prodgewstatg/__2.html")), `compare: ${NAME[lang]}: who must report, from the scope sections of both laws (${c.who.map((h) => h.split("/").slice(-2).join("/")).join(", ")})`);
      check(["who", "what", "when", "whom", "agent", "law", "check"].every((r) => c.rows.includes(r)), `compare: ${NAME[lang]}: who, what, how often, to whom, the agent's reading, what the law text shows and what to check before a merge (${c.rows.join(", ")})`);
      const quotes = Object.values(D.compare).flatMap((x) => [...x.who, ...x.what, ...x.when, ...x.whom, x.duty]);
      const wrong = c.quotes.filter((q) => { const d = quotes.find((x) => x.id === q.id); return !d || q.text !== d.text; });
      check(c.quotes.length >= 8 && !wrong.length, `compare: ${NAME[lang]}: ${c.quotes.length} quotes, each the law's text as data/story.js holds it${wrong.length ? `; off: ${wrong.map((q) => q.id).join(", ")}` : ""}`);
      const say = lang === "de" ? /angenommen, nicht belegt/ : /assumed, not shown/;
      check(say.test(c.verdict), `compare: ${NAME[lang]}: says plainly that the same businesses are assumed, not shown ("${c.verdict.slice(0, 90)}…")`);
      await page.screenshot({ path: path.join(out, `compare-${lang}.png`) });
      errorsSeen.push(...errors);
      await ctx.close();
    }
  }

  // ---- derive ----------------------------------------------------------------------------------------------
  if (wanted("derive")) {
    ran.push("derive");
    for (const lang of LANGS) {
      const { page, ctx, errors } = await open(lang);
      const off = [];
      for (const [step, sel, type] of [[0, "#kpi-stake", "merge"], [3, '#evidence .opt[data-type="merge"] button[data-open]', "merge"], [3, '#evidence .opt[data-type="register_retrieval"] button[data-open]', "register_retrieval"]]) {
        await atStep(page, step);
        const p = await openFrom(page, sel);
        if (p.kind !== `derive:${type}`) { off.push(`${sel} opens ${p.kind}`); await closePanel(page); continue; }
        const d = X.explain(F, lang).derive(type);
        const shown = await page.evaluate(() => {
          const t = (el) => (el ? el.textContent.replace(/­/g, "").replace(/\s+/g, " ").trim() : "");
          const panel = document.getElementById("panel");
          return {
            inputs: [...panel.querySelectorAll("tr[data-input]")].map((r) => ({ id: r.dataset.input, kind: r.querySelector("[data-kind]")?.dataset.kind, text: t(r), source: t(r.querySelector(".input-source")) })),
            parts: [...panel.querySelectorAll("ol.parts li")].map(t), merged: t(panel.querySelector(".merged")), steps: [...panel.querySelectorAll("ol.steps li")].map(t), rounding: t(panel.querySelector(".rounding")), sens: [...panel.querySelectorAll("table.sensitivity tbody tr")].map(t), formula: t(panel.querySelector(".formula"))
          };
        });
        for (const x of d.inputs) {
          const row = shown.inputs.find((r) => r.id === x.id);
          if (!row) off.push(`${type}: no row for ${x.id}`);
          else if (row.kind !== x.kind || !row.source || !row.text.includes(norm(x.value))) off.push(`${type}: ${x.id} shows "${row.text.slice(0, 60)}"`);
        }
        if (shown.formula !== norm(d.formula)) off.push(`${type}: formula`);
        if (shown.steps.join(" | ") !== d.steps.map(norm).join(" | ")) off.push(`${type}: arithmetic`);
        if (shown.rounding !== norm(d.rounding)) off.push(`${type}: rounding`);
        if (type === "merge" && (shown.parts.length !== 5 || !shown.merged || shown.sens.length !== 4)) off.push(`${type}: activities ${shown.parts.length}, merged "${shown.merged}", sensitivity ${shown.sens.length}`);
        if (step === 3 && type === "merge") await page.screenshot({ path: path.join(out, `derive-${lang}.png`) });
        await closePanel(page);
      }
      check(!off.length, `derive: ${NAME[lang]}: the key figure and both options open their derivation with every input, its kind and source, the five activities, the 12 minutes, the arithmetic, the rounding and the sensitivity${off.length ? `; off: ${off.slice(0, 6).join("; ")}` : ""}`);
      errorsSeen.push(...errors);
      await ctx.close();
    }
  }

  // ---- kpis ------------------------------------------------------------------------------------------------
  if (wanted("kpis")) {
    ran.push("kpis");
    for (const lang of LANGS) {
      const { page, ctx, errors } = await open(lang);
      const w = W[lang];
      const upTo = lang === "de" ? "bis zu" : "up to";
      const assumed = lang === "de" ? /angenommen|Annahme/ : /assumed/;
      const off = [];
      const tile = () => page.evaluate(() => { const t = document.getElementById("kpi-stake"); const pre = t.querySelector(".kpi-pre"); return { pre: pre && pre.getClientRects().length ? pre.textContent.trim() : "", main: t.querySelector(".kpi-main").textContent, note: t.querySelector(".kpi-note").textContent.replace(/\s+/g, " ").trim() }; });
      for (const [step, decision] of [[0, null], [1, null], [2, null], [3, null], [4, null], [4, "keep"], [4, "merge"], [4, "register_retrieval"]]) {
        await atStep(page, step, decision);
        const t = await tile();
        const k = S.kpisAt(F, step, decision);
        const taken = decision === "merge" || decision === "register_retrieval";
        if (taken ? t.pre : t.pre !== upTo) off.push(`${step + 1}${decision ? ` ${decision}` : ""}: before the value "${t.pre}"`);
        if (norm(t.main) !== norm(w.money(k.stake.value))) off.push(`${step + 1}: value ${t.main}`);
        // Until a decision the note marks the assumption; after one it says what was decided.
        if (!decision && (!assumed.test(t.note) || !t.note.includes(fmt(F.businesses, lang)))) off.push(`${step + 1}: note "${t.note}" marks no assumption`);
      }
      await atStep(page, 3);
      const merge = norm(await page.textContent('#evidence .opt[data-type="merge"]'));
      if (!merge.includes(upTo)) off.push(`the merge option doesn't say ${upTo}`);
      const title = norm(await page.textContent("#story-title"));
      if (!title.includes(upTo)) off.push(`step 4's title doesn't say ${upTo}`);
      // At the decision too, where the options are drawn compact.
      await atStep(page, 4);
      const atDecision = norm(await page.textContent('#evidence .opt[data-type="merge"]'));
      if (!atDecision.includes(upTo)) off.push(`at the decision the merge option doesn't say ${upTo}`);
      check(!off.length, `kpis: ${NAME[lang]}: "${upTo}" stands before the relief at stake while the overlap is assumed, the tile's note marks the assumption, and the merge and step 4 say "${upTo}" too${off.length ? `; off: ${off.join("; ")}` : ""}`);
      errorsSeen.push(...errors);
      await ctx.close();
    }
  }

  // ---- affected --------------------------------------------------------------------------------------------
  if (wanted("affected")) {
    ran.push("affected");
    for (const lang of LANGS) {
      const { page, ctx, errors } = await open(lang);
      const w = W[lang];
      const want = norm(S.asText(w.evidence.who));
      const off = [];
      const who = () => page.evaluate(() => { const el = document.getElementById("who-line"); return el && el.getClientRects().length ? el.textContent.replace(/­/g, "").replace(/\s+/g, " ").trim() : null; });
      for (const [step, decision] of [[0, null], [1, null], [2, null], [3, null], [4, null], [4, "merge"], [4, "register_retrieval"], [4, "keep"]]) {
        await atStep(page, step, decision);
        const line = await who();
        if (step < 2 ? line !== null : line !== want) off.push(`${step + 1}${decision ? ` ${decision}` : ""}: "${line}"`);
        const note = norm(await page.textContent("#kpi-stake .kpi-note"));
        const k = S.kpisAt(F, step, decision);
        if (note !== norm(w.kpi.stake[k.stake.note])) off.push(`${step + 1}${decision ? ` ${decision}` : ""}: the tile's note "${note}"`);
      }
      const cap = fmt(D.cluster.population.units, lang);
      check(!off.length && want.includes(cap) && (lang === "de" ? /angenommen|nicht bekannt/ : /assumed|not known/).test(want), `affected: ${NAME[lang]}: "${want}" at steps 3 to 5, unmoved by a decision, which moves only the tile's note${off.length ? `; off: ${off.join("; ")}` : ""}`);
      errorsSeen.push(...errors);
      await ctx.close();
    }
  }

  // ---- addressees ------------------------------------------------------------------------------------------
  if (wanted("addressees")) {
    ran.push("addressees");
    for (const lang of LANGS) {
      const { page, ctx, errors } = await open(lang);
      await atStep(page, 1);
      await openFrom(page, '#story-text button.count[data-open="duties"]');
      const cards = await page.evaluate(() => [...document.querySelectorAll("#panel li.duty")].map((li) => ({ id: li.dataset.id, who: (li.querySelector(".duty-who")?.textContent || "").replace(/\s+/g, " ").trim(), pop: (li.querySelector(".duty-population")?.textContent || "").replace(/\s+/g, " ").trim() })));
      const off = [];
      for (const c of cards) {
        const d = I.duties.find((x) => x.id === c.id);
        if (!d) { off.push(`${c.id}: not in the inventory`); continue; }
        if (!norm(c.who).toLowerCase().includes(S.addresseeName(d.addressee, lang).toLowerCase())) off.push(`${c.id}: addressee "${c.who}"`);
        if (d.population) {
          const p = I.populations[d.population];
          const kind = d.units === p.units ? (lang === "de" ? "angenommen" : "assumed") : (lang === "de" ? "höchstens" : "at most");
          if (!c.pop.includes(fmt(d.units, lang)) || !c.pop.includes(kind) || !c.pop.toLowerCase().includes((lang === "de" ? p.de : p.en).toLowerCase().slice(0, 12))) off.push(`${c.id}: population "${c.pop}"`);
        } else if (c.pop) off.push(`${c.id}: a population R1 didn't give`);
      }
      check(cards.length === 745 && !off.length, `addressees: ${NAME[lang]}: all ${cards.length} duties show their addressee and, where R1 gave one, their population with size and kind${off.length ? `; off: ${off.slice(0, 4).join("; ")}` : ""}`);
      errorsSeen.push(...errors);
      await ctx.close();
    }
  }
  check(!errorsSeen.length, `no console or page error${errorsSeen.length ? `: ${[...new Set(errorsSeen)].slice(0, 4).join(" | ")}` : ""}`);
} catch (e) {
  check(false, `the suite ran to the end: ${e.message.split("\n")[0]}`);
} finally {
  await browser.close();
  await server.close();
}
const unknown = ONLY.filter((c) => !CASES.includes(c));
check(!unknown.length, `known cases${unknown.length ? `; unknown: ${unknown.join(", ")}` : ""}`);
finish(`PANELS OK (${ran.join(", ")})`);
