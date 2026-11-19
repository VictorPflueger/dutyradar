// Unit suite (no browser): the language files (AC-15's parity and copy tables, run from M1) and the
// ICU data that display strings depend on (AC-01's formatting).
// Usage: node tests/unit.mjs [i18n] [icu]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL ${label}${detail ? `\n  - ${detail}` : ""}`); } };
const tokens = [];

/**
 * The specification's German copy table and the brief's English strings (section 5.3), exactly:
 * [key, German, English]. app.subtitle reads "Find, cluster and price duties" in English (brief 5.3).
 */
const EXACT = [
  ["app.name", "Pflichten-Radar", "Duty Radar"],
  ["app.subtitle", "Pflichten finden, bündeln, bepreisen", "Find, cluster and price duties"],
  ["disclosure.ai", "Sie interagieren mit einem KI-System.", "You are interacting with an AI system."],
  ["disclosure.proto", "Prototyp – kein offizielles Angebot der Bundesregierung", "Prototype – not an official federal government service"],
  ["mode.simulation", "SIMULATION", "SIMULATION"],
  ["mode.live", "LIVE", "LIVE"],
  ["mode.sovereign", "SOUVERÄN", "SOVEREIGN"],
  ["start.question", "Wie viele Pflichten tragen wir, und welche sind doppelt?", "How many duties do we carry, and which ask twice?"],
  ["start.button", "Analyse starten", "Start analysis"],
  ["cite.notice", "Konsolidierte Fassung, nicht amtlich. Maßgeblich ist das Bundesgesetzblatt.", "Consolidated text, not official. The Federal Law Gazette is authoritative."],
  ["options.keep", "Beibehalten", "Keep"],
  ["options.approve", "Freigeben", "Approve"],
  ["options.reject", "Ablehnen", "Reject"],
  ["options.info", "Rückfrage", "Ask for information"],
  ["audit.blocked", "Zahl ohne Beleg blockiert", "Unsourced figure blocked"],
  ["outbox.title", "Entlastungsdossier (Entwurf)", "Relief dossier (draft)"],
  ["outbox.notice", "Nichts wird versendet.", "Nothing is sent."],
  ["badge.assumption", "Annahme", "Assumption"],
  ["badge.synthetic", "synthetisch", "synthetic"],
  ["badge.simulated", "simuliert", "simulated"],
  ["badge.eu", "EU-Bezug", "EU-related"],
  ["badge.protected", "Schutzstandard", "Protected standard"],
  ["kpi.estimate", "Schätzung", "Estimate"],
  ["kpi.slice_note", "Ausschnitt, nicht das bundesweite Ziel", "Slice only, not the national target"],
  ["dossier.kept", "Beibehaltene Pflichten (mit Begründung)", "Kept duties (with justification)"],
  ["screen.start", "Start", "Start"],
  ["screen.dutymap", "Pflichten-Landkarte", "Duty map"],
  ["screen.duplicates", "Dubletten", "Duplicates"],
  ["screen.options", "Optionen & Prüfung", "Options & review"],
  ["screen.outbox", "Ausgang", "Outbox"],
  ["screen.diagnostics", "Annahmen & Diagnose", "Assumptions & diagnostics"],
  ["kpi.duties", "Pflichten erfasst", "Duties inventoried"],
  ["kpi.reporting", "Meldepflichten im Ausschnitt (Richtwert −⅓)", "Reporting duties in the slice (benchmark −⅓)"],
  ["kpi.documentation", "Dokumentationspflichten im Ausschnitt (Richtwert −½)", "Documentation duties in the slice (benchmark −½)"],
  ["kpi.cost", "Erfüllungsaufwand adressiert (Schätzung)", "Compliance cost addressed (estimate)"],
  ["cluster.confirm", "Bündel bestätigen", "Confirm cluster"],
  ["cluster.split", "Aufteilen", "Split"],
  ["fact.where", "Woher kommt diese Zahl?", "Where does this figure come from?"],
  ["sim.preset", "In der Simulation vorgegeben", "Set by the simulation"],
  ["selftest.run", "Alle Tests ausführen", "Run all tests"],
  ["options.target_decided", "Ziel entschieden", "Target decided"],
  ["dossier.kept_short", "Beibehaltene Pflichten", "Kept duties"],
  ["audit.manual", "manuelle Bearbeitung", "Needs manual editing"],
  ["audit.text_blocked", "Text blockiert", "Text blocked"],
  ["fact.retired", "entfallen", "no longer applies"],
  ["key.rejected", "Schlüssel ungültig", "Key rejected"],
  ["key.forget", "Schlüssel löschen", "Forget key"],
  ["record.run", "Lauf aufzeichnen", "Record run"],
  ["sovereign.none", "Kein souveräner Endpunkt konfiguriert", "No sovereign endpoint configured"],
  ["slice.provisional", "vorläufig", "provisional"],
  ["run.handwritten", "handgeschrieben", "hand-authored"],
  ["reviewer.role", "Referentin (Demo)", "Desk officer (demo)"],
  ["warning.params_mismatch", "Abweichung zwischen Klassifikation und Parametern", "Classification and parameters disagree"],
  ["assumption.working_days", "Annahme: Arbeitstage", "Assumption: working days"],
  ["note.assumption_no_known_user", "Annahme: kein Nutzer bekannt", "Assumption: no known user"],
  ["risk.eu_frequency_check", "Turnus gegen EU-Vorgabe prüfen", "Check the frequency against the EU requirement"],
  ["risk.register_currency", "Das Register muss die Daten in der benötigten Aktualität führen", "The register must hold the data as up to date as needed"],
  ["reason.no_register", "Kein Register deckt die Daten ab", "No register covers the data"],
  ["reason.no_cluster", "Kein Bündel", "No cluster"],
  ["reason.members_differ", "Turnus oder Population verschieden", "Frequency or population differs"],
  ["reason.single_duties_only", "Nur für einzelne Pflichten", "Single duties only"],
  ["reason.protected_standard", "Schutzstandard bleibt unangetastet", "Protected standards stay untouched"],
  ["reason.not_periodic", "Nicht periodisch", "Not periodic"],
  ["reason.less_than_quarterly", "Seltener als vierteljährlich", "Less often than quarterly"],
  ["reason.eu_related", "EU-Bezug: nur nationale Zusätze streichbar", "EU-related: only national additions can be deleted"],
  ["reason.data_use_known", "Datennutzung bekannt", "Data use known"],
  ["code.Z1", "Doppelerhebung", "Duplicate collection"],
  ["code.Z2", "Register verfügbar", "Register available"],
  ["code.Z3", "Kein erkennbarer Nutzen", "No known use"],
  ["code.Z4", "Turnus überhöht", "Frequency too high"],
  ["code.Z5", "Sonstiges", "Other"],
  ["code.A1", "EU-rechtlich vorgegeben", "Required by EU law"],
  ["code.A2", "Höherrangiges Recht", "Higher-ranking law"],
  ["code.A3", "Fachlich notwendig", "Needed for the department's task"],
  ["code.A4", "Daten nicht im Register", "Data not in the register"],
  ["code.A5", "Weitere Prüfung nötig", "Needs further review"],
  ["code.A6", "Sonstiges", "Other"],
  ["code.I1", "Rückfrage an Fachreferat", "Question to the specialist unit"]
];

if (want("i18n")) {
  const en = JSON.parse(readFileSync(path.join(ROOT, "js/i18n/en.json"), "utf8"));
  const de = JSON.parse(readFileSync(path.join(ROOT, "js/i18n/de.json"), "utf8"));
  const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const fe = new Map(flat(en));
  const fd = new Map(flat(de));
  const onlyEn = [...fe.keys()].filter((k) => !fd.has(k));
  const onlyDe = [...fd.keys()].filter((k) => !fe.has(k));
  check("en.json and de.json have identical keys", !onlyEn.length && !onlyDe.length, `only in en: ${onlyEn.join(", ")}; only in de: ${onlyDe.join(", ")}`);
  for (const [lang, m] of [["en", fe], ["de", fd]]) {
    const bad = [...m].filter(([, v]) => typeof v !== "string" || !v.trim()).map(([k]) => k);
    check(`${lang}.json has no empty or non-text values`, !bad.length, bad.join(", "));
  }
  for (const [key, deText, enText] of EXACT) {
    check(`${key} (de) is the specification's string`, fd.get(key) === deText, `expected "${deText}", got "${fd.get(key)}"`);
    check(`${key} (en) is the brief's string`, fe.get(key) === enText, `expected "${enText}", got "${fe.get(key)}"`);
  }
  check("app.subtitle reads as the brief changes it", fe.get("app.subtitle") === "Find, cluster and price duties");
  check("the product name per language", fe.get("app.name") === "Duty Radar" && fd.get("app.name") === "Pflichten-Radar");
  const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  const mismatched = [...fe.keys()].filter((k) => fd.has(k) && placeholders(fe.get(k)) !== placeholders(fd.get(k)));
  check("placeholders match between the languages", !mismatched.length, mismatched.join(", "));
  tokens.push("I18N STRINGS OK");
}

if (want("icu")) {
  check("de-DE groups with periods", new Intl.NumberFormat("de-DE").format(1220000) === "1.220.000", new Intl.NumberFormat("de-DE").format(1220000));
  check("en-GB groups with commas", new Intl.NumberFormat("en-GB").format(1220000) === "1,220,000", new Intl.NumberFormat("en-GB").format(1220000));
  tokens.push("ICU OK");
}

if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`${tokens.join(", ")} (${checks} checks)`);
