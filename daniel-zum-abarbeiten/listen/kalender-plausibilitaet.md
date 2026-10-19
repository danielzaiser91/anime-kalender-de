# Kalender-Plausibilität: Treffer je Regel

Stand 2026-10-18 (Zahlen am Bestand des 18.10.; Handproben vom 16.10., Regel 6 am 18.10.) · **sechs Regeln, 29 Treffer**, von Hand geprüft: 5 je Regel mit Treffern, alle echt.
Neu erzeugen: `npm run check:kalender-plausibilitaet -- --liste`. Die Zahlen dürfen nur sinken (`tools/kalender-plausibilitaet-grenzen.json`).

| Regel | Treffer | Handprobe |
|---|---|---|
| 1. erschienen, aber „Ohne bekannten Termin“ | 0 | 21 Titel ohne Termin gegengeprüft: keiner hat Beobachtung, JustWatch oder Messung |
| 2. Ende belegt, trotzdem „≈“ oder geschätzter Termin | 0 | Fall vom 13.10. ist behoben |
| 3. „Sprache offen“ trotz gemessenem Deutsch | 4 (am 16.10.: 10) | 5/5 echt |
| 4. Ereignis ohne News | 2 | 2/2 echt |
| 5. Termin ohne Quelle | 15 | 5/5 echt |
| 6. Prime-Streaming-Termin verlinkt nur eine Amazon-Suche (`primeOhneTitelseite`, seit PR 1483) | 8 (nach PR 1483: 6) | 8/8 gezählt: Tank Chair und Sieben Ritter bekommen mit dem PR eine Titelseite, offen sind Yu-Gi-Oh S1, Demon Slayer (3) und Kuroko Movie 2 und 3; Disc-Suche zählt nicht |

## 3. „Sprache offen“ trotz gemessenem Deutsch (10)

Ursache: Diese Wege entstehen nach Bauphase 10 (`11-7-wege-aus-terminen`, Cartoon→Anime mit Herkunft TMDB), das Urteil der Erweiterung (`urteil-schliesst-luecken`) erreicht sie nicht mehr.

- [Your Name.](https://anime-kalender.de/#/datenbank?t=21519) — Prime Video, gemessen 13.10. (geprüft)
- [Spy×Family Cour 2](https://anime-kalender.de/#/datenbank?t=142838) — Disney+, Weg aus Termin, gemessen 15.10. (geprüft)
- [Spy×Family Staffel 2](https://anime-kalender.de/#/datenbank?t=158927) — Disney+, Weg aus Termin (geprüft)
- [YooHoo](https://anime-kalender.de/#/datenbank?t=10015342) — Netflix, Weg aus TMDB (geprüft)
- [Mech Cadets](https://anime-kalender.de/#/datenbank?t=10021027) — Netflix, Weg aus TMDB (geprüft)
- [Classroom of the Elite](https://anime-kalender.de/#/datenbank?t=98659), [Dragon Ball Super: Broly](https://anime-kalender.de/#/datenbank?t=101302), [Campfire Cooking](https://anime-kalender.de/#/datenbank?t=156067), [Pacific Rim: The Black](https://anime-kalender.de/#/datenbank?t=10015835), [Oni](https://anime-kalender.de/#/datenbank?t=10020607)

## 4. Ereignis ohne News (2)

Beide Starts haben in der ganzen Reihe keine einzige Meldung.

- [Ghost in the Shell (2026)](https://anime-kalender.de/#/datenbank?t=177699) — Prime-Start 07.07. (geprüft)
- [Vom Landei zum Schwertheiligen II](https://anime-kalender.de/#/datenbank?t=194829) — Prime-Start 08.07. (geprüft)

## 5. Termin ohne Quelle (15)

Ursache: Alle 15 sind `anisearch-<id>-<anbieter>`-Termine aus `pipeline/bau/13-7-erstausgabe-angebot.ts`. Dort ist `anisearchId` am Titel noch nicht gesetzt (setzt erst `13-2-auslieferung` an den Ausgabekopien), daher `sources: []`.

- [Fist of the North Star](https://anime-kalender.de/#/datenbank?t=169228), [Baki-Dou](https://anime-kalender.de/#/datenbank?t=176509), [Darwin’s Incident](https://anime-kalender.de/#/datenbank?t=177679), [Mission: Yozakura Family](https://anime-kalender.de/#/datenbank?t=182578), [Magilumiere Staffel 2](https://anime-kalender.de/#/datenbank?t=185692) (alle geprüft)
- [Bleach TYBW The Calamity](https://anime-kalender.de/#/datenbank?t=185874), [The Ramparts of Ice](https://anime-kalender.de/#/datenbank?t=186497), [Medalist Staffel 2](https://anime-kalender.de/#/datenbank?t=189275), [Gintama 2026](https://anime-kalender.de/#/datenbank?t=197474), [Milky Subway](https://anime-kalender.de/#/datenbank?t=204949), [Sparks of Tomorrow](https://anime-kalender.de/#/datenbank?t=103303), [Cosmic Princess Kaguya!](https://anime-kalender.de/#/datenbank?t=201903), [Nippon Sangoku](https://anime-kalender.de/#/datenbank?t=206914), [Chainsmoker Cat](https://anime-kalender.de/#/datenbank?t=207141), [Baki-Dou Teil 2](https://anime-kalender.de/#/datenbank?t=210032)
