# Duty Radar (Pflichten-Radar)

An AI agent reads 31 federal laws, finds where two laws ask the same businesses for the same data and prices the relief with the federal compliance-cost method. A person approves every cut. Five steps, five minutes, in English and German.

Live: <https://victorpflueger.github.io/dutyradar/>. EN | DE in the header, or `?lang=de`.

Built by Victor Pflüger: [LinkedIn](https://www.linkedin.com/in/victorpflueger), [website](https://victorpflueger.github.io/VIP/index.html).

## The case

PflichtenLichten is the federal and state governments' plan to take duties off businesses: at least a third fewer reporting duties and half the documentation duties. Where do you start? Duty Radar shows an agent that reads the law, finds 745 duties, spots two monthly reports that ask 60,000 businesses for the same 4 items, prices three options and hands the decision to a person. Merging the two reports saves businesses €4.07m a year and cuts 1 of the 107 reporting duties the target asks for in these laws.

## How to show it

The page opens with How it works, Vici's guide. Its last chapter is the talk track: five steps of a minute each. Close it, and wherever the page waits a bar under the story says “Your turn” and holds the one button, which names where it leads: it runs the agent to the next step and stops there, so you can talk. The steps under the header jump to any step. Once a person has decided, the bar says the story is over and offers Start again.

| Step | The screen | The key figure to point at |
|---|---|---|
| 1 The target | The −⅓ and −½ targets; 31 laws, none read yet | All three: what is at stake, from the first screen |
| 2 It reads | The laws fill in with the duties found in each; one duty with its sentence and section | |
| 3 Asked twice | The same sentence in two laws, named in words, and the 4 items asked in both | Asked twice: 203 of 745 |
| 4 It prices | Three options, priced with the federal method | Relief at stake a year: €4.07m |
| 5 You decide | Approve merge, approve register lookup or keep both; the dossier entry | Relief at stake drops to €0 and Reporting duties cut goes to 1 of 107, the old values struck through |

[DEMO_SCRIPT.md](DEMO_SCRIPT.md) has the talk track in both languages and short answers to the usual questions.

## The three key figures

They sit top right and answer first: from the first screen they show what the case puts at stake, and only the decision moves them. The guide's How it works chapter explains each in a row of its own, and the talk track points at each. When the decision moves a figure, its tile keeps the old value struck through.

| Key figure | What it tells the customer | In this run |
|---|---|---|
| Asked twice | How much the law asks twice | 745 duties in 31 laws, 320 of them reporting duties; 203 ask for data another duty already collects |
| Relief at stake a year | What the merge saves businesses until a person approves it, by the federal compliance-cost method; an approval takes it to €0 | Merge €4.07m; register lookup €3.93m net (businesses save €4.99m, the administration spends €1.07m, plus €250,000 once); keep €0 |
| Reporting duties cut | How far that gets toward the target | A third of 320 is 107; one approval cuts 1 |

## What is real, assumed or simulated

| Real | Assumed | Simulated |
|---|---|---|
| The 31 laws and their § citations, as gesetze-im-internet.de published them on 19 November 2026 (consolidated texts, not the official version) | 60,000 businesses per survey, €0.50 material per report, 2 min per register retrieval, €250,000 to connect the register | The agent's run: a replay of release 1.0.0's run R1, written by hand; no model is called |
| The federal compliance-cost method and its tables (Destatis guide, February 2026): €38.60 an hour for businesses, €44.40 for the federal administration, 10 min per report | | The business register |

[DATA_SOURCES.md](DATA_SOURCES.md) gives each source with its address and terms.

## Where the figures come from

Release 1.0.0 was the full lab: 16 agent tools, deterministic engines, three runs, a live mode against a model API, 78 modules and 7,272 lines of JavaScript. Version 2.0.0 keeps the lab's results and drops the lab. `tools/build-story.mjs` replays run R1 headless with 1.0.0's own engines and writes `data/story.js`; the page shows those figures and computes no new one. `node tools/build-story.mjs --check` proves the file is what the engines compute, and `tests/figures.mjs` recomputes every euro from the method's inputs and checks every figure on the page.

The lab stays in the history at commit `7377619`: <https://github.com/VictorPflueger/dutyradar/tree/7377619>.

## Run it

Static files, no build step, no dependency. Browsers don't run the page's modules from a file, so serve the folder:

```sh
python -m http.server 8000     # then open http://localhost:8000
```

Address options: `?lang=de` German, `?guide=0` without the guide, `?guide=present` straight to the talk track, `?step=prices` one step, `?speed=4` a faster agent for rehearsals.

## Tests

`node tests/run-all.mjs` runs eight suites: the figures, the files, how lean the app stays, Vici's own checks, the showcase in Chromium, the guide, contrast and the hexagon rule. [tests/README.md](tests/README.md) has the setup; GitHub Actions runs them on every push.

## Files

| Path | What it holds |
|---|---|
| `index.html` | The page and both guides, English and German |
| `js/` | Seven modules: start-up and controls (`main.js`), drawing (`view.js`), the steps' words and figures (`story.js`), the fixed words (`copy.js`), number formats (`format.js`), the language before start-up (`lang.js`), the theme (`theme.js`) |
| `css/app.css` | The page around Vici |
| `data/story.js` | The figures, generated from release 1.0.0 |
| `vici/` | Vici, Victor's design system, unchanged at commit `484b49a` |
| `tools/build-story.mjs` | Builds and checks `data/story.js` |
| `tests/` | The suites |
| [DEMO_SCRIPT.md](DEMO_SCRIPT.md), [DESIGN.md](DESIGN.md), [DATA_SOURCES.md](DATA_SOURCES.md) | The presenter's guide, the design notes, the sources |

Prototype, not an official federal government service. No licence file yet: all rights reserved.
