# SNAPSHOT — the bundled law texts

The law texts in `data/corpus/` are the consolidated versions published on gesetze-im-internet.de by the Federal Ministry of Justice and juris; they are not the official version, which is the Federal Law Gazette (Bundesgesetzblatt). They were retrieved from https://www.gesetze-im-internet.de/gii-toc.xml on 2026-11-19T04:01:18Z by the public daily archive [QuantLaw/gesetze-im-internet](https://github.com/QuantLaw/gesetze-im-internet) (branch `data`, commit `0d22c0e8e411a1d43d9e586ff87ce53cc86e66f1`), which stores the table of contents and every norm's unzipped XML unchanged; `tools/snapshot-laws.mjs --archive` built this corpus from that commit, because gesetze-im-internet.de does not answer GitHub's runners or this build's shell (TECH_NOTES.md §5).

Table of contents: https://www.gesetze-im-internet.de/gii-toc.xml, SHA-256 `78c2db9a186b078224bda29ea619c071e16e6e98b562fb2f1f2019fa5f131235`. Slice `slice-1` (provisional): 31 norms, 778 paragraphs, 4904 sentences. Paragraph links: not checked (they follow the site's pattern `<slug>/__<nr>.html`; TECH_NOTES.md §5 lists the spot checks).

| Slug | Abbreviation | Build date | Paragraphs | Sentences | EU basis (CELEX) | Not kept: structure, annex, repealed, other |
| --- | --- | --- | --- | --- | --- | --- |
| `bstatg_1987` | BStatG | 2024-05-15 | 28 | 167 | 32020L2184 | 0, 0, 4, 0 |
| `prodgewstatg` | ProdGewStatG | 2026-05-06 | 13 | 62 | – | 4, 0, 4, 1 |
| `hdldlstatg` | HdlDlStatG | 2026-05-06 | 15 | 68 | – | 4, 0, 0, 0 |
| `kostrukstatg` | KoStrukStatG | 2026-05-06 | 7 | 24 | – | 0, 0, 1, 1 |
| `preisstatg` | PreisStatG | 2026-05-06 | 14 | 57 | – | 0, 0, 0, 1 |
| `verdstatg` | VerdStatG | 2026-06-01 | 10 | 44 | – | 0, 0, 1, 0 |
| `hwstatg_1994` | HwStatG | 2026-05-06 | 6 | 11 | – | 0, 0, 4, 0 |
| `gwstatg` | GWStatG | 2026-05-06 | 11 | 27 | – | 0, 0, 0, 0 |
| `ahstatg` | AHStatG | 2026-05-06 | 19 | 120 | – | 0, 0, 0, 0 |
| `ahstatdv_2022` | AHStatDV | 2026-05-06 | 34 | 231 | – | 5, 4, 0, 3 |
| `statregg` | StatRegG | 2026-05-06 | 12 | 38 | – | 0, 0, 0, 0 |
| `vwdvg_2010` | VwDVG | 2026-05-06 | 8 | 33 | – | 0, 0, 0, 0 |
| `enstatg_2017` | EnStatG | 2020-01-07 | 16 | 60 | – | 0, 0, 0, 0 |
| `milog` | MiLoG | 2026-06-30 | 23 | 119 | 32020L1057, 32014L0067, 32022L2041 | 6, 0, 1, 1 |
| `miloaufzv` | MiLoAufzV | 2014-12-31 | 2 | 7 | – | 0, 0, 0, 1 |
| `milodokv_2015` | MiLoDokV | 2026-05-06 | 2 | 8 | 32020L1057, 32014L0067 | 0, 0, 0, 1 |
| `milomeldv` | MiLoMeldV | 2026-05-06 | 4 | 26 | 32020L1057, 32014L0067 | 0, 0, 0, 1 |
| `arbzg` | ArbZG | 2024-12-31 | 26 | 131 | – | 8, 0, 1, 0 |
| `aentg_2009` | AEntG | 2026-06-30 | 49 | 269 | 32018L0957, 32020L1057, 32014L0067 | 14, 0, 1, 1 |
| `verpackdg` | VerpackDG | 2026-11-16 | 69 | 638 | 32025L0040, 32008L0098, 32019L0904 | 13, 2, 0, 1 |
| `elektrog_2015` | ElektroG | 2026-05-06 | 52 | 494 | 32012L0019, 32024L0884, 32015L1535 | 11, 8, 0, 1 |
| `battdg` | BattDG | 2026-08-13 | 64 | 412 | – | 24, 0, 0, 1 |
| `gewo` | GewO | 2026-08-21 | 128 | 979 | 32005L0036, 32016L0097 | 21, 1, 25, 18 |
| `gewo_34cdv` | MaBV | 2026-08-21 | 22 | 136 | – | 0, 3, 2, 0 |
| `finvermv` | FinVermV | 2025-02-10 | 29 | 196 | – | 6, 2, 1, 1 |
| `versvermv_2018` | VersVermV | 2025-02-21 | 27 | 147 | – | 7, 4, 0, 1 |
| `immvermv` | ImmVermV | 2026-07-31 | 19 | 92 | – | 6, 2, 1, 0 |
| `bewachv_2019` | BewachV | 2026-05-06 | 24 | 109 | – | 8, 3, 0, 3 |
| `bewachrv` | BewachRV | 2026-05-06 | 14 | 66 | – | 0, 0, 0, 0 |
| `spielv` | SpielV | 2021-09-30 | 26 | 125 | – | 9, 1, 1, 0 |
| `schauhv` | SchauHV | 2013-04-05 | 5 | 8 | – | 0, 0, 0, 1 |

