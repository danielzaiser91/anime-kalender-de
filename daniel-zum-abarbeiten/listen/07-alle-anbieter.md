# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-11-02 · **55 offene Verweise** in **41 Zeilen**.

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
| [Netflix](07-netflix.md) | 49 |
| [Prime Video](07-primevideo.md) | 4 |
| [Disney+](07-disneyplus.md) | 2 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-10-25 | Meine ganz besondere Hochzeit | [Special]() |
| 2 | 2026-10-15 | Sankarea: Undying Love | [Hauptserie]() |
| 3 | 2026-10-10 | Demon Slayer: Kimetsu no Yaiba | [Mugen Train Arc]() · [Entertainment District Arc]() |
| 4 | 2026-10-08 | Kamisama Kiss | [Hauptserie](https://www.netflix.com/title/80070071) |
| 5 | 2026-10-06 | My Hero Academia | [Vigilantes Staffel 2](https://www.netflix.com/title/82036361) |
| 6 | 2026-09-26 | Welcome to Demon School! Iruma-kun | [Staffel 4](https://www.disneyplus.com/browse/entity-b042544d-cd7d-40c6-9be4-db79666a1b51) |
| 7 | 2026-08-29 | Yu-Gi-Oh! (1998) | [Yu-Gi-Oh! GX]() |
| 8 | 2026-08-21 | Vampire Knight | [Guilty](https://www.netflix.com/title/70309457) |
| 9 | 2026-07-24 | Parasyte: The Maxim | [Hauptserie](https://www.netflix.com/title/80191008) |
| 10 | 2025-04-03 | Devil May Cry | [Hauptserie](https://www.netflix.com/title/81506915) |
| 11 | 2022-08-10 | One Piece | [Abenteuer in Alabasta - Die Wüstenprinzessin](https://www.netflix.com/title/70086565) · [Chopper und das Wunder der Winterkirschblüte](https://www.netflix.com/title/80998780) · [Z](https://www.netflix.com/title/80198443) · [3D2Y: Überwinde Ace’s Tod! Das Gelübde der Kameraden](https://www.netflix.com/title/81679587) |
| 12 | 2021-04-14 | Lu over the Wall | [Hauptserie](https://www.netflix.com/title/80238911) |
| 13 | 2020-12-19 | Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth | [Hauptserie](https://www.netflix.com/title/80185873) · [II](https://www.netflix.com/title/80185873) · [III](https://www.netflix.com/title/80185873) |
| 14 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.netflix.com/title/81099976) |
| 15 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.amazon.de/gp/video/detail/B0FVF9T7ZP) |
| 16 | 2018-03-26 | Beyblade Burst | [Evolution](https://www.netflix.com/title/81018295) |
| 17 | 2017-09-29 | Haikyu!! | [Movie 3 - Talent Und Gespür](https://www.netflix.com/title/81030151) · [Movie 4 - Ein Kampf der Konzepte](https://www.netflix.com/title/81030152) |
| 18 | 2017-08-18 | Fireworks: Alles eine Frage der Zeit | [Hauptserie](https://www.netflix.com/title/81000505) |
| 19 | 2017-07-15 | No Game No Life | [Zero](https://www.netflix.com/title/81068687) |
| 20 | 2016-06-27 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Sailor Moon R Movie: Gefährliche Blumen](https://www.netflix.com/title/26588007) · [Pretty Guardian Sailor Moon Crystal](https://www.netflix.com/title/80145747) · [Pretty Guardian Sailor Moon Crystal Season III](https://www.netflix.com/title/80145747) |
| 21 | 2015-11-21 | Girls & Panzer | [Girls und Panzer: Der Film](https://www.netflix.com/title/80159876) |
| 22 | 2015-03-29 | Aldnoah.Zero | [Hauptserie](https://www.netflix.com/title/80040104) · [2](https://www.netflix.com/title/80040104) |
| 23 | 2014-09-22 | Shojo-Mangaka Nozaki-kun | [Hauptserie](https://www.netflix.com/title/80081848) |
| 24 | 2014-07-31 | Dragon Nest: Die Chroniken von Altera | [Hauptserie](https://www.netflix.com/title/80084763) |
| 25 | 2014-04-03 | Nagi no Asukara | [Hauptserie](https://www.netflix.com/title/80132218) |
| 26 | 2014-03-27 | Love, Chunibyo & Other Delusions! | [Hauptserie](https://www.netflix.com/title/80239860) · [Heart Throb](https://www.netflix.com/title/80239860) |
| 27 | 2013-06-27 | The Devil Is a Part-Timer! | [Hauptserie](https://www.netflix.com/title/80006149) |
| 28 | 2010-09-24 | Maid-sama | [Hauptserie](https://www.netflix.com/title/81104406) |
| 29 | 2009-08-14 | TRAVA: FIST PLANET | [Redline](https://www.netflix.com/title/70153298) |
| 30 | 2008-07-16 | Clannad | [OVA - Das Tomoyo Kapitel](https://www.netflix.com/title/70204963) |
| 31 | 2008-05-30 | Spice and Wolf | [Hauptserie](https://www.netflix.com/title/70205026) |
| 32 | 2007-03-03 | 5 Centimeters per Second | [Hauptserie](https://www.netflix.com/title/70093699) |
| 33 | 2006-09-27 | Higurashi no Naku Koro ni | [Hauptserie](https://www.netflix.com/title/70308793) |
| 34 | 2006-09-01 | Ghost in the Shell: Stand Alone Complex | [Ghost in the Shell](https://www.netflix.com/title/540533) · [Hauptserie](https://www.netflix.com/title/70213091) · [2nd GIG](https://www.netflix.com/title/70213091) · [Solid State Society](https://www.netflix.com/title/70071919) |
| 35 | 2004-12-25 | Samurai 7 | [Hauptserie](https://www.netflix.com/title/70205019) |
| 36 | 2004-05-18 | Paranoia Agent | [Hauptserie](https://www.netflix.com/title/70014551) |
| 37 | 2004-04-17 | Appleseed: Kampf um die Freiheit | [Appleseed](https://www.netflix.com/title/70023531) |
| 38 | 2004-03-28 | Sonic X | [Hauptserie](https://www.netflix.com/title/60036794) |
| 39 | 2003-09-27 | Mobile Suit Gundam Seed | [Hauptserie](https://www.netflix.com/title/80146549) |
| 40 | 2001-12-24 | Beyblade | [Hauptserie](https://www.netflix.com/title/70155614) |
| 41 | 1999-04-17 | Detektiv Conan | [Der Magier des letzten Jahrhunderts](https://www.netflix.com/title/70126871) |

## Warum die einzelnen Anbieter unsicher sind

- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
