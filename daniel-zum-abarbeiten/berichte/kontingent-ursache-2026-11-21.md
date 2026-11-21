# Ursache des erschöpften Actions-Kontingents am 21.11.2026

Gemessen 21.11.2026 gegen 13:45 UTC aus `gh api actions/runs` (402 Läufe, 10:00–14:10 UTC), Job-Logs und Quellcode. Rund 60 Abrufe.

## 1. Welches Token teilt das Kontingent

**Das `GITHUB_TOKEN` der Workflows** (Installation „github-actions“, 1000 Abrufe/h je Repository, laut GitHub-Doku). Alle Läufe des Repos zapfen denselben Eimer.
- Fehlertext „API rate limit exceeded for **installation**“ (Lauf 44909290683, 13:34:19 UTC, „Reset in 1942 s“ → Reset 14:06:41 UTC, Fenster ab 13:06:41 UTC).
- `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` in `pr-pruefer.yml` (19 Stellen), `pr-pruefer-nachtrag.yml` (Jobs neustart, nach-kette), `abnahme-freigabe.yml`, `pr-pruefung.yml`, `deploy.yml`, `nachlauf.yml`, `mutationsprobe.yml`, `claude-daten-merge.yml` (Schritt 1).
- **Nicht beteiligt:** das App-Token (`actions/create-github-app-token`, nur Datenläufe: einreichen, adn-laufende, crunchyroll-nachholen, extension-version, claude-verpasst-recherche, claude-daten-merge Schritt 2) und `NACHT_MERGER_TOKEN` (Nacht-Merger, Job basis-gemergt). Eigene Eimer, `ghl` ist nur `gh` mit dem jeweiligen `GH_TOKEN`.
- **Lücke:** „API-Kontingent (Anfang/Ende)“ gibt es erst seit #4467 (21.11., 14:29 MEZ, also ~13:30 UTC). Es drucken nur `x-ratelimit-remaining`, nie Limit, Reset oder used. Vorhanden sind nur drei Läufe (44909200651, 44909210839, 44909290683), alle mit Anfang = Ende = 0. Eine Differenz je Job lässt sich daher **nicht messen**; Punkt 2 ist gezählt, nicht gemessen.

## 2. Verbrauch je Workflow, 10:00–14:10 UTC (gezählt)

Läufe aus der Laufliste ohne „skipped“ (kosten 0). Aufrufe je Ausführung aus dem Code gezählt, Belege unten. Prüfer-Ausführungen = Läufe plus `run_attempt` (Neustart ist `gh run rerun`, kein neuer Lauf).

| Rang | Workflow | Läufe (Ausführungen) | Aufrufe je Ausführung | Summe | Anteil |
|---|---|---|---|---|---|
| 1 | PR-Prüfer | 26 (47) | 63 (erste, stumme Versuche ~25) | 2280–2960 | 70–75 % |
| 2 | PR-Prüfer — Neustart bei Nachtrag | 83 | 2–12, Mittel 6 | ~500 | 13 % |
| 3 | Nacht-Merger (alle 20 min) | 11 | ~10 | ~110 | 3 % |
| 4 | Deploy | 20 | ~5 | ~100 | 3 % |
| 5 | PR-Prüfkette | 26 | ~3 | ~80 | 2 % |
| 6 | Mutationsprobe (Ergebnis-Kommentar) | 62 | 1 | ~60 | 2 % |
| 7 | Nachlauf, Bestand, Daten-PR, Abnahme | 46 | 2–4 | ~115 | 3 % |

**Summe ≈ 3250–3925 in 4 h 10 min, also 780–940/h** gegen 1000/h: ohne Reserve. Fenster 13:06:41–13:34 UTC: 10 Prüfer-Ausführungen (6 Läufe) + 16 Neustarts ≈ 560–800 gezählt; dazu kommen Nicht-Gezähltes (claude-code-action-Vorlauf, Deploy-Abfragen, Wiederholungen bei Fehlern), das den Rest bis 1000 erklärt. Die Zählung ist eine Schätzung (± 20 %), die Rangfolge ist es nicht.

**Aufruf-Aufschlüsselung eines Prüfer-Versuchs bei fertiger Kette (≈ 63):**
Kettenlog ≈ 34 (`tools/pr-kettenlog.mjs`: Lauf 1, Jobs 1, **ein Abruf je Job-Log, 30 Jobs** laut Zeile „1 von 30 Job-Logs“; Schritt dauert 59 s, Lauf 44908086532) · Diff bereitlegen ≈ 8 · Prüfstufe zweimal + Modus ≈ 8 · Check-Stand 2 (grün; bis 8 im 20-s-Takt) · Protokoll/Freigabe 3 · Action-Vorlauf ≈ 8 (ungemessen). Läuft die Kette noch, bricht der Prüfer nach ~25 Aufrufen stumm ab (keine Job-Logs).

## 3. Die größten Verbraucher

**A. Kettenlog: 30 Job-Logs einzeln abrufen (≈ 34 von 63 Aufrufen, ≈ 1500 von ≈ 3250 in 4 h).**
Ursache: eine Schleife über alle Jobs der PR-Prüfkette, auch wenn alle grün sind, und das bei jedem Versuch (Rerun auf demselben Kopf holt dieselben Logs erneut: 21 Reruns).
- Ansatz 1 (Untergrenze, eine Zeile): Kettenlog mit dem App-Token (`DATEN_APP_ID`, hat eigenen 5000/h-Eimer) statt `GITHUB_TOKEN`. Spart ~1500 im Eimer, ändert keine Logik. Offen: Hat die App `actions: read`? Nur lesen (löst keine Folgeläufe aus), kein Schleifenrisiko wie bei einem PAT mit Nutzerkonto.
- Ansatz 2: ein Abruf `GET actions/runs/{id}/logs` (ZIP aller Job-Logs) statt 30. Spart ≈ 29 je Versuch ≈ **1360 in 4 h (−35 %)**. Offen: Dateiformat der ZIP weicht vom Job-Log ab, die Übersichtszeilen und `kettenlog-zitate.txt` brauchen eine Probe an einem echten Lauf.
- Ansatz 3: Logs je Kopf-SHA einmal ablegen (Artefakt oder Cache), Reruns lesen sie. Spart 34 × 21 Reruns ≈ **710 (−18 %)**, nicht bei der ersten Runde.
- **Empfehlung:** 2, danach 3 nur, wenn nötig; 1 als Sofortventil, falls die App `actions: read` hat.

**B. Neustart-Kaskade: stumme erste Versuche + Reruns (≈ 450 + 500).**
Ursache: Der Prüfer startet mit `pull_request_target` gleichzeitig mit der Kette (Frist 0), sieht sie laufen und schweigt (~25 Aufrufe, 18 von 26 Läufen). Danach startet `nach-kette` (Takt 30 s, bis 56 Runden, `pr-pruefer-nach-kette.mjs`) einen Rerun (~63). Dazu 29 Kommentar-Neustarts (cancel + bis 40 Abfragen im 5-s-Takt). 11 von 83 Neustarts scheiterten selbst am Limit („PR nicht lesbar“, 13:34 UTC) und tragen nichts bei.
- Ansatz 1 (Untergrenze): Takte hoch (30 s → 60 s, 5 s → 15 s). Spart ≈ 150–200 (−5 %).
- Ansatz 2: Prüfer erst nach Kettenende starten (`workflow_run` der Kette statt `pull_request_target`): entfällt der stumme Versuch (−450) und `nach-kette` (−200), also ≈ **650 (−20 %)**. Aufwand hoch, der heutige Aufbau (Frist 0, 13.11.) ist bewusst gegen Runner-Wartezeit gewählt: nur mit Daniels Entscheidung.
- **Empfehlung:** 1 sofort, 2 nur als geprüfter Entwurf.

**C. Mutationsprobe abwarten + Check-Stand (≈ 190 + 50 bei Stufe 2).**
Ursache: Schleifen im 15-s-Takt (`mutationsprobe-pr.mjs`, Frist 480 s, `gh run list --limit 60`; gemessen 85–491 s je Versuch, 6 Versuche = 96 Abfragen plus 5 Dispatches, 5 Downloads, 5 Inhaltsabrufe) und 20-s-Takt im Check-Stand.
- Ansatz 1: Takt 60 s: spart ≈ 70 (−2 %). Ansatz 2: Check-Stand statt Schleife nur einmal fragen (Nachlauf der Kette ersetzt ihn ohnehin): spart ≈ 50. **Klein, nicht zuerst.**

## Reihenfolge und Wirkung (4 h 10 min, Basis ≈ 3250–3925)

| Maßnahme | Einsparung | Aufwand |
|---|---|---|
| Kettenlog über ZIP (A2) | ≈ 1360 | mittel, Probe nötig |
| Kettenlog mit App-Token (A1) | ≈ 1500 im Eimer | 1 Zeile, Rechte prüfen |
| `restZeile`: Limit, used, Reset mitdrucken | misst künftig statt zu schätzen | 3 Zeilen |
| Takte erhöhen (B1, C1) | ≈ 250 | klein |

Mit A2 + B1 + C1 sinkt der Schnitt von 780–940/h auf rund 450–600/h, die beiden Sperren vom 21.11. (11:42–11:54, ab ~13:30 UTC) wären nicht eingetreten. Nach der Umsetzung messen: `restZeile` an 5 Läufen, nach einem Tag, nach einer Woche.

## Belege
Laufliste aus der Abfrage `actions/runs?created=2026-11-21T10:00:00Z..14:10:00Z`; Quellen `tools/pr-kettenlog.mjs` (`mitLogs`, Frist 0), `tools/pr-pruefer-nach-kette.mjs` (`fertigerLauf`), `tools/pr-pruefer-neustart.mjs` (`WARTE_RUNDEN = 40`), `tools/mutationsprobe-pr.mjs` (`FRIST_MS`, `TAKT_MS`), `tools/pr-checks-stand.mjs` (`TAKT_MS`), `tools/gh-ratelimit.mjs` (`restZeile`).
