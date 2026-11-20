# Duty Radar: build plan

**Status:** Phase 0 plan of 19 November 2026, waiting for approval. No app code yet.

This plan turns the build brief and its functional specification into three milestones. The specification decides what to build; this file decides how, in which order, and how each step is proven. Where the plan departs from the specification or from the sister prototypes, it says so and gives the reason. Figures from the specification appear here unchanged. In this file "the specification" is the functional specification and "the brief" is the build brief; both stay outside the repository.

Duty Radar (German: Pflichten-Radar) inventories the reporting and documentation duties in a slice of federal law, finds duties that ask the same businesses for the same data, prices every duty and every relief option with the federal compliance-cost method (Erfüllungsaufwand), and drafts options that a person approves into a relief dossier. It measures the slice against the PflichtenLichten benchmarks of −⅓ for reporting duties and −½ for documentation duties.

Contents: [0 Summary](#0-phase-0-in-one-page) · [1 Findings and probes](#1-phase-0-findings) · [2 Architecture](#2-architecture-and-file-tree) · [3 Screens](#3-screens-on-the-shell) · [4 Two languages](#4-two-languages) · [5 Agent loop and modes](#5-agent-loop-and-the-three-modes) · [6 Snapshot and data](#6-law-snapshot-and-data) · [7 Tests and CI](#7-tests-and-ci) · [8 Milestones](#8-milestones-and-acceptance-criteria) · [9 Risks](#9-risks-and-how-i-will-test-them) · [Appendix](#appendix-a-browser-console-probes)

---

## 0. Phase 0 in one page

**What I did.** Read the brief and the specification in full and recomputed the golden cases G1 to G8 and the option figures of O1, O3 and O6 from their inputs, with every German and English display string, on Node 22.23.5 (all 22 checks pass; section 1.1). Studied the four sister prototypes at their current commits (Rebate Hunter 7.2.0 `73c00f8`, Navigator 1.2.0 `61f1483`, Timetable Translator 1.4.0 `04006b6`, Repack Pilot 0.5.0 `c319649`): the shell modules, the agent loop, the parity, hygiene and docs tests and the workflows line by line, the other documents, `index.html`, `js/`, `data/`, `tools/` and `tests/` by outline and search (section 1.1 says what in full). Read Vici v1.0.0 at `fdd868b` (guidelines on colour, hexagon, layout, typography and data visualisation, the data components, `dist/tokens.json`) and the website's card list at `f6f7aae`. Played one Simulation of each sister to its end in headless Chrome, served from the clones. Probed the Claude API's CORS behaviour from the shell and from a real Chrome page, re-verified model IDs, prices, API versions, thinking and effort, and measured drafted schemas of all 18 tools against the strict-tool limits. Resolved the proposed slice against gii-toc.xml through the web-fetch tool, because the build shell cannot reach gesetze-im-internet.de.

**The plan in five lines.**

1. The sister shell carries over as the brief says: Vici, the shared modules and stylesheets, the four shared design tests, parity and hygiene. Four shell modules gain i18n (`js/drawer.js`, `js/progress.js`, `js/handover.js`, `js/modal.js`), and the rail becomes a strip of the seven roles. Everything domain-specific is new and follows the specification.
2. Six deterministic engines own every number: sentences and duty patterns, clustering, cost, option rules, the fact registry and the fact auditor. Tools are the only way to reach them. Engines return codes, and the interface renders the codes in English or German.
3. One run-event stream drives the screen in all three modes. Simulation replays R1 to R3 (both languages, every fact recomputed by the engines), Live runs Rebate Hunter's loop on the shared API module with the orchestrator and two sub-calls, and Sovereign translates to and from the OpenAI chat format.
4. The law snapshot runs in GitHub Actions, because this environment cannot reach gesetze-im-internet.de; the workflow pushes a branch, and I open the pull request.
5. Three milestones as in the specification, each one branch and one pull request with green CI: M1 foundations (v0.1.0), M2 agents and screens (v0.2.0), M3 hardening and demo (v1.0.0).

**Decisions for you** (section 1.6 has the reasons): D1 the slice (31 norms, marked provisional); D3 no sovereign endpoint in version 1; D4 no calibration until OnDEA is reachable; D6 the February 2026 guide's tables as soon as its PDF is in the project, illustrative rates until then; D7 hand-authored runs in both languages; D8 Vici's `filter` icon. Five proposals of mine (P-1 to P-5) settle details neither the brief nor the specification fixes.

**What I need from you.**

1. Enable GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `/ (root)`. The session proxy refuses the Pages API to me (HTTP 403), and it is a repository setting.
2. Add the repository secret `HYGIENE_TERMS` (Settings → Secrets and variables → Actions), one term per line: the private terms no published file may contain. Leave out the public bodies the prototype cites and their domains, because the check matches whole words in every file and has no allowlist. The proxy refuses the secrets API to me too.
3. Attach the Destatis guide of February 2026 (PDF, about 4 MB) to the project, so that M1 takes wage rates and time values from its tables (D6).
4. Optional: run the OnDEA probe in Appendix A and send me the console line (D4).
5. Approve or change the decisions. Then I start M1.

---

## 1. Phase 0 findings

### 1.1 What I read

| Source | What | Notes |
| --- | --- | --- |
| Build brief and functional specification (project files) | In full | G1–G8, O1, O3 and O6 recomputed: every raw value matches within ±0.005, and `Intl.NumberFormat` gives "1.220.000 €", "€1,220,000", "-500.000 €", "-€500,000", "16.667 Std.", "16,667 h", "30,0 %", "30.0%", "80,0 %" and "80.0%" after non-breaking spaces become spaces |
| Timetable Translator 1.4.0 (`04006b6`) | Line by line: REVIEW Parts 1–4, TECH_NOTES §1–11, DESIGN §3 and §10, `index.html`, the shell modules, `js/config.js`, `js/events.js`, `tests/parity.mjs`, `tests/hygiene.mjs`, `tests/docs.mjs`, `tests/run-all.mjs`, `tests/sims.mjs`, `tests/page-icon.mjs`, `tests/lib/harness.mjs`, both workflows. By outline and search: README, DEMO_SCRIPT, DATA_SOURCES, `tests/README.md`, `tests/lib/prototype.mjs` and the domain modules | The shell list of REVIEW Part 2 is the base of the reuse map (section 2.4) |
| Rebate Hunter 7.2.0 (`73c00f8`) | Line by line: `js/agent.js` and the shell modules (the same files as the Timetable Translator's, which its parity test confirms). By outline and search: README (Reading the screen), DESIGN, TECH_NOTES, REVIEW, the board modules, `tests/` | The reference shell and the agent loop (section 5.1) |
| Navigator 1.2.0 (`61f1483`) | TECH_NOTES §3 in full (CORS probes, headers, streaming, stop reasons, errors); the module list; `tests/` by search | Lacks `js/clock.js` and `js/labels.js`; loads Leaflet and map tiles from outside hosts, so it is no model for the security policy |
| Repack Pilot 0.5.0 (`c319649`) | PLAN.md §0–1 and §g–j (the approved Phase 0 plan), TECH_NOTES D71 (shell modules adapted openly); `tests/sims.mjs` by search | The model for this plan's structure and for listing adapted shell modules |
| Vici v1.0.0 (`fdd868b`) | Guidelines: colour, hexagon, layout, typography, data visualisation; components: data display, segmented control, `vc-progress-hex`; `dist/tokens.json`, `dist/vici-icons.svg` | `filter` is one of Vici's icons; `--vc-seq-1…7` is a merlot ramp, so the duty map uses an ink ramp (section 3.5) |
| Website (`f6f7aae`) | README (adding a card), `data/prototypes.js` | A card has name, kind, subtitle, description, url, code, icon, tags and note; the page-icon test reads icon and kind |

### 1.2 Sister prototypes played

The live sites are refused by this environment's network allowlist (`connect_rejected` for `victorpflueger.github.io`). I served each clone locally at the commit Pages deploys and played one Simulation at ×4 in headless Chrome 153 (Playwright 1.63), approving the recommended option and every draft, with every request to another host blocked and counted.

| Prototype | Result | Replay | Outside requests |
| --- | --- | --- | --- |
| Rebate Hunter | Done; SIMULATION badge; no page error, no CSP violation | 20 s at ×4 | None |
| Navigator | Done; same markings | 22 s at ×4 | Leaflet (unpkg.com, cdn.jsdelivr.net) and map tiles, blocked; the run still completes |
| Timetable Translator | Done; same markings | 13 s at ×4 | None |
| Repack Pilot | Done; same markings | 24 s at ×4 | None |

Screenshots at 1920 × 1080 and 1280 × 720 stay outside the repository (Appendix B).

### 1.3 Target repository

- `VictorPflueger/dutyradar`: public, created 19 November 2026, default branch `main`, no commits, no refs (`git ls-remote` empty). My session has `admin`, `maintain` and `push`; `has_pages` is `false`.
- The bootstrap commit holds this plan, a README stub and `.nojekyll`. After it, one branch and one pull request per milestone.
- The session proxy refuses the Pages API (`/repos/…/pages`) and the Actions secrets API with HTTP 403. It allows reading workflow runs and pull requests for this repository, so I can follow CI myself.

### 1.4 Probe log

All on 2026-11-19, times in UTC. "Shell" is the build environment's terminal; "web fetch" is the tool that reads public pages for me (it summarises, so I asked it to quote verbatim).

| # | Probe | How | Result |
| --- | --- | --- | --- |
| P1 | Browser header and CORS: preflight | Shell, 16:38: `OPTIONS /v1/messages` with `Origin: https://victorpflueger.github.io` and the four request headers | 200; `access-control-allow-origin: *`; allow-headers `x-api-key,anthropic-version,content-type,anthropic-dangerous-direct-browser-access`; max-age 600 |
| P2 | Browser header and CORS: keyless POST | Shell, 16:38, with and without `anthropic-dangerous-direct-browser-access: true` | With it: 401 `authentication_error`, `access-control-allow-origin: *`, `access-control-expose-headers: *`. Without it: 401 with no `access-control-allow-origin`. `GET /v1/models` with the header: 401, CORS open. The same with `anthropic-version: 2026-10-21` |
| P3 | Browser header and CORS from a real page | Chrome 153 headless, page on 127.0.0.1, 16:53 | With the header the page reads 401 `authentication_error`; without it `TypeError: Failed to fetch` (a CORS block); `/v1/models` with the header 401, readable. The header stays mandatory, as Navigator's TECH_NOTES §3 found on 12 October |
| P4 | Model IDs | Web fetch, models overview | `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5-5` (and `claude-fable-5-2`): 1M context, 128K output. Default effort: Sonnet 5.5 high, Haiku 5.5 medium, Opus 5.5 medium. Thinking adaptive on all three, always on for Opus 5.5 |
| P5 | Prices | Web fetch, pricing page | Sonnet 5.5 $2 in, $10 out, $2.50 5-minute cache write, $0.10 cache read; Opus 5.5 $4, $20, $5, $0.20; Haiku 5.5 $0.10, $0.50, $0.125, $0.01 for prompts up to 100,000 tokens and $0.50, $2.50, $0.625, $0.05 above. Identical to the sister apps' `js/config.js`. Exchange rate 1 USD = 0.894 EUR kept as the brief says |
| P6 | API versions, thinking and effort | Web fetch, versioning, thinking and effort pages | `2026-10-21` is the latest version and rejects `temperature`, `top_p` and `top_k`; `2023-06-01` is still listed and stays (brief §5.7). Thinking display defaults to `omitted` on the 5.5 models, so the loop asks for `summarized`. Sonnet 5.5 accepts `thinking: {type: "between_tools"}` at effort high or below and rejects `disabled`; Haiku 5.5 accepts `disabled` at high or below; Opus 5.5 rejects both |
| P7 | Strict-tool limits against the specification's schemas | Web fetch, structured-outputs page; schemas drafted from the specification's catalogue and measured by a script | Limits per request: 20 strict tools, 24 optional and 16 union-typed parameters across them; `additionalProperties: false`; no `minimum`, `maximum`, `minLength`, `maxLength`, `maxItems`, `oneOf` or `not`; `minItems` only 0 or 1. Measured: orchestrator 16 strict tools, 10 optional, 0 union-typed; classification sub-call 1 tool, 0 optional, 3 union-typed; amendment sub-call 1 tool, 0 optional, 1 union-typed. All 18 tools can be strict (section 5.4) |
| P8 | gii-toc.xml | Shell, 16:38: refused (`connect_rejected`). Web fetch, between 16:40 and 16:55: 1,275,315 characters read in 100,000-character chunks | Reachable only through web fetch. All 31 slugs of the proposed slice resolved with their titles (section 6.1). `verpackg` is no longer in the table of contents: the packaging law is now `verpackdg` (section 1.5, S1) |
| P9 | One xml.zip | Shell, 16:38: `milog/xml.zip` refused (`connect_rejected`) | Not probed: web fetch reads pages, not archives. The snapshot therefore runs in GitHub Actions (section 6.2) |
| P10 | DIP API | Shell: `search.dip.bundestag.de` refused. Web fetch of the DIP information sheet | Base URL `https://search.dip.bundestag.de/api/v1`; key in the `Authorization: ApiKey …` header or the `apikey` parameter; the public key is published on the DIP help page; at most 25 concurrent requests; 100 entities per page, full text 10; cursor paging; JSON or XML through `format`. The API itself not probed (host refused). The sheet does not name the full-text resource; the OpenAPI files decide in M1 |
| P11 | OnDEA | Shell: `www.ondea.de` refused. Web fetch: the site answered with a client error | Not probed. Appendix A has a one-line browser probe |
| P12 | Destatis guide, February 2026 | Shell: refused. Web fetch: the landing data only | Title "Leitfaden zur Ermittlung und Darstellung des Erfüllungsaufwands in Regelungsvorhaben der Bundesregierung", Ausgabe Februar 2026, published 26 February 2026 by Destatis, about 4 MB. Its tables were not read (D6) |
| P13 | GitHub | `gh api` | Repository public and empty; Pages and secrets APIs refused through the proxy; runs and pull requests readable |
| P14 | Prompt caching and stop reasons | Web fetch, prompt-caching and stop-reasons pages | A top-level `cache_control: {type: "ephemeral"}` is automatic caching: the breakpoint moves to the last cacheable block; 5-minute lifetime by default; 512 tokens minimum on the three 5.5 models; usage reports `cache_creation_input_tokens`, `cache_read_input_tokens` and `input_tokens`. Stop reasons as Rebate Hunter's loop handles them; a cut-off `tool_use` block needs a retry with a higher `max_tokens`; `pause_turn` comes only from server tools, which Duty Radar does not use |

### 1.5 What I think is wrong, missing or not buildable

| # | Where | Finding | Proposed fix |
| --- | --- | --- | --- |
| S1 | Specification, slice candidates | The Verpackungsgesetz (`verpackg`) is not in gii-toc.xml on 19 Nov 2026: where it would sort, the table holds "Gesetz zur Durchführung der Verordnung (EU) 2025/40 betreffend Verpackungen" (`verpackdg`) instead | Take `verpackdg` into the slice and confirm from its own text in M1 that it replaced the old law. Its duties are EU-related, so delete is never proposed for them (the option rules already say so) |
| S2 | Specification, slice candidates | The trade and the services statistics are one law: "Gesetz über die Statistik im Handels- und Dienstleistungsbereich" (`hdldlstatg`) | One entry in the slice |
| S3 | Specification, snapshot | Some titles in gii-toc.xml carry footnote marks (`… Verpackungen 2`, `… Elektronikgeräten 1 , 2`) | `expected_title` stores the title as gii-toc.xml has it, marks included; the script compares after collapsing white space and stops on any other difference |
| S4 | Specification, auditor rule 3 | Regulation numbers such as "(EU) 2025/40" count as bare digits, so the model cannot name an EU act by number | Keep the rule. The duty card shows `eu_basis` from data, never from model text; the system prompt tells the model to refer to "the EU basis" instead |
| S5 | Specification, run caps and orchestrator rule 8 | Rule 8 asks the model to summarise when the budget is reached, but the hard caps forbid any further call | A soft limit at 36 calls or €2.70 adds one line to the next tool result: "Budget nearly used: request open decisions, then call ui_report." At the hard cap code writes the closing report from the i18n template, as Simulation does (P-3) |
| S6 | Specification, live adapter | Cost per call from three models in one run; the shared `createCostTracker(modelId)` tracks one model | Copy `js/cost.js` unchanged and add the pure `usageCostUsd(model, usage)` of every call, sub-calls included, in the run's budget (section 5.3) |
| S7 | Specification, `ui_request_decision` and `audit_check` | Two input shapes each; strict schemas cannot express a top-level union | Optional fields (`target` with `option_ids`, or `cluster_id`; `text` or `option_id`), and code requires exactly one shape. Measured within the limits (P7) |
| S8 | Specification, tests | `@playwright/test` and `node --test` layouts; the brief takes the sister harness | Sister harness (`tests/run-all.mjs`, plain Playwright); the specification's fixture files keep their names under `tests/fixtures/`; `npm test` and `npm run e2e` are aliases |
| S9 | Specification, AC-17 | Firefox and WebKit runs; the sister CI runs Chromium only | A second browser job on `main` installs Firefox and WebKit for AC-17 |
| S10 | Brief §5.8, AC-39 | The page-icon test compares with the website's card only from M3 | Until then it reports the skip; the card's pull request on the website is an M3 deliverable |
| S11 | Environment | gesetze-im-internet.de, DIP, OnDEA, Destatis and Pages are unreachable from the build shell | Snapshot in Actions (section 6.2); OnDEA by your browser probe or by hand (D4); the guide as a project file (D6); the live site checked by the live-site workflow after every Pages build |

The brief's own changes (§5) are consistent with the specification wherever both speak; I found no contradiction between them beyond the overlaps resolved in the conflict table (section 2.5).

### 1.6 Decisions for you

| # | Decision | My recommended default | Why |
| --- | --- | --- | --- |
| D1 | Law slice | **The 31 norms of section 6.1**, marked "provisional" in the slice selector until you confirm them | Business statistics, energy statistics, minimum-wage and working-time records, product-responsibility registers and the trade regulation with its ordinances: dense business reporting and documentation duties, and several plausible duplicate requests to check in M1, none presumed |
| D3 | Sovereign endpoint | **None in version 1**: the mode is shown and disabled with "No sovereign endpoint configured" | The adapter and its tests are built against a scripted stand-in; any OpenAI-compatible endpoint can be added through `config/sovereign.json` and `npm run csp` |
| D4 | Calibration with OnDEA and DIP | **No calibration in M1.** If your OnDEA probe works, I transcribe matching entries by hand with the source key `ondea:<id>`; DIP stays off unless you add a `DIP_API_KEY` secret and name a draft law | Neither host is reachable from here; every uncalibrated value keeps its "Annahme" label |
| D6 | Wage rates and time values | **The February 2026 guide's tables as soon as its PDF is a project file**; until then €40 per hour for businesses and €45 for administration, labelled "Annahme" | The guide's body is not readable from here (P12) |
| D7 | API key for recording R1 to R3 | **Hand-authored R1 to R3 in both languages**, marked hand-authored, replaced by recordings when you record with `?record=1` | No key in this environment, and I never ask for one |
| D8 | Page icon and website card | **Vici's `filter` icon in a lilac hexagon cell, kind "prototype"**; the card text comes to you in M3 | `filter` is in Vici's set and says what the agent does to the law |
| P-1 | File tree | Sister module names for every app module that has a sister counterpart (`js/agent.js`, `js/simulation.js`, `js/recorder.js`, `js/audit.js`, `js/console.js` …); the specification's folders for what is new (`js/engine/`, `js/tools/`, `js/llm/openai-compat.js`, `js/i18n/`) | A sister developer finds the same module in the same place; the engines stay a pure folder that runs under Node |
| P-2 | Event bus | `js/events.js` keeps the specification's RunEvent types as the recorded format and derives from them the shell events the adapted modules listen to (`state_change`, `options`, `option_decision`, `run_end`) | The recordings follow the specification; `js/handover.js` keeps its logic and only gains i18n |
| P-3 | Soft budget | Section 5.3: a warning at 36 calls or €2.70, the closing report from the template at the hard cap | Reconciles rule 8 with the hard caps (S5) |
| P-4 | Cost meter | In the control bar, in Live and Sovereign mode only, as "N of 40 calls · €x.xx of €3" | The header's four tiles are the specification's; the sister apps' fourth tile (session cost) has no place in it |
| P-5 | Assumptions and diagnostics | The shell's Diagnostics dialog, made wide, with six sections: Assumptions (the parameter table with inline editing), Snapshot, Self-test (Run all tests), Network and security policy, Model and caps, Run figures | One place for trust, as in the sister apps; the drawer stays at three tabs, which a 1280 × 720 screen can hold |

---

## 2. Architecture and file tree

### 2.1 Layers

1. **Interface:** the sister shell (header, control bar, centrepiece, console with the role strip, drawer) with Duty Radar's views: start panel, duty map, duplicates board, options and review, outbox, audit, the Diagnostics dialog.
2. **Run producers:** the Live loop (`js/agent.js`, adapted from Rebate Hunter), the Sovereign adapter (`js/llm/openai-compat.js`) and the replay player (`js/simulation.js`). All three emit the same RunEvents.
3. **Tools:** the 16 tools in `js/tools/`, each validating its input in code against its schema and returning JSON; two of them make a model sub-call.
4. **Engines:** `js/engine/` (sentences, patterns, cluster, cost, options, facts, auditor, format): pure functions, no DOM, no storage, no fetch; data passed in.
5. **Data:** the law snapshot and the parameter files, fetched once from the site itself (security policy `'self'`).

The language model never computes, stores or invents a number; only a human decision puts anything into the dossier; nothing leaves the page except a model call in Live or Sovereign mode.

### 2.2 How a run works

1. **Start.** The presenter picks a run (R1, R2, R3) and a mode. Simulation needs nothing; Live needs a key that `GET /v1/models` accepted; Sovereign needs a configured endpoint.
2. **Inventory.** The corpus agent lists the norms, the duty extractor finds candidates by pattern and classifies them in batches of at most 25 (Haiku 5.5 sub-call in Live); code sets frequencies and confidences from the categories.
3. **Cluster and price.** The once-only matcher clusters confirmed duties and finds register candidates; the cost agent builds the cost parameters and prices duties and clusters. Every number becomes a Fact with an id.
4. **Signals and options.** The signal agent links synthetic complaints; the drafting agent gets the eligible options from the rules, drafts German amendment wording (plus an English gist in an English run) and passes the fact auditor.
5. **Decide.** `ui_request_decision` pauses the run until the reviewer decides with a reason code (or confirms or splits a cluster). Approvals move the gauges and tiles; the dossier fills.
6. **Report.** The closing report uses placeholders only. In Simulation it comes from the template.

### 2.3 File tree

```text
dutyradar/
├── index.html              CSP meta tag (set by tools/set-csp.mjs), English static defaults, page icon
├── favicon.svg             Vici's filter icon in a lilac hexagon cell
├── .nojekyll
├── package.json            development dependencies only: fast-xml-parser, fflate, axe-core
├── vici/                   Vici v1.0.0, copied unchanged (vici/README.md)
├── css/                    the shell's components, console, drawer, modals and style (up to its app
│                           block), plus app.css (role strip, duty map, duplicates, options, dossier,
│                           small screens) and print.css (the dossier)
├── js/
│   ├── shell modules       theme, anthropic, sse, cost, keystore, clock, dom, labels, md (unchanged);
│   │                       drawer, progress, handover, modal (adapted: i18n, app-defined tabs and steps)
│   ├── events.js           RunEvent bus with the specification's types and the derived shell states
│   ├── icons.js            Vici's icons plus Rebate Hunter's drawings
│   ├── config.js           app id dr, version, models and prices, caps, exchange rate, storage keys
│   ├── i18n.js             t(), language state, dr.lang, ?lang=, <html lang>, Intl formatters
│   ├── i18n/               en.json, de.json (identical keys)
│   ├── main.js, ui.js      boot and wiring
│   ├── state.js            run, duties, clusters, facts, decisions; change events
│   ├── agent.js            the Live loop (orchestrator), caps, stop rules, retries
│   ├── subcalls.js         duty_classify and draft_amendment model sub-calls
│   ├── prompt.js           system prompts in English and German
│   ├── simulation.js       replay player for data/runs/R1–R3.json
│   ├── recorder.js         ?record=1 and "Record run"
│   ├── llm/openai-compat.js  Sovereign: Anthropic message format to and from OpenAI chat format
│   ├── tools/              one module per tool, schemas.js, registry.js
│   ├── engine/             sentences, patterns, cluster, cost, options, facts, auditor, format
│   ├── console.js, tool_plain.js, summaries.js, run_facts.js, ai_label.js, popovers.js, pop.js
│   ├── controls.js, dialogs.js, intro.js, kpi.js
│   ├── dutymap.js, dutycard.js, duplicates.js        the centrepiece's two views and the duty cards
│   ├── options_panel.js, outbox.js, exports.js       drawer tabs and downloads
│   ├── audit.js, audit_panel.js                       AuditEvents, dr.audit.<run_id>, export
│   └── diagnostics.js, diagnostics_view.js, selftest.js
├── config/                 slice.json, calibration.json, sovereign.json, run.json
├── data/
│   ├── corpus/             index.json and one <slug>.json per norm (generated by the snapshot)
│   ├── params/             cost-params.json, populations.json, one-off.json
│   ├── patterns/           duty-patterns.json
│   ├── vocab/              data-items.json
│   ├── signals/            complaints.json (synthetic)
│   ├── runs/               R1.json, R2.json, R3.json
│   ├── calibration/        optional (D4)
│   └── registers.json, consumers.json
├── tools/                  snapshot-laws, snapshot-dip, set-csp, check-runs, check-static, check-data, serve
├── tests/
│   ├── run-all.mjs, README.md
│   ├── lib/                harness.mjs, prototype.mjs, fake-claude.mjs, fake-openai.mjs
│   ├── fixtures/           golden-cases, gold-duties, audit-cases, cluster-cases, option-cases,
│   │                       toc-sample.xml, slice-mini/, llm/
│   └── suites              tokens, hexagon, page-icon, vici-files, parity, hygiene, docs, unit, engine,
│                           snapshot, data, static, runs, tools, live, smoke, sims, accept, i18n,
│                           layout, design, a11y, storyline, selftest, live_site (section 7.1)
├── .github/workflows/      tests.yml, live-site.yml, snapshot.yml
└── README.md, DESIGN.md, TECH_NOTES.md, DATA_SOURCES.md, SNAPSHOT.md, DEMO_SCRIPT.md, REVIEW.md
```

### 2.4 Reuse map

Dispositions: **Copy** (unchanged, apart from the names the parity test normalises), **Adapt** (the sister file, changed openly and listed in REVIEW.md), **Replace** (same role, new content), **Model** (a sister module that shapes a new one), **New**, **Drop**.

#### Shared shell (the Timetable Translator's REVIEW.md, Part 2)

| File | From | Disposition | Note |
| --- | --- | --- | --- |
| `vici/` | Vici v1.0.0 via Rebate Hunter | Copy | Byte for byte, with `vici/README.md`; checked by `tests/vici-files.mjs` and `tests/parity.mjs` |
| `js/theme.js` | Rebate Hunter | Copy | Theme before the page is drawn; `vc-theme` is the one shared storage key |
| `js/anthropic.js` | Rebate Hunter | Copy | Streaming client, `withRetry`, `checkKey`, `ApiError`; its English messages are translated by status and error type where the app shows them |
| `js/sse.js` | Rebate Hunter | Copy | |
| `js/cost.js` | Rebate Hunter | Copy | `usageCostUsd` per call and model (section 5.3) |
| `js/keystore.js` | Rebate Hunter | Copy | Key under `dr.anthropic.key` through `STORAGE` in `js/config.js` |
| `js/clock.js` | Rebate Hunter | Copy | |
| `js/dom.js` | Rebate Hunter | Copy | |
| `js/labels.js` | Rebate Hunter | Copy | Knows English narration labels only; Duty Radar's narration is one sentence per `ui_progress` and needs no labels |
| `js/md.js` | Rebate Hunter | Copy | Escape-first Markdown for the report and the dossier preview |
| `js/drawer.js` | Rebate Hunter | Adapt | Strings through i18n ("Show", "Hide", the drawer note, the byline's words); tabs passed in by the app: Options & review, Outbox, Audit |
| `js/progress.js` | Rebate Hunter | Adapt | Role strip: seven role markers and the merlot step "Your decision"; strings through i18n (section 3.6) |
| `js/handover.js` | Rebate Hunter | Adapt | "Awaiting your decision" and the state labels through i18n; logic unchanged |
| `js/modal.js` | Rebate Hunter | Adapt | "Close dialog" through i18n |
| `css/components.css` | Rebate Hunter | Copy | |
| `css/console.css` | Rebate Hunter | Copy | `css/app.css` overrides the rail's styles for the role strip |
| `css/drawer.css` | Rebate Hunter | Copy | Same rules |
| `css/modals.css` | Rebate Hunter | Copy | Same rules |
| `css/style.css` | Rebate Hunter | Copy | Up to the marked app block; Duty Radar's block below it (two disclosure lines, EN and DE switch, cost meter) |
| `tests/tokens.mjs` | Rebate Hunter | Copy | Contrast in both themes; the app's pairs in `tests/lib/prototype.mjs` |
| `tests/hexagon.mjs` | Rebate Hunter | Copy | Empty exception list |
| `tests/page-icon.mjs` | Rebate Hunter | Copy | Compares with the website's card when a checkout sits next to the repository |
| `tests/vici-files.mjs` | Rebate Hunter | Copy | |
| `tests/lib/prototype.mjs` | Timetable Translator | Adapt | Duty Radar's name, colour pairs (duty-map ramp, gauges, cluster cards), hexagon tour and page icon |
| `tests/parity.mjs` | Timetable Translator | Adapt | The four adapted modules move from the identical list to a list of adapted files; app names and the `dr.` prefix normalised |

#### Files the shared tests import, and the test and CI infrastructure

| File | From | Disposition | Note |
| --- | --- | --- | --- |
| `js/events.js` | Timetable Translator | Replace | The specification's RunEvent types; derived shell states (P-2) |
| `js/icons.js` | Rebate Hunter | Adapt | Vici's icons and Rebate Hunter's eight drawings; role icons from Vici's set |
| `tests/lib/harness.mjs` | Timetable Translator | Adapt | `dr.` keys, the intro flag, ports |
| `tests/lib/fake-claude.mjs` | Timetable Translator | Adapt | Scripted Messages API that checks headers, strict tools, `tool_choice`, missing sampling parameters, tool results first and thinking blocks returned unchanged |
| `tests/run-all.mjs` | Timetable Translator | Adapt | Duty Radar's suites (section 7.1) |
| `tests/hygiene.mjs` | Timetable Translator | Copy | Term list from the `HYGIENE_TERMS` secret or `../.hygiene-terms` |
| `tests/docs.mjs` | Timetable Translator | Adapt | Duty Radar's documents, sections and live URL |
| `tests/live_site.mjs`, `tests/remote_head.mjs` | Timetable Translator | Adapt | The published site serves this commit and replays R1 |
| `.github/workflows/tests.yml` | Timetable Translator | Adapt | Node 22, ubuntu-24.04, Playwright 1.56.0; plus the Firefox and WebKit job on `main` |
| `.github/workflows/live-site.yml` | Timetable Translator | Copy | After every Pages build |
| `.github/workflows/snapshot.yml` | none | New | Section 6.2 |

#### Sister app modules

| Sister module | Disposition | Duty Radar |
| --- | --- | --- |
| `js/config.js` | Adapt | App id `dr`, name, version; models and prices as verified (P4, P5); `AGENT` caps; 1 USD = 0.894 EUR; `STORAGE` keys `dr.*` |
| `js/main.js`, `js/ui.js` | Adapt | Boot, i18n, view routing |
| `js/agent.js` | Adapt | Rebate Hunter's loop with the orchestrator, sub-calls, caps, soft budget and the Sovereign hook (section 5) |
| `js/prompt.js` | Replace | The orchestrator's rules in English and German |
| `js/tools.js` | Replace | `js/tools/` (16 tools, strict schemas) |
| `js/simulation.js` | Replace | Replay of RunEvent JSON; facts recomputed; decisions free; cluster reviews enforced |
| `js/recorder.js` | Replace | `?record=1`, "Record run"; no thinking blocks, no keys |
| `js/sim_check.js`, `js/sim_vars.js` | Replace | The recorded-run checker (shared by `tools/check-runs.mjs` and Diagnostics); `{{fact:}}` and `{{cite:}}` rendering |
| `js/facts.js`, `js/guards.js` | Replace | `js/engine/facts.js`, `js/engine/auditor.js`; review transitions in `js/state.js` |
| `js/format.js` | Replace | `js/engine/format.js`: de-DE and en-GB display rules |
| `js/audit.js`, `js/audit_panel.js` | Adapt | The specification's AuditEvent; SHA-256 digests; redaction; `dr.audit.<run_id>` |
| `js/console.js`, `js/tool_plain.js`, `js/summaries.js`, `js/run_facts.js` | Adapt | One plain sentence per tool call with details behind *Details*, the role named, the EN or DE tag on live text, "Unsourced figure blocked" lines |
| `js/controls.js`, `js/dialogs.js`, `js/intro.js` | Adapt | Run menu R1–R3, slice selector, model menu, speeds, cost meter; mode dialog with three modes; key dialog; "How it works" |
| `js/kpi.js` | Replace | Four tiles: duties inventoried, two hexagonal gauges, compliance cost addressed with a faint pending figure |
| `js/options_panel.js`, `js/outbox.js` | Replace | Option cards, keep card, reason codes, comment, decisions; dossier preview, kept duties, exports |
| `js/popovers.js`, `js/pop.js`, `js/ai_label.js` | Adapt | "Where does this figure come from?" for every figure; the AI label |
| `js/diagnostics.js`, `js/diagnostics_view.js` | Adapt | API probe, the specification's security policy (`'self'`, the API and an optional sovereign origin), key and privacy, snapshot integrity, plus P-5's sections |
| `js/state.js` | Adapt | The specification's state store |
| Rebate Hunter's `js/board*.js` | Model | For `js/duplicates.js`: cluster cards sorted by € potential |
| `js/payoff.js`, `js/drafts.js`, world, sync, mirror, map, ERP and open-data modules, `data/*.js`, `tools/build_world.mjs` | Drop | Domain modules of the sisters |
| none | New | `js/i18n.js`, `js/i18n/*.json`, `js/engine/*`, `js/tools/*`, `js/llm/openai-compat.js`, `js/subcalls.js`, `js/dutymap.js`, `js/dutycard.js`, `js/duplicates.js`, `js/exports.js`, `js/selftest.js`, `css/app.css`, `css/print.css`, `config/*`, `data/*` (JSON), `tools/*` |

Documents grow with the code: README, DESIGN, TECH_NOTES, DATA_SOURCES, SNAPSHOT, DEMO_SCRIPT (English and German talk tracks), REVIEW (parity checklist, every adapted shell module with its reason, the independent review) and `tests/README.md`.

### 2.5 Conflict table

Every place where the specification and the shell overlap, with the resolution and its source. "Brief §5.x" is the brief's own decision; "Proposed" is mine, for your approval.

| # | Topic | Specification | Shell (sister apps) | Resolution | Source |
| --- | --- | --- | --- | --- | --- |
| C1 | Storage prefix | `pr.`; key under `pr.key.anthropic` | App prefix through `STORAGE` | `dr.`: `dr.anthropic.key` (session), `dr.audit.<run_id>`, `dr.lang`; `vc-theme` shared | Brief §5.1 |
| C2 | Product name | "Pflichten-Radar" in both languages | One name | "Duty Radar" in English, "Pflichten-Radar" in German | Brief §5.1 |
| C3 | Export file names | German names | None | Names follow the active language; the duty CSV keeps semicolons, byte order mark and decimal comma in both | Brief §5.1 |
| C4 | Default language | German first, English toggle | English only | English by default, German one click away; `?lang=` wins | Brief §5.2 |
| C5 | Narration and report language | German | English | The language active when the run starts; legal text German in both | Brief §5.2 |
| C6 | Tool error messages | German ("Bündel C-007 zuerst prüfen lassen") | English | English in both languages, shown behind *Details* | Brief §5.2 |
| C7 | Engine output | German texts | English texts | Codes with parameters, rendered by i18n; tools return code and label in the run's language | Brief §5.2 |
| C8 | Visual design | Sober public-sector look, one blue accent | Vici through the colour grammar | Vici: merlot the person in charge, lilac the AI, fjord checking, state tones with a word or mark, ink the rest, a neutral SIMULATION tape | Brief §5.6 |
| C9 | Fonts | A bundled Inter or Source Sans 3 | Vici's Bricolage Grotesque, Inter, JetBrains Mono | Vici's fonts | Brief §5.6 |
| C10 | Contrast standard | WCAG 2.1 AA | WCAG 2.2 AA | WCAG 2.2 AA | Brief §5.6 |
| C11 | Progress rail | Seven roles, idle, active, done | Five forward-only steps | Role strip adapted from `js/progress.js`; styles in `css/app.css` | Brief §5.6 |
| C12 | Layout | Header; 320 px left column with rail and console; tabs for six screens | Header, control bar, centrepiece and console, bottom drawer | The shell's layout with the mapping of section 3.1 | Brief §5.6 |
| C13 | Heat grid colour | One hue | Vici's merlot sequential scale | An ink ramp of seven steps, counts printed, contrast tested | Brief §5.6 |
| C14 | Gauges | Two gauges | `vc-progress-hex` | Vici's hexagonal progress, labelled with value and benchmark; the value is set through the CSSOM, not a `style` attribute, because the policy has no `'unsafe-inline'` | Brief §5.6 |
| C15 | Live client | `js/llm/anthropic.js` with an internal message format | `js/anthropic.js`, `js/sse.js`, `js/cost.js`; Anthropic's message format | The shell's modules and format; Sovereign translates | Brief §5.7 |
| C16 | API version | `2026-10-21` | `2023-06-01` | `2023-06-01`, one line in `js/config.js` to switch in all prototypes together (P6: both accepted) | Brief §5.7 |
| C17 | Stop rules | End on `end_turn`, `max_tokens`, `stop_sequence`, `refusal` | Rebate Hunter: cut-off tool call retried once at 1.5× (≤ 128,000); `max_tokens` continues; two nudges; `refusal` and full context end | Rebate Hunter's rules; every call counts toward the caps | Brief §5.7 |
| C18 | Retries | 1, 2 and 4 s for 429 and 5xx | `withRetry`: twice after 1.5 and 4 s or `retry-after` (≤ 20 s), 429, 500, 502, 503, 504, 529 and network errors, never a spend limit | `withRetry`; 401 and 400 as the specification says | Brief §5.7 |
| C19 | Prices and exchange rate | `config/prices.json`, 0.92 | `js/config.js`, 0.894, cache prices | `js/config.js`, 0.894, read-only in Diagnostics | Brief §5.7 |
| C20 | Strict tools | `strict: true` on every tool | Not strict | Strict on all 16 tools and both sub-call tools, within the limits (P7); every input also validated in code | Brief §5.7, measured |
| C21 | Key handling | `pr.key.anthropic`, "Schlüssel löschen" | Key dialog, `GET /v1/models` check, session storage | The shell's dialog and store; "Forget key" | Brief §5.7 |
| C22 | Recording | `?record=1`, "Lauf aufzeichnen" | "Save run as simulation" | `?record=1` and "Record run" | Brief §5.7 |
| C23 | Mode badge | SIMULATION, LIVE, SOUVERÄN | SIMULATION, LIVE | SIMULATION, LIVE, SOVEREIGN in English; SIMULATION, LIVE, SOUVERÄN in German | Brief §5.7 |
| C24 | Security policy | `connect-src 'self'` plus the API and an optional sovereign origin; `base-uri 'self'` | `connect-src` the API only; `base-uri 'none'`; data as script globals | The specification's policy; the Diagnostics privacy row checks it | Brief §5.7 |
| C25 | Data delivery | JSON files fetched from the site | JavaScript files that set globals | JSON, fetched once at boot (needs `'self'`) | Brief §5.7 |
| C26 | Test layout | `node --test`, `@playwright/test`, `tests/unit`, `tests/e2e` | `tests/run-all.mjs` with plain Playwright suites | The sister infrastructure; the specification's fixtures under `tests/fixtures/`; `npm test` and `npm run e2e` as aliases | Brief §5.8 |
| C27 | CI | `npm ci`, Chromium on push, three browsers on `main` | Node 22, ubuntu-24.04, Playwright 1.56.0 installed globally, live-site workflow | The sister workflows plus a Firefox and WebKit job on `main` | Brief §5.8 |
| C28 | Dependencies | `@playwright/test`, `@axe-core/playwright`, XML parser, zip library | None in the repository | `package.json` with fast-xml-parser, fflate and axe-core (injected into pages); Playwright pinned in CI | Brief §5.8 |
| C29 | Event bus | RunEvent types (`run_started` … `run_finished`) | `run_start`, `state_change`, `options`, `option_decision`, `run_end` … | RunEvent types recorded; the shell's events derived in `js/events.js` | Brief §4, P-2 |
| C30 | Recorded runs | RunEvent JSON in `data/runs/` | Script steps in `data/sim_runs.js` | RunEvent JSON with `{ "en", "de" }` texts | Brief §5.2 and §5.7 |
| C31 | File tree | `js/ui/`, `js/agents/`, `js/llm/` | Flat `js/` | Shell names win where they overlap; P-1 for the rest | Brief §4, P-1 |
| C32 | Cost tracking | Cost per call from `usage` | One tracker per model and run | Sum `usageCostUsd` per call with that call's model | Proposed (S6) |
| C33 | Cost cap | No call starts once €3 is spent | Stop after a call once the run passed €3 | Checked before every call, as the specification says (AC-22) | Proposed |
| C34 | Budget rule 8 | Summarise at the budget | Hard stop | Soft limit, then the template report (P-3) | Proposed (S5) |
| C35 | Effort | Per role in `config/run.json` (orchestrator medium, classifier low) | Per model in `MODELS` | Per role as the specification sets it; the drafting sub-call, which it leaves open, takes the orchestrator's effort | Brief §5.7 |
| C36 | Thinking | Thinking blocks passed back; `between_tools` if Sonnet is slow | Adaptive with summaries | Adaptive with `display: "summarized"`; `between_tools` offered in Diagnostics for Sonnet only (P6) | Proposed |
| C37 | Shell error texts | German status messages | English texts in `js/anthropic.js` | Translated by HTTP status and error type in the app; the module stays unchanged | Brief §4 |
| C38 | Screens on tabs | Six tab screens | Centrepiece views, drawer tabs, Diagnostics | Section 3.1 | Brief §5.6, P-5 |
| C39 | Cost meter | In the header, Live and Sovereign only | Fourth KPI tile "Session cost" | In the control bar (P-4) | Proposed |
| C40 | Disclosure | Two lines in the header | One AI disclosure tag | The AI tag where the sisters have it, worded as the specification's `disclosure.ai`, and the second line beside it | Brief §4 |
| C41 | Decision model | One decision per target, keep with a justification code, cluster reviews, no draft approval step | Three options plus doing nothing, then drafts to approve | The specification's review transitions; the rail shows "Your decision" only | Specification |
| C42 | Narration labels | One sentence per `ui_progress` | "Hypothesis:", "Check:" … counted in the run facts | No labels; the run facts count tool calls by role, facts, audit blocks and decisions | Proposed |
| C43 | Viewports | 1366 × 768 and larger, usable at 360 px | Tested from 1920 × 1080 to 1280 × 720 | Tested from 1920 × 1080 to 1280 × 720, plus the 360 px rules in `css/app.css` | Brief §5.6 |
| C44 | Local server | `npm run serve` (`tools/serve.mjs`) | Boot help names `python -m http.server` | `tools/serve.mjs`; the boot help names both | Proposed |
| C45 | Version numbers | None | `APP.version` | v0.1.0 at M1, v0.2.0 at M2, v1.0.0 at M3 | Proposed |

---

## 3. Screens on the shell

### 3.1 Mapping

| Specification screen | Place in the shell |
| --- | --- |
| Start | The idle state: the centrepiece shows the question "How many duties do we carry, and which ask twice?", the "what is real" panel and the slice selector (tagged "provisional"); both gauges stand at 0 % in the header; the console's empty state lists R1 to R3 as the Timetable Translator lists its scenarios; **Start agent** opens the mode dialog with three cards (Simulation; Live with the key; Sovereign with its status). "How it works" is the first-visit dialog |
| Duty map | The centrepiece's first view: heat grid of norms (rows, grouped by family) × the six duty types, counts in every cell on the ink ramp, filters for addressee, confidence and "needs review"; a cell opens the duty cards in a panel over the centrepiece's right side (highlighted trigger phrase, § link, the legal-status note, the "EU-related" and "Protected standard" badges, rationale with its AI label, provenance) |
| Duplicates | The centrepiece's second view, modelled on Rebate Hunter's board: cluster cards sorted by € potential with shared-item chips (hex capsules), member duties with citations, recipients, frequency, the register badge "simulated", a confidence bar, **Confirm cluster** and **Split** |
| Options & review | Drawer tab 1: option cards (type, ΔEA per year by addressee, change in duty count, one-off cost, draft wording under "Draft wording in German, as it amends German law" with the gist below it in an English run, audit status, risks), the keep card with its justification basis, the reason-code select, the comment, **Approve**, **Reject**, **Ask for information** |
| Outbox | Drawer tab 2: "Relief dossier (draft)", kept duties with code, comment and data uses, the four exports, "Nothing is sent." |
| Assumptions & diagnostics | The Diagnostics dialog (P-5); the drawer keeps the shell's Audit tab as tab 3 |

### 3.2 1920 × 1080: Duplicates view with a decision waiting

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⬡ Duty Radar                    [SIMULATION] [ⓘ How it works] [☾] [EN|DE]   ┌Duties┐┌Reporting┐┌Document.┐┌Compliance cost┐│
│   Find, cluster and price duties  [✦ You are interacting with an AI system.]│  N   ││ ⬡ 0.0%  ││ ⬡ 0.0%  ││ €0             ││
│   Prototype – not an official federal government service                    │      ││ of −⅓   ││ of −½   ││ pending −€1.92M││
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▷ Start agent │ Run: R1 ▾ │ Slice: provisional ▾ │ Model: Sonnet 5.5 ▾ │ ×1 ×2 ×4 │ ● Awaiting your decision │ Abort │ Reset │ Diagnostics │
├───────────────────────────────────────────────────────────────┬──────────────────────────────────────────┤
│ [Duty map] [Duplicates]                      sorted by € ▾     │ Agent console                Larger text │
│ ┌ C-007 · Businesses · one population ── −€1,920,000 / year ─┐ │ ⬡Corpus ⬡Extractor ⬡Matcher ⬡Cost         │
│ │ shared: ⟨company master data⟩ ⟨persons employed⟩           │ │ ⬡Signal ⬡Drafting ⬡Auditor  ▶Your decision │
│ │ § 20 BeispielG · quarterly → statistics office             │ │ SIMULATION  scripted replay, no model calls│
│ │ § 3 MusterV · quarterly → statistics office                │ │ 00:41 Reads § 1–§ 25 of the norm …          │
│ │ register: ⟨company master data · simulated⟩  conf ▰▰▰▱ 0.6 │ │ 00:52 Fact auditor: unsourced figure       │
│ │ [Confirm cluster] [Split]                                  │ │       blocked; re-drafted with a fact      │
│ └────────────────────────────────────────────────────────────┘ │ 00:55 3 options and keep are ready.        │
│ ┌ C-004 … ┐ ┌ C-011 … ┐                                        │       [Review options]                     │
├───────────────────────────────────────────────────────────────┴──────────────────────────────────────────┤
│ Options & review ③ │ Outbox │ Audit 57         Built by Victor Pflüger  in ⊕     🛡 Nothing is sent.  Hide │
│ ┌ Register retrieval ──┐ ┌ Merge ───────────────┐ ┌ Keep ─────────────────────┐                         │
│ │ −€1,920,000 / year   │ │ −€500,000 / year     │ │ €0 · justification basis  │  Reason code ▾          │
│ │ businesses −2.04M    │ │ duties −1            │ │ data uses, EU basis,      │  Comment                │
│ │ admin +120,000       │ │ draft wording (DE) ▸ │ │ protected standard        │  [Approve] [Reject]     │
│ │ duties −2 · one-off  │ │ audit: passed        │ │                           │  [Ask for information]  │
│ │ €250,000             │ │                      │ │                           │                         │
│ └──────────────────────┘ └──────────────────────┘ └───────────────────────────┘                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The figures come from option case O6 (the G3 cluster: register retrieval replacing both members, −€2,040,000 for businesses and +€120,000 for the administration, merge −€500,000, one-off €250,000 from G4) and the cluster example's confidence of 0.6; "N" and "n" stand for counts the run produces. They only illustrate the layout.

### 3.3 1280 × 720: Duty map while the inventory runs

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ⬡ Duty Radar   [SIMULATION][ⓘ][☾][EN|DE]  ┌Duties┐┌Report.┐┌Docum.┐┌Cost addr.┐ │
│ [✦ AI system] Prototype – not official   │  N   ││⬡ 0.0% ││⬡ 0.0%││ €0       │ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ▷ │ R1 ▾ │ Slice ▾ │ Sonnet 5.5 ▾ │ ×1 ×2 ×4 │ ● Inventory │ ▢ │ ↺ │ ⚕ │
├────────────────────────────────────────────┬─────────────────────────────────────┤
│ [Duty map] [Duplicates]   filters ▾        │ Agent console                        │
│            Rep Proof Info Doc Eval Ctrl    │ ⬡⬡⬡⬡⬡⬡⬡ (icons; names in tooltips)  │
│ Statistics ▾                               │ SIMULATION                           │
│  BStatG       n    n    n    n    n    n   │ 00:21 Finds n duty candidates in     │
│  ProdGewStatG n    n    n    n    n    n   │       the EnStatG.                   │
│  …                                         │ 00:24 Classifies n candidates.       │
│ Minimum wage and working time ▸            │                                      │
│ Product responsibility ▸                   │                                      │
├────────────────────────────────────────────┴─────────────────────────────────────┤
│ Options & review │ Outbox │ Audit        Built by …          Nothing is sent. Show │
└──────────────────────────────────────────────────────────────────────────────────┘
```

At 1280 × 720 the header keeps two rows (the brand wraps, as the Timetable Translator's does below 1400 px), the control bar shows icons with tooltips, and the role strip shows icons with each role's name as tooltip and accessible name. With the drawer open the centrepiece gets short: the duty map collapses to its family rows and the duplicates board to one row of cards; **Hide** gives the full height back. AC-38 checks German at this size: nothing overflows or is cut to an ellipsis.

### 3.4 Below 900 px and at 360 px

The tabs become a select menu (Duty map, Duplicates, Options & review, Outbox, Audit), the console becomes a drawer opened from a **Console** button, the KPI tiles sit two by two, and nothing scrolls sideways (AC-27). These rules live in `css/app.css`; the shell's stylesheets stay unchanged.

### 3.5 Colour grammar for Duty Radar

| Colour | Means here |
| --- | --- |
| Merlot | The reviewer: Approve, the step "Your decision", the decision and its code in the console and the audit, Confirm cluster |
| Lilac | The AI's voice: AI labels, the classifier's rationale, draft wording and the gist, narration, the reasoning summaries, the AI disclosure |
| Fjord | Checking: the paragraph or duty the agent reads pulses; the fact auditor's passed checks; source links |
| Danger, warning, success | State only, always with a word or mark: "Blocked by the fact auditor", "Needs review", "Approved", "Rejected" |
| Ink | Everything else, the duty map's ramp `color-mix(in oklab, var(--vc-text) n%, var(--vc-surface))` in seven steps with the count printed, and selections |
| Neutral tape | SIMULATION |

No colour values of the app's own; the favicon is the only exception.

### 3.6 Role strip

One hexagon marker per role, from Corpus agent to Fact auditor, in up to two rows, each idle (not yet called), active (one of its tools runs; fjord pulse) or done (called before, ink tick); a role turns active again whenever the agent returns to it. The orchestrator appears only in the console. After the roles, the merlot step "Your decision" shows while an option decision or a cluster review waits. Role icons from Vici's set: corpus `book`, duty extractor `search`, once-only matcher `link`, cost agent `chart-bar`, signal agent `bell`, drafting agent `edit`, fact auditor `check`.

---

## 4. Two languages

- **Switch and state.** `js/i18n.js` holds the language: English on every first visit, `?lang=de` or `?lang=en` wins and is stored under `dr.lang`, and `<html lang>` follows. The EN and DE buttons (toggle buttons with `aria-pressed`, drawn like Vici's segmented control) re-render every view without a reload through a `lang_change` UI event.
- **Strings.** Every user-visible string is a key in `js/i18n/en.json` and `js/i18n/de.json`, the shell's included. `index.html` keeps the English name and texts as static defaults, because the boot screen and the page-icon test read them. The specification's German strings stay exactly as written; the English strings come from its copy table and from the brief's list. A string neither gives is written in both languages and listed for you at M2; new German labels stay proposals until you confirm them.
- **Codes.** Engines return codes with parameters (ineligibility reasons, risks, warnings, fact labels such as "relief for businesses through register retrieval"); enumeration values stay as the specification defines them, only their labels are translated. The option-case fixture keeps the German renderings of O1 to O6 and adds the English ones.
- **Numbers.** `js/engine/format.js` formats with `Intl.NumberFormat('de-DE')` or `('en-GB')`: euros from 1,000 upward without decimals, smaller amounts with two, hours without decimals followed by " Std." or " h", shares as percentages with one decimal. A placeholder renders in the language of the text it stands in.
- **Model text.** The orchestrator's narration, the classifier's rationale and the report are written in the language active when the run starts, and carry a small EN or DE tag. Tool error messages to the model are English in both languages. Legal text stays German: law texts, citations, quotes, trigger phrases, synonyms, recipients, `other:` data items and the amendment wording with its closing "[Entwurf, rechtlich zu prüfen]"; an English run adds the `gist_en` field, at most 40 words, audited like the wording.
- **Recorded runs.** Every recorded text carries `{ "en": …, "de": … }` with identical placeholders; legal text is German only, `gist_en` English only. The closing report template exists in both files.
- **Data.** Vocabulary items, populations and registers gain `label_en`; data uses `user_en` and `purpose_en`; every assumption `rationale_en`; complaints `text_en`. Matching stays German.
- **Fact auditor.** Both languages, with the brief's English additions; cases A15 to A31 join A01 to A14.
- **Exports.** Names follow the active language; the duty CSV keeps its German Excel format in both.
- **Tests.** Key parity, no empty value, and the copy tables exactly (AC-15); the switch, persistence, `?lang=`, `<html lang>` and no overflow or ellipsis in German at 1280 × 720 (AC-38); the end-to-end suites that quote strings run in both languages.

---

## 5. Agent loop and the three modes

### 5.1 Live loop

Rebate Hunter's `js/agent.js`, adapted:

- **Request.** Through the shared `streamMessage`: `x-api-key` from session storage, `anthropic-version: 2023-06-01`, `content-type`, `anthropic-dangerous-direct-browser-access: true`, `stream: true`, top-level `cache_control: {type: "ephemeral"}`, `thinking: {type: "adaptive", display: "summarized"}`, `output_config.effort` per role, the 16 strict tools, `tool_choice: {type: "auto"}`, no `temperature`, `top_p` or `top_k`. Graceful degradation drops `display`, `thinking`, effort or `cache_control` on a 400 that names them, as the sisters do.
- **Turns.** Every assistant `content` array, thinking blocks and signatures included, goes back unchanged. Tool results come first in the next user message, one per `tool_use` id; independent `law_*` lookups run in parallel, engines and `ui_*` tools in order. Recordings never contain thinking blocks.
- **Stop rules.** `tool_use` runs tools; `pause_turn` resends; a tool call cut off by `max_tokens` is discarded and retried once with `max_tokens` raised by half (at most 128,000); another `max_tokens` stop continues with "Continue from where you stopped."; an early `end_turn` without `ui_report` gets at most two visible nudges; `refusal` and a full context window end the run cleanly.
- **Errors.** `withRetry`: twice, after 1.5 and 4 s or after `retry-after` (at most 20 s), for 429, 500, 502, 503, 504, 529 and network errors, never for a spend limit. 401 removes the key and shows "Key rejected"; 400 stops the run with a readable message. Every error is audited.
- **Orchestrator rules.** The specification's eight rules in `js/prompt.js`, in the run's language, with the brief's changes (narration language, English tool errors) and rule 8 as in section 5.3.

### 5.2 Sub-calls

| Sub-call | Model and effort | Request | Validation |
| --- | --- | --- | --- |
| `duty_classify` | `claude-haiku-5-5`, effort low, `max_tokens` 8,000 | At most 25 candidates with sentence and paragraph context, the population ids, the vocabulary; one strict tool `submit_classification`; `tool_choice` auto; told to call it exactly once | Categories only (no numeric field, AC-37); code maps certainty and frequency; one retry on a schema failure, then the batch goes to needs_review; rationale, recipient and `other:` items pass the auditor or become "Text blocked" |
| `draft_amendment` | The drafting model (Sonnet 5.5 by default, Opus 5.5 optional), effort medium, `max_tokens` 8,000 | The option type, the affected paragraph texts, the option's fact ids; one strict tool `submit_amendment` with `wording` and `gist_en` | At most 120 words, placeholders only, the closing marker; `gist_en` at most 40 words in an English run and null in a German one; both audited before display |

Both sub-calls count toward the caps and are audited like any model call.

### 5.3 Caps, cost and stop

- **Hard caps,** checked before every call: no 41st model call (orchestrator and sub-calls together), and no call starts once the run's spend has reached €3. The run then stops cleanly, logs `cap_reached` and shows what is done.
- **Soft limit** (P-3): from 36 calls or €2.70, the next tool result carries the instruction to request open decisions and call `ui_report`.
- **Cost:** each call's `usage` priced with `usageCostUsd(model, usage)` from the unchanged `js/cost.js` (the Haiku tier picked per request), converted at 0.894; the control bar shows calls of 40 and euros of €3 (P-4); the audit holds model, usage and cost per call.

### 5.4 Tools and strict schemas

The 16 tools keep the specification's names, inputs and outputs. The measured counts are in P7: the orchestrator's request uses 16 of 20 strict tools, 10 of 24 optional parameters and none of 16 union-typed ones; each sub-call's request stays far below the limits. Ranges the schema cannot carry (`limit` at most 20, at most 25 candidates, word limits) and the one-of shapes of `ui_request_decision` and `audit_check` are checked in code, and a failure returns `is_error: true` with an English instruction such as "Cluster C-007 needs a review first: call ui_request_decision with its cluster_id." Should a future schema exceed a limit, TECH_NOTES records which tool is not strict.

### 5.5 Simulation and recording

- The player replays `data/runs/R1.json` to `R3.json` at ×1, ×2 or ×4 and pauses at every `decision_requested`. Engines recompute every fact from the bundled data, and recorded fact ids bind to their keys.
- Option decisions are free in every mode; code generates `decision_recorded`, `dossier_updated` and the closing report from the presenter's choice. Cluster reviews accept only the recorded action ("Set by the simulation").
- R1 is the storyline run (about six minutes at ×1, built around a cluster with confidence of at least 0.5); R2 the rejection path (a split, a blocked figure, a rejection, a duty kept with code A1); R3 one norm end to end (my default: the Energiestatistikgesetz, to confirm in M2).
- Without a key the runs are hand-authored in both languages and marked hand-authored (D7). In Live or Sovereign, `?record=1` adds **Record run**, which downloads the event stream without thinking blocks or keys for curation. `tools/check-runs.mjs` and Diagnostics hold every recording to the auditor's rules.

### 5.6 Sovereign

`js/llm/openai-compat.js` translates each Anthropic-format request to `POST {base_url}/v1/chat/completions` (tools as functions, `tool_choice: "auto"`, `max_tokens`) and each response back (`tool_calls` arguments parsed and validated; results as `tool` messages with `tool_call_id`). `config/sovereign.json` holds `enabled`, `label`, `base_url`, `model`, `requires_key` and prices; `tools/set-csp.mjs` adds or removes its origin in the policy. With no endpoint the card says "No sovereign endpoint configured" (D3). A scripted stand-in (`tests/lib/fake-openai.mjs`) covers AC-12.

---

## 6. Law snapshot and data

### 6.1 Proposed slice (D1)

Slugs and titles as gii-toc.xml lists them on 19 November 2026 (P8). Abbreviations are for reading only; the snapshot takes each norm's own from its XML. Five families, 31 norms.

| # | Family | Slug | Title in gii-toc.xml | Short |
| --- | --- | --- | --- | --- |
| 1 | Business statistics | `bstatg_1987` | Gesetz über die Statistik für Bundeszwecke | BStatG |
| 2 | Business statistics | `prodgewstatg` | Gesetz über die Statistik im Produzierenden Gewerbe | ProdGewStatG |
| 3 | Business statistics | `hdldlstatg` | Gesetz über die Statistik im Handels- und Dienstleistungsbereich | HdlDlStatG |
| 4 | Business statistics | `kostrukstatg` | Gesetz über Kostenstrukturstatistik | KoStrukStatG |
| 5 | Business statistics | `preisstatg` | Gesetz über die Preisstatistik | PreisStatG |
| 6 | Business statistics | `verdstatg` | Gesetz über die Statistik der Verdienste und Arbeitskosten | VerdStatG |
| 7 | Business statistics | `hwstatg_1994` | Gesetz über Statistiken im Handwerk | HwStatG |
| 8 | Business statistics | `gwstatg` | Gesetz über die Statistik zu globalen Wertschöpfungsketten | GWStatG |
| 9 | Business statistics | `ahstatg` | Gesetz über die Statistik des Warenverkehrs mit dem Ausland | AHStatGes |
| 10 | Business statistics | `ahstatdv_2022` | Verordnung zur Durchführung des Gesetzes über die Statistik des Warenverkehrs mit dem Ausland | AHStatDV |
| 11 | Business statistics | `statregg` | Gesetz über den Aufbau und die Führung eines Statistikregisters | StatRegG |
| 12 | Business statistics | `vwdvg_2010` | Gesetz über die Verwendung von Verwaltungsdaten für Zwecke der Wirtschaftsstatistiken | VwDVG |
| 13 | Energy statistics | `enstatg_2017` | Energiestatistikgesetz | EnStatG |
| 14 | Minimum wage and working time | `milog` | Gesetz zur Regelung eines allgemeinen Mindestlohns | MiLoG |
| 15 | Minimum wage and working time | `miloaufzv` | Verordnung zur Abwandlung der Pflicht zur Arbeitszeitaufzeichnung nach dem Mindestlohngesetz und dem Arbeitnehmer-Entsendegesetz | MiLoAufzV |
| 16 | Minimum wage and working time | `milodokv_2015` | Verordnung zu den Dokumentationspflichten nach den §§ 16 und 17 des Mindestlohngesetzes und den §§ 18 und 19 des Arbeitnehmer-Entsendegesetzes in Bezug auf bestimmte Arbeitnehmergruppen | MiLoDokV |
| 17 | Minimum wage and working time | `milomeldv` | Verordnung über Meldepflichten nach dem Mindestlohngesetz, dem Arbeitnehmer-Entsendegesetz und dem Arbeitnehmerüberlassungsgesetz | MiLoMeldV |
| 18 | Minimum wage and working time | `arbzg` | Arbeitszeitgesetz | ArbZG |
| 19 | Minimum wage and working time | `aentg_2009` | Gesetz über zwingende Arbeitsbedingungen für grenzüberschreitend entsandte und für regelmäßig im Inland beschäftigte Arbeitnehmer und Arbeitnehmerinnen | AEntG |
| 20 | Product responsibility | `verpackdg` | Gesetz zur Durchführung der Verordnung (EU) 2025/40 betreffend Verpackungen 2 | VerpackDG |
| 21 | Product responsibility | `elektrog_2015` | Gesetz über das Inverkehrbringen, die Rücknahme und die umweltverträgliche Entsorgung von Elektro- und Elektronikgeräten | ElektroG |
| 22 | Product responsibility | `battdg` | Gesetz zur Durchführung der Verordnung (EU) 2023/1542 betreffend Batterien und Altbatterien | BattDG |
| 23 | Trade regulation | `gewo` | Gewerbeordnung | GewO |
| 24 | Trade regulation | `gewo_34cdv` | Verordnung über die Pflichten der Immobilienmakler, Darlehensvermittler, Bauträger, Baubetreuer und Wohnimmobilienverwalter | MaBV |
| 25 | Trade regulation | `finvermv` | Verordnung über die Finanzanlagenvermittlung | FinVermV |
| 26 | Trade regulation | `versvermv_2018` | Verordnung über die Versicherungsvermittlung und -beratung | VersVermV |
| 27 | Trade regulation | `immvermv` | Verordnung über Immobiliardarlehensvermittlung | ImmVermV |
| 28 | Trade regulation | `bewachv_2019` | Verordnung über das Bewachungsgewerbe | BewachV |
| 29 | Trade regulation | `bewachrv` | Verordnung über das Bewacherregister | BewachRV |
| 30 | Trade regulation | `spielv` | Verordnung über Spielgeräte und andere Spiele mit Gewinnmöglichkeit | SpielV |
| 31 | Trade regulation | `schauhv` | Verordnung über die Haftpflichtversicherung für Schausteller | SchauHV |

**Why these.** Rows 1–12 are the statistics laws for production, trade and services with the general statistics law, the foreign-trade reporting and the two laws behind the statistical business register and administrative data, which give register retrieval a real anchor. Row 13 is the Energiestatistikgesetz. Rows 14–19 are the minimum-wage and working-time records with the ordinances that govern them together; the AEntG joins because those ordinances regulate it alongside the MiLoG. Rows 20–22 are the product-responsibility registers (packaging, electrical equipment and batteries), whose registrations ask the same manufacturers for similar master data; the BattDG joins because it shares the ElektroG's fee ordinance ("Gebührenverordnung zum Elektro- und Elektronikgerätegesetz und zum Batterierecht-Durchführungsgesetz"). Rows 23–31 are the trade regulation and its ordinances with notification, record-keeping and proof duties. In reserve: the Umweltstatistikgesetz (`ustatg_2005`), the Handwerksordnung (`hwo`), the Schwarzarbeitsbekämpfungsgesetz (`schwarzarbg_2004`) and the Unternehmensbasisdatenregistergesetz (`ubregg`).

**Duplicates to verify in M1, none presumed:** the manufacturing monthly report beside the energy-use survey (same businesses, persons employed and master data); working-time records under the MiLoG, the AEntG and the ArbZG; registrations under the ElektroG, the BattDG and the VerpackDG; trade notifications under the GewO beside the statistical business register.

### 6.2 Snapshot workflow

- `tools/snapshot-laws.mjs` (Node 22, fast-xml-parser with its validator, fflate) reads `config/slice.json`, downloads gii-toc.xml, matches each slug by its link `…/<slug>/xml.zip`, compares the title (S3) and stops on a missing slug or a mismatch; it downloads and unzips each archive, parses it strictly along gii-norm.dtd 1.01 (element names confirmed in M1 against a fixture and recorded in TECH_NOTES), writes `data/corpus/<slug>.json` and `index.json`, fills `eu_basis` from the footnote "Amtlicher Hinweis des Normgebers auf EG-Recht", checks every HTML link with a HEAD request and falls back to the norm's index page, and writes SNAPSHOT.md.
- **Where it runs.** This environment cannot reach gesetze-im-internet.de (P8, P9), so `.github/workflows/snapshot.yml` runs it on ubuntu-24.04: started by hand (Actions → snapshot → Run workflow) or by a push to the branch `snapshot/request`, which I can make myself. It commits `data/corpus/**` and SNAPSHOT.md to a branch `snapshot/<date>` with the workflow's token (`contents: write`); I open the pull request into the milestone branch, because workflows may not open pull requests without a change to the repository settings.
- **Tests without network.** AC-08 and AC-34 run the same script against `tests/fixtures/toc-sample.xml` and two fixture norms (one with an EU footnote, one without).

### 6.3 Calibration and parameters

- **Guide:** the February 2026 edition (P12) decides the formula check, wage rates and standard time values once its PDF is a project file (D6); DATA_SOURCES records the edition of every table used.
- **OnDEA:** by hand from your browser probe or your lookup, source key `ondea:<id>` with the entry's date (D4).
- **DIP:** `tools/snapshot-dip.mjs` stays optional; it needs a `DIP_API_KEY` secret and runs in Actions like the snapshot.
- Every value without a source carries `"assumption": true` with a one-line rationale in both languages.

### 6.4 Data files

As the specification lists them, with the English fields of section 4: `cost-params.json`, `populations.json`, `one-off.json`, `duty-patterns.json` (extended against the gold set), `data-items.json` (about 20 items to start), `registers.json` (generic names, "simulated"), `consumers.json` (synthetic), `complaints.json` (30 to 50 invented complaints in the eight categories), and the three runs. `tools/check-data.mjs` holds them to AC-09.

---

## 7. Tests and CI

### 7.1 Suites

`node tests/run-all.mjs` runs every suite in order; `npm test` runs the Node suites, `npm run e2e` the browser suites. No suite calls a real API or spends money; every browser suite fails on a CSP violation, a page error or a request to another host.

| Suite | Checks | Criteria |
| --- | --- | --- |
| tokens, hexagon, page-icon, vici-files | The four shared design tests, unchanged, with Duty Radar's values; the duty map's ramp and the gauges' pairs in both themes | AC-39 |
| parity | The shell against Rebate Hunter's `main`; the four adapted modules listed | AC-39 |
| hygiene, docs | No term of the private list and no e-mail address in any file; documents complete, every named path and cited section exists | Definition of done |
| unit | Streaming client, retries, cost with three models and the Haiku tier, both ICU checks, i18n parity and the copy tables | AC-11, AC-15, AC-01 (display) |
| engine | Golden G1–G8 in both languages; audit A01–A31; cluster K1–K9; options O1–O6 with reasons in both languages; coverage; sentence splitting; patterns and the gold set; classification mappings; fact ids stable across replays and edits | AC-01–AC-07, AC-36, AC-37 |
| snapshot | The snapshot script against the fixture table of contents and fixture norms | AC-08, AC-34 |
| data, static, runs | `tools/check-data.mjs`, `tools/check-static.mjs`, `tools/check-runs.mjs` | AC-09, AC-14, AC-16 |
| tools | Each of the 16 tools with one valid and one invalid fixture input; the two-norm fixture slice end to end | AC-10, AC-13 |
| live | The loop against `fake-claude.mjs`: headers, strict tools, `tool_choice`, no sampling parameters, tool results first, thinking unchanged, caps, key privacy; the Sovereign adapter against `fake-openai.mjs` | AC-11, AC-12, AC-22, AC-23 |
| smoke, sims, accept | Main flows by mouse and keyboard; R1–R3 in both languages; decisions, codes and comments; keep; exports; Abort and Reset; offline | AC-17–AC-21, AC-24, AC-33, AC-35 |
| i18n, layout, design, a11y | The switch; viewports from 1920 × 1080 to 1280 × 720 and 360 px; colour grammar in both themes; axe-core on every screen and the storyline by keyboard | AC-25–AC-27, AC-38 |
| storyline | The eight-minute storyline as the audience sees it, in both languages, every expected figure worked out by the engine in the test | AC-17, AC-18 |
| selftest | "Run all tests" in the browser reads the same fixtures | AC-28 |
| live_site | The published site serves this commit and replays R1 | Definition of done |

AC-29 to AC-32 and AC-40 are manual: you run them with a real key or endpoint, and the README's acceptance record lists each with date, person and result.

### 7.2 Workflows

- `tests.yml`: on every push and pull request a Node job (all Node suites, parity against a fresh Rebate Hunter clone, the hygiene list from the secret) and a Chromium job (the browser suites), Node 22, ubuntu-24.04, Playwright 1.56.0; on `main` also a job that installs Firefox and WebKit and replays R1 in both for AC-17.
- `live-site.yml`: after every Pages build, the published site against the commit.
- `snapshot.yml`: section 6.2.

### 7.3 Evidence per milestone

GATES.md is written from the milestone's criteria before the work starts. At the end of a milestone: the pull request, the CI result, screenshots at 1920 × 1080 and 1280 × 720 in both themes and both languages, every figure checked against the specification, and a list of what I could not check.

---

## 8. Milestones and acceptance criteria

| Milestone | Scope | Exit |
| --- | --- | --- |
| Phase 0 (now) | Study, probes, slice, this plan | Your approval |
| **M1 Foundations (v0.1.0)** | Shell with Vici and translated strings, both languages with English as default, the design tests and parity; CI; the snapshot workflow and the confirmed slice with SNAPSHOT.md; the six engines with fixtures first; first versions of vocabulary, registers, data uses, complaints and cost parameters; the gold set of 60 sentences for your labels | AC-01 to AC-09, AC-34, AC-39; your confirmation of the slice and the gold-set labels (without it, my labels, marked unconfirmed in the README) |
| **M2 Agents and screens (v0.2.0)** | The 16 tools and both sub-calls; the Live loop on the shared module with caps and the cost meter; the Sovereign adapter, disabled while D3 is open; the screens in the shell's layout with tiles, console, review, dossier, exports and audit; R1–R3 in both languages; the list of new strings for you | AC-10 to AC-16, AC-19, AC-22, AC-23, AC-29 to AC-31, AC-36 to AC-38, AC-40; you watch R1 replay end to end |
| **M3 Hardening and demo (v1.0.0)** | The remaining end-to-end suites, accessibility, small screens, print stylesheet, self-test; all documents with both talk tracks; an independent review by an agent that did not build the prototype, with no high or medium finding open (REVIEW.md); the pull request for the website's card and the page-icon comparison with it; the live-site check | All 40 criteria, including your two rehearsals of AC-32 |

| AC | Criterion | Test | Milestone |
| --- | --- | --- | --- |
| AC-01 | Golden cases G1–G8: raw values within ±0.005, display strings exactly, in German and English | unit | M1 |
| AC-02 | Fact auditor cases A01–A31 with the offending tokens | unit | M1 |
| AC-03 | Clustering cases K1–K9 | unit | M1 |
| AC-04 | Option cases O1–O6: options, order, values, reasons as codes rendered in both languages | unit | M1 |
| AC-05 | Slice coverage reproduces G7; merge removes N − 1, register retrieval every duty it replaces, lower frequency none | unit | M1 |
| AC-06 | The pattern stage finds at least 95 % of the 40 gold duties; the README states the recall | unit | M1 |
| AC-07 | "zu übermitteln" matches, "zu prüfenden" does not match "zu prüfen", "Abs.", "Nr." and "z. B." never end a sentence | unit | M1 |
| AC-08 | The snapshot script stops on a missing slug or a title mismatch; its Norm files satisfy the contract | unit | M1 |
| AC-09 | Sources or assumption flags on every cost parameter, synthetic complaints, simulated registers, 25 to 35 norms | static | M1 |
| AC-10 | Each tool accepts its valid fixture and answers an invalid one with `is_error: true` and an instruction | unit | M2 |
| AC-11 | The loop sends `2023-06-01`, the browser header, strict tools within the limits and `tool_choice` auto, no sampling parameters, tool results first, thinking unchanged | unit | M2 |
| AC-12 | The Sovereign adapter's function format, `tool_calls` parsing and `tool` messages | unit | M2 |
| AC-13 | A two-norm fixture slice runs through inventory, clustering, costing and options without code changes | unit | M2 |
| AC-14 | Policy present; no inline code; no outside URL but the API; storage keys `dr.` (plus `vc-theme`); no `toFixed` in `js/engine/`; no key-like string | static | M2 |
| AC-15 | `de.json` and `en.json`: identical keys, no empty value, the copy tables exactly | static | M2 |
| AC-16 | R1–R3 pass the run checker, with both languages and identical placeholders | static | M2 |
| AC-17 | R1 replays offline in Chromium, Firefox and WebKit, pauses, ends with the approved item in the dossier and tiles equal to the engine's facts | e2e | M3 |
| AC-18 | R2: split in the audit, the blocked figure, the rejection, the duty kept with A1, no relief item; in both languages | e2e | M3 |
| AC-19 | No decision without a reason code; Z5 and A6 need a comment of at most 500 characters | e2e | M2 |
| AC-20 | Every figure in tiles, option cards and dossier opens "Where does this figure come from?"; in both languages | e2e | M3 |
| AC-21 | Editing an assumption recomputes facts, options and tiles and logs `parameter_changed` | e2e | M3 |
| AC-22 | No 41st call; no call once €3 is spent; `cap_reached` logged | e2e | M2 |
| AC-23 | A dummy key never appears in local storage, exports, the audit, recordings or the console | e2e | M2 |
| AC-24 | Exports download with the names of the active language; the CSV has semicolons, byte order mark and the columns | e2e | M3 |
| AC-25 | A German browser's first visit opens in English; both disclosure lines on every screen; "Nothing is sent." and "Nichts wird versendet." | e2e | M3 |
| AC-26 | axe-core: no serious or critical violation on the six screens; the storyline by keyboard alone | e2e | M3 |
| AC-27 | At 360 px the console is a drawer, the tabs a select menu, nothing scrolls sideways | e2e | M3 |
| AC-28 | "Run all tests" shows the golden, auditor and cluster cases passing; in both languages | e2e | M3 |
| AC-29 | Pattern plus classification reaches at least 85 % precision on the gold set in one Live run | manual | M2 |
| AC-30 | Live mode runs R3's norm end to end within the caps; the audit shows model, usage and cost | manual | M2 |
| AC-31 | Sovereign runs one norm, or stays disabled with its reason | manual | M2 |
| AC-32 | You complete the storyline twice at ×1, once in English and once in German; no eagle, logo or imitation of an official site | manual | M3 |
| AC-33 | Keep needs A1–A4 or A6, closes the target's other options and lists the duty under the kept duties; in both languages | e2e | M3 |
| AC-34 | `eu_basis` filled from a fixture norm's EU footnote and empty without one | unit | M1 |
| AC-35 | A decision other than the recorded intention still yields matching tiles, dossier and report, and no replayed text refers to the intended outcome | e2e | M3 |
| AC-36 | Fact ids stay bound to their keys across two replays and after an edit; facts that no longer apply show "no longer applies"; in both languages | unit | M2 |
| AC-37 | The classification tool accepts no numeric field; code sets frequency, confidence and `eu_related` | unit | M2 |
| AC-38 | The switch changes every screen without a reload (live model text keeps its language and tag), persists, yields to `?lang=`, updates `<html lang>`; German fits at 1280 × 720 | e2e | M2 |
| AC-39 | The four shared design tests pass unchanged with this app's values; parity passes; REVIEW.md lists every adapted shell module | static and e2e | M1 |
| AC-40 | An English Live run narrates and reports in English and a German one in German; law quotes and amendment wording stay German | manual | M2 |

---

## 9. Risks and how I will test them

| Risk | Mitigation | Test |
| --- | --- | --- |
| The snapshot cannot run (Actions blocked from the host, or a changed DTD) | Fixture-based script; a dated snapshot committed once and reused; a smaller fallback slice from the reserve | `snapshot` suite; the first workflow run in M1 |
| A title or slug changes between now and the snapshot | The script stops on any mismatch, and the slice file is corrected in the same pull request | AC-08 |
| The pattern stage misses duties (recall below 95 %) | Patterns extended against the gold set; misses listed in the README | AC-06 |
| A plausible duplicate turns out to differ in population or frequency | Clusters are computed, never presumed; R1 is authored around a cluster the engine actually forms, with confidence of at least 0.5 | `engine`, `sims` |
| The model writes a number or an unknown citation | The fact auditor in both languages with the brief's English words; two retries, then "Needs manual editing" | A01–A31, `live` refusal cases |
| A Live run exceeds 40 calls or €3 | Batches of 25, parallel lookups, the soft limit, hard caps before every call | AC-22, `live` counts calls |
| German texts overflow at 1280 × 720 | Shorter keys, wrapping rules, the layout suite in German | AC-38, `layout` |
| ICU differs between browsers (minus sign, spaces) | Display strings compared after replacing non-breaking spaces; the self-test in each browser | AC-01, AC-17, AC-28 |
| The audience reads the slice coverage as national progress | The tooltip "Slice only, not the national target" on both gauges | `smoke`, `storyline` |
| A protected or EU-based duty is offered for deletion | Option rules with codes; badges on the duty card | O4, O5 |
| A shell change in a sister app goes unnoticed | `tests/parity.mjs` on every push | `parity` |
| A private term lands in a public file | `tests/hygiene.mjs` with the secret list on every push | `hygiene` |
| The live site differs from the commit | The live-site workflow after every Pages build | `live_site` |

---

## Appendix A. Browser-console probes

Each runs on the host's own page, so no cross-origin rule interferes. Press F12, paste the line into the console, press Enter and send me what it prints.

**OnDEA (D4).** Open <https://www.ondea.de> and run:

```js
console.log("ONDEA", location.href, document.title, [...document.querySelectorAll("a")].slice(0, 40).map(a => a.textContent.trim() + " -> " + a.href).join(" | "))
```

**DIP (only if you want calibration).** Open `https://search.dip.bundestag.de/api/v1/drucksache?format=json&apikey=PUBLIC_KEY` with the public key from the DIP help page in place of PUBLIC_KEY, then run:

```js
console.log("DIP", location.host, document.body.innerText.slice(0, 600))
```

## Appendix B. Phase 0 evidence kept outside the repository

The probe scripts, the drafted tool schemas and their strict-limit check, the gii-toc.xml extract, the recomputation of the golden cases, the four simulation runs with their screenshots and the gate ledger stay in the build session's working folder. They are scaffolding, not product files; M1 replaces them with the repository's own tests.
