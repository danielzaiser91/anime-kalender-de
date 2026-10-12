# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-10-12 · **36 offene Verweise** in **29 Zeilen**.

Erzeugt von `npm run data:dub-checks`, **nicht von Hand pflegen**. Was geprüft ist, gehört
nach `data/dub-confirmed.yaml`; beim nächsten Lauf verschwindet es hier.

**Eine Zeile ist eine Reihe auf einem Anbieter.** Wer den Verweis öffnet, sieht dort in aller
Regel alle Staffeln auf einmal und kann sie auch auf einmal beantworten. In der letzten Spalte
steht, welche Einträge dieser Reihe dort noch offen sind — bereits Bestätigtes fehlt dort.

Sortiert von heute in die Vergangenheit, ausschließlich Titel, die es schon gibt.

Zum Abarbeiten gibt es dieselben Zeilen in `dub-batches.md` — nach Nutzen sortiert und in
Paketen zu je zwanzig.

## Wie geantwortet wird

Kurzschrift, damit ein Batch in einer Zeile beantwortet werden kann (Daniel, 12.08.2026):

| Zeichen | Bedeutung | wird zu |
|---|---|---|
| `1` | hat deutsche Synchro | `dub: true` |
| `0` | keine deutsche Synchro, nur Untertitel | `dub: false` — Verweis bleibt mit ✕ |
| `x` | kein Video: nicht verfügbar, Verweis tot, Weiterleitung | `available: false` — Verweis wird entfernt |

Stehen in einer Zeile **mehrere** Einträge zum Prüfen, werden die Ergebnisse mit Punkt
getrennt in derselben Reihenfolge angegeben: `1.0` heißt „erster Eintrag ja, zweiter nein".
Eine **einzelne** Angabe gilt für alle Einträge der Zeile.

Beispiel: `1-x 2-1 3-1.0 4-x` — Zeile 1 tot, Zeile 2 Synchro, Zeile 3 erster Eintrag
Synchro und zweiter ohne, Zeile 4 tot.

| Offen je Anbieter | Verweise |
|---|---|
| [Prime Video](07-primevideo.md) | 12 |
| [Disney+](07-disneyplus.md) | 9 |
| [Netflix](07-netflix.md) | 8 |
| [ADN](07-adn.md) | 7 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-10-12 | Bleach | [The Movie - Memories of Nobody]() · [The Movie - The Diamond Dust Rebellion]() · [The Movie - Fade to Black]() · [The Movie - Hell Verse]() |
| 2 | 2026-10-09 | Gachiakuta | [Hauptserie]() |
| 3 | 2026-10-08 | 86: Eighty Six | [Hauptserie](https://animationdigitalnetwork.com/de/video/1423-eighty-six) · [Teil 2](https://animationdigitalnetwork.com/de/video/1423-eighty-six) |
| 4 | 2026-10-06 | My Hero Academia | [Vigilantes]() · [Vigilantes Staffel 2]() |
| 5 | 2026-10-04 | Spy × Family | [Teil 2]() · [Staffel 2]() |
| 6 | 2026-10-03 | Hände weg, Kotesashi-kun | [Hauptserie]() |
| 7 | 2026-10-01 | Demon Slayer: Kimetsu no Yaiba | [Hauptserie]() |
| 8 | 2026-09-28 | Demon Slayer: Kimetsu no Yaiba | [Infinity Castle]() |
| 9 | 2026-09-28 | Jujutsu Kaisen | [0]() |
| 10 | 2026-09-17 | Danganronpa | [Hauptserie]() |
| 11 | 2026-09-17 | Samurai Girls | [Hauptserie]() · [2: Samurai Bride]() |
| 12 | 2026-09-06 | Classroom of the Elite | [Hauptserie](https://www.disneyplus.com/browse/entity-99a9d6e4-9ca8-4cfd-ba86-1f7dd9ea19d3) |
| 13 | 2026-08-29 | Yu-Gi-Oh! (1998) | [Yu-Gi-Oh! GX]() |
| 14 | 2026-08-07 | Campfire Cooking in Another World with My Absurd Skill | [Hauptserie](https://www.disneyplus.com/browse/entity-fc20b0bc-90b6-45b3-b56a-ad3a5cb2b855) |
| 15 | 2026-06-05 | Gantz | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.c2f26fed-151e-48be-b492-70bd6178cc92) |
| 16 | 2025-04-03 | Devil May Cry | [Hauptserie](https://www.netflix.com/title/81506915) |
| 17 | 2025-01-24 | My Instant Death Ability Is So Overpowered, No One in This Other World Stands a Chance Against Me! | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.a9c30e42-2911-46e9-a7a3-5aeb0d26f6ac) |
| 18 | 2024-08-15 | Suicide Squad Isekai | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.1d496364-ffa3-40b8-b812-24cda00c0f60) |
| 19 | 2023-11-17 | Scott Pilgrim hebt ab | [Hauptserie](https://www.netflix.com/title/81153115) |
| 20 | 2023-08-10 | Mech Cadets | [Hauptserie](https://www.netflix.com/title/81004665) |
| 21 | 2023-07-07 | Dragon Ball | [Super: Broly](https://www.disneyplus.com/browse/entity-f50685d1-fd4d-4ba3-b575-efacb961fc89) |
| 22 | 2023-03-23 | Urusei Yatsura | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.e3405b7b-d35a-43bd-a17d-6e5bab369ae9) |
| 23 | 2022-10-21 | Oni: Die Geschichte der Donnergöttin | [Hauptserie](https://www.netflix.com/title/81028343) |
| 24 | 2021-03-04 | Pacific Rim: The Black | [Hauptserie](https://www.netflix.com/title/81002003) |
| 25 | 2020-12-12 | Fire Force | [Staffel 2](https://animationdigitalnetwork.de/video/fire-force-saison-2) |
| 26 | 2019-08-30 | Konosuba: God’s Blessing on This Wonderful World! | [KonoSuba: God’s Blessing on This Wonderful World! The Movie - Legend of Crimson](https://watch.amazon.de/detail?gti=amzn1.dv.gti.b573d76b-c7b2-4882-982f-9aedae5e6365) |
| 27 | 2019-03-15 | YooHoo: Retter in der Not | [Hauptserie](https://www.netflix.com/title/80212481) |
| 28 | 2014-03-23 | Yu-Gi-Oh! (1998) | [Yu-Gi-Oh! Zexal II](https://watch.amazon.de/detail?gti=amzn1.dv.gti.609f3517-1ac7-4afc-b4c2-de498d041832) |
| 29 | 1998-09-30 | Trigun | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.8cbba00e-0d43-4c48-bdfa-437e5762c51d) |

## Warum die einzelnen Anbieter unsicher sind

- **ADN:** Der Titel steht nicht im ADN-Bestand mit Sprachcode vde. Möglich, dass er inzwischen dazugekommen ist.
- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
