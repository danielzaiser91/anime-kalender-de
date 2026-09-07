# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-09-07 · **47 offene Verweise** in **30 Zeilen**.

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
| [Crunchyroll](07-crunchyroll.md) | 34 |
| [Netflix](07-netflix.md) | 9 |
| [Prime Video](07-primevideo.md) | 3 |
| [ADN](07-adn.md) | 1 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-08-28 | Nukitashi | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.234d22cb-bca3-4855-b0f7-04a79eecdbcd?tag=justat1218-21&token=491B3E20E8D6C755745FD7E34BCE779F25003CB2) |
| 2 | 2026-06-18 | Baki — the Grappler | [BAKI-DOU: The Invincible Samurai Teil 2](https://www.netflix.com/title/81922765) |
| 3 | 2026-03-31 | Mushoku Tensei: Jobless Reincarnation | [Eris auf Goblinjagd](https://www.netflix.com/title/80987039) |
| 4 | 2026-03-25 | Meine Wiedergeburt als Schleim in einer anderen Welt | [Hauptserie](http://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) |
| 5 | 2025-06-11 | Sword Art Online | [Extra Edition](http://www.crunchyroll.com/de/sword-art-online) |
| 6 | 2024-09-22 | Plus-Sized Elf | [Hauptserie](https://animationdigitalnetwork.de/video/50-nuances-de-gras) |
| 7 | 2024-09-20 | Given | [The Movie - To the Sea](https://www.crunchyroll.com/watch/GE00266947DEDE/given-the-movie-to-the-sea) |
| 8 | 2024-04-09 | Free! Iwatobi Swim Club | [High Speed! Free! Starting Days](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! -Timeless Medley- The Bond](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Timeless Medley](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Take Your Marks](https://www.crunchyroll.com/de/series/GRDQV2VWY/free---iwatobi-swim-club) · [Free! the Final Stroke: The First Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! the Final Stroke: The Second Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) |
| 9 | 2023-12-01 | Rascal Does Not Dream of Bunny Girl Senpai | [Rascal Does Not Dream of a Sister Venturing Out](https://www.crunchyroll.com/watch/G0DUMXDPZ/rascal-does-not-dream-of-a-sister-venturing-out) · [Rascal Does Not Dream of a Knapsack Kid](https://www.crunchyroll.com/watch/GWDU73EX8/rascal-does-not-dream-of-a-knapsack-kid) |
| 10 | 2022-02-18 | Fruits Basket | [Hauptserie](https://www.crunchyroll.com/fruits-basket) · [Prelude](https://www.crunchyroll.com/de/fruits-basket) |
| 11 | 2021-03-26 | The Promised Neverland | [Staffel 2](https://www.crunchyroll.com/de/the-promised-neverland) |
| 12 | 2021-02-11 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Pretty Guardian Sailor Moon Eternal: Der Film](https://www.netflix.com/title/81214399) |
| 13 | 2020-06-27 | Kaguya-sama: Love Is War | [Hauptserie](https://www.crunchyroll.com/de/kaguya-sama-love-is-war) · [?](https://www.crunchyroll.com/de/kaguya-sama-love-is-war) |
| 14 | 2020-06-17 | Dorohedoro | [Teuflische Anekdoten](https://www.netflix.com/title/80991903) |
| 15 | 2020-04-04 | My Hero Academia | [4](https://www.amazon.de/dp/B0CC5DX1T7) |
| 16 | 2020-03-27 | One Punch Man | [OVAs](https://www.crunchyroll.com/watch/GPWU8KM42/the-shadow-that-snuck-up-too-close) · [Staffel 2 OVAs](https://www.crunchyroll.com/watch/G9DU9E4QG/saitama-and-the-mediocre-gang) |
| 17 | 2020-01-10 | Haikyu!! | [Lev ist hier!](https://www.netflix.com/title/80090673) · [Kampf gegen ungenügende Noten](https://www.netflix.com/title/80090673) · [Sonderbeitrag: Die Jugend beim Frühlingsturnier](https://www.netflix.com/title/80090673) · [An Land vs. In der Luft / Der ”Weg” des Balls](https://www.netflix.com/title/80090673) |
| 18 | 2019-06-29 | Cencoroll | [Connect](https://www.crunchyroll.com/cencoroll-connect/de-cencoroll-connect-unbekannt-850430) |
| 19 | 2019-03-20 | Hi Score Girl | [Extra Stage](https://www.netflix.com/title/80997338) |
| 20 | 2018-09-21 | Okko’s Inn | [Okko und ihre Geisterfreunde](https://www.crunchyroll.com/okkos-inn/okko-und-ihre-geisterfreunde-der-film-unbekannt-810007?ssid=397785) |
| 21 | 2018-04-21 | Sound! Euphonium | [Hauptserie](http://www.crunchyroll.com/de/sound-euphonium) · [Liz und der Blaue Vogel](https://www.crunchyroll.com/liz-and-the-blue-bird/de-liz-und-der-blaue-vogel-unbekannt-850428) |
| 22 | 2017-08-25 | Your Voice: Kimikoe | [Hauptserie](https://www.crunchyroll.com/your-voice-kimikoe-/de-your-voice-kimikoe-unbekannt-850378) |
| 23 | 2014-09-23 | Hamatora: The Animation | [Hauptserie](http://www.crunchyroll.com/hamatora/episode-1-file-01-egg-of-columbus-648733) · [Re:␣Hamatora](http://www.crunchyroll.com/hamatora/episode-1-melancholy-of-hero-657029) |
| 24 | 2014-09-16 | Love, Chunibyo & Other Delusions! | [Heart Throb](https://www.crunchyroll.com/love-chunibyo-other-delusions-heart-throb-) · [Love, Chunibyo & Other Delusions: Heart Throb - Offenbarung des wahren Auges des bösen Königs … Wiederholung](https://www.crunchyroll.com/love-chunibyo-other-delusions-heart-throb-/episode-13-799361?ssid=387047) |
| 25 | 2012-03-24 | Shakugan no Shana | [Season III](https://www.amazon.de/s?k=Shakugan%20no%20Shana%3A%20Season%20III&i=instant-video) |
| 26 | 2002-09-14 | Millennium Actress | [Hauptserie](https://www.crunchyroll.com/watch/GPWUKPVP4/millennium-actress-german-dub) |
| 27 | 2000-10-24 | Sin: The Movie | [Hauptserie](http://www.crunchyroll.com/de/sin-the-movie) |
| 28 | 1998-08-01 | Mobile Suit Gundam | [Gundam Wing: Endless Waltz](http://www.crunchyroll.com/mobile-suit-gundam-wing-endless-waltz/mobile-suit-gundam-wing-endless-waltz-gundam-wing-endless-waltz-732801) |
| 29 | 1997-08-01 | Kimba, der weiße Löwe | [Jungle Emperor Leo: Der Kinofilm](https://www.crunchyroll.com/de/jungle-emperor-leo) |
| 30 | 1994-08-06 | Street Fighter II V | [Street Fighter II: The Animated Movie](https://www.crunchyroll.com/de/street-fighter-ii-the-animated-movie) |

## Warum die einzelnen Anbieter unsicher sind

- **ADN:** Der Titel steht nicht im ADN-Bestand mit Sprachcode vde. Möglich, dass er inzwischen dazugekommen ist.
- **Crunchyroll:** Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
