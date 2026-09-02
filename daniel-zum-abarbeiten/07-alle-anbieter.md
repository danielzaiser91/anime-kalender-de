# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-09-02 · **86 offene Verweise** in **56 Zeilen**.

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
| [Crunchyroll](07-crunchyroll.md) | 42 |
| [YouTube](07-youtube.md) | 16 |
| [ADN](07-adn.md) | 12 |
| [Netflix](07-netflix.md) | 10 |
| [Prime Video](07-primevideo.md) | 6 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-08-28 | Nukitashi | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.234d22cb-bca3-4855-b0f7-04a79eecdbcd?tag=justat1218-21&token=491B3E20E8D6C755745FD7E34BCE779F25003CB2) |
| 2 | 2026-06-18 | Baki | [BAKI-DOU: The Invincible Samurai Teil 2](https://www.netflix.com/title/81922765) |
| 3 | 2026-05-16 | Kill Blue | [Hauptserie](https://www.youtube.com/playlist?list=PLhGamQZtJ7K-rS4G9zn-Bsb93kgFIphCM) |
| 4 | 2026-03-31 | Mushoku Tensei: Jobless Reincarnation | [Eris auf Goblinjagd](https://www.netflix.com/title/80987039) |
| 5 | 2026-03-25 | Meine Wiedergeburt als Schleim in einer anderen Welt | [Hauptserie](http://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) |
| 6 | 2025-06-11 | Sword Art Online | [Extra Edition](http://www.crunchyroll.com/de/sword-art-online) |
| 7 | 2024-09-27 | NieR:Automata Ver1.1a | [Cour 2](https://www.crunchyroll.com/de/series/GNVHKNPW1/nierautomata-ver11a) |
| 8 | 2024-09-22 | Plus-Sized Elf | [Hauptserie](https://animationdigitalnetwork.de/video/50-nuances-de-gras) |
| 9 | 2024-04-09 | Free! Iwatobi Swim Club | [High Speed! Free! Starting Days](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! -Timeless Medley- The Bond](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Timeless Medley](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Take Your Marks](https://www.crunchyroll.com/de/series/GRDQV2VWY/free---iwatobi-swim-club) · [Free! the Final Stroke: The First Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! the Final Stroke: The Second Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) |
| 10 | 2024-03-27 | Gushing over Magical Girls | [Hauptserie](https://animationdigitalnetwork.de/video/looking-up-to-magical-girls) |
| 11 | 2023-12-13 | Pokémon Horizonte | [Pokémon: Winde aus Paldea](https://www.youtube.com/playlist?list=PLQWzKIaERirzLZWMu3M89ZEpsDt9YtDBM) · [Meisterdetektiv Pikachu und der verschwundene Pudding](https://www.youtube.com/watch?v=5yQSUimraSU) |
| 12 | 2023-10-01 | Edens Zero | [Staffel 2](https://animationdigitalnetwork.de/video/edens-zero-saison-2) |
| 13 | 2022-12-22 | Bibliophile Princess | [Hauptserie](https://animationdigitalnetwork.de/video/princess-of-the-bibliophile) |
| 14 | 2022-12-17 | I’ve Somehow Gotten Stronger When I Improved My Farm-Related Skills | [Hauptserie](https://animationdigitalnetwork.de/video/got-strong-raising-skills-farming) |
| 15 | 2022-11-22 | Tonikawa: Over the Moon for You | [Social Media](https://www.crunchyroll.com/de/tonikawa-over-the-moon-for-you) · [Uniform](https://www.crunchyroll.com/de/series/GRWMGGQ86/tonikawa-over-the-moon-for-you) |
| 16 | 2022-09-23 | When Will Ayumu Make His Move? | [Hauptserie](https://animationdigitalnetwork.de/video/a-quoi-tu-joues-ayumu-soredemo-ayumu-wa-yosetekuru) |
| 17 | 2022-09-12 | My Isekai Life: I Gained a Second Character Class and Became the Strongest Sage in the World! | [Hauptserie](https://animationdigitalnetwork.de/video/my-isekai-life) |
| 18 | 2022-02-18 | Fruits Basket | [Prelude](https://www.crunchyroll.com/de/fruits-basket) |
| 19 | 2021-12-23 | Pokémon | [Mystery Dungeon: Team Flinke Freunde](https://www.youtube.com/watch?v=rAOmQ-foqeg) · [Mystery Dungeon: Erkundungsteams Zeit und Dunkelheit](https://www.youtube.com/watch?v=V0PlwsTLoM0) · [Mystery Dungeon: Portale in die Unendlichkeit](https://www.youtube.com/watch?v=zbwSAruo3QU) · [Entwicklungen](https://youtube.com/playlist?list=PLQWzKIaERirwN5po6LduiSLm8qc7GtuAl&si=I6QtXoF-i7cfG2c8) |
| 20 | 2021-10-21 | Kaguya-sama: Love Is War | [Ultra Romantic: Ishigami Yu möchte sich unterhalten](https://www.youtube.com/watch?v=cxTxrKrYkcY) |
| 21 | 2021-07-30 | Fire Force | [Staffel 2 Miniepisoden](https://www.youtube.com/playlist?list=PLY_DM8ieCRPqNeMV1z2EJZDSgLWySL_Cx) |
| 22 | 2021-04-16 | Detektiv Conan | [Die scharlachrote Kugel](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.9c92f9a9-a36f-4f4e-8ccd-e0d6b3649bee) |
| 23 | 2021-03-26 | The Promised Neverland | [Staffel 2](https://www.crunchyroll.com/de/the-promised-neverland) |
| 24 | 2021-03-24 | Re:Zero - Starting Life in Another World | [Staffel 2](https://www.crunchyroll.com/de/rezero-starting-life-in-another-world-) · [Staffel 2](https://www.crunchyroll.com/de/rezero-starting-life-in-another-world-) |
| 25 | 2021-02-11 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Pretty Guardian Sailor Moon Eternal: Der Film](https://www.netflix.com/title/81214399) |
| 26 | 2020-12-17 | Sylvanian Families | [Mini-Episodes - Ivy](https://www.youtube.com/playlist?list=PLTYXZZKHiowqVVc80wtIBlUNCcRy2SKPV) · [Mini-Episoden - Klee](https://www.youtube.com/playlist?list=PLTYXZZKHiowqllFesHWXbJI3MVvxQU0Cz) · [Mini Episodes - Peony](https://www.youtube.com/playlist?list=PLduwKEaYhJ45z5Gf4Nj3jmsMvOFcpTikR) |
| 27 | 2020-06-27 | Kaguya-sama: Love Is War | [Hauptserie](https://www.crunchyroll.com/de/kaguya-sama-love-is-war) · [?](https://www.crunchyroll.com/de/kaguya-sama-love-is-war) |
| 28 | 2020-06-17 | Dorohedoro | [Teuflische Anekdoten](https://www.netflix.com/title/80991903) |
| 29 | 2020-04-04 | My Hero Academia | [4](https://www.amazon.de/s?k=My%20Hero%20Academia%20Season%204&i=instant-video) |
| 30 | 2020-03-27 | One Punch Man | [OVAs](https://www.crunchyroll.com/watch/GPWU8KM42/the-shadow-that-snuck-up-too-close) · [Staffel 2 OVAs](https://www.crunchyroll.com/watch/G9DU9E4QG/saitama-and-the-mediocre-gang) |
| 31 | 2020-01-10 | Haikyu!! | [Lev ist hier!](https://www.netflix.com/title/80090673) · [Kampf gegen ungenügende Noten](https://www.netflix.com/title/80090673) · [Sonderbeitrag: Die Jugend beim Frühlingsturnier](https://www.netflix.com/title/80090673) · [An Land vs. In der Luft / Der ”Weg” des Balls](https://www.netflix.com/title/80090673) |
| 32 | 2019-09-22 | Nicht schon wieder, Takagi-san | [Karakai Jozu no Takagi-san: Staffel 2](https://www.crunchyroll.com/series/G6X0P133Y/karakai-jozu-no-takagi-san) |
| 33 | 2019-07-28 | JoJo’s Bizarre Adventure | [Hauptserie](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Stardust Crusaders](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Stardust Crusaders - Battle in Egypt](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Diamond Is Unbreakable](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Golden Wind](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) |
| 34 | 2019-06-29 | Cencoroll | [Connect](https://www.crunchyroll.com/cencoroll-connect/de-cencoroll-connect-unbekannt-850430) |
| 35 | 2019-03-20 | Hi Score Girl | [Extra Stage](https://www.netflix.com/title/80997338) |
| 36 | 2018-09-21 | Okko’s Inn | [Okko und ihre Geisterfreunde](https://www.crunchyroll.com/okkos-inn/okko-und-ihre-geisterfreunde-der-film-unbekannt-810007?ssid=397785) |
| 37 | 2018-04-05 | Cats: Ein schnurriges Abenteuer | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.2eb82736-4d63-bfcd-21db-a04b6a8928e3) |
| 38 | 2017-08-25 | Your Voice: Kimikoe | [Hauptserie](https://www.crunchyroll.com/your-voice-kimikoe-/de-your-voice-kimikoe-unbekannt-850378) |
| 39 | 2017-08-04 | Haikyu!! | [Sonderbeitrag: Die Jugend beim Frühlingsturnier](https://www.crunchyroll.com/de/haikyu-dubs/episode-3-special-feature-the-spring-tournament-of-their-youth-848359) |
| 40 | 2017-02-04 | Lupin III.: Teil 1 | [Lupin III.: Der Schatz des Harimao](https://www.crunchyroll.com/lupin-the-3rd-tv-specials/lupin-iii-tv-special-der-schatz-des-harimao-unbekannt-813894?ssid=407180) · [Lupin III.: Daisuke Jigens Grabstein](https://www.crunchyroll.com/lupin-the-3rd-movies/daisuke-jigens-grabstein-unbekannt-822025?ssid=423942) · [Lupin III.: Goemon Ishikawa, der es Blut regnen lässt](https://www.crunchyroll.com/lupin-the-3rd-movies/goemon-ishikawa-der-es-blut-regnen-lsst-unbekannt-822028?ssid=423944) |
| 41 | 2016-12-09 | Detektiv Conan | [Der Magier des letzten Jahrhunderts](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-3-der-magier-des-letzten-jahrhunderts-unbekannt-810166) · [Der Killer in ihren Augen](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-4-der-killer-in-ihren-augen-unbekannt-810167) · [Das verlorene Schiff im Himmel](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-14-das-verlorene-schiff-im-himmel-unbekannt-811396?ssid=400599) · [Der Scharfschütze aus einer anderen Dimension](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-18-der-scharfschtze-aus-einer-anderen-dimension-unbekannt-812231) · [Episode ONE - Der geschrumpfte Meisterdetektiv](https://www.crunchyroll.com/detektiv-conan/detektiv-conan-tv-special-episode-one-der-geschrumpfte-meisterdetektiv-unbekannt-821630?ssid=422962) |
| 42 | 2015-12-16 | Sound! Euphonium | [Auf die Plätze, fertig, Monaka](https://www.crunchyroll.com/de/sound-euphonium) |
| 43 | 2014-11-22 | Love Stage!! | [Daran war gar nichts leicht](https://www.crunchyroll.com/love-stage/episode-11-841216) |
| 44 | 2014-09-16 | Love, Chunibyo & Other Delusions! | [Love, Chunibyo & Other Delusions: Heart Throb - Offenbarung des wahren Auges des bösen Königs … Wiederholung](https://www.crunchyroll.com/love-chunibyo-other-delusions-heart-throb-/episode-13-799361?ssid=387047) |
| 45 | 2012-09-30 | B-Daman Crossfire | [Hauptserie](https://www.youtube.com/playlist?list=PL4o1lot_6q1EHL3vw_t4BGuHK6uBHyETT) |
| 46 | 2012-08-18 | Fairy Tail | [The Movie - Phoenix Priestess](https://www.crunchyroll.com/fairy-tail-movies/fairy-tail-the-movie-phoenix-princess-unbekannt-821316?ssid=422327) |
| 47 | 2012-07-21 | Starship Troopers: Invasion | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.8ca9f6c3-21de-5225-749f-931196618766) |
| 48 | 2012-03-24 | Shakugan no Shana | [Season III](https://www.amazon.de/s?k=Shakugan%20no%20Shana%3A%20Season%20III&i=instant-video) |
| 49 | 2011-12-03 | K-On! | [The Movie](https://www.crunchyroll.com/k-on/k-on-the-movie-unbekannt-822264?ssid=424604) |
| 50 | 2008-08-22 | Death Note | [Relight](https://www.netflix.com/title/70204970) |
| 51 | 2000-10-24 | Sin: The Movie | [Hauptserie](http://www.crunchyroll.com/de/sin-the-movie) |
| 52 | 1997-08-01 | Kimba, der weiße Löwe | [Jungle Emperor Leo: Der Kinofilm](https://www.crunchyroll.com/de/jungle-emperor-leo) |
| 53 | 1994-08-06 | Street Fighter II: The Animated Movie | [Hauptserie](https://www.crunchyroll.com/de/street-fighter-ii-the-animated-movie) |
| 54 | 1991-10-03 | Die Mumins | [Hauptserie](https://www.youtube.com/playlist?list=PLL0kUUHCSZA6VQjBcZ8TJ-tshEMyPsSt6) |
| 55 | 1968-04-07 | Choppy und die Prinzessin | [Hauptserie](https://www.youtube.com/watch?v=A0DaeCtJTG0) |
| 56 | 1968-03-31 | Speed Racer | [Hauptserie](https://www.youtube.com/playlist?list=PLnY1FL_e1HO5NAcu_AaLWeYkpUc5KqVI3) |

## Warum die einzelnen Anbieter unsicher sind

- **ADN:** Der Titel steht nicht im ADN-Bestand mit Sprachcode vde. Möglich, dass er inzwischen dazugekommen ist.
- **Crunchyroll:** Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
- **YouTube:** YouTube nennt in den Metadaten keine Tonspur. Ob der Kanal die deutsche Fassung hochgeladen hat, sieht man erst im Video.
