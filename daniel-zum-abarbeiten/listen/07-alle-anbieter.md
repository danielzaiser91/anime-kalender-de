# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-10-18 · **28 offene Verweise** in **23 Zeilen**.

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
| [Prime Video](07-primevideo.md) | 14 |
| [Netflix](07-netflix.md) | 9 |
| [Disney+](07-disneyplus.md) | 5 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-10-15 | Sankarea: Undying Love | [Hauptserie]() |
| 2 | 2026-10-10 | Demon Slayer: Kimetsu no Yaiba | [Mugen Train Arc]() · [Entertainment District Arc]() · [Swordsmith Village Arc](https://www.amazon.de/gp/video/detail/B0FD7YTKWK) · [Hashira Training Arc](https://www.amazon.de/gp/video/detail/B0CYGQ9WSF) |
| 3 | 2026-10-09 | Gachiakuta | [Hauptserie]() |
| 4 | 2026-10-07 | The Detective Is Already Dead | [Staffel 2]() |
| 5 | 2026-10-06 | My Hero Academia | [Vigilantes]() · [Vigilantes Staffel 2]() |
| 6 | 2026-10-03 | Hände weg, Kotesashi-kun | [Hauptserie]() |
| 7 | 2026-09-28 | Demon Slayer: Kimetsu no Yaiba | [Infinity Castle]() |
| 8 | 2026-09-28 | Jujutsu Kaisen | [0]() |
| 9 | 2026-09-27 | As a Reincarnated Aristocrat, I’ll Use My Appraisal Skill to Rise in the World | [Staffel 3]() |
| 10 | 2026-09-26 | A Wild Last Boss Appeared! | [Staffel 2]() |
| 11 | 2026-09-20 | A Sign of Affection | [Hauptserie]() |
| 12 | 2026-09-17 | Danganronpa | [Hauptserie](https://www.amazon.de/gp/video/detail/B0CHK728W1) |
| 13 | 2026-09-17 | Samurai Girls | [Hauptserie](https://www.amazon.de/gp/video/detail/B0DP5DZW86) · [2: Samurai Bride](https://www.amazon.de/gp/video/detail/B0DND4SB6V) |
| 14 | 2026-09-13 | Kuroko’s Basketball: | [Kuroko’s Basketball Movie 3 – Winter Cup: Crossing the Door]() |
| 15 | 2026-08-29 | Yu-Gi-Oh! (1998) | [Yu-Gi-Oh! GX]() |
| 16 | 2025-04-03 | Devil May Cry | [Hauptserie](https://www.netflix.com/title/81506915) |
| 17 | 2024-12-13 | Der Herr der Ringe: Die Schlacht der Rohirrim | [Hauptserie](https://www.netflix.com/title/81783938) |
| 18 | 2023-08-10 | Mech Cadets | [Hauptserie](https://www.netflix.com/title/81004665) |
| 19 | 2022-10-21 | Oni: Die Geschichte der Donnergöttin | [Hauptserie](https://www.netflix.com/title/81028343) |
| 20 | 2021-03-04 | Pacific Rim: The Black | [Hauptserie](https://www.netflix.com/title/81002003) |
| 21 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.netflix.com/title/81099976) |
| 22 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.amazon.de/gp/video/detail/B0FVF9T7ZP) |
| 23 | 2019-03-15 | YooHoo: Retter in der Not | [Hauptserie](https://www.netflix.com/title/80212481) |

## Warum die einzelnen Anbieter unsicher sind

- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
