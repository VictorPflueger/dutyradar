# Duty Radar (Pflichten-Radar)

Duty Radar is a browser-only prototype of an agentic AI system for bureaucracy reduction. An agent team inventories the reporting and documentation duties in a slice of federal law, finds duties that ask the same businesses for the same data, prices every duty and every relief option with the federal compliance-cost method (Erfüllungsaufwand), and drafts options that a person approves into a relief dossier. Its headline figure is the slice's coverage against the PflichtenLichten benchmarks of −⅓ for reporting duties and −½ for documentation duties.

Live site: <https://victorpflueger.github.io/dutyradar/>. English by default, German one click away (EN | DE in the header, or `?lang=de`).

## What it is

PflichtenLichten, part of the federal and Länder modernisation agenda, sets out to cut reporting duties by at least a third and documentation duties by at least half. Duty Radar shows what an AI-assisted review of a slice of federal law could look like under that target:

- every duty with its § citation, the highlighted trigger phrase and the note that the consolidated text is not the official version;
- duties that ask the same addressees for overlapping data, clustered, with a register that could supply the data;
- every duty and every option priced with the method of the Destatis guide on compliance cost, every figure traceable to an engine fact or labelled as an assumption;
- up to three costed relief options plus "keep" for each finding, and a human decision with a reason code before anything reaches the dossier. Nothing is ever sent.

The language model never computes a number: it classifies in categories, deterministic engines compute every figure, and a fact auditor blocks any figure without a source.

## How it works

1. **Inventory.** The pattern stage finds duty candidates in the sentences of the bundled law snapshot (`js/engine/patterns.js`, `data/patterns/duty-patterns.json`); in a run, a classifier sorts them into six duty types and three addressee groups.
2. **Duplicates.** Clustering links duties with the same addressees and population whose data items overlap (`js/engine/cluster.js`).
3. **Prices.** The cost engine applies the guide's basic scheme: case number × (time × wage rate + material cost), with the guide's wage tables and time values (`js/engine/cost.js`, `data/params/`).
4. **Options.** The option rules decide which of delete, merge, register retrieval, lower frequency and keep a duty or a cluster may get, and why not (`js/engine/options.js`).
5. **Audit.** Every text the agent writes passes the fact auditor (`js/engine/auditor.js`) before it is shown.
6. **Decision.** A person approves, rejects or asks for information, with a reason code; only an approval enters the dossier.

Version 0.1.0 holds the foundations: the snapshot, the engines with their fixtures, the data files, the shell in both languages and the tests. The agent runs (Simulation, Live and Sovereign mode) arrive with version 0.2.0.

## What is real, assumed or synthetic

| Real | Assumed | Synthetic or simulated |
| --- | --- | --- |
| The law texts and § citations (31 norms, consolidated texts of gesetze-im-internet.de) | Population sizes, case numbers and frequencies until calibration | The 32 complaints in `data/signals/complaints.json` |
| The cost method and the guide's wage and time tables (February 2026 edition) | The register retrieval's administration time and its one-off cost | Register availability (`data/registers.json`, all "simuliert") |
| The engines' arithmetic and the duty patterns | The exchange rate of 0.894 EUR per USD | The known data uses (`data/consumers.json`) |

Every assumed value carries the label "Annahme" (Assumption) with its rationale in both languages; [DATA_SOURCES.md](DATA_SOURCES.md) lists each source and assumption.

## The law snapshot

`tools/snapshot-laws.mjs` resolves the 31 norms of `config/slice.json` in the table of contents of gesetze-im-internet.de, parses each norm's XML strictly and writes `data/corpus/` and [SNAPSHOT.md](SNAPSHOT.md): 778 paragraphs and 4,904 sentences, retrieved on 19 November 2026. The host does not answer GitHub's runners or this project's build environment, so the bundled snapshot was built from the public daily archive of the host's files (QuantLaw/gesetze-im-internet, which stores them unchanged); the build is reproducible from the archive commit named in SNAPSHOT.md ([TECH_NOTES.md](TECH_NOTES.md) §5). The slice is marked provisional until it is confirmed.

## Measured recall

The gold set (`tests/fixtures/gold-duties.json`) holds 60 sentences of the slice, 40 duties and 20 non-duties, drawn in a seeded, reproducible order and labelled by hand. **The labels are the builder's and not yet confirmed.**

| Measure | Value | Note |
| --- | --- | --- |
| Pattern stage, recall on the 40 gold duties | 40 of 40 (100.0 %) | Target at least 95 % (AC-06). The patterns were extended against this gold set, so this is the recall on the set they were tuned with |
| Pattern stage, share of the 20 non-duties it flags | 1 of 20 | One permission sentence ("dürfen … übermittelt werden"); the classifier sorts such candidates out |
| Pattern plus classification, precision | Not measured yet | Needs one Live run (AC-29, version 0.2.0) |

`node tests/engine.mjs recall` re-measures both figures.

## Run it

The site is static: HTML, CSS and JavaScript modules, no build step and no runtime dependency. Browsers do not load the app's modules and data files from a `file://` page, so serve the folder:

```sh
npm run serve          # tools/serve.mjs, a dependency-free server at http://localhost:8080
```

The build-time tools need Node 22 or later and the development dependencies (`npm ci`): the XML parser and zip library of the snapshot script, and axe-core for the accessibility checks to come.

```sh
npm run snapshot -- --archive <checkout of the archive's data branch>   # rebuild data/corpus/
npm run csp                                                             # write the security policy into index.html
```

## Tests

`node tests/run-all.mjs` runs every suite; `npm test` the Node suites and `npm run e2e` the browser suites. [tests/README.md](tests/README.md) lists them and the setup for Playwright. GitHub Actions runs the Node suites, the parity check against Rebate Hunter's shell and the browser suites in Chromium on every push and pull request (`.github/workflows/tests.yml`).

## Status

| Milestone | Version | Scope | State |
| --- | --- | --- | --- |
| M1 Foundations | 0.1.0 | Snapshot, engines and fixtures, data files, gold set, shell in two languages, design tests, parity, CI | This version |
| M2 Agents and screens | 0.2.0 | The 16 tools, the Live loop with its caps, the Sovereign adapter, the six screens, R1 to R3 | Next |
| M3 Hardening and demo | 1.0.0 | End-to-end suites, accessibility, small screens, print, self-test, demo script, review | Later |

Decisions still open: the slice (D1, provisional), the sovereign endpoint (D3, none configured), calibration with OnDEA and DIP (D4, not reachable from the build environment, so every population and case number stays an assumption), the API key for recordings (D7, hand-authored runs until then) and the website card (D8).

## Acceptance record

Automated criteria pass in CI; manual ones are recorded here with date, person and result.

| Criterion | Test | Result |
| --- | --- | --- |
| AC-01 Golden cases G1 to G8 in both languages | `tests/engine.mjs golden` | Pass |
| AC-02 Fact auditor A01 to A31 | `tests/engine.mjs audit` | Pass |
| AC-03 Cluster cases K1 to K9 | `tests/engine.mjs cluster` | Pass |
| AC-04 Option cases O1 to O6, reasons in both languages | `tests/engine.mjs options` | Pass |
| AC-05 Slice coverage | `tests/engine.mjs golden coverage` | Pass |
| AC-06 Pattern-stage recall on the gold set | `tests/engine.mjs recall` | Pass (builder's labels, unconfirmed) |
| AC-07 Pattern boundaries and abbreviations | `tests/engine.mjs patterns` | Pass |
| AC-08 Snapshot stops on a missing slug or title; Norm contract | `tests/snapshot.mjs` | Pass |
| AC-09 Sources, synthetic and simulated labels, 25 to 35 norms | `tools/check-data.mjs` | Pass |
| AC-34 EU basis from the footnote | `tests/snapshot.mjs eu` | Pass |
| AC-39 Shared design tests, parity, adapted modules listed | `tests/tokens.mjs`, `tests/hexagon.mjs`, `tests/page-icon.mjs`, `tests/vici-files.mjs`, `tests/parity.mjs` | Pass (the page icon compared with the website's card from version 1.0.0) |

## Files

| Path | What it holds |
| --- | --- |
| `index.html`, `favicon.svg`, `css/`, `vici/` | The page, its icon, the shell's stylesheets and Vici v1.0.0 |
| `js/` | The shell modules, the boot (`js/main.js`), the workspace (`js/ui.js`), the languages (`js/i18n.js`, `js/i18n/`) |
| `js/engine/` | The deterministic engines: sentences, patterns, cluster, cost, options, facts, auditor, format, mappings |
| `config/` | The slice, the run defaults and the sovereign endpoint |
| `data/` | The law snapshot, the cost parameters, populations, one-off costs, the vocabulary, registers, data uses, complaints and patterns |
| `tools/` | The snapshot script, the data, static and policy checks, the local server |
| `tests/` | The suites, their fixtures and helpers |
| [DESIGN.md](DESIGN.md), [TECH_NOTES.md](TECH_NOTES.md), [DATA_SOURCES.md](DATA_SOURCES.md), [SNAPSHOT.md](SNAPSHOT.md), [REVIEW.md](REVIEW.md), [PLAN.md](PLAN.md) | Design, technical decisions, sources, the snapshot, the shell's parity, the build plan |

No licence file yet: all rights reserved until one is chosen.
