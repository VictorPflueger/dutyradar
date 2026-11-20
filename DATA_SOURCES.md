# DATA_SOURCES — Duty Radar

Every source with its address, retrieval date, terms and edition, and every assumption with its rationale. Version 1.0.0; the sources have not changed since version 0.1.0.

## 1. Federal law texts

- **Source:** gesetze-im-internet.de, published by the Federal Ministry of Justice and juris: the daily table of contents `gii-toc.xml` and one XML archive per norm (<https://www.gesetze-im-internet.de/hinweise.html>).
- **Retrieved:** 19 November 2026, 04:01:18 UTC, through the public daily archive QuantLaw/gesetze-im-internet (<https://github.com/QuantLaw/gesetze-im-internet>, branch `data`, commit `0d22c0e8e411a1d43d9e586ff87ce53cc86e66f1`), which stores the host's files unchanged (TECH_NOTES.md §5).
- **Terms:** free to use and reuse; the consolidated texts are not the official version, which is the Federal Law Gazette (Bundesgesetzblatt). The citation notice in the app says so. The archive's own scripts are under a BSD licence; the law texts are official works.
- **What is bundled:** 31 norms, 778 paragraphs, 4,904 sentences in `data/corpus/`; [SNAPSHOT.md](SNAPSHOT.md) lists each norm with its build date and EU basis.

## 2. Cost method and tables

- **Source:** Statistisches Bundesamt (Destatis), "Leitfaden zur Ermittlung und Darstellung des Erfüllungsaufwands in Regelungsvorhaben der Bundesregierung", 8th edition, February 2026 (<https://www.destatis.de/DE/Themen/Staat/Buerokratiekosten/Publikationen/Downloads-Buerokratiekosten/leitfaden-erfuellungsaufwand.pdf?__blob=publicationFile>), 79 pages, SHA-256 `cb8e8d77831f2442ea697456a8e0a0c952979dfa391a30e23d4014e2b42f2672`, retrieved on 19 November 2026 by a GitHub Actions run.
- **Terms:** reproduction and distribution, also in extracts, permitted with the source stated.
- **Tables used** (`data/params/sources.json`, source keys `leitfaden-2026:<table>`): the wage table for businesses (Anhang 6, p. 72, as of 2025: whole economy €26.10, €37.10 and €62.40 per hour for low, medium and high qualification, €38.60 on average); the wage table for the administration (Anhang 8, p. 76, as of 2025: federal level €44.40 per hour on average, €40.40 for the upper intermediate service); the time tables for businesses (Anhang 4, p. 69), citizens (Anhang 3, p. 67) and the administration (Anhang 7, p. 74).
- **How:** the default minutes per case are sums of the tables' standard activities at the stated complexity; each cost parameter names its table and, in a note, the activities summed.

## 3. Calibration

- **OnDEA**, the Destatis database of compliance-cost estimates: not used. It answered GitHub's runners but not the web-fetch tool of this build, and no export was available to transcribe (decision D4).
- **DIP**, the Bundestag's documentation system: not used up to version 1.0.0; it needs the public key and runs as an optional build step.
- Until a calibration exists, every population size, case number and frequency in `data/params/` is an assumption.

## 4. Assumptions and synthetic data

| File | What | Label |
| --- | --- | --- |
| `data/params/populations.json` | Ten populations with their number of units | Annahme: assumed until calibration (OnDEA not reachable) |
| `data/params/cost-params.json` | Defaults per addressee group and parameters for eight duties: population sizes, case numbers, frequencies, material cost, the register retrieval's administration time and level | Annahme for each such field, with its rationale in German and English; wage rates and minutes from the guide's tables |
| `data/params/one-off.json` | €250,000 for connecting a register | Annahme, the specification's example value |
| `data/registers.json` | Four register candidates with the data items they could supply | simuliert: no register is called |
| `data/consumers.json` | Four known uses of the data a duty collects | synthetic, marked "(Beispiel)" |
| `data/signals/complaints.json` | 32 complaints in the categories of the Deutschland-Report | synthetic: invented texts, no real person or company |
| `js/config.js` | 1 USD = 0.894 EUR | Annahme, as in the sister apps |

## 5. Duty categories and targets

- **PflichtenLichten** (<https://bmds.bund.de/themen/staatsmodernisierung/buerokratierueckbau/pflichtenlichten>): the six duty types and the benchmarks of −⅓ for reporting duties and −½ for documentation duties. The gauges compare the slice with these benchmarks; they do not measure progress toward the national targets.
- **Complaint categories:** Deutschland-Report (<https://deutschland-was-geht.org/report/dashboard>); no complaint data is downloaded.
