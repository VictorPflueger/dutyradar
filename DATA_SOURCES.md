# Data sources

Every source of Duty Radar's figures with its address, date and terms, and every assumption. The figures are release 1.0.0's: its engines computed them when its run R1 was replayed (README, Where the figures come from).

## Federal law texts

gesetze-im-internet.de, published by the Federal Ministry of Justice and juris (<https://www.gesetze-im-internet.de/hinweise.html>). Retrieved on 19 November 2026 through the public daily archive QuantLaw/gesetze-im-internet (<https://github.com/QuantLaw/gesetze-im-internet>, branch `data`, commit `0d22c0e8e411a1d43d9e586ff87ce53cc86e66f1`), which stores the host's files unchanged: 31 laws, 778 paragraphs, 4,904 sentences. Free to use and reuse. The consolidated texts are not the official version, which is the Federal Law Gazette (Bundesgesetzblatt); the page says so under each law sentence it shows.

## Cost method

Statistisches Bundesamt (Destatis), "Leitfaden zur Ermittlung und Darstellung des Erfüllungsaufwands in Regelungsvorhaben der Bundesregierung", 8th edition, February 2026 (<https://www.destatis.de/DE/Themen/Staat/Buerokratiekosten/Publikationen/Downloads-Buerokratiekosten/leitfaden-erfuellungsaufwand.pdf?__blob=publicationFile>), SHA-256 `cb8e8d77831f2442ea697456a8e0a0c952979dfa391a30e23d4014e2b42f2672`. Reproduction permitted with the source stated.

| Value | From the guide |
|---|---|
| €38.60 an hour for businesses, all sectors, average qualification | Anhang 6, p. 72 (as of 2025) |
| €44.40 an hour for the federal administration, average | Anhang 8, p. 76 (as of 2025) |
| 10 min per report | Anhang 4, p. 69: the simple standard activities, summed (3 + 2 + 3 + 1 + 1) |

A report costs businesses × reports a year × (minutes / 60 × wage + material), with 12 reports a year: monthly, as § 4 HdlDlStatG sets it. Both monthly reports cost €4.99m a year each, €9.98m together. Merging keeps the report under § 11 HdlDlStatG and adds the minutes for the share of data it didn't ask for yet, one item of five: one report of 12 min instead of two of 10 min, €4.07m a year less. A register retrieval drops that report for businesses (€4.99m) and costs the administration 2 min per retrieval at €44.40 an hour (€1.07m), €3.93m net.

## Targets

PflichtenLichten (<https://bmds.bund.de/themen/staatsmodernisierung/buerokratierueckbau/pflichtenlichten>), part of the federal and state governments' modernisation agenda: at least a third fewer reporting duties and at least half fewer documentation duties. In these 31 laws that is 107 of 320 reporting duties and 47 of 94 documentation duties. The page compares with these benchmarks; it doesn't measure the national progress.

## Assumptions

Release 1.0.0 labelled each of these Annahme (assumption) with its reason, in its `data/params/` files.

| Value | Its reason in release 1.0.0 |
|---|---|
| 60,000 businesses per survey | Assumed until calibration: the OnDEA database of Destatis was not reachable |
| €0.50 material per report | Postage and material cost assumed as a flat rate |
| 2 min per register retrieval, by a federal authority | An automated register retrieval, assumed until calibration |
| €250,000 once to connect the register | The specification's example value, assumed until calibration |

## Simulated

The agent's run is a replay of release 1.0.0's run R1, which was written by hand with 1.0.0's run author, not recorded from a model; 1.0.0's engines computed every figure in it. The business register is simulated: no register is called.
