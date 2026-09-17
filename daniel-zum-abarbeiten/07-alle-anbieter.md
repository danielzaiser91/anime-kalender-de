# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-09-17 · **9 offene Verweise** in **6 Zeilen**.

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
| [Joyn](07-joyn.md) | 9 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2024-09-05 | Spy × Family | [Code: White](https://www.joyn.de/filme/spy-x-family-code-white) |
| 2 | 2024-04-12 | Detektiv Conan | [Das 1-Million-Dollar-Pentagramm](https://www.joyn.de/filme/detektiv-conan-film-27-das-1-million-dollar-pentagram) |
| 3 | 2019-09-18 | Astra Lost in Space | [Hauptserie](https://www.joyn.de/serien/astra-lost-in-space) |
| 4 | 2014-06-25 | No Game No Life | [Hauptserie](https://www.joyn.de/serien/no-game-no-life) |
| 5 | 2012-01-26 | Bakugan: Spieler des Schicksals | [Hauptserie](https://www.joyn.de/serien/bakugan-battle-brawlers) · [Bakugan: Neu Vestroia](https://www.joyn.de/serien/bakugan-battle-brawlers) · [Bakugan: Invasion der Gundalianer](https://www.joyn.de/serien/bakugan-battle-brawlers) · [Bakugan: Mechtanium Surge](https://www.joyn.de/serien/bakugan-battle-brawlers) |
| 6 | 2007-09-29 | Guardian of the Spirit | [Hauptserie](https://www.joyn.de/serien/guardian-of-the-spirit) |

## Warum die einzelnen Anbieter unsicher sind

- **Joyn:** Joyn nennt die Sprachfassung nirgends öffentlich.
