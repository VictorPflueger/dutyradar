// Bottom drawer shell: tabs (Options, Outbox, Audit), counts, open/close, and Vici's byline in the
// middle of the bar: "Built by", Victor's hexagon portrait and name, and his LinkedIn and website.
// Duty Radar: the app passes its tabs in, and every string comes from the app's i18n and follows a
// language switch (REVIEW.md, adapted modules).

import { h } from "./dom.js";
import { icon } from "./icons.js";
import { t, onLangChange } from "./i18n.js";

/**
 * Vici's byline, as on all of Victor's pages. The portrait and LinkedIn's logo are Vici's files in
 * vici/assets/ (the content security policy allows no image from another site); either link opens
 * in a new tab, so a running demo is never left.
 */
function byline() {
  return h("p", { class: "vc-byline" },
    h("span", { class: "vc-byline__label", "data-i18n": "drawer.built_by" }, t("drawer.built_by")),
    h("span", { class: "vc-byline__person" },
      h("span", { class: "vc-avatar vc-avatar--xs" }, h("img", { src: "vici/assets/brand/portrait-96.jpg", alt: "", width: "96", height: "96" })),
      h("span", { class: "vc-byline__name" }, "Victor Pflüger")),
    h("span", { class: "vc-byline__links" },
      h("a", { class: "vc-byline__icon", href: "https://www.linkedin.com/in/victorpflueger", target: "_blank", rel: "author noopener", "aria-label": t("drawer.linkedin"), "data-i18n-attr": "aria-label:drawer.linkedin" },
        h("img", { class: "vc-platform-mark", src: "vici/assets/marks/linkedin.png", alt: "", width: "840", height: "779" })),
      h("a", { class: "vc-byline__icon", href: "https://victorpflueger.github.io/VIP/index.html", target: "_blank", rel: "author noopener", "aria-label": t("drawer.website"), "data-i18n-attr": "aria-label:drawer.website" },
        h("span", { class: "vc-icon vc-icon--globe-hex", "aria-hidden": "true" }))));
}

/** The sister apps' tabs; Duty Radar passes its own (labelKey: an i18n key). */
const TABS = [
  { id: "options", labelKey: "drawer.tab.options" },
  { id: "outbox", labelKey: "drawer.tab.outbox" },
  { id: "audit", labelKey: "drawer.tab.audit" }
];

export function createDrawer(root, { onToggle, tabs: tabDefs = TABS } = {}) {
  const tabs = new Map();
  const panels = new Map();
  // The bar holds three groups: the tabs on the left, the byline in the middle, the note and the
  // toggle on the right. Only the tabs form the tab list.
  const tabBar = h("div", { class: "drawer-tabs" });
  // Vici's tab list; this module owns the tabs (a click on the open tab closes the drawer), so the
  // list has no .vc-tabs around it for vici.js to bind.
  const tabList = h("div", { class: "vc-tabs__list drawer-tablist", role: "tablist", "aria-label": t("drawer.tablist") });
  const body = h("div", { class: "drawer-body" });
  let open = false;

  let active = tabDefs[0].id;
  for (const def of tabDefs) {
    const count = h("span", { class: "vc-badge count", hidden: true }, "0");
    const label = h("span", { class: "drawer-tab-label" }, t(def.labelKey));
    const btn = h("button", {
      class: "drawer-tab", type: "button", role: "tab", id: `tab-${def.id}`,
      "aria-selected": "false", "aria-controls": `panel-${def.id}`
    }, label, count);
    btn.addEventListener("click", () => {
      if (open && active === def.id) setOpen(false);
      else show(def.id);
    });
    tabs.set(def.id, { btn, count, label, labelKey: def.labelKey });
    tabList.appendChild(btn);
    const panel = h("div", { class: "drawer-panel", id: `panel-${def.id}`, role: "tabpanel", "aria-labelledby": `tab-${def.id}`, hidden: true });
    panels.set(def.id, panel);
    body.appendChild(panel);
  }

  const toggleBtn = h("button", { class: "vc-button vc-button--ghost button-compact drawer-toggle", type: "button", "aria-label": t("drawer.toggle") }, icon("chevronUp", 18), h("span", {}, t("drawer.show")));
  toggleBtn.addEventListener("click", () => setOpen(!open));
  tabBar.append(
    tabList,
    byline(),
    h("div", { class: "drawer-end" },
      h("span", { class: "drawer-note" }, icon("shield", 16), h("span", { "data-i18n": "drawer.note" }, t("drawer.note"))),
      toggleBtn)
  );

  root.append(tabBar, body);
  root.dataset.open = "false";

  function show(id) {
    active = id;
    for (const [tid, t] of tabs) t.btn.setAttribute("aria-selected", String(tid === id));
    for (const [pid, p] of panels) p.hidden = pid !== id;
    setOpen(true);
  }

  function setOpen(v) {
    open = v;
    root.dataset.open = String(v);
    toggleBtn.replaceChildren(icon(v ? "chevronDown" : "chevronUp", 18), h("span", {}, t(v ? "drawer.hide" : "drawer.show")));
    if (v) for (const [tid, t] of tabs) t.btn.setAttribute("aria-selected", String(tid === active));
    else for (const t of tabs.values()) t.btn.setAttribute("aria-selected", "false");
    if (v) for (const [pid, p] of panels) p.hidden = pid !== active;
    onToggle?.(v);
  }

  function setCount(id, n, attention = false) {
    const t = tabs.get(id);
    if (!t) return;
    t.count.hidden = !n;
    t.count.textContent = String(n);
    t.count.dataset.tone = attention ? "attention" : "";
    // A count that needs your decision is a merlot badge; the others stay quiet.
    t.count.classList.toggle("badge-quiet", !attention);
  }

  // A language switch renames the tabs and the toggle; the rest is marked data-i18n.
  onLangChange(() => {
    for (const tab of tabs.values()) tab.label.textContent = t(tab.labelKey);
    tabList.setAttribute("aria-label", t("drawer.tablist"));
    toggleBtn.setAttribute("aria-label", t("drawer.toggle"));
    toggleBtn.replaceChildren(icon(open ? "chevronDown" : "chevronUp", 18), h("span", {}, t(open ? "drawer.hide" : "drawer.show")));
  });

  return { panel: (id) => panels.get(id), show, setOpen, setCount, isOpen: () => open, active: () => active };
}
