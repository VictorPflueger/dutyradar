# REVIEW — Duty Radar

The shared shell's parity with the sister apps, the shell modules Duty Radar adapts, and (from version 1.0.0) the independent review.

## Parity checklist

`tests/parity.mjs` compares the shell with a checkout of Rebate Hunter's `main`, with app names and storage prefixes normalised, and runs in CI against a fresh clone.

| Group | Files | Rule | State |
| --- | --- | --- | --- |
| Identical | `js/anthropic.js`, `js/clock.js`, `js/cost.js`, `js/dom.js`, `js/keystore.js`, `js/labels.js`, `js/md.js`, `js/sse.js`, `js/theme.js`, `css/components.css`, `css/console.css`, `tests/tokens.mjs`, `tests/hexagon.mjs`, `tests/page-icon.mjs`, `tests/vici-files.mjs` | Character for character, comments included (the hexagon test without its exception list, which is empty here) | Pass |
| Same code | `css/drawer.css`, `css/modals.css`, `css/style.css` | The rules match with comments removed; comments that named the sister's domain were reworded | Pass |
| Same Vici | `vici/` | Byte for byte, Vici v1.0.0 | Pass |
| Adapted | the four modules below | Listed here with their reason | Pass |
| Duty Radar's own | `js/events.js`, `js/icons.js`, `js/config.js`, `js/i18n.js`, `js/main.js`, `js/ui.js`, `css/app.css`, `tests/lib/prototype.mjs`, `tests/lib/harness.mjs` | The app's values, imported by the shared files | — |

## Adapted shell modules

Two languages need one change in the shell: its visible strings go through the app's i18n, and the app defines the rail's steps and the drawer's tabs. Each change is small and can be taken over by the sister apps as it is.

| Module | Change | Reason |
| --- | --- | --- |
| `js/drawer.js` | The app passes its tabs in (`tabs: [{ id, labelKey }]`); "Built by", the link names, "Show", "Hide", the tab list's name and the note come from `t()`; a language switch renames them | Two languages, and Duty Radar's tabs are "Options & review", "Outbox", "Audit" |
| `js/progress.js` | The five forward-only steps become a role strip: the app passes its roles (`steps: [{ id, labelKey, icon }]`); each role is idle, active or done and can turn active again; "Your decision" follows while a decision waits; strings from `t()` | Duty Radar's agent team works by role, not in one sequence of phases (brief, design section) |
| `js/handover.js` | "Awaiting your decision", "Awaiting your approval" and the run-state labels come from `t()`; `RUN_STATES` holds i18n keys; the logic is unchanged | Two languages |
| `js/modal.js` | The close button's tooltip "Close dialog" comes from `t()` | Two languages |

`js/anthropic.js` stays unchanged: the app translates the shared client's errors by HTTP status and error type where it shows them (the Live loop's notices in `js/agent.js`, the key check in `js/dialogs.js`). Versions 0.2.0 and 1.0.0 change none of the shared files (1.0.0 passes the drawer an `onToggle` it already accepted, and its small-screen, focus and print rules live in `css/app.css`, `css/print.css` and `js/ui.js`); its screens are Duty Radar's own modules (`js/run_controller.js`, `js/controls.js`, `js/dialogs.js`, `js/console.js`, `js/kpi.js`, `js/dutymap.js`, `js/dutycard.js`, `js/duplicates.js`, `js/options_panel.js`, `js/outbox.js`, `js/exports.js`, `js/audit_panel.js`, `js/diagnostics.js`, `js/recorder.js`, `js/popovers.js`, `js/rich.js`), and its styles live in `css/app.css`, which overrides shell rules there: the console panel keeps its log inside it and scrolls when the open drawer leaves it too little height (the log is positioned and would otherwise paint over the drawer); on a short wide screen the open drawer, the console's head, role strip and tape and the log's padding tighten (TECH_NOTES §15); and the console's turned SIMULATION mark is kept a little narrower than the log, so the log does not scroll sideways. The key of a Sovereign endpoint has its own module, `js/sovereign_key.js`, because `js/keystore.js` stays identical.

## Independent review

**Reviewer.** A separate agent that did not build the prototype, started on its own with no part of the build's conversation, on 20 November 2026.

**What it covered.** The branch of version 1.0.0 at commit `cfe9a09`: the code, the tests and the documents against PLAN.md, its acceptance criteria and its definition of done. It measured the screens in a browser at 1280 × 720 and 360 px, replayed the runs with decisions other than the recorded ones and edits after a decision, fed the fact auditor and the assumption editor inputs of its own, and read every file the repository publishes for wording. It reported one high, thirteen medium and nine low findings.

**Rule.** No high or medium finding stays open: each is fixed, with a test that fails without the fix where a test can decide it, or shown not to be a defect. The low findings are fixed too. Commit `9401da5` holds the code and tests, `d9a5666` the documents.

| Finding | Severity | Location | Resolution |
| --- | --- | --- | --- |
| F1 After an approval, an assumption edit that made the approved option ineligible left it counted in the tiles, the dossier's totals and the closing report, and its target decided | High | `js/state.js` (`draftOptions`, `kpis`), `js/report.js` | Fixed in `9401da5`: the approval lapses. The dossier keeps the item marked "No longer counted" and stops counting it; tiles, totals, exports and report follow; every target it decided opens again; Diagnostics and the console say so and a report already written is rewritten by the app; an option that applies again returns as a proposal, and a new approval replaces the lapsed item (`tests/runs.mjs facts`, `tests/accept.mjs assumptions`) |
| F2 The fact auditor let German number compounds (zweihundert, fünfundzwanzig, dreitausend, Hunderttausende, zweimal, Dutzend), "twice", "a dozen" and numbers shaped as ids (O-1500000, DEC-2026) pass, and `law_search` showed its query unaudited | Medium | `js/engine/auditor.js`, `js/tools/law_search.js:27` | Fixed in `9401da5`: compounds of number morphemes count ("einmal", "einfach", "vierteljährlich", "außer Acht" still pass); "twice", "thrice", "dozen", "-fold"; ids need their exact shape and, for decisions and options, must exist in the run; the query is shown only when it passes (`tests/engine.mjs audit`, `tests/tools.mjs cases`) |
| F3 The assumption editor read "9.000" in German and "9,000" in English as nine | Medium | `js/diagnostics.js` (`parseLocalNumber`) | Fixed in `9401da5`: `parseLocalNumber(text, lang)` in `js/engine/format.js` reads the active language's separators in groups of three and refuses an ambiguous one (`tests/engine.mjs parse`) |
| F4 R2's narration "I put keeping … to a decision" still played after a decision that had decided its target | Medium | `data/runs/R2.json` event 26, `js/simulation.js` | Fixed in `9401da5`: announcing narration names its request's target (`for_request`) and the replay skips both; the run checker demands it; R2 replayed with another decision in Node and in the browser (`tests/runs.mjs`, `tests/accept.mjs other`) |
| F5 At 360 px the console's drawer did not keep the focus | Medium | `js/ui.js` (`setConsole`) | Fixed in `9401da5`: a modal dialog, the page behind inert, Tab and Shift+Tab wrap; given back when the window widens (`tests/layout.mjs small`) |
| F6 At 360 px in German the documentation tile's label ran out of its tile | Medium | `css/app.css` | Fixed in `9401da5`: tiles on a phone take less padding and a smaller figure, labels hyphenate; the test checks every text in every tile with the largest figures in place, which also caught the relief figure (`tests/layout.mjs small`) |
| F7 At 360 px the duty map, the slice table and the parameter table scrolled sideways, and the layout test exempted them | Medium | `css/app.css`, `tests/layout.mjs` | Fixed in `9401da5`: the map turns its headers and narrows its counts, the two tables keep fixed columns and wrap; the test exempts no element (no dialog, no audit table) and checks every scroll region, which also caught the console's SIMULATION mark overrunning the log |
| F8 At 1280 × 720 the open drawer left the console 28 px and hid the map rows, "Ask for information" sat below the fold, and the map did not collapse to its family rows as PLAN.md §3.3 says | Medium | `css/app.css`, PLAN.md §3.3, DESIGN.md §8 | Fixed in `9401da5` and `d9a5666`: on short wide screens the three buttons stay in view and the console keeps at least two lines (`tests/layout.mjs wide`); the map keeps its norm rows, recorded as a deviation in TECH_NOTES §15 and DESIGN §8, with the Hide hint in DEMO_SCRIPT |
| F9 The duty card's rationale, model text, lacked its language and EN or DE tag | Medium | `js/dutycard.js:51` | Fixed in `9401da5`: the tag and `lang` of the run (`tests/storyline.mjs`) |
| F10 The keep card showed "Known data uses: 0" as a bare number, and the README said every figure opens its source | Medium | `js/options_panel.js:41`, README.md | Fixed in `9401da5` and `d9a5666`: the card names the uses or says none; the figures test scans tiles, cards and dossier for any other number, with a planted control; README and TECH_NOTES name what is not a figure |
| F11 DEMO_SCRIPT said Simulation makes no network request at all; it loads the site's own files | Medium | DEMO_SCRIPT.md | Fixed in `d9a5666`: it loads only the site's own files and calls no API |
| F12 Wording beyond the neutral description of the hygiene check, and an informal name for run R1 | Medium | `tests/hygiene.mjs:1-3`, PLAN.md:30 and :660, `tests/run-all.mjs:25`, `js/i18n/*.json`, `data/runs/R1.json`, README.md:29 | Fixed in `9401da5` and `d9a5666`: neutral wording, R1 is "Full slice"; the hygiene matcher follows a term across line breaks and comment marks and through inflections, and checks itself on made-up terms first |
| F13 The data items' chips wore merlot, the reviewer's colour | Medium | `js/dutycard.js`, `js/duplicates.js` (Vici's chip default) | Fixed in `9401da5`: ink chips, neither pointer nor hover; two rules in `tests/design.mjs` |
| F14 Sovereign mode stored and read its endpoint's key in the Anthropic key's slot, so an Anthropic key could reach the endpoint | Medium | `js/dialogs.js:85`, `js/agent.js:181`, `js/llm/openai-compat.js:81` | Fixed in `9401da5`: a separate slot `dr.sovereign.key` (`js/sovereign_key.js`; `js/keystore.js` stays identical); a 401 from the endpoint forgets only its key (`tests/live.mjs sovereign`) |
| F15 A failed boot set `data-state="error"` where the stylesheet expects "failed"; TECH_NOTES §3 said only the first boot message is English | Low | `js/main.js:72`, TECH_NOTES §3 | Fixed in `9401da5` and `d9a5666` (`tests/smoke.mjs`) |
| F16 The closing report read "approved relief of -€…" | Low | `report.approved` in `js/i18n/*.json` | Fixed in `9401da5`: "relief that changes compliance cost by …" |
| F17 The README's acceptance table broke before the AC-32 row | Low | README.md | Fixed in `d9a5666` |
| F18 Stale version lines in TECH_NOTES and DATA_SOURCES; the ink ramp's "six steps" against "seven" | Low | TECH_NOTES.md, DATA_SOURCES.md, `tests/design.mjs` | Fixed in `9401da5` and `d9a5666` |
| F19 "At most €3", which a call under way can pass, and "the largest cluster", which C-046 is not (it tops the board by relief) | Low | DEMO_SCRIPT.md, README.md, R1's plan, `run.R1_desc` | Fixed in `9401da5` and `d9a5666` |
| F20 The printed dossier did not say where it comes from | Low | `js/outbox.js` | Fixed in `9401da5`: run, mode, version and the time of printing, as in the exports (`tests/accept.mjs print`) |
| F21 The page had no `h1` | Low | `index.html` | Fixed in `9401da5`: the product's name (`tests/smoke.mjs`) |
| F22 A stale comment in `tests/runs.mjs`, and the audit table exempted from the sideways check | Low | `tests/runs.mjs`, `tests/layout.mjs` | Fixed in `9401da5` |
| F23 The reason group for rejecting suggested A5 could keep a duty; PLAN.md C24 says the Diagnostics privacy row checks the policy, which it only showed | Low | `options.codes_reject`, `js/diagnostics.js` | Fixed in `9401da5`: the group says all but A5; Diagnostics checks the page's policy against `js/policy.js`, the module `tools/set-csp.mjs` now writes it from (`tests/smoke.mjs`, with a control) |
