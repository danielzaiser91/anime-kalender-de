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

## Betrieb (umgesetzt 08.10.2026, PR „Funde des Daten-Detektivs")

- **Hart — Bau bricht ab:** D-01, D-13, D-14, D-21, D-23 in `pipeline/lib/invarianten.ts` (an Releases und Terminen), D-06 und D-15 in
  `pipeline/lib/invarianten-auslieferung.ts` (an den geschriebenen Dateien; Aufruf `bau/auslieferung-pruefen.ts` aus `13-5-kerndateien.ts`).
  Gegenprobe je Regel in `pipeline/check-invarianten.ts` (Teil von `check:logic`), `--bestand` fährt sie über `public/data`. Festlegungen:
  D-01 kennt eine Liste belegter Anbieterdaten (`DATUM_VOM_ANBIETER`: Lycoris Recoil, Crunchyroll datiert Folge 6 vor Folge 5); D-13 gilt für Format
  `MOVIE` und Release-Typ Film, nicht für ein ONA mit falscher AniList-Zahl (Steel Ball Run); D-06 nimmt den aniSearch-Zwilling im Hauptbestand,
  Handurteil „keine Synchro", künftigen Start und `nichtImBestand`-Handbelege aus. **Risiko:** Zwischen dem Dub-Schritt (`dub-ids`) und dem Eintrags-Schritt
  (`anisearch-eintraege`) kann eine neue `d`-Kennung kurz ohne Eintrag sein — ein Bau in dem Fenster bricht ab, bis der Eintrag geholt ist.
- **Weich — Wochenwache:** `tools/wache-woechentlich.mjs` ruft `tools/daten-detektiv.ts --wache` (D-02, D-03, D-08, D-10, D-11, D-12, D-16, D-17, D-19, D-20, D-24) und meldet
  nur Schlüssel, die nicht in `data/detektiv-bekannt.json` stehen. Neue Funde: beheben oder mit `npx tsx tools/daten-detektiv.ts --bekannt-schreiben --neue-aufnehmen`
  bewusst aufnehmen; ohne `--neue-aufnehmen` wird die Datei nur kleiner. Die Datei enthält nur Fälle, die geprüft und als gegeben eingestuft sind.
- **Nicht laufen lassen:** D-04, D-05, D-09, D-18, D-22, D-25 — Kennzahlen ohne Handlung oder Zählweise-Unterschiede.

## Funde und was daraus wurde (08.10.2026)

- **D-06** — drei der sechs (BeyWheelz, Rick and Morty: The Anime, Titipo 2) standen mit ihrem aniSearch-Zwilling (`10 000 000 + aniSearch-Kennung`) längst im Hauptbestand:
  Fehlalarm, die Regel kennt den Zwilling jetzt. Fullmetal Alchemist 4-koma: JustWatch führt unter der Serie auch ihre Specials, de-Ton gehört der Hauptserie — JustWatch zählt
  für Specials nicht. Our Last Crusade S2: der Handbeleg trägt `nichtImBestand` und die Notiz „Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg"; Crunchyrolls Katalog führt die Staffel
  ohne de-DE, aniSearch nennt Deutsch ohne „vertont" — nicht geändert. **Echt: Scott Pilgrim hebt ab** — `fetch-anisearch-eintraege.ts` hielt jede von einem AniList-Titel getragene Kennung
  für bekannt, auch wenn der AniList-Titel nur im Katalog hinter dem Toggle lag; der Eintrag, aus dem der Hauptbestand-Titel entsteht, wurde nie geholt. Behoben (`durchAnilistBekannt`),
  vier Einträge nachgeholt (18828 `d`; 13018, 19993, 20477 `p`).
- **D-02/D-19, 86** — der Sammelartikel nannte 23 Folgen für ADN-Serie 1423 und hing sie samt Termin an Staffel 1 (11 Folgen); die automatischen Releases tragen immer eine `herkunft`,
  und damit entging die Zahl der Ergebnisprüfung (Faktor 2). Die ADN-Blöcke (`adn-1423-s1-20261008-…`) stehen in keiner der beiden ADN-Dateien mehr (`adn.json` vom 08.10. 04:10 UTC, `adn-catalog.json` vom 05.10.: Serie 1423 nicht darin; warum sie
  aus dem Kalender verschwand, ist nicht geklärt — der Katalogendpunkt liefert bekanntlich nur einen Teil der Serien). Jetzt zwei kuratierte Einträge unter den alten Slugs (11 + 12 = 23 laut ADN-Folgenliste, `firstEpisodeNumber: 12`),
  dazu `zeitplanAusVorschlag`: eine Zahl über `folgenzahlUeberWerk` wird nicht übernommen. Wolf’s Rain (ADN: 30 Folgen mit `vde`, AniList 26) und Sankarea (13 / 12) tragen die Zahl ihrer Quelle, nicht geändert.
  **Befund offen: Clannad bei ADN** — Block „Staffel 1" (24 Folgen, Folge 24 „Tomoyo After") ist Clannad, Block „Staffel 2" (25, „Kyô After") After Story; `ordneBloeckeZuStaffeln`
  ordnet 24 → After Story (24) und 25 → Clannad (23): vertauscht, einschließlich der Adresse `…/655?s=2` am Titel Clannad. Ein Umbau der Zuordnung verändert alle ADN-Serien und braucht eigenen Commit mit Vorher/Nachher.
- **D-13** — The Last und Boruto: zwei Sendungen am Abend und in der Nacht sind eine Wiederholung desselben Films. `releasesAusTvProgramm` zählt für `MOVIE` mit höchstens einer Folge nur die erste Sendung (die anderen stehen unter `sendungen`).
- **D-11** — 13 Katalogaufnahmen (Disney+, ADN, Joyn, Prime) tragen jetzt `dateMeaning: available-from`; `CuratedEntry` kennt das Feld.
- **D-17** — alle acht Meldungen sind `zurueckgezogen` (Verlauf, `lib/news-verlauf.ts`): das ist Absicht, keine Lücke. Die Regel zählt nur noch Meldungen, die weder abgelöst noch zurückgezogen sind.
  Bei 86 war „zurückgezogen" falsch (der Termin blieb), die zwei Meldungen zeigen wieder auf vorhandene Slugs.
- **D-01** — Lycoris Recoil: Crunchyrolls Katalog datiert Folge 6 auf 06.08.2022 16:00 UTC, vor Folge 5; Quelle, kein Rechenfehler — als belegtes Anbieterdatum ausgenommen.
- **D-19 (Rest)** — Hände weg, Kotesashi-kun und Kamisama Kiss (Prime/Aniverse-Kanal): Termin ohne Weg, ein Weg entsteht nur aus einer Messung; bleibt in `detektiv-bekannt.json`.

## Grenzen

Keine Regel prüft gegen den Anbieter live; Zweitquellen sind die lokalen Abzüge aus `data/`, bis zu
drei Wochen alt (`link-check.json` 20.09.). `data/cache/` fehlt lokal — Regeln gegen AniList-Rohdaten
(Cover, Jahr) waren deshalb nicht möglich. Die Sicherheitswerte stammen aus einer Stichprobe von 1–7
Treffern je Regel und sind beim nächsten Lauf mit Daniels Urteil nachzuführen (`einstufung.ts`).
