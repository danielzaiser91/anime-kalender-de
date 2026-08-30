# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-08-30 · **133 offene Verweise** in **102 Zeilen**.

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
| [Prime Video](07-primevideo.md) | 56 |
| [Crunchyroll](07-crunchyroll.md) | 34 |
| [YouTube](07-youtube.md) | 16 |
| [Netflix](07-netflix.md) | 12 |
| [ADN](07-adn.md) | 12 |
| [Joyn](07-joyn.md) | 2 |
| [Disney+](07-disneyplus.md) | 1 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-08-28 | Nukitashi | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.234d22cb-bca3-4855-b0f7-04a79eecdbcd?tag=justat1218-21&token=491B3E20E8D6C755745FD7E34BCE779F25003CB2) |
| 2 | 2026-06-18 | Baki | [BAKI-DOU: The Invincible Samurai Teil 2](https://www.netflix.com/title/81922765) |
| 3 | 2026-05-16 | Kill Blue | [Hauptserie](https://www.youtube.com/playlist?list=PLhGamQZtJ7K-rS4G9zn-Bsb93kgFIphCM) |
| 4 | 2026-03-31 | Mushoku Tensei: Jobless Reincarnation | [Eris auf Goblinjagd](https://www.netflix.com/title/80987039) |
| 5 | 2026-03-31 | Shangri-La Frontier | [Hauptserie](https://www.amazon.de/s?k=Shangri-La%20Frontier&i=instant-video) |
| 6 | 2026-03-31 | Tokyo Ghoul | [√A](https://www.amazon.de/s?k=Tokyo%20Ghoul%20%E2%88%9AA&i=instant-video) · [re](https://www.amazon.de/s?k=Tokyo%20Ghoul%3Are&i=instant-video) · [re](https://www.amazon.de/s?k=Tokyo%20Ghoul%3Are%202&i=instant-video) |
| 7 | 2026-03-11 | Magical Girl Spec Ops Asuka | [Hauptserie](https://www.joyn.de/serien/magical-girl-special-ops-asuka) |
| 8 | 2026-02-13 | Gintama | [the Movie 2026: Yoshiwara in Flames](https://www.netflix.com/title/82968180) |
| 9 | 2026-01-08 | Solo Leveling | [Hauptserie](https://www.amazon.de/s?k=Solo%20Leveling&i=instant-video) |
| 10 | 2025-08-21 | Terra Formars | [Hauptserie](https://www.amazon.de/s?k=Terra%20Formars&i=instant-video) |
| 11 | 2025-06-29 | Go, Go, Loser Ranger! | [Go! Go! Loser Ranger!](https://www.disneyplus.com/de-de/series/go-go-loser-ranger/2VX5fKgeiVEl) |
| 12 | 2025-06-25 | Your Forma | [Hauptserie](https://www.amazon.de/s?k=YOUR%20FORMA&i=instant-video) |
| 13 | 2025-06-11 | Sword Art Online | [Extra Edition](http://www.crunchyroll.com/de/sword-art-online) |
| 14 | 2025-02-06 | The Demon Sword Master of Excalibur Academy | [Hauptserie](https://www.amazon.de/s?k=The%20Demon%20Sword%20Master%20of%20Excalibur%20Academy&i=instant-video) |
| 15 | 2024-09-27 | NieR:Automata Ver1.1a | [Cour 2](https://www.crunchyroll.com/de/series/GNVHKNPW1/nierautomata-ver11a) |
| 16 | 2024-09-22 | Plus-Sized Elf | [Hauptserie](https://animationdigitalnetwork.de/video/50-nuances-de-gras) |
| 17 | 2024-06-30 | Captain Tsubasa: Die tollen Fußballstars | [Captain Tsubasa: Staffel 2 - Die Junioren](https://www.amazon.de/s?k=Captain%20Tsubasa%3A%20Junior%20Youth%20Arc&i=instant-video) |
| 18 | 2024-05-05 | Ninja Kamui | [Hauptserie](https://www.amazon.de/s?k=Ninja%20Kamui&i=instant-video) |
| 19 | 2024-04-09 | Free! Iwatobi Swim Club | [High Speed! Free! Starting Days](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! -Timeless Medley- The Bond](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Timeless Medley](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Take Your Marks](https://www.crunchyroll.com/de/series/GRDQV2VWY/free---iwatobi-swim-club) · [Free! the Final Stroke: The First Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! the Final Stroke: The Second Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) |
| 20 | 2024-03-27 | Gushing over Magical Girls | [Hauptserie](https://animationdigitalnetwork.de/video/looking-up-to-magical-girls) |
| 21 | 2023-12-13 | Pokémon Horizonte | [Pokémon: Winde aus Paldea](https://www.youtube.com/playlist?list=PLQWzKIaERirzLZWMu3M89ZEpsDt9YtDBM) · [Meisterdetektiv Pikachu und der verschwundene Pudding](https://www.youtube.com/watch?v=5yQSUimraSU) |
| 22 | 2023-10-01 | Edens Zero | [Staffel 2](https://animationdigitalnetwork.de/video/edens-zero-saison-2) |
| 23 | 2023-10-01 | Haikyu!! | [Hauptserie](https://www.amazon.de/s?k=HAIKYU!!&i=instant-video) |
| 24 | 2023-10-01 | Magister Negi Magi | [UQ Holder! Magister Negi Magi Negima! 2](https://www.amazon.de/s?k=UQ%20Holder!&i=instant-video) |
| 25 | 2023-09-23 | Horimiya | [The Missing Pieces](https://www.amazon.de/s?k=Horimiya%3A%20The%20Missing%20Pieces&i=instant-video) |
| 26 | 2023-02-15 | The Eminence in Shadow | [Hauptserie](https://www.amazon.de/s?k=The%20Eminence%20in%20Shadow&i=instant-video) |
| 27 | 2022-12-22 | Bibliophile Princess | [Hauptserie](https://animationdigitalnetwork.de/video/princess-of-the-bibliophile) |
| 28 | 2022-12-22 | Mob Psycho 100 | [II](https://www.amazon.de/s?k=Mob%20Psycho%20100%20II&i=instant-video) · [III](https://www.amazon.de/s?k=Mob%20Psycho%20100%20III&i=instant-video) |
| 29 | 2022-12-17 | I’ve Somehow Gotten Stronger When I Improved My Farm-Related Skills | [Hauptserie](https://animationdigitalnetwork.de/video/got-strong-raising-skills-farming) |
| 30 | 2022-12-14 | Reincarnated as a Sword | [Hauptserie](https://www.amazon.de/s?k=Reincarnated%20as%20a%20Sword&i=instant-video) |
| 31 | 2022-09-23 | When Will Ayumu Make His Move? | [Hauptserie](https://animationdigitalnetwork.de/video/a-quoi-tu-joues-ayumu-soredemo-ayumu-wa-yosetekuru) |
| 32 | 2022-09-14 | One Piece | [Film: Strong World](https://www.amazon.de/s?k=One%20Piece%20Film%3A%20Strong%20World&i=instant-video) · [3D2Y: Überwinde Ace’s Tod! Das Gelübde der Kameraden](https://www.amazon.de/s?k=One%20Piece%203D2Y%3A%20Overcome%20Ace%E2%80%99s%20Death!%20Luffy%E2%80%99s%20Vow%20to%20his%20Friends&i=instant-video) · [Abenteuer auf Nebulandia](https://www.amazon.de/s?k=One%20Piece%3A%20Adventure%20of%20Nebulandia&i=instant-video) |
| 33 | 2022-09-12 | My Isekai Life: I Gained a Second Character Class and Became the Strongest Sage in the World! | [Hauptserie](https://animationdigitalnetwork.de/video/my-isekai-life) |
| 34 | 2021-12-23 | Pokémon | [Mystery Dungeon: Team Flinke Freunde](https://www.youtube.com/watch?v=rAOmQ-foqeg) · [Mystery Dungeon: Erkundungsteams Zeit und Dunkelheit](https://www.youtube.com/watch?v=V0PlwsTLoM0) · [Mystery Dungeon: Portale in die Unendlichkeit](https://www.youtube.com/watch?v=zbwSAruo3QU) · [Entwicklungen](https://youtube.com/playlist?list=PLQWzKIaERirwN5po6LduiSLm8qc7GtuAl&si=I6QtXoF-i7cfG2c8) |
| 35 | 2021-10-21 | Kaguya-sama: Love Is War | [Ultra Romantic: Ishigami Yu möchte sich unterhalten](https://www.youtube.com/watch?v=cxTxrKrYkcY) |
| 36 | 2021-09-21 | Meine Wiedergeburt als Schleim in einer anderen Welt | [Hauptserie](http://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) |
| 37 | 2021-07-30 | Fire Force | [Staffel 2 Miniepisoden](https://www.youtube.com/playlist?list=PLY_DM8ieCRPqNeMV1z2EJZDSgLWySL_Cx) |
| 38 | 2021-04-16 | Detektiv Conan | [Die scharlachrote Kugel](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.9c92f9a9-a36f-4f4e-8ccd-e0d6b3649bee) |
| 39 | 2021-03-26 | The Promised Neverland | [Staffel 2](https://www.crunchyroll.com/de/the-promised-neverland) |
| 40 | 2021-03-24 | Re:Zero - Starting Life in Another World | [Staffel 2](https://www.crunchyroll.com/de/rezero-starting-life-in-another-world-) · [Staffel 2](https://www.crunchyroll.com/de/rezero-starting-life-in-another-world-) |
| 41 | 2021-02-11 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Pretty Guardian Sailor Moon Eternal: Der Film](https://www.netflix.com/title/81214399) |
| 42 | 2020-12-17 | Sylvanian Families | [Mini-Episodes - Ivy](https://www.youtube.com/playlist?list=PLTYXZZKHiowqVVc80wtIBlUNCcRy2SKPV) · [Mini-Episoden - Klee](https://www.youtube.com/playlist?list=PLTYXZZKHiowqllFesHWXbJI3MVvxQU0Cz) · [Mini Episodes - Peony](https://www.youtube.com/playlist?list=PLduwKEaYhJ45z5Gf4Nj3jmsMvOFcpTikR) |
| 43 | 2020-06-27 | Kaguya-sama: Love Is War | [Hauptserie](https://www.crunchyroll.com/de/kaguya-sama-love-is-war) · [?](https://www.crunchyroll.com/de/kaguya-sama-love-is-war) |
| 44 | 2020-06-17 | Dorohedoro | [Teuflische Anekdoten](https://www.netflix.com/title/80991903) |
| 45 | 2020-04-04 | My Hero Academia | [4](https://www.amazon.de/s?k=My%20Hero%20Academia%20Season%204&i=instant-video) |
| 46 | 2020-03-27 | One Punch Man | [OVAs](https://www.crunchyroll.com/watch/GPWU8KM42/the-shadow-that-snuck-up-too-close) · [Staffel 2 OVAs](https://www.crunchyroll.com/watch/G9DU9E4QG/saitama-and-the-mediocre-gang) |
| 47 | 2020-01-10 | Haikyu!! | [Lev ist hier!](https://www.netflix.com/title/80090673) · [Kampf gegen ungenügende Noten](https://www.netflix.com/title/80090673) · [Sonderbeitrag: Die Jugend beim Frühlingsturnier](https://www.netflix.com/title/80090673) · [An Land vs. In der Luft / Der ”Weg” des Balls](https://www.netflix.com/title/80090673) |
| 48 | 2019-12-29 | Special 7: Special Crime Investigation Unit | [Hauptserie](https://www.amazon.de/s?k=Special%207%3A%20Special%20Crime%20Investigation%20Unit&i=instant-video) |
| 49 | 2019-11-03 | Pokémon | [Die TV-Serie - Sonne & Mond](https://www.amazon.de/s?k=Pok%C3%A9mon%20the%20Series%3A%20Sun%20%26%20Moon&i=instant-video) |
| 50 | 2019-09-22 | The Ones Within | [Hauptserie](https://www.amazon.de/s?k=The%20Ones%20Within&i=instant-video) |
| 51 | 2019-07-28 | JoJo’s Bizarre Adventure | [Hauptserie](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Stardust Crusaders](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Stardust Crusaders - Battle in Egypt](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Diamond Is Unbreakable](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Golden Wind](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) |
| 52 | 2019-06-29 | Cencoroll | [Connect](https://www.crunchyroll.com/cencoroll-connect/de-cencoroll-connect-unbekannt-850430) |
| 53 | 2019-06-21 | Ride Your Wave | [Hauptserie](https://www.crunchyroll.com/ride-your-wave/ride-your-wave-unbekannt-806160?ssid=392654) |
| 54 | 2019-03-20 | Hi Score Girl | [Extra Stage](https://www.netflix.com/title/80997338) |
| 55 | 2018-09-21 | Angels of Death | [Hauptserie](https://www.joyn.de/serien/angels-of-death) |
| 56 | 2018-09-21 | Okko’s Inn | [Okko und ihre Geisterfreunde](https://www.crunchyroll.com/okkos-inn/okko-und-ihre-geisterfreunde-der-film-unbekannt-810007?ssid=397785) |
| 57 | 2018-06-09 | Kase-san and Morning Glories | [Hauptserie](https://www.crunchyroll.com/kase-san-and-morning-glories/kase-san-and-morning-glories-unbekannt-813883) |
| 58 | 2018-04-05 | Cats: Ein schnurriges Abenteuer | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.2eb82736-4d63-bfcd-21db-a04b6a8928e3) |
| 59 | 2017-12-17 | Welcome to the Ballroom | [Hauptserie](https://www.amazon.de/s?k=Welcome%20to%20the%20Ballroom&i=instant-video) |
| 60 | 2017-09-23 | Kakegurui: Das Leben ist ein Spiel | [Hauptserie](https://www.netflix.com/title/80175351) |
| 61 | 2017-08-25 | Your Voice: Kimikoe | [Hauptserie](https://www.crunchyroll.com/your-voice-kimikoe-/de-your-voice-kimikoe-unbekannt-850378) |
| 62 | 2017-06-23 | Saekano: How to Raise a Boring Girlfriend | [.flat](https://www.amazon.de/s?k=Saekano%3A%20How%20to%20Raise%20a%20Boring%20Girlfriend%20%E2%99%AD&i=instant-video) |
| 63 | 2017-05-19 | Lu over the Wall | [Hauptserie](https://www.crunchyroll.com/lu-over-the-wall/lu-over-the-wall-unbekannt-811213?ssid=399959) |
| 64 | 2017-04-07 | Night is Short, Walk on Girl | [Hauptserie](https://www.crunchyroll.com/night-is-short-walk-on-girl/night-is-short-walk-on-girl-unbekannt-811211?ssid=399939) |
| 65 | 2017-03-31 | Scum’s Wish | [Hauptserie](https://www.amazon.de/s?k=Scum's%20Wish&i=instant-video) |
| 66 | 2017-02-25 | The Dragon Dentist | [Hauptserie](https://www.crunchyroll.com/the-dragon-dentist/deomu-the-dragon-dentist-unbekannt-811630?ssid=401190) |
| 67 | 2017-02-03 | Project Itoh: Genocidal Organ | [Hauptserie](https://www.crunchyroll.com/genocidal-organ/genocidal-organ-unbekannt-807915?ssid=394444) |
| 68 | 2016-12-24 | JoJo’s Bizarre Adventure | [Diamond Is Unbreakable](https://www.amazon.de/s?k=JoJo's%20Bizarre%20Adventure%3A%20Diamond%20is%20Unbreakable&i=instant-video) |
| 69 | 2016-09-24 | Food Wars! Shokugeki no Soma | [Food Wars! The Second Plate](https://www.amazon.de/s?k=Food%20Wars!%20The%20Second%20Plate&i=instant-video) |
| 70 | 2016-08-26 | Your Name. Gestern, heute und für immer | [Hauptserie](https://www.amazon.de/s?k=Your%20Name.&i=instant-video) |
| 71 | 2015-12-26 | Noragami | [Aragoto](https://www.amazon.de/s?k=Noragami%20Aragoto&i=instant-video) |
| 72 | 2015-11-13 | Project Itoh: Harmony | [Hauptserie](https://www.crunchyroll.com/harmony/harmony-unbekannt-807914?ssid=394443) |
| 73 | 2015-10-02 | Project Itoh: The Empire of Corpses | [Hauptserie](https://www.crunchyroll.com/the-empire-of-corpses/the-empire-of-corpses-unknown-808170?ssid=395057) |
| 74 | 2015-03-28 | Ronja Räubertochter | [Hauptserie](https://www.amazon.de/s?k=Ronja%2C%20the%20Robber's%20Daughter&i=instant-video) |
| 75 | 2015-03-28 | Tenkai Knights: Die Tenkai Ritter | [Hauptserie](https://www.amazon.de/s?k=Tenkai%20Knights&i=instant-video) |
| 76 | 2014-12-29 | Rage of Bahamut: Genesis | [Hauptserie](https://www.amazon.de/s?k=Rage%20of%20Bahamut%3A%20Genesis&i=instant-video) |
| 77 | 2014-09-16 | Love, Chunibyo & Other Delusions! | [Love, Chunibyo & Other Delusions: Heart Throb - Offenbarung des wahren Auges des bösen Königs … Wiederholung](https://www.crunchyroll.com/love-chunibyo-other-delusions-heart-throb-/episode-13-799361?ssid=387047) |
| 78 | 2014-06-20 | Selector Infected Wixoss | [Hauptserie](https://www.amazon.de/s?k=selector%20infected%20WIXOSS&i=instant-video) |
| 79 | 2014-03-27 | Space Dandy | [Hauptserie](https://www.amazon.de/s?k=Space%20Dandy&i=instant-video) |
| 80 | 2013-03-26 | The Pet Girl of Sakurasou | [Hauptserie](https://www.amazon.de/s?k=The%20Pet%20Girl%20of%20Sakurasou&i=instant-video) |
| 81 | 2012-12-26 | Jormungand | [Perfect Order](https://www.amazon.de/s?k=Jormungand%3A%20Perfect%20Order&i=instant-video) |
| 82 | 2012-09-30 | B-Daman Crossfire | [Hauptserie](https://www.youtube.com/playlist?list=PL4o1lot_6q1EHL3vw_t4BGuHK6uBHyETT) |
| 83 | 2012-07-21 | Starship Troopers: Invasion | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.8ca9f6c3-21de-5225-749f-931196618766) |
| 84 | 2012-03-24 | Shakugan no Shana | [Season III](https://www.amazon.de/s?k=Shakugan%20no%20Shana%3A%20Season%20III&i=instant-video) |
| 85 | 2011-12-03 | K-On! | [The Movie](https://www.crunchyroll.com/k-on/k-on-the-movie-unbekannt-822264?ssid=424604) |
| 86 | 2009-03-26 | Toradora! | [Hauptserie](https://www.amazon.de/s?k=Toradora!&i=instant-video) |
| 87 | 2008-08-22 | Death Note | [Relight](https://www.netflix.com/title/70204970) |
| 88 | 2007-09-12 | Zombie-Loan | [Hauptserie](https://www.amazon.de/s?k=Zombie%20Loan&i=instant-video) |
| 89 | 2005-03-19 | Samurai Champloo | [Hauptserie](https://www.amazon.de/s?k=Samurai%20Champloo&i=instant-video) |
| 90 | 2005-03-16 | Tenjo Tenge | [Hauptserie](https://www.amazon.de/s?k=Tenjho%20Tenge&i=instant-video) · [OVA](https://www.amazon.de/s?k=Tenjho%20Tenge%3A%20The%20Ultimate%20Fight&i=instant-video) |
| 91 | 2000-10-24 | Sin: The Movie | [Hauptserie](http://www.crunchyroll.com/de/sin-the-movie) |
| 92 | 2000-03-27 | The Candidate for Goddess | [Hauptserie](https://www.amazon.de/s?k=Pilot%20Candidate&i=instant-video) |
| 93 | 1997-08-01 | Kimba, der weiße Löwe | [Jungle Emperor Leo: Der Kinofilm](https://www.crunchyroll.com/de/jungle-emperor-leo) |
| 94 | 1995-12-23 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Sailor Moon R Movie: Gefährliche Blumen](https://www.amazon.de/s?k=Sailor%20Moon%20R%3A%20The%20Movie&i=instant-video) · [Sailor Moon S: Schneeprinzessin Kaguya](https://www.amazon.de/s?k=Sailor%20Moon%20S%20Movie%3A%20Hearts%20in%20Ice&i=instant-video) · [Sailor Moon Super S: Reise ins Land der Träume](https://www.amazon.de/s?k=Sailor%20Moon%20SuperS%20the%20Movie%3A%20Black%20Dream%20Hole&i=instant-video) |
| 95 | 1994-08-06 | Street Fighter II: The Animated Movie | [Hauptserie](https://www.crunchyroll.com/de/street-fighter-ii-the-animated-movie) |
| 96 | 1994-08-06 | Street Fighter II: The Animated Movie | [Hauptserie](https://www.amazon.de/s?k=Street%20Fighter%20II%3A%20The%20Animated%20Movie&i=instant-video) |
| 97 | 1991-10-03 | Die Mumins | [Hauptserie](https://www.youtube.com/playlist?list=PLL0kUUHCSZA6VQjBcZ8TJ-tshEMyPsSt6) |
| 98 | 1987-07-18 | Knights of the Zodiac: Saint Seiya Teil 2 | [Saint Seiya: Die Krieger des Zodiac - Movie 1: Die Legende des goldenen Apfels](https://www.amazon.de/s?k=Saint%20Seiya%3A%20Evil%20Goddess%20Eris&i=instant-video) |
| 99 | 1981-03-14 | Unico: Das phantastische Abenteuer eines Hörnchens | [Hauptserie](https://www.amazon.de/s?k=Fantastic%20Adventures%20of%20Unico&i=instant-video) |
| 100 | 1980-12-28 | Tom Sawyers Abenteuer | [Hauptserie](https://www.amazon.de/s?k=The%20Adventures%20of%20Tom%20Sawyer&i=instant-video) |
| 101 | 1968-04-07 | Choppy und die Prinzessin | [Hauptserie](https://www.youtube.com/watch?v=A0DaeCtJTG0) |
| 102 | 1968-03-31 | Speed Racer | [Hauptserie](https://www.youtube.com/playlist?list=PLnY1FL_e1HO5NAcu_AaLWeYkpUc5KqVI3) |

## Warum die einzelnen Anbieter unsicher sind

- **ADN:** Der Titel steht nicht im ADN-Bestand mit Sprachcode vde. Möglich, dass er inzwischen dazugekommen ist.
- **Crunchyroll:** Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.
- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Joyn:** Joyn nennt die Sprachfassung nirgends öffentlich.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
- **YouTube:** YouTube nennt in den Metadaten keine Tonspur. Ob der Kanal die deutsche Fassung hochgeladen hat, sieht man erst im Video.
