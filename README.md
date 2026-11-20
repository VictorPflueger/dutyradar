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

An agent orchestrates these steps through 16 tools (`js/tools/`): it reads, classifies, clusters, prices, drafts and asks for decisions, and the tools return engine figures as facts it can only cite. **Start agent** offers three modes:

- **Simulation** replays one of three hand-authored runs offline: R1 the pitch run over the whole slice, R2 the rejection path (a split cluster, a blocked figure, a rejection, a duty kept with its justification), R3 one norm end to end. The engines recompute every figure; your decisions are your own, and the run pauses for each. ×1, ×2, ×4 and Pause set the pace.
- **Live** runs the same agent against Claude with your API key, at most 40 model calls and €3 per run; the control bar shows calls and spend. The key stays in the tab.
- **Sovereign** would run it against an OpenAI-compatible endpoint you operate; none is configured, so the mode is shown disabled with its reason.

The screens: the duty map (norms × duty types, a cell opens its duty cards), the duplicates board, Options & review, the outbox with the relief dossier and four exports, the audit log, and Assumptions & diagnostics with the editable assumptions and the self-test. Every figure opens "Where does this figure come from?". Everything works by keyboard; below 900 px the views are one menu and the console a drawer; printing gives the dossier. [DEMO_SCRIPT.md](DEMO_SCRIPT.md) is the presenter's guide, with the talk track in English and German.

## What is real, assumed or synthetic

| Real | Assumed | Synthetic or simulated |
| --- | --- | --- |
| The law texts and § citations (31 norms, consolidated texts of gesetze-im-internet.de) | Population sizes, case numbers and frequencies until calibration | The 32 complaints in `data/signals/complaints.json` |
| The cost method and the guide's wage and time tables (February 2026 edition) | The register retrieval's administration time and its one-off cost | Register availability (`data/registers.json`, all "simuliert") |
| The engines' arithmetic and the duty patterns | The exchange rate of 0.894 EUR per USD | The known data uses (`data/consumers.json`) |

Every assumed value carries the label "Annahme" (Assumption) with its rationale in both languages; [DATA_SOURCES.md](DATA_SOURCES.md) lists each source and assumption.

## The law snapshot

`tools/snapshot-laws.mjs` resolves the 31 norms of `config/slice.json` in the table of contents of gesetze-im-internet.de, parses each norm's XML strictly and writes `data/corpus/` and [SNAPSHOT.md](SNAPSHOT.md): 778 paragraphs and 4,904 sentences, retrieved on 19 November 2026. The host does not answer GitHub's runners or this project's build environment, so the bundled snapshot was built from the public daily archive of the host's files (QuantLaw/gesetze-im-internet, which stores them unchanged); the build is reproducible from the archive commit named in SNAPSHOT.md ([TECH_NOTES.md](TECH_NOTES.md) §5). Victor confirmed the slice on 19 November 2026.

## Measured recall

The gold set (`tests/fixtures/gold-duties.json`) holds 60 sentences of the slice, 40 duties and 20 non-duties, drawn in a seeded, reproducible order and labelled by hand. Victor Pflüger confirmed the labels on 19 November 2026.

| Measure | Value | Note |
| --- | --- | --- |
| Pattern stage, recall on the 40 gold duties | 40 of 40 (100.0 %) | Target at least 95 % (AC-06). The patterns were extended against this gold set, so this is the recall on the set they were tuned with |
| Pattern stage, share of the 20 non-duties it flags | 1 of 20 | One permission sentence ("dürfen … übermittelt werden"); the classifier sorts such candidates out |
| Pattern plus classification, precision | Not measured yet | Needs one Live run with a key (AC-29, manual, pending with Victor) |

`node tests/engine.mjs recall` re-measures both figures.

## Run it

The site is static: HTML, CSS and JavaScript modules, no build step and no runtime dependency. Browsers do not load the app's modules and data files from a `file://` page, so serve the folder:

```sh
npm run serve          # tools/serve.mjs, a dependency-free server at http://localhost:8080
```

The build-time tools need Node 22 or later and the development dependencies (`npm ci`): the XML parser and zip library of the snapshot script, and axe-core for the accessibility suite.

```sh
npm run snapshot -- --archive <checkout of the archive's data branch>   # rebuild data/corpus/
npm run csp                                                             # write the security policy into index.html
node tools/author-runs.mjs                                              # regenerate data/runs/R1 to R3
```

Address options: `?lang=de` opens in German, `?speed=n` (up to 1000) replays faster than ×4 for rehearsals, and `?record=1` adds **Record run** to Live and Sovereign mode (TECH_NOTES §13).

## Tests

`node tests/run-all.mjs` runs every suite; `npm test` the Node suites and `npm run e2e` the browser suites. [tests/README.md](tests/README.md) lists them and the setup for Playwright. GitHub Actions runs the Node suites, the parity check against Rebate Hunter's shell, the page icon against the website's card and the browser suites in Chromium on every push and pull request, and replays R1 and runs the self-test in Firefox and WebKit (`.github/workflows/tests.yml`). After every GitHub Pages build, `.github/workflows/live-site.yml` checks that the published site serves the commit and replays R1 there with every other host blocked (`tests/live_site.mjs`). In the browser, **Assumptions & diagnostics → Run all tests** runs the golden, auditor and cluster cases from the same fixture files.

## Status

| Milestone | Version | Scope | State |
| --- | --- | --- | --- |
| M1 Foundations | 0.1.0 | Snapshot, engines and fixtures, data files, gold set, shell in two languages, design tests, parity, CI | Done |
| M2 Agents and screens | 0.2.0 | The 16 tools, the Live loop with its caps, the Sovereign adapter, the six screens, R1 to R3 | Done |
| M3 Hardening and demo | 1.0.0 | End-to-end suites in three browsers, accessibility, small screens, print, self-test, the demo script, an independent review, the live-site check, the website's card | This version |

Victor confirmed the slice (D1), the gold-set labels and the German labels of version 0.1.0 on 19 November 2026. Decisions still open: the sovereign endpoint (D3, none configured), calibration with OnDEA and DIP (D4, not reachable from the build environment, so every population and case number stays an assumption) and the API key for recordings (D7, hand-authored runs until then). The website's card (D8) is proposed for version 1.0.0 in a pull request on Victor's website.

**Known limits.** The law slice is one snapshot of 31 norms, consolidated texts and not the official version. Populations, case numbers, frequencies and the register retrieval's administration time are assumptions until calibration (D4). The three runs are hand-authored, not recorded from a model (D7); the classifier's precision needs a Live run (AC-29). Registers are simulated, complaints synthetic. Sovereign mode has no endpoint (D3). The prototype is tested at 1920 × 1080 to 1280 × 720 and at 360 px, in Chromium with every suite and in Firefox and WebKit with the storyline of R1 and the self-test.

## Acceptance record

Automated criteria pass in CI; manual ones are recorded here with date, person and result.

| Criterion | Test | Result |
| --- | --- | --- |
| AC-01 Golden cases G1 to G8 in both languages | `tests/engine.mjs golden` | Pass |
| AC-02 Fact auditor A01 to A31 | `tests/engine.mjs audit` | Pass |
| AC-03 Cluster cases K1 to K9 | `tests/engine.mjs cluster` | Pass |
| AC-04 Option cases O1 to O6, reasons in both languages | `tests/engine.mjs options` | Pass |
| AC-05 Slice coverage | `tests/engine.mjs golden coverage` | Pass |
| AC-06 Pattern-stage recall on the gold set | `tests/engine.mjs recall` | Pass (labels confirmed on 19 November 2026) |
| AC-07 Pattern boundaries and abbreviations | `tests/engine.mjs patterns` | Pass |
| AC-08 Snapshot stops on a missing slug or title; Norm contract | `tests/snapshot.mjs` | Pass |
| AC-09 Sources, synthetic and simulated labels, 25 to 35 norms | `tools/check-data.mjs` | Pass |
| AC-34 EU basis from the footnote | `tests/snapshot.mjs eu` | Pass |
| AC-39 Shared design tests, parity, adapted modules listed | `tests/tokens.mjs`, `tests/hexagon.mjs`, `tests/page-icon.mjs`, `tests/vici-files.mjs`, `tests/parity.mjs` | Pass (the page icon compared with the website's card in CI) |
| AC-10 Each tool's valid and invalid fixture input | `tests/tools.mjs cases` | Pass |
| AC-11 The Live loop's requests: version, browser header, strict tools, `tool_choice`, no sampling parameters, results first, thinking unchanged | `tests/live.mjs request` | Pass |
| AC-12 The Sovereign adapter's function format, `tool_calls`, `tool` messages | `tests/live.mjs sovereign` | Pass |
| AC-13 The two-norm fixture slice through inventory, clustering, costing and options | `tests/tools.mjs pipeline` | Pass |
| AC-14 Policy, no inline code, no outside URL but the API, `dr.` keys, no `toFixed` in the engines, no key-like string | `tools/check-static.mjs` | Pass |
| AC-15 Identical keys, no empty value, the copy tables exactly | `tests/unit.mjs` | Pass |
| AC-16 R1 to R3 pass the run checker in both languages | `tools/check-runs.mjs` | Pass |
| AC-19 No decision without a reason code; Z5 and A6 need a comment of at most 500 characters; keep needs A1 to A4 or A6 | `tests/accept.mjs decisions` | Pass |
| AC-22 No 41st call, no call once €3 are spent, `cap_reached` logged | `tests/live.mjs caps`, `tests/accept.mjs caps` | Pass (against the scripted stand-in) |
| AC-23 A dummy key never in localStorage, exports, the audit, a recording or the console | `tests/accept.mjs key` | Pass |
| AC-36 Fact ids bound to their keys across replays and after an edit; "no longer applies" | `tests/runs.mjs facts` | Pass |
| AC-37 The classification tool takes no number; code sets frequency, confidence and `eu_related` | `tests/tools.mjs classify` | Pass |
| AC-38 The switch on every screen without a reload; model text keeps its language and tag; `?lang=`; German at 1280 × 720 | `tests/i18n.mjs` | Pass |
| AC-17 R1 replays offline in Chromium, Firefox and WebKit: it pauses, ends with the approved item in the dossier, and the tiles equal the engine's facts | `tests/storyline.mjs R1` (Chromium in the browser job, `--browser=firefox` and `--browser=webkit` in the browsers job), `tests/sims.mjs` | Pass |
| AC-18 R2: the split in the audit, the blocked figure, the rejection, the duty kept with A1, no relief item; in both languages | `tests/storyline.mjs R2`, `tests/sims.mjs R2` | Pass |
| AC-20 Every figure in the tiles, the option cards and the dossier opens "Where does this figure come from?"; in both languages | `tests/accept.mjs figures` | Pass |
| AC-21 Editing an assumption recomputes facts, options and tiles and logs `parameter_changed` | `tests/accept.mjs assumptions` | Pass |
| AC-24 The exports download with the names of the active language; the CSV has semicolons, a byte order mark and the columns | `tests/accept.mjs exports` | Pass |
| AC-25 A German browser's first visit opens in English; both disclosure lines on every screen; "Nothing is sent." and "Nichts wird versendet." | `tests/accept.mjs disclosures`, `tests/i18n.mjs` | Pass |
| AC-26 axe-core finds no serious or critical violation on the six screens; the storyline by keyboard alone | `tests/a11y.mjs` (both themes, both languages) | Pass |
| AC-27 At 360 px the console is a drawer, the views a select menu, the tiles two by two, nothing scrolls sideways | `tests/layout.mjs small` | Pass |
| AC-28 "Run all tests" shows the golden, auditor and cluster cases passing; in both languages | `tests/selftest.mjs` (Chromium, Firefox and WebKit) | Pass |
| AC-33 Keep needs A1 to A4 or A6, closes the target's other options and lists the duty under the kept duties; in both languages | `tests/accept.mjs keep`, `tests/accept.mjs decisions` | Pass |
| AC-35 A decision other than the recorded intention yields matching tiles, dossier and report, and no replayed text names the intended outcome | `tests/accept.mjs other`, `tests/runs.mjs` | Pass |
| AC-29 Pattern plus classification reaches at least 85 % precision on the gold set in one Live run | Manual: open the site with `?record=1`, run R1 in Live mode with a key, press Record run, then `node tools/measure-precision.mjs <the downloaded file>` | Pending with Victor |
| AC-30 Live mode runs R3's norm end to end within the caps; the audit shows model, usage and cost | Manual: choose R3, Start agent, Live, paste a key; then the Audit tab and the cost meter. Rehearsed against the stand-in by `tests/accept.mjs live` | Pending with Victor |
| AC-31 Sovereign runs one norm, or stays disabled with its reason | `tests/accept.mjs modes`: disabled with "No sovereign endpoint configured" | Pass (disabled while D3 is open); a run against an endpoint pending with Victor |
| AC-40 An English Live run narrates and reports in English and a German one in German; law quotes and amendment wording stay German | Manual: R3 Live once with `?lang=en` and once with `?lang=de`, then the console's EN and DE tags and the draft wording | Pending with Victor |

| AC-32 The storyline twice at ×1, once in English and once in German, without help; no federal eagle, logo or imitation of an official site | Manual: [DEMO_SCRIPT.md](DEMO_SCRIPT.md), one rehearsal per language | Pending with Victor |

Victor watched R1 replay end to end before M2 was merged. The risk-class check with the Bundesnetzagentur's tool ([TECH_NOTES.md](TECH_NOTES.md) §14) and Victor's sign-off after the second rehearsal are pending with him too.

## Files

| Path | What it holds |
| --- | --- |
| `index.html`, `favicon.svg`, `css/`, `vici/` | The page, its icon, the shell's stylesheets and Vici v1.0.0 |
| `js/` | The shell modules, the boot (`js/main.js`), the workspace (`js/ui.js`) and its screens, the run controller, the Live loop (`js/agent.js`), the replay (`js/simulation.js`), the run state (`js/state.js`), the audit log, the exports, the languages (`js/i18n.js`, `js/i18n/`) |
| `js/tools/`, `js/llm/` | The 16 tools with their strict schemas; the Sovereign adapter |
| `js/engine/` | The deterministic engines: sentences, patterns, cluster, cost, options, facts, auditor, format, mappings |
| `config/` | The slice, the run defaults and the sovereign endpoint |
| `data/` | The law snapshot, the cost parameters, populations, one-off costs, the vocabulary, registers, data uses, complaints, patterns and the runs R1 to R3 (`data/runs/`) |
| `tools/` | The snapshot script, the run author and checker, the data, static and policy checks, the local server |
| `tests/` | The suites, their fixtures and helpers; `tests/live_site.mjs` and `tests/remote_head.mjs` check the published site |
| `.github/workflows/` | The tests, the live-site check after every Pages build, the snapshot |
| [DEMO_SCRIPT.md](DEMO_SCRIPT.md) | The presenter's guide: preparation, the venue check, the talk track in English and German, the offline fallback, short answers |
| [DESIGN.md](DESIGN.md), [TECH_NOTES.md](TECH_NOTES.md), [DATA_SOURCES.md](DATA_SOURCES.md), [SNAPSHOT.md](SNAPSHOT.md), [REVIEW.md](REVIEW.md), [PLAN.md](PLAN.md) | Design, technical decisions, sources, the snapshot, the shell's parity and the independent review, the build plan |

No licence file yet: all rights reserved until one is chosen.
