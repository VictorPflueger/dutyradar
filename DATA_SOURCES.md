# Data sources

Every source of Duty Radar's figures with its address, date and terms, and every assumption, for version 2.2.0. The figures are release 1.0.0's: its engines computed them when its run R1 was replayed, with the businesses that can file both reports capped at public counts (Calibration, below; README, Where the figures come from).

## Federal law texts

gesetze-im-internet.de, published by the Federal Ministry of Justice and juris (<https://www.gesetze-im-internet.de/hinweise.html>). Retrieved on 19 November 2026 through the public daily archive QuantLaw/gesetze-im-internet (<https://github.com/QuantLaw/gesetze-im-internet>, branch `data`, commit `0d22c0e8e411a1d43d9e586ff87ce53cc86e66f1`), which stores the host's files unchanged: 31 laws, 778 paragraphs, 4,904 sentences. Free to use and reuse. The consolidated texts are not the official version, which is the Federal Law Gazette (Bundesgesetzblatt); the page says so under each law sentence it shows.

## Cost method

Statistisches Bundesamt (Destatis), "Leitfaden zur Ermittlung und Darstellung des Erfüllungsaufwands in Regelungsvorhaben der Bundesregierung", 8th edition, February 2026 (<https://www.destatis.de/DE/Themen/Staat/Buerokratiekosten/Publikationen/Downloads-Buerokratiekosten/leitfaden-erfuellungsaufwand.pdf?__blob=publicationFile>), SHA-256 `cb8e8d77831f2442ea697456a8e0a0c952979dfa391a30e23d4014e2b42f2672`. Reproduction permitted with the source stated.

| Value | From the guide |
|---|---|
| €38.60 an hour for businesses, all sectors, average qualification | Anhang 6, p. 72 (as of 2025) |
| €44.40 an hour for the federal administration, average | Anhang 8, p. 76 (as of 2025) |
| 10 min per report | Anhang 4, p. 69: the simple standard activities, summed (3 + 2 + 3 + 1 + 1) |

A report costs businesses × reports a year × (minutes / 60 × wage + material), with 12 reports a year: monthly, as § 4 HdlDlStatG sets it. With the 22,217 businesses of the calibration, each monthly report costs €1.85m a year (€1,848,454.40), both together €3.70m. Merging keeps the report under § 11 HdlDlStatG and adds the minutes for the share of items it didn't ask for yet, one item of five: one report of 12 min (€2,191,484.88 a year) instead of two of 10 min, up to €1.51m a year less (€1,505,423.92). A register retrieval drops that report for businesses (€1.85m) and costs the administration 2 min per retrieval at €44.40 an hour (€0.39m, exactly €394,573.92), €1.45m net (€1,453,880.48). On the page, “Where does this figure come from?” shows each of these steps.

## Calibration

New in 2.2.0. Release 1.0.0 assumed 60,000 businesses for every business statistic, because the OnDEA database of Destatis was not reachable. A business can file both reports only if both surveys ask it, so the smaller survey caps the businesses a merge can relieve. Two public counts give that cap:

| Count | Source | Read on |
|---|---|---|
| 22,217 sites with 50 or more persons in manufacturing, mining and quarrying, 2025: the yearly result of the production survey's monthly reporting group. The page lists the 16 Länder and no total for Germany; 22,217 is their sum. | Statistische Ämter des Bundes und der Länder, "Beschäftigte und Umsatz der Betriebe im Verarbeitenden Gewerbe" (<https://www.statistikportal.de/en/node/410>) | 27 November 2026 |
| About 41,300 legal units in the reporting group of the monthly trade and services surveys, 2025 | Statistisches Bundesamt (Destatis), "Qualitätsbericht Konjunkturstatistiken im Handel und Dienstleistungsbereich 2025", published 15 October 2025, p. 12 (<https://www.destatis.de/DE/Methoden/Qualitaet/Qualitaetsberichte/Gross-Einzelhandel/konjunkturstatistik-handel-dienstleistung-2025.pdf?__blob=publicationFile&v=2>) | 27 November 2026 |

The smaller count, 22,217, is the cap. The two count different things, sites and legal units, so the cap bounds the businesses in both surveys rather than counting them. `tools/build-story.mjs` keeps both counts as published; before the decision, 1.0.0's assumption editor sets both duties to the cap and 1.0.0's engines price the options again. That all 22,217 file both reports stays an assumption, so the page says “up to”.

OnDEA (<https://www.ondea.de/>), the Destatis database of compliance cost: not probed. It answered with an error on 27 November 2026, so its case numbers for these two reports remain unread.

What changed: with R1's 60,000 businesses the merge saved €4.07m a year (€4,065,600) and the register lookup €3.93m net (€3,926,400). At 22,217 the merge saves up to €1.51m a year (€1,505,423.92) and the register lookup €1.45m net (€1,453,880.48). If only half, a quarter or a tenth of them file both, the merge saves €0.75m, €0.38m or €0.15m; the page shows these four shares beside the derivation.

## Targets

PflichtenLichten (<https://bmds.bund.de/themen/staatsmodernisierung/buerokratierueckbau/pflichtenlichten>), part of the federal and state governments' modernisation agenda: at least a third fewer reporting duties and at least half fewer documentation duties. In these 31 laws that is 107 of 320 reporting duties and 47 of 94 documentation duties. The page compares with these benchmarks; it doesn't measure the national progress.

## Assumptions

Release 1.0.0 labelled each of these Annahme (assumption) with its reason, in its `data/params/` files; 2.2.0 replaced its 60,000 businesses with the calibration's cap.

| Value | Its reason |
|---|---|
| Up to 22,217 businesses file both reports | 2.2.0: capped at public counts (Calibration); that all of them file both is assumed |
| €0.50 material per report | Postage and material cost assumed as a flat rate |
| 2 min per register retrieval, by a federal authority | An automated register retrieval, assumed until calibration |
| €250,000 once to connect the register | The specification's example value, assumed until calibration |

## Simulated

The agent's run is a replay of release 1.0.0's run R1, which was written by hand with 1.0.0's run author, not recorded from a model; 1.0.0's engines computed every figure in it. The business register is simulated: no register is called.
