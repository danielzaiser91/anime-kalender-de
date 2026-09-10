# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-09-10 · **18 offene Verweise** in **14 Zeilen**.

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
| [Crunchyroll](07-crunchyroll.md) | 7 |
| [Prime Video](07-primevideo.md) | 1 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-08-28 | Nukitashi | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.234d22cb-bca3-4855-b0f7-04a79eecdbcd?tag=justat1218-21&token=491B3E20E8D6C755745FD7E34BCE779F25003CB2) |
| 2 | 2026-06-18 | Baki — the Grappler | [BAKI-DOU: The Invincible Samurai Teil 2](https://www.netflix.com/title/81922765) |
| 3 | 2025-07-17 | Sword Art Online | [Alicization - War of Underworld](https://www.netflix.com/title/70302573) · [Alicization - War of Underworld](https://www.netflix.com/title/70302573) |
| 4 | 2021-02-11 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Pretty Guardian Sailor Moon Eternal: Der Film](https://www.netflix.com/title/81214399) |
| 5 | 2020-06-17 | Dorohedoro | [Teuflische Anekdoten](https://www.netflix.com/title/80991903) |
| 6 | 2020-01-27 | Babylon | [Hauptserie](https://www.crunchyroll.com/series/G0XHWM5K7/babylon) |
| 7 | 2020-01-10 | Haikyu!! | [Lev ist hier!](https://www.netflix.com/title/80090673) · [Kampf gegen ungenügende Noten](https://www.netflix.com/title/80090673) · [Sonderbeitrag: Die Jugend beim Frühlingsturnier](https://www.netflix.com/title/80090673) · [An Land vs. In der Luft / Der ”Weg” des Balls](https://www.netflix.com/title/80090673) |
| 8 | 2019-06-29 | Cencoroll | [Connect](https://www.crunchyroll.com/cencoroll-connect/de-cencoroll-connect-unbekannt-850430) |
| 9 | 2019-03-20 | Hi Score Girl | [Extra Stage](https://www.netflix.com/title/80997338) |
| 10 | 2018-09-21 | Okko’s Inn | [Okko und ihre Geisterfreunde](https://www.crunchyroll.com/okkos-inn/okko-und-ihre-geisterfreunde-der-film-unbekannt-810007?ssid=397785) |
| 11 | 2017-08-25 | Your Voice: Kimikoe | [Hauptserie](https://www.crunchyroll.com/your-voice-kimikoe-/de-your-voice-kimikoe-unbekannt-850378) |
| 12 | 2014-03-27 | Love, Chunibyo & Other Delusions! | [Heart Throb](https://www.crunchyroll.com/love-chunibyo-other-delusions-heart-throb-) |
| 13 | 2011-02-23 | Durarara!! | [Hauptserie](https://www.crunchyroll.com/series/G619XVNEY/durarara) |
| 14 | 2000-10-24 | Sin: The Movie | [Hauptserie](http://www.crunchyroll.com/de/sin-the-movie) |

## Warum die einzelnen Anbieter unsicher sind

- **Crunchyroll:** Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
