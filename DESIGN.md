# Design notes

How Duty Radar 2.0.0 uses Vici, Victor's design system, and why the page looks the way it does.

## One screen, five steps

The page is one screen at 1920 × 1080, 1366 × 768 and 1280 × 720: nothing scrolls, nothing hides behind a menu. The header carries the name in its lilac hexagon, SIMULATION, the guide's button, the theme, EN | DE and the three key figures, top right. Under it one sentence says what the prototype does and how real its data is, with the byline beside it: the page doesn't scroll, so the byline sits there rather than at the end, as Vici's Build a prototype page asks. Then the five steps, the law map on the left and the story on the right. Wherever the page waits, a bar right under the story starts with “Your turn”, says in words what to do and holds the one button, which names where it leads (“Next: It reads”): Vici asks for every click where the eye is, as a Next button alone is easily missed. After a few seconds without a click, a key or a scroll the button pulses, and any of them calms it. The bar sticks to the bottom of the story if a step grows. The fifth step's marker is merlot until it is reached: there a person acts. On a phone the same parts stack and the bar keeps to the bottom of the screen.

Each step says one thing: a title that states the finding, two sentences, the agent's own line and one piece of evidence. Nothing on the screen repeats what another part already says. The fact check, for one, is the agent's line at step 4, not a second box.

## Colour

Vici's semantic tokens only, so both themes work without a colour of the app's own; the page icon is the one exception.

| Colour | Means |
|---|---|
| Merlot (accent) | The person: the bar that asks and its button, the decision, the dossier entry |
| Lilac (feature) | The agent: its words, the phrase it marked, its pick, what it found asked twice, its proposal under Relief a year |
| Fjord (info) | The law being read |
| Success | Relief approved |
| Ink | Everything else: the laws, their counts, the options' bars |

## Key figures

Three Vici stat tiles, top right. Each is marked `data-vc-kpi` with its English name and `data-vc-kpi-de` with its German one, and each guide's How it works chapter explains it in a row of its own: the name as on the tile, what it measures and its value, as Vici's key-figure rule asks. Relief a year stays at zero until a person approves; the agent's proposal shows under it in lilac. When the decision moves Relief a year and Reporting duties cut, each tile keeps its old value struck through (`vc-stat__was`) and the note says what moved it.

## Two languages

`js/copy.js` holds the fixed words, `js/story.js` the sentences with their figures and `index.html` one guide per language. `js/lang.js` runs before `vici.js`: it picks the language (`?lang=`, then the visitor's last choice, else English, also in a German browser) and lets only that language's guide open by itself, once per tab across both languages. The switch changes every word in place, also while the agent works. German compounds in the law map may break at a soft hyphen (Produkt-verantwortung), so both languages keep five columns at 1280 px.

## Shapes, type and motion

Nothing is round: hexagons and hex capsules come from Vici (`tests/hexagon.mjs`). Type and spacing come from Vici; the root size follows the window, from 15 px at 1280 px to about 17 px at 1920 px. Motion says something or doesn't happen: the laws fill as the agent reads them, the rail between two steps fills while the agent works, evidence fades in, the bar's button pulses when the page has been idle. With reduced motion asked for, it stops, and an idle button gets a still ring.

## Keyboard and screen readers

Every control is a button. The keys 1 to 5, the arrows, Home and Space move through the talk track. A live region announces each step and the outcome of the decision. Every visible text meets WCAG 2.2 AA in every state, light and dark (`tests/contrast.mjs`).
