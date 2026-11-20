# Pokémon: deutsche TV-Staffeln gegen die Reihe (Inventur, 20.11.2026)

Auftrag (Daniel, 20.11.2026): „es gibt eine große Lücke bei pokemon. viele der staffel teile fehlen.“
Stand der Daten: `public/data` auf `main` vom 20.11.2026, `data/tmdb-folgen.json` (TMDB 60572, geholt 06.10./09.11.2026).

**Grenzen dieses Laufs.** Der Cloud-Lauf erreicht pokewiki.de, bisafans.de, fernsehserien.de, de.wikipedia.org, wunschliste.de,
synchronkartei.de und graphql.anilist.co nicht (Proxy 403, gemessen 20.11.2026). Belastbar sind deshalb nur Quellen, die schon im Repo liegen
(TMDB-Staffeln mit deutschen Folgentiteln, Titel-Stammdaten, Releases). **Deutsche Starttermine je Staffel sind darum nicht neu belegt;
es wurde nichts eingetragen, was keine Quelle trägt.**

## Befund in einem Satz

An Folgen fehlt nichts (1.234 im Datensatz gegen 1.235 in TMDB-Staffel 1–25); es fehlen die **Staffelgrenzen**: die Reihe zählt 13 „Staffeln“,
weil jede AniList-Sammelkennung als eine zählt, deutsch sind es 25 TV-Staffeln plus Horizonte.

## Inventur A: deutsche TV-Staffeln laut TMDB (60572)

Folgentitel sind die deutschen; die Daten in der letzten Spalte sind laut TMDB japanische Ausstrahlungstage, **keine deutschen Starttermine**.

| TMDB-Staffel | Folgen | Titel erste → letzte Folge (deutsch) | japan. Daten laut TMDB |
|---|---|---|---|
| 1 | 82 | Pika-Pikachu → Das Versprechen | 1997-04-01 bis 1999-01-21 |
| 2 | 36 | Panik-Party → Showdown in Alabastia | 1999-01-28 bis 1999-10-07 |
| 3 | 41 | Finger weg von Karnimani! → Das Schicksalsbuch | 1999-10-14 bis 2000-07-27 |
| 4 | 52 | Eine harte Nuss in Dukatia City → Der Maschock Trainer | 2000-08-03 bis 2001-08-02 |
| 5 | 65 | Mitten im Strudel! → Endlich in der Hoenn-Region | 2001-08-09 bis 2002-11-14 |
| 6 | 40 | Pikachu in Not → Spaß muss sein | 2002-11-21 bis 2003-08-28 |
| 7 | 52 | Die Melonenmeisterin → Das Herz am rechten Fleck! | 2003-09-04 bis 2004-09-02 |
| 8 | 53 | Wirbel um die Blaue Perle → Pasta Lavista! | 2004-09-09 bis 2005-09-29 |
| 9 | 46 | Duell in der Geisterstadt → Jedes Ende hat einen Anfang! | 2005-10-06 bis 2006-09-14 |
| 10 | 52 | Lucia startet durch! → Mit Vollgas ins Finale! | 2006-09-28 bis 2007-10-25 |
| 11 | 52 | Tränen der Vergangenheit → Ein legendäres Pokémon! | 2007-11-08 bis 2008-12-04 |
| 12 | 53 | Gespensteralarm! → Schnapp’ dir das Kaumalat! | 2008-12-04 bis 2009-12-24 |
| 13 | 34 | Kampf der Titanen! → Der Abschied | 2010-01-07 bis 2010-09-09 |
| 14 | 48 | Im Schatten von Zekrom! → Der Kampf um die Metro! | 2010-09-23 bis 2011-09-15 |
| 15 | 49 | Kamilla, die elektrisierende Arenaleiterin! → Kampf um die Zukunft der Einall-Region! | 2011-09-22 bis 2012-10-04 |
| 16 | 45 | Hochmut kommt vor dem Fall! → Dem Traum hinterher! | 2012-10-11 bis 2013-09-26 |
| 17 | 48 | Kalos, Region der Träume und Abenteuer! → Heureka geht in die Verteidigung! | 2013-10-17 bis 2014-10-30 |
| 18 | 45 | Vorführungspartner gesucht! → Alle Augen Richtung Zukunft! | 2014-11-13 bis 2015-10-22 |
| 19 | 49 | Von A bis Z! → Das Ultimative Duo | 2015-10-29 bis 2016-11-10 |
| 20 | 43 | Alola, neue Abenteuer! → Wenn Regionen aufeinanderprallen! | 2016-11-17 bis 2017-09-21 |
| 21 | 49 | Eine Begegnung im Traum! → Der Mann und die Maske! | 2017-10-05 bis 2018-10-14 |
| 22 | 54 | Lillier und der Stab! → Danke, Alola! Die Reise geht weiter! | 2018-10-21 bis 2019-11-03 |
| 23 | 48 | Hallo, Pikachu! → Eine knappe Sache ... quasi! | 2019-11-17 bis 2020-12-04 |
| 24 | 42 | Trainieren oder nicht trainieren! → Showdown bei den Portalen der Verzerrung! | 2020-12-11 bis 2021-12-10 |
| 25 | 57 | Der Geister-Express! → Der Regenbogen und der Pokémon-Meister! | 2021-12-17 bis 2023-03-24 |

## Inventur B: Sammeltitel der Reihe gegen die TMDB-Staffelsummen

Die Zuordnung ist eine Rechnung über Folgensummen, kein Beleg: Eine Staffelgrenze gilt nur, wo die kumulierte Titelsumme genau eine kumulierte TMDB-Summe trifft.

| Titel (Kennung) | Folgen im Datensatz | kumuliert | TMDB-Staffeln kumuliert | deutsch erschienen (Datensatz) |
|---|---|---|---|---|
| Pokémon (527) | 276 | 276 | bis Staffel 5 (276) | 1999-09-01 bis 2004-06-07 |
| Pokémon Advanced Generation (1564) | 192 | 468 | keine Staffelgrenze | 2003-08-18 bis 2007-10-09 |
| Pokémon: Diamant & Perl (1565) | 191 | 659 | keine Staffelgrenze | 2008-05-27 bis 2011-04-24 |
| Pokémon: Schwarz & Weiß (9107) | 84 | 743 | keine Staffelgrenze | 2011-05-01 bis 2013-02-10 |
| Pokémon: Schwarz & Weiß Staffel 2 (14093) | 24 | 767 | keine Staffelgrenze | 2012-11-27 bis 2013-08-26 |
| Pokémon: Schwarz & Weiß Staffel 2 - Episode N (17115) | 14 | 781 | keine Staffelgrenze | 2013-08-26 bis 2013-09-04 |
| Pokémon: Schwarz & Weiß - Abenteuer in Einall und darüber hinaus (17873) | 20 | 801 | keine Staffelgrenze | 2013-09-04 bis 2014-01-10 |
| Pokémon: Die TV-Serie - XY (19291) | 93 | 894 | keine Staffelgrenze | 2018-04-20 bis - |
| Pokémon: Die TV-Serie - XYZ (21356) | 47 | 941 | keine Staffelgrenze | 2016-05-28 bis 2017-03-04 |
| Pokémon: Die TV-Serie - Sonne & Mond (97634) | 146 | 1087 | keine Staffelgrenze | 2019-04-26 bis - |
| Pokémon Reisen: Die Serie (112153) | 136 | 1223 | keine Staffelgrenze | 2020-06-24 bis 2023-07-16 |
| Pokémon: Abenteuer eines Pokémon-Meisters (158870) | 11 | 1234 | keine Staffelgrenze | 2023-07-24 bis 2023-10-02 |

Summe Datensatz 1.234 (Staffel 1–25 ohne Horizonte), Summe TMDB 1.235. Differenz 1: Advanced Generation hat in AniList 192 Folgen, TMDB-Staffel 6–9 zusammen 191.
Der Rest passt auf die Folge, nur liegen die Grenzen innerhalb der Titel: 527 = Staffel 1–5, 1564 = Staffel 6–9, 1565 = Staffel 10–13,
9107 + 14093 + 17115 + 17873 = Staffel 14–16 (142 Folgen), 19291 = Staffel 17–18, 21356 = Staffel 19 (47 von 49; die zwei übrigen: Folge 48 heißt in TMDB „Die Legende von X,Y und Z!“ (Sonderfolge 10011938), die Zuordnung der anderen ist offen), 97634 = Staffel 20–22, 112153 + 158870 = Staffel 23–25 (136 + 11 = 147).

## Lücken

| Nr | Lücke | Beleg | Stand |
|---|---|---|---|
| L1 | Die Reihenkarte sagt „Staffel 4 von 13“ für Schwarz & Weiß; deutsch ist es Staffel 14 von 25 (die Disc-Ausgabe im Datensatz heißt selbst „Staffel 14 bis 16“, `disc-winter-2026.yaml`). Sieben Kennungen (527, 1564, 1565, 19291, 97634 sowie die Gruppen 9107–17873 und 112153+158870) bündeln je 2 bis 5 deutsche Staffeln. | `staffelStaende()` auf der Reihe 527: 13 Hauptstaffeln von 66 Mitgliedern | offen, Ursache unten |
| L2 | Pokémon Horizonte (158871) hat keine Folgenzahl (`episodes` fehlt, Serie läuft). Die Folgenliste kennt 122 Folgen, 89 mit deutschem Titel; Netflix-Bereich nur Folge 2–44. Das TV-Release (Super RTL, TOGGO plus) zählt 57 Folgen als `episodeCountAssumed`/`episodeCountNurGesichtet`. | `public/data/folgen/158871.json`, `releases.json` | Zahl nicht erfunden, bleibt offen; Teilstaffeln der Netflix-Fassung nicht belegbar (Netflix-Serienseiten tabu) |
| L3 | Reisen (112153) hängt am TV-Release „Staffel 24“ (42 Folgen, nur gesichtet), der Titel zählt 136. Keine TMDB-Staffel hat 136 Folgen (schon in `quellen.md`, L3 vermerkt). | `releases.json` `auto-112153-tv-toggo-plus` | offen |
| L4 | Erstausgabe „von“ bei XY (2018-04-20) und Sonne & Mond (2019-04-26) ist der früheste Disc-/aniSearch-Termin, nicht die TV-Premiere: XY läge sonst nach XYZ (2016-05-28). | `deErstausgabe` in `titles.json` | deutsche TV-Premiere nicht belegt (Quellen gesperrt) |
| L5 | Deutsche Titelnamen der Staffeln (Indigo-Liga … Reisen) und deutsche Starttermine je Staffel stehen nirgends im Datensatz, nur Sammelnamen. | `titles.json` | Quellen nötig: pokewiki/bisafans, fernsehserien.de |
| L6 | AniList kennt Horizonte nur als eine Kennung; weitere Teile (japanisch seit 2025) fehlen im Katalog, falls AniList sie getrennt führt. | nicht prüfbar (AniList nicht erreichbar) | offen |

## Ursache

Die Reihe bildet Staffeln aus AniList-Kennungen (`hauptstaffeln()` und `staffelStaende()` in `shared/titles.ts`). AniList führt Pokémon in
wenigen langen Sammeleinträgen; die deutschen Staffelgrenzen stehen nur in `tmdb-folgen.json` (`s` je Folge) und kommen weder in `titles.json` noch in die Reihenkarte.
Das ist keine Pipeline-Regel, die Staffeln verwirft oder zusammenlegt: Eine Stichprobe über alle Folgensummen zeigt, dass jede Folge einem Titel gehört.
Ein kleinster Fix ohne neues Feld gibt es darum nicht: Er bräuchte (a) Staffelgrenzen je Sammeltitel aus TMDB (belegt, vorhanden), (b) deutsche Staffelnamen
und Starttermine aus pokewiki/fernsehserien (hier nicht erreichbar), (c) eine Darstellung in der Reihenkarte („Staffel 14–16“ statt „Staffel 4“).
Sicherer Bauweg: `data/pokemon-staffeln.yaml` mit `{titel, staffeln: [{nr, folgen, tmdb, deutscherName?, start?, quelle}]}`, nur mit Quelle je Zeile, gelesen von
`staffelStaende()` für die Beschriftung; Test: vorher „Staffel 4 von 13“, nachher „Staffeln 14–16 von 25“.

## Bilanz (vorher = nachher, es wurde kein Datensatz verändert)

- Reihe 527: 66 Mitglieder, davon 13 Hauptstaffeln; Folgen der Hauptstaffeln 1.234 (ohne Horizonte).
- TMDB Staffel 1–25: 1.235 Folgen. Abweichung 1 (Advanced Generation), 2 Folgen in Staffel 19 (siehe oben).
- Neue Zeilen: keine.

## Offene Liste (nächster Lauf, mit Zugriff auf die Wikis)

1. Deutsche Staffelnamen und TV-Starttermine für Staffel 1–25 aus pokewiki.de/bisafans.de und fernsehserien.de lesen (je Staffel eine Zeile mit URL und Abrufdatum).
2. `data/pokemon-staffeln.yaml` und Leser in `staffelStaende()` bauen (siehe Ursache), mit Test vorher rot, nachher grün.
3. Horizonte: Teile und Folgenzahl von Netflix-API/AniList prüfen (L2, L6); Reisen-TV-Release (L3) an die richtige Staffel hängen.
4. L4: TV-Premiere von XY und Sonne & Mond belegen, sonst `erstausgabe-von-hand.yaml` mit Quelle.
