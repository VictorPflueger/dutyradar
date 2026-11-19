# Tests

`node tests/run-all.mjs` runs every suite in order and prints a summary; `npm test` runs the Node suites (`--node`) and `npm run e2e` the browser suites (`--browser`). Name suites to run only those: `node tests/run-all.mjs engine snapshot`. No suite calls a real API, spends money or needs the internet; every browser suite blocks requests to other hosts and fails on a console error, a page error or a security-policy violation.

## What runs

| Suite | Checks | Criteria |
| --- | --- | --- |
| tokens, hexagon, page-icon, vici-files | The four shared design tests, unchanged, with Duty Radar's values in `tests/lib/prototype.mjs` | AC-39 |
| parity | The shell against Rebate Hunter's `main`; the adapted modules listed in REVIEW.md | AC-39 |
| unit | Both language files: identical keys, no empty value, the copy tables exactly; ICU in de-DE and en-GB | AC-15 (from M1), AC-01 |
| engine | Golden cases G1–G8 in both languages, coverage, fact auditor A01–A31, clusters K1–K9, options O1–O6, mappings, fact registry, sentence splitting and patterns, the gold set and the pattern stage's recall | AC-01–AC-07 |
| snapshot | The snapshot script on `tests/fixtures/toc-sample.xml` and the two-norm fixture slice: stops on a missing slug or title, the Norm contract, the EU basis | AC-08, AC-34 |
| data, corpus, sources | `tools/check-data.mjs`: the data files, the law snapshot, every source key | AC-09 |
| static | `tools/check-static.mjs`: security policy, no inline code, storage keys, pure engines, language keys, no key-like strings | AC-14 (from M1) |
| hygiene, docs | No relationship term or e-mail address in any published file; the documents complete, every path they name present | Definition of done |
| smoke, i18n, layout | Boot offline, intro, views, drawer, Diagnostics, keyboard, a failed boot; English first and the switch, a failed boot reported in German; viewports from 1920 × 1080 to 1280 × 720, light and dark at 1920 × 1080 and 1280 × 720 with a screenshot each, nothing cut to an ellipsis, and 360 px | AC-25, AC-38 (parts) |

The fixtures in `tests/fixtures/` come first: the specification's golden, auditor, cluster and option cases, copied unchanged with the English additions of the brief, and the gold set with its sampling method.

## Setup for the browser suites

The browser suites use Playwright, installed globally so the repository keeps only its development dependencies:

```sh
npm install -g playwright@1.56.0
npx playwright install chromium
NODE_PATH="$(npm root -g)" node tests/run-all.mjs --browser
```

`CHROME_PATH` points the suites at another Chromium; `PLAYWRIGHT_MODULE` at another Playwright folder; `DR_TEST_OUT` at the folder for test output (by default `duty-radar-tests` in the system's temporary folder): the layout suite writes its eight screenshots to the layout folder there, 1920 × 1080 and 1280 × 720, light and dark, English and German. The parity suite needs a Rebate Hunter checkout next to the repository or its path as an argument; without one it reports a skip. The hygiene suite reads its private term list from the `HYGIENE_TERMS` secret or a `.hygiene-terms` file next to the repository; without one it runs the generic checks only and says so.
