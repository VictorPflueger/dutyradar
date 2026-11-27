// The panel beside the story (DR-03): what a count counts, the ladder of terms (DR-01), the comparison of
// the two duties (DR-05) and where a euro figure comes from (DR-06). A Vici dialog, not modal, over the
// story column so the law map and the key figures stay in view; the comparison takes more room. Keyboard
// first: it takes focus when it opens, Esc or the close button closes it, and focus returns to the count
// that opened it. data-ready says when its list is complete, for the tests.

import { explain } from "./explain.js";
import { STEP_IDS } from "./story.js";
import { loadInventory, drawDuties, drawDiscarded, drawClusters, drawLaws } from "./lists.js";
import { partsHtml, setBars } from "./view.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}<span class="vc-icon vc-icon--external" aria-hidden="true"></span></a>`;

/** The ladder: one rung per term, its count opening what it counts, the rungs of this step marked. */
function ladderHtml(x, index) {
  return `<ol class="ladder">${x.ladder.map((r) => `<li class="rung" data-rung="${r.id}" data-current="${r.steps.includes(index)}">
    <span class="rung-count"><button type="button" class="count" aria-haspopup="dialog" aria-controls="panel" data-open="${r.open}">${esc(r.count)}</button></span>
    <div class="rung-words"><p class="rung-term">${r.dfn ? `<dfn data-term="${r.dfn}">${esc(r.term)}</dfn>` : esc(r.term)}</p><p class="rung-def">${esc(r.def)}</p>
      ${r.sub ? `<p class="rung-sub">${r.sub.map((s) => `<button type="button" class="count" aria-haspopup="dialog" aria-controls="panel" data-open="${s.open}">${esc(s.text)}</button>`).join(" ")}</p>` : ""}
      ${r.note ? `<p class="rung-def"><dfn data-term="${r.note.term}">${esc(r.note.word)}</dfn>: ${esc(r.note.text)}</p>` : ""}</div>
  </li>`).join("")}</ol>`;
}

/** The two duties side by side, from the law's text, then the agent's reading and this page's (DR-05). */
function compareHtml(x) {
  const c = x.compare;
  const cell = (cl) => `${(cl.quotes || []).map((q) => `<blockquote class="quote" data-quote="${q.id}" lang="de"><a class="section-link" href="${esc(q.url)}" target="_blank" rel="noopener">${esc(x.legal(`${q.section} ${q.abbr}`))}</a> <span class="quote-text">${esc(q.text)}</span>${q.cut ? `<span class="quote-cut" aria-label="${esc(c.cut)}"> …</span>` : ""}</blockquote>${q.en ? `<p class="quote-en">${esc(q.en)}</p>` : ""}`).join("")}${cl.text ? `<p class="cell-text">${esc(cl.text)}</p>` : ""}`;
  return `<div class="vc-table-wrap"><table class="compare">
    <thead><tr><th scope="col"><span class="vc-visually-hidden">${esc(c.title[0])}</span></th>${["A", "B"].map((k) => `<th scope="col" data-pair="${k}"><span class="pair-mark" aria-hidden="true">${k}</span> ${esc(c.pair[k])}</th>`).join("")}</tr></thead>
    <tbody>${c.rows.map((r) => `<tr data-row="${r.id}"><th scope="row">${esc(r.label)}</th>${r.wide ? `<td colspan="2">${cell(r.cells[0])}</td>` : r.cells.map((cl) => `<td>${cell(cl)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div><p class="panel-note">${esc(c.official)} ${esc(c.voice)}</p>`;
}

/** Where a euro figure comes from: the formula, every input with its kind and source, the arithmetic. */
function deriveHtml(x, type) {
  const d = x.derive(type);
  return `<div class="derive">
    <p class="formula">${esc(d.formula)}</p>
    <div class="vc-table-wrap"><table class="vc-table vc-table--compact inputs"><thead><tr>${d.heads.map((h, i) => `<th scope="col"${i === 1 ? ' class="vc-num"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>
      ${d.inputs.map((i) => `<tr data-input="${i.id}"><th scope="row">${esc(i.name)}</th><td class="vc-num">${esc(i.value)}</td><td><span class="kind" data-kind="${i.kind}">${esc(i.kindLabel)}</span></td><td class="input-source">${i.link ? link(i.link, i.source) : esc(i.source)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="derive-h">${esc(d.partsTitle)}</p>
    <ol class="parts">${d.parts.map((p) => `<li>${esc(p.name)}: ${esc(String(p.minutes))} min</li>`).join("")}</ol>
    ${type === "merge" ? `<p class="merged">${esc(d.merged)}</p>` : ""}
    <ol class="steps">${d.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <p class="rounding">${esc(d.rounding)}</p>
    ${d.sensitivity.length ? `<p class="derive-h" id="sensitivity">${esc(d.sensTitle)}</p><p class="sens-note">${esc(d.sensNote)}</p>
    <table class="sensitivity"><tbody>${d.sensitivity.map((r) => `<tr data-share="${r.share}"><th scope="row">${esc(r.label)}</th><td class="vc-num">${esc(r.value)}</td><td class="sens-cell"><span class="sens-bar" data-p="${r.share}"></span></td></tr>`).join("")}</tbody></table>` : ""}
    <p class="calibration">${esc(d.calibration)}</p>
    <ul class="sources">${d.sources.map((s) => `<li>${link(s.url, s.text)}</li>`).join("")}</ul>
    <p class="panel-note">${esc(d.engines)}</p>
  </div>`;
}

/** The three options with what each does and the draft wording; each euro opens its derivation. */
function optionsHtml(F, x, w) {
  return `<ol class="options-list">${F.D.options.map((o) => `<li class="option" data-type="${o.type}">
    <p class="option-head"><strong>${esc(w.evidence.option[o.type].name)}</strong> ${o.type === "keep" ? `<span>${esc(w.money(0))}</span>` : `<button type="button" class="count" aria-haspopup="dialog" aria-controls="panel" data-open="derive:${o.type}">${esc(`${o.type === "merge" ? `${w.kpi.stake.upTo} ` : ""}${w.money(-o.net)}`)}</button>`}</p>
    <p>${esc(x.option[o.type])}</p>
    ${o.wording ? `<blockquote class="law-text" lang="de">${esc(x.legal(o.wording))}</blockquote>` : ""}
  </li>`).join("")}</ol>`;
}

/** The panel: open(kind, from) with a kind such as "law:milog" or "derive:merge"; close(); redraw(). */
export function createPanel({ F, getState, onMark, onSelect, onGo }) {
  const dlg = $("panel");
  let opener = null;
  let current = null;
  let token = 0;

  function place() {
    const wide = current === "compare";
    const top = document.querySelector(".player").getBoundingClientRect().bottom;
    const story = $("story").getBoundingClientRect();
    dlg.style.setProperty("--panel-top", `${Math.round(top)}px`);
    dlg.style.setProperty("--panel-left", `${Math.round(wide ? Math.max(story.left - story.width * 0.55, story.left * 0.4) : story.left)}px`);
  }

  async function draw(kind, settled = Promise.resolve()) {
    const mine = ++token;
    const { lang, index, w } = getState();
    const x = explain(F, lang);
    const [k, arg] = kind.split(":");
    const body = $("panel-body");
    dlg.dataset.kind = kind;
    dlg.dataset.ready = "false";
    let title = [];
    const set = ([t, sub]) => { $("panel-title").textContent = t; $("panel-sub").innerHTML = sub ? partsHtml(sub) : ""; };
    if (k === "ladder") { title = x.title.ladder; body.innerHTML = ladderHtml(x, index); }
    else if (k === "compare") { title = x.compare.title; body.innerHTML = compareHtml(x); }
    else if (k === "derive") { title = x.title.derive(arg === "businesses" ? "merge" : arg); body.innerHTML = deriveHtml(x, arg === "businesses" ? "merge" : arg); }
    else if (k === "options") { title = x.title.options; body.innerHTML = optionsHtml(F, x, w); }
    else {
      body.innerHTML = `<p class="panel-note">${esc(x.lists.loading)}</p>`;
      const norm = k === "law" ? F.D.norms.find((n) => n.id === arg) : null;
      set(k === "law" ? x.title.law({ ...norm, title: norm.title }, norm.clustered) : x.title[k === "clusters" ? "clusters" : k] || x.title.duties);
      let inv;
      try { inv = await loadInventory(); } catch { body.innerHTML = `<p class="vc-alert vc-alert--danger">${esc(x.lists.failed)}</p>`; return; }
      if (mine !== token) return;
      if (k === "law") {
        title = x.title.law(inv.laws.find((l) => l.id === arg), norm.clustered);
        title = [title[0], `${title[1]} · ${w.relation(norm, index)}`];
        await drawDuties(body, inv, x, lang, { law: arg });
      } else if (k === "duties") { title = x.title.duties; await drawDuties(body, inv, x, lang, { pressed: arg ? `type:${arg}` : null }); }
      else if (k === "flagged") { title = x.title.flagged; await drawDuties(body, inv, x, lang, { flagged: true }); }
      else if (k === "discarded") { title = x.title.discarded; await drawDiscarded(body, inv, x, lang); }
      else if (k === "clusters") { title = x.title.clusters; await drawClusters(body, inv, x, lang); }
      else if (k === "laws") { title = x.title.laws; drawLaws(body, inv, x, F.D.families.map((f) => ({ name: w.evidence.topic(f.id, f.norms.length), norms: f.norms }))); }
      if (mine !== token) return;
    }
    set(title);
    setBars(body);
    if (kind === "derive:businesses") $("panel-body").querySelector('tr[data-input="businesses"]')?.scrollIntoView({ block: "center" });
    // Ready once the list is in and the panel has slid in.
    await settled;
    if (mine === token) dlg.dataset.ready = "true";
  }

  async function open(kind, from = null) {
    if (kind === "decide") { close(); onGo(STEP_IDS.length - 1); return; }
    const wasOpen = dlg.open;
    if (!wasOpen || !dlg.contains(from)) opener = from;
    current = kind;
    place();
    if (!wasOpen) dlg.show();
    const settled = Promise.all(dlg.getAnimations().map((a) => a.finished.catch(() => null)));
    onMark(kind);
    if (kind.startsWith("law:")) onSelect(kind.slice(4));
    await draw(kind, settled);
    if (dlg.open && current === kind && (!wasOpen || !dlg.contains(document.activeElement))) $("panel-title").focus({ preventScroll: true });
  }

  function close() {
    if (!dlg.open) return;
    token += 1;
    dlg.close();
  }
  dlg.addEventListener("close", () => {
    current = null;
    onMark(null);
    const back = opener;
    opener = null;
    if (back && document.contains(back) && back.getClientRects().length) back.focus({ preventScroll: true });
    else $("story").focus({ preventScroll: true });
  });
  $("panel-close").addEventListener("click", close);
  dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } });
  window.addEventListener("resize", () => { if (dlg.open) place(); });

  return {
    open, close,
    isOpen: () => dlg.open,
    /** Draws the open panel again, in the page's language. */
    redraw() { if (dlg.open && current) draw(current); }
  };
}
