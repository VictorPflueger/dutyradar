# DESIGN — Duty Radar

How Duty Radar uses Vici, Victor's design system, through the sister apps' shell. Version 0.1.0.

## 1. Vici and the colour grammar

Vici v1.0.0 sits unchanged in `vici/`. The colours follow the sister shell's grammar, with no colour value of the app's own (the favicon is the one exception):

| Colour | Means in Duty Radar |
| --- | --- |
| Merlot | The person in charge: Approve, the step "Your decision", the reviewer's decision and its code, Confirm cluster, and the two benchmark gauges, which only approvals move |
| Lilac | The AI's voice: the AI disclosure, AI labels, draft wording, narration, the classifier's rationale |
| Fjord | Checking: the role at work in the role strip, the paragraph the agent reads, the auditor's passed checks |
| Danger, warning, success | State only, always with a word or a mark: blocked, needs review, approved, rejected, the provisional slice |
| Ink | Everything else, and selections (the chosen language, the chosen view) |
| Neutral tape | SIMULATION |

`tests/tokens.mjs` checks the contrast of every pair the shell and Duty Radar draw in both themes (WCAG 2.2 AA: text 4.5:1, marks 3:1), with Duty Radar's pairs in `tests/lib/prototype.mjs`.

## 2. Header and disclosure

The header holds the page icon (Vici's filter icon in a lilac hexagon cell, as on the website's card), the name and subtitle, the mode badge, "How it works", the theme toggle and the EN | DE switch; below them both disclosure lines, the lilac AI tag "You are interacting with an AI system." and "Prototype – not an official federal government service"; on the right the four KPI tiles, spanning both rows. Below 1300 px "How it works" keeps its icon and shows its words as a tooltip, as in the sister apps.

## 3. Role strip

The sister apps show the agent's plan as five forward-only steps. Duty Radar's agent team works by role, so the rail becomes a role strip (`js/progress.js`): one hexagon marker per role from the corpus agent to the fact auditor, idle (sunken), active (fjord, pulsing) or done (ink), with the role's icon inside (book, search, link, chart, bell, edit, check). A role turns active again whenever the agent returns to it. The merlot step "Your decision" follows while a decision or a cluster review waits. Below 1920 px the names shrink to the icons, with each name as tooltip and accessible name.

## 4. KPI tiles and gauges

Four tiles: duties inventoried (counts per type on hover), the two benchmark gauges and the compliance cost addressed (an estimate, with pending proposals as a faint second figure from version 0.2.0). The gauges are Vici's hexagonal progress (`vc-progress-hex`), labelled with the share of the benchmark reached; their value is set through the CSSOM, because the security policy allows no style attribute. Each gauge's tooltip says "Slice only, not the national target". No pie, no donut.

## 5. Centrepiece, console and drawer

The centrepiece opens on the start view: the question "How many duties do we carry, and which ask twice?", what is real, assumed or synthetic, and the slice as a table of its 31 norms grouped by family, with paragraph and sentence counts and the EU-related tag, and the notice that the consolidated text is not official. Its two views, the duty map and the duplicates board, fill from version 0.2.0; the duty map will use an ink ramp of seven steps (`color-mix` of text and surface), never Vici's merlot scale, which means the person in charge. The console carries the role strip and, before a run, the three runs. The drawer keeps the sister apps' bar: Options & review, Outbox and Audit, the byline and "Nothing is sent.".

## 6. Two languages in the layout

English is the default; German texts run about a third longer. The header keeps two rows of badges at 1280 × 720 in German, the KPI labels wrap to two lines, and nothing is cut to an ellipsis (`tests/i18n.mjs`). Law texts, citations and draft wording stay German in both languages.

## 7. Shapes and type

Hexagons replace circles everywhere, with no exception (`tests/hexagon.mjs` checks the files and the rendered app in both themes): role markers, gauges, the status dot, the page icon. Vici's fonts (Bricolage Grotesque, Inter, JetBrains Mono) with tabular figures in tables and tiles.

## 8. Small screens

From 1920 × 1080 down to 1280 × 720 the layout is tested in both languages (`tests/layout.mjs`). Below 900 px the tiles sit two by two; below 600 px the header stacks, the control bar wraps and the drawer bar takes two rows, so nothing scrolls sideways at 360 px. The console as a drawer and the screens as a select menu follow with version 1.0.0.
