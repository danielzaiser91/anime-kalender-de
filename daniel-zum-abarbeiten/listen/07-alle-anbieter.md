# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-11-17 · **23 offene Verweise** in **22 Zeilen**.

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
| [Netflix](07-netflix.md) | 10 |
| [Prime Video](07-primevideo.md) | 7 |
| [Disney+](07-disneyplus.md) | 5 |
| [Pluto TV](07-plutotv.md) | 1 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-11-06 | Failure Frame: I Became the Strongest and Annihilated Everything with Low-Level Spells | [Hauptserie](https://www.netflix.com/title/81910037) |
| 2 | 2026-10-25 | Meine ganz besondere Hochzeit | [Special](https://www.netflix.com/title/82643530) |
| 3 | 2026-10-15 | Sankarea: Undying Love | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.0eb67270-d83b-933e-eb7e-4a5660d69c31) |
| 4 | 2026-10-10 | Demon Slayer: Kimetsu no Yaiba | [Mugen Train Arc]() · [Entertainment District Arc]() |
| 5 | 2026-10-06 | My Hero Academia | [Vigilantes Staffel 2](https://www.netflix.com/title/82036361) |
| 6 | 2026-09-29 | Demon Slayer: Kimetsu no Yaiba | [Infinity Castle](https://www.disneyplus.com/browse/entity-b8b65a37-0205-4771-bd07-24b5c4406034) |
| 7 | 2026-09-28 | Jujutsu Kaisen | [0](https://www.disneyplus.com/browse/entity-7c74ce17-ce8d-42d7-b2b5-afc0db501194) |
| 8 | 2026-09-26 | Welcome to Demon School! Iruma-kun | [Staffel 4](https://www.disneyplus.com/browse/entity-b042544d-cd7d-40c6-9be4-db79666a1b51) |
| 9 | 2026-09-23 | Thunder 3 | [Hauptserie](https://www.netflix.com/title/82736186) |
| 10 | 2026-08-30 | Black Clover | [Hauptserie](https://www.disneyplus.com/browse/entity-484054dc-6486-477a-a31a-87163fbbb65a) |
| 11 | 2026-08-05 | Star Wars: Visionen | [präsentiert - Die neunte Jedi](https://www.disneyplus.com/de-de/browse/entity-921588f0-9a3b-4cd6-80d6-0a7cc9ed388a) |
| 12 | 2026-06-22 | Atelier of Witch Hat | [Hauptserie](https://www.netflix.com/title/82741721) |
| 13 | 2025-04-09 | Possibly the Greatest Alchemist of All Time | [Hauptserie](https://www.netflix.com/title/82058586) |
| 14 | 2024-10-20 | Uzumaki | [Hauptserie](https://www.netflix.com/title/81943371) |
| 15 | 2024-09-20 | Overlord | [The Sacred Kingdom](https://www.netflix.com/title/82040442) |
| 16 | 2024-09-05 | Spy × Family | [Code: White](https://www.netflix.com/title/81924850) |
| 17 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.netflix.com/title/81099976) |
| 18 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.amazon.de/gp/video/detail/B0FVF9T7ZP) |
| 19 | 2019-12-13 | Dr. Stone | [Hauptserie](https://pluto.tv/gsa/shows/dr-stone/) |
| 20 | 2014-12-11 | Chaika, die Sargprinzessin | [Avenging Battle](https://www.amazon.de/gp/video/detail/B07MXMCF4V) |
| 21 | 2009-03-27 | Black Butler | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.6aad68c8-1e46-46e9-be1e-3d4de43488a5) |
| 22 | 2003-10-22 | Ikki Tousen: Dragon Girls | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.1374d3dd-9d96-4d41-b0f8-38932f0c9145) |

## Warum die einzelnen Anbieter unsicher sind

- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Pluto TV:** —
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
