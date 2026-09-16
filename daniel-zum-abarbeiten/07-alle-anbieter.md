# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-09-16 · **24 offene Verweise** in **18 Zeilen**.

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
| [Crunchyroll](07-crunchyroll.md) | 9 |
| [Prime Video](07-primevideo.md) | 6 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-03-31 | Classroom of the Elite | [Hauptserie](https://www.amazon.de/dp/B0GGJKGT5P) · [Staffel 2](https://www.amazon.de/dp/B0F1DKXTW7) |
| 2 | 2026-03-31 | Trapped in a Dating Sim: The World of Otome Games Is Tough for Mobs | [Hauptserie](https://www.amazon.de/dp/B0CJRDG5R6) |
| 3 | 2024-09-05 | Spy × Family | [Code: White](https://www.joyn.de/filme/spy-x-family-code-white) |
| 4 | 2024-04-12 | Detektiv Conan | [Das 1-Million-Dollar-Pentagramm](https://www.joyn.de/filme/detektiv-conan-film-27-das-1-million-dollar-pentagram) |
| 5 | 2023-06-20 | Kizuna no Allele | [Hauptserie](https://www.amazon.de/dp/B0BX2L1CQJ) |
| 6 | 2023-06-16 | Black Clover | [Sword of the Wizard King](https://www.crunchyroll.com/de/series/GRE50KV36/black-clover) |
| 7 | 2022-07-07 | Ponkotsu Quest: Maou to Haken no Mamono-tachi | [Vinland Saga](https://www.amazon.de/dp/B0C55SJB1W) |
| 8 | 2021-12-01 | JoJo’s Bizarre Adventure | [Stone Ocean](https://www.crunchyroll.com/de/series/GYP8DP1MY/jojos-bizarre-adventure) |
| 9 | 2021-10-21 | Kaguya-sama: Love Is War | [Ultra Romantic: Ishigami Yu möchte sich unterhalten](https://www.crunchyroll.com/de/series/GRJ0J828Y/kaguya-sama-love-is-war) |
| 10 | 2021-03-26 | The Promised Neverland | [Staffel 2](https://www.crunchyroll.com/de/series/GYVD2K1WY/the-promised-neverland) |
| 11 | 2019-09-21 | Fruits Basket | [Hauptserie](https://www.crunchyroll.com/de/series/G6ZJMGEXY/fruits-basket-2019) |
| 12 | 2019-09-18 | Astra Lost in Space | [Hauptserie](https://www.joyn.de/serien/astra-lost-in-space) |
| 13 | 2015-12-26 | Highschool D×D | [Mini-Episoden](https://www.crunchyroll.com/de/series/GR2P21J9R/high-school-dxd) · [BorN: Mini-Episoden](https://www.crunchyroll.com/de/series/GR2P21J9R/high-school-dxd) |
| 14 | 2014-06-25 | No Game No Life | [Hauptserie](https://www.joyn.de/serien/no-game-no-life) |
| 15 | 2012-12-28 | Blue Exorcist | [Kuro reißt aus](https://www.crunchyroll.com/de/series/G649PJ0JY/blue-exorcist) · [The Movie](https://www.crunchyroll.com/de/series/G649PJ0JY/blue-exorcist) |
| 16 | 2012-09-22 | Kuroko’s Basketball: | [Staffel 1](https://www.amazon.de/dp/B09P9P9YG6) |
| 17 | 2012-01-26 | Bakugan: Spieler des Schicksals | [Hauptserie](https://www.joyn.de/serien/bakugan-battle-brawlers) · [Bakugan: Neu Vestroia](https://www.joyn.de/serien/bakugan-battle-brawlers) · [Bakugan: Invasion der Gundalianer](https://www.joyn.de/serien/bakugan-battle-brawlers) · [Bakugan: Mechtanium Surge](https://www.joyn.de/serien/bakugan-battle-brawlers) |
| 18 | 2007-09-29 | Guardian of the Spirit | [Hauptserie](https://www.joyn.de/serien/guardian-of-the-spirit) |

## Warum die einzelnen Anbieter unsicher sind

- **Crunchyroll:** Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.
- **Joyn:** Joyn nennt die Sprachfassung nirgends öffentlich.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
