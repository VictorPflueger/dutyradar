# Design notes

How Duty Radar 2.2.0 uses Vici, Victor's design system, and why the page looks the way it does.

## One screen, five steps

The page is one screen at 1920 × 1080, 1366 × 768 and 1280 × 720: nothing scrolls, nothing hides behind a menu. The header carries the name in its lilac hexagon, SIMULATION, the guide's button, the theme, EN | DE and the three key figures, top right. Under it one sentence says what the prototype does and how real its data is, with the byline beside it: the page doesn't scroll, so the byline sits there rather than at the end, as Vici's Build a prototype page asks. Then the five steps with What each number counts beside them, the law map on the left and the story on the right. Wherever the page waits, a bar right under the story starts with “Your turn”, says in words what to do and holds the one button, which names where it leads (“Next: It reads”): Vici asks for every click where the eye is, as a Next button alone is easily missed. The button carries Vici's `vc-attention`: a merlot ring pulses out three times as soon as the page waits, then rests as a frame; after a Pause it comes back after a few quiet seconds. The bar sticks to the bottom of the story if a step grows. Once the person has decided, the story is over: the step's title states the result, and the bar says so and offers Start again. The fifth step's marker is merlot until it is reached: there a person acts. On a phone the same parts stack and the bar keeps to the bottom of the screen.

Each step says one thing: a title that states the finding, two sentences, the agent's own line and one piece of evidence. From step 3 on, one line above the evidence says who carries the duty and how many there are, with a warning edge, because how many of them file both reports is assumed. Nothing on the screen repeats what another part already says. The fact check, for one, is the agent's line at step 4, not a second box.

## Laws in words

The screen speaks to someone who has never read these laws. The law map names every law in words (Federal statistics, Trade and services statistics), under the five topics it was chosen from, in two columns. Each row shows the law's duties as a count and a bar, and how many of them sit in a cluster. The short titles (BStatG, HdlDlStatG) follow the name where the window is wider than 1440 px, in the list of laws and beside a quoted section; they are never the only name. A legend in words under the map says what the bar, the counts, a dashed row, a blue one, a pale one, A and B, lilac and merlot mean. Its heading, 31 laws, is a count like any other, and the ladder says how the laws were chosen. The agent and the dossier name the pair of reports in words, not by the cluster's id, and a decision gives its reason in words rather than as a code. On an English screen the German law sentence comes with a line in English. PflichtenLichten says what it is where it first appears.

## Every count opens what it counts

Every count in the story and every key figure is a button, underlined in lilac (`.count`). It opens what it counts in a panel beside the story: every duty with its sentence, addressee and population; the sentences the agent discarded; the clusters, the priced one first; the laws. The panel is Vici's drawer dialog (`vc-dialog--drawer`), opened without a backdrop, so the map stays in view. Its filters are Vici's small chips (`vc-chip--sm` with `aria-pressed`) for type, addressee and result, and a list of the laws. Pointing at a count or giving it focus marks its laws on the map with a lilac edge, the highlight; opening it keeps them marked. Clicking a law selects it with a merlot edge, and a line in the story says how that law relates to the step. Esc or Close puts focus back on the count that opened the panel.

The ladder, opened by What each number counts beside the steps, runs from law to decision in ten rungs: laws, sections, sentences, sentences flagged, duties, reporting duties, clusters, the cluster priced, options and the decision. Each rung shows its count, says in one line what it counts and opens its own list; the rung of the current step is merlot. The words come from the glossary in `js/copy.js`, one word per term in each language (cluster, Bündel), which `tests/glossary.mjs` holds the page to.

Compare, at the priced cluster, sets the two duties side by side by who, what, how often and to whom: the law's German text first, with an English line on English screens and “cut here” where a quote stops mid-sentence, then the agent's reading. One row says what is assumed and not shown: that the same businesses file both. Beside every euro, “Where does this figure come from?” shows the formula, each input with its kind (from the law, a Destatis table, a public count, assumed, computed) and its source, the arithmetic, the rounding and the relief for 100, 50, 25 and 10 per cent of the businesses.

## Colour

Vici's semantic tokens only, so both themes work without a colour of the app's own; the page icon is the one exception.

| Colour | Means |
|---|---|
| Merlot (accent) | The person: the bar that asks and its button, the decision, the dossier entry, the law you selected, the current rung |
| Lilac (feature) | The agent: its words, the phrase it marked, its pick (A and B), what it found asked twice; and the highlight, the laws a count marks |
| Fjord (info) | The law being read; an input from the law |
| Warning | What is assumed: the line on who files both, an assumed input and the public count that caps it |
| Success | Relief approved: the tile and the outcome |
| Teal (data colour 2) | The options' bars, the one chart on the page |
| Ink | Everything else: the laws, their counts and bars |

## Key figures

Three Vici stat tiles, top right, each a button that opens what it counts: the clusters, the relief's derivation, the reporting duties. Each is marked `data-vc-kpi` with its English name and `data-vc-kpi-de` with its German one, and each guide's How it works chapter explains it in a row of its own: the name as on the tile, what it measures and its value, as Vici's key-figure rule asks. They answer first: before anything runs they show what the case puts at stake, each named for what it shows then. Asked twice reads 203 of 745, Relief at stake a year up to €1.51m, noted “assumed: 22,217 file both”, Reporting duties cut 0 of 107. Only the decision moves them. An approval takes the relief at stake to €0 and turns the tile green; keeping both leaves it. A tile that moves keeps its old value struck through (`vc-stat__was`), and its note says what moved it.

## Two languages

`js/copy.js` holds the fixed words and the glossary, `js/story.js` the sentences with their figures, `js/explain.js` the ladder, the comparison and the derivation, and `index.html` one guide per language. `js/lang.js` runs before `vici.js`: it picks the language (`?lang=`, then the visitor's last choice, else English, also in a German browser) and lets only that language's guide open by itself, once per tab across both languages. The switch changes every word in place, also in an open panel and while the agent works. A long German name may break at a soft hyphen (Handels- und Dienst-leistungs-statistik), so both languages keep the map's two columns at 1280 px.

## Shapes, type and motion

Nothing is round: hexagons and hex capsules come from Vici (`tests/hexagon.mjs`). Type and spacing come from Vici; the root size follows the window, from 15 px at 1280 px to about 17 px at 1920 px. Motion says something or doesn't happen: the laws fill as the agent reads them, Vici's rail between two steps fills while the agent works (`--vc-step-fill`), evidence fades in, the panel slides in from the side, and `vc-attention` rings the button the page waits for. With reduced motion asked for, it stops, and the button keeps its ring as a still frame.

## Keyboard and screen readers

Every control is a button, except the list of laws among a panel's filters. The keys 1 to 5, the arrows, Home and Space move through the talk track, and Esc closes a panel. A live region announces each step and the outcome of the decision. Every visible text meets WCAG 2.2 AA in every state, light and dark (`tests/contrast.mjs`).
