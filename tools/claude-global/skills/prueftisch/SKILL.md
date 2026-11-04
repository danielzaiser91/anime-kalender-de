---
name: prueftisch
description: "Dauerauftrag: nebenbei und an Terminen Architektur, Workflows, Code, Skills und Regeln auf Schwachstellen prüfen. Lesen beim autonomen Modus und wenn Daniel eine Schwachstelle selbst fand."
---

# Prüftisch: Schwachstellen finden, bevor Daniel sie findet

Daniel, 16.10.2026: „solche improvements in zukunft selbstständig machen … prinzipiell alles
kann und sollte beobachtet und stetig verbessert werden“ — und: „ich will in zukunft solche
schwachstellen nicht mehr selber finden und anmeckern müssen“.

**Maßstab:** Jede Schwachstelle, die Daniel selbst meldet, ist ein Fehlschlag des Prüftischs
und bekommt neben den fünf Stufen (Skill `korrektur-schaerft-die-regel`) eine sechste Frage:
*Welcher Prüftisch-Bereich hätte das finden müssen, und warum nicht?* Die Antwort schärft
diese Datei (Bereich, Messgröße oder Rhythmus).

## Nebenbei beobachten — bei jeder Arbeit, nicht nur am Termin

Daniel, 19.10.2026: „sowas selbst beobachten und selbst solche vorschläge machen, ohne dass ich das
anmerken muss … performance, stabilität, effizienz, ideen“. Anlass: Er sah im Task-Manager 2 GB
Node-Last der Bauer auf seinem PC, bevor ich es tat. Die Termine unten fangen Trends; das hier fängt
das, was gerade vor Augen liegt.

**Wer:** ich und jeder Agent (Bauer, Prüfer, Analyst). Agenten bringen ihre Funde als „Vorschlag“
im Rückblick mit, **auch außerhalb des Auftrags**.

**Wann:** in jeder Wachphase, bei jedem Bericht, bei jeder Ausgabe, die ich ohnehin lese
(Laufzeiten, Logs, `gh pr checks`, Prozesse), und bei jeder Nachricht von Daniel. Daniels
Nachricht verrät oft, was ihn stört, auch wenn er nicht fragt.

**Liegegut (Daniel, 21.10.2026: „top prio punkte stehen gefühlt seit tagen auf queue“):** In jeder
Wachphase zwei Fragen: Hat eine Top-Prio-Zeile in `stand.md` einen Stand älter als 24 h? Liegt ein
offener PR mit Prüfer-Urteil „ändern“ oder Konflikt länger als 24 h ohne Besitzer? Beides bekommt
in derselben Wachphase einen Besitzer oder einen neuen Stand mit Datum. Anlass: PR 1454, 1403, 1394
lagen 4–5 Tage, während die Merge-Reihe nur „ok“-PRs sah.

**Linsen.** An jeder Stelle stelle ich kurz die fünf Fragen:

| Linse | Frage | Typische Signale |
|---|---|---|
| Performance | Was ist langsam oder schwer, und für wen? | Laufzeit über der Erwartung, Warten auf CI/Deploy, Last auf Daniels Rechner (CPU, RAM, Lüfter), Tokens je Ergebnis, Seitengewicht/Ladezeit live |
| Stabilität | Was bricht zufällig oder ganz? | Flakes, uhrzeit- oder reihenfolgeabhängige Tests, main rot, wiederholte Neustarts, Sperren und Kontingente |
| Effizienz | Was wird doppelt oder von Hand getan? | gleicher Fehler 2×, gleicher Handgriff 3×, Agenten warten aufeinander, Prüfung ohne neue Aussage (z. B. lokal, was die CI ohnehin fährt) |
| Last-Ort | Läuft es dort, wo es am wenigsten stört? | Schweres auf Daniels PC statt in Actions/Cloudflare, Abrufe von Daniels IP, Arbeit im Vordergrund |
| Ideen | Was brächte dem Projektziel oder Daniel mehr? | Lücke im Bestand, Nutzerwunsch zwischen den Zeilen, Werkzeug, das es anderswo schon gibt |

**Ein Signal wird zum Vorschlag**, wenn es messbar ist oder sich wiederholt. Der Vorschlag hat eine
Zeile: Befund mit Zahl, Vorschlag samt Untergrenze, Nutzen und Kosten.

**Entscheiden statt sammeln.** Jeder Vorschlag, von mir oder einem Agenten, bekommt im selben Zug
eine von drei Entscheidungen:
- **umsetzen:** sofort, wenn klein, sonst als Auftrag an einen Bauer;
- **„Als Nächstes“** in `stand.md`, mit Priorität;
- **verworfen**, mit Grund als Zeile in `lehren.md`.

Nur Geld, Außenwirkung, schwer Umkehrbares und die Umkehr einer Daniel-Entscheidung werden eine
F-Zeile. Ein Vorschlag ohne Entscheidung ist ein Fehler wie ein Bericht ohne Nachprüfung.

**Gegenprobe wöchentlich (montags, mit den Daniel-Funden):** Ich zähle die eigenen Vorschläge
(umgesetzt, verworfen) und die Daniel-Funde, die eine Linse hätte fangen müssen. Ziel: Die eigenen
Vorschläge steigen, die Daniel-Funde sinken.

## Rhythmus (fest, nicht nach Gefühl)

- **Täglich, erste Wachphase des autonomen Modus:** ein Bereich aus der Rotation unten an einen
  Analysten (Sonnet, Bericht nach `daniel-zum-abarbeiten/berichte/prueftisch-<bereich>-<datum>.md`).
  Welcher Bereich dran ist, steht im Protokoll unten (ältester zuerst).
- **Bei jedem Daniel-Fund sofort:** der zuständige Bereich außer der Reihe.
- **Wöchentlich (montags):** die Daniel-Funde der Woche zählen (Transkripte/`lehren.md`). Ziel ist
  null; steigt die Zahl, ist der Rhythmus zu dünn.

## Bereiche (Rotation)

| Bereich | Messgröße (gemessen, nicht geschätzt) |
|---|---|
| Daniel-Funde | Was hat Daniel in 7 Tagen gemeldet, das ein Mechanismus hätte fangen können? |
| Durchlaufzeit | Auftrag → live, PR → Merge, CI-Dauer, Deploy-Dauer (Median, p90) |
| Prüfung | Prüfer-Runden je PR, Befunde, die erst Runde 2+ fand, Mutationen, die überleben |
| Delegation | Agenten-Leerlauf, Doppelarbeit, Berichte ohne Beleg, Tokens je Ergebnis |
| Priorisierung | Wie lange lagen Top-Prios ohne Agenten? Was lag in „Als Nächstes“ > 3 Tage? |
| Code | `check:umfang`, Dateien > 800 / Funktionen > 80 Zeilen, tote Pfade, doppelte Helfer |
| Daten | Unzuordenbares, Lücken, Widersprüche je Quelle — Trend gegen Vorwoche |
| Tooling & Läufe | rote/abgebrochene Läufe, Flakes, Kontingente (D1, API) |
| Ressourcen & Last-Ort | Last auf Daniels PC je Agent (`prozess-inventur/inventur.mjs --alle`: Node-RAM/CPU), was davon in Actions laufen könnte, Tokens je Auftrag, Actions-Dauer |
| Skills & Regeln | Widersprüche, Doppelungen, Veraltetes, Regeln ohne Wächter, Lücken in `lehren.md` (Tage mit Daniel-Fund ohne Lehre) |
| Oberfläche, Mobil & Erweiterung | Trefferprobe (`elementFromPoint`) aller sichtbaren Links/Knöpfe, Überlappung, Lesbarkeit bei 360 px und beiden Themen, Stiländerung der Gastseite durch die Erweiterung |

**Dichte (ab 16.10.2026):** Funde wiederholen sich binnen 4 Tagen, eine Runde über 10 Bereiche
dauert 10 — darum täglich **zwei** Termine: der älteste Bereich der Rotation **und** die Klasse mit
den meisten Daniel-Funden ohne Wächter. Ausgangswert Daniel-Funde 09.–16.10.: **59** (Oberfläche 21,
Daten 18, Workflow/CI 12, Rest 8); Wochenzahl im Protokoll fortschreiben.

## Ablauf je Termin

1. Analyst misst die Messgröße, vergleicht mit dem letzten Bericht desselben Bereichs, nennt die
   drei größten Schwachstellen mit Beleg und je einen Vorschlag samt Untergrenze.
2. Ich entscheide selbst (Rahmen: Regel „Selbstständig aufs Projektziel hinarbeiten“) und setze
   um — Bauer-Auftrag, Skill- oder Regel-Schärfung; nur Geld, Außenwirkung, schwer Umkehrbares
   oder eine Umkehr einer Daniel-Entscheidung kommen als F-Zeile nach `stand.md`.
3. Jede Umsetzung wird mehrstufig beobachtet (sofort, ~5 Fälle, Tag, Woche).
4. Eine Zeile ins Protokoll unten: Datum, Bereich, Befund, Maßnahme.
5. Vorschlags-Ledger (seit 01.11.2026, PR 2611): im Hauptordner von anime-kalender-de
   `node tools/vorschlags-ledger.mjs` laufen lassen; neue Zeilen in
   `daniel-zum-abarbeiten/listen/vorschlaege-offen.md` je Zeile mit „verankern“ (Lehre an der
   passenden Stelle) oder „verwerfen“ (Grund) abschließen. Stichwortabgleich ist grob; Schwelle
   70 % am 08.11. gegen echte Treffer nachmessen.

## Protokoll

- 16.10.2026, Durchlaufzeit (angestoßen durch Daniel): Auftrag→live Median 74 min → Vorprüfung,
  Deploy-Abbruch-Fix, Prüfkette parallel, Deploy aus geprüftem Build.
- 16.10.2026, Daniel-Funde: 59 Funde in 7 Tagen, 30 ohne Wächter ([Bericht](../../../../code/ai/anime-kalender-de/daniel-zum-abarbeiten/berichte/prueftisch-daniel-funde-2026-10-16.md)).
  Maßnahmen: Kalender-Plausibilitätsprüfung (nur sinkender Zähler), Trefferprobe auf alle Links/Knöpfe
  und den Erweiterungskasten, Prüfer-Vorgaben „Screenshot mobil bei web/src“ und „Mod/Hook/Workflow
  braucht Test“, Bereich Oberfläche ergänzt, zwei Termine je Tag.
- 16.10.2026, Durchlaufzeit (eigener Fund): drei PRs (1345, 1348, 1352) hängen am selben Textkonflikt
  in `.github/workflows/pr-pruefer.yml`, weil jede Prüfer-Vorgabe ans selbe Prompt-Ende angehängt
  wird. Maßnahme offen: Vorgaben als eigene Dateien außerhalb von `workflows/` (eine je Vorgabe,
  vom Workflow eingelesen) — beseitigt Konflikte und die Workflow-Sperre während Sammelläufen.
- 16.10.2026, Prüfung (eigener Fund): Der CI-Prüfer gab die parallele Kette frei, obwohl der
  Cache-Schlüssel den Lock-Abgleich von `npm ci` verschluckte und acht Workflow-Mutationen grün
  blieben; erst der Agent-Prüfer fand das. Maßnahme: Vorgabe in `agents/pruefer.md` (Cache ersetzt
  Prüfung; YAML-Mutationen). Bei CI-Freigaben für Workflows und Tooling bleibt der Agent-Prüfer Pflicht.
- 18.10.2026, Delegation (Daniel-Fund): Opus-Agenten ohne `effort` erbten `medium` aus der
  Frontmatter; die Skill-Zeile „effort immer mitgeben“ war Vorsatz. Maßnahme: Hook
  `agenten-grenze.js` lehnt Opus ohne `effort` ab (getestet), beide Agenten mit high neu gestartet.
- 19.10.2026, Ressourcen (Daniel-Fund): 2,1 GB Node und 20 % CPU auf Daniels PC durch lokale
  `check:logic --alle` und Mutationsproben der Bauer. Keiner der Bereiche hatte den Last-Ort im Blick.
  Maßnahmen: F40 (schwere Prüfungen in die PR-Kette), Bereich „Ressourcen & Last-Ort“, Abschnitt
  „Nebenbei beobachten“ mit Linsen für mich und alle Agenten.
- 19.10.2026, Tooling & Läufe (eigener Termin, Anlass Verklemmung): vier main-weite Ursachen, jede
  Fix-PR an der Pflicht-Kette der anderen gescheitert; Bestandsbau 26 % der Woche rot, 13 h ohne
  Deploy, 0 Flakes. Ursache: Bestandsprüfungen laufen erst nach dem Merge, kein zeitgesteuerter
  Wächter. Maßnahmen: PR 1386 fertig, Listenprüfung vor dem Bau-Commit, Wächter in
  `wecker-wache.yml` (stand.md „Als Nächstes“ 🔴); Ausnahmeliste „bekannt rot“ verworfen.

- 21.10.2026, Code (Termin): check:umfang grün, Überlänge pipeline 13.239 → 9.425 seit 26.09.; Funde: 62× „heute“ in UTC trotz Zeitzonenregel (kein Wächter), ~27 lokale `norm`, 12 tote Exporte. Maßnahmen: Bauer Wächter + Umstellung auf `todayIso()`, Rest „Als Nächstes“.
