---
name: datenlaeufe-entwerfen
description: "Beim Entwerfen, Ändern oder Prüfen von CI-Datenläufen (GitHub Actions, Cron, PR-Abgabe) und vor jedem Push nach .github/workflows/."
---

# Datenläufe entwerfen und ändern

Entstanden am 05.10.2026 aus einer Vollprüfung der Läufe von anime-kalender-de (Messwerte und Fälle: `docs/wissen/betrieb.md`, Abschnitt „Datenläufe neu geschnitten").

## Das Zielbild

1. **Sammeln und Liefern trennen.** Ein Sammler holt, ein anderer Lauf baut. Der Sammler schreibt nie auf `main`, er reicht ein (Pull Request).
2. **Jede Tatsache hat einen Schreiber.** Zwei Läufe an einer Datei sind ein Konflikt, der noch nicht passiert ist. Gemeinsame Zustandsdateien werden je Schlüssel zusammengeführt
   (`source-health.json`: der jüngere Eintrag), nicht als Text.
3. **Nur zurücklegen, was man selbst geändert hat.** Wer beim Aufsetzen auf den Fernstand alle Quellen rettet, überschreibt, was ein anderer inzwischen aktualisierte. Die Gruppe, die
   „alle Datenläufe hintereinander" hielt, war die Folge davon — und kostete Stunden.
4. **Gruppiert wird nach Server und nach Abhängigkeit.** Eine Drosselung („6 Sekunden je Seite") ist eine Sperre, keine Uhrzeit; sie gilt über Workflows hinweg (Job-Gruppe). Schritte, deren
   Eingabe ein anderer schreibt, bleiben in einem Job in dieser Reihenfolge; alles andere läuft nebeneinander.
5. **Der Zeitplan kommt von einer pünktlichen Uhr.** GitHubs Cron kam gemessen 4–7 Stunden zu spät. Eine zweite, unabhängige Linie (Wache) holt Überfälliges nach.

## Die Lieferung ist der gefährlichste Schritt

Alles vor ihr lässt sich wiederholen — sie nicht. Ein Sammler braucht drei Dinge **bevor** er sich für fertig hält:
**Sicherung** (geänderte Dateien als Artefakt, bevor eingereicht wird), **Wiederholung** (mehrere Versuche, jeder auf dem frischen Stand) und einen Weg, **Gesichertes nachzuliefern**.
Dazu steht das Einreichen mit `if: always()` am Ende **jedes** Jobs: Ein hängender Schritt kostet nur sich selbst.
**Prüfschritt vor dem Commit eines Bestandslaufs (PR 1932, 24.10.2026):** Er blockiert auch bei Rot, das nicht vom Bestand kommt (z. B. Fehler in `extension/` auf main). Die PR-Beschreibung nennt dieses Risiko und den Alarm, der es auffängt (`bestand-rot-alarm`).

## Sichtbarkeit

- `continue-on-error` allein macht Fehlschläge zu grünen Haken. Schritte laufen über einen Rahmen (`tools/schritt.sh`): Zeitgrenze, Anmerkung, Zusammenfassung, gelbe Meldung.
- **Was ein Lauf schreibt, muss in einer Liste stehen, die geliefert wird.** Prüfung zur Laufzeit (`quellen_verloren`), nicht nur beim Einrichten: Zwei Ausgaben gingen wochenlang verloren, weil sie fehlten.
- Ein Alter, das im Dateisystem steht, ist in der CI keins (Checkout setzt alle Zeiten). Alter gehört ins Repo.

## Vor jedem Push nach `.github/workflows/`

1. Ein laufender Sammler hindert den Push nicht mehr: sein Zweig-Push läuft mit dem App-Token samt Recht `workflows` (Beleg 12.11.2026, betrieb.md „Workflow-Sperre“). Ausnahme bleibt `claude-daten-merge.yml` (Konfliktauflösung, Push mit dem Claude-Token): dort vorher `node tools/sammler-laeuft.mjs` (Exit 0 = kein Sammler läuft).
2. `npm run check:workflows` **und** `npm run typecheck` (Wurzel). Ein Test, der den Worker importiert, bricht den Wurzel-Typecheck (Deploy zweimal rot).
3. Nach dem Push einen Testlauf der kleinsten Variante (`workflow_dispatch`) und das Protokoll lesen, nicht nur die Farbe.

## Messen vor dem Umbauen

`gh api repos/<r>/actions/workflows/<w>/runs` liefert Erstellungs-, Start- und Endzeit; `.../runs/<id>/jobs` die Schrittzeiten. Daraus: Verzögerung gegen den Plan, Wartezeit in der Gruppe, abgebrochene
Läufe samt dem, was gerade lief, und die längsten Schritte. Erst dann entscheiden — und die Messung ins Betriebswissen schreiben, mit Datum.

## Auslöser streichen: Bedingungen am Ereignis mitziehen (25.10.2026)

Wer `schedule` (oder einen anderen Auslöser) streicht oder ersetzt, sucht alle `github.event_name`-Bedingungen im Workflow ab. Im Nativ-Repo hing die Regel „gleicher Stand, kein Bau“ am `schedule`-Ereignis; nach dem Wechsel auf den Wecker-Dispatch hätte jede Stunde ein voller Bau samt Deploy gestartet.

## Takt eines Sammlers erhöhen: gemeinsame Dateien und Statusanzeige zuerst (27.10.2026)

Wer einen Sammler in einen häufigeren Lauf hebt (PR 2186, CR-Neu stündlich), listet **vor** dem PR jede Datei, die danach zwei Läufe schreiben (`tools/quellen-pr.sh`: wer gewinnt bei Überschneidung?), und was ein Scheitern des neuen Schritts in der Statusanzeige auslöst (`lauf-abmelden.sh`, eigener `$MELDER fehler`). Beides fand sonst erst der Prüfer (A2/A3). Eine Erhöhung gegen einen Dienst mit Nutzungsverbot ist Daniels Entscheidung (F90), nicht die des Dirigenten.

## Beleglauf vom Zweig (`--ref`): was vom Zweig kommt, entscheidet der Checkout (10.11.2026)
`gh workflow run <datei> --ref <zweig>` nimmt das Workflow-YAML vom Zweig. Skripte kommen nur dann auch vom Zweig, wenn `actions/checkout` ohne `ref` auscheckt (z. B. `d1-verbrauch.yml`); die Sammler checken mit `ref: main` aus, dort belegt so ein Lauf Skriptänderungen erst nach dem Merge (vorher Prozesstest). Vor dem Beleglauf den Checkout im YAML nachsehen. Er reicht echte Daten-PRs ein, und der Sammler mergt die grünen selbst: das im Auftrag einplanen (PR 3282).
