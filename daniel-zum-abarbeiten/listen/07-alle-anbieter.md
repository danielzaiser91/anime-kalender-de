# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-11-04 · **87 offene Verweise** in **69 Zeilen**.

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
| [Netflix](07-netflix.md) | 70 |
| [Prime Video](07-primevideo.md) | 14 |
| [Disney+](07-disneyplus.md) | 3 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-11-03 | Honey Lemon Soda | [Hauptserie]() |
| 2 | 2026-11-03 | No Game No Life | [Zero](https://www.netflix.com/title/81068687) |
| 3 | 2026-10-25 | Meine ganz besondere Hochzeit | [Special](https://www.netflix.com/title/82643530) |
| 4 | 2026-10-15 | Sankarea: Undying Love | [Hauptserie]() |
| 5 | 2026-10-10 | Demon Slayer: Kimetsu no Yaiba | [Mugen Train Arc]() · [Entertainment District Arc]() |
| 6 | 2026-10-08 | Kamisama Kiss | [Hauptserie](https://www.netflix.com/title/80070071) |
| 7 | 2026-10-06 | My Hero Academia | [Vigilantes Staffel 2](https://www.netflix.com/title/82036361) |
| 8 | 2026-09-28 | Jujutsu Kaisen | [0](https://www.netflix.com/title/81602834) |
| 9 | 2026-09-26 | Welcome to Demon School! Iruma-kun | [Staffel 4](https://www.disneyplus.com/browse/entity-b042544d-cd7d-40c6-9be4-db79666a1b51) |
| 10 | 2026-08-29 | Yu-Gi-Oh! (1998) | [Yu-Gi-Oh! GX]() |
| 11 | 2026-08-27 | Aesthetica of a Rogue Hero | [Hauptserie](https://www.amazon.de/gp/video/detail/B0GVKRLHXX) |
| 12 | 2026-08-21 | Vampire Knight | [Guilty](https://www.netflix.com/title/70309457) |
| 13 | 2026-08-05 | Slam Dunk | [The First Slam Dunk](https://www.netflix.com/title/81765372) |
| 14 | 2026-07-24 | Parasyte: The Maxim | [Hauptserie](https://www.netflix.com/title/80191008) |
| 15 | 2025-04-03 | Devil May Cry | [Hauptserie](https://www.netflix.com/title/81506915) |
| 16 | 2024-09-20 | Overlord | [The Sacred Kingdom](https://www.netflix.com/title/82040442) |
| 17 | 2024-09-05 | Spy × Family | [Code: White](https://watch.amazon.de/detail?gti=amzn1.dv.gti.a3523598-4cd6-4004-8763-f4fbb45e0ac6) |
| 18 | 2024-08-02 | My Hero Academia | [You’re Next](https://watch.amazon.de/detail?gti=amzn1.dv.gti.c903bcab-b4d5-4bdb-b418-70ab5650132e) |
| 19 | 2024-07-19 | Wind Breaker | [Hauptserie](https://www.netflix.com/title/81771389) |
| 20 | 2024-06-30 | Captain Tsubasa: Die tollen Fußballstars | [Captain Tsubasa: Staffel 2 - Die Junioren](https://www.netflix.com/title/81003894) |
| 21 | 2024-04-20 | Mashle: Magic and Muscles | [Hauptserie](https://www.netflix.com/title/81685164) · [The Divine Visionary Candidate Exam Arc](https://www.netflix.com/title/81685164) |
| 22 | 2024-04-19 | Bluelock | [Blue Lock: The Movie - Episode Nagi](https://watch.amazon.de/detail?gti=amzn1.dv.gti.ae9245d5-07c5-41ce-ba90-d9f8779f046c) |
| 23 | 2024-02-16 | Haikyu!! | [Das Play-off der Müllhalde](https://watch.amazon.de/detail?gti=amzn1.dv.gti.467b800e-3262-4857-82b7-ed7a8634cb5b) |
| 24 | 2024-01-30 | Zom 100: Bucket List of the Dead | [Hauptserie](https://www.netflix.com/title/81680101) |
| 25 | 2023-07-07 | Resident Evil: Infinite Darkness | [Resident Evil: Death Island](https://www.netflix.com/title/81714596) |
| 26 | 2023-04-28 | GREEN DA KA RA × Mirai no Mirai | [Mirai: Das Mädchen aus der Zukunft](https://www.netflix.com/title/81004268) |
| 27 | 2023-04-28 | Mobile Suit Gundam | [Cucuruz Doan’s Island](https://watch.amazon.de/detail?gti=amzn1.dv.gti.c38ba568-4a91-4796-ac66-2577e5c97b8a) |
| 28 | 2023-02-17 | Blue Giant | [Hauptserie](https://www.netflix.com/title/81763062) |
| 29 | 2022-08-10 | One Piece | [Abenteuer in Alabasta - Die Wüstenprinzessin](https://www.netflix.com/title/70086565) · [Chopper und das Wunder der Winterkirschblüte](https://www.netflix.com/title/80998780) · [Z](https://www.netflix.com/title/80198443) · [3D2Y: Überwinde Ace’s Tod! Das Gelübde der Kameraden](https://www.netflix.com/title/81679587) |
| 30 | 2022-02-04 | The Deer King | [Hauptserie](https://www.netflix.com/title/81700393) |
| 31 | 2021-07-16 | Belle | [Hauptserie](https://www.netflix.com/title/81492822) |
| 32 | 2021-04-17 | Cells at Work! | [Hauptserie](https://www.netflix.com/title/81028791) · [! Staffel 2](https://www.netflix.com/title/81028791) · [Code Black](https://www.netflix.com/title/81392162) |
| 33 | 2021-04-14 | Lu over the Wall | [Hauptserie](https://www.netflix.com/title/80238911) |
| 34 | 2020-12-19 | Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth | [Hauptserie](https://www.netflix.com/title/80185873) · [II](https://www.netflix.com/title/80185873) · [III](https://www.netflix.com/title/80185873) |
| 35 | 2020-10-16 | Demon Slayer: Kimetsu no Yaiba | [The Movie: Mugen Train](https://www.netflix.com/title/81410810) |
| 36 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.netflix.com/title/81099976) |
| 37 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.amazon.de/gp/video/detail/B0FVF9T7ZP) |
| 38 | 2019-09-07 | The Legend of Luoxiaohei | [The Legend of Hei: Die Kraft in dir](https://www.netflix.com/title/81427481) |
| 39 | 2019-06-07 | Children of the Sea | [Hauptserie](https://www.netflix.com/title/81208104) |
| 40 | 2019-05-31 | LUPIN THE IIIRD: Zenigata and the Two Lupins | [Lupin III.: Fujiko Mines Lüge](https://watch.amazon.de/detail?gti=amzn1.dv.gti.077c1435-754d-407d-9d26-9ddb34a272d0) |
| 41 | 2018-09-21 | Okko’s Inn | [Okko und ihre Geisterfreunde](https://www.netflix.com/title/81037597) |
| 42 | 2018-05-26 | Code Geass: Lelouch of the Rebellion | [Initiation](https://watch.amazon.de/detail?gti=amzn1.dv.gti.b0bb7dff-f320-0490-8aec-76f307a1f81d) · [Verherrlichung](https://watch.amazon.de/detail?gti=amzn1.dv.gti.88bb7e12-4a26-732f-eb5b-37733d139471) |
| 43 | 2018-03-26 | Beyblade Burst | [Evolution](https://www.netflix.com/title/81018295) |
| 44 | 2017-09-29 | Haikyu!! | [Movie 3 - Talent Und Gespür](https://www.netflix.com/title/81030151) · [Movie 4 - Ein Kampf der Konzepte](https://www.netflix.com/title/81030152) |
| 45 | 2017-08-18 | Fireworks: Alles eine Frage der Zeit | [Hauptserie](https://www.netflix.com/title/81000505) |
| 46 | 2017-06-13 | Mutafukaz | [Hauptserie](https://www.netflix.com/title/81037697) |
| 47 | 2016-06-27 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Sailor Moon R Movie: Gefährliche Blumen](https://www.netflix.com/title/26588007) · [Pretty Guardian Sailor Moon Crystal](https://www.netflix.com/title/80145747) · [Pretty Guardian Sailor Moon Crystal Season III](https://www.netflix.com/title/80145747) |
| 48 | 2015-11-21 | Girls & Panzer | [Girls und Panzer: Der Film](https://www.netflix.com/title/80159876) |
| 49 | 2015-03-29 | Aldnoah.Zero | [Hauptserie](https://www.netflix.com/title/80040104) · [2](https://www.netflix.com/title/80040104) |
| 50 | 2014-09-22 | Shojo-Mangaka Nozaki-kun | [Hauptserie](https://www.netflix.com/title/80081848) |
| 51 | 2014-07-31 | Dragon Nest: Die Chroniken von Altera | [Hauptserie](https://www.netflix.com/title/80084763) |
| 52 | 2014-06-21 | Lupin III.: Teil 1 | [Lupin III.: Daisuke Jigens Grabstein](https://watch.amazon.de/detail?gti=amzn1.dv.gti.f783e7fb-3d94-40aa-88fb-2009fc9bfe2c) |
| 53 | 2014-04-03 | Nagi no Asukara | [Hauptserie](https://www.netflix.com/title/80132218) |
| 54 | 2014-03-27 | Love, Chunibyo & Other Delusions! | [Hauptserie](https://www.netflix.com/title/80239860) · [Heart Throb](https://www.netflix.com/title/80239860) |
| 55 | 2013-06-27 | The Devil Is a Part-Timer! | [Hauptserie](https://www.netflix.com/title/80006149) |
| 56 | 2010-09-24 | Maid-sama | [Hauptserie](https://www.netflix.com/title/81104406) |
| 57 | 2009-08-14 | TRAVA: FIST PLANET | [Redline](https://www.netflix.com/title/70153298) |
| 58 | 2008-07-16 | Clannad | [OVA - Das Tomoyo Kapitel](https://www.netflix.com/title/70204963) |
| 59 | 2008-05-30 | Spice and Wolf | [Hauptserie](https://www.netflix.com/title/70205026) |
| 60 | 2007-03-03 | 5 Centimeters per Second | [Hauptserie](https://www.netflix.com/title/70093699) |
| 61 | 2006-09-27 | Higurashi no Naku Koro ni | [Hauptserie](https://www.netflix.com/title/70308793) |
| 62 | 2006-09-01 | Ghost in the Shell: Stand Alone Complex | [Ghost in the Shell](https://www.netflix.com/title/540533) · [Hauptserie](https://www.netflix.com/title/70213091) · [2nd GIG](https://www.netflix.com/title/70213091) · [Solid State Society](https://www.netflix.com/title/70071919) |
| 63 | 2004-12-25 | Samurai 7 | [Hauptserie](https://www.netflix.com/title/70205019) |
| 64 | 2004-05-18 | Paranoia Agent | [Hauptserie](https://www.netflix.com/title/70014551) |
| 65 | 2004-04-17 | Appleseed: Kampf um die Freiheit | [Appleseed](https://www.netflix.com/title/70023531) |
| 66 | 2004-03-28 | Sonic X | [Hauptserie](https://www.netflix.com/title/60036794) |
| 67 | 2003-09-27 | Mobile Suit Gundam Seed | [Hauptserie](https://www.netflix.com/title/80146549) |
| 68 | 2001-12-24 | Beyblade | [Hauptserie](https://www.netflix.com/title/70155614) |
| 69 | 1999-04-17 | Detektiv Conan | [Der Magier des letzten Jahrhunderts](https://www.netflix.com/title/70126871) |

## Warum die einzelnen Anbieter unsicher sind

- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
