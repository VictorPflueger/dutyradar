# DESIGN — Duty Radar

How Duty Radar uses Vici, Victor's design system, through the sister apps' shell. Version 1.0.0.

## 1. Vici and the colour grammar

Vici v1.0.0 sits unchanged in `vici/`. The colours follow the sister shell's grammar, with no colour value of the app's own (the favicon is the one exception):

| Colour | Means in Duty Radar |
| --- | --- |
| Merlot | The person in charge: Approve, the step "Your decision", the reviewer's decision and its code, Confirm cluster, and the two benchmark gauges, which only approvals move |
| Lilac | The AI's voice: the AI disclosure, AI labels, draft wording, narration, the classifier's rationale |
| Fjord | Checking: the role at work in the role strip, the paragraph the agent reads, the auditor's passed checks |
| Danger, warning, success | State only, always with a word or a mark: blocked, needs review, approved, rejected, the provisional slice |
| Ink | Everything else: the duty map's counts on their ramp, the data items of duties and clusters (chips, which are facts, not the reviewer's), a closing report the app rewrote after an assumption edit, and selections (the chosen language, the chosen view, the chosen map cell) |
| Neutral tape | SIMULATION |

`tests/tokens.mjs` checks the contrast of every pair the shell and Duty Radar draw in both themes (WCAG 2.2 AA: text 4.5:1, marks 3:1), with Duty Radar's pairs in `tests/lib/prototype.mjs`. The duty map's ramp mixes ink into the surface, which no token pair describes; `tests/layout.mjs` resolves each of its steps in both themes and checks the printed count at 4.5:1.

In a run the grammar reads: the cluster waiting for your review and the option you chose wear a merlot frame, Approve and Confirm cluster are merlot, and the reviewer's decisions are merlot in the console and the audit; the AI label (lilac "AI"/"KI" chip), the narration's and the classifier's EN or DE tag, the draft wording and the closing report are lilac (a report the app rewrites after an assumption edit is ink, without the AI label, since no model wrote it); the norm the agent reads pulses fjord at its row of the duty map, figures that open their source are underlined in fjord dots, and the auditor's "every figure sourced" is fjord; "Unsourced figure blocked", a failed tool and a stopped meter are danger red with their words.

## 2. Header and disclosure

The header holds the page icon (Vici's filter icon in a lilac hexagon cell, as on the website's card), the name (the page's one top-level heading) and subtitle, the mode badge, "How it works", the theme toggle and the EN | DE switch; below them both disclosure lines, the lilac AI tag "You are interacting with an AI system." and "Prototype – not an official federal government service"; on the right the four KPI tiles, spanning both rows. Below 1300 px "How it works" keeps its icon and shows its words as a tooltip, as in the sister apps.

## 3. Role strip

The sister apps show the agent's plan as five forward-only steps. Duty Radar's agent team works by role, so the rail becomes a role strip (`js/progress.js`): one hexagon marker per role from the corpus agent to the fact auditor, idle (sunken), active (fjord, pulsing) or done (ink), with the role's icon inside (book, search, link, chart, bell, edit, check). A role turns active again whenever the agent returns to it. The merlot step "Your decision" follows while a decision or a cluster review waits. Below 1920 px the names shrink to the icons, with each name as tooltip and accessible name.

## 4. KPI tiles and gauges

Four tiles: duties inventoried (counts per type on hover), the two benchmark gauges and the compliance cost addressed (an estimate, with pending proposals as a faint second figure). The gauges are Vici's hexagonal progress (`vc-progress-hex`): the figure inside is the share of the slice's reporting or documentation duties that approved options remove, the fill and the line below the share of the benchmark (−⅓ or −½) reached; their value is set through the CSSOM, because the security policy allows no style attribute. Each tile's tooltip says how many duties of the type are removed and "Slice only, not the national target". In a run every figure in a tile is a button that opens "Where does this figure come from?". No pie, no donut.

## 5. Centrepiece, console and drawer

The centrepiece opens on the start view: the question "How many duties do we carry, and which ask twice?", what is real, assumed or synthetic, and the slice as a table of its 31 norms grouped by family, with paragraph and sentence counts and the EU-related tag, and the notice that the consolidated text is not official. A run switches it to the duty map: norms (rows, by family) × the six duty types, each count on an ink ramp of seven steps (`color-mix` of text and surface; the count printed in surface colour on the two darkest), never Vici's merlot scale, which means the person in charge; a cell opens its duty cards beside the map (the sentence with the trigger phrase marked, the § link and the legal-status note, the badges, the classifier's rationale with its AI label and its EN or DE tag, the provenance). The duplicates board shows the cluster cards sorted by their best option's relief, with the shared data as ink chips, the members with citation, recipient and frequency, the register candidate tagged simulated and the confidence as a small hexagonal gauge. The console carries the role strip, the SIMULATION tape in a replay, one line per tool call with its result, the narration and the decisions. The drawer keeps the sister apps' bar: Options & review (the option cards on the left, the reason code, the comment and Approve, Reject, Ask for information in a column on the right, so the buttons stay in view at 1280 × 720), Outbox (the dossier, the kept duties, the four exports, "Nothing is sent."; an approval that an assumption edit withdrew stays listed with the warning tag "No longer counted" and leaves the totals) and Audit.

The control bar keeps one row from 1920 × 1080 down: below 1600 px its buttons show their icons with the words as tooltips, as in the sister apps; the slice's menu has no visible label (one slice, its id in the tooltip); in Live and Sovereign mode the cost meter takes the place of the replay's speeds.

## 6. Two languages in the layout

English is the default; German texts run about a third longer. The header keeps two rows of badges at 1280 × 720 in German, the KPI labels wrap to two lines, and nothing is cut to an ellipsis on any screen of a run (`tests/i18n.mjs`, `tests/layout.mjs`). Law texts, citations and draft wording stay German in both languages; a run's narration and report keep the language the run started in, with their EN or DE tag, while the labels around them follow the switch.

## 7. Shapes and type

Hexagons replace circles everywhere, with no exception (`tests/hexagon.mjs` checks the files and the rendered app in both themes): role markers, gauges, the status dot, the page icon. Vici's fonts (Bricolage Grotesque, Inter, JetBrains Mono) with tabular figures in tables and tiles.

## 8. Small screens

From 1920 × 1080 down to 1280 × 720 the layout is tested in both languages, idle and with a run waiting for a decision (`tests/layout.mjs`). On a short wide screen (at most 800 px high) with the drawer open, the drawer takes 38 % of the height, the console's head, tape and role strip tighten (the strip keeps one row), and the decision form tightens, so Approve, Reject and Ask for information stay in view and the console keeps at least two lines of its log. The duty map keeps its norm rows and scrolls in the centrepiece; it does not collapse to its family rows as the plan foresaw (TECH_NOTES §15). Hide gives the full height back.

Below 900 px the tiles sit two by two, and the views become one select menu in the centrepiece's head (Duty map, Duplicates, Options & review, Outbox, Audit): the first two switch the centrepiece, the other three open the drawer at their panel, and the menu follows when a decision opens the options. The console becomes a drawer over the right side of the screen, with its full height, opened by **Console** in the control bar and closed by its own close button or Escape; it is a modal dialog, the page behind it inert, and the focus goes into it, stays there and goes back to the button. Below 600 px the header stacks, the control bar wraps, the drawer bar takes two rows; the tiles fit their figures and labels (a long German compound is hyphenated); the duty map turns its type headers on their side and narrows its counts; the slice table, the assumptions and the audit table keep the panel's width, with fixed columns and wrapping text. Nothing scrolls sideways at 360 px in any view, Diagnostics and the console included, and the test exempts no element (`tests/layout.mjs small`).

## 9. Focus and keyboard

Every control is reached by Tab and shows Vici's focus outline (merlot, 2 px, 2 px off), radios and checkboxes included; scrolling tables without controls of their own are a stop of their own, so the keyboard can scroll them. A screen redrawn while a run goes on keeps the focus on the same control. A cell's duty cards take the focus and give it back to the cell; Escape closes them, the drawer, the console's drawer and every dialog (`tests/a11y.mjs keyboard`); the console's drawer keeps the focus inside while it is open (`tests/layout.mjs small`).

## 10. Print

Printing gives the relief dossier, not the workspace: the name, the two disclosure lines, the dossier's title and its provenance (run, mode, version, time of printing), totals, items with their figures, citations and open draft wording, the kept duties, the footnote on assumptions and "Nothing is sent.". Paper is light in either theme, figures are plain text, and cards do not break across pages (`css/print.css`).
