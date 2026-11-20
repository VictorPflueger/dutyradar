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

`js/anthropic.js` stays unchanged: the app translates the shared client's errors by HTTP status and error type where it shows them (the Live loop's notices in `js/agent.js`, the key check in `js/dialogs.js`). Versions 0.2.0 and 1.0.0 change none of the shared files (1.0.0 passes the drawer an `onToggle` it already accepted, and its small-screen, focus and print rules live in `css/app.css`, `css/print.css` and `js/ui.js`); its screens are Duty Radar's own modules (`js/run_controller.js`, `js/controls.js`, `js/dialogs.js`, `js/console.js`, `js/kpi.js`, `js/dutymap.js`, `js/dutycard.js`, `js/duplicates.js`, `js/options_panel.js`, `js/outbox.js`, `js/exports.js`, `js/audit_panel.js`, `js/diagnostics.js`, `js/recorder.js`, `js/popovers.js`, `js/rich.js`), and its styles live in `css/app.css`, which overrides two shell rules there: the console panel keeps its log inside it and scrolls when the open drawer leaves it too little height (the log is positioned and would otherwise paint over the drawer), and the console's header tightens below 800 px.

## Independent review

Due with version 1.0.0: an agent that did not build the prototype reviews it; no high or medium finding may stay open.
