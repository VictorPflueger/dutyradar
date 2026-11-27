# Duty Radar (Pflichten-Radar)

An AI agent reads 31 laws, finds where two of them ask the same businesses for the same items and prices the relief with the federal compliance-cost method. A person approves every cut. Five steps, five minutes, in English and German. Version 2.2.0.

Live: <https://victorpflueger.github.io/dutyradar/>. EN | DE in the header, or `?lang=de`.

Built by Victor Pflüger: [LinkedIn](https://www.linkedin.com/in/victorpflueger), [website](https://victorpflueger.github.io/VIP/index.html).

## The case

PflichtenLichten is the federal and state governments' plan to take duties off businesses: at least a third fewer reporting duties and half the documentation duties. Where do you start? Duty Radar shows an agent that reads the law, finds 745 duties, spots two monthly reports that ask for the same 4 items, prices three options and hands the decision to a person. Merging the two reports saves businesses up to €1.51m a year and cuts 1 of the 107 reporting duties the target asks for in these laws. "Up to", because the law doesn't say how many businesses file both reports: public counts cap them at 22,217.

## What 2.2.0 adds

A person who has never seen the prototype should grasp each screen without the guide, and see where every number comes from.

- What each number counts, beside the steps, opens a ladder from law to relief: every term with its count and a one-line definition (31 laws, 778 sections, 4,904 sentences, 870 flagged, 745 duties by type, 48 clusters, 1 priced, 3 options, 1 decision). Each step's hint is its rung.
- The map names each law in words, by topic, with its duties and how many sit in clusters, over a legend in words. Nothing lives on hover only.
- Every count opens what it counts. A count in the story, on the ladder, on the map or in a key figure opens its list beside the story and marks its laws on the map: a law's duties, all 745 with filters, the 125 discarded sentences, the 48 clusters. Each duty shows its sentence, section, type, addressee, items, who carries it and its cluster.
- "Compare: who, what, how often" sets the two duties side by side from the law's text and says plainly that the same businesses are assumed, not shown.
- "Where does this figure come from?" opens the derivation of every euro: each input with its kind and source, the arithmetic, the rounding, and the relief if fewer businesses file both.
- A calibration from public counts. In 2025 the production survey's monthly reporting group held 22,217 sites, the trade and services surveys about 41,300 legal units. A business files both reports only if it is in both, so at most 22,217 can. Run R1 had assumed 60,000; with the cap the relief at stake is up to €1.51m, not €4.07m. [DATA_SOURCES.md](DATA_SOURCES.md) has the sources and their dates.

## How to show it

The page opens with How it works, Vici's guide; its last chapter is the talk track, five steps of a minute each. Wherever the page waits, a bar under the story says "Your turn" and holds the one button that runs the agent to the next step.

| Step | The screen | What to open |
|---|---|---|
| 1 The target | The −⅓ and −½ targets; 31 laws, none read yet | The three key figures, at stake from the first screen |
| 2 It reads | The laws fill in with their duties; one duty with its sentence and section | "745 duties": every duty with its sentence |
| 3 Asked twice | The duty in each law, A and B, the 4 items asked in both, and who carries the duty | "Compare": who, what, how often, and what is assumed |
| 4 It prices | Three options, priced with the federal method | "Where does this figure come from?" |
| 5 You decide | Approve merge, approve register lookup or keep both | The dossier entry and the key figures that move |

[DEMO_SCRIPT.md](DEMO_SCRIPT.md) has the talk track in both languages and short answers to the questions a first look raises.

## The three key figures

They sit top right and answer first; only the decision moves them. Each opens what it counts, and the guide explains each in a row of its own.

| Key figure | What it tells the customer | In this run |
|---|---|---|
| Asked twice | How much the law asks twice | 203 of 745 duties in 31 laws sit in 48 clusters |
| Relief at stake a year | Up to what the merge saves businesses, by the federal compliance-cost method, until a person approves it | Merge up to €1.51m; register lookup €1.45m net (businesses save €1.85m, the administration spends €0.39m, plus €250,000 once); keep €0 |
| Reporting duties cut | How far that gets toward the target | A third of 320 is 107; one approval cuts 1 |

## What is real, counted, assumed or simulated

| Real | Counted | Assumed | Simulated |
|---|---|---|---|
| The 31 laws and their § citations, as gesetze-im-internet.de published them on 19 November 2026 (consolidated texts, not the official version); the federal compliance-cost method and its tables (Destatis guide, February 2026): €38.60 an hour for businesses, €44.40 for the federal administration, 10 min a report | At most 22,217 businesses can file both reports (public counts for 2025) | That all of them do; €0.50 material a report; 2 min a register lookup; €250,000 to connect the register | The agent's run, a replay of release 1.0.0's run R1 in which no model is called; the business register |

## Where the figures come from

Release 1.0.0 was the full lab: 16 agent tools, deterministic engines, three runs, a live mode against a model API. Version 2.0.0 kept the lab's results and dropped the lab. `tools/build-story.mjs` replays run R1 headless with 1.0.0's own engines, caps the businesses at the public counts with 1.0.0's own assumption editor, and writes `data/story.js` and `data/inventory.js`; the page shows those figures and computes none. `node tools/build-story.mjs --check` proves both files are what the engines compute, and `tests/derivation.mjs` recomputes every euro from the method's inputs.

The lab stays in the history at commit `7377619`: <https://github.com/VictorPflueger/dutyradar/tree/7377619>.

## Run it

Static files, no build step, no dependency. Browsers don't run the page's modules from a file, so serve the folder:

```sh
python -m http.server 8000     # then open http://localhost:8000
```

Address options: `?lang=de` German, `?guide=0` without the guide, `?guide=present` straight to the talk track, `?step=prices` one step, `?speed=4` a faster agent for rehearsals.

## Tests

`node tests/run-all.mjs` runs every suite, from the ladder and the derivation to the showcase in Chromium. [tests/README.md](tests/README.md) has the setup; GitHub Actions runs them on every push.

## Files

| Path | What it holds |
|---|---|
| `index.html` | The page and both guides, English and German |
| `js/` | Ten modules: start-up and controls (`main.js`), drawing (`view.js`), the panel (`panel.js`), the lists (`lists.js`), the steps' words and figures (`story.js`), the panels' words (`explain.js`), the fixed words and the glossary (`copy.js`), number formats (`format.js`), the language before start-up (`lang.js`), the theme (`theme.js`) |
| `css/app.css` | The page around Vici |
| `data/story.js`, `data/inventory.js` | The figures, and every duty, discarded sentence and cluster, generated from release 1.0.0 |
| `vici/` | Vici, Victor's design system, unchanged at the commit `vici/README.md` names |
| `tools/build-story.mjs` | Builds and checks both data files |
| `tests/` | The suites |
| [DEMO_SCRIPT.md](DEMO_SCRIPT.md), [DESIGN.md](DESIGN.md), [DATA_SOURCES.md](DATA_SOURCES.md), [REVIEW.md](REVIEW.md) | The presenter's guide, the design notes, the sources, the reviews |

Prototype, not an official federal government service. No licence file yet: all rights reserved.
