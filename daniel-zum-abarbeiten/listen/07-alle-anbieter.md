# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-10-26 · **17 offene Verweise** in **14 Zeilen**.

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
| [Prime Video](07-primevideo.md) | 11 |
| [Netflix](07-netflix.md) | 5 |
| [Disney+](07-disneyplus.md) | 1 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-10-25 | Meine ganz besondere Hochzeit | [Special]() |
| 2 | 2026-10-15 | Sankarea: Undying Love | [Hauptserie]() |
| 3 | 2026-10-10 | Demon Slayer: Kimetsu no Yaiba | [Mugen Train Arc]() · [Entertainment District Arc]() · [Infinity Castle](https://www.amazon.de/gp/video/detail/B0GZSDPCV4) |
| 4 | 2026-10-07 | The Detective Is Already Dead | [Staffel 2]() |
| 5 | 2026-10-06 | My Hero Academia | [Vigilantes](https://www.netflix.com/title/82036361) · [Vigilantes Staffel 2](https://www.netflix.com/title/82036361) |
| 6 | 2026-10-03 | Hände weg, Kotesashi-kun | [Hauptserie]() |
| 7 | 2026-09-13 | Kuroko’s Basketball: | [Kuroko’s Basketball - Winter Cup Highlights Movie 3 Crossing the Door]() |
| 8 | 2026-08-29 | Yu-Gi-Oh! (1998) | [Yu-Gi-Oh! GX]() |
| 9 | 2025-04-03 | Devil May Cry | [Hauptserie](https://www.netflix.com/title/81506915) |
| 10 | 2023-07-23 | NieR:Automata Ver1.1a | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.f447a318-045f-4f1d-871d-f6ac4d53cf8a) |
| 11 | 2021-02-17 | Project Itoh: Genocidal Organ | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.78b91eef-2e25-9512-4024-a8c43ad3e1f9) |
| 12 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.netflix.com/title/81099976) |
| 13 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.amazon.de/gp/video/detail/B0FVF9T7ZP) |
| 14 | 2018-09-29 | Yunas Geisterhaus | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.31c2fcde-089d-47dd-bf2b-09bca0de572f) |

## Warum die einzelnen Anbieter unsicher sind

- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
