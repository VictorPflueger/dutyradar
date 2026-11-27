// The lists behind every count (DR-03), drawn from data/inventory.js, which loads the first time a list
// opens (D3): the 31 laws, the duties of a law, of a type or all of them with filters, every flagged
// sentence, the discarded ones and the 48 clusters. Each duty shows its law in words, its section with a
// link, its sentence with the marked phrase, its type, addressee, how often, to whom, the items it asks
// for, who carries it and its cluster (DR-07).

import { lawText } from "./view.js";
import { legal } from "./format.js";
import { TYPE_ORDER } from "./story.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let loading = null;
/** The inventory, loaded once by a script element (the policy allows scripts from this site only). */
export function loadInventory() {
  if (window.DUTY_RADAR_INVENTORY) return Promise.resolve(window.DUTY_RADAR_INVENTORY);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "data/inventory.js";
    s.onload = () => (window.DUTY_RADAR_INVENTORY ? resolve(window.DUTY_RADAR_INVENTORY) : reject(new Error("data/inventory.js holds no inventory")));
    s.onerror = () => { loading = null; s.remove(); reject(new Error("data/inventory.js did not load")); };
    document.head.append(s);
  });
  return loading;
}

/** A long sentence shows a window around its marked phrase; the phrase itself is never cut. */
const WINDOW = 220;
function sentenceHtml(text, [a, b]) {
  const from = a > WINDOW + 40 ? text.lastIndexOf(" ", a - WINDOW) + 1 : 0;
  const to = text.length - b > WINDOW + 40 ? text.indexOf(" ", b + WINDOW) : text.length;
  return `${from ? "… " : ""}${lawText(text.slice(from, to), a - from, b - from)}${to < text.length ? " …" : ""}`;
}
const FORMULAIC = /^(Reporting|Information|Proof|Documentation|Control|Evaluation) duty of /;
const link = (url, text, cls = "") => `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(legal(text))}<span class="vc-icon vc-icon--external" aria-hidden="true"></span></a>`;

/** One duty as a card. */
function dutyCard(inv, x, d, lang) {
  const L = x.lists;
  const pop = d.population ? inv.populations[d.population] : null;
  const cl = d.cluster ? inv.clusters.find((c) => c.id === d.cluster) : null;
  const own = FORMULAIC.test(d.reading.en) ? "" : ` “${esc(d.reading[lang])}”`;
  return `<li class="duty" data-id="${esc(d.id)}" data-type="${d.type}" data-addressee="${d.addressee}" data-law="${d.law}">
    <p class="duty-head"><strong class="duty-law">${esc(L.law(d.law))}</strong> ${link(d.url, d.section, "duty-section")} <span class="duty-type">${esc(L.type(d.type))}</span></p>
    <p class="duty-facts"><span class="duty-who">${esc(L.who(d.addressee))}</span> · ${esc(L.due(d))} · ${esc(L.to(d.recipient))}</p>
    <blockquote class="law-text" lang="de">${sentenceHtml(d.sentence, d.phrase)}</blockquote>
    <p class="duty-agent"><span class="vc-tag vc-tag--feature vc-tag--sm">Agent</span> ${esc(L.agent(d))}${own}</p>
    <p class="duty-asks">${esc(L.asks)}: ${d.items.map((i) => `<span class="vc-tag vc-tag--sm">${esc(L.item(i))}</span>`).join(" ")}</p>
    ${pop ? `<p class="duty-population">${esc(L.population(pop, d.units, d.units !== pop.units))}</p>` : ""}
    <p class="duty-cluster">${cl ? esc(L.inCluster(cl.duties.length, L.and(cl.laws.map(L.law)), cl.priced)) : esc(L.noCluster)}</p>
  </li>`;
}
function discardedCard(x, d, lang) {
  const L = x.lists;
  return `<li class="discarded" data-id="${esc(d.id)}" data-law="${d.law}" data-status="discarded">
    <p class="duty-head"><strong class="duty-law">${esc(L.law(d.law))}</strong> ${link(d.url, d.section, "duty-section")} <span class="duty-type">${esc(L.filters.gone)}</span></p>
    <blockquote class="law-text" lang="de">${sentenceHtml(d.sentence, d.phrase)}</blockquote>
    <p class="duty-agent"><span class="vc-tag vc-tag--feature vc-tag--sm">Agent</span> ${esc(L.discardedReading)}</p>
  </li>`;
}

/** Draws long lists in slices, so the panel opens at once; resolves once every item is in. */
function fill(ol, items, render) {
  return new Promise((resolve) => {
    let i = 0;
    const step = () => {
      const html = [];
      for (const end = Math.min(items.length, i + 150); i < end; i += 1) html.push(render(items[i]));
      ol.insertAdjacentHTML("beforeend", html.join(""));
      if (i < items.length) requestAnimationFrame(step);
      else resolve();
    };
    step();
  });
}

/**
 * The duties (and, for "flagged", the discarded sentences) of a list, with filters by type, addressee,
 * law and result. `only` narrows the list itself: { law } or nothing; `pressed` presses a filter at once.
 */
export async function drawDuties(body, inv, x, lang, { law = null, flagged = false, pressed = null } = {}) {
  const L = x.lists;
  const duties = inv.duties.filter((d) => !law || d.law === law);
  const gone = flagged ? inv.discarded : [];
  const count = (key, val) => duties.filter((d) => d[key] === val).length;
  const chip = (id, label, n) => `<button type="button" class="filter vc-chip vc-chip--sm" data-filter="${id}" data-count="${n}" aria-pressed="${pressed === id}">${esc(label)} <span class="filter-count">${n}</span></button>`;
  const types = TYPE_ORDER.filter((t) => count("type", t));
  const whos = ["wirtschaft", "verwaltung"].filter((a) => count("addressee", a));
  body.innerHTML = `<div class="filters" role="group" aria-label="Filter">
      ${flagged ? `<span class="filter-label">${esc(L.filters.status)}</span>${chip("status:kept", L.filters.kept, duties.length)}${chip("status:discarded", L.filters.gone, gone.length)}` : ""}
      <span class="filter-label">${esc(L.filters.type)}</span>${types.map((t) => chip(`type:${t}`, L.type(t, true), count("type", t))).join("")}
      ${whos.length > 1 ? `<span class="filter-label">${esc(L.filters.who)}</span>${whos.map((a) => chip(`addressee:${a}`, L.who(a), count("addressee", a))).join("")}` : ""}
      ${law ? "" : `<label class="filter-label" for="filter-law">${esc(L.filters.law)}</label><select id="filter-law" class="filter-law vc-select"><option value="">${esc(L.filters.allLaws)}</option>${inv.laws.map((l) => `<option value="${l.id}">${esc(L.law(l.id))}</option>`).join("")}</select>`}
    </div>
    <p class="panel-note">${esc(L.note)}</p>
    <ol class="duties-list"></ol>`;
  const ol = body.querySelector(".duties-list");
  await fill(ol, [...duties.map((d) => ["d", d]), ...gone.map((d) => ["g", d])], ([k, d]) => (k === "d" ? dutyCard(inv, x, d, lang) : discardedCard(x, d, lang)));
  // Filters: one pressed per group at most; pressing the pressed one shows all again.
  const apply = () => {
    const on = Object.fromEntries([...body.querySelectorAll('button.filter[aria-pressed="true"]')].map((b) => b.dataset.filter.split(":")));
    const lawPick = body.querySelector("#filter-law")?.value || "";
    for (const li of ol.children) {
      const discardedItem = li.classList.contains("discarded");
      const show = (!on.status || on.status === (discardedItem ? "discarded" : "kept")) && (!on.type || (!discardedItem && li.dataset.type === on.type)) && (!on.addressee || (!discardedItem && li.dataset.addressee === on.addressee)) && (!lawPick || li.dataset.law === lawPick);
      li.hidden = !show;
    }
  };
  body.querySelector(".filters").addEventListener("click", (e) => {
    const b = e.target.closest("button.filter");
    if (!b) return;
    const group = b.dataset.filter.split(":")[0];
    const was = b.getAttribute("aria-pressed") === "true";
    for (const o of body.querySelectorAll(`button.filter[data-filter^="${group}:"]`)) o.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-pressed", String(!was));
    apply();
  });
  body.querySelector("#filter-law")?.addEventListener("change", apply);
  apply();
}

/** The discarded sentences alone. */
export async function drawDiscarded(body, inv, x, lang) {
  body.innerHTML = `<p class="panel-note">${esc(x.lists.note)}</p><ol class="duties-list"></ol>`;
  await fill(body.querySelector(".duties-list"), inv.discarded, (d) => discardedCard(x, d, lang));
}

/** The 48 clusters, the priced one first, each with its laws, shared items, confidence and member duties. */
export async function drawClusters(body, inv, x, lang) {
  const L = x.lists;
  const duty = new Map(inv.duties.map((d) => [d.id, d]));
  body.innerHTML = `<p class="panel-note">${esc(L.note)} ${esc(L.confidence)}</p><ol class="clusters-list"></ol>`;
  await fill(body.querySelector(".clusters-list"), inv.clusters, (c) => `<li class="cluster" data-priced="${c.priced}">
    <p class="cluster-head"><strong>${esc(L.and(c.laws.map(L.law)))}</strong> <span class="vc-tag vc-tag--sm ${c.priced ? "vc-tag--feature" : ""}">${esc(c.priced ? L.priced : L.notPriced)}</span></p>
    <p class="cluster-facts">${esc(L.cluster(c.shared.map(L.item).join(", "), c.duties.length))} ${new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { minimumFractionDigits: 2 }).format(c.confidence)}</p>
    <ol class="cluster-members">${c.duties.map((id) => duty.get(id)).map((d) => `<li class="member" data-id="${esc(d.id)}">${esc(L.law(d.law))} ${link(d.url, d.section)} · ${esc(L.type(d.type))} · ${esc(L.who(d.addressee))}</li>`).join("")}</ol>
  </li>`);
}

/** The 31 laws by topic, each with its kind, counts, full title and a link. */
export function drawLaws(body, inv, x, families) {
  const L = x.lists;
  const law = new Map(inv.laws.map((l) => [l.id, l]));
  body.innerHTML = `${families.map((f) => `<section class="laws-topic"><h3>${esc(f.name)}</h3><ol class="laws-list">${f.norms.map((id) => law.get(id)).map((l) => `<li class="law-item" data-id="${l.id}">
    <p><strong>${esc(L.law(l.id))}</strong> <span class="law-item-abbr">${esc(l.abbr)}</span> · ${link(l.url, l.title)}</p>
    <p class="law-facts">${esc(L.lawItem(l).split(" · ").slice(0, -1).join(" · "))} · <button type="button" class="count" aria-haspopup="dialog" aria-controls="panel" data-open="law:${l.id}">${esc(L.lawItem(l).split(" · ").pop())}</button></p>
  </li>`).join("")}</ol></section>`).join("")}`;
}
