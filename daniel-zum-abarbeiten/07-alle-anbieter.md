# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-09-18 · **8 offene Verweise** in **5 Zeilen**.

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
| [Crunchyroll](07-crunchyroll.md) | 5 |
| [Netflix](07-netflix.md) | 2 |
| [Prime Video](07-primevideo.md) | 1 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-09-18 | The Quintessential Quintuplets | [Hauptserie](https://www.netflix.com/title/81152346) · [2](https://www.netflix.com/title/81152346) |
| 2 | 2026-03-31 | Classroom of the Elite | [Hauptserie](https://www.amazon.de/dp/B0GGJKGT5P) |
| 3 | 2021-09-28 | Princess Principal | [Picture Drama](https://www.crunchyroll.com/de/series/GEXH3W414/princess-principal) · [Crown Handler - Chapter 1: BUSY EASY MONEY](https://www.crunchyroll.com/de/series/GEXH3W414/princess-principal) |
| 4 | 2020-03-27 | One Punch Man | [OVAs](https://www.crunchyroll.com/de/series/G63K98PZ6/one-punch-man) · [Staffel 2 OVAs](https://www.crunchyroll.com/de/series/G63K98PZ6/one-punch-man) |
| 5 | 2019-04-01 | Captain Tsubasa: Die tollen Fußballstars | [Captain Tsubasa](https://www.crunchyroll.com/series/GZJH3D7G9/captain-tsubasa) |

## Warum die einzelnen Anbieter unsicher sind

- **Crunchyroll:** Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
