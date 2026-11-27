# Tests (for developers)

The prototype needs no Node.js, npm or build step. These suites check it; GitHub Actions runs all of them on every push and pull request (`.github/workflows/tests.yml`).

| Suite | Command | Checks |
|---|---|---|
| figures | `node tests/figures.mjs` | `data/story.js` rebuilt from release 1.0.0's engines and compared byte for byte; every euro recomputed with the federal compliance-cost method; the counts and the target add up, and the inventory counts what the ladder counts; the three key figures at every step and after each decision, answering first; every figure in `index.html` and both guides equal to the computed one; every euro in the documents computed, and the demo script's talk track the guide's |
| files | `node tests/files.mjs` | Every file the page loads exists; `js/lang.js` runs before `vici.js`; every import resolves and every module is used; the suites and the workflow name real files, and this file lists every suite; `data/` holds only the generated story and inventory, the inventory loaded when a list first opens; none of 1.0.0's lab is left; the top level holds the page, its folders and five documents; `vici/` byte for byte as in ViciDesign at the pinned commit on its main branch |
| lean | `node tests/lean.mjs` | At most 11 modules, 2,200 lines of JavaScript, 900 of CSS and 16 buttons; the only counts written into `index.html` are the three key figures; no network, key or model code; a policy that connects nowhere; README within 1,300 words, the demo script within 1,600 |
| vici | `node tests/vici.mjs` | Vici's own `guideProblems`, `bylineProblems`, `writingProblems`, `aiNoticeProblems`, `policyProblems`, `storageProblems`, `countProblems` (the key figures) and `recordIdProblems` (with every id of `data/story.js` and `data/inventory.js`) on the page in English and German, on every sentence the steps, the ladder, the lists, the comparison and the derivation write and on the four documents; Vici's German words in the German guide and byline |
| ladder | `node tests/ladder.mjs` | One rung per term from law to decision, each count equal to `data/story.js` and the inventory, named as the glossary names it and defined in one line that says what 1.0.0's code does; each step's rungs, each count opening what it counts |
| inventory | `node tests/inventory.mjs` | `data/inventory.js`: 745 duties, 125 discarded sentences and 48 clusters holding 203 duties, by law, type and addressee; every phrase the exact slice of its sentence; every link between duty, law, population and cluster; each duty's population size, but for the two the calibration capped |
| quotes | `node tests/quotes.mjs` | Every law quote on the comparison and both priced duties' sentences verbatim in 1.0.0's snapshot of its section, with the section's short title and link; the comparison quotes nothing of its own |
| derivation | `node tests/derivation.mjs` | The derivation again from its inputs, each with its kind and source; R1's figures before the calibration, exactly €4,065,600 and €3,926,400; the cap as the smaller public count; the sensitivity against 1.0.0's engines; the arithmetic in both languages |
| docs | `node tests/docs.mjs` | The six questions a first look raises, answered in short in `DEMO_SCRIPT.md` in both languages with the computed figures; README, DESIGN and DATA_SOURCES describe 2.2.0, the calibration's sources with their dates and OnDEA as not probed |
| review | `node tests/review.mjs` | `REVIEW.md` records each cold-read question, the expected answer and the answer given from screenshots alone, in English and German, and names no one |
| partner | `node tests/review.mjs partner` | The partner review's verdict is ready, with its One Thing, cut list, fix list and keep list |
| showcase | `node tests/showcase.mjs` | In Chromium: boot without errors or outside requests; the five steps by click, key and address; the bar under the story: “Your turn”, its button that names where it leads, Pause, the stop at each step, Vici's `vc-attention` where the page waits, in view at every size; the three key figures top right at every step, answering first; the three decisions with their result, dossier and Start again; no record id on any screen, the panels included; the language switch, also while the agent works; the layout at 1920 × 1080, 1366 × 768 and 1280 × 720 in both languages and themes, again at 1280 × 720 with text set 1 % wider, as another browser may set it, and at 375 px |
| guide | `node tests/guide-behaviour.mjs` | The guide's behaviour as Vici's standard and its render check describe it, in English and German; one guide per tab across both languages; `?guide=0` and `?guide=present`; a row for each key figure; two chapters that walk the ladder rung by rung; the talk track has a line per step that opens a list, the comparison and the derivation; every chapter fits 1280 × 720 and 1366 × 768 without scrolling, also with text set 1 % wider |
| contrast | `node tests/contrast.mjs` | WCAG 2.2 AA for every visible text in seventeen states, the panels with a law selected and counts highlighted among them, both languages, light and dark, at two sizes |
| hexagon | `node tests/hexagon.mjs` | Vici's hexagon rule in the app's files and the rendered page, the panels included, both themes and languages |
| panels | `node tests/panels.mjs` | In Chromium: every law named in words on the map, the legend in words, each list as long as its count, a count opened by click and Enter and closed by Esc with focus back, the highlights and the selection between map and story, the comparison, the derivation, “up to” while the overlap is assumed, and who carries each duty, in both languages |
| glossary | `node tests/glossary.mjs` | One word per thing on every screen, each defined on the ladder, in both languages; it first proves it catches a planted other word |
| guide-render | `node tests/guide-render.mjs` | Vici's own `check-guide-render.mjs` on the served page |

`node tests/run-all.mjs` runs them in that order and ends with `ALL SUITES PASSED`. Name suites to run only those: `node tests/run-all.mjs figures vici`.

## Setup

The browser suites need Playwright with Chromium:

```
npm install -g playwright@1.56.0
npx playwright install chromium
NODE_PATH="$(npm root -g)" node tests/run-all.mjs
```

On Windows PowerShell: `$env:NODE_PATH = (npm root -g); node tests/run-all.mjs`.

The `files`, `vici` and `guide-render` suites use a checkout of ViciDesign next to this repository (`../ViciDesign`, or the folder in `VICI_DIR`). The `figures`, `quotes` and `derivation` suites read a checkout of this repository at release 1.0.0 (`../dutyradar-1.0.0`, or the folder in `DR_LEGACY`), for example `git worktree add ../dutyradar-1.0.0 7377619`. Without them those parts say so and pass, but `guide-render` fails; with `--require-vici` and `--require-legacy`, as on GitHub Actions, they all fail instead.

Options: `CHROME_PATH` uses another Chrome or Chromium; `DR_TEST_OUT` sets the folder for screenshots (default: the system's temp folder, `duty-radar-tests/`). The suites serve the page on 127.0.0.1, ports 8461 to 8463, 8471 to 8473 and one between 8790 and 9089, and block every other host.
