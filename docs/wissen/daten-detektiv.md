# Daten-Detektiv — Datensatz gegen sich selbst und gegen Zweitquellen (PoC, 08.10.2026)

**Was er tut.** `npm run detektiv` (= `tsx tools/daten-detektiv.ts`) liest `public/data/*` und die Zweitquellen
aus `data/` (`link-check.json`, `anisearch-dubs.json`, `anisearch-dub-ids.json`, `anisearch-folgen.json`,
`anisearch.json`, `justwatch-audio.json`, `motn-tonspur.json`, `crunchyroll-dub.json`, `dub-confirmed.yaml`,
`urteile.json`, `tmdb-poster.json`, `anisearch-cover.json`), prüft 25 Regeln und schreibt
`daniel-zum-abarbeiten/daten-detektiv.md` (lesbar) und `.json` (vollständig, mit Delta zum vorigen Lauf).
Sortierung: **Hebel = Nutzerwirkung (1–3) × Sicherheit (1 − Fehlalarmquote der Handstichprobe)**, dann
Trefferzahl. Nur lesen, Exit 0, nicht in den Bau eingehängt. Module: `tools/daten-detektiv/`
(`laden.ts`, `regeln-termine.ts`, `regeln-titel.ts`, `regeln-quellen.ts`, `einstufung.ts`, `bericht.ts`).

**Abgrenzung.** Die Wache (`delta-pruefen.mjs`) sieht Verluste zwischen zwei Ständen, die Invarianten
(`pipeline/lib/invarianten.ts`, PR 479) brechen den Bau bei innerem Widerspruch ab, `tools/daten-befund.mjs`
ist die alte Gegenprobe ohne Zweitquellen. Der Detektiv findet, was nur im Vergleich mit einer zweiten
Quelle oder über einen Zeitraum auffällt, und sagt je Regel, ob sie hart, weich oder gar nicht laufen soll.

## Zahlen vom 08.10.2026 (Datensatz-Stand 14:13 UTC, `--heute 2026-10-08`)

| Regel | Treffer / geprüft | Stichprobe von Hand | Hebel | Empfehlung |
|---|---|---|---|---|
| D-24 Im Bestand ohne jeden Beleg (B-01) | 16 / 2.925 | 16/16 per Definition echt; Specials/OVAs älterer Serien | 3,0 | weich (Wache) |
| D-06 Hinter dem Toggle, aber Quelle führt Synchro | 6 / 20.656 | 6/6: Handbeleg `dub: true` Prime (Our Last Crusade S2), aniSearch „d" (Scott Pilgrim hebt ab, Rick and Morty: The Anime, BeyWheelz, Titipo 2), JustWatch de-Ton (FMA 4-koma) | 3,0 | **hart** (Verlust der Kernaussage) |
| D-01 Datum steigt nicht mit der Folge (B-05) | 1 / 642 | 1/1 Lycoris Recoil Folge 6 = 06.08.2022; TV-Sichtungen ausgenommen (Wiederholungen) | 3,0 | **hart** |
| D-23 Widerlegt, aber Termine | 0 / 764 | — | 3,0 | hart |
| D-02 Release-Folgen > Titel-Folgen | 7 / 564 | 6/7: **86 bei ADN 23 Folgen auf dem 11-Folgen-Titel** (beide Staffeln auf S1), Wolf’s Rain 30/26, Clannad 25/23, Sankarea 13/12, zwei TV-Filme; Air Gear in `herkunft` erklärt | 2,6 | weich (hart ab Faktor 2 gibt es schon) |
| D-13 Film mit mehreren Folgen | 3 / 764 | 2/3: The Last und Boruto bei ProSieben MAXX „2 Folgen" = 2 Sendungen; Steel Ball Run ONA bekannte Ausnahme | 2,0 | **hart** (Film ⇒ `episodeCount ≤ 1`, außer `firstEpisodeNumber`/`herkunft`) |
| D-16 Disc ohne Produktseite (B-09) | 157 / 160 | 138 Amazon-Suchen, 19 ohne Kaufweg | 2,0 | weich |
| D-17 News-Meldung auf verschwundenem Release | 8 / 480 | 8/8: `adn-1423-s1-…` → `auto-116589-adn`, vier Disc-Slugs abgeschnitten (`…-2026-10-1`, `…vorbestimm`) | 2,0 | weich |
| D-11 „Premiere" Jahre nach der aniSearch-Erstausgabe | 13 / 45 | 13/13: Disney+-Katalogaufnahmen aus `batch-2026.yaml` ohne `dateMeaning` (Yu-Gi-Oh! S2–S4, Naruto S4, Naruto Shippuden S1, Black Clover S1 …), deutsche Fassung laut aniSearch seit 2003–2023 | 2,0 | weich (Hinweis an die Kuratierung: `dateMeaning: available-from`) |
| D-19 Termin ohne Weg zum Anbieter | 3 / 548 | 3/3: 86 bei ADN, Kamisama Kiss und Kotesashi-kun bei Prime — Termin, aber weder Stream noch `platformUrl` | 2,0 | weich |
| D-07 Doppelte Werke | 1 / 23.581 | 1/1: Gantz 384 und Gantz 395 (2nd Stage) tragen beide aniSearch 585 | 2,0 | weich |
| D-08 Ohne Weg, JustWatch kennt de-Ton | 4 / 387 | nicht gegengeprüft (JustWatch steht unter Anbieter-API) | 1,5 | weich |
| D-10 „Läuft" ohne Lebenszeichen > 60 Tage | 0 / 37 | — | 1,5 | weich |
| D-03 Weg 404 laut Link-Prüfung | 0 / 1.284 | 870 Wege (CR 672, ADN 139, YouTube 55) kennt `link-check.json` nicht; CR/ADN laufen über ihre Kataloge | 1,5 | weich |
| D-12 Weg „deutsch", Zweitquelle „kein Deutsch" | 0 / 270 | 16 MotN-Widersprüche durch gemessene Urteile entschieden (Prüfhierarchie karte.md §10) | 1,5 | weich |
| D-04, D-14, D-15, D-20, D-21, D-05, D-25 | 1 / 0 / 0 / 0 / 0 / 0 / 0 | D-04 Thunder 3 (Beobachtung ab Folge 6, Termine tragen „≈"); D-05: keine der 148 Cover-Lücken hat eine Zweitquelle; D-25: keine der 158 Handlungs-Lücken | ≤ 1,0 | D-14/15/21 hart (billig, nie falsch), D-20 weich, Rest nein |
| D-22 Folgenzahl AniList ≠ aniSearch-Liste | 29 / 1.979 | 5 geprüft, 0 Fehler bei uns (Wolf’s Rain 30 = 26 + OVA, Hamtaro 296 = Gesamtserie) | 0,6 | nein |
| D-09 Wochentakt-Abweichung | 49 / 151 | Bündel/Pausen sind Normalfall | 0,5 | nein (Kennzahl) |
| D-18 Weg-Felder | 29 / 2.154 | 3 Bereiche über der Folgenzahl echt (B-12), 26 `sharedWith` zählen Titel außerhalb des Bestands | 0,3 | nein |

**Top-Funde nach Hebel:** (1) sechs Titel mit belegter Synchro hinter dem Toggle (D-06) — darunter ein
Handbeleg Daniels, die höchste Beweisstufe; (2) 86 bei ADN mit 23 Folgen auf dem 11-Folgen-Titel (D-02/D-19,
Plattform-Kennung = Franchise); (3) zwei Kinofilme als Zweiteiler aus zwei TV-Sendungen (D-13); (4) 13
Disney+-Katalogaufnahmen als „Premiere" (D-11); (5) acht News-Meldungen ohne gültigen Release-Slug (D-17).

## Vorschlag für den Betrieb

- **Hart (in `pipeline/lib/invarianten.ts`):** D-06 (Handbeleg/aniSearch-„d" nie hinter dem Toggle — ergänzt
  `dubNurHinterToggle`), D-01 (ohne TV-Sichtungen), D-13 (`MOVIE`/`episodes = 1` ⇒ `episodeCount ≤ 1`), D-14,
  D-15, D-21, D-23. Alle sieben: 0–1 echte Treffer heute, keine Fehlalarme in der Stichprobe.
- **Weich (wöchentlich in `delta-wache.yml`, Wochenwache):** `npm run detektiv`, Bericht als Artefakt und ins
  Wache-Protokoll; rot nur bei **neuen** Schlüsseln in D-02, D-11, D-17, D-19, D-24 (das JSON trägt das Delta).
- **Nicht laufen lassen:** D-04, D-05, D-09, D-18, D-22, D-25 — Kennzahlen ohne Handlung oder Zählweise-Unterschiede.

## Grenzen

Keine Regel prüft gegen den Anbieter live; Zweitquellen sind die lokalen Abzüge aus `data/`, bis zu
drei Wochen alt (`link-check.json` 20.09.). `data/cache/` fehlt lokal — Regeln gegen AniList-Rohdaten
(Cover, Jahr) waren deshalb nicht möglich. Die Sicherheitswerte stammen aus einer Stichprobe von 1–7
Treffern je Regel und sind beim nächsten Lauf mit Daniels Urteil nachzuführen (`einstufung.ts`).
