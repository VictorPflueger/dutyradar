# Tests

`node tests/run-all.mjs` runs every suite in order and prints a summary; `npm test` runs the Node suites (`--node`) and `npm run e2e` the browser suites (`--browser`). Name suites to run only those: `node tests/run-all.mjs engine snapshot`. No suite calls a real API, spends money or needs the internet; every browser suite blocks requests to other hosts and fails on a console error, a page error or a security-policy violation.

## What runs

| Suite | Checks | Criteria |
| --- | --- | --- |
| tokens, hexagon, page-icon, vici-files | The four shared design tests, unchanged, with Duty Radar's values in `tests/lib/prototype.mjs` | AC-39 |
| parity | The shell against Rebate Hunter's `main`; the adapted modules listed in REVIEW.md | AC-39 |
| unit | Both language files: identical keys, no empty value, the copy tables exactly; the run defaults of `js/config.js` equal `config/run.json`; ICU in de-DE and en-GB | AC-15, AC-01 |
| engine | Golden cases G1–G8 in both languages, coverage, fact auditor A01–A31, clusters K1–K9, options O1–O6, mappings, fact registry, sentence splitting and patterns, the gold set and the pattern stage's recall | AC-01–AC-07 |
| snapshot | The snapshot script on `tests/fixtures/toc-sample.xml` and the two-norm fixture slice: stops on a missing slug or title, the Norm contract, the EU basis | AC-08, AC-34 |
| data, corpus, sources | `tools/check-data.mjs`: the data files, the law snapshot, every source key and table, and DATA_SOURCES.md's record of the guide, its tables and the files of assumptions | AC-09 |
| static | `tools/check-static.mjs`: security policy, no inline code, storage keys, pure engines and tools, language keys, no key-like strings, no unfinished-work marker | AC-14 |
| tools | Each of the 16 tools with its valid and invalid fixture input; the strict schemas within the measured limits; the classification tool without a number; the two-norm fixture slice end to end | AC-10, AC-13, AC-37 |
| live | The Live loop against `tests/lib/fake-claude.mjs`: headers, strict tools, `tool_choice`, no sampling parameters, results first, thinking unchanged, stop rules, errors, the caps; the Sovereign adapter against `tests/lib/fake-openai.mjs` | AC-11, AC-12, AC-22 |
| runs, check-runs | The run checker on broken copies of R1; fact ids bound across replays and edits; R1 to R3 headless with any decision; the precision tool for AC-29; `tools/check-runs.mjs` on the bundled runs in both languages | AC-16, AC-36 |
| hygiene, docs | No relationship term or e-mail address in any published file; the documents complete, every path they name present | Definition of done |
| smoke | Boot offline, intro, views, drawer, Diagnostics, the mode dialog behind Start agent, keyboard, a failed boot | AC-25 (parts) |
| sims | R1 to R3 replayed in Simulation in both languages at `?speed=1000`: the pauses, the recorded cluster reviews, tiles equal to the engines' facts computed in Node from the same decisions, the dossier and kept duties, R2's split, blocked figure and rejection | AC-17, AC-18 |
| storyline | The eight-minute storyline as the audience sees it, R1 and R2 in both languages, every expected figure from the engines replayed in Node (`tests/lib/story-node.mjs`): the intro's question and both gauges at 0 % with "Slice only, not the national target"; SIMULATION throughout; every role at work, the duty map's counts, the duties tile counting up; a duty card's trigger phrase, § link and legal-status note; the top cluster; the options with their figures after the blocked figure and the re-draft; the tiles moving to the engine's figures; the dossier's totals, citations, wording and export; the closing report; R3 as the closing act. `--browser=firefox` and `--browser=webkit` run it there | AC-17, AC-18 |
| accept | `decisions` the reason codes and comments; `caps` a Live run against the stand-in that never stops asking for tools, and one with high usage; `key` a dummy key in no storage, export, audit, recording or console; `live` one norm end to end; `modes` Sovereign disabled with its reason; `exports` file names in both languages, the CSV format, the dossier; `figures` every figure of the tiles, option cards and dossier opened; `assumptions` two edits recomputed to the engine's figures, an option made ineligible, the console's figures, `parameter_changed`; `keep` refused codes, "Target decided", the kept duties with code, comment and data uses; `other` a decision other than the recorded intention; `disclosures` English first in a German browser, both lines on the six screens; `print` the printed dossier; `runfigures` the four aggregated figures | AC-19 to AC-25, AC-31, AC-33, AC-35 |
| selftest | "Run all tests" in the browser: every golden, auditor and cluster case from the fixture files passing in both languages; a changed expectation fails with its values; a missing file is reported; the same module under Node | AC-28 |
| i18n | English first and the switch; a Live run against the stand-in switched to German while it waits: every screen in German, the model's text in English with its tag, German at 1280 × 720 on every screen; `?lang=`; a failed boot reported in German | AC-25 (parts), AC-38 |
| layout | `wide`: viewports from 1920 × 1080 to 1280 × 720, idle and with R1 waiting for a decision, light and dark at 1920 × 1080 and 1280 × 720 with a screenshot each (sixteen), nothing cut to an ellipsis, the control bar on one row, the duty map's ink ramp at 4.5:1 in both themes; `small`: at 360 and 820 px the view menu, the console's drawer with its Console button and Escape, the tiles two by two, nothing sideways in any view, twelve screenshots | AC-27, AC-38 (layout) |
| design | The colour grammar in both themes, each rule against Vici's token resolved in the page: merlot for the reviewer, lilac for the AI's voice, fjord for checking, danger and success with their words, the ink ramp, SIMULATION's tape; it proves itself on a planted colour | PLAN.md section 3.5 |
| a11y | `axe`: axe-core on the six screens in both themes and languages, no serious or critical violation, proven on two planted violations; `keyboard`: the storyline by keyboard alone with a visible focus at every stop, Escape for the duty cards, the drawer and Diagnostics | AC-26 |

The fixtures in `tests/fixtures/` come first: the specification's golden, auditor, cluster and option cases, copied unchanged with the English additions of the brief, and the gold set with its sampling method.

## Setup for the browser suites

The browser suites use Playwright, installed globally so the repository keeps only its development dependencies:

```sh
npm ci                                   # axe-core for the a11y suite
npm install -g playwright@1.56.0
npx playwright install chromium          # and firefox webkit for --browser=firefox|webkit
NODE_PATH="$(npm root -g)" node tests/run-all.mjs --browser
NODE_PATH="$(npm root -g)" node tests/storyline.mjs R1 --browser=webkit
```

`tests/live_site.mjs [url]` checks a published copy (by default the repository's GitHub Pages address): the files as served equal this checkout, then R1 replays there with every other host blocked; `LIVE_WAIT_MS=0` skips the wait for the Pages cache, for a local server. It is not part of `run-all.mjs`; `.github/workflows/live-site.yml` runs it after every Pages build. `tests/remote_head.mjs` checks that `main` on GitHub is the local HEAD with nothing uncommitted.

`CHROME_PATH` points the suites at another Chromium; `PLAYWRIGHT_MODULE` at another Playwright folder; `DR_TEST_OUT` at the folder for test output (by default `duty-radar-tests` in the system's temporary folder): the layout suite writes its sixteen screenshots to the layout folder there: 1920 × 1080 and 1280 × 720, light and dark, English and German, idle (`vp-…`) and with a run waiting for a decision (`run-…`), and twelve at 360 px (`small-…`). Live runs in the browser suites talk to the scripted stand-in through Playwright's routing; no key is real and nothing reaches api.anthropic.com. The parity suite needs a Rebate Hunter checkout next to the repository or its path as an argument; without one it reports a skip. The hygiene suite reads its private term list from the `HYGIENE_TERMS` secret or a `.hygiene-terms` file next to the repository; without one it runs the generic checks only and says so.
