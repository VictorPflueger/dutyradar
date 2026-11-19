// What differs between the prototypes in the shared Vici tests (tests/tokens.mjs, tests/hexagon.mjs,
// tests/page-icon.mjs and tests/vici-files.mjs). Those four files are the same in Rebate Hunter,
// Navigator, Timetable Translator, Repack Pilot and Duty Radar; this file is the one place that is not.
// Everything here is Duty Radar's.

/** The prototype's name, as on its page and on its card on Victor's website. */
export const NAME = "Duty Radar";

/**
 * Colour pairs only this prototype draws (the shared shell's pairs are in tests/tokens.mjs):
 * [what, foreground token, background token, kind]. kind "text" needs 4.5:1, "mark" (a line, an icon,
 * a control's border, a bar) 3:1 (WCAG 2.2, 1.4.3 and 1.4.11). Tokens are Vici's, without "--vc-".
 * The duty map's ink ramp joins with version 0.2.0, with its own contrast test (color-mix steps).
 */
export const COLOUR_PAIRS = [
  // The role strip above the console (css/app.css).
  ["Role strip: an idle role's icon on its sunken hexagon", "text-subtle", "bg-sunken", "mark"],
  ["Role strip: an active role's icon on its fjord hexagon", "info-on-solid", "info-solid", "mark"],
  ["Role strip: the active role's fjord hexagon on the console", "info-solid", "surface", "mark"],
  ["Role strip: a done role's ink hexagon on the console", "text", "surface", "mark"],
  ["Role strip: a done role's icon on its ink hexagon", "surface", "text", "mark"],
  ["Role strip: Your decision, its icon on the merlot hexagon", "on-accent", "accent", "mark"],
  ["Role strip: a role's name on the console", "text-muted", "surface", "text"],
  // The language switch and the centrepiece's view tabs.
  ["Language switch and view tabs: the chosen one", "text-inverse", "surface-inverse", "text"],
  ["Language switch and view tabs: the others", "text", "surface", "text"],
  ["Language switch and view tabs: their frame", "border-strong", "surface", "mark"],
  // The two benchmark gauges (Vici's hexagonal progress) in the KPI tiles.
  ["Benchmark gauges: the merlot fill against its track", "accent", "track", "mark"],
  ["Benchmark gauges: the value inside the gauge", "text", "surface", "text"],
  // The start view's slice table.
  ["Slice table: a family's name on its sunken row", "text", "bg-sunken", "text"],
  ["Slice table: a norm's title, muted", "text-muted", "surface", "text"],
  ["Slice table: the provisional slice's tag", "warning-text", "warning-bg", "text"],
  // The disclosure lines.
  ["The AI disclosure tag (lilac)", "feature-text", "feature-bg", "text"],
  ["The second disclosure line, muted", "text-muted", "bg", "text"]
];

/**
 * Colours that must stay apart, beyond the shared ones in tests/tokens.mjs: [what, token, token].
 * The test reports how far apart they stay under colour-vision deficiency; it does not fail on them.
 */
export const SEPARATIONS = [
  ["A role at work (fjord) vs your decision (merlot)", "info-solid", "accent"],
  ["A role done (ink) vs a role not called yet (sunken)", "text", "bg-sunken"],
  ["The AI's voice (lilac) vs a role at work (fjord)", "feature-solid", "info-solid"]
];

/**
 * The hexagon test's tour of the app (tests/hexagon.mjs), as far as version 0.1.0 goes: the start
 * screen with the intro, the start view, the duty map and duplicates views, the drawer's three tabs,
 * Assumptions & diagnostics, and the start view in German. The page has just been opened, without
 * SKIP_INTRO, so the intro opens by itself. visit(name, { settle }) checks the page as it is, settle
 * ms (250) after the step. The agent runs join the tour with version 0.2.0.
 */
export async function hexagonTour(page, visit) {
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.waitForSelector(".intro-modal", { timeout: 10000 });
  await visit("start screen with the intro");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".intro-modal", { state: "detached", timeout: 5000 });
  await visit("start view");
  await page.click('.centre-tab[data-view="dutymap"]');
  await visit("duty map, empty");
  await page.click('.centre-tab[data-view="duplicates"]');
  await visit("duplicates, empty");
  await page.click('.centre-tab[data-view="start"]');
  for (const tab of ["options", "outbox", "audit"]) {
    await page.click(`#tab-${tab}`);
    await page.waitForSelector(`#panel-${tab}:not([hidden])`, { timeout: 5000 });
    await visit(`drawer: ${tab}`);
  }
  await page.click(".drawer-toggle");
  await page.click("#btn-diagnostics");
  await page.waitForSelector(".diag-table", { timeout: 5000 });
  await visit("assumptions and diagnostics");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".diag-table", { state: "detached", timeout: 5000 });
  await page.click('.lang-option[data-lang="de"]');
  await page.waitForFunction(() => document.documentElement.lang === "de");
  await visit("start view in German");
  await page.click('.lang-option[data-lang="en"]');
}

/**
 * The page icon (tests/page-icon.mjs): the icon and kind of this prototype's card on Victor's website
 * (VictorPflueger/VIP, data/prototypes.js), the colour of that kind's cell (Vici's lilac for a
 * prototype), and favicon.svg exactly: the card's cell drawn for small sizes.
 */
export const PAGE_ICON = {
  icon: "filter",
  kind: "prototype",
  tone: "lilac",
  favicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 103.92">
  <!-- Duty Radar's page icon: Vici's filter icon in a lilac hexagon cell, the same as its card on
       Victor Pflüger's website (icon and kind: VictorPflueger/VIP, data/prototypes.js). Vici's
       lilac 100 (#f2e9fd) and lilac 900 (#372544); the icon is drawn larger and bolder
       than on the card so that it still reads at 16 px. -->
  <polygon points="120,51.96 90,103.92 30,103.92 0,51.96 30,0 90,0" fill="#f2e9fd"/>
  <g transform="translate(18 9.96) scale(3.5)" fill="none" stroke="#372544" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 5 H20 L14 12.5 V18.5 L10 20 V12.5 Z"/>
  </g>
</svg>
`
};
