# Demo script

This is the presenter's guide to Duty Radar: what to prepare, how to check the room's network before a live run, the eight-minute talk track in English and in German, the offline fallback, and short answers to the questions an audience in public administration tends to ask. The figures named below are the ones the bundled data gives (snapshot of 19 November 2026); the screen always shows the engines' current figures, and each one opens "Where does this figure come from?".

## Before the talk

- **Machine.** A current Chrome, Edge, Firefox or Safari. For the offline fallback also Node 22 or later and a checkout of this repository (`npm run serve`, see below); try it once before the day.
- **Screen.** 1920 × 1080 or 1280 × 720 both work; the projector usually prefers the light theme (the moon and sun button in the header switches it). At 1280 × 720 the open drawer leaves the console two or three lines: after the decision, press **Hide** on the drawer bar to give the duty map and the console the full height (the Outbox tab opens it again). Choose the language with **EN | DE** in the header before you start, or open the site with `?lang=de`.
- **The hook.** The intro window ("How it works" / "So funktioniert es") opens by itself on a first visit and asks the question of the talk. To show it again, open the site in a private window, or press **How it works**.
- **Pace.** R1 replays in about four and a half minutes at ×1, plus the time its decision waits for you; the run stands still while a decision is open. ×2 and ×4 shorten the inventory if the room is short of time. Rehearse with `?speed=20`.
- **Live mode** needs an Anthropic API key with credit. It is checked for free (a model list, no model call) before the run starts, stays in this browser tab only and never enters an export, the audit log or a recording. A Live run makes at most 40 model calls and starts no call once it has spent €3 (the call under way can take it a little past); the control bar shows both while it runs.
- **Self-test.** **Assumptions & diagnostics → Run all tests** runs the golden cost cases, the fact auditor's cases and the cluster cases in this browser. All 48 should pass on the machine you present from.
- **After a rehearsal**, **Reset** clears the run; the next one starts clean.

## Checking the venue before Live or Sovereign mode

Simulation loads only the site's own files and calls no API. Live mode reaches `api.anthropic.com` from the browser, Sovereign mode the endpoint configured in `config/sovereign.json` (none in this version). Check on the venue's own network, not on a phone's hotspot, at least half an hour before the talk:

1. Open the site on the venue network, choose R3, press **Start agent → Live**, paste the key and press **Check and start**. The check asks for the list of models, which costs nothing. If it passes, the route through the venue's network and proxy works and the run starts; **Abort** stops it at once, having spent at most its first model call.
2. If the check fails with a network message, the venue's proxy or firewall blocks the API, or inspects TLS in a way the browser refuses. Ask the venue's IT for `api.anthropic.com` on port 443, or stay with Simulation.
3. A live run sends the agent's prompts and excerpts of the law texts to the model provider. Ask the room before you start one; if anyone objects, replay R3 in Simulation instead.
4. **Assumptions & diagnostics → Network & security policy** shows the page's content security policy and checks it against the specification's: the page can reach no host but its own and the model API, which it calls only in Live mode.

## Talk track in English (eight minutes)

| Time | Screen | Do | Say |
| --- | --- | --- | --- |
| 0:00–0:45 | Intro window, start view | Let the intro open; read its question; point at the two gauges at 0 %. Close it with **Got it**, then press **Start agent** and show the three modes | "How many duties do we carry, and which ask twice? The federal PflichtenLichten project wants a third fewer reporting duties and half the documentation duties. Duty Radar looks at a slice of 31 federal laws and asks the same question, with a human deciding every step." |
| 0:45–2:00 | Duty map, console | **Start simulation** with R1. Point at the role strip and the console as the roles take turns; the duty map fills and **Duties inventoried** counts up | "A team of agents reads the law, finds every reporting and documentation duty, and sorts them into six types. The language model classifies; it never writes a number. Every figure you will see comes from a deterministic engine." |
| 2:00–3:00 | Duty map, duty card | Open a cell, for example HdlDlStatG under Reporting. Show the highlighted trigger phrase, the § link and the line under it | "Each duty comes with its evidence: the sentence, the phrase that makes it a duty, and the paragraph on gesetze-im-internet.de. The consolidated text is not the official version; the Federal Law Gazette is, and the card says so." |
| 3:00–4:30 | Duplicates | Open **Duplicates**. The first card is the cluster with the most relief in view, C-046: § 11 HdlDlStatG and § 9 ProdGewStatG | "Here two statistics laws ask the same businesses for the same four data items: employees, sector, turnover and company master data. The register candidate is simulated. The figure is the best option's relief per year, priced with the federal compliance-cost method." |
| 4:30–6:00 | Options & review, console | The run pauses. In the console, show **Unsourced figure blocked**: the drafting agent wrote a bare number, the fact auditor stopped it and the agent re-drafted. Then compare Merge, Register retrieval and Keep. Choose Merge, reason code **Z1 Duplicate collection**, **Approve** (at 1280 × 720 then **Hide**) | "No figure reaches the screen without a source. The agent proposes, the reviewer decides, with a reason code that goes into the audit log. One merge removes one duty and moves the reporting gauge by a fraction of a percent: repealing duties one at a time buys little, which is why the cost of each option matters." |
| 6:00–7:00 | Outbox | Open **Outbox**: the dossier with its totals, citations and the German draft wording. Export **Dossier (Markdown)**. Point at the last line | "The dossier holds only what a person approved, with the figures, the paragraphs and a draft for the legal drafters, marked as a draft. And: Nothing is sent." |
| 7:00–8:00 | Mode dialog, console | With a working network and the room's agreement: choose R3, **Start agent → Live**, and let it run into the questions. Without either: R3 in Simulation at ×4 | "Same engine, any slice: another set of laws takes a configuration, a snapshot and its data files, no new code. In Live mode the same agent runs against Claude; in Sovereign mode against a model on infrastructure you control." |

## Gesprächsleitfaden auf Deutsch (acht Minuten)

| Zeit | Ansicht | Tun | Sagen |
| --- | --- | --- | --- |
| 0:00–0:45 | Einführung, Startansicht | Die Einführung öffnet sich von selbst; ihre Frage vorlesen; auf die beiden Anzeigen bei 0 % zeigen. Mit **Verstanden** schließen, dann **Agent starten** und die drei Modi zeigen | „Wie viele Pflichten tragen wir, und welche sind doppelt? Das Vorhaben PflichtenLichten will ein Drittel der Meldepflichten und die Hälfte der Dokumentationspflichten abbauen. Der Pflichten-Radar stellt dieselbe Frage an einen Ausschnitt aus 31 Bundesgesetzen, und jeden Schritt entscheidet ein Mensch.“ |
| 0:45–2:00 | Pflichten-Landkarte, Konsole | Mit R1 **Simulation starten**. Auf die Rollenleiste und die Konsole zeigen, während die Rollen nacheinander arbeiten; die Landkarte füllt sich, **Pflichten erfasst** zählt hoch | „Ein Team von Agenten liest das Gesetz, findet jede Melde- und Dokumentationspflicht und ordnet sie sechs Arten zu. Das Sprachmodell klassifiziert; eine Zahl schreibt es nie. Jede Zahl, die Sie sehen, kommt aus einer deterministischen Engine.“ |
| 2:00–3:00 | Pflichten-Landkarte, Pflichtkarte | Eine Zelle öffnen, etwa HdlDlStatG unter Meldung. Die hervorgehobene Auslöserphrase, den §-Link und die Zeile darunter zeigen | „Jede Pflicht trägt ihren Beleg: den Satz, die Wendung, die ihn zur Pflicht macht, und den Paragrafen auf gesetze-im-internet.de. Die konsolidierte Fassung ist nicht amtlich; maßgeblich ist das Bundesgesetzblatt, und die Karte sagt das.“ |
| 3:00–4:30 | Dubletten | **Dubletten** öffnen. Die erste Karte ist das Bündel mit der größten möglichen Entlastung, C-046: § 11 HdlDlStatG und § 9 ProdGewStatG | „Hier fragen zwei Statistikgesetze dieselben Unternehmen nach denselben vier Angaben: Beschäftigte, Branche, Umsatz und Unternehmensstammdaten. Der Registerkandidat ist simuliert. Die Zahl ist die Entlastung der besten Option pro Jahr, bepreist nach dem Leitfaden zum Erfüllungsaufwand.“ |
| 4:30–6:00 | Optionen & Prüfung, Konsole | Der Lauf hält an. In der Konsole **Zahl ohne Beleg blockiert** zeigen: Der Entwurfsagent schrieb eine Zahl ohne Beleg, der Faktenprüfer hielt sie an, der Agent entwarf neu. Dann Zusammenführen, Registerabruf und Beibehalten vergleichen. Zusammenführen wählen, Begründung **Z1 Doppelerhebung**, **Freigeben** (bei 1280 × 720 danach **Ausblenden**) | „Keine Zahl erscheint ohne Beleg. Der Agent schlägt vor, die Prüferin entscheidet, mit einem Begründungscode, der ins Protokoll geht. Eine Zusammenführung streicht eine Pflicht und bewegt die Anzeige der Meldepflichten um Bruchteile eines Prozents: Pflichten einzeln zu streichen bringt wenig, darum zählt, was jede Option kostet.“ |
| 6:00–7:00 | Ausgang | **Ausgang** öffnen: das Dossier mit Summen, Fundstellen und dem Entwurfstext. **Dossier (Markdown)** exportieren. Auf die letzte Zeile zeigen | „Ins Dossier kommt nur, was ein Mensch freigegeben hat, mit Zahlen, Paragrafen und einem Entwurf für die Legistik, als Entwurf gekennzeichnet. Und: Nichts wird versendet.“ |
| 7:00–8:00 | Modusauswahl, Konsole | Mit funktionierendem Netz und Zustimmung im Raum: R3 wählen, **Agent starten → Live**, und in die Fragen hineinlaufen lassen. Sonst: R3 als Simulation mit ×4 | „Dieselbe Engine, jeder Ausschnitt: Ein anderer Gesetzesausschnitt braucht eine Konfiguration, einen Abzug und seine Datendateien, keinen neuen Code. Im Live-Modus läuft derselbe Agent mit Claude, im souveränen Modus mit einem Modell auf Infrastruktur, die Sie selbst betreiben.“ |

## Offline fallback

If the network fails or no one wants a live call: R1 in Simulation tells the whole story without the internet, served from the laptop itself, labelled SIMULATION on the badge and in the console throughout.

1. Before the talk, in a checkout of this repository on the presenting laptop: `npm run serve` (it uses `tools/serve.mjs`, no dependency), then open <http://localhost:8080>. Without Node, `python -m http.server 8080` in the same folder does the same.
2. Opening `index.html` straight from disk does not work: browsers do not load the app's modules and data files from a `file://` page, and the loading screen says so.
3. Close other tabs that might reach the network; the page itself reaches no other host in Simulation, and the browser tests prove it with every other host blocked.
4. Run R1, then R3 at ×4 for the closing minute.

## After the talk

- **Outbox** offers four exports: the dossier as Markdown and as HTML (its styles embedded, so it opens anywhere), the audit log as JSON and the duty list as CSV (semicolons and a byte order mark, so German Excel opens it as is). The file names follow the active language.
- Printing the page (Ctrl+P or Cmd+P) prints the relief dossier with the two disclosure lines, without the workspace.
- **Assumptions & diagnostics** shows the run's figures: duplicate data requests found, duties inventoried, minutes per review decision and the acceptance rate of relief options, aggregated over the run and never per person.

## Questions and short answers

**Is this the law in force?** The texts are the consolidated versions of gesetze-im-internet.de as of the snapshot date. They are not the official version; the Federal Law Gazette is authoritative. Every duty card and the start view say so. The amendment wording is a labelled draft for legal drafters, not binding text.

**Where does each number come from?** From deterministic engines working on the bundled data, never from the language model. Every figure opens "Where does this figure come from?" with its label, inputs and sources. Values that no source gives, such as most case numbers, carry the label Assumption with a reason, and can be changed in Assumptions & diagnostics, which recomputes everything and logs the change. The fact auditor blocks any figure the agent writes without a fact behind it. The self-test runs the engine's reference cases in the browser.

**What about data protection?** The prototype holds no personal data: the law texts are public, the complaint signals are invented and labelled synthetic, registers are simulated. Nothing is sent from the outbox. In Simulation the page loads only its own files and calls no API; Live mode talks only to the model API, with the presenter's key, which stays in the browser tab and never enters the audit log or an export.

**Is it sovereign?** The engines, the data and the interface run entirely in the browser. Only the model can be outside: Sovereign mode runs the same agent against any OpenAI-compatible endpoint, for example an open-weight model on infrastructure in Germany. No endpoint is configured in this version, so the mode is shown disabled with its reason.

**What does the AI Act say?** Duty Radar supports a person's decision and decides nothing itself. Every screen says that you are interacting with an AI system, every decision is logged with its reason code, and only a human approval reaches the dossier. TECH_NOTES §14 sets out the check of its risk class, with the Bundesnetzagentur's risk-class tool.

**Does it connect to administrative systems?** No. No register, data-exchange network or administrative system is called; register availability is simulated.

**How reliable is the duty finding?** On a hand-labelled gold set of 60 sentences the pattern stage finds all 40 duties. The precision after classification needs a live run and is listed in the README when measured.

## Fragen und kurze Antworten

**Ist das geltendes Recht?** Die Texte sind die konsolidierten Fassungen von gesetze-im-internet.de zum Stichtag des Abzugs. Sie sind nicht amtlich; maßgeblich ist das Bundesgesetzblatt. Jede Pflichtkarte und die Startansicht sagen das. Der Änderungstext ist ein gekennzeichneter Entwurf für die Legistik, kein verbindlicher Text.

**Woher kommt jede Zahl?** Aus deterministischen Engines auf den gebündelten Daten, nie aus dem Sprachmodell. Jede Zahl öffnet „Woher kommt diese Zahl?“ mit Bezeichnung, Eingaben und Quellen. Werte ohne Quelle, etwa die meisten Fallzahlen, tragen das Etikett Annahme mit Begründung und lassen sich unter Annahmen & Diagnose ändern; dann wird alles neu berechnet und die Änderung protokolliert. Der Faktenprüfer blockiert jede Zahl, die der Agent ohne Beleg schreibt. Der Selbsttest führt die Referenzfälle der Engine im Browser aus.

**Und der Datenschutz?** Der Prototyp enthält keine personenbezogenen Daten: Die Gesetzestexte sind öffentlich, die Beschwerden erfunden und als synthetisch gekennzeichnet, die Register simuliert. Aus dem Ausgang wird nichts versendet. Die Simulation lädt nur die eigenen Dateien der Seite und ruft keine API auf; der Live-Modus spricht nur mit der Modell-API, mit dem Schlüssel der vortragenden Person, der im Browser-Tab bleibt und nie ins Protokoll oder einen Export gelangt.

**Ist das souverän?** Engines, Daten und Oberfläche laufen vollständig im Browser. Nur das Modell kann außerhalb liegen: Der souveräne Modus betreibt denselben Agenten mit jedem OpenAI-kompatiblen Endpunkt, etwa einem Open-Weight-Modell auf Infrastruktur in Deutschland. In dieser Version ist kein Endpunkt konfiguriert; der Modus ist mit seinem Grund deaktiviert.

**Was sagt die KI-Verordnung?** Der Pflichten-Radar unterstützt die Entscheidung eines Menschen und entscheidet selbst nichts. Jede Ansicht sagt, dass Sie mit einem KI-System interagieren, jede Entscheidung wird mit Begründungscode protokolliert, und nur eine menschliche Freigabe gelangt ins Dossier. TECH_NOTES §14 hält die Prüfung der Risikoklasse fest, mit dem Werkzeug der Bundesnetzagentur.

**Ist das an Verwaltungssysteme angebunden?** Nein. Kein Register, kein Datenaustauschnetz und kein Verwaltungssystem wird aufgerufen; die Verfügbarkeit von Registern ist simuliert.

**Wie verlässlich findet er Pflichten?** Auf einem von Hand gekennzeichneten Goldstandard von 60 Sätzen findet die Musterstufe alle 40 Pflichten. Die Präzision nach der Klassifikation braucht einen Live-Lauf und steht nach der Messung in der README.
