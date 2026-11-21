# Laufzeiten PR-Kette und Deploy, 14.–21.11.2026 (Analyse, kein Umbau)

Quelle: Actions-REST-API (`actions/workflows/<datei>/runs`, `actions/runs/<id>/jobs`), Stand 21.11.2026 01:30 UTC.
Jede Dauer ist die Differenz zweier Zeitstempel (Lauf: `run_started_at` → `updated_at`; Job und Schritt: `started_at` → `completed_at`).
Mess-Skripte lagen im Scratchpad, nicht im Repo.

## Ergebnis gegen das Ziel

| | Median | p90 | Ziel | Stand |
|---|---|---|---|---|
| Kette je PR, letzter grüner Lauf, alle (n=321 PRs) | 8,8 min | 19,1 min | < 10 min | Median erreicht, p90 nicht |
| … seit der schlanken Kette (18.11. 12:00, n=107) | 9,4 min | 20,1 min | | gleich |
| Kette ohne Oberflächen-Änderung (Stichprobe 39 von 50 Läufen) | 5,2 min | max 9,5 | | **Ziel erreicht** |
| Kette mit PR-Aussehen (Stichprobe 11 von 50 Läufen) | 17,9 min | max 34,2 | | **Ziel verfehlt** |
| Deploy: Lauf-Start → Seite live (`deploy_hart` fertig, Stichprobe 25 Läufe) | 7,3 min | max 8,9 | < 5 min | verfehlt |
| Deploy: ganzer Lauf bis `abschluss` (dieselben 25) | 10,8 min | max 14,7 | | |
| Deploy, Gesamtlauf aller 415 grünen Läufe: vor / seit 18.11. 12:00 | 17,5 / 11,2 min | 29,2 / 15,2 | | Der Umbau vom 18.11. wirkt |
| Bestandsbau (Daten-Commits, n=281) | 13,1 min | 24,3 | | geht dem Deploy voraus |
| CI-Prüfer (n=653) | 2,1 min | 5,8 | | kein Posten |

„Push → live“ für einen Code-Push auf main: Deploy-Wartezeit ist 0 (Lauf-Start = Erstellung, n=415, max 0,0 min), also gilt die Zeile „Start → live“, **Median 7,3 min**. Für Daten-Pushes kommt der Bestandsbau davor (Summe der Mediane ≈ 13 + 7 = 20 min; nicht als ein Lauf gemessen, die Verknüpfung über `head_sha` gelang nur in 3 Fällen).

Beobachtung ohne Ursache: Tagesmedian der Kette 8,7–8,8 min am 15.–18.11., aber 12,3 (14.11.) und 12,4 (20.11., p90 26,2). Nicht untersucht, ob Runner-Last oder Aussehens-Anteil.

Durchsatz: 323 PRs (ohne `daten/`), im Median 2 Kettenläufe je PR, bis 16. 347 Läufe wurden durch einen neuen Push abgebrochen (1436 Läufer-Minuten bis zum Abbruch), 624 grüne Vollläufe kosteten 7654 Läufer-Minuten.

## Größte Posten Kette (Stichprobe 50 grüne Läufe seit 19.11.)

Der Kern ist unter 10 min, weil die Jobs parallel laufen; der längste Kernjob bestimmt die Zeit. Die Aussehens-Jobs laufen im selben Workflow und hängen am Sammeljob `PR-Prüfkette`.

| Posten | Median | Max | Läufe |
|---|---|---|---|
| Aussehen: `check:buehne-messen` | 13,7 | 14,0 | 11 |
| Aussehen: `check:buehne-basis` | 13,7 | 14,3 | 11 |
| Aussehen: `check:ansichten-desktop` | 11,8 | 12,1 | 11 |
| Aussehen: `check:leerlauf` | 3,2 | 3,3 | 11 |
| Job „Workflows“ (`check:tests-1` 2,9, max 6,1) | 4,1 | 8,8 | 50 |
| Job „Logik 1“ (`check:logic-1` 2,8) | 3,5 | 7,5 | 50 |
| Job „Logik 2“ (`check:logic-2` 2,2) | 3,3 | 8,2 | 50 |
| Job „Bau und Installation“ (Schritt „Installationszustände“ 1,6) | 3,3 | 8,0 | 50 |
| Job „Workflows 2“ (`check:tests-2` 1,3) | 2,1 | 6,4 | 50 |

Je Aussehens-Job kommen etwa 1 min `npm run build` dazu.

### Vorschläge Kette

1. **Aussehen halbieren statt abwarten:** `buehne-messen`, `buehne-basis` und `ansichten-desktop` je in zwei Matrix-Teile teilen (die Matrix läuft ohnehin parallel). Erwartung: Aussehens-Läufe ≈ 8–9 min statt 18, also unter 10. Voraussetzung: die Werkzeuge nehmen ein `--teil`; heute nicht geprüft.
2. **Bühne nur bei Bühnen-Änderungen:** Prüfen, ob `buehne-basis`/`buehne-messen` auf jede Datei in `web/src` laufen müssen (`PFADE` in `pr-pruefung.yml:336`) oder ein enger Pfadfilter (`web/buehne/`, Panel-Dateien) genügt; der Rest bliebe bei `check:panel`/`ansichten`. Wirkung nicht gemessen, nur der Anteil: 2 der 3 größten Posten.
3. **`tests-1` und `tests-2` ausgleichen:** Job „Workflows“ (4,1 min, max 8,8) ist der längste Kernjob, „Workflows 2“ nur 2,1 min. Eine Umverteilung zwischen den Hälften (`tools/tests-alle.mjs --teil`) holt etwa 1 min, im Kern aber nur, wenn „Workflows“ der Spätester ist; nicht je Lauf nachgezählt.

## Größte Posten Deploy (Stichprobe 25 Läufe, alle `deploy_hart`, kein `[schlank]`)

Spätester Vorjob vor `deploy_hart`: `zusicherungen` 13×, `pruefen` 7×, `build` 5×.

| Posten | Median | Max |
|---|---|---|
| Job `zusicherungen` (Schritt „Zusicherungen prüfen“ 5,2) | 6,5 | 7,4 |
| Job `pruefen` (Schritt „Workflow-Dateien prüfen“ 3,9, lief in 15 von 25; „Erweiterung prüfen“ 1,4) | 5,3 | 8,6 |
| Job `abschluss` (Schritt „Kachelränder live messen“ 2,0, nach dem Live-Gang) | 3,4 | 7,3 |
| Job `build` (Schritt „Bauen“ 0,8) | 2,0 | 2,2 |
| `deploy_hart` | 0,3 | 0,5 |

### Vorschläge Deploy

1. **`zusicherungen` teilen:** der Job bestimmt in 13 von 25 Läufen den Live-Zeitpunkt, mit 5,2 min in einem einzigen Schritt. In zwei parallele Jobs aufteilen (wie `logik`/`logik2` in der Kette) → Live nach ≈ 4–5 min, wenn `pruefen` (5,3) mitzieht, sonst bleibt `pruefen` der Engpass.
2. **„Workflow-Dateien prüfen“ (3,9) im Deploy nur bei geänderten Workflow-Dateien:** Er läuft bereits nur bei Pfadtreffer (15 von 25); der Pfadtreffer ist zu weit gefasst, wenn ein Treffer auch bei reiner Daten-/Code-Änderung auslöst. Anlass je Lauf nachzählen, bevor eine Regel gesetzt wird.
3. **`abschluss` nicht auf dem Weg zu „live“:** „Kachelränder live messen“ (2,0 min) kommt erst nach dem Live-Gang und verlängert nur die Lauf-Gesamtdauer (10,8 statt 7,3), nicht den Live-Zeitpunkt. Kein Handlungsbedarf für das Ziel < 5 min; relevant nur für die Serialisierung der Gruppe `pages` (`deploy_hart` ist serialisiert, `abschluss` nicht).

## Grenzen der Messung

- Kette: 50 Läufe seit 19.11. mit Schrittzeiten, nicht alle 624; Lauf-Gesamtzeiten (n=321 PRs) stammen aus den Lauf-Zeitstempeln.
- Deploy-Schrittzeiten: 25 Läufe (`workflow_run`, 19.–21.11.); Deploy-Gesamtzeiten aus allen 415 grünen Läufen. Die API lieferte pro Abfrage höchstens 1000 Treffer, deshalb wurde je Tag abgefragt.
- Warteschlange vor dem Lauf-Start (Runner-Mangel) ist nicht erfasst: `run_started_at` liegt bei Erstellung (Differenz 0), die Zeit bis zum ersten Jobstart wurde nicht gerechnet.
- Zeit von Merge bis Push und von Deploy-Ende bis zur Auslieferung durch Pages wurden nicht gemessen („live gemessen“ nach Regel verlangt dafür `tools/kachel-ecken-messen.mjs --live`).
