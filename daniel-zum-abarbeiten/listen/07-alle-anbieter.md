# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-11-16 · **37 offene Verweise** in **31 Zeilen**.

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
| [Netflix](07-netflix.md) | 27 |
| [Prime Video](07-primevideo.md) | 7 |
| [Disney+](07-disneyplus.md) | 2 |
| [Pluto TV](07-plutotv.md) | 1 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-11-06 | Failure Frame: I Became the Strongest and Annihilated Everything with Low-Level Spells | [Hauptserie](https://www.netflix.com/title/81910037) |
| 2 | 2026-10-25 | Meine ganz besondere Hochzeit | [Special](https://www.netflix.com/title/82643530) |
| 3 | 2026-10-15 | Sankarea: Undying Love | [Hauptserie]() |
| 4 | 2026-10-10 | Demon Slayer: Kimetsu no Yaiba | [Mugen Train Arc]() · [Entertainment District Arc]() |
| 5 | 2026-10-06 | My Hero Academia | [Vigilantes Staffel 2](https://www.netflix.com/title/82036361) |
| 6 | 2026-09-26 | Welcome to Demon School! Iruma-kun | [Staffel 4](https://www.disneyplus.com/browse/entity-b042544d-cd7d-40c6-9be4-db79666a1b51) |
| 7 | 2026-09-20 | A Sign of Affection | [Hauptserie](https://www.netflix.com/title/81748453) |
| 8 | 2026-09-07 | 2.5 Dimensional Seduction — 2.5 Dimensional Seduction | [2.5 Dimensional Seduction](https://www.netflix.com/title/81909977) |
| 9 | 2026-08-29 | Yu-Gi-Oh! (1998) | [Yu-Gi-Oh! GX]() |
| 10 | 2026-08-05 | Slam Dunk | [The First Slam Dunk](https://www.netflix.com/title/81765372) |
| 11 | 2026-07-19 | Wistoria: Wand and Sword | [Hauptserie](https://www.netflix.com/title/81900358) · [Hauptserie](https://www.netflix.com/title/81900358) |
| 12 | 2026-06-22 | Atelier of Witch Hat | [Hauptserie](https://www.netflix.com/title/82741721) |
| 13 | 2025-04-09 | Possibly the Greatest Alchemist of All Time | [Hauptserie](https://www.netflix.com/title/82058586) |
| 14 | 2024-10-20 | Uzumaki | [Hauptserie](https://www.netflix.com/title/81943371) |
| 15 | 2024-09-20 | Overlord | [The Sacred Kingdom](https://www.netflix.com/title/82040442) |
| 16 | 2024-09-05 | Spy × Family | [Code: White](https://www.netflix.com/title/81924850) |
| 17 | 2024-07-19 | Wind Breaker | [Hauptserie](https://www.netflix.com/title/81771389) |
| 18 | 2024-03-31 | Solo Leveling | [Hauptserie](https://www.netflix.com/title/81748512) |
| 19 | 2023-06-18 | Die Parallelwelt-Chroniken des Aristokraten | [Hauptserie](https://www.netflix.com/title/81768275) |
| 20 | 2023-02-17 | Blue Giant | [Hauptserie](https://www.netflix.com/title/81763062) |
| 21 | 2022-08-10 | One Piece | [Abenteuer in Alabasta - Die Wüstenprinzessin](https://www.netflix.com/title/70086565) |
| 22 | 2022-04-15 | Detektiv Conan | [Die Kreuzung des Labyrinths](https://www.netflix.com/title/81757599) · [Magic Kaito: Kid the Phantom Thief](https://www.netflix.com/title/81757633) · [Die Sonnenblumen des Infernos](https://www.netflix.com/title/81757600) · [Der purpurrote Liebesbrief](https://www.netflix.com/title/81757605) · [Die Halloween-Braut](https://www.netflix.com/title/81757621) |
| 23 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.netflix.com/title/81099976) |
| 24 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.amazon.de/gp/video/detail/B0FVF9T7ZP) |
| 25 | 2019-12-13 | Dr. Stone | [Hauptserie](https://pluto.tv/gsa/shows/dr-stone/) |
| 26 | 2014-12-11 | Chaika, die Sargprinzessin | [Avenging Battle](https://www.amazon.de/gp/video/detail/B07MXMCF4V) |
| 27 | 2009-03-27 | Black Butler | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.6aad68c8-1e46-46e9-be1e-3d4de43488a5) |
| 28 | 2006-09-01 | Ghost in the Shell: Stand Alone Complex | [Solid State Society](https://www.netflix.com/title/70071919) |
| 29 | 2004-05-18 | Paranoia Agent | [Hauptserie](https://www.netflix.com/title/70014551) |
| 30 | 2004-04-17 | Appleseed: Kampf um die Freiheit | [Appleseed](https://www.netflix.com/title/70023531) |
| 31 | 2003-10-22 | Ikki Tousen: Dragon Girls | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.1374d3dd-9d96-4d41-b0f8-38932f0c9145) |

## Warum die einzelnen Anbieter unsicher sind

- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Pluto TV:** —
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
