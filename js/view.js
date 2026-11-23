// Draws the page: the key figures, the law map, the evidence under it and the story beside it. Every
// word comes from js/story.js or js/copy.js in the language on screen; every figure from data/story.js.

import { STEP_IDS, CHOICES, readingAt, kpisAt, figures, familyName } from "./story.js";
import { legal } from "./format.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };

// ------------------------------------------------------------------ figures in the page and the guides

/** Writes the figures into every [data-fig] of each guide, in the guide's own language. */
export function fillFigures(F) {
  for (const lang of ["en", "de"]) {
    const guide = $(`guide-${lang}`);
    const figs = figures(F, lang);
    for (const el of guide.querySelectorAll("[data-fig]")) {
      if (!(el.dataset.fig in figs)) throw new Error(`The guide names a figure nobody computes: ${el.dataset.fig}`);
      setText(el, figs[el.dataset.fig]);
    }
  }
}

/** The step buttons' names and hints. */
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
  if (k.stake.done) stake.dataset.tone = "done";
  else delete stake.dataset.tone;
  tile("kpi-cut", w.kpi.cut.label, w.n(k.cut.value), w.kpi.cut.note, ` ${w.kpi.cut.of} ${w.n(k.cut.of)}`, k.cut.was === null ? null : w.n(k.cut.was));
}

// ------------------------------------------------------------------ the law map

/** Builds the 31 laws, grouped by family; returns draw(index, p, w) for their states and the legend. */
export function createLawMap(F) {
  const box = $("lawmap");
  const max = Math.max(...F.D.norms.map((n) => n.duties));
  const byId = new Map(F.D.norms.map((n) => [n.id, n]));
  const pick = new Set(F.D.cluster.members.map((m) => m.norm));
  box.innerHTML = F.D.families.map((f) => `
    <div class="family" data-family="${esc(f.id)}">
      <p class="family-name" data-en="${esc(familyName(f, "en"))}" data-de="${esc(familyName(f, "de"))}">${esc(f.en)}</p>
      <ul class="laws">${f.norms.map((id) => {
        const n = byId.get(id);
        // The count comes first; the law's short title shows on hover and to a screen reader, not on the tile.
        return `<li class="law" data-id="${esc(id)}" data-state="unread" title="${esc(`${n.abbr}: ${n.title}`)}"><span class="vc-visually-hidden">${esc(n.abbr)}</span><span class="law-count vc-tabular"></span><span class="law-bar" aria-hidden="true"><span class="law-fill"></span></span></li>`;
      }).join("")}</ul>
    </div>`).join("");
  const tiles = new Map([...box.querySelectorAll(".law")].map((el) => [el.dataset.id, el]));
  for (const [id, el] of tiles) el.querySelector(".law-fill").style.setProperty("--p", (byId.get(id).duties / max).toFixed(4));
  const legend = $("legend");
  let lastLegend = "";

  return function draw(index, p, w) {
    setText($("stage-title"), w.evidence.stage);
    setText($("stage-meta"), w.evidence.meta);
    for (const el of box.querySelectorAll(".family-name")) setText(el, el.dataset[w.lang]);
    const reading = index === 0 ? readingAt(F, p) : null;
    const dim = index >= 2 || (index === 1 && p >= 0.3);
    const picked = index >= 2 || (index === 1 && p >= 0.7);
    for (const [id, el] of tiles) {
      const n = byId.get(id);
      const state = reading ? reading.laws.find((x) => x.id === id).state : "read";
      el.dataset.state = state;
      el.dataset.dim = String(dim && n.clustered === 0);
      el.dataset.pick = String(picked && pick.has(id));
      setText(el.querySelector(".law-count"), state === "read" ? w.n(n.duties) : "");
    }
    const items = index === 0 && p === 0 ? ["unread"] : index === 0 ? ["reading", "read"] : dim ? ["read", "dim", ...(picked ? ["pick"] : [])] : ["read"];
    const key = `${w.lang}|${items.join()}`;
    if (key !== lastLegend) {
      lastLegend = key;
      legend.innerHTML = items.map((i) => `<li data-item="${i}"><span class="legend-mark" aria-hidden="true"></span>${esc(w.evidence.legend[i])}</li>`).join("");
    }
  };
}

// ------------------------------------------------------------------ the evidence under the map

/** A law's sentence with the phrase the agent marked (spaces at its edges stay outside the mark). */
function lawText(sentence, phrase) {
  let { start, end } = phrase;
  while (start < end && /\s/.test(sentence[start])) start += 1;
  while (end > start && /\s/.test(sentence[end - 1])) end -= 1;
  return `${esc(sentence.slice(0, start))}<mark>${esc(sentence.slice(start, end))}</mark>${esc(sentence.slice(end))}`;
}
/** The law in words with its section, linked to the text: the citation is the evidence, and its short
 *  title (§ 11 HdlDlStatG) shows on hover. */
const lawHead = (mem, w) => `<p class="ev-law"><a class="ev-link" href="${esc(mem.url)}" target="_blank" rel="noopener" title="${esc(legal(`${mem.section} ${mem.abbr} `).trim())}" aria-label="${esc(`${w.evidence.law(mem)}, ${mem.section} ${mem.abbr} (${w.evidence.newTab})`)}">${esc(legal(`${w.evidence.law(mem)}, ${mem.section} `).trim())}<span class="vc-icon vc-icon--external" aria-hidden="true"></span></a></p>`;
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
    <header class="ev-head"><p class="ev-label">${esc(w.evidence.example)}</p>${lawHead(mem, w)}</header>
    <blockquote class="law-text" lang="de">${lawText(mem.sentence, mem.phrase)}</blockquote>${gloss(w.evidence.gloss)}
    <ul class="chips">${w.evidence.chips(mem).map((c) => `<li><span class="vc-tag">${esc(c)}</span></li>`).join("")}</ul>
    <p class="ev-note">${esc(w.evidence.official)}</p>
  </article>`;
}

function twin(F, w) {
  const c = F.D.cluster;
  return `<article class="ev ev-twin">
    <p class="ev-label">${esc(w.evidence.twin)}</p>
    <div class="twin">${c.members.map((mem) => `<section class="twin-law">${lawHead(mem, w)}<blockquote class="law-text" lang="de">${lawText(mem.sentence, mem.phrase)}</blockquote></section>`).join("")}</div>${gloss(w.evidence.twinGloss)}
    <div class="shared"><p class="shared-label">${esc(w.evidence.shared)}</p><ul class="chips">${c.shared.map((i) => `<li><span class="vc-tag vc-tag--feature">${esc(w.item(i.id))}</span></li>`).join("")}</ul></div>
    <p class="ev-total">${esc(w.evidence.together)}</p>
  </article>`;
}

function options(F, w, compact = false) {
  const top = Math.max(F.merge, F.register);
  return `<article class="ev ev-options" data-compact="${compact}">
    <p class="ev-label">${esc(w.evidence.options)}</p>
    <ol class="opts">${CHOICES.map((type) => {
      const value = -F.option[type].net;
      return `<li class="opt" data-type="${type}"><span class="opt-name">${esc(w.evidence.option[type].name)}</span><span class="opt-bar" aria-hidden="true"><span class="opt-fill" data-p="${(value / top).toFixed(4)}"></span></span><span class="opt-value vc-tabular">${esc(w.money(value))}</span>${compact || !w.evidence.option[type].detail ? "" : `<span class="opt-detail">${esc(w.evidence.option[type].detail)}</span>`}</li>`;
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
  // While Play runs from one step to the next, the evidence of the next step comes in part of the way:
  // the second law's sentence halfway to "Asked twice", the priced options early on the way to "It prices".
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
  for (const fill of box.querySelectorAll(".opt-fill")) fill.style.setProperty("--p", fill.dataset.p);
}

// ------------------------------------------------------------------ the story beside it

/** The step's title, words, the agent's sentence and, at the last step, the decision and its outcome:
 *  once decided, the title states the result and the box under it says why. */
export function drawStory(w, index, decision) {
  const s = w.steps[STEP_IDS[index]];
  const done = Boolean(decision) && index === STEP_IDS.length - 1;
  setText($("story-title"), done ? w.decided[decision].title : s.title);
  setText($("story-text"), s.text);
  setText($("agent-text"), s.agent);
  $("story").dataset.decided = String(done);
  $("story").dataset.outcome = done ? decision : "";
  $("decision").hidden = index !== STEP_IDS.length - 1;
  // Once decided, the question and its buttons go: the outcome answers them.
  $("decision-bar").hidden = Boolean(decision);
  const out = $("decision-outcome");
  out.hidden = !decision;
  if (decision) setText(out, w.decided[decision].text);
}
