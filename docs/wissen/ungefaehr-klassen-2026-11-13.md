# „≈“ trotz Beleg: Bestandsaufnahme der drei Klassen (13.11.2026)

Anlass: Steel Ball Run (Netflix) zeigte „≈ 09:00“, obwohl die Uhrzeit durch eine eigene Sichtung belegt war; der Beleg stand nur als Kommentar in `shared/logic.ts:258`, nicht als `time` + `timeSighting` im Eintrag (PR 3766, noch offen). Daniel: „guck an weiteren stellen wo ein ~ steht und wir eig sicher sind“.

Grundlage: `public/data/events.json` (Stand `e4f182ed`), Termine ab 13.11.2026; dazu `data/curated/*.yaml`, `data/proposals/aussagen.json` (Anime2You-Aussagen), `data/crunchyroll-woche.json`, `data/tv-programm.json`, `data/tmdb-folgen.json`, `data/anisearch-folgen.json`, `data/kitsu-folgen.json`, `data/wikipedia-folgen.json`. Keine Abrufe bei Joyn, RTL+, Amazon, aniSearch-Seiten oder Netflix-Serienseiten.

## Zahlen

| Klasse | Termine | Titel |
|---|---|---|
| `timeEstimated` (Uhrzeit ≈) | 4 | 1 |
| `estimated` (Datum fortgeschrieben) | 314 | 35 |
| `episodeCountAssumed` (Folgenzahl angenommen) | 94 | 15 |

## Fälle mit vorhandenem Beleg

| Titel | Feld | Beleg | Stand |
|---|---|---|---|
| Steel Ball Run – 2nd & 3rd STAGE (`steel-ball-run-2nd-3rd-stage`) | `timeEstimated` | Sichtung 25.09.2026: Folge 2 fehlte 09:35, war 10:11 da (Fenster < 60 min), Kommentar `shared/logic.ts:258`, Eintrag `data/curated/batch-2026.yaml:173` | **PR 3766** (offen) trägt `time` + `timeSighting` + `zeiten` nach; hier nicht doppelt angefasst |
| Space Mercenary (`cr-GT00384006`), Folge 7 am 15.11. | `estimated` | Crunchyroll-Wochenprogramm 09.–15.11. (`data/crunchyroll-woche.json`): Folge 7, `de`, Tag 15.11. | Kein Eintrag in `data/curated/` (Crunchyroll-Auto-Eintrag), Änderung wäre Bau-Code → Vorschlag 2, nicht in diesem PR |
| Overgeared (`cr-GT00384004`), Folge 8 am 15.11. | `estimated` | wie oben: Folge 8, `de`, 15.11. | wie oben |

Damit gibt es **keinen** belegten Fall, der sich allein mit einer Korrektur in `data/curated/` beheben lässt, außer dem schon offenen Steel Ball Run. Deshalb enthält dieser PR nur den Bericht.

Geprüft und **ohne** Beleg gelassen (≈ bleibt richtig):

- **Folgenzahl, Anime2You-Aussagen** (`data/proposals/aussagen.json`): Wo der Artikel eine Zahl nennt, trägt der Eintrag sie schon ohne Annahme (Apothekerin S3 „1 von 12“, Aoashi S2 „1 von 24“, Marronniers „1 von 20“). Für alle 10 Titel mit Annahme (Devils’ Crest „Episoden: unbekannt“, Vermilion Mask, Last Boss S2, Black Clover S2, Tank Chair, Reincarnated Aristocrat S3, Blue Box S2, PSYREN, Magic Knight Rayearth, Iceblade Sorcerer II) steht dort keine Gesamtzahl.
- **TMDB-Zahlen** sind kein Beleg und widersprechen sich zum Teil: PSYREN 13 (Eintrag: 12 angenommen), Magic Knight Rayearth 24 (Eintrag: 12 angenommen), Vermilion Mask und Tank Chair 12 (= dem 12er-Standard). Bei PSYREN und Rayearth ist die angenommene Zahl möglicherweise falsch, nicht nur unbelegt → siehe „Offen“.
- **aniSearch-Folgenlisten** der Titel mit Annahme führen nur die Nummern 1–12 ohne Datum und Titel (Platzhalter), also keine Quelle für die Zahl.
- **TV (Super Wings ×2, Pokémon Horizonte ×2, Pokémon Reisen)**: Die Zahl ist die zuletzt gesichtete Folge (`episodeCountNurGesichtet`), die Gesamtzahl der Staffel steht in keiner Quelle (Wikipedia-Liste Super Wings 144 und aniSearch Horizonte 122 gelten für die ganze Reihe, nicht für den laufenden Block).
- **`estimated` bei Disc (13 Titel, je 1 Termin)**: Sailor Moon S/Super S/Sailor Stars, Heaven’s Feel I–III, Dr. STONE Part 2, Shield Hero S4 Vol. 2, Apothekerin S2 Vol. 2, Reincarnated Aristocrat S2 Vol. 2, Re:ZERO S3 Vol. 3, Gods’ Games, Kaiju No. 8. Die Einträge sagen selbst, warum (Jahr aus Artikeldatum abgeleitet, Termin nur aus einer Quelle, aniSearch-Platzhalter, `data/curated/disc-herbst-2026.yaml:660`, `data/curated/disc-anisearch.yaml:197`). Die Amazon-Vorbestellseiten (`buyUrl`) wären der Beleg, sind hier nicht abrufbar.
- **Fortgeschriebene Wochentermine** (22 Serien, 301 Termine; Crunchyroll, Prime Video, Netflix, Disney+, ProSieben MAXX, Joyn): Ein Tag nach der letzten beobachteten Folge ist per Definition Fortschreibung. Ein Beleg müsste den Tag der einzelnen Folge nennen; der steht nirgends. `tv-programm.json` reicht nur bis heute; YAIBA (18:25) und ONE PIECE (18:50) stehen für heute nicht darin.

Es bleibt ≈ nach Ursache: Fortschreibung 301 Termine, Disc-Einzelquelle 13, Folgenzahl aniSearch/Standard unbelegt 10 Titel, Folgenzahl nur gesichtet (TV) 5 Titel (Super Wings und Pokémon Horizonte je Super RTL und TOGGO plus, Pokémon Reisen).

## Offen (nicht korrigiert, braucht Beleg oder Entscheidung)

- PSYREN (`cr-GT00371866`, 13 laut TMDB) und Magic Knight Rayearth (`cr-GT00383994`, 24 laut TMDB): Eintrag trägt 12 angenommen. Vor einer Korrektur bräuchte es eine Anbieter- oder Anime2You-Angabe; Crunchyroll-Seiten werden hier nicht abgerufen.
- Wochenprogramm trägt Folge und Tag, die Karte zeigt trotzdem „≈“ (Space Mercenary, Overgeared); bei Aoashi S2 trägt das Wochenprogramm nur die japanische Zeile (`ja`, Folge 7), die deutsche Zählung weicht ab (Folge 4), kein Beleg.

## Vorschlag: Belege landen mechanisch dort, wo der Bau sie liest

1. **Kommentar-Beleg-Wächter.** Eine Ratsche in `check:logic`: Für jedes Release mit `timeEstimated`/`episodeCountAssumed`/`estimated` im Bestand die Kommentarzeilen direkt über und im Eintrag in `data/curated/*.yaml` nach Belegwörtern durchsuchen („fehlte um“, „war um … da“, „gesichtet“, „Sichtung“, „belegt“, „laut Anbieter“). Treffer = Warnung mit Pfad:Zeile; Höchstgrenze nur sinkend (wie die übrigen `*_HOECHSTENS`-Ratschen), Ausgangswert nach Merge von PR 3766: 0 erwartet. Steel Ball Run hätte so beim Schreiben des Kommentars angeschlagen.
2. **Kein Beleg in `shared/*.ts`-Kommentaren.** `shared/logic.ts:258` nennt „Steel Ball Run“ als Beleg der Regel. Beleg zu einem Titel gehört in dessen Eintrag (`timeSighting`); der Wächter aus 1 prüft zusätzlich Kommentare in `shared/*.ts` auf Titelnamen aus `events.json` mit ≈ im selben Satz.
3. **Wochenprogramm als Beleg des Tages.** Termine im Fenster von `crunchyroll-woche.json` mit Eintrag für Serie, Tag, Folge und passender Sprache trügen kein `estimated` (Wochenplan des Anbieters, laut `docs/wissen/datensatz.md` „Wochenplan des Anbieters“ ohne ≈). Heute 2 Termine betroffen; Wächter in `check:logic`: Anzahl Crunchyroll-Termine im Wochenfenster mit ≈ und passendem Wochen-Eintrag = 0. Das ist eine Bau-Änderung (`pipeline/bau/04-cr-sendeplaetze.ts`), eigener PR, vorher/nachher am Bau messen.
4. **Folgenzahl aus Aussagen.** Wächter: Titel mit `episodeCountAssumed`, zu dem `aussagen.json` eine `folgen`-Zahl oder „N von M“ trägt, ist ein Fehler (heute 0 Fälle; die Zählung steht in diesem Bericht).
5. **Wiederholung dieser Zählung.** Die Klassenzählung (Zahlen oben) als Zeile in `tools/datenqualitaet-messen.mjs`, damit ein Anstieg der Klassen auffällt und nicht erst jemand ein „≈“ sieht.

## Prüfung

- Keine Daten geändert, daher kein `expandEvents`-Vorher/Nachher.
- `npx tsx pipeline/validate.ts` und `npx tsx pipeline/check-sichtungsfenster.ts` konnten in dieser Cloud-Sitzung nicht laufen (`node_modules` fehlt, `Cannot find package 'tsx'`); sie prüfen die Prüfkette des PR.
