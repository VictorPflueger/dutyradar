# Demo script

Five minutes, five steps. The talk track is the same as in the guide's last chapter, How to present (So führen Sie vor).

## Before the talk

1. Open <https://victorpflueger.github.io/dutyradar/> in a new tab: the guide opens by itself. For German, add `?lang=de`.
2. `?guide=present` opens the talk track directly; `?guide=0` skips the guide.
3. Close the guide with Start. Back to the start, the arrow right of the steps, clears a decision.
4. Wherever the page waits, a bar under the story says “Your move” and holds the one button: it runs the agent to the next step and stops there. At the last step the bar asks for your decision.
5. Keys: 1 to 5 for the steps, the arrows, Space for the button in the bar, Home for the start.
6. Once loaded the page needs no network: it talks to no server.

## Talk track

| Step | Do | Say |
|---|---|---|
| 1 The target | Point at the three figures. | "The target is a third fewer reporting duties. Where do we start?" |
| 2 It reads | Press “It reads”, Duties found counts up. | "745 duties in 4,904 sentences, each with its sentence and section." |
| 3 Asked twice | Point at the same sentence in two laws. | "The same data, asked twice: 1.44 million reports a year." |
| 4 It prices | Point at Relief a year. | "One report instead of two saves €4.07m a year. No figure without a source." |
| 5 You decide | Click Approve merge. | "Only a person approves. Reporting duties cut: 1 of 107." |

To close: "47 more clusters are waiting. The agent finds them, people decide."

## Gesprächsleitfaden

| Schritt | Tun | Sagen |
|---|---|---|
| 1 Das Ziel | Auf die drei Kennzahlen zeigen. | „Das Ziel: ein Drittel weniger Meldepflichten. Wo fangen wir an?“ |
| 2 Er liest | „Er liest“ drücken, Gefundene Pflichten zählt hoch. | „745 Pflichten in 4.904 Sätzen, jede mit Satz und Paragraf.“ |
| 3 Doppelt gefragt | Auf denselben Satz in zwei Gesetzen zeigen. | „Dieselben Daten, doppelt gefragt: 1,44 Millionen Meldungen im Jahr.“ |
| 4 Er bepreist | Auf Entlastung pro Jahr zeigen. | „Eine Meldung statt zwei spart 4,07 Mio. € im Jahr. Keine Zahl ohne Quelle.“ |
| 5 Sie entscheiden | Zusammenlegen freigeben klicken. | „Nur ein Mensch gibt frei. Gestrichene Meldepflichten: 1 von 107.“ |

Zum Schluss: „47 weitere Bündel warten. Der Agent findet sie, Menschen entscheiden.“

## Questions and short answers

**Is this the law in force?** The texts are the consolidated versions from gesetze-im-internet.de as of 19 November 2026, not the official version; the Federal Law Gazette is. The wording in the dossier is a draft for legal drafters and says so.

**Where does each number come from?** From deterministic engines, never from a language model. Release 1.0.0's engines computed them with the federal compliance-cost method. The wage rates and minutes come from the Destatis guide; the case numbers are assumed until calibrated. The guide's chapter What is real says which is which.

**Is an AI model called?** Not in this showcase. The agent's run is a replay of a run written by hand for release 1.0.0; the engines computed every figure in it. Release 1.0.0 has a live mode that runs the same agent against a model API.

**What about data protection?** There is no personal data: public law texts, a simulated register, and nothing is sent.

**And the AI Act?** Human oversight is built in: the agent proposes, a person decides with a reason code, and only an approval reaches the dossier. The check of its risk class is still open.

**Why only one cluster?** It is the most promising of 48. The other 47 go the same way.

## Fragen und kurze Antworten

**Ist das geltendes Recht?** Die Texte sind die konsolidierten Fassungen von gesetze-im-internet.de vom 19. November 2026, nicht amtlich; maßgeblich ist das Bundesgesetzblatt. Der Text im Dossier ist ein Entwurf für die Legistik und als solcher gekennzeichnet.

**Woher kommt jede Zahl?** Aus deterministischen Engines, nie aus einem Sprachmodell. Die Engines von Release 1.0.0 haben sie nach der Methode des Bundes zum Erfüllungsaufwand berechnet. Lohnsätze und Minuten stammen aus dem Leitfaden von Destatis; die Fallzahlen sind bis zur Kalibrierung angenommen. Das Kapitel Was echt ist im Leitfaden sagt, was was ist.

**Wird ein KI-Modell aufgerufen?** In dieser Vorführung nicht. Der Lauf des Agenten ist ein nachgespielter, von Hand geschriebener Lauf aus Release 1.0.0; jede Zahl darin haben die Engines berechnet. Release 1.0.0 hat einen Live-Modus, der denselben Agenten mit einer Modell-API betreibt.

**Und der Datenschutz?** Es gibt keine personenbezogenen Daten: öffentliche Gesetzestexte, ein simuliertes Register, und nichts wird versendet.

**Und die KI-Verordnung?** Menschliche Aufsicht ist eingebaut: Der Agent schlägt vor, ein Mensch entscheidet mit Begründungscode, und nur eine Freigabe gelangt ins Dossier. Die Prüfung der Risikoklasse steht noch aus.

**Warum nur ein Bündel?** Es ist das vielversprechendste von 48. Die anderen 47 laufen genauso.
