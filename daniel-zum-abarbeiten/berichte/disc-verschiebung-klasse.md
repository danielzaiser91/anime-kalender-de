# Disc-Verschiebung: Klasse (29.10.2026)

Stand: Daten von origin/main (Bestand 29.10.2026, `public/data/releases.json`, `data/disc-ausgaben.json`, `data/proposals/anime2you.json`); erzeugt mit einem Wegwerfskript im Scratchpad, das `aniSearchTermin`/`aniSearchGewinnt` aus `pipeline/lib/disc-anisearch-datum.ts` aufruft.

## 1. Angezeigter Disc-Termin weicht vom eindeutigen aniSearch-Datum ab
Zählbasis: 194 Disc-Releases in `releases.json`; 17 davon haben eine eindeutige aniSearch-Ausgabe (gleiche Box-/Volume-Nummer, genau ein Tag) mit abweichendem Tag; 9 werden vom neuen Bau korrigiert.

| Titel | angezeigt | aniSearch | aniSearch gelesen | jüngste Anime2You-Meldung | Ergebnis |
|---|---|---|---|---|---|
| Good Luck Girl! – Vol. 1 | 2026-11-20 | 2027-02-05 | 2026-10-03 | - | Quelle ohne bekanntes Veröffentlichungsdatum (bleibt) |
| Good Luck Girl! – Vol. 2 | 2027-02-05 | 2027-03-05 | 2026-10-03 | - | Quelle ohne bekanntes Veröffentlichungsdatum (bleibt) |
| Sakamoto Days: Teil 2 – Vol. 3 | 2026-11-13 | 2027-01-15 | 2026-10-13 | - | Quelle ohne bekanntes Veröffentlichungsdatum (bleibt) |
| Sakamoto Days: Teil 2 – Vol. 4 | 2026-12-25 | 2027-02-19 | 2026-10-13 | - | Quelle ohne bekanntes Veröffentlichungsdatum (bleibt) |
| Strike Witches (Staffel 2) – Vol. 1 | 2026-11-06 | 2026-11-27 | 2026-10-03 | 2026-10-02 | wird korrigiert |
| Virgin Road – Vol. 1 | 2026-10-30 | 2026-11-06 | 2026-10-12 | 2026-10-02 | wird korrigiert |
| Infinite Dendrogram – Vol. 2 | 2026-10-30 | 2026-11-13 | 2026-10-11 | 2026-10-02 | wird korrigiert |
| Sakamoto Days – Vol. 1 | 2026-10-30 | 2026-11-13 | 2026-10-13 | 2026-10-02 | wird korrigiert |
| Nukitashi – Vol. 1 | 2026-10-30 | 2026-10-23 | 2026-10-11 | 2026-10-02 | aniSearch-Tag liegt vor heute, unserer danach (bleibt, unklar) |
| Sakamoto Days – Vol. 2 | 2026-10-02 | 2026-12-11 | 2026-10-13 | - | Quelle ohne bekanntes Veröffentlichungsdatum (bleibt) |
| Bocchi the Rock! – Vol. 1 | 2026-11-06 | 2026-11-20 | 2026-10-03 | 2026-10-02 | wird korrigiert |
| Black Butler: Emerald Witch Arc – Vol. 1 | 2027-01-31 | 2026-10-02 | 2026-10-13 | 2026-08-18 | aniSearch-Tag liegt vor heute, unserer danach (bleibt, unklar) |
| Bocchi the Rock! – Vol. 2 | 2026-11-06 | 2026-12-04 | 2026-10-03 | 2026-09-01 | wird korrigiert |
| Spice and Wolf: Merchant Meets the Wise Wolf – Vol. 3 | 2026-12-04 | 2027-01-15 | 2026-10-13 | 2026-09-01 | wird korrigiert |
| Bocchi the Rock! – Vol. 3 | 2026-12-04 | 2027-01-15 | 2026-10-03 | 2026-09-01 | wird korrigiert |
| Call of the Night – Staffel 2 – Vol. 2 | 2026-11-20 | 2026-11-06 | 2026-10-03 | - | Quelle ohne bekanntes Veröffentlichungsdatum (bleibt) |
| Spice and Wolf: Merchant Meets the Wise Wolf – Vol. 4 | 2027-01-15 | 2027-02-05 | 2026-10-13 | 2026-09-01 | wird korrigiert |

## 2. Verschiebung erkannt, aber kein neues Datum gesetzt
Zählbasis: Anime2You-Vorschläge der Kategorie disc mit `pause: verschoben` und ohne Tabellenzeilen: 3.

| Veröffentlicht | Artikel | Adresse |
|---|---|---|
| 2026-10-16 | Neun Blu-ray-Termine von AniMoon, Crunchyroll und Hardball Films verschoben | https://www.anime2you.de/news/1061001/neun-animoon-crunchyroll-hardball-disc-verschiebungen/ |
| 2026-09-22 | Limitierte Collector’s Edition von »Gantz« verschoben | https://www.anime2you.de/news/1053051/gantz-collectors-edition-verschoben/ |
| 2026-07-31 | Disc-Release von »Bleach« auf unbestimmte Zeit verschoben | https://www.anime2you.de/news/1035998/bleach-disc-release-auf-unbestimmte-zeit-verschoben/ |

## 3. Antwort-Kasten „Auf Deutsch" vor dem ersten Disc-Termin (Nachtrag Daniel 18:00)
Zählbasis: `public/data/titles.json` und `releases.json` (Stand 29.10.2026); Titel, deren sämtliche Releases Discs sind und deren frühester Disc-Tag nach dem 29.10.2026 liegt (67); davon zeigt `berechneAntwort` (`web/src/components/detail/antwort-berechnen.ts`) bei 38 den Zustand `fertig` oder `teilweise`. Die meisten sind richtig (Neuauflagen alter deutscher Fassungen: Evangelion, Dragon Ball Z, Pokémon …). Falsch sind die, bei denen **nichts außer dem Sprecher-Beleg (`hasVoices`) und der künftigen Disc** für „auf Deutsch erschienen" spricht: kein Stream mit Synchro, kein belegtes Ende einer früheren deutschen Ausgabe (`deErstausgabe.bis`), `deErstausgabe.von` fehlt oder ist 2026 und liegt vor der ersten Disc:

| Kennung | Titel | frühester Disc | `deErstausgabe.von` |
|---|---|---|---|
| 129193 | Virgin Road: Die Henkerin und ihre Art zu leben | 2026-10-30 (nach dem Bau-Fix 2026-11-06) | 2026-04-11 (aniSearch, Sprachblock „Laufend", keine Ausgabe) |
| 13535 | Good Luck Girl! | 2026-11-20 | fehlt |
| 130003 | Bocchi the Rock! | 2026-11-06 | fehlt |
| 184639 | Anne Shirley | 2026-11-20 | 2026-07-17 |
| 174188 | Nukitashi: Welcome to Love Island! | 2026-10-30 | fehlt |

Ursache (belegt): Nicht das gepflegte `firstEpisodeDate` (der Handeintrag 2026-08-28 ist längst durch die Verschiebungen überschrieben, `releases.json` führt 2026-10-30), sondern `hatSynchro` (`hasVoices` oder `deErstausgabe.synchro`) im letzten Zweig von `berechneAntwort` (`if (hatSynchro || titleStatus(...) === 'erschienen') return fertigAntwort(...)`); bei Virgin Road kommt `deErstausgabe.von = 2026-04-11` aus dem deutschen Sprachblock von aniSearch (`pipeline/bau/anisearch-titel.ts`, `erstausgabeAus`) und liegt vor jeder Disc (Vol. 1 am 06.11.2026). Nicht in diesem PR: Der Kasten gehört zur Text-Umgestaltung (eigener PR); das Datum der ersten Disc wird durch diesen PR aber richtig.
