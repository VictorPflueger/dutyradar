// Draws the page: the key figures, the law map, the evidence and the story beside it. Every word comes
// from js/story.js or js/copy.js in the language on screen; every figure from data/story.js. A count in
// the story is a button that opens what it counts (data-open, js/panel.js) and marks its laws on the map.

import { STEP_IDS, CHOICES, readingAt, kpisAt, figures, lawName } from "./story.js";
import { legal } from "./format.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
/** A bar's length, set through the style object: the policy allows no style attribute in markup. */
export const setBars = (root) => { for (const el of root.querySelectorAll("[data-p]")) el.style.setProperty("--p", el.dataset.p); };

/** A sentence whose counts are buttons: strings stay text, { text, open } become a count (DR-03, DR-04). */
export const partsHtml = (parts) => (Array.isArray(parts) ? parts : [parts]).map((x) => (typeof x === "string" ? esc(x) : `<button type="button" class="count" aria-haspopup="dialog" aria-controls="panel" data-open="${esc(x.open)}">${esc(x.text)}</button>`)).join("");
/** Writes parts into an element, only when they changed, so a count keeps its focus while the page redraws. */
export function setParts(el, parts) {
  const html = partsHtml(parts);
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
}

// ------------------------------------------------------------------ figures in the page and the guides

/** Writes the figures into every [data-fig] of each guide, in the guide's own language. */
export function fillFigures(F) {
  for (const lang of ["en", "de"]) {
    const figs = figures(F, lang);
    for (const el of $(`guide-${lang}`).querySelectorAll("[data-fig]")) {
      if (!(el.dataset.fig in figs)) throw new Error(`The guide names a figure nobody computes: ${el.dataset.fig}`);
      setText(el, figs[el.dataset.fig]);
    }
  }
}

/** The step buttons' names and hints: each hint is the step's rung on the ladder. */
export function drawStepLabels(w) {
  for (const li of document.querySelectorAll("#steps .vc-step")) {
    const s = w.steps[li.dataset.step];
    setText(li.querySelector(".step-name"), s.label);
    setText(li.querySelector(".vc-step__hint"), s.hint);
  }
}

// ------------------------------------------------------------------ key figures

/** The three tiles at step `index` after `decision`: the stake from the first screen, moved by the decision. */
export function drawKpis(F, w, index, decision) {
  const k = kpisAt(F, index, decision);
  // A figure the decision moved keeps its old value, struck through before the new one (vc-stat__was).
  const tile = (id, label, main, note, of = null, was = null) => {
    const el = $(id);
    setText(el.querySelector(".vc-stat__label"), label);
    setText(el.querySelector(".kpi-main"), main);
    setText(el.querySelector(".kpi-note"), note);
    const old = el.querySelector(".vc-stat__was");
    if (old) { old.hidden = was === null; setText(old, was ?? ""); }
    const tail = el.querySelector(".kpi-of");
    if (tail) { tail.hidden = of === null; setText(tail, of ?? ""); }
    return el;
  };
  tile("kpi-twice", w.kpi.twice.label, w.n(k.twice.value), w.kpi.twice.note, ` ${w.kpi.twice.of} ${w.n(k.twice.of)}`);
  const stake = tile("kpi-stake", w.kpi.stake.label, w.money(k.stake.value), w.kpi.stake[k.stake.note], null, k.stake.was === null ? null : w.money(k.stake.was));
  // "Up to" while the relief rests on the assumed overlap (DR-06).
  const pre = stake.querySelector(".kpi-pre");
  pre.hidden = !k.stake.upTo;
  setText(pre, w.kpi.stake.upTo);
  if (k.stake.done) stake.dataset.tone = "done";
  else delete stake.dataset.tone;
  tile("kpi-cut", w.kpi.cut.label, w.n(k.cut.value), w.kpi.cut.note, ` ${w.kpi.cut.of} ${w.n(k.cut.of)}`, k.cut.was === null ? null : w.n(k.cut.was));
}

// ------------------------------------------------------------------ the law map

/** The two columns of the map, by topic, so the 31 laws fit one screen. */
const COLUMNS = [["statistics", "products"], ["energy", "worktime", "trade"]];

/** Builds the 31 laws in words, by topic; returns { draw(index, p, w), mark(ids), select(id) }. */
export function createLawMap(F) {
  const box = $("lawmap");
  const max = Math.max(...F.D.norms.map((n) => n.duties));
  const byId = new Map(F.D.norms.map((n) => [n.id, n]));
  const families = new Map(F.D.families.map((f) => [f.id, f]));
  const head = '<p class="lawmap-head" aria-hidden="true"><span class="h-law"></span><span class="h-duties"></span><span class="h-twice"></span></p>';
  box.innerHTML = COLUMNS.map((col) => `<div class="lawmap-col">${head}${col.map((fid) => `
    <section class="topic" data-topic="${esc(fid)}" aria-labelledby="topic-${esc(fid)}">
      <h3 class="topic-name" id="topic-${esc(fid)}"></h3>
      <ol class="laws">${families.get(fid).norms.map((id) => `<li><button type="button" class="law" data-id="${esc(id)}" aria-haspopup="dialog" aria-controls="panel" data-open="law:${esc(id)}" data-state="unread" data-dim="false" data-pick="" data-hl="false" data-selected="false"><span class="law-name"></span><span class="law-abbr">${esc(byId.get(id).abbr)}</span><span class="law-duties"><span class="law-bar" aria-hidden="true"><span class="law-fill" data-p="${(byId.get(id).duties / max).toFixed(4)}"></span></span><span class="law-n"></span><span class="vc-visually-hidden law-unit"></span></span><span class="law-twice"><span class="law-k"></span><span class="vc-visually-hidden law-unit2"></span></span><span class="law-pair" aria-hidden="true"></span></button></li>`).join("")}</ol>
    </section>`).join("")}</div>`).join("");
  setBars(box);
  const rows = new Map([...box.querySelectorAll("button.law")].map((el) => [el.dataset.id, el]));
  const pair = Object.fromEntries(F.D.cluster.members.map((m, i) => [m.norm, "AB"[i]]));
  const legend = $("legend");
  let lastLegend = "";
  let marked = new Set();
  let selected = null;
  let last = { index: 0, p: 0, w: null };

  function draw(index, p, w) {
    last = { index, p, w };
    setParts($("stage-title"), w.evidence.stage);
    setParts($("stage-meta"), w.evidence.meta);
    for (const el of box.querySelectorAll(".lawmap-head")) {
      setText(el.querySelector(".h-law"), w.evidence.columns.law);
      setText(el.querySelector(".h-duties"), w.evidence.columns.duties);
      setText(el.querySelector(".h-twice"), w.evidence.columns.twice);
    }
    for (const el of box.querySelectorAll(".topic")) setText(el.querySelector(".topic-name"), w.evidence.topic(el.dataset.topic, families.get(el.dataset.topic).norms.length));
    const reading = index === 0 ? readingAt(F, p) : null;
    // The clusters are known from halfway to "Asked twice"; the two laws priced a little later.
    const twice = index >= 2 || (index === 1 && p >= 0.3);
    const picked = index >= 2 || (index === 1 && p >= 0.7);
    for (const [id, el] of rows) {
      const n = byId.get(id);
      const state = reading ? reading.laws.find((x) => x.id === id).state : "read";
      if (el.dataset.state !== state) el.dataset.state = state;
      el.dataset.dim = String(twice && n.clustered === 0);
      el.dataset.pick = picked && pair[id] ? pair[id] : "";
      el.dataset.hl = String(marked.has(id));
      el.dataset.selected = String(selected === id);
      setText(el.querySelector(".law-name"), lawName(id, w.lang));
      setText(el.querySelector(".law-n"), state === "read" ? w.n(n.duties) : "");
      setText(el.querySelector(".law-unit"), ` ${w.evidence.columns.duties}`);
      setText(el.querySelector(".law-k"), twice && state === "read" ? (n.clustered ? w.n(n.clustered) : "–") : "");
      setText(el.querySelector(".law-unit2"), twice ? ` ${w.evidence.columns.twice}` : "");
      setText(el.querySelector(".law-pair"), el.dataset.pick);
    }
    // The legend says every encoding in words, as far as the map shows it (DR-02).
    const items = ["unit", ...(index === 0 && p === 0 ? ["unread"] : index === 0 ? ["reading", "bar"] : ["bar"]), ...(twice ? ["twice", "dim"] : []), ...(picked ? ["pick"] : []), ...(marked.size ? ["hl"] : []), ...(selected ? ["selected"] : [])];
    const key = `${w.lang}|${items.join()}`;
    if (key !== lastLegend) {
      lastLegend = key;
      legend.innerHTML = items.map((i) => `<li data-item="${i}"><span class="legend-mark" aria-hidden="true"></span>${esc(w.evidence.legend[i])}</li>`).join("");
    }
  }
  const redraw = () => last.w && draw(last.index, last.p, last.w);
  return {
    draw,
    /** Marks the laws a count counts (DR-04); an empty list clears the marks. */
    mark(ids) { marked = new Set(ids); redraw(); },
    /** Selects one law (null for none). */
    select(id) {
      selected = id;
      redraw();
      for (const b of box.querySelectorAll("button.law")) { if (b.dataset.id === id) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); }
    },
    get selected() { return selected; }
  };
}

/** The laws a count counts, for the marks on the map: from data/story.js, never from the screen. */
export function lawsOf(F, open) {
  const norms = F.D.norms;
  const pairIds = F.D.cluster.members.map((m) => m.norm);
  const [kind, arg] = open.split(":");
  if (kind === "laws") return norms.map((n) => n.id);
  if (kind === "duties") return norms.filter((n) => (arg ? n.byType[arg] : n.duties) > 0).map((n) => n.id);
  if (kind === "flagged") return norms.filter((n) => n.candidates > 0).map((n) => n.id);
  if (kind === "discarded") return norms.filter((n) => n.candidates > n.duties).map((n) => n.id);
  if (kind === "clusters") return norms.filter((n) => n.clustered > 0).map((n) => n.id);
  if (["compare", "options", "derive"].includes(kind)) return pairIds;
  return [];
}

// ------------------------------------------------------------------ the evidence under the story

/** A law's sentence with the phrase the agent marked (spaces at its edges stay outside the mark). */
export function lawText(sentence, start, end) {
  while (start < end && /\s/.test(sentence[start])) start += 1;
  while (end > start && /\s/.test(sentence[end - 1])) end -= 1;
  return `${esc(sentence.slice(0, start))}<mark>${esc(sentence.slice(start, end))}</mark>${esc(sentence.slice(end))}`;
}
/** The law in words with its section, linked to the text. */
const lawHead = (mem, w, mark = "") => `<p class="ev-law">${mark ? `<span class="pair-mark" aria-hidden="true">${mark}</span>` : ""}<a class="ev-link" href="${esc(mem.url)}" target="_blank" rel="noopener" aria-label="${esc(`${w.evidence.law(mem)}, ${mem.section} ${mem.abbr} (${w.evidence.newTab})`)}">${esc(legal(`${w.evidence.law(mem)} ${mem.section} `).trim())}<span class="vc-icon vc-icon--external" aria-hidden="true"></span></a></p>`;
const gloss = (text) => (text ? `<p class="ev-gloss">${esc(text)}</p>` : "");

function target(w) {
  const t = w.evidence.target;
  return `<article class="ev ev-target">
    <p class="ev-label">${esc(t.label)}</p>
    <dl class="targets">${t.rows.map((r) => `<div class="target"><dt>${esc(r.name)}</dt><dd><span class="target-share">${esc(r.share)}</span><span class="target-note">${esc(r.note)}</span></dd></div>`).join("")}</dl>
    <p class="ev-note">${esc(t.source)}</p>
  </article>`;
}

function duty(F, w) {
  const mem = F.D.cluster.members[0];
  return `<article class="ev ev-duty">
    <header class="ev-head"><p class="ev-label">${partsHtml(w.evidence.example)}</p>${lawHead(mem, w)}</header>
    <blockquote class="law-text" lang="de">${lawText(mem.sentence, mem.phrase.start, mem.phrase.end)}</blockquote>${gloss(w.evidence.gloss)}
    <ul class="chips">${w.evidence.chips(mem).map((c) => `<li><span class="vc-tag">${esc(c)}</span></li>`).join("")}</ul>
    <p class="ev-note">${esc(w.evidence.official)}</p>
  </article>`;
}

function twin(F, w) {
  const c = F.D.cluster;
  return `<article class="ev ev-twin">
    <header class="ev-head ev-head--row"><p class="ev-label">${esc(w.evidence.twin)}</p><button type="button" class="vc-button vc-button--outline compare-open" id="compare-open" aria-haspopup="dialog" aria-controls="panel" data-open="compare">${esc(w.evidence.compare)}</button></header>
    <div class="twin">${c.members.map((mem, i) => `<section class="twin-law">${lawHead(mem, w, "AB"[i])}<blockquote class="law-text" lang="de">${lawText(mem.sentence, mem.phrase.start, mem.phrase.end)}</blockquote></section>`).join("")}</div>${gloss(w.evidence.twinGloss)}
    <div class="shared"><p class="shared-label">${esc(w.evidence.shared)}</p><ul class="chips">${c.shared.map((i) => `<li><span class="vc-tag vc-tag--feature">${esc(w.item(i.id))}</span></li>`).join("")}</ul></div>
  </article>`;
}

function options(F, w, compact = false) {
  const top = Math.max(F.merge, F.register);
  return `<article class="ev ev-options" data-compact="${compact}">
    <p class="ev-label">${esc(w.evidence.options)}</p>
    <ol class="opts">${CHOICES.map((type) => {
      const value = -F.option[type].net;
      const derive = type === "keep" ? "" : `derive:${type}`;
      // Every euro opens where it comes from (DR-06): the value itself, and in full a line that says so.
      const shown = derive ? `<button type="button" class="opt-value count" aria-haspopup="dialog" aria-controls="panel" data-open="${derive}">${type === "merge" ? `<span class="opt-pre">${esc(w.kpi.stake.upTo)}</span> ` : ""}${esc(w.money(value))}</button>` : `<span class="opt-value">${esc(w.money(value))}</span>`;
      const detail = compact || !w.evidence.option[type].detail ? "" : `<span class="opt-detail">${esc(w.evidence.option[type].detail)}${derive ? ` <button type="button" class="opt-where" aria-haspopup="dialog" aria-controls="panel" data-open="${derive}">${esc(w.evidence.where)}</button>` : ""}</span>`;
      return `<li class="opt" data-type="${type}"><span class="opt-name">${esc(w.evidence.option[type].name)}</span><span class="opt-bar" aria-hidden="true"><span class="opt-fill" data-p="${(value / top).toFixed(4)}"></span></span>${shown}${detail}</li>`;
    }).join("")}</ol>
  </article>`;
}

function dossier(F, w, decision) {
  const o = F.option[decision];
  const keep = decision === "keep";
  const reason = w.evidence.reason(o.reason.code);
  // The relief and the duty it cuts are in the title, the outcome and the tiles above; the dossier holds
  // the decision, its reason and the draft wording.
  const body = keep
    ? `<p class="dossier-text">${esc(w.evidence.keptText)}</p>`
    : `<blockquote class="law-text" lang="de">${esc(legal(o.wording))}</blockquote>${w.evidence.gist ? `<p class="dossier-gist">${esc(w.evidence.gist + o.gist)}</p>` : ""}`;
  return `<article class="ev ev-dossier">
    <header class="ev-head"><p class="ev-label">${esc(w.evidence.dossier)}</p><p class="ev-nothing"><span class="vc-icon vc-icon--lock" aria-hidden="true"></span>${esc(w.evidence.nothingSent)}</p></header>
    <p class="dossier-item"><span class="vc-tag vc-tag--accent"><span class="vc-icon vc-icon--check" aria-hidden="true"></span>${esc(keep ? w.evidence.kept : w.evidence.approved)}</span> <strong>${esc(w.evidence.entry[decision])}</strong> <span class="dossier-reason">${esc(reason)}</span></p>
    ${body}
  </article>`;
}

/** The evidence for step `index` at progress p: what the agent read, found, priced or put in the dossier. */
export function drawEvidence(F, w, index, p, decision) {
  const box = $("evidence");
  // While Play runs from one step to the next, the evidence of the next step comes in part of the way.
  let kind = "";
  if (index === 0) kind = "target";
  else if (index === 1) kind = p < 0.5 ? "duty" : "twin";
  else if (index === 2) kind = p < 0.15 ? "twin" : "options";
  else if (index === 3) kind = "options";
  else if (index === 4 && !decision) kind = "options-compact";
  else if (index === 4) kind = `dossier-${decision}`;
  const key = `${w.lang}|${kind}`;
  box.hidden = !kind;
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.dataset.kind = kind.split("-")[0];
  box.innerHTML = kind === "target" ? target(w) : kind === "duty" ? duty(F, w) : kind === "twin" ? twin(F, w) : kind.startsWith("options") ? options(F, w, kind === "options-compact") : kind ? dossier(F, w, decision) : "";
  setBars(box);
}

// ------------------------------------------------------------------ the story beside it

/** The step's title, words, the agent's sentence, the law picked on the map and who carries the duty; at
 *  the last step the decision and its outcome: once decided, the title states the result. */
export function drawStory(F, w, index, decision, selected) {
  const s = w.steps[STEP_IDS[index]];
  const done = Boolean(decision) && index === STEP_IDS.length - 1;
  setText($("story-title"), done ? w.decided[decision].title : s.title);
  setParts($("story-text"), s.text);
  setParts($("agent-text"), s.agent);
  const norm = selected ? F.D.norms.find((n) => n.id === selected) : null;
  const line = $("law-line");
  line.hidden = !norm;
  if (norm) setText(line, w.relation(norm, index));
  const who = $("who-line");
  who.hidden = index < 2;
  if (index >= 2) setParts(who, w.evidence.who);
  $("story").dataset.decided = String(done);
  $("story").dataset.outcome = done ? decision : "";
  $("decision").hidden = index !== STEP_IDS.length - 1;
  // Once decided, the question and its buttons go: the outcome answers them.
  $("decision-bar").hidden = Boolean(decision);
  const out = $("decision-outcome");
  out.hidden = !decision;
  if (decision) setText(out, w.decided[decision].text);
}
