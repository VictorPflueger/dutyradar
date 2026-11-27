# Demo script

Five minutes, five steps. The talk track is the same as in the guide's last chapter, How to present (So führen Sie vor).

## Before the talk

1. Open <https://victorpflueger.github.io/dutyradar/> in a new tab: the guide opens by itself. For German, add `?lang=de`.
2. `?guide=present` opens the talk track directly; `?guide=0` skips the guide.
3. Close the guide with Start. Back to the start, the arrow right of the steps, clears a decision.
4. Wherever the page waits, a bar under the story says “Your turn” and holds the one button, which names where it leads, such as “Next: It reads”: it runs the agent to the next step and stops there. A merlot ring pulses around the button three times, then stays as a frame. At the last step the bar asks for your decision; once you have decided, it says the story is over and offers Start again.
5. Every count is a button. It opens what it counts beside the story and marks its laws on the map; Esc closes it. What each number counts, beside the steps, opens the ladder from law to decision.
6. Keys: 1 to 5 for the steps, the arrows, Space for the button in the bar, Home for the start, Esc to close a list.
7. Once loaded the page needs no network: it talks to no server.

## Talk track

| Step | Do | Say |
|---|---|---|
| 1 The target | Point at the three figures. | "The target: a third fewer reporting duties. At stake: up to €1.51m a year." |
| 2 It reads | Press Next, then open “745 duties”. | "Each count opens what it counts: here every duty, with its sentence." |
| 3 Asked twice | Open “Compare”. | "The same items in both reports; the same businesses are assumed." |
| 4 It prices | Press “Where does this figure come from?”. | "The federal method, step by step. Assumed: all 22,217 file both." |
| 5 You decide | Click Approve merge. | "Only a person approves. Reporting duties cut: 1 of 107." |

To close: "47 more clusters are waiting. The agent finds them, people decide."

## Gesprächsleitfaden

| Schritt | Tun | Sagen |
|---|---|---|
| 1 Das Ziel | Auf die drei Kennzahlen zeigen. | „Ein Drittel weniger Meldepflichten. Es geht um bis zu 1,51 Mio. € im Jahr.“ |
| 2 Er liest | Weiter drücken, dann „745 Pflichten“ öffnen. | „Jede Zahl öffnet, was sie zählt: hier jede Pflicht mit ihrem Satz.“ |
| 3 Doppelt gefragt | „Vergleich“ öffnen. | „Gleiche Angaben, beide Meldungen; dieselben Unternehmen sind angenommen.“ |
| 4 Er bepreist | „Woher kommt diese Zahl?“ drücken. | „Die Methode des Bundes. Angenommen: Alle 22.217 melden doppelt.“ |
| 5 Sie entscheiden | Zusammenlegen freigeben klicken. | „Nur ein Mensch gibt frei. Gestrichene Meldepflichten: 1 von 107.“ |

Zum Schluss: „47 weitere Bündel warten. Der Agent findet sie, Menschen entscheiden.“

## Questions a first look raises

**Is a cluster the same as a law?** No. A law holds duties. A cluster holds duties from at least two laws, or to at least two recipients, that the agent judged to ask the same addressees for overlapping items. The 48 clusters hold 203 of the 745 duties. “48 clusters” in step 3 lists them all, the priced one first.

**How were the 31 laws chosen?** By hand, for this demo: a slice of five topic areas full of business reporting and documentation duties, from statistics to trade regulation. The agent didn't find them; it reads every sentence in them.

**What is the difference between a duty and a reporting duty?** A duty is anything a law makes someone do. A reporting duty is one type of duty: report something to an authority. It is the type the target cuts by a third; 320 of the 745 duties are reporting duties.

**Do the same businesses really file both reports?** That is assumed, not shown. The trade report asks businesses in trade and services; the production report asks producing sites, monthly those with 50 or more persons. Public counts cap the businesses in both at 22,217; the relief assumes all of them, so it reads “up to”. “Compare” shows the law's text.

**Where do the 10 minutes come from, and why 12 after merging?** From the Destatis guide on compliance cost, Annex 4: five simple standard activities, 3 + 2 + 3 + 1 + 1 minutes. A merged report takes longer by the share of items the second report adds, one item of five: 10 + 10 × 1/5 = 12.

**Is this an AI estimate?** No. Engines compute every figure with the federal compliance-cost method; the language model writes no number. “Where does this figure come from?” shows each input, its source and the arithmetic.

## Other questions

**Is this the law in force?** The texts are the consolidated versions from gesetze-im-internet.de as of 19 November 2026, not the official version; the Federal Law Gazette is. The wording in the dossier is a draft for legal drafters and says so.

**Is an AI model called?** Not in this showcase. The agent's run is a replay of a run written by hand for release 1.0.0; the engines computed every figure in it. Release 1.0.0 has a live mode that runs the same agent against a model API.

**What about data protection?** There is no personal data: public law texts, a simulated register, and nothing is sent.

**And the AI Act?** Human oversight is built in: the agent proposes, a person decides and gives a reason, and only an approval reaches the dossier. The check of its risk class is still open.

**Why only one cluster?** It is the most promising of 48. The other 47 are in the list of clusters with their laws, shared items and confidence, each marked “not priced in this run”.

## Fragen beim ersten Hinsehen

**Ist ein Bündel dasselbe wie eine Vorschrift?** Nein. Eine Vorschrift enthält Pflichten. Ein Bündel hält Pflichten aus mindestens zwei Vorschriften oder an mindestens zwei Empfänger, die laut Agent dieselben Adressaten nach überlappenden Angaben fragen. Die 48 Bündel halten 203 der 745 Pflichten. „48 Bündel“ in Schritt 3 listet alle auf, das bepreiste zuerst.

**Wie wurden die 31 Vorschriften ausgewählt?** Von Hand, für diese Demo: ein Ausschnitt aus fünf Themen mit vielen Melde- und Dokumentationspflichten der Wirtschaft, von der Statistik bis zum Gewerberecht. Der Agent hat sie nicht gefunden; er liest jeden Satz darin.

**Was unterscheidet eine Pflicht von einer Meldepflicht?** Eine Pflicht ist alles, was eine Vorschrift jemandem auferlegt. Eine Meldepflicht ist eine Art von Pflicht: einer Behörde etwas melden. Diese Art kürzt das Ziel um ein Drittel; 320 der 745 Pflichten sind Meldepflichten.

**Geben wirklich dieselben Unternehmen beide Meldungen ab?** Das ist angenommen, nicht belegt. Die Handelsmeldung fragt Unternehmen in Handel und Dienstleistungen, die Produktionsmeldung produzierende Betriebe, monatlich die ab 50 tätigen Personen. Amtliche Zählungen begrenzen die Unternehmen in beiden auf 22.217; die Entlastung nimmt alle an und heißt deshalb „bis zu“. „Vergleich“ zeigt den Gesetzestext.

**Woher kommen die 10 Minuten, und warum 12 nach dem Zusammenlegen?** Aus dem Leitfaden von Destatis zum Erfüllungsaufwand, Anhang 4: fünf einfache Standardaktivitäten, 3 + 2 + 3 + 1 + 1 Minuten. Eine zusammengelegte Meldung dauert um den Anteil der Angaben länger, den die zweite hinzufügt: 4 von 5 sind schon gefragt, also 10 + 10 × 1/5 = 12.

**Ist das eine KI-Schätzung?** Nein. Rechenmodule ermitteln jede Zahl nach der Methode des Bundes zum Erfüllungsaufwand; das Sprachmodell schreibt keine Zahl. „Woher kommt diese Zahl?“ zeigt jede Eingabe, ihre Quelle und die Rechnung.

## Weitere Fragen

**Ist das geltendes Recht?** Die Texte sind die konsolidierten Fassungen von gesetze-im-internet.de vom 19. November 2026, nicht amtlich; maßgeblich ist das Bundesgesetzblatt. Der Text im Dossier ist ein Entwurf für die Legistik und als solcher gekennzeichnet.

**Wird ein KI-Modell aufgerufen?** In dieser Vorführung nicht. Der Lauf des Agenten ist ein nachgespielter, von Hand geschriebener Lauf aus Release 1.0.0; jede Zahl darin haben die Rechenmodule berechnet. Release 1.0.0 hat einen Live-Modus, der denselben Agenten mit einer Modell-API betreibt.

**Und der Datenschutz?** Es gibt keine personenbezogenen Daten: öffentliche Gesetzestexte, ein simuliertes Register, und nichts wird versendet.

**Und die KI-Verordnung?** Menschliche Aufsicht ist eingebaut: Der Agent schlägt vor, ein Mensch entscheidet mit Begründung, und nur eine Freigabe gelangt ins Dossier. Die Prüfung der Risikoklasse steht noch aus.

**Warum nur ein Bündel?** Es ist das vielversprechendste von 48. Die anderen 47 stehen in der Liste der Bündel mit ihren Vorschriften, gemeinsamen Angaben und ihrer Sicherheit, jedes als „in diesem Lauf nicht bepreist“.
