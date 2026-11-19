# TECH_NOTES — Duty Radar

Technical facts, verified with their date, and every judgement call with its reason. Version 0.1.0 (milestone M1).

## 1. Verified facts and probes

All on 19 November 2026; PLAN.md section 1.4 holds the full probe log.

- **Claude API from the browser.** A preflight to `https://api.anthropic.com/v1/messages` answers 200 with `access-control-allow-origin: *`; a request with the header `anthropic-dangerous-direct-browser-access: true` is readable from a page, one without it is blocked by CORS. The header stays mandatory.
- **Models and prices.** `claude-sonnet-5-5` ($2 in, $10 out per million tokens), `claude-opus-5-5` ($4, $20) and `claude-haiku-5-5` ($0.10, $0.50 up to 100,000 prompt tokens), with the cache prices in `js/config.js`, identical to the sister apps. 1 USD = 0.894 EUR, as the sister apps use.
- **API version.** `2026-10-21` is the latest and rejects `temperature`, `top_p` and `top_k`; `2023-06-01` is still listed. Duty Radar sends `2023-06-01` like every sister app; switching is one line in `js/config.js`.
- **Strict tools.** At most 20 strict tools per request, 24 optional and 16 union-typed parameters across them, `additionalProperties: false`, no range or length constraints. The drafted schemas fit (PLAN.md P7); every input is also validated in code.
- **Hosts.** gesetze-im-internet.de answers neither this build environment nor GitHub's runners (TCP timeouts from the runners on ports 443 and 80, run of 19 November); the web-fetch tool reaches it. Destatis and OnDEA answer the runners; OnDEA answered the web-fetch tool with a client error, so no OnDEA entry is transcribed (decision D4).

## 2. The shell and its adapted modules

The shell comes from Rebate Hunter 7.2.0 (`73c00f8`) and the Timetable Translator 1.4.0 (`04006b6`): Vici v1.0.0 in `vici/`, the shared modules and stylesheets, the four shared design tests, the harness, parity, hygiene and docs tests. `tests/parity.mjs` compares the shared files with a checkout of Rebate Hunter, with app names and storage prefixes normalised.

Four shell modules are adapted for two languages and the role strip; REVIEW.md lists each with its reason so the sister apps can take the change over: `js/drawer.js` (tabs passed in by the app, strings through i18n), `js/progress.js` (the rail becomes a role strip), `js/handover.js` and `js/modal.js` (strings through i18n). `js/events.js` keeps the specification's RunEvent types, which recordings use, and derives the shell's events from them (PLAN.md P-2). `js/icons.js` adds Vici's icons for the seven roles and the page icon.

## 3. Two languages

`js/i18n.js` holds the language: English on every first visit whatever the browser's language, `?lang=` wins and is stored under `dr.lang`, `<html lang>` follows. Both string tables load at boot, so a switch re-renders every view without a reload. `index.html` keeps the English texts as static defaults (marked `data-i18n`), because the boot screen and the page-icon test read them; the boot screen's own messages are data attributes of its status line, so no module hard-codes a visible string. Engines return codes (reasons, risks, notes, fact labels) that the interface renders through `js/i18n/en.json` and `js/i18n/de.json`. German labels that neither the specification nor the brief gives are proposals: the third drawer tab "Protokoll", the duty map's short column labels, the role strip's state words and the start view's texts.

## 4. Security policy and network

The policy is the specification's, written into `index.html` by `tools/set-csp.mjs` from `config/sovereign.json`: `default-src 'self'`, scripts, styles and fonts from the site only, `connect-src 'self' https://api.anthropic.com` plus the sovereign endpoint's origin once one is enabled, `base-uri 'self'`, `form-action 'none'`, `object-src 'none'`. The data files are JSON fetched from the site at boot (`'self'`). No inline script or style: the gauges' values and the icons' drawings are set through the CSSOM, which the policy allows. Every storage key starts with `dr.`; Vici's `vc-theme` is the one shared key. `tools/check-static.mjs` checks all of this.

## 5. Law snapshot

**Source route.** Because gesetze-im-internet.de does not answer the runners, `tools/snapshot-laws.mjs --archive <dir>` reads a checkout of the public daily archive QuantLaw/gesetze-im-internet (branch `data`), whose scraper stores the host's table of contents (gii-toc.xml, as data/toc.xml in the archive) and every norm's unzipped archive (under data/items/ and the norm's slug), unchanged. The bundled corpus comes from commit `0d22c0e8e411a1d43d9e586ff87ce53cc86e66f1`, scraped 2026-11-19T04:01:18Z (the author date of the commit; the scraper stamps UTC). All 31 slugs and titles of the slice match the archived table of contents; the scrape's list of files it could not download (not_found.txt) is empty. Building twice from the commit gives byte-identical files. A direct run (`node tools/snapshot-laws.mjs`) downloads from the host and checks every paragraph link with a HEAD request; `.github/workflows/snapshot.yml` runs either route and pushes to a review branch.

**Links.** The archive route cannot check links. Spot checks through the web-fetch tool on 19 November: <https://www.gesetze-im-internet.de/milog/__17.html>, <https://www.gesetze-im-internet.de/verpackdg/__20.html> and <https://www.gesetze-im-internet.de/gewo/__34c.html> show the expected paragraph; <https://www.gesetze-im-internet.de/aentg_2009/__2a.html> returned a server error twice, so it is unconfirmed.

**DTD element mapping** (gii-norm.dtd 1.01): `dokumente` (root, `builddate`) → norm; the first `norm`'s `metadaten` → `jurabk`/`amtabk` (abbreviation, `amtabk` preferred), `langue` (title, else `kurzue`); every further `norm` with an `enbez` of § or Art. → a paragraph: `enbez`, `titel`, `textdaten/text/Content` (text), `textdaten/fussnoten` and `Footnotes/Footnote` inside the text (footnotes). A `norm` with `gliederungseinheit` is structure; `enbez` "Anlage", "Anhang" or "Muster" is an annex; text "-" or "(weggefallen)" is repealed; these are counted, not kept. `eu_basis` holds the CELEX numbers in the hint "Amtlicher Hinweis des Normgebers auf EG-Recht" up to its closing "+++)".

**Text mapping.** `P`, headings, table rows and preformatted blocks end in a line break. A list (`DL`) stays inside its sentence, as in the official layout, with each item number (`DT`) tied to its text by a no-break space, so "1." never ends a sentence; 280 of the slice's lists continue their sentence after the last item. Editorial comments (`kommentar`), images and footnote marks are left out. Source quirk kept as published: the VerpackDG's hint gives `32025L0040` for Regulation (EU) 2025/40, whose CELEX number would be `32025R0040`.

## 6. Sentence splitting

`js/engine/sentences.js` splits on ". ", "; " and line ends, never after the specification's abbreviations, and adds: no., e.g., i.e., cf. (brief section 5.4); BGBl., ABl. (also spelt "ABI." and "ABL." in the source), Nrn., Halbs., Unterabs., Abschn., Kap., Anh., Anl., lit., Ziff., gem., insb., bzgl., usw., sog., ff., ca., Mio., Mrd., evtl.; single letters before a period ("z. B."); list numbers at a line start or after a colon or semicolon; a day before a month; an ordinal before Tag, Monat, Kalendertag, Lebensjahr and similar nouns; any period before a lowercase word, because no sentence starts with one; and a semicolon inside a citation of the EU's Official Journal ("S. 1; L 335 vom …"). Only an ordinary space, a tab or a line end after the punctuation makes a boundary, which keeps the list numbers of section 5 inside their sentence.

## 7. Fact auditor

`js/engine/auditor.js` implements rules 2 to 6 of the specification with the brief's English additions. Judgement calls: the teens and tens (dreizehn to neunzig, thirteen to ninety) count as number words too, because the listed words alone would let "dreizehn Meldungen" pass; "außer Acht" is not the number eight; option ids are matched before duty ids, because an option id contains one; a § or Art. reference counts as cited when a cited paragraph has that number, and the "Absatz … Satz … Nummer" chain may follow it as it may follow a citation. Violations carry an English message for the model, since tool errors are English in both languages.

## 8. Patterns and the gold set

**Matcher.** Case-insensitive with the `u` flag and the boundaries `(?<![\p{L}\p{N}])`, `(?![\p{L}\p{N}])`. A sentence is a candidate with a trigger and a marker (hat, haben, ist, sind, muss, müssen, verpflichtet, obliegt). Extensions, each recorded in `data/patterns/duty-patterns.json` with its source: self-marking phrases ("besteht Auskunftspflicht"), and the present tense of an authority for reporting, informing and publishing (übermittelt, teilt … mit, unterrichtet, veröffentlicht, informiert, erteilt … Bestätigung) as the specification allows it for evaluation and control, because legal German states an authority's duty in the indicative. Discontinuous patterns allow 160 characters between their parts. 57 patterns: the 33 starters of the specification, the authority form of the control verbs that the specification allows (PK-05), and 23 extensions, 21 from the gold set and 2 from the slice. On the bundled snapshot the pattern stage finds 870 candidates in 4,904 sentences.

**Gold set.** Sentences were ordered within each family by SHA-256 of "2026|paragraph id|sentence text", the families interleaved, and every sentence labelled in that order until 40 duties and 20 non-duties were found (262 sentences read). A sentence is a duty when it obliges its addressee to report or notify, prove, inform, document or keep, evaluate or check; an authority's duty in the present tense counts; substantive duties (pay, hand over, design, insure), permissions, definitions, survey scopes and form rules do not. The order is stable under splitter changes elsewhere, so a later rebuild keeps the sample. The labels await Victor's confirmation.

## 9. Cost engine and option rules

Full precision everywhere; only `js/engine/format.js` rounds, with `Intl.NumberFormat` (de-DE, en-GB), for display. A citizen duty's € figure is its material cost; its time is reported in hours, and its options rank by the change in hours first. A register retrieval's administration cost lands on the level in `admin_level`; for a cluster the option sums the deltas of the members the register covers fully and counts the one-off cost once. Options carry `removed_duty_ids` (the duties an approval removes), from which slice coverage counts per type, and fact specifications (key, unit, label code, inputs) that the tools of version 0.2.0 register. A register retrieval carries the risk that the register must hold the data as up to date as needed, as in the specification's Option example.

## 10. Decisions and defaults

- **D1 slice:** 31 norms in five families, marked provisional until confirmed.
- **D3 sovereign endpoint:** none; the mode will show "No sovereign endpoint configured".
- **D4 calibration:** OnDEA not reachable from the build environment; no calibration; every population, case number and frequency is an assumption.
- **D6 wage rates and time values:** the guide's tables, 8th edition of February 2026: the wage tables for businesses (p. 72, 2025) and administration (p. 76, 2025), the time tables for businesses (p. 69), citizens (p. 67) and administration (p. 74). The golden cases keep their illustrative €40 and €45.
- **D7 API key:** none; the runs of version 0.2.0 will be hand-authored.
- **Proposals P-1 to P-5** of PLAN.md were approved with the plan.
- **Repository hygiene:** the review branch `snapshot/probe` of the network probes holds raw downloads and is never merged.
