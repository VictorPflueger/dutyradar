# Reviews of 2.2.0

What 2.2.0 was checked against before release, on 27 November 2026: a cold read, a partner review and three design reviews. The record names no one.

## Cold read

An agent that had seen neither the code nor the documents read only screenshots at 1280 × 720, with the guide closed: the five steps, the state after approving the merge, and the panels behind the counts (the ladder, all 745 duties, the price statistics law's duties, the 48 clusters, the comparison, the merge's derivation, also scrolled down, and the register's). It answered eight questions and two more, on what a number on the law map counts and on two duties of the price statistics law. A fresh agent read the English screens, another the German ones, in each of three rounds. The answers below are the third round's, word for word, on the screens of commit 9548d8b.

### What the first two rounds changed

Round 1 (screens of commit d3c0462) matched every question but one: the German reader couldn't see the wage, the material or why the merged report takes 12 min.

- The derivation opened with its inputs table, which in German ended at "Minuten je Meldung" on the first screen. It now opens with the formula, what is assumed, the arithmetic and the 12 minutes.
- The comparison's answer, that the same businesses are assumed and not shown, sat below its quotes. It now comes first, with the agent's reading.
- After an approval the relief tile said "merge approved" under €0, which both readers took for a loss. Its note now says what was approved.
- "Run R1" meant nothing to either reader. The screens say the replayed run.
- The clusters list says what confidence means, and the register's derivation why €1.85m − €0.39m shows as €1.45m.
- A panel kept the last list's scroll, so one derivation opened at its sources. Panels open at the top.

Round 2 (screens of commit 72b4e51) matched every question in both languages. Its notes led to these changes:

- The first of the 745 duties was a sentence about the statistics offices, read as a business duty, and the note on wrong readings stood after the last card. The list opens with the two priced duties, under the note.
- Duties outside the priced pair said "60,000, assumed" beside a header that says 22,217. They now say it is the replayed run's assumption.
- The merge's reason said "the same data"; 4 of 5 items are the same, so it says "the same items".

After round 3, the register's relief also reads "up to", as it rests on the same cap as the merge's, and the line on who carries the duty says its 0.53 million reports count both reports.

### q1: What does the prototype do?

| Language | Expected | Given | Match |
|---|---|---|---|
| English | An agent reads 31 laws, finds 745 duties and those that ask businesses for the same items, and prices the relief of merging two monthly reports with the federal compliance-cost method: up to €1.51m a year. A person approves the cut; nothing is sent. | Duty Radar is labelled SIMULATION. An agent reads every sentence of 31 hand-picked German laws, finds the duties, groups duties that ask businesses for the same items into clusters and prices the most promising overlap with the federal compliance-cost method. A person then approves an option into a draft relief dossier. The aim is PflichtenLichten's target of a third fewer reporting duties. [01-step-1, 06-step-3, 09-step-4, 13-step-5] | yes |
| German | Ein Agent liest 31 Vorschriften, findet 745 Pflichten und die, die Unternehmen nach denselben Angaben fragen, und bepreist die Entlastung durch das Zusammenlegen zweier Monatsmeldungen nach der Methode des Bundes: bis zu 1,51 Mio. € im Jahr. Ein Mensch gibt frei; nichts wird versendet. | Pflichten-Radar (als SIMULATION markiert) findet Angaben, die zwei Vorschriften doppelt abfragen, und bepreist die Entlastung. Ein nachgespielter Agent liest 31 Vorschriften (4.904 Sätze), findet 745 Pflichten, bündelt 203 in 48 Bündel und bepreist eines mit 3 Optionen (bis zu 1,51 Mio. € im Jahr). Ein Mensch gibt eine frei, als Dossierentwurf. Ziel von PflichtenLichten: ein Drittel weniger Meldepflichten. (Bilder 01, 02, 06, 09, 13, 14) | yes |

### q2: What is the difference between a duty, a reporting duty and a cluster?

| Language | Expected | Given | Match |
|---|---|---|---|
| English | A duty is anything a law makes someone do (745). A reporting duty is one type of duty: report something to an authority (320; the target cuts them by a third). A cluster holds duties that ask the same addressees for overlapping items (48 clusters, 203 duties). | A duty is a flagged sentence that the agent confirms makes someone do something (745). A reporting duty is one of six duty types: reporting something to an authority, the type the target cuts by a third (320 of 745). A cluster is a group of duties that ask the same addressees for overlapping items (48 clusters holding 203 duties). [03-ladder, 06-step-3, 07-clusters] | yes |
| German | Eine Pflicht ist alles, was eine Vorschrift jemandem auferlegt (745). Eine Meldepflicht ist eine Art von Pflicht: einer Behörde etwas melden (320; das Ziel kürzt sie um ein Drittel). Ein Bündel hält Pflichten, die dieselben Adressaten nach überlappenden Angaben fragen (48 Bündel, 203 Pflichten). | Pflicht: ein markierter Satz, den der Agent bestätigt, weil eine Vorschrift von jemandem etwas verlangt (745; 125 verworfen). Meldepflicht: eine Art Pflicht, nämlich einer Behörde etwas melden (320 der 745, neben Informations-, Nachweis-, Dokumentationspflichten u. a.; das Ziel kürzt sie um ein Drittel). Bündel: Pflichten, die dieselben Adressaten nach überlappenden Angaben fragen (48 Bündel mit 203 Pflichten). (Bilder 02, 03, 06, 07) | yes |

### q3: How many laws, duties and clusters did it find, and where can you see them?

| Language | Expected | Given | Match |
|---|---|---|---|
| English | 31 laws, chosen by hand; 745 duties; 48 clusters holding 203 duties. In the step bar, the key figure Asked twice (203 of 745), the law map and the ladder; each count opens its list. | The 31 laws (19 acts, 12 ordinances, 778 sections, 4,904 sentences) were chosen by hand, not found. The agent flagged 870 sentences, kept 745 duties and discarded 125; 203 duties sit in 48 clusters. These numbers appear in the step bar, the top tiles, the Duties and in-clusters columns of the law map, the "What each number counts" panel and the duty and cluster lists. [01-step-1, 02-step-2, 03-ladder, 04-all-duties, 06-step-3, 07-clusters] | yes |
| German | 31 Vorschriften, von Hand gewählt; 745 Pflichten; 48 Bündel mit 203 Pflichten. In der Schrittleiste, der Kennzahl Doppelt gefragt (203 von 745), der Karte und der Leiter; jede Zahl öffnet ihre Liste. | 31 Vorschriften (19 Gesetze, 12 Verordnungen, 778 Paragrafen; von Hand gewählt, nicht gefunden), 745 Pflichten aus 870 markierten von 4.904 Sätzen, 203 Pflichten in 48 Bündeln. Zu sehen sind sie in der Schrittleiste, in der Kachel „Doppelt gefragt 203 von 745“, in der linken Tabelle (Spalten Pflichten, in Bündeln) und in den Seitenfeldern „Was jede Zahl zählt“, „745 Pflichten …“ und „48 Bündel …“. (Bilder 01, 02, 03, 04, 06, 07) | yes |

### q4: Which two duties ask for the same data, and is it certain that the same businesses file both?

| Language | Expected | Given | Match |
|---|---|---|---|
| English | Trade and services statistics § 11 and production statistics § 9, monthly reports that share 4 of 5 items. Not certain: the same businesses are assumed, not shown; public counts cap them at 22,217. | Trade and services statistics § 11 and Production statistics § 9: two monthly reports that ask the same 4 items (persons employed, sector, turnover, company data). It is not certain: the screen says the same businesses are "assumed, not shown". A business files both only if it is a trade or services firm running a producing site of 50+ persons. Public counts cap this at 22,217; confidence 0.72. [02-step-2, 04-all-duties, 06-step-3, 07-clusters, 08-compare] | yes |
| German | Handels- und Dienstleistungsstatistik § 11 und Produktionsstatistik § 9, zwei Monatsmeldungen mit 4 von 5 gleichen Angaben. Nicht sicher: Dieselben Unternehmen sind angenommen, nicht belegt; amtliche Zählungen begrenzen sie auf 22.217. | Handels- und Dienstleistungsstatistik § 11 (A) und Produktionsstatistik § 9 (B), zwei Monatsmeldungen. 4 von 5 Angaben sind gemeinsam: Beschäftigte, Branche, Umsatz, Stammdaten (Produktion nur in B), Sicherheit 0,72. Sicher ist es nicht: „angenommen, nicht belegt“. Sie treffen dasselbe Unternehmen nur, wo ein Handels- oder Dienstleistungsunternehmen einen produzierenden Betrieb ab 50 tätigen Personen hat. Amtliche Zählungen begrenzen das auf 22.217. (Bilder 06, 07, 08) | yes |

### q5: How is the relief computed, and which inputs are assumed?

| Language | Expected | Given | Match |
|---|---|---|---|
| English | By the federal compliance-cost method: businesses × 12 reports a year × (10 min ÷ 60 × €38.60 + €0.50). Two reports of 10 min cost €3.70m, one merged report of 12 min €2.19m: up to €1.51m. Assumed: that all 22,217 file both, and €0.50 material a report. | The federal compliance-cost method, with minutes and wages from Destatis tables: businesses × reports a year × (minutes/60 × wage + material). Merge: 266,604 reports a year; two 10-minute reports at €38.60/h cost €3,696,908.80, one 12-minute report €2,191,484.88, relief €1,505,423.92. Register: €1,848,454.40 minus €394,573.92 for lookups = €1,453,880.48. Assumed: all 22,217 file both, €0.50 material a report, 2-minute lookups, €250,000 one-off setup, a simulated register. [09-step-4, 10-where-merge, 12-where-register] | yes |
| German | Nach der Methode des Bundes: Unternehmen × 12 Meldungen im Jahr × (10 min ÷ 60 × 38,60 € + 0,50 €). Zwei Meldungen à 10 min kosten 3,70 Mio. €, eine zusammengelegte à 12 min 2,19 Mio. €: bis zu 1,51 Mio. €. Angenommen: dass alle 22.217 doppelt melden, und 0,50 € Sachkosten je Meldung. | Nach Destatis-Leitfaden: Kosten im Jahr = Unternehmen × Meldungen × (Minuten ÷ 60 × Stundenlohn + Sachkosten). 22.217 × 12 = 266.604 Meldungen. Zwei à 10 min, 38,60 €/h (Destatis-Tabellen): 3.696.908,80 €. Eine zusammengelegte à 12 min (10 plus Anteil 1 von 5 Angaben): 2.191.484,88 €. Entlastung 1.505.423,92 € ≈ 1,51 Mio. €. Angenommen: alle 22.217 melden doppelt, 0,50 € Sachkosten; beim Registerabruf zusätzlich 2 min und 250.000 € Anbindung. (Bilder 09, 10, 12) | yes |

### q6: Who is affected, and how many?

| Language | Expected | Given | Match |
|---|---|---|---|
| English | Businesses in both surveys: up to 22,217, the sites the production survey asks; that all of them file both is assumed. Monthly, up to 0.53 million reports a year. | Businesses in both the trade-and-services survey and the production survey: up to 22,217, the number of sites the production survey asks (the trade survey asks about 41,300). The law doesn't say how many file both, so the page assumes all do: up to 0.53 million reports a year. If half file both, relief is €0.75m; if one in ten, €0.15m. The register option adds €0.39m of lookups for the administration. [06-step-3, 08-compare, 10-where-merge, 11-where-merge-scrolled, 12-where-register] | yes |
| German | Unternehmen in beiden Erhebungen: bis zu 22.217, so viele Betriebe fragt die Produktionserhebung; dass alle doppelt melden, ist angenommen. Monatlich, bis zu 0,53 Millionen Meldungen im Jahr. | Betroffen sind Unternehmen, die in beiden Erhebungen melden (Handel/Dienstleistung und Produktion): höchstens 22.217, so viele Betriebe fragt die Produktionserhebung, monatlich bis zu 0,53 Mio. Meldungen im Jahr. Wie viele wirklich doppelt melden, sagt der Gesetzestext nicht; dass alle es tun, ist angenommen (die Hälfte wären 11.109). Insgesamt richten sich 642 der 745 Pflichten an Unternehmen, 103 an die Verwaltung. (Bilder 04, 06, 08, 11) | yes |

### q7: What does the person decide, and what changes then?

| Language | Expected | Given | Match |
|---|---|---|---|
| English | The person approves the merge or the register lookup, or keeps both, with a reason. Approving the merge cuts 1 of the 107 reporting duties, takes the relief at stake to €0 as approved and writes a draft into the dossier; nothing is sent. | A person, not the agent, picks which option goes into the relief dossier: merge (up to €1.51m), register lookup (€1.45m) or keep both (€0). Approving the merge changes "Reporting duties cut" from 0 to 1 of 107 and "Relief at stake" from €1.51m to €0 (approved). It also adds draft wording that repeals § 9 ProdGewStatG (1). Nothing is sent, and 47 clusters are still waiting. [13-step-5, 14-after-approving-merge] | yes |
| German | Der Mensch gibt das Zusammenlegen oder den Registerabruf frei oder behält beide, mit Begründung. Das Zusammenlegen streicht 1 von 107 Meldepflichten, setzt die offene Entlastung als freigegeben auf 0 € und schreibt einen Entwurf ins Dossier; nichts wird versendet. | Der Mensch entscheidet zwischen 3 Optionen: Zusammenlegen (bis zu 1,51 Mio. €), Registerabruf (1,45 Mio. €) und Beide behalten (0 €). Gezeigt ist nur „Zusammenlegen freigeben“. Danach: gestrichene Meldepflichten 0 → 1 von 107, offene Entlastung 1,51 Mio. € → 0 € (nun freigegeben), Dossierentwurf „§ 9 ProdGewStatG Absatz 1 wird aufgehoben“ (rechtlich zu prüfen), nichts wird versendet, 47 Bündel warten. (Bilder 13, 14) | yes |

### q8: What is real, what is assumed and what is simulated?

| Language | Expected | Given | Match |
|---|---|---|---|
| English | Real: the law texts (consolidated, not the official version), the federal method and its tables, the public counts. Assumed: that all 22,217 file both, €0.50 material, the register's minutes and cost. Simulated: the agent's run, replayed, and the register. | Real: the law texts (consolidated from gesetze-im-internet.de, not the official version, as of 19 November 2026), the public counts and the Destatis sources. Assumed: all 22,217 businesses file both, €0.50 material a report, 2-minute lookups, €250,000 setup. Simulated: the whole page (SIMULATION badge) and the register. The agent run is a replay; its fixed-rule readings are partly wrong. [01-step-1, 02-step-2, 04-all-duties, 11-where-merge-scrolled, 12-where-register, 13-step-5] | yes |
| German | Echt: die Gesetzestexte (konsolidiert, nicht amtlich), die Methode des Bundes und ihre Tabellen, die amtlichen Zählungen. Angenommen: dass alle 22.217 doppelt melden, 0,50 € Sachkosten, Minuten und Kosten des Registers. Simuliert: der nachgespielte Agentenlauf und das Register. | Echt laut Unterzeile: die Gesetzestexte (konsolidierte Fassung von gesetze-im-internet.de, nicht amtlich). Als Quellen genannt: amtliche Zählungen (Obergrenze 22.217) sowie Destatis-Leitfaden und -Tabellen für Minuten und Lohn. Angenommen: alle 22.217 melden doppelt, 0,50 € Sachkosten, 2 min je Registerabruf, 250.000 € Anbindung, im Lauf 60.000 Unternehmen je Statistik. Simuliert: der nachgespielte Agentenlauf (feste Regeln, manche Lesarten falsch) und das Register. (Bilder 01, 02, 04, 09, 10, 11, 12) | yes |

### tile: On the law map, what does the number in a law's row count?

| Language | Expected | Given | Match |
|---|---|---|---|
| English | The duties found in that law; from step 3 a second number counts how many of them sit in a cluster. | The Duties number counts the duties the agent found in that law (legend: "Duties: found in each law"; the bar compares it with the largest law, 126). Example: Price statistics 9. From step 3 a second column counts the law's duties that sit in a cluster (Price statistics 6; "–" or pale means none). At step 1 the rows are blank and dashed, meaning not read yet. [01-step-1, 02-step-2, 05-price-statistics-law, 06-step-3] | yes |
| German | Die Pflichten, die in dieser Vorschrift gefunden wurden; ab Schritt 3 zählt eine zweite Zahl, wie viele davon in einem Bündel stehen. | Die erste Zahl („Pflichten“) zählt die Pflichten, die der Agent in dieser Vorschrift gefunden hat (Balken relativ zur größten, Gewerbeordnung mit 126; zusammen 745; in Schritt 1 noch leer). Ab Schritt 3 zählt die zweite Zahl („in Bündeln“), wie viele davon in einem Bündel stecken (zusammen 203), z. B. Preisstatistik 9 und 6. „–“ und blass heißen: keine. (Bilder 01, 02, 06) | yes |

### price: Two duties of the price statistics law, from its open list, with their sections

| Language | Expected | Given | Match |
|---|---|---|---|
| English | Any two of its nine, by section: for example the reporting duty in § 3 and the documentation duty in § 3 (1a), or the reporting duty in § 7b. | First, Price statistics § 3 (1a), a documentation duty: businesses, yearly, kept at the business. Electronic transaction records requested under § 7b (3) need unique, stable identifiers; this duty is in no cluster. Second, Price statistics § 3, a reporting duty: businesses, yearly, to the Federal Network Agency. The law has 9 duties (2 reporting, 6 information, 1 documentation); the other seven are not on screen. [05-price-statistics-law] | yes |
| German | Zwei der neun, mit Paragraf: etwa die Meldepflicht in § 3 und die Dokumentationspflicht in § 3 (1a) oder die Meldepflicht in § 7b. | § 3 PreisStatG, Absatz 1a: Dokumentationspflicht der Unternehmen, jährlich, im Betrieb aufbewahrt. Elektronische Transaktionsaufzeichnungen brauchen eindeutige, gleichbleibende Identifikatoren; in keinem Bündel, betroffen 60.000 (vom nachgespielten Lauf angenommen). Ebenfalls § 3 PreisStatG: Meldepflicht der Unternehmen, jährlich an die Bundesnetzagentur („Zum Zweck der Berechnung der in Absatz 1 genannten Preise …“, Rest abgeschnitten). (Bild 05) | yes |

### What the readers still found confusing

- At step 1 the key figures already show 203 of 745 and up to €1.51m, before the agent has read anything. Kept: Vici's key-figure rule asks the figures to answer first, and the page says it replays a run.
- After an approval the relief at stake shows €0, with the old value struck through and "up to €1.51m approved" under it. Kept: the tile counts what is still at stake; the green tile, its note and the step's title say the relief was approved.
- In German, 22.217 counts sites (Betriebe) as the cap on businesses (Unternehmen) in both surveys. Kept: the cap is a count of sites, and the derivation says so.
- The fact check at step 4 isn't explained on the screen. Kept: the agent's line says what it stopped, and the guide's How it works chapter says a fact checker blocks any figure without a source.

## Partner review

As Vici's prototype brief describes it: at 1280 × 720, cold, as someone who has to present it tomorrow.

Verdict: ready

One Thing: An agent finds two monthly reports that ask the same businesses for the same 4 items, and merging them saves businesses up to €1.51m a year (the key figure Relief at stake a year), which only a person can approve.

Keeps its promise: yes. The line under the header says the page finds where two laws ask businesses for the same items and prices the relief, with real law texts, a replayed run and assumed case numbers; each is labelled where it is used, and every figure opens where it comes from.

Walk-through, as someone who knows none of these laws:

- The target: the target in words and the 31 laws by name; the three key figures already say what is at stake.
- It reads: the laws fill in with their duties; "745 duties" opens every duty with its sentence, the priced pair first.
- Asked twice: the duty in each law, the 4 items asked in both, and who carries the duty and how many; Compare answers first that the same businesses are assumed.
- It prices: three options; each euro opens its derivation, with what is assumed above the arithmetic.
- You decide: Approve merge moves two key figures and writes a draft that nothing sends.

The key figures move once, at the decision, after four presses of the bar's button; every step before it moves the story. Timed: the agent runs 9.2 s, 4.1 s and 5.1 s between the stops, so with the talk track and the three panels it opens, the run takes about five minutes. Screens nobody demos: the boot screen, the dark theme, a phone at 375 px, the register and keep decisions, and a list with a filter pressed, each covered by the test suites; a list that fails to load says so and asks for a reload.

### Cut list

- A fourth key figure for the businesses filing both: the number lives in the relief's note and in the line at steps 3 to 5, so the header keeps three figures.
- Law names that showed only on hover: every law is named in words, its short title beside the name where there is room.
- "The same sentence in two laws" as the proof of the overlap: it was the stock clause of most statistics acts. The 4 items asked in both carry the overlap.
- "Run R1" on the screens, and notes that stood after the last card of a list.

### Fix list

All fixed in this release; nothing is deferred.

1. In German the derivation's first screen ended before the wage, the material and the 12 minutes. It now opens with the formula, what is assumed and the arithmetic.
2. The comparison's answer sat below its quotes. What the law shows and the agent's reading come first.
3. The list of duties opened with a misread sentence and kept its note on wrong readings after 745 cards. The priced pair comes first, under the note.
4. "Up to" left the merge at the decision, and the register's relief, which rests on the same cap, never had it. Both read "up to" wherever they appear.
5. After an approval the relief tile said "merge approved" under €0, which read like a loss. It says what was approved.
6. A panel kept the last list's scroll, and from step 3 the ladder opened above the current rungs. Panels open at the top, or at the row their count is about.
7. The A and B marks were dark on lilac (2.9:1). They take the lilac's own text colour, and the contrast suite now measures text hidden from screen readers too.
8. Smaller ones: confidence explained; the register's rounding explained; the merge's reason says "the same items"; the list filters take one row per group; the agent's tag and a phone's step names are at least 11 px; the selected law carries aria-current; the legend says the agent picks A and B; the report count says it counts both reports.

### Keep list

- The byline, the How it works guide with its talk track, and the three key figures, answering first.
- Real law texts, quoted word for word with an English line, labelled as consolidated and not the official version.
- Every count opens what it counts, and the ladder from law to decision.
- The derivation's arithmetic to the cent, and "up to" wherever the businesses are capped.
- Only a person approves, and nothing is sent.

Open for the owner, raised by the design critique and kept as they are in this release:

- The decision bar gives Approve merge the primary style and the attention ring. Three equal buttons might show oversight better; the talk track clicks Approve merge, and Vici's bar holds one primary action.
- A room mode with larger text for projectors: the panels' lists are 11 to 13 px at 1280 × 720.
- Whether the key figures should fill in as the agent works, a reveal, rather than answer first.

## Design reviews

### Steve Jobs review

Verdict: ready, 7 of 7 rows of the quick diagnostic after the fixes above. The One Thing is the partner review's. The value is on the first screen. Readers who saw only screens experienced it cold, on the size it is shown at. This cycle cut a key figure, hover-only names and a false proof. The unseen states (loading, failure, dark, phone) are designed and tested.

### Usability heuristics

Every finding of severity 3 or 4 is fixed; what stays open is cosmetic.

| Finding | Heuristic | Severity | Status |
|---|---|---|---|
| The derivation's arithmetic and the 12 minutes below the fold, in German without the wage | Recognition rather than recall | 3 | Fixed |
| The comparison's answer below its quotes | Visibility of system status | 3 | Fixed |
| The list of duties opening with a misread sentence, its note after the last card | Help users recognise errors | 2 | Fixed |
| "Up to" missing at the decision and on the register | Match with the real world | 2 | Fixed |
| €0 after approval reading as a loss | Match with the real world | 2 | Fixed: the note says what was approved; severity 1 remains |
| A panel keeping the last list's scroll | Consistency and standards | 2 | Fixed |
| "Run R1" and an unexplained confidence | Match with the real world | 2 | Fixed |
| €1.85m − €0.39m shown as €1.45m | Help users recognise errors | 1 | Fixed |
| Key figures answering at step 1 | Visibility of system status | 1 | Open, by Vici's rule |
| Sites and businesses for the same cap in German | Consistency and standards | 1 | Open, precise as it is |

### Impeccable critique

Method: two separate agents, one reviewing the design from the screenshots and the source, one running Impeccable's detector on the page and the served steps. On the round 2 screens the design review scored 28 of 40 on Nielsen's heuristics and found the page authored for its subject. Its priority issues:

- The decision weighting the agent's pick: open for the owner, above.
- Text too small for a room: open for the owner, above.
- Step 3 leading with its weakest proof: fixed, the duty in each law.
- The ending's big number being zero: the note fixed, the tile kept.
- The filter block: fixed, one row per group.

The detector's 32 findings in the page's markup came mostly from Vici's own stylesheet: its hexagon clip paths, table wrappers and the guide's line height. Its findings on the served steps that held were the A and B marks' contrast, the agent's tag at 10.3 px and a phone's step names; all three are fixed. The ask bar's side stripe and the card inside a card at step 3 stay, as 2.1.0 has them.

Questions skipped: part of a build run; the fixes are in this release.

## After the reviews

CI's Chromium sets German text a little wider than the Chrome the reviews used, and at 1280 × 720 the law map and the story then ran over. These changes made the room. No fact or figure changed:

- The line that says who carries the duty is shorter: "Who: up to 22,217 sites, as many as the production survey asks; that all of them file both is assumed. Together up to 0.53 million reports a year." The German line names the Betriebe of the production survey in the same way.
- The relief tile's German note reads "Annahme: 22.217 melden doppelt", and three items of the legend are shorter.
- At laptop sizes the law rows sit edge to edge, the line beside the map's heading is a size smaller, and the three decision buttons share one row, the first without its check.
- The German guide's How it works lead lost its last sentence; its talk track still says that every count opens what it counts.

Impeccable's detector, run again on steps 3 to 5 at 1280 × 720 in English and German, finds five items on each: the contrast it measures on two of Vici's hexagon step markers, the ask bar's side stripe, Vici's typeface and Vici's paper colour. None comes from these changes, and the contrast suite still passes every visible text.
