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
| DD-24 Im Bestand ohne jeden Beleg (B-01) | 16 / 2.925 | 16/16 per Definition echt; Specials/OVAs älterer Serien | 3,0 | weich (Wache) |
| DD-06 Hinter dem Toggle, aber Quelle führt Synchro | 6 / 20.656 | 6/6: Handbeleg `dub: true` Prime (Our Last Crusade S2), aniSearch „d" (Scott Pilgrim hebt ab, Rick and Morty: The Anime, BeyWheelz, Titipo 2), JustWatch de-Ton (FMA 4-koma) | 3,0 | **hart** (Verlust der Kernaussage) |
| DD-01 Datum steigt nicht mit der Folge (B-05) | 1 / 642 | 1/1 Lycoris Recoil Folge 6 = 06.08.2022; TV-Sichtungen ausgenommen (Wiederholungen) | 3,0 | **hart** |
| DD-23 Widerlegt, aber Termine | 0 / 764 | — | 3,0 | hart |
| DD-02 Release-Folgen > Titel-Folgen | 7 / 564 | 6/7: **86 bei ADN 23 Folgen auf dem 11-Folgen-Titel** (beide Staffeln auf S1), Wolf’s Rain 30/26, Clannad 25/23, Sankarea 13/12, zwei TV-Filme; Air Gear in `herkunft` erklärt | 2,6 | weich (hart ab Faktor 2 gibt es schon) |
| DD-13 Film mit mehreren Folgen | 3 / 764 | 2/3: The Last und Boruto bei ProSieben MAXX „2 Folgen" = 2 Sendungen; Steel Ball Run ONA bekannte Ausnahme | 2,0 | **hart** (Film ⇒ `episodeCount ≤ 1`, außer `firstEpisodeNumber`/`herkunft`) |
| DD-16 Disc ohne Produktseite (B-09) | 157 / 160 | 138 Amazon-Suchen, 19 ohne Kaufweg | 2,0 | weich |
| DD-17 News-Meldung auf verschwundenem Release | 8 / 480 | 8/8: `adn-1423-s1-…` → `auto-116589-adn`, vier Disc-Slugs abgeschnitten (`…-2026-10-1`, `…vorbestimm`) | 2,0 | weich |
| DD-11 „Premiere" Jahre nach der aniSearch-Erstausgabe | 13 / 45 | 13/13: Disney+-Katalogaufnahmen aus `batch-2026.yaml` ohne `dateMeaning` (Yu-Gi-Oh! S4 — S2 und S3 tragen es schon —, Naruto S4, Naruto Shippuden S1, Black Clover S1 …), deutsche Fassung laut aniSearch seit 2003–2023 | 2,0 | weich (Hinweis an die Kuratierung: `dateMeaning: available-from`) |
| DD-19 Termin ohne Weg zum Anbieter | 3 / 548 | 3/3: 86 bei ADN, Kamisama Kiss und Kotesashi-kun bei Prime — Termin, aber weder Stream noch `platformUrl` | 2,0 | weich |
| DD-07 Doppelte Werke | 1 / 23.581 | 1/1: Gantz 384 und Gantz 395 (2nd Stage) tragen beide aniSearch 585 | 2,0 | weich |
| DD-08 Ohne Weg, JustWatch kennt de-Ton | 4 / 387 | nicht gegengeprüft (JustWatch steht unter Anbieter-API) | 1,5 | weich |
| DD-10 „Läuft" ohne Lebenszeichen > 60 Tage | 0 / 37 | — | 1,5 | weich |
| DD-03 Weg 404 laut Link-Prüfung | 0 / 1.284 | 870 Wege (CR 672, ADN 139, YouTube 55) kennt `link-check.json` nicht; CR/ADN laufen über ihre Kataloge | 1,5 | weich |
| DD-12 Weg „deutsch", Zweitquelle „kein Deutsch" | 0 / 270 | 16 MotN-Widersprüche durch gemessene Urteile entschieden (Prüfhierarchie karte.md §10) | 1,5 | weich |
| DD-04, DD-14, DD-15, DD-20, DD-21, DD-05, DD-25 | 1 / 0 / 0 / 0 / 0 / 0 / 0 | DD-04 Thunder 3 (Beobachtung ab Folge 6, Termine tragen „≈"); DD-05: keine der 148 Cover-Lücken hat eine Zweitquelle; DD-25: keine der 158 Handlungs-Lücken | ≤ 1,0 | DD-14/15/21 hart (billig, nie falsch), DD-20 weich, Rest nein |
| DD-22 Folgenzahl AniList ≠ aniSearch-Liste | 29 / 1.979 | 5 geprüft, 0 Fehler bei uns (Wolf’s Rain 30 = 26 + OVA, Hamtaro 296 = Gesamtserie) | 0,6 | nein |
| DD-09 Wochentakt-Abweichung | 49 / 151 | Bündel/Pausen sind Normalfall | 0,5 | nein (Kennzahl) |
| DD-18 Weg-Felder | 29 / 2.154 | 3 Bereiche über der Folgenzahl echt (B-12), 26 `sharedWith` zählen Titel außerhalb des Bestands | 0,3 | nein |

**Top-Funde nach Hebel:** (1) sechs Titel mit belegter Synchro hinter dem Toggle (DD-06) — darunter ein
Handbeleg Daniels, die höchste Beweisstufe; (2) 86 bei ADN mit 23 Folgen auf dem 11-Folgen-Titel (DD-02/DD-19,
Plattform-Kennung = Franchise); (3) zwei Kinofilme als Zweiteiler aus zwei TV-Sendungen (DD-13); (4) 13
Disney+-Katalogaufnahmen als „Premiere" (DD-11); (5) acht News-Meldungen ohne gültigen Release-Slug (DD-17).

## Betrieb (umgesetzt 08.10.2026, PR „Funde des Daten-Detektivs")

- **Kennungen (12.10.2026):** `DD-nn` = Regel des Daten-Detektivs; die harten Bau-Invarianten dazu tragen dieselbe Nummer (DD-01 ist Regel und Invariante). `D-24` bis `D-27` sind reine Bau-Invarianten ohne Detektiv-Regel (`pipeline/lib/invarianten-geplant.ts`, `-kanal.ts`, Beschreibung in `quellen.md`); neue reine Invarianten zählen dort weiter.
- **Hart — Bau bricht ab:** DD-01, DD-13, DD-14, DD-21, DD-23 in `pipeline/lib/invarianten.ts` (an Releases und Terminen), DD-06 und DD-15 in
  `pipeline/lib/invarianten-auslieferung.ts` (an den geschriebenen Dateien; Aufruf `bau/auslieferung-pruefen.ts` aus `13-5-kerndateien.ts`).
  Gegenprobe je Regel in `pipeline/check-invarianten.ts` (Teil von `check:logic`), `--bestand` fährt sie über `public/data`. Festlegungen:
  DD-01 kennt eine Liste belegter Anbieterdaten (`DATUM_VOM_ANBIETER`: Lycoris Recoil, Crunchyroll datiert Folge 6 vor Folge 5); DD-13 gilt für Format
  `MOVIE` und Release-Typ Film, nicht für ein ONA mit falscher AniList-Zahl (Steel Ball Run); DD-06 nimmt den aniSearch-Zwilling im Hauptbestand,
  Handurteil „keine Synchro", künftigen Start und `nichtImBestand`-Handbelege aus. **Risiko:** Zwischen dem Dub-Schritt (`dub-ids`) und dem Eintrags-Schritt
  (`anisearch-eintraege`) kann eine neue `d`-Kennung kurz ohne Eintrag sein — ein Bau in dem Fenster bricht ab, bis der Eintrag geholt ist.
- **Hart — Kanal-Titel (D-25 bis D-27, `lib/invarianten-kanal.ts`, Aufruf `bau/kanal-fehler.ts`):** D-27 (12.10.2026) meldet einen Titel, dessen Prime-Weg auf einer Kanal-Adresse im vorigen Bestand stand und der jetzt keinen Prime-Weg mehr hat, ohne Spur (ein anderer Prime-Weg zählt als Ersatz: ein Ausgabenwechsel ist kein Verlust; der Kanal-Schlüssel gilt über `url` und `seite`). D-27 bleibt still, wo `bestandVorher()` leer ist: Nur `build.ts` merkt den Bestand (`merkeBestandVorher()`), `check-invarianten --bestand` und die Prüfskripte nicht. Vorher ist der Bestand beim Prozessstart (`lib/bestand-vorher.ts`: `titles.json` und `ohne-synchro.json`, vor dem Überschreiben geladen); eine Spur ist ein Abgang am Titel, ein Eintrag in `verweise-entfernt.json`, ein `available: false`-Beleg oder eine gemessen tote Adresse (`link-check.json`). Anlass: 16 Titel verloren ihren Prime-Weg, weil eine Amazon-Suche am Ende wegfiel; D-26 prüfte nur `verweise-entfernt.json` und blieb still.
- **Weich — Wochenwache:** `tools/wache-woechentlich.mjs` ruft `tools/daten-detektiv.ts --wache` (DD-02, DD-03, DD-08, DD-10, DD-11, DD-12, DD-16, DD-17, DD-19, DD-20, DD-24) und meldet
  nur Schlüssel, die nicht in `data/detektiv-bekannt.json` stehen. Neue Funde: beheben oder mit `npx tsx tools/daten-detektiv.ts --bekannt-schreiben --neue-aufnehmen`
  bewusst aufnehmen; ohne `--neue-aufnehmen` wird die Datei nur kleiner. Die Datei enthält nur Fälle, die geprüft und als gegeben eingestuft sind.
- **Nicht laufen lassen:** DD-04, DD-05, DD-09, DD-18, DD-22, DD-25 — Kennzahlen ohne Handlung oder Zählweise-Unterschiede.

## Funde und was daraus wurde (08.10.2026)

- **DD-06** — drei der sechs (BeyWheelz, Rick and Morty: The Anime, Titipo 2) standen mit ihrem aniSearch-Zwilling (`10 000 000 + aniSearch-Kennung`) längst im Hauptbestand:
  Fehlalarm, die Regel kennt den Zwilling jetzt. Fullmetal Alchemist 4-koma: JustWatch führt unter der Serie auch ihre Specials, de-Ton gehört der Hauptserie — JustWatch zählt
  für Specials nicht. Our Last Crusade S2: der Handbeleg trägt `nichtImBestand` und die Notiz „Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg"; Crunchyrolls Katalog führt die Staffel
  ohne de-DE, aniSearch nennt Deutsch ohne „vertont" — nicht geändert. **Echt: Scott Pilgrim hebt ab** — `fetch-anisearch-eintraege.ts` hielt jede von einem AniList-Titel getragene Kennung
  für bekannt, auch wenn der AniList-Titel nur im Katalog hinter dem Toggle lag; der Eintrag, aus dem der Hauptbestand-Titel entsteht, wurde nie geholt. Behoben (`durchAnilistBekannt`),
  vier Einträge nachgeholt (18828 `d`; 13018, 19993, 20477 `p`).
- **DD-02/DD-19, 86** — der Sammelartikel nannte 23 Folgen für ADN-Serie 1423 und hing sie samt Termin an Staffel 1 (11 Folgen); die automatischen Releases tragen immer eine `herkunft`,
  und damit entging die Zahl der Ergebnisprüfung (Faktor 2). Die ADN-Blöcke (`adn-1423-s1-20261008-…`) stehen in keiner der beiden ADN-Dateien mehr (`adn.json` vom 08.10. 04:10 UTC, `adn-catalog.json` vom 05.10.: Serie 1423 nicht darin; warum sie
  aus dem Kalender verschwand, ist nicht geklärt — der Katalogendpunkt liefert bekanntlich nur einen Teil der Serien). Jetzt zwei kuratierte Einträge unter den alten Slugs (11 + 12 = 23 laut ADN-Folgenliste, `firstEpisodeNumber: 12`),
  dazu `zeitplanAusVorschlag`: eine Zahl über `folgenzahlUeberWerk` wird nicht übernommen. Wolf’s Rain (ADN: 30 Folgen mit `vde`, AniList 26) und Sankarea (13 / 12) tragen die Zahl ihrer Quelle, nicht geändert.
  **Befund offen: Clannad bei ADN** — Block „Staffel 1" (24 Folgen, Folge 24 „Tomoyo After") ist Clannad, Block „Staffel 2" (25, „Kyô After") After Story; `ordneBloeckeZuStaffeln`
  ordnet 24 → After Story (24) und 25 → Clannad (23): vertauscht, einschließlich der Adresse `…/655?s=2` am Titel Clannad. Ein Umbau der Zuordnung verändert alle ADN-Serien und braucht eigenen Commit mit Vorher/Nachher.
- **DD-13** — The Last und Boruto: zwei Sendungen am Abend und in der Nacht sind eine Wiederholung desselben Films. `releasesAusTvProgramm` zählt für `MOVIE` mit höchstens einer Folge nur die erste Sendung (die anderen stehen unter `sendungen`).
- **DD-11** — 13 Katalogaufnahmen (Disney+, ADN, Joyn, Prime) tragen jetzt `dateMeaning: available-from`; `CuratedEntry` kennt das Feld.
- **DD-17** — alle acht Meldungen sind `zurueckgezogen` (Verlauf, `lib/news-verlauf.ts`): das ist Absicht, keine Lücke. Die Regel zählt nur noch Meldungen, die weder abgelöst noch zurückgezogen sind.
  Bei 86 war „zurückgezogen" falsch (der Termin blieb), die zwei Meldungen zeigen wieder auf vorhandene Slugs.
- **DD-01** — Lycoris Recoil: Crunchyrolls Katalog datiert Folge 6 auf 06.08.2022 16:00 UTC, vor Folge 5; Quelle, kein Rechenfehler — als belegtes Anbieterdatum ausgenommen.
- **DD-19 (Rest)** — Hände weg, Kotesashi-kun und Kamisama Kiss (Prime/Aniverse-Kanal): Termin ohne Weg, ein Weg entsteht nur aus einer Messung; bleibt in `detektiv-bekannt.json`.

## Wochenwache 12.10.2026: 23 neue Funde der weichen Regeln

`npm run detektiv -- --nur DD-02,DD-08,DD-24,DD-16,DD-19` (Bestand 12.10.2026); `--wache` meldete 23 Schlüssel, die nicht in `data/detektiv-bekannt.json` standen.

- **DD-24 (10):** Fehlalarm bei dreien — Bastard!! (beide Staffeln) und Scott Pilgrim hebt ab tragen bei aniSearch `d` (vertont); das ist im Bau ein Beleg (`deutschLautAnisearch`), die Regel nannte es nur im Text und zählte sie trotzdem. **Regel geschärft:** `d` und `c` zählen als Beleg, `p` bleibt Treffer mit Vermerk „nur als geplant" (Gegenprobe in `check-detektiv-funde.ts`). Die übrigen sieben stehen im Hauptbestand, weil die Grundliste (`dubConfidence: low`, Quelle vermutlich MyDubList) sie führt und aniSearch Deutsch als geplant (`p`) nennt oder gar keinen Eintrag hat (Girls und Panzer Teil 5: Japan-Start 09.10.2026, Teil 4 läuft bei Prime/Aniverse; deutsche Fassung von Teil 5 ungeprüft). Gekennzeichnet als schwach, nichts gestrichen; in `detektiv-bekannt.json`.
- **DD-02 (2):** Kein Datenfehler. **Gantz** 26 Folgen auf der Prime-Seite: Anime2You nennt „26 (komplett)", der Handbeleg `dub-confirmed.yaml` (Amazon B0GZV7F9KK) „alle 26 Folgen geprüft" — Prime führt Gantz (13) und Gantz: Second Stage (13) als eine Serie. **Danganronpa** 14: Anime2You „14 (komplett)", AniList und aniSearch zählen 13 (aniSearch-Folgenliste 8222: 13 Einträge); die Zahl der Quelle bleibt, Nachprüfung auf der Liste für Daniel. Beide in `detektiv-bekannt.json`, wie Wolf’s Rain und Sankarea am 08.10.
- **DD-08 (2):** Kabaneri-Zusammenfassungsfilme (98662, 98663): JustWatch (17.09.2026) nennt Crunchyroll mit deutschem Ton (`/watch/GR0XPDJ0Y`, `/watch/GR790PW36`), Crunchyrolls Katalog (`cr-katalog-de.json`, 09.09.2026: 69 Filme, keiner davon Kabaneri; Serie GR24GX896 nur mit der Staffel 1) führt sie nicht. Prüfhierarchie: Katalog vor JustWatch, also kein Weg eingetragen; Klärung steht auf der Liste für Daniel. **Überholt am 13.10.2026:** Der Katalog-Abzug war unvollständig, beide Filme haben jetzt ihren Weg (siehe „Restfunde DD-08 … 13.10.2026“).
- **DD-16 (8):** Sechs Vorbestellungen 2026/27 mit Amazon-Suche als Kaufweg (Fate/stay night Heaven’s Feel ×3, Dr. Stone, Shield Hero, Apothekerin): der Artikel nennt keine Amazon-Seite, die Suche ist der dokumentierte Rückfall (138 am 08.10.). **Behoben:** Jujutsu Kaisen Film (`B0HMCFML35`) und Kaiju No. 8 Staffel 1 Steelbook (`B0HMCHK26Q`, vorher automatischer Eintrag ohne jeden Kaufweg, Slug unverändert) führen jetzt zur Produktseite, die der Anime2You-Artikel unter „Film auf Blu-ray“ bzw. „Staffel 1 im Steelbook“ verlinkt (ohne Partnerkennung).
- **DD-19 (1):** Dragon Ball Daima: Anime2You (25.09.2026) nennt als Stream „Prime Video, RTL+" (RTL+ auf dem Prime-Video-Channel), der Titel hat Wege zu RTL+ und TOGGO, aber keinen Prime-Weg; ein Weg entsteht nur aus einer Messung (Prime-Seiten werden nicht abgerufen). Bleibt bekannt, wie Kamisama Kiss.
- Aus `detektiv-bekannt.json` fielen zwei erledigte Schlüssel (DD-08 8408, DD-19 auto-187331-primevideo).

### Restfunde DD-08 (Kabaneri-Filme) und DD-02 (Danganronpa), 13.10.2026

- **Kabaneri 98662/98663, Ursache:** Beide Filme trugen den Crunchyroll-Serienweg `…/series/GR24GX896/…` (`sharedWith: 3`, von der Serie geerbt). Er fällt erst am Ende von `schliesseWegeAb` weg (`entferneFremdeNachStaffeln`: die Serie hat nur Staffel 1 mit 12 Folgen = 21196). Bis dahin besetzte er den Crunchyroll-Platz, den die JustWatch-Runden (`11-2-justwatch.ts`: „nur Titel ohne Weg“, „kein zweiter Weg zur selben Plattform“) mit der Film-Adresse füllen — danach war nichts mehr zu füllen. Der Satz „Katalog vor JustWatch“ stimmte nicht: der Katalog widerspricht nicht, er kennt die Filme nur nicht im `movie_listing`-Abzug (69 Einträge). Crunchyrolls Schnittstelle führt sie sehr wohl (deutscher Katalog, 13.10.2026, `cms/objects`): `GR0XPDJ0Y` und `GR790PW36` sind Episoden der Filmlistings `GMTE00193059`/`GMTE00193060` („Kompilationsfilm …“), je mit einer Version `de-DE` (`GD9UV5DDX`, `GQJUGK77Q`), Abo.
- **Bau-Korrektur:** `fuelleWegeAusJustwatch` (`11-wege-abschluss.ts`) entfernt die Serien-Wege ohne Staffel schon vor der JustWatch-Ergänzung (am Ende läuft die Entfernung weiter); Zusicherung `pipeline/check-cr-film-wege.ts`. Die Schlüssel 98662/98663 stehen noch in `detektiv-bekannt.json` und können raus, sobald der Bestandsbau den Bestand ohne den Fund gebaut hat.
- **Danganronpa 14 statt 13:** Nicht aus unseren Daten klärbar. Die 14 steht nur im Anime2You-Artikel (Aniverse September 2026, „Staffel 1“, 14 Folgen); AniList, aniSearch (Folgenliste 8222), TMDB (Staffel 1) und alle aniSearch-Gesamtausgaben der FilmConfect (126624/126625: `enthalten … folgen: 13`) zählen 13, TMDB führt dazu 3 Specials (Staffel 0). Welche Folge Aniverse als vierzehnte zählt, steht nur auf der Anbieterseite (Prime/Aniverse; Abruf ausgeschlossen) — Handprobe auf der Prime-Seite von `B0CHK728W1` klärt es. Bis dahin bleibt die Zahl der Quelle am Release (wie bei Gantz).

## Wochenwache 20.10.2026: 34 neue Funde (DD-02, DD-11, DD-16, DD-19)

`npm run detektiv -- --nur DD-02,DD-11,DD-16,DD-19` (Bestand 20.10.2026); `--wache` meldete 34 Schlüssel.

| Klasse | Funde | Beurteilung | Folge |
|---|---|---|---|
| DD-16 Amazon-Suche statt Produktseite | 25 | echte Lücke: Handeinträge ohne `buyUrl` (Rückfall B-09) | 23 aus der Übersichtstabelle der Anime2You-Amazon-Artikel belegt (`tools/amazon-tabelle.mjs`, Name und Tag/Monat müssen passen; 2 davon neue Funde, 21 ältere); die übrigen 23 neuen brauchen einen Artikel, der die Ausgabe verlinkt (Prüfliste) |
| DD-16 kein Kaufweg | 3 | Eureka Seven, Isekai Onsen Paradise: neue automatische Meldungen, Artikel ohne Amazon-Link (Quelle fehlt); Dr. Stone: Dublette zu `dr-stone-science-future-part2` | Dublette: Artikel 1058419 als Quelle am Handeintrag, der Sammler markiert ihn beim nächsten Lauf als `alreadyCurated` |
| DD-02 Folgen über Titel | 2 | Fehlalarm: Concrete Revolutio (beide Staffeln, 24), Zexal S2+S3 (49 + 48 = 97 von 146 Folgen laut Anime2You) | in `detektiv-bekannt.json` |
| DD-11 „Premiere“ | 2 | Yu-Gi-Oh! Staffel 4 (Disney+): echter Fehler, Katalogaufnahme ohne `dateMeaning` — behoben; Venus Wars (2K-Remaster, Kino): Wiederaufführung, Sprachfassung belegt (Stand 01.11.2026: deutsche Synchronfassung, in manchen Kinos zusätzlich OmU; Quellen: anime2you.de, uci-kinowelt.de, termine.mainpost.de, ofdb.de) | Venus Wars in `detektiv-bekannt.json` (01.11.2026), Quellen in `kino-2026.yaml` |
| DD-19 Termin ohne Weg | 2 | Snowball Earth (Prime-Kanal Crunchyroll), Trinity Seven (Aniverse-Kanal): ein Weg entsteht nur aus einer Messung | in `detektiv-bekannt.json`, wie Kamisama Kiss |

**Ursache der größten Klasse:** Der Bau setzt für jede Disc ohne `buyUrl` die Amazon-Suche ein (`05-releases.ts`); Anime2You verlinkt die Produktseiten aber in der Übersichtstabelle der Artikel, und die Handeinträge übernahmen sie nicht. `tools/amazon-tabelle.mjs` liest die Tabelle (Name und Termin müssen übereinstimmen, Sonderausgaben bleiben außen, der Partner-Tag fällt weg); `tools/amazon-tabelle.test.mjs` prüft auch, dass keine `buyUrl` der Handdateien eine Abfrage trägt.

## Grenzen

Keine Regel prüft gegen den Anbieter live; Zweitquellen sind die lokalen Abzüge aus `data/`, bis zu
drei Wochen alt (`link-check.json` 20.09.). `data/cache/` fehlt lokal — Regeln gegen AniList-Rohdaten
(Cover, Jahr) waren deshalb nicht möglich. Die Sicherheitswerte stammen aus einer Stichprobe von 1–7
Treffern je Regel und sind beim nächsten Lauf mit Daniels Urteil nachzuführen (`einstufung.ts`).
