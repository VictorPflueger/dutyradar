# Tests (for developers)

The prototype needs no Node.js, npm or build step. These suites check it; GitHub Actions runs all of them on every push and pull request (`.github/workflows/tests.yml`).

| Suite | Command | Checks |
|---|---|---|
| figures | `node tests/figures.mjs` | `data/story.js` rebuilt from release 1.0.0's engines and compared byte for byte; every euro recomputed with the federal compliance-cost method; the counts and the target add up; the three key figures at every step and after each decision; every figure in `index.html` and both guides equal to the computed one; every euro in the documents computed, and the demo script's talk track the guide's |
| files | `node tests/files.mjs` | Every file the page loads exists; `js/lang.js` runs before `vici.js`; every import resolves and every module is used; the suites and the workflow name real files; `data/` holds only the generated story; none of 1.0.0's lab is left; `vici/` byte for byte as in ViciDesign at the pinned commit on its main branch |
| lean | `node tests/lean.mjs` | At most 8 modules, 1,000 lines of JavaScript, 500 of CSS and 15 buttons; no network, key or model code; a policy that connects nowhere; README and demo script within 1,000 words each |
| vici | `node tests/vici.mjs` | Vici's own `guideProblems`, `bylineProblems` and `writingProblems` on the page in English and German, on every sentence the steps write in both languages and on the four documents; Vici's German words in the German guide and byline |
| showcase | `node tests/showcase.mjs` | In Chromium: boot without errors or outside requests; the five steps by click, key and address; the bar under the story: its words, its button, Pause and the stop at each step, in view at every size; the three key figures top right at every step; the three decisions with their dossier; the language switch, also while Play runs; the layout at 1920 × 1080, 1366 × 768 and 1280 × 720 in both languages and themes, and at 375 px |
| guide | `node tests/guide-behaviour.mjs` | The guide's behaviour as Vici's standard and its render check describe it, in English and German; one guide per tab across both languages; `?guide=0` and `?guide=present`; the How it works chapter has a row for each key figure with the value its tile shows; the talk track has a line per step; every chapter fits 1280 × 720 and 1366 × 768 without scrolling |
| contrast | `node tests/contrast.mjs` | WCAG 2.2 AA for every visible text in eleven states, both languages, light and dark, at two sizes |
| hexagon | `node tests/hexagon.mjs` | Vici's hexagon rule in the app's files and the rendered page, both themes and languages |

`node tests/run-all.mjs` runs them in that order and ends with `ALL SUITES PASSED`. Name suites to run only those: `node tests/run-all.mjs figures vici`.

## Setup

The browser suites need Playwright with Chromium:

```
npm install -g playwright@1.56.0
npx playwright install chromium
NODE_PATH="$(npm root -g)" node tests/run-all.mjs
```

On Windows PowerShell: `$env:NODE_PATH = (npm root -g); node tests/run-all.mjs`.

The `files` and `vici` suites use a checkout of ViciDesign next to this repository (`../ViciDesign`, or the folder in `VICI_DIR`). The `figures` suite rebuilds the data from a checkout of this repository at release 1.0.0 (`../dutyradar-1.0.0`, or the folder in `DR_LEGACY`), for example `git worktree add ../dutyradar-1.0.0 7377619`. Without them those parts say so and pass; with `--require-vici` and `--require-legacy`, as on GitHub Actions, they fail instead.

Options: `CHROME_PATH` uses another Chrome or Chromium; `DR_TEST_OUT` sets the folder for screenshots (default: the system's temp folder, `duty-radar-tests/`). The suites serve the page on 127.0.0.1, ports 8461 to 8463 and one between 8790 and 9089, and block every other host.
