# check:logic Dauer je Prüfung (03.11.2026)

Messung: `pr-pruefung.yml`, Job „Kette – Logik“, Lauf 41595064044 (PR 2726, Kopf 9a4f2f1ce, Basis main f8a4826d8), Zeilen `check:logic Dauer:` aus `tools/check-logic-alle.mjs` (neu, nur CI).
Wandzeit 07:16:18 bis 07:23:01 = 6 min 43 s für 497 Prüfungen bei 6 gleichzeitigen (Summe der Einzeldauern 1527,5 s, Mittel 3,1 s je Prüfung).

## Top 10

| # | Sekunden | Prüfung | eingeführt | Zeilen |
|---|---|---|---|---|
| 1 | 92,8 | pipeline/check-dub-abgeleitet-lauf.ts | 28.10. | 49 |
| 2 | 89,5 | pipeline/check-kanal-ja-sprach-termin.ts | 21.10. | 180 |
| 3 | 82,1 | pipeline/check-news-altbestand.ts | 30.10. | 164 |
| 4 | 77,3 | pipeline/check-reihen-namen-rein.ts | 17.10. | 250 |
| 5 | 73,8 | pipeline/check-belege-entfernt.ts | 28.10. (3 Commits, zuletzt 29.10.) | 131 |
| 6 | 71,5 | pipeline/check-meldungs-auffaelligkeiten.ts | 19.10. (zuletzt 24.10.) | 126 |
| 7 | 49,5 | pipeline/check-folge-ueber-anzahl-bau.ts | 16.10. (zuletzt 26.10.) | 63 |
| 8 | 42,0 | tools/skript-aufrufer-wache.mjs | 25.10. (zuletzt 26.10.) | 144 |
| 9 | 41,0 | pipeline/check-nein-handbeleg-abschluss.ts | 14.10. | 64 |
| 10 | 40,2 | pipeline/check-cr-ja-deckung.ts | 16.10. (zuletzt 29.10.) | 136 |

Weiter: 34,6 check-nein-handbeleg-cr; 28,2 check-fetch-pruefungen-laufzeit; 27,4 check-adn-sprachriegel-lauf; 25,4 quarantaene-pruefungen.test.ts. Die 10 Spitzenreiter machen 660 s (43 %) der Summe aus; die übrigen 487 Prüfungen im Mittel 1,8 s.

## Seit wann
Anzahl der Prüfungen in `tools/check-logic-liste.txt`: 189 am 17.10.2026 (Stand 9fb2464fc), 350 am 27.10., 498 am 03.11. Die Dauer wuchs also mit der Zahl der Prüfungen (+163 % in 17 Tagen), nicht mit einer einzelnen Prüfung; sechs der zehn Spitzenreiter sind jünger als der Kommentar „unter einer Minute“ (17.10.). Wie lange check:logic am 17.10. wirklich lief, ist nicht belegt (kein Log mit Einzeldauern vor diesem PR).

## Vorschlag (nicht Teil des PR)
1. Die sechs Prüfungen über 70 s (zusammen 487 s) laufen im Kern Bau-Phasen oder lesen große Dateien; je eine kleine Fixture statt echtem Bestand/Bau prüfen. Erst messen, was in jeder die Zeit frisst (Bau-Phase, Parsen von `data/`, tsx-Start).
2. Prüfungen, die dasselbe Eingabe-Set laden, in einen Lauf bündeln (ein tsx-Start statt mehrerer; Grundlast rund 1 bis 2 s je Prüfung bei 497 Prüfungen).
3. Sammler-PRs prüfen mit 600 s Frist knapp (Prüfschritt 6,5 bis 7 min plus Last durch Parallelläufe): die Dauerzeilen im CI-Log weiter beobachten; ab 9 min Wandzeit die Fristen neu rechnen.
4. `QUELLEN_BASISFRIST_STANDARD=240` ist kürzer als ein Lauf auf main: der Vergleich ohne Basis ist heute der Normalfall. Getrennt klären.
