# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-08-29 · **189 offene Verweise** in **140 Zeilen**.

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
| [Crunchyroll](07-crunchyroll.md) | 62 |
| [Prime Video](07-primevideo.md) | 56 |
| [Netflix](07-netflix.md) | 41 |
| [YouTube](07-youtube.md) | 22 |
| [ADN](07-adn.md) | 5 |
| [Joyn](07-joyn.md) | 2 |
| [Disney+](07-disneyplus.md) | 1 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-08-28 | Nukitashi | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.234d22cb-bca3-4855-b0f7-04a79eecdbcd?tag=justat1218-21&token=491B3E20E8D6C755745FD7E34BCE779F25003CB2) |
| 2 | 2026-06-25 | Dr. Stone | [New World](https://www.crunchyroll.com/de/series/GYEXQKJG6/dr-stone) · [Science Future - Cour 2](https://www.crunchyroll.com/de/series/GYEXQKJG6/dr-stone) · [Science Future - Cour 3](https://www.crunchyroll.com/de/series/GYEXQKJG6/dr-stone) |
| 3 | 2026-06-18 | Baki | [BAKI-DOU: The Invincible Samurai Teil 2](https://www.netflix.com/title/81922765) |
| 4 | 2026-05-02 | Kill Blue | [Hauptserie](https://www.youtube.com/playlist?list=PLhGamQZtJ7K-rS4G9zn-Bsb93kgFIphCM) |
| 5 | 2026-03-31 | Black Butler | [Hauptserie](https://www.netflix.com/title/70204955) |
| 6 | 2026-03-31 | Possibly the Greatest Alchemist of All Time | [Hauptserie](https://www.netflix.com/title/82058586) |
| 7 | 2026-03-31 | Shangri-La Frontier | [Hauptserie](https://www.amazon.de/s?k=Shangri-La%20Frontier&i=instant-video) |
| 8 | 2026-03-31 | Tokyo Ghoul | [√A](https://www.amazon.de/s?k=Tokyo%20Ghoul%20%E2%88%9AA&i=instant-video) · [re](https://www.amazon.de/s?k=Tokyo%20Ghoul%3Are&i=instant-video) · [re](https://www.amazon.de/s?k=Tokyo%20Ghoul%3Are%202&i=instant-video) |
| 9 | 2026-03-31 | Tower of God | [Hauptserie](https://www.netflix.com/title/81329313) |
| 10 | 2026-03-11 | Magical Girl Spec Ops Asuka | [Hauptserie](https://www.joyn.de/serien/magical-girl-special-ops-asuka) |
| 11 | 2026-02-13 | Gintama | [the Movie 2026: Yoshiwara in Flames](https://www.netflix.com/title/82968180) |
| 12 | 2026-01-08 | Solo Leveling | [Hauptserie](https://www.netflix.com/title/81748512) |
| 13 | 2026-01-08 | Solo Leveling | [Hauptserie](https://www.amazon.de/s?k=Solo%20Leveling&i=instant-video) |
| 14 | 2025-08-21 | Terra Formars | [Hauptserie](https://www.amazon.de/s?k=Terra%20Formars&i=instant-video) |
| 15 | 2025-06-29 | Go, Go, Loser Ranger! | [Go! Go! Loser Ranger!](https://www.disneyplus.com/de-de/series/go-go-loser-ranger/2VX5fKgeiVEl) |
| 16 | 2025-06-25 | Your Forma | [Hauptserie](https://www.amazon.de/s?k=YOUR%20FORMA&i=instant-video) |
| 17 | 2025-06-11 | Sword Art Online | [Extra Edition](http://www.crunchyroll.com/de/sword-art-online) |
| 18 | 2025-06-11 | Sword Art Online | [The Movie: Ordinal Scale](https://www.netflix.com/title/80180071) |
| 19 | 2025-02-06 | The Demon Sword Master of Excalibur Academy | [Hauptserie](https://www.amazon.de/s?k=The%20Demon%20Sword%20Master%20of%20Excalibur%20Academy&i=instant-video) |
| 20 | 2024-09-27 | NieR:Automata Ver1.1a | [Cour 2](https://www.crunchyroll.com/de/series/GNVHKNPW1/nierautomata-ver11a) |
| 21 | 2024-07-11 | Beyond the Boundary: Kyoukai no Kanata | [Hauptserie](https://www.netflix.com/title/80052668) |
| 22 | 2024-06-30 | Captain Tsubasa: Die tollen Fußballstars | [Captain Tsubasa: Staffel 2 - Die Junioren](https://www.amazon.de/s?k=Captain%20Tsubasa%3A%20Junior%20Youth%20Arc&i=instant-video) |
| 23 | 2024-05-05 | Ninja Kamui | [Hauptserie](https://www.amazon.de/s?k=Ninja%20Kamui&i=instant-video) |
| 24 | 2024-04-16 | Haikyu!! | [Lev ist hier!](https://www.netflix.com/title/80090673) · [Movie 2 - Gewinner und Verlierer](https://www.netflix.com/title/80134174) · [Kampf gegen ungenügende Noten](https://www.netflix.com/title/80090673) · [Sonderbeitrag: Die Jugend beim Frühlingsturnier](https://www.netflix.com/title/80090673) · [An Land vs. In der Luft / Der ”Weg” des Balls](https://www.netflix.com/title/80090673) |
| 25 | 2024-04-09 | Free! Iwatobi Swim Club | [High Speed! Free! Starting Days](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! -Timeless Medley- The Bond](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Timeless Medley](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Take Your Marks](https://www.crunchyroll.com/de/series/GRDQV2VWY/free---iwatobi-swim-club) · [Free! the Final Stroke: The First Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! the Final Stroke: The Second Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) |
| 26 | 2023-12-13 | Pokémon Horizonte | [Pokémon: Winde aus Paldea](https://www.youtube.com/playlist?list=PLQWzKIaERirzLZWMu3M89ZEpsDt9YtDBM) · [Meisterdetektiv Pikachu und der verschwundene Pudding](https://www.youtube.com/watch?v=5yQSUimraSU) |
| 27 | 2023-10-01 | Haikyu!! | [Hauptserie](https://www.amazon.de/s?k=HAIKYU!!&i=instant-video) |
| 28 | 2023-10-01 | Magister Negi Magi | [UQ Holder! Magister Negi Magi Negima! 2](https://www.amazon.de/s?k=UQ%20Holder!&i=instant-video) |
| 29 | 2023-09-23 | Horimiya | [The Missing Pieces](https://www.amazon.de/s?k=Horimiya%3A%20The%20Missing%20Pieces&i=instant-video) |
| 30 | 2023-04-19 | Bofuri: I Don’t Want to Get Hurt, So I’ll Max Out My Defense. | [Staffel 2](https://www.crunchyroll.com/de/series/GKEH2G428/bofuri-i-dont-want-to-get-hurt-so-ill-max-out-my-defense) |
| 31 | 2023-02-15 | The Eminence in Shadow | [Hauptserie](https://www.amazon.de/s?k=The%20Eminence%20in%20Shadow&i=instant-video) |
| 32 | 2022-12-23 | Pokémon | [Blauer Himmel in der Ferne!](https://www.netflix.com/title/81670593) |
| 33 | 2022-12-22 | Mob Psycho 100 | [II](https://www.amazon.de/s?k=Mob%20Psycho%20100%20II&i=instant-video) · [III](https://www.amazon.de/s?k=Mob%20Psycho%20100%20III&i=instant-video) |
| 34 | 2022-12-14 | Reincarnated as a Sword | [Hauptserie](https://www.amazon.de/s?k=Reincarnated%20as%20a%20Sword&i=instant-video) |
| 35 | 2022-11-22 | Tonikawa: Over the Moon for You | [Social Media](https://www.crunchyroll.com/de/tonikawa-over-the-moon-for-you) · [Uniform](https://www.crunchyroll.com/de/series/GRWMGGQ86/tonikawa-over-the-moon-for-you) |
| 36 | 2022-10-13 | Exception | [Hauptserie](https://www.netflix.com/title/81002444) |
| 37 | 2022-09-14 | One Piece | [Film: Strong World](https://www.amazon.de/s?k=One%20Piece%20Film%3A%20Strong%20World&i=instant-video) · [3D2Y: Überwinde Ace’s Tod! Das Gelübde der Kameraden](https://www.amazon.de/s?k=One%20Piece%203D2Y%3A%20Overcome%20Ace%E2%80%99s%20Death!%20Luffy%E2%80%99s%20Vow%20to%20his%20Friends&i=instant-video) · [Abenteuer auf Nebulandia](https://www.amazon.de/s?k=One%20Piece%3A%20Adventure%20of%20Nebulandia&i=instant-video) |
| 38 | 2022-09-12 | My Isekai Life: I Gained a Second Character Class and Became the Strongest Sage in the World! | [Hauptserie](https://www.netflix.com/title/81617962) |
| 39 | 2022-03-16 | Mushoku Tensei: Jobless Reincarnation | [Eris auf Goblinjagd](https://www.netflix.com/title/80987039) |
| 40 | 2022-02-18 | Fruits Basket | [Hauptserie](https://www.crunchyroll.com/de/fruits-basket) · [Prelude](https://www.crunchyroll.com/de/fruits-basket) |
| 41 | 2021-12-23 | Pokémon | [Mystery Dungeon: Team Flinke Freunde](https://www.youtube.com/watch?v=rAOmQ-foqeg) · [Mystery Dungeon: Erkundungsteams Zeit und Dunkelheit](https://www.youtube.com/watch?v=V0PlwsTLoM0) · [Mystery Dungeon: Portale in die Unendlichkeit](https://www.youtube.com/watch?v=zbwSAruo3QU) · [Der Film - Volcanion und das mechanische Wunderwerk](https://www.youtube.com/watch?v=9A22nfAK1V4) · [Entwicklungen](https://youtube.com/playlist?list=PLQWzKIaERirwN5po6LduiSLm8qc7GtuAl&si=I6QtXoF-i7cfG2c8) |
| 42 | 2021-10-21 | Kaguya-sama: Love Is War | [Ultra Romantic: Ishigami Yu möchte sich unterhalten](https://www.youtube.com/watch?v=cxTxrKrYkcY) |
| 43 | 2021-09-30 | My Next Life as a Villainess: Wie überlebe ich in einem Dating-Game? | [My Next Life as a Villainess: All Routes Lead to Doom! Ich habe die mir vorbestimmte Person getroffen](https://www.crunchyroll.com/de/my-next-life-as-a-villainess-all-routes-lead-to-doom/my-next-life-as-a-villainess-all-routes-lead-to-doom-x-i-met-my-destined-one-814444) |
| 44 | 2021-09-21 | Meine Wiedergeburt als Schleim in einer anderen Welt | [Hauptserie](http://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) |
| 45 | 2021-07-30 | Fate/Zero | [Fate/Stay Night: Unlimited Blade Works - Sunny Day](https://www.netflix.com/title/80040330) · [Fate/Grand Order Absolute Demonic Front: Babylonia - Initium Iter](https://www.netflix.com/title/81186102) · [Fate/Grand Order: Final Singularity - The Grand Temple of Time: Solomon](https://www.netflix.com/title/82850867) |
| 46 | 2021-07-30 | Fire Force | [Staffel 2 Miniepisoden](https://www.youtube.com/playlist?list=PLY_DM8ieCRPqNeMV1z2EJZDSgLWySL_Cx) |
| 47 | 2021-04-16 | Detektiv Conan | [Die scharlachrote Kugel](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.9c92f9a9-a36f-4f4e-8ccd-e0d6b3649bee) |
| 48 | 2021-03-26 | The Promised Neverland | [Staffel 2](https://www.crunchyroll.com/de/the-promised-neverland) |
| 49 | 2021-03-24 | Re:Zero - Starting Life in Another World | [Staffel 2](https://www.crunchyroll.com/de/rezero-starting-life-in-another-world-) · [Staffel 2](https://www.crunchyroll.com/de/rezero-starting-life-in-another-world-) |
| 50 | 2021-02-11 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Pretty Guardian Sailor Moon Eternal: Der Film](https://www.netflix.com/title/81214399) |
| 51 | 2020-12-17 | Sylvanian Families | [Mini-Episodes - Ivy](https://www.youtube.com/playlist?list=PLTYXZZKHiowqVVc80wtIBlUNCcRy2SKPV) · [Mini-Episoden - Klee](https://www.youtube.com/playlist?list=PLTYXZZKHiowqllFesHWXbJI3MVvxQU0Cz) · [Mini Episodes - Peony](https://www.youtube.com/playlist?list=PLduwKEaYhJ45z5Gf4Nj3jmsMvOFcpTikR) |
| 52 | 2020-06-27 | Kaguya-sama: Love Is War | [Hauptserie](https://www.crunchyroll.com/de/kaguya-sama-love-is-war) · [?](https://www.crunchyroll.com/de/kaguya-sama-love-is-war) |
| 53 | 2020-06-17 | Dorohedoro | [Teuflische Anekdoten](https://www.netflix.com/title/80991903) |
| 54 | 2020-04-04 | My Hero Academia | [4](https://www.amazon.de/s?k=My%20Hero%20Academia%20Season%204&i=instant-video) |
| 55 | 2020-03-30 | Bakugan: Spieler des Schicksals | [Bakugan: Battle Planet](https://www.netflix.com/title/81174992) |
| 56 | 2020-03-27 | One Punch Man | [Hauptserie](https://www.crunchyroll.com/series/G63K98PZ6/one-punch-man) · [OVAs](https://www.crunchyroll.com/watch/GPWU8KM42/the-shadow-that-snuck-up-too-close) · [Staffel 2 OVAs](https://www.crunchyroll.com/watch/G9DU9E4QG/saitama-and-the-mediocre-gang) |
| 57 | 2019-12-29 | Special 7: Special Crime Investigation Unit | [Hauptserie](https://www.amazon.de/s?k=Special%207%3A%20Special%20Crime%20Investigation%20Unit&i=instant-video) |
| 58 | 2019-12-25 | How Heavy Are the Dumbbells You Lift? | [Gnadenlose Trainingsstunde](https://www.crunchyroll.com/series/GP5HJ80VJ/how-heavy-are-the-dumbbells-you-lift) |
| 59 | 2019-11-03 | Pokémon | [Die TV-Serie - Sonne & Mond](https://www.amazon.de/s?k=Pok%C3%A9mon%20the%20Series%3A%20Sun%20%26%20Moon&i=instant-video) |
| 60 | 2019-10-11 | Her Blue Sky | [Hauptserie](https://www.netflix.com/title/81427482) |
| 61 | 2019-09-22 | The Ones Within | [Hauptserie](https://www.amazon.de/s?k=The%20Ones%20Within&i=instant-video) |
| 62 | 2019-09-19 | Demon Lord, Retry! | [Hauptserie](https://www.crunchyroll.com/series/GXJHM37KD/demon-lord-retry) |
| 63 | 2019-07-28 | JoJo’s Bizarre Adventure | [Hauptserie](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Stardust Crusaders](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Stardust Crusaders - Battle in Egypt](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Diamond Is Unbreakable](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Golden Wind](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) |
| 64 | 2019-06-29 | Cencoroll | [Connect](https://www.crunchyroll.com/cencoroll-connect/de-cencoroll-connect-unbekannt-850430) |
| 65 | 2019-06-21 | Ride Your Wave | [Hauptserie](https://www.crunchyroll.com/ride-your-wave/ride-your-wave-unbekannt-806160?ssid=392654) |
| 66 | 2019-03-20 | Hi Score Girl | [Extra Stage](https://www.netflix.com/title/80997338) |
| 67 | 2018-09-21 | Angels of Death | [Hauptserie](https://www.joyn.de/serien/angels-of-death) |
| 68 | 2018-09-21 | Okko’s Inn | [Okko und ihre Geisterfreunde](https://www.crunchyroll.com/okkos-inn/okko-und-ihre-geisterfreunde-der-film-unbekannt-810007?ssid=397785) |
| 69 | 2018-06-09 | Kase-san and Morning Glories | [Hauptserie](https://www.crunchyroll.com/kase-san-and-morning-glories/kase-san-and-morning-glories-unbekannt-813883) |
| 70 | 2018-04-05 | Cats: Ein schnurriges Abenteuer | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.2eb82736-4d63-bfcd-21db-a04b6a8928e3) |
| 71 | 2017-12-17 | Welcome to the Ballroom | [Hauptserie](https://www.amazon.de/s?k=Welcome%20to%20the%20Ballroom&i=instant-video) |
| 72 | 2017-09-23 | Kakegurui: Das Leben ist ein Spiel | [Hauptserie](https://www.netflix.com/title/80175351) |
| 73 | 2017-08-25 | Your Voice: Kimikoe | [Hauptserie](https://www.crunchyroll.com/your-voice-kimikoe-/de-your-voice-kimikoe-unbekannt-850378) |
| 74 | 2017-08-18 | Fireworks: Alles eine Frage der Zeit | [Hauptserie](https://www.youtube.com/watch?v=RXD_V4p2iiA) |
| 75 | 2017-08-04 | Haikyu!! | [Sonderbeitrag: Die Jugend beim Frühlingsturnier](https://www.crunchyroll.com/de/haikyu-dubs/episode-3-special-feature-the-spring-tournament-of-their-youth-848359) |
| 76 | 2017-06-23 | Saekano: How to Raise a Boring Girlfriend | [.flat](https://www.amazon.de/s?k=Saekano%3A%20How%20to%20Raise%20a%20Boring%20Girlfriend%20%E2%99%AD&i=instant-video) |
| 77 | 2017-05-19 | Lu over the Wall | [Hauptserie](https://www.crunchyroll.com/lu-over-the-wall/lu-over-the-wall-unbekannt-811213?ssid=399959) |
| 78 | 2017-04-07 | Night is Short, Walk on Girl | [Hauptserie](https://www.crunchyroll.com/night-is-short-walk-on-girl/night-is-short-walk-on-girl-unbekannt-811211?ssid=399939) |
| 79 | 2017-03-31 | Scum’s Wish | [Hauptserie](https://www.amazon.de/s?k=Scum's%20Wish&i=instant-video) |
| 80 | 2017-03-26 | Yu-Gi-Oh! Arc-V | [Hauptserie](https://www.netflix.com/title/80987906) |
| 81 | 2017-02-25 | The Dragon Dentist | [Hauptserie](https://www.crunchyroll.com/the-dragon-dentist/deomu-the-dragon-dentist-unbekannt-811630?ssid=401190) |
| 82 | 2017-02-04 | Lupin III.: Teil 1 | [Lupin III.: Der Schatz des Harimao](https://www.crunchyroll.com/lupin-the-3rd-tv-specials/lupin-iii-tv-special-der-schatz-des-harimao-unbekannt-813894?ssid=407180) · [Lupin III.: Daisuke Jigens Grabstein](https://www.crunchyroll.com/lupin-the-3rd-movies/daisuke-jigens-grabstein-unbekannt-822025?ssid=423942) · [Lupin III.: Goemon Ishikawa, der es Blut regnen lässt](https://www.crunchyroll.com/lupin-the-3rd-movies/goemon-ishikawa-der-es-blut-regnen-lsst-unbekannt-822028?ssid=423944) |
| 83 | 2017-02-03 | Project Itoh: Genocidal Organ | [Hauptserie](https://www.crunchyroll.com/genocidal-organ/genocidal-organ-unbekannt-807915?ssid=394444) |
| 84 | 2016-12-24 | JoJo’s Bizarre Adventure | [Diamond Is Unbreakable](https://www.amazon.de/s?k=JoJo's%20Bizarre%20Adventure%3A%20Diamond%20is%20Unbreakable&i=instant-video) |
| 85 | 2016-12-09 | Detektiv Conan | [Der Magier des letzten Jahrhunderts](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-3-der-magier-des-letzten-jahrhunderts-unbekannt-810166) · [Der Killer in ihren Augen](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-4-der-killer-in-ihren-augen-unbekannt-810167) · [Das verlorene Schiff im Himmel](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-14-das-verlorene-schiff-im-himmel-unbekannt-811396?ssid=400599) · [Der Scharfschütze aus einer anderen Dimension](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-18-der-scharfschtze-aus-einer-anderen-dimension-unbekannt-812231) · [Episode ONE - Der geschrumpfte Meisterdetektiv](https://www.crunchyroll.com/detektiv-conan/detektiv-conan-tv-special-episode-one-der-geschrumpfte-meisterdetektiv-unbekannt-821630?ssid=422962) |
| 86 | 2016-09-24 | Food Wars! Shokugeki no Soma | [Food Wars! The Second Plate](https://www.amazon.de/s?k=Food%20Wars!%20The%20Second%20Plate&i=instant-video) |
| 87 | 2016-08-26 | Your Name. Gestern, heute und für immer | [Hauptserie](https://www.amazon.de/s?k=Your%20Name.&i=instant-video) |
| 88 | 2016-08-26 | Your Name. Gestern, heute und für immer | [Hauptserie](https://www.youtube.com/watch?v=duoOTzpeWSE) |
| 89 | 2015-12-26 | Noragami | [Aragoto](https://www.amazon.de/s?k=Noragami%20Aragoto&i=instant-video) |
| 90 | 2015-12-16 | Sound! Euphonium | [Auf die Plätze, fertig, Monaka](https://www.crunchyroll.com/de/sound-euphonium) |
| 91 | 2015-11-13 | Project Itoh: Harmony | [Hauptserie](https://www.crunchyroll.com/harmony/harmony-unbekannt-807914?ssid=394443) |
| 92 | 2015-10-02 | Project Itoh: The Empire of Corpses | [Hauptserie](https://www.crunchyroll.com/the-empire-of-corpses/the-empire-of-corpses-unknown-808170?ssid=395057) |
| 93 | 2015-05-09 | Miss Hokusai | [Hauptserie](https://www.netflix.com/title/80075828) |
| 94 | 2015-03-28 | Ronja Räubertochter | [Hauptserie](https://www.amazon.de/s?k=Ronja%2C%20the%20Robber's%20Daughter&i=instant-video) |
| 95 | 2015-03-28 | Tenkai Knights: Die Tenkai Ritter | [Hauptserie](https://www.amazon.de/s?k=Tenkai%20Knights&i=instant-video) |
| 96 | 2014-12-29 | Rage of Bahamut: Genesis | [Hauptserie](https://www.amazon.de/s?k=Rage%20of%20Bahamut%3A%20Genesis&i=instant-video) |
| 97 | 2014-11-22 | Love Stage!! | [Daran war gar nichts leicht](https://www.crunchyroll.com/love-stage/episode-11-841216) |
| 98 | 2014-11-15 | Expelled from Paradise | [Hauptserie](https://www.netflix.com/title/80038207) |
| 99 | 2014-09-28 | The Irregular at Magic High School | [Hauptserie](https://www.crunchyroll.com/series/GRMGDGZVR/the-irregular-at-magic-high-school) |
| 100 | 2014-09-16 | Love, Chunibyo & Other Delusions! | [Love, Chunibyo & Other Delusions: Heart Throb - Offenbarung des wahren Auges des bösen Königs … Wiederholung](https://www.crunchyroll.com/love-chunibyo-other-delusions-heart-throb-/episode-13-799361?ssid=387047) |
| 101 | 2014-06-28 | Ghost in the Shell: Stand Alone Complex | [Ghost in the Shell: Arise - Border:1 Ghost Pain](https://www.netflix.com/title/80002073) · [Ghost in the Shell: Arise - Border:2 Ghost Whispers](https://www.netflix.com/title/80002074) · [Ghost in the Shell: Arise - Border:3 Ghost Tears](https://www.netflix.com/title/80021983) |
| 102 | 2014-06-20 | Selector Infected Wixoss | [Hauptserie](https://www.amazon.de/s?k=selector%20infected%20WIXOSS&i=instant-video) |
| 103 | 2014-03-28 | Kill La Kill | [Hauptserie](https://www.netflix.com/title/70305217) |
| 104 | 2014-03-27 | Space Dandy | [Hauptserie](https://www.amazon.de/s?k=Space%20Dandy&i=instant-video) |
| 105 | 2013-03-26 | The Pet Girl of Sakurasou | [Hauptserie](https://www.amazon.de/s?k=The%20Pet%20Girl%20of%20Sakurasou&i=instant-video) |
| 106 | 2012-12-26 | Jormungand | [Perfect Order](https://www.amazon.de/s?k=Jormungand%3A%20Perfect%20Order&i=instant-video) |
| 107 | 2012-09-30 | B-Daman Crossfire | [Hauptserie](https://www.youtube.com/playlist?list=PL4o1lot_6q1EHL3vw_t4BGuHK6uBHyETT) |
| 108 | 2012-09-24 | Yu-Gi-Oh! Zexal | [Hauptserie](https://www.crunchyroll.com/series/GRDQD8PDY/yu-gi-oh-zexal) |
| 109 | 2012-08-18 | Fairy Tail | [The Movie - Phoenix Priestess](https://www.crunchyroll.com/fairy-tail-movies/fairy-tail-the-movie-phoenix-princess-unbekannt-821316?ssid=422327) |
| 110 | 2012-07-21 | Starship Troopers: Invasion | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.8ca9f6c3-21de-5225-749f-931196618766) |
| 111 | 2012-03-24 | Shakugan no Shana | [Season III](https://www.amazon.de/s?k=Shakugan%20no%20Shana%3A%20Season%20III&i=instant-video) |
| 112 | 2011-12-03 | K-On! | [The Movie](https://www.crunchyroll.com/k-on/k-on-the-movie-unbekannt-822264?ssid=424604) |
| 113 | 2011-04-29 | Onigamiden: Legend of the Millennium Dragon | [Hauptserie](https://www.youtube.com/watch?v=W8YuJXFKZ-k) |
| 114 | 2010-12-04 | Bleach | [The Movie - Fade to Black](https://www.netflix.com/title/70208801) · [The Movie - Hell Verse](https://www.netflix.com/title/70260383) |
| 115 | 2010-06-25 | Durarara!! | [Hauptserie](https://www.crunchyroll.com/series/G619XVNEY/durarara) |
| 116 | 2010-03-25 | Gintama | [Hauptserie](https://www.crunchyroll.com/series/GYQ4MKDZ6/gintama) |
| 117 | 2009-12-28 | Angeloid: Sora no Otoshimono | [Hauptserie](https://www.netflix.com/title/70266999) |
| 118 | 2009-03-26 | Toradora! | [Hauptserie](https://www.amazon.de/s?k=Toradora!&i=instant-video) |
| 119 | 2008-08-22 | Death Note | [Relight](https://www.netflix.com/title/70204970) |
| 120 | 2007-09-12 | Zombie-Loan | [Hauptserie](https://www.amazon.de/s?k=Zombie%20Loan&i=instant-video) |
| 121 | 2006-09-27 | Ouran High School Host Club | [Hauptserie](https://www.netflix.com/title/70205014) |
| 122 | 2005-09-14 | Final Fantasy VII: Advent Children | [Hauptserie](https://www.youtube.com/watch?v=IFKqfiIE66Q) |
| 123 | 2005-03-19 | Samurai Champloo | [Hauptserie](https://www.netflix.com/title/70213065) |
| 124 | 2005-03-19 | Samurai Champloo | [Hauptserie](https://www.amazon.de/s?k=Samurai%20Champloo&i=instant-video) |
| 125 | 2005-03-16 | Tenjo Tenge | [Hauptserie](https://www.amazon.de/s?k=Tenjho%20Tenge&i=instant-video) · [OVA](https://www.amazon.de/s?k=Tenjho%20Tenge%3A%20The%20Ultimate%20Fight&i=instant-video) |
| 126 | 2003-11-08 | Tokyo Godfathers | [Hauptserie](https://www.youtube.com/watch?v=jderzQDdDHc) |
| 127 | 2000-10-24 | Sin: The Movie | [Hauptserie](http://www.crunchyroll.com/de/sin-the-movie) |
| 128 | 2000-03-27 | The Candidate for Goddess | [Hauptserie](https://www.amazon.de/s?k=Pilot%20Candidate&i=instant-video) |
| 129 | 1998-03-31 | Berserk | [Hauptserie](https://www.netflix.com/title/80243876) |
| 130 | 1997-08-01 | Kimba, der weiße Löwe | [Jungle Emperor Leo: Der Kinofilm](https://www.crunchyroll.com/de/jungle-emperor-leo) |
| 131 | 1995-12-23 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Sailor Moon R Movie: Gefährliche Blumen](https://www.amazon.de/s?k=Sailor%20Moon%20R%3A%20The%20Movie&i=instant-video) · [Sailor Moon S: Schneeprinzessin Kaguya](https://www.amazon.de/s?k=Sailor%20Moon%20S%20Movie%3A%20Hearts%20in%20Ice&i=instant-video) · [Sailor Moon Super S: Reise ins Land der Träume](https://www.amazon.de/s?k=Sailor%20Moon%20SuperS%20the%20Movie%3A%20Black%20Dream%20Hole&i=instant-video) |
| 132 | 1994-08-06 | Street Fighter II: The Animated Movie | [Hauptserie](https://www.crunchyroll.com/de/street-fighter-ii-the-animated-movie) |
| 133 | 1994-08-06 | Street Fighter II: The Animated Movie | [Hauptserie](https://www.amazon.de/s?k=Street%20Fighter%20II%3A%20The%20Animated%20Movie&i=instant-video) |
| 134 | 1991-10-03 | Die Mumins | [Hauptserie](https://www.youtube.com/playlist?list=PLL0kUUHCSZA6VQjBcZ8TJ-tshEMyPsSt6) |
| 135 | 1987-07-18 | Knights of the Zodiac: Saint Seiya Teil 2 | [Saint Seiya: Die Krieger des Zodiac - Movie 1: Die Legende des goldenen Apfels](https://www.amazon.de/s?k=Saint%20Seiya%3A%20Evil%20Goddess%20Eris&i=instant-video) |
| 136 | 1981-03-14 | Unico: Das phantastische Abenteuer eines Hörnchens | [Hauptserie](https://www.amazon.de/s?k=Fantastic%20Adventures%20of%20Unico&i=instant-video) |
| 137 | 1980-12-28 | Tom Sawyers Abenteuer | [Hauptserie](https://www.amazon.de/s?k=The%20Adventures%20of%20Tom%20Sawyer&i=instant-video) |
| 138 | 1979-12-15 | Lupin III.: Teil 1 | [Das Schloss des Cagliostro](https://www.netflix.com/title/70050576) |
| 139 | 1968-04-07 | Choppy und die Prinzessin | [Hauptserie](https://www.youtube.com/watch?v=A0DaeCtJTG0) |
| 140 | 1968-03-31 | Speed Racer | [Hauptserie](https://www.youtube.com/playlist?list=PLnY1FL_e1HO5NAcu_AaLWeYkpUc5KqVI3) |

## Warum die einzelnen Anbieter unsicher sind

- **ADN:** Der Titel steht nicht im ADN-Bestand mit Sprachcode vde. Möglich, dass er inzwischen dazugekommen ist.
- **Crunchyroll:** Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.
- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Joyn:** Joyn nennt die Sprachfassung nirgends öffentlich.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
- **YouTube:** YouTube nennt in den Metadaten keine Tonspur. Ob der Kanal die deutsche Fassung hochgeladen hat, sieht man erst im Video.
