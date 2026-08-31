# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-08-31 · **82 offene Verweise** in **59 Zeilen**.

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
| [YouTube](07-youtube.md) | 16 |
| [ADN](07-adn.md) | 12 |
| [Netflix](07-netflix.md) | 11 |
| [Prime Video](07-primevideo.md) | 6 |
| [Joyn](07-joyn.md) | 2 |
| [Disney+](07-disneyplus.md) | 1 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-08-28 | Nukitashi | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.234d22cb-bca3-4855-b0f7-04a79eecdbcd?tag=justat1218-21&token=491B3E20E8D6C755745FD7E34BCE779F25003CB2) |
| 2 | 2026-06-18 | Baki | [BAKI-DOU: The Invincible Samurai Teil 2](https://www.netflix.com/title/81922765) |
| 3 | 2026-05-16 | Kill Blue | [Hauptserie](https://www.youtube.com/playlist?list=PLhGamQZtJ7K-rS4G9zn-Bsb93kgFIphCM) |
| 4 | 2026-03-31 | Mushoku Tensei: Jobless Reincarnation | [Eris auf Goblinjagd](https://www.netflix.com/title/80987039) |
| 5 | 2026-03-11 | Magical Girl Spec Ops Asuka | [Hauptserie](https://www.joyn.de/serien/magical-girl-special-ops-asuka) |
| 6 | 2025-06-29 | Go, Go, Loser Ranger! | [Go! Go! Loser Ranger!](https://www.disneyplus.com/de-de/series/go-go-loser-ranger/2VX5fKgeiVEl) |
| 7 | 2025-06-11 | Sword Art Online | [Extra Edition](http://www.crunchyroll.com/de/sword-art-online) |
| 8 | 2024-09-27 | NieR:Automata Ver1.1a | [Cour 2](https://www.crunchyroll.com/de/series/GNVHKNPW1/nierautomata-ver11a) |
| 9 | 2024-09-22 | Plus-Sized Elf | [Hauptserie](https://animationdigitalnetwork.de/video/50-nuances-de-gras) |
| 10 | 2024-04-09 | Free! Iwatobi Swim Club | [High Speed! Free! Starting Days](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! -Timeless Medley- The Bond](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Timeless Medley](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Take Your Marks](https://www.crunchyroll.com/de/series/GRDQV2VWY/free---iwatobi-swim-club) · [Free! the Final Stroke: The First Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! the Final Stroke: The Second Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) |
| 11 | 2024-03-27 | Gushing over Magical Girls | [Hauptserie](https://animationdigitalnetwork.de/video/looking-up-to-magical-girls) |
| 12 | 2023-12-13 | Pokémon Horizonte | [Pokémon: Winde aus Paldea](https://www.youtube.com/playlist?list=PLQWzKIaERirzLZWMu3M89ZEpsDt9YtDBM) · [Meisterdetektiv Pikachu und der verschwundene Pudding](https://www.youtube.com/watch?v=5yQSUimraSU) |
| 13 | 2023-10-01 | Edens Zero | [Staffel 2](https://animationdigitalnetwork.de/video/edens-zero-saison-2) |
| 14 | 2022-12-22 | Bibliophile Princess | [Hauptserie](https://animationdigitalnetwork.de/video/princess-of-the-bibliophile) |
| 15 | 2022-12-17 | I’ve Somehow Gotten Stronger When I Improved My Farm-Related Skills | [Hauptserie](https://animationdigitalnetwork.de/video/got-strong-raising-skills-farming) |
| 16 | 2022-09-23 | When Will Ayumu Make His Move? | [Hauptserie](https://animationdigitalnetwork.de/video/a-quoi-tu-joues-ayumu-soredemo-ayumu-wa-yosetekuru) |
| 17 | 2022-09-12 | My Isekai Life: I Gained a Second Character Class and Became the Strongest Sage in the World! | [Hauptserie](https://animationdigitalnetwork.de/video/my-isekai-life) |
| 18 | 2021-12-23 | Pokémon | [Mystery Dungeon: Team Flinke Freunde](https://www.youtube.com/watch?v=rAOmQ-foqeg) · [Mystery Dungeon: Erkundungsteams Zeit und Dunkelheit](https://www.youtube.com/watch?v=V0PlwsTLoM0) · [Mystery Dungeon: Portale in die Unendlichkeit](https://www.youtube.com/watch?v=zbwSAruo3QU) · [Entwicklungen](https://youtube.com/playlist?list=PLQWzKIaERirwN5po6LduiSLm8qc7GtuAl&si=I6QtXoF-i7cfG2c8) |
| 19 | 2021-10-21 | Kaguya-sama: Love Is War | [Ultra Romantic: Ishigami Yu möchte sich unterhalten](https://www.youtube.com/watch?v=cxTxrKrYkcY) |
| 20 | 2021-09-21 | Meine Wiedergeburt als Schleim in einer anderen Welt | [Hauptserie](http://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) |
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
| 32 | 2019-07-28 | JoJo’s Bizarre Adventure | [Hauptserie](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Stardust Crusaders](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Stardust Crusaders - Battle in Egypt](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Diamond Is Unbreakable](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Golden Wind](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) |
| 33 | 2019-06-29 | Cencoroll | [Connect](https://www.crunchyroll.com/cencoroll-connect/de-cencoroll-connect-unbekannt-850430) |
| 34 | 2019-06-21 | Ride Your Wave | [Hauptserie](https://www.crunchyroll.com/ride-your-wave/ride-your-wave-unbekannt-806160?ssid=392654) |
| 35 | 2019-03-20 | Hi Score Girl | [Extra Stage](https://www.netflix.com/title/80997338) |
| 36 | 2018-09-21 | Angels of Death | [Hauptserie](https://www.joyn.de/serien/angels-of-death) |
| 37 | 2018-09-21 | Okko’s Inn | [Okko und ihre Geisterfreunde](https://www.crunchyroll.com/okkos-inn/okko-und-ihre-geisterfreunde-der-film-unbekannt-810007?ssid=397785) |
| 38 | 2018-06-09 | Kase-san and Morning Glories | [Hauptserie](https://www.crunchyroll.com/kase-san-and-morning-glories/kase-san-and-morning-glories-unbekannt-813883) |
| 39 | 2018-04-05 | Cats: Ein schnurriges Abenteuer | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.2eb82736-4d63-bfcd-21db-a04b6a8928e3) |
| 40 | 2017-09-23 | Kakegurui: Das Leben ist ein Spiel | [Hauptserie](https://www.netflix.com/title/80175351) |
| 41 | 2017-08-25 | Your Voice: Kimikoe | [Hauptserie](https://www.crunchyroll.com/your-voice-kimikoe-/de-your-voice-kimikoe-unbekannt-850378) |
| 42 | 2017-05-19 | Lu over the Wall | [Hauptserie](https://www.crunchyroll.com/lu-over-the-wall/lu-over-the-wall-unbekannt-811213?ssid=399959) |
| 43 | 2017-04-07 | Night is Short, Walk on Girl | [Hauptserie](https://www.crunchyroll.com/night-is-short-walk-on-girl/night-is-short-walk-on-girl-unbekannt-811211?ssid=399939) |
| 44 | 2017-02-25 | The Dragon Dentist | [Hauptserie](https://www.crunchyroll.com/the-dragon-dentist/deomu-the-dragon-dentist-unbekannt-811630?ssid=401190) |
| 45 | 2017-02-03 | Project Itoh: Genocidal Organ | [Hauptserie](https://www.crunchyroll.com/genocidal-organ/genocidal-organ-unbekannt-807915?ssid=394444) |
| 46 | 2015-11-13 | Project Itoh: Harmony | [Hauptserie](https://www.crunchyroll.com/harmony/harmony-unbekannt-807914?ssid=394443) |
| 47 | 2015-10-02 | Project Itoh: The Empire of Corpses | [Hauptserie](https://www.crunchyroll.com/the-empire-of-corpses/the-empire-of-corpses-unknown-808170?ssid=395057) |
| 48 | 2014-09-16 | Love, Chunibyo & Other Delusions! | [Love, Chunibyo & Other Delusions: Heart Throb - Offenbarung des wahren Auges des bösen Königs … Wiederholung](https://www.crunchyroll.com/love-chunibyo-other-delusions-heart-throb-/episode-13-799361?ssid=387047) |
| 49 | 2012-09-30 | B-Daman Crossfire | [Hauptserie](https://www.youtube.com/playlist?list=PL4o1lot_6q1EHL3vw_t4BGuHK6uBHyETT) |
| 50 | 2012-07-21 | Starship Troopers: Invasion | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.8ca9f6c3-21de-5225-749f-931196618766) |
| 51 | 2012-03-24 | Shakugan no Shana | [Season III](https://www.amazon.de/s?k=Shakugan%20no%20Shana%3A%20Season%20III&i=instant-video) |
| 52 | 2011-12-03 | K-On! | [The Movie](https://www.crunchyroll.com/k-on/k-on-the-movie-unbekannt-822264?ssid=424604) |
| 53 | 2008-08-22 | Death Note | [Relight](https://www.netflix.com/title/70204970) |
| 54 | 2000-10-24 | Sin: The Movie | [Hauptserie](http://www.crunchyroll.com/de/sin-the-movie) |
| 55 | 1997-08-01 | Kimba, der weiße Löwe | [Jungle Emperor Leo: Der Kinofilm](https://www.crunchyroll.com/de/jungle-emperor-leo) |
| 56 | 1994-08-06 | Street Fighter II: The Animated Movie | [Hauptserie](https://www.crunchyroll.com/de/street-fighter-ii-the-animated-movie) |
| 57 | 1991-10-03 | Die Mumins | [Hauptserie](https://www.youtube.com/playlist?list=PLL0kUUHCSZA6VQjBcZ8TJ-tshEMyPsSt6) |
| 58 | 1968-04-07 | Choppy und die Prinzessin | [Hauptserie](https://www.youtube.com/watch?v=A0DaeCtJTG0) |
| 59 | 1968-03-31 | Speed Racer | [Hauptserie](https://www.youtube.com/playlist?list=PLnY1FL_e1HO5NAcu_AaLWeYkpUc5KqVI3) |

## Warum die einzelnen Anbieter unsicher sind

- **ADN:** Der Titel steht nicht im ADN-Bestand mit Sprachcode vde. Möglich, dass er inzwischen dazugekommen ist.
- **Crunchyroll:** Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.
- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Joyn:** Joyn nennt die Sprachfassung nirgends öffentlich.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
- **YouTube:** YouTube nennt in den Metadaten keine Tonspur. Ob der Kanal die deutsche Fassung hochgeladen hat, sieht man erst im Video.
