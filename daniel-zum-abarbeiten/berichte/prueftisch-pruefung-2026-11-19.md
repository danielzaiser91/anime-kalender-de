# Prüftisch, Bereich Prüfung — 19.11.2026

Messfenster 12.–19.11.2026 (Merge-Zeit). Quelle: `gh api` REST, 373 gemergte Nicht-Daten-PRs
(290 weitere `chore(data)`-PRs ohne Prüfer ausgeklammert), davon 366 mit Prüfer-Kommentar.
Vorgänger: kein Bericht dieses Bereichs; einziger Eintrag 16.10. (Cache-Schlüssel, nur Befund
ohne Zahlen). **Dieser Bericht ist der Ausgangswert.**

## Zahlen

| Größe | Wert |
|---|---|
| Prüfer-Kommentare gesamt | 1278: 554 ok, 153 ändern, **571 „nicht beurteilt, Kette lief noch“** |
| PRs mit ≥ 1 „nicht beurteilt“ | 267 von 366 (73 %) |
| „nicht beurteilt“ je Tag | 12.11.: 2 · 13.11.: 57 · 14.–18.11.: 85–113 (Anteil an allen Urteilen 35–59 %) |
| Wartezeit bis echtes Urteil (gleicher Kopf) | 436 Fälle: Median 10 min, p90 42 min, Max 138 min; 135 ohne Urteil auf demselben Kopf (neuer Push überholt) |
| PRs, deren letzter Prüfer-Kommentar „nicht beurteilt“ ist | 7 (3605, 3705, 4117, 4134, 4147, 4225, 4264), alle trotzdem gemergt |
| Echte Urteile je PR | 1: 193 · 2: 82 · 3: 52 · 4+: 38 (Median 1, Mittel 1,9) |
| PRs mit ≥ 1 „ändern“ | 106 (29 %); 93 davon schon in Runde 1, 13 erst nach erstem „ok“ (Runde 2+: z. B. 3540, 3579, 3584, 3596, 3597, 3626); ≥ 2× „ändern“: 28; ≥ 3×: 11 |
| Letztes echtes Urteil vor Merge | 363 ok, 2 ändern (nicht ausgewertet, welche) |
| Folge-Fix-PRs auf dieselben Code-Dateien binnen 3 Tagen | 101 von 155 `fix`-PRs (grobe Heuristik, Sammeldateien wie `check-logic-liste.txt` verfälschen nach oben) |
| Mutationsprobe-Läufe (`mutationsprobe.yml`, seit 12.11., erste 100) | 83 success, 9 failure, 8 cancelled |
| Überlebende Mutanten | **nicht messbar:** „success“ sagt nichts über Überlebende, Zahl steht nur im Job-Summary; Kommentar-Suche „überleb“ trifft 147 PRs, fast alle „0 überlebt“ |

Die zwei Anlässe: 4263 bekam „nicht beurteilt“ um 07:30, 07:59 und 08:15, echtes „ok“ um 07:45 und 08:20
(Median-Wartezeit, aber zwei Zyklen je Kopf). 4265 hatte um 08:05 nur „nicht beurteilt“. Der Befund
„12 von 12 Mutanten überlebt“ ist in keinem PR-Kommentar belegt; `tools/diff-mutanten.mjs`
(Z. 12, 159) fährt laut Code ohne Test **keine** Mutanten und meldet „Kein Test gefunden“; ob 12/12 aus
einem falsch gewählten Test stammt, ist offen.

## Die drei größten Schwachstellen

**1. „Nicht beurteilt“ ist der häufigste Prüfer-Kommentar (571 von 1278).** Seit 13.11. rund 100 am
Tag; jeder ist ein Prüfer-Lauf plus Kommentar ohne Aussage, 73 % der PRs sind betroffen, 7 PRs
wurden ohne Urteil auf dem letzten Kopf gemergt. Ursache: Der Prüfer startet bei `synchronize`
(`pr-pruefer.yml` Z. 13–16) zeitgleich mit der Kette und wird erst über `pr-pruefer-nachtrag.yml` nach
Kettenende neu gestartet. *Vorschlag:* Keinen Kommentar schreiben, solange die Kette läuft (Marke
setzen, Kommentar erst bei Urteil, bestehender Kommentar wird aktualisiert). *Untergrenze:* im Schritt
„Check-Stand des Kopfes“ bei laufender Kette beenden ohne Kommentar; `pr-pruefer-nach-kette.mjs`
startet ohnehin neu. Kennzahl danach: Anteil „nicht beurteilt“ unter 10 % (Wache `pruefer-unfertig-wache.mjs`
warnt bereits ab 10 %, hat bei 35–59 % aber nichts erzwungen).

**2. Runde 1 findet nicht genug: 106 von 366 PRs (29 %) brauchen „ändern“, 28 mehrfach.** Beispiele
3579 (5× ändern), 3584 (4×), 3618 (4×), 3857, 4031 (je 4×). Dazu die Fix-Kette auf `pr-nachrechnen`:
3508 mit 3× ok gemergt am 12.11., danach 7 Fix-PRs binnen eines Tages (3551, 3555, 3563, 3572, 3597,
3607, 3612; 3607 allein 5 Prüferkommentare). Ähnlich Extension (3565 → 3571, 3626, 3780, 3841). *Vorschlag:*
Neues Werkzeug mit Leser-/Erkennungslogik bekommt Pflicht „Fehlalarm-Liste vorab“ (Beispiele aus echten
PR-Diffs der letzten 7 Tage als Test). *Untergrenze:* Zeile in `agents/pruefer.md`/Bauer-Vorgabe, keine neue Technik.

**3. Mutationsprobe: Erfolg heißt nicht „keine Überlebenden“, Fehlläufe werden wiederholt.** 17 von 100
Läufen nicht grün; `nachts-lauf-runner.json` 4 Fehlläufe in 5 min (11:33–11:38 am 18.11.),
`netflix-tot-vermerk.json` 3 in 8 min. Ohne Überlebenden-Zahl im Lauf-Ergebnis ist die Messgröße
des Bereichs nicht ablesbar. *Vorschlag:* Job endet rot, sobald ein Mutant überlebt und nicht als
gleichwertig vermerkt ist; Überlebendenzahl in `run-name` oder Kommentar. *Untergrenze:* eine
Zeile „Überlebende: N“ im Job-Summary als Ausgabe lesbar machen (`$GITHUB_STEP_SUMMARY` gibt es schon),
Zählung dann per `gh run view`.

## Messgrenzen

Heuristik „Folge-Fix“ nimmt Dateiüberschneidung, nicht Ursache; „Runde“ = Urteil auf einem Kopf.
Befunde-Text je Runde nicht ausgewertet. Lauf-Liste der Mutationsprobe auf 100 begrenzt.

## Protokollzeile (für `.claude/skills/prueftisch/SKILL.md`)

- 19.11.2026, Prüfung (Termin, erstmals mit Zahlen): 571 von 1278 Prüfer-Kommentaren der Woche „nicht beurteilt, Kette lief noch“ (73 % der PRs, ~100/Tag seit 13.11.), 7 PRs ohne Urteil auf dem letzten Kopf gemergt; 29 % der PRs brauchen „ändern“ (28 mehrfach), `pr-nachrechnen` nach 3× ok mit 7 Fix-PRs binnen eines Tages; Mutationsprobe-Überlebende nicht ablesbar (17 von 100 Läufen nicht grün). Maßnahme: Prüfer schweigt bei laufender Kette, Überlebendenzahl ins Job-Summary, Fehlalarm-Beispiele vorab für neue Erkennungswerkzeuge. Bericht `berichte/prueftisch-pruefung-2026-11-19.md`.
