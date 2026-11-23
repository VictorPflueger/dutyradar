# Design notes

How Duty Radar 2.1.0 uses Vici, Victor's design system, and why the page looks the way it does.

## One screen, five steps

The page is one screen at 1920 × 1080, 1366 × 768 and 1280 × 720: nothing scrolls, nothing hides behind a menu. The header carries the name in its lilac hexagon, SIMULATION, the guide's button, the theme, EN | DE and the three key figures, top right. Under it one sentence says what the prototype does and how real its data is, with the byline beside it: the page doesn't scroll, so the byline sits there rather than at the end, as Vici's Build a prototype page asks. Then the five steps, the law map on the left and the story on the right. Wherever the page waits, a bar right under the story starts with “Your turn”, says in words what to do and holds the one button, which names where it leads (“Next: It reads”): Vici asks for every click where the eye is, as a Next button alone is easily missed. The button carries Vici's `vc-attention`: a merlot ring pulses out three times as soon as the page waits, then rests as a frame; after a Pause it comes back after a few quiet seconds. The bar sticks to the bottom of the story if a step grows. Once the person has decided, the story is over: the step's title states the result, and the bar says so and offers Start again. The fifth step's marker is merlot until it is reached: there a person acts. On a phone the same parts stack and the bar keeps to the bottom of the screen.

Each step says one thing: a title that states the finding, two sentences, the agent's own line and one piece of evidence. Nothing on the screen repeats what another part already says. The fact check, for one, is the agent's line at step 4, not a second box.

The screen speaks to someone who has never read these laws. The law map shows each law's count of duties; the short titles (BStatG, MiLoAufzV) mean nothing to most of the room, so they show on hover and to a screen reader. The two laws the story is about are named in words (Trade and services statistics, Production statistics), with their section as the link to the text. The agent and the dossier name the pair of reports in words, not by the cluster's id, and a decision gives its reason in words rather than as a code. On an English screen the German law sentence comes with a line in English. PflichtenLichten says what it is where it first appears.

## Colour

Vici's semantic tokens only, so both themes work without a colour of the app's own; the page icon is the one exception.

| Colour | Means |
|---|---|
| Merlot (accent) | The person: the bar that asks and its button, the decision, the dossier entry |
| Lilac (feature) | The agent: its words, the phrase it marked, its pick, what it found asked twice |
| Fjord (info) | The law being read |
| Success | Relief approved: the tile and the outcome |
| Ink | Everything else: the laws, their counts, the options' bars |

## Key figures

Three Vici stat tiles, top right. Each is marked `data-vc-kpi` with its English name and `data-vc-kpi-de` with its German one, and each guide's How it works chapter explains it in a row of its own: the name as on the tile, what it measures and its value, as Vici's key-figure rule asks. They answer first: before anything runs they show what the case puts at stake, each named for what it shows then. Asked twice reads 203 of 745, Relief at stake a year €4.07m “if a person approves the merge”, Reporting duties cut 0 of 107. Only the decision moves them. An approval takes the relief at stake to €0 and turns the tile green; keeping both leaves it. A tile that moves keeps its old value struck through (`vc-stat__was`), and its note says what moved it.

## Two languages

`js/copy.js` holds the fixed words, `js/story.js` the sentences with their figures and `index.html` one guide per language. `js/lang.js` runs before `vici.js`: it picks the language (`?lang=`, then the visitor's last choice, else English, also in a German browser) and lets only that language's guide open by itself, once per tab across both languages. The switch changes every word in place, also while the agent works. German compounds in the law map may break at a soft hyphen (Produkt-verantwortung), so both languages keep five columns at 1280 px.

## Shapes, type and motion

Nothing is round: hexagons and hex capsules come from Vici (`tests/hexagon.mjs`). Type and spacing come from Vici; the root size follows the window, from 15 px at 1280 px to about 17 px at 1920 px. Motion says something or doesn't happen: the laws fill as the agent reads them, Vici's rail between two steps fills while the agent works (`--vc-step-fill`), evidence fades in, and `vc-attention` rings the button the page waits for. With reduced motion asked for, it stops, and the button keeps its ring as a still frame.

## Keyboard and screen readers

Every control is a button. The keys 1 to 5, the arrows, Home and Space move through the talk track. A live region announces each step and the outcome of the decision. Every visible text meets WCAG 2.2 AA in every state, light and dark (`tests/contrast.mjs`).
