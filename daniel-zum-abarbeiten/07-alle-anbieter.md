# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-08-26 · **667 offene Verweise** in **432 Zeilen**.

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
| [Crunchyroll](07-crunchyroll.md) | 460 |
| [Prime Video](07-primevideo.md) | 118 |
| [Disney+](07-disneyplus.md) | 34 |
| [Netflix](07-netflix.md) | 26 |
| [YouTube](07-youtube.md) | 22 |
| [ADN](07-adn.md) | 5 |
| [Joyn](07-joyn.md) | 2 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-06-29 | Gunslinger Girl | [Hauptserie](https://www.crunchyroll.com/de/gunslinger-girl) |
| 2 | 2026-06-25 | Dr. Stone | [Special Episode: Ryusui](https://www.crunchyroll.com/de/series/GYEXQKJG6/dr-stone) · [New World](https://www.crunchyroll.com/de/series/GYEXQKJG6/dr-stone) · [Science Future - Cour 2](https://www.crunchyroll.com/de/series/GYEXQKJG6/dr-stone) · [Science Future - Cour 3](https://www.crunchyroll.com/de/series/GYEXQKJG6/dr-stone) |
| 3 | 2026-06-18 | Baki | [BAKI-DOU: The Invincible Samurai Teil 2](https://www.netflix.com/title/81922765) |
| 4 | 2026-06-05 | Gantz | [Hauptserie](http://www.crunchyroll.com/de/gantz) · [Hauptserie](http://www.crunchyroll.com/de/gantz) |
| 5 | 2026-05-31 | Rooster Fighter | [Hauptserie](https://www.disneyplus.com/de-de/browse/entity-75f4baad-151d-489d-8a9e-bec4ab49ed23) |
| 6 | 2026-05-27 | Dorohedoro | [Hauptserie](https://www.disneyplus.com/browse/entity-99c35086-cc39-481c-9827-333c0ab15d5a) · [Staffel 2](https://www.disneyplus.com/browse/entity-99c35086-cc39-481c-9827-333c0ab15d5a) |
| 7 | 2026-05-02 | Kill Blue | [Hauptserie](https://www.youtube.com/playlist?list=PLhGamQZtJ7K-rS4G9zn-Bsb93kgFIphCM) |
| 8 | 2026-04-04 | Das Band der Unterwelt | [Hauptserie](https://crunchyroll.com/de/series/GT00371630/daemons-of-the-shadow-realm) |
| 9 | 2026-04-04 | Das Band der Unterwelt | [Hauptserie](https://www.disneyplus.com/browse/entity-8cc06990-0faf-4a7e-ac1f-fb74cb4b9286) |
| 10 | 2026-03-27 | Jujutsu Kaisen | [Hauptserie](https://www.disneyplus.com/browse/entity-3dd9925f-0eb8-46f4-93d0-30ba887fc8d3) · [Staffel 2](https://www.disneyplus.com/browse/entity-3dd9925f-0eb8-46f4-93d0-30ba887fc8d3) · [Staffel 3](https://www.disneyplus.com/browse/entity-3dd9925f-0eb8-46f4-93d0-30ba887fc8d3) |
| 11 | 2026-03-25 | One Piece | [Hauptserie](https://www.netflix.com/title/80107103) |
| 12 | 2026-03-22 | Medalist: Staffel 2 | [Hauptserie](https://www.disneyplus.com/de-de/series/medalist/4LgC0zEd5JEx) |
| 13 | 2026-03-20 | Assassination Classroom | [Hauptserie](https://www.crunchyroll.com/de/assassination-classroom) · [II](https://www.crunchyroll.com/de/assassination-classroom) · [Koro Sensei Quest!](http://www.crunchyroll.com/de/koro-sensei-quest) · [Our Time - The Movie](https://www.crunchyroll.com/de/series/GMTE00376679/assassination-classroom-the-movie-our-time) |
| 14 | 2026-03-11 | Magical Girl Spec Ops Asuka | [Hauptserie](https://www.joyn.de/serien/magical-girl-special-ops-asuka) |
| 15 | 2026-03-04 | Detektiv Conan | [Der tickende Wolkenkratzer](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-1-der-tickende-wolkenkratzer-unbekannt-810163) · [Das 14. Ziel](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-2-das-14-ziel-unbekannt-810165) · [Der Magier des letzten Jahrhunderts](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-3-der-magier-des-letzten-jahrhunderts-unbekannt-810166) · [Der Killer in ihren Augen](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-4-der-killer-in-ihren-augen-unbekannt-810167) · [Countdown zum Himmel](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-5-countdown-zum-himmel-unbekannt-810169?ssid=398572) · [Das Phantom der Baker Street](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-6-das-phantom-der-baker-street-unbekannt-810184?ssid=398574) · [Die Partitur des Grauens](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-12-die-partitur-des-grauens-unbekannt-811393?ssid=400590) · [Lupin III. vs Detektiv Conan: The Special](https://www.crunchyroll.com/detektiv-conan/detektiv-conan-tv-special-lupin-iii-vs-detektiv-conan-unbekannt-812798?ssid=404716) · [Das verlorene Schiff im Himmel](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-14-das-verlorene-schiff-im-himmel-unbekannt-811396?ssid=400599) · [Die 15 Minuten der Stille](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-15-die-15-minuten-der-stille-unbekannt-811397?ssid=400596) · [Der 11. Stürmer](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-16-der-11-strmer-unbekannt-811399?ssid=400598) · [Detektiv auf hoher See](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-17-detektiv-auf-hoher-see-unbekannt-812230?ssid=402659) · [Der Scharfschütze aus einer anderen Dimension](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-18-der-scharfschtze-aus-einer-anderen-dimension-unbekannt-812231) · [Magic Kaito 1412](http://www.crunchyroll.com/de/magickaito) · [Episode ONE - Der geschrumpfte Meisterdetektiv](https://www.crunchyroll.com/detektiv-conan/detektiv-conan-tv-special-episode-one-der-geschrumpfte-meisterdetektiv-unbekannt-821630?ssid=422962) · [Der purpurrote Liebesbrief](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-21-der-purpurrote-liebesbrief-unbekannt-812236?ssid=402669) · [Zero der Vollstrecker](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-22-zero-der-vollstrecker-unbekannt-812237?ssid=402670) · [Die stahlblaue Faust](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-23-die-stahlblaue-faust-unbekannt-857862) · [Das Scharlachrote Alibi](https://www.crunchyroll.com/watch/G50UZ54W0/the-scarlet-alibi-german-dub) · [Die scharlachrote Kugel](https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-24-die-scharlachrote-kugel-unbekannt-867288) · [Die Halloween-Braut](https://www.crunchyroll.com/watch/G4VUQVNJ8/) · [Das schwarze U-Boot](https://www.crunchyroll.com/watch/GJWUQN11K/) |
| 16 | 2026-01-30 | Cat's Eye | [Cat’s Eye: Ein Supertrio](https://www.disneyplus.com/de-de/browse/entity-21240dd9-5fb4-4334-be13-687a6bd230f7) |
| 17 | 2025-12-28 | One Punch Man | [One-Punch Man: Staffel 3](https://www.disneyplus.com/de-de/browse/entity-54a25fcf-a472-4d40-9968-13e2957e5abf) |
| 18 | 2025-12-24 | Wandance | [Hauptserie](https://www.disneyplus.com/de-de/browse/entity-8019edc8-5f73-4c70-88eb-02ea35f724d4) |
| 19 | 2025-12-22 | Hände weg, Kotesashi-kun | [Hauptserie](https://www.crunchyroll.com/de/series/GT00365079/hands-off-sawaranaide-kotesashi-kun) |
| 20 | 2025-12-17 | Disney Twisted-Wonderland: Die Serie - Episode of Heartslabyul | [Hauptserie](https://www.disneyplus.com/de-de/browse/entity-dea589b3-2f6d-4991-a875-c67d625a4e37) |
| 21 | 2025-11-26 | Highschool of the Dead | [Hauptserie](https://www.amazon.de/s?k=High%20School%20of%20the%20Dead&i=instant-video) |
| 22 | 2025-10-29 | Star Wars: Visionen | [Hauptserie](https://www.disneyplus.com/de-de/series/star-wars-visions/5AiiTRJ7OaKg) · [Volume 3](https://www.disneyplus.com/de-de/browse/entity-38cebadb-e808-47aa-8223-181fc1416ec1) |
| 23 | 2025-08-21 | Terra Formars | [Hauptserie](http://www.crunchyroll.com/de/terraformars) |
| 24 | 2025-08-21 | Terra Formars | [Hauptserie](https://www.amazon.de/s?k=Terra%20Formars&i=instant-video) |
| 25 | 2025-08-13 | Bullet/Bullet | [Hauptserie](https://www.disneyplus.com/de-de/browse/entity-52e7dbe7-b28a-428a-963e-acfaa81b4ba6) |
| 26 | 2025-07-17 | Sword Art Online | [Hauptserie](http://www.crunchyroll.com/de/sword-art-online) · [Extra Edition](http://www.crunchyroll.com/de/sword-art-online) · [Alicization - War of Underworld](https://www.crunchyroll.com/de/sword-art-online) · [Alicization - War of Underworld](https://www.crunchyroll.com/de/sword-art-online) |
| 27 | 2025-06-29 | Go, Go, Loser Ranger! | [Hauptserie](https://www.disneyplus.com/de-de/series/go-go-loser-ranger/2VX5fKgeiVEl) · [Go! Go! Loser Ranger!](https://www.disneyplus.com/de-de/series/go-go-loser-ranger/2VX5fKgeiVEl) |
| 28 | 2025-06-25 | Your Forma | [Hauptserie](https://www.amazon.de/s?k=YOUR%20FORMA&i=instant-video) |
| 29 | 2025-06-23 | Kakushite! Makina-san!! | [Hauptserie](https://www.amazon.de/s?k=Kakushite!%20Makina-san!&i=instant-video) |
| 30 | 2025-06-21 | Fire Force | [Staffel 3](https://www.disneyplus.com/de-de/browse/entity-5973d358-1997-47d0-942d-e85b455ed9db) |
| 31 | 2025-06-11 | Sword Art Online | [The Movie: Ordinal Scale](https://www.netflix.com/watch/80180071?source=35) |
| 32 | 2025-03-24 | Promise of Wizard | [Hauptserie](https://www.crunchyroll.com/de/series/GXJHM3GG8/promise-of-wizard) |
| 33 | 2025-02-17 | Arifureta: From Commonplace to World’s Strongest | [Hauptserie](https://www.crunchyroll.com/de/arifureta-from-commonplace-to-worlds-strongest) · [Staffel 2](https://www.crunchyroll.com/de/arifureta-from-commonplace-to-worlds-strongest) · [Über Umwege zum stärksten der Welt](https://www.crunchyroll.com/de/series/G4PH0WXD1/arifureta-from-commonplace-to-worlds-strongest) · [Die wundersame Begegnung und das phantasmagorische Abenteuer](https://crunchyroll.com/de/series/G4PH0WXD1) · [Hauptserie](https://www.crunchyroll.com/de/series/G4PH0WXD1/arifureta-from-commonplace-to-worlds-strongest) |
| 34 | 2025-02-06 | The Demon Sword Master of Excalibur Academy | [Hauptserie](https://www.amazon.de/s?k=The%20Demon%20Sword%20Master%20of%20Excalibur%20Academy&i=instant-video) |
| 35 | 2024-09-27 | NieR:Automata Ver1.1a | [Hauptserie](https://www.crunchyroll.com/de/nierautomata-ver11a) · [Cour 2](https://www.crunchyroll.com/de/series/GNVHKNPW1/nierautomata-ver11a) |
| 36 | 2024-09-22 | Cheer for You! | [Hauptserie](https://www.crunchyroll.com/de/series/GEXH3W2GK/narenare--cheer-for-you-) |
| 37 | 2024-09-20 | Given | [The Movie](https://www.crunchyroll.com/de/given) · [The Movie - To the Sea](https://www.crunchyroll.com/de/watch/G7PU3DWNQ/given-the-movie-to-the-sea) |
| 38 | 2024-09-20 | I Parry Everything! | [Hauptserie](https://www.amazon.de/s?k=I%20Parry%20Everything&i=instant-video) |
| 39 | 2024-09-20 | Overlord | [Hauptserie](http://www.crunchyroll.com/de/overlord) · [Movies](https://www.crunchyroll.com/de/overlord) · [The Dark Hero](https://www.crunchyroll.com/de/overlord) · [II](http://www.crunchyroll.com/de/overlord) · [III](http://www.crunchyroll.com/de/overlord) · [IV](https://www.crunchyroll.com/de/overlord) · [The Sacred Kingdom](https://www.crunchyroll.com/de/series/G69PZ5PDY/overlord) |
| 40 | 2024-09-06 | Code Geass: Lelouch of the Rebellion | [Code Geass: Rozé of the Recapture](https://www.disneyplus.com/de-de/series/code-geass-roze-of-the-recapture/4XHzb6tQBRtd) |
| 41 | 2024-09-05 | To Love-Ru: Trouble | [Hauptserie](http://www.crunchyroll.com/de/to-love-ru) · [To Love Ru: Darkness](http://www.crunchyroll.com/de/to-love-ru-darkness) · [To Love Ru: Darkness 2nd](http://www.crunchyroll.com/de/to-love-ru-darkness) |
| 42 | 2024-08-16 | Wolf’s Rain | [Hauptserie](https://www.crunchyroll.com/de/wolfs-rain) |
| 43 | 2024-07-18 | Sankarea: Undying Love | [Hauptserie](https://www.crunchyroll.com/de/sankarea) · [Ich bin auch nur … ein Zombie …](https://www.crunchyroll.com/de/sankarea) |
| 44 | 2024-07-11 | Beyond the Boundary: Kyoukai no Kanata | [Hauptserie](https://www.amazon.de/s?k=Beyond%20the%20Boundary&i=instant-video) |
| 45 | 2024-06-30 | Captain Tsubasa: Die tollen Fußballstars | [Captain Tsubasa](https://www.amazon.de/s?k=Captain%20Tsubasa%20(2018)&i=instant-video) · [Captain Tsubasa: Staffel 2 - Die Junioren](https://www.amazon.de/s?k=Captain%20Tsubasa%3A%20Junior%20Youth%20Arc&i=instant-video) |
| 46 | 2024-06-29 | Kaiju No. 8 | [Hauptserie](https://www.crunchyroll.com/de/series/GG5H5XQ7D/kaiju-no-8) |
| 47 | 2024-06-26 | Date a Live | [Hauptserie](https://www.crunchyroll.com/de/date-a-live) · [II](https://www.crunchyroll.com/de/date-a-live) · [The Movie – Mayuri Judgement](https://www.crunchyroll.com/de/date-a-live) · [III](https://www.crunchyroll.com/de/date-a-live) · [Date A Bullet: Dead or Bullet & Nightmare or Queen](https://www.crunchyroll.com/de/series/GYEX5E1G6/date-a-live) · [Date A Bullet: Dead or Bullet & Nightmare or Queen](https://www.crunchyroll.com/de/series/GYEX5E1G6/date-a-live) · [IV](https://www.crunchyroll.com/de/date-a-live) · [V](https://www.crunchyroll.com/de/series/GYEX5E1G6/date-a-live) |
| 48 | 2024-06-19 | Konosuba: God’s Blessing on This Wonderful World! | [KonoSuba: God’s Blessing on This Wonderful World! 3](https://www.crunchyroll.com/de/series/GYE5K3GQR/konosuba--gods-blessing-on-this-wonderful-world) |
| 49 | 2024-06-06 | Aesthetica of a Rogue Hero | [Hauptserie](https://www.crunchyroll.com/de/aesthetica-of-a-rogue-hero) |
| 50 | 2024-05-10 | The Testament of Sister New Devil | [Hauptserie](https://www.crunchyroll.com/de/the-testament-of-sister-new-devil) · [Burst](http://www.crunchyroll.com/de/the-testament-of-sister-new-devil) · [Departures](https://www.crunchyroll.com/de/the-testament-of-sister-new-devil) |
| 51 | 2024-05-05 | Ninja Kamui | [Hauptserie](https://www.amazon.de/s?k=Ninja%20Kamui&i=instant-video) |
| 52 | 2024-05-01 | Sand Land: The Series | [Hauptserie](https://www.disneyplus.com/de-de/series/sand-land-the-series/7I31jGPKAwz5) |
| 53 | 2024-04-09 | Free! Iwatobi Swim Club | [High Speed! Free! Starting Days](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! -Timeless Medley- The Bond](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Timeless Medley](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! Take Your Marks](https://www.crunchyroll.com/de/series/GRDQV2VWY/free---iwatobi-swim-club) · [Free! the Final Stroke: The First Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) · [Free! the Final Stroke: The Second Volume](https://www.crunchyroll.com/de/free-iwatobi-swim-club) |
| 54 | 2024-03-31 | Shangri-La Frontier | [Hauptserie](https://www.amazon.de/s?k=Shangri-La%20Frontier&i=instant-video) |
| 55 | 2024-03-31 | Solo Leveling | [Hauptserie](https://www.amazon.de/s?k=Solo%20Leveling&i=instant-video) |
| 56 | 2024-03-23 | Undead Unluck | [Hauptserie](https://www.disneyplus.com/de-de/series/undead-unluck/6yBbjezPBwNW) |
| 57 | 2024-03-22 | Frieren: Nach dem Ende der Reise | [Hauptserie](https://www.amazon.de/s?k=Frieren%3A%20Beyond%20Journey%E2%80%99s%20End&i=instant-video) |
| 58 | 2024-03-20 | Ishura | [Hauptserie](https://www.disneyplus.com/de-de/series/ishura/hQ0p1WPHHQmZ) |
| 59 | 2024-02-16 | Haikyu!! | [Lev ist hier!](https://www.netflix.com/title/80090673) · [Kampf gegen ungenügende Noten](https://www.netflix.com/title/80090673) · [Sonderbeitrag: Die Jugend beim Frühlingsturnier](https://www.netflix.com/title/80090673) · [An Land vs. In der Luft / Der ”Weg” des Balls](https://www.netflix.com/title/80090673) · [Das Play-off der Müllhalde](https://www.netflix.com/title/) |
| 60 | 2024-01-21 | One Piece | [Film: Strong World](https://www.amazon.de/s?k=One%20Piece%20Film%3A%20Strong%20World&i=instant-video) · [Z](https://www.amazon.de/s?k=One%20Piece%20Film%3A%20Z&i=instant-video) · [3D2Y: Überwinde Ace’s Tod! Das Gelübde der Kameraden](https://www.amazon.de/s?k=One%20Piece%203D2Y%3A%20Overcome%20Ace%E2%80%99s%20Death!%20Luffy%E2%80%99s%20Vow%20to%20his%20Friends&i=instant-video) · [Abenteuer auf Nebulandia](https://www.amazon.de/s?k=One%20Piece%3A%20Adventure%20of%20Nebulandia&i=instant-video) · [Monsters: 103 Mercies Dragon Damnation](https://www.amazon.de/s?k=MONSTERS%3A%20103%20Mercies%20Dragon%20Damnation&i=instant-video) |
| 61 | 2023-12-27 | Tokyo Revengers | [Hauptserie](https://www.disneyplus.com/browse/entity-be391742-6617-42ad-b53a-be368ee73335) · [Christmas Showdown](https://www.disneyplus.com/de-de/series/tokyo-revengers/4HFbN55sAh0i) · [Tenjiku Arc](https://www.disneyplus.com/de-de/series/tokyo-revengers/4HFbN55sAh0i) |
| 62 | 2023-12-22 | Goblin Slayer | [Hauptserie](https://www.crunchyroll.com/de/goblin-slayer) · [Goblin’s Crown](https://www.crunchyroll.com/de/goblin-slayer) · [2](https://www.crunchyroll.com/de/series/G6VDMN306/goblin-slayer) |
| 63 | 2023-12-21 | Kizuna no Allele | [Hauptserie](https://www.crunchyroll.com/de/series/G0XHWM577/kizuna-no-allele) · [Staffel 2](https://www.crunchyroll.com/de/series/G0XHWM577/kizuna-no-allele) |
| 64 | 2023-12-19 | The Saint’s Magic Power Is Omnipotent | [Hauptserie](https://www.crunchyroll.com/de/the-saints-magic-power-is-omnipotent) · [Staffel 2](https://www.crunchyroll.com/de/series/G1XHJV3P3/the-saints-magic-power-is-omnipotent) |
| 65 | 2023-12-13 | Pokémon Horizonte | [Pokémon: Winde aus Paldea](https://www.youtube.com/playlist?list=PLQWzKIaERirzLZWMu3M89ZEpsDt9YtDBM) · [Meisterdetektiv Pikachu und der verschwundene Pudding](https://www.youtube.com/watch?v=5yQSUimraSU) |
| 66 | 2023-12-01 | Rascal Does Not Dream of Bunny Girl Senpai | [Hauptserie](https://www.crunchyroll.com/de/series/GYW4MG9G6/rascal-does-not-dream-series) · [Rascal Does Not Dream of a Dreaming Girl](https://www.crunchyroll.com/de/series/GYW4MG9G6/rascal-does-not-dream-of-bunny-girl-senpai) · [Rascal Does Not Dream of a Sister Venturing Out](https://www.crunchyroll.com/de/watch/G0DUMXDPZ/rascal-does-not-dream-of-a-sister-venturing-out) · [Rascal Does Not Dream of a Knapsack Kid](https://www.crunchyroll.com/de/watch/GWDU73EX8/rascal-does-not-dream-of-a-knapsack-kid) |
| 67 | 2023-10-06 | Beyblade X | [Hauptserie](https://www.netflix.com/title/81924739) |
| 68 | 2023-10-06 | Beyblade X | [Hauptserie](https://www.disneyplus.com/browse/entity-0e46c665-5191-407f-8dc5-e22a0095578c) |
| 69 | 2023-10-01 | Edens Zero | [Staffel 2](https://www.crunchyroll.com/de/series/G79H23XJJ/edens-zero) |
| 70 | 2023-10-01 | Free! Iwatobi Swim Club | [Free! Dive to the Future](https://www.amazon.de/s?k=Free!%20-Dive%20to%20the%20Future-&i=instant-video) |
| 71 | 2023-10-01 | Haikyu!! | [Hauptserie](https://www.amazon.de/s?k=HAIKYU!!&i=instant-video) |
| 72 | 2023-10-01 | Kenichi: The Mightiest Disciple | [Hauptserie](https://www.crunchyroll.com/de/kenichi-the-mightiest-disciple) |
| 73 | 2023-10-01 | Magister Negi Magi | [UQ Holder! Magister Negi Magi Negima! 2](https://www.amazon.de/s?k=UQ%20Holder!&i=instant-video) |
| 74 | 2023-09-28 | The Devil Is a Part-Timer! | [Hauptserie](https://crunchyroll.com/de/series/GR75Z5KKY/the-devil-is-a-part-timer) · [II](https://www.crunchyroll.com/de/series/GR75Z5KKY/the-devil-is-a-part-timer) · [II](https://www.crunchyroll.com/de/series/GR75Z5KKY/the-devil-is-a-part-timer) |
| 75 | 2023-09-23 | Horimiya | [Hauptserie](https://www.amazon.de/s?k=Horimiya&i=instant-video) · [The Missing Pieces](https://www.amazon.de/s?k=Horimiya%3A%20The%20Missing%20Pieces&i=instant-video) |
| 76 | 2023-09-17 | Love Live! Sunshine!! | [Hauptserie](http://www.crunchyroll.com/de/love-live-sunshine) · [Staffel 2](http://www.crunchyroll.com/de/love-live-sunshine) · [Yohane the Parhelion: Sunshine in the Mirror](https://www.crunchyroll.com/de/series/G5PHNM9ZM/yohane-the-parhelion--sunshine-in-the-mirror) |
| 77 | 2023-08-23 | Tonikawa: Over the Moon for You | [Hauptserie](https://www.crunchyroll.com/de/tonikawa-over-the-moon-for-you) · [Social Media](https://www.crunchyroll.com/de/tonikawa-over-the-moon-for-you) · [Uniform](https://www.crunchyroll.com/de/series/GRWMGGQ86/tonikawa-over-the-moon-for-you) · [Hauptserie](https://www.crunchyroll.com/de/series/GRWMGGQ86/tonikawa-over-the-moon-for-you) · [High School Days](https://www.crunchyroll.com/de/series/GRWMGGQ86/tonikawa-over-the-moon-for-you) |
| 78 | 2023-07-04 | Insomniacs after School | [Hauptserie](https://www.amazon.de/s?k=Insomniacs%20After%20School&i=instant-video) |
| 79 | 2023-06-28 | Oshi no Ko: Mein Star | [Hauptserie](https://www.disneyplus.com/de-de/browse/entity-9f96dac7-a7cf-4546-87a5-069cb101f174?season=782c38b7-ad71-48fc-87e4-e6b9ad7f13e4) |
| 80 | 2023-04-19 | Bofuri: I Don’t Want to Get Hurt, So I’ll Max Out My Defense. | [Hauptserie](https://www.crunchyroll.com/de/bofuri-i-dont-want-to-get-hurt-so-ill-max-out-my-defense) · [Staffel 2](https://www.crunchyroll.com/de/series/GKEH2G428/bofuri-i-dont-want-to-get-hurt-so-ill-max-out-my-defense) |
| 81 | 2023-04-14 | Detektiv Conan | [Das schwarze U-Boot](http://netflix.com/DetectiveConanMovies) |
| 82 | 2023-04-14 | Pokémon Horizonte | [Hauptserie](https://www.netflix.com/title/81696980) |
| 83 | 2023-04-05 | Kiznaiver | [Hauptserie](http://www.crunchyroll.com/de/kiznaiver) |
| 84 | 2023-03-23 | Onimai: Ab sofort Schwester! | [Hauptserie](https://www.crunchyroll.com/de/series/GZJH3D0P5/onimai-im-now-your-sister) |
| 85 | 2023-03-16 | Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth | [IV](https://beta.crunchyroll.com/de/series/G6DQN9KGR/is-it-wrong-to-try-to-pick-up-girls-in-a-dungeon) · [IV](https://www.crunchyroll.com/de/series/G6DQN9KGR/is-it-wrong-to-try-to-pick-up-girls-in-a-dungeon) |
| 86 | 2023-02-15 | The Eminence in Shadow | [Hauptserie](https://www.amazon.de/s?k=The%20Eminence%20in%20Shadow&i=instant-video) |
| 87 | 2023-01-04 | Dragon Ball | [Hauptserie](https://www.crunchyroll.com/de/dragon-ball) · [Z](https://www.crunchyroll.com/de/dragon-ball-z) · [Z: Die Todeszone des Garlic Jr.](https://www.crunchyroll.com/de/series/GMTE00002906/dragon-ball-z-the-dead-zone) · [Z: Der Stärkste auf Erden](https://www.crunchyroll.com/de/series/GMTE00002911/dragon-ball-z-the-worlds-strongest) · [Z: Die Entscheidungsschlacht](https://www.crunchyroll.com/de/series/GMTE00002912/dragon-ball-z-the-tree-of-might) · [Z: Rache für Freezer](https://www.crunchyroll.com/de/series/GMTE00002914/dragon-ball-z-coolers-revenge) · [Z: Coolers Rückkehr](https://www.crunchyroll.com/de/series/GMTE00002915/dragon-ball-z-return-of-cooler) · [Z: Angriff der Cyborgs](https://www.crunchyroll.com/de/series/GMTE00002916/dragon-ball-z-super-android-13) · [Z: Der Legendäre Super-Saiyajin](https://www.crunchyroll.com/de/series/GMTE00002917/dragon-ball-z-broly-the-legendary-super-saiyan) · [Z: Super-Saiyajin Son-Gohan](https://www.crunchyroll.com/de/series/GMTE00002918/dragon-ball-z-bojack-unbound) · [Z: Brolys Rückkehr](https://www.crunchyroll.com/de/series/GMTE00002907/dragon-ball-z-broly-second-coming) · [Z: Angriff der Bio-Kämpfer](https://www.crunchyroll.com/de/series/GMTE00002908/dragon-ball-z-bio-broly) · [Z: Die Fusion](https://www.crunchyroll.com/de/series/GMTE00002909/dragon-ball-z-fusion-reborn) · [Z: Drachenfaust](https://www.crunchyroll.com/de/series/GMTE00002910/dragon-ball-z-wrath-of-the-dragon) · [GT](https://www.crunchyroll.com/de/dragon-ball-gt) · [Z: Kampf der Götter](https://www.crunchyroll.com/de/watch/G8WU7P112/dragon-ball-z-battle-of-gods) · [Super](http://www.crunchyroll.com/de/dragon-ball-super) |
| 88 | 2023-01-04 | Dragon Ball | [Die Legende von Shenlong](https://www.amazon.de/s?k=Dragon%20Ball%3A%20Curse%20of%20the%20Blood%20Rubies&i=instant-video) · [Super](https://www.amazon.de/s?k=Dragon%20Ball%20Super&i=instant-video) |
| 89 | 2022-12-27 | Bleach | [Thousand-Year Blood War](https://www.amazon.de/s?k=BLEACH%3A%20Thousand-Year%20Blood%20War&i=instant-video) |
| 90 | 2022-12-23 | Pokémon | [Blauer Himmel in der Ferne!](https://www.netflix.com/watch/81670593) |
| 91 | 2022-12-22 | Mob Psycho 100 | [Hauptserie](https://www.amazon.de/s?k=Mob%20Psycho%20100&i=instant-video) · [II](https://www.amazon.de/s?k=Mob%20Psycho%20100%20II&i=instant-video) · [III](https://www.amazon.de/s?k=Mob%20Psycho%20100%20III&i=instant-video) |
| 92 | 2022-12-14 | Reincarnated as a Sword | [Hauptserie](https://www.amazon.de/s?k=Reincarnated%20as%20a%20Sword&i=instant-video) |
| 93 | 2022-10-13 | Exception | [Hauptserie](https://www.netflix.com/exception) |
| 94 | 2022-09-30 | Bright Sun: Dark Shadows | [Hauptserie](https://www.disneyplus.com/de-de/series/summer-time-rendering/3AHbeFV7Lqvn) |
| 95 | 2022-09-24 | Aoashi | [Hauptserie](https://www.disneyplus.com/de-de/series/aoashi/27OVvACG0ySD) |
| 96 | 2022-08-24 | Steins;Gate | [Hauptserie](https://www.crunchyroll.com/de/steinsgate) |
| 97 | 2022-06-29 | The Rising of the Shield Hero | [Staffel 2](https://www.disneyplus.com/de-de/series/the-rising-of-the-shield-hero-aka-tate-no-yuusha-no/4lgHH2jdAefe) |
| 98 | 2022-06-25 | Spy × Family | [Hauptserie](https://www.disneyplus.com/de-de/series/spyfamily/fet1h9jqmrAM) |
| 99 | 2022-06-11 | Dragon Ball | [Super: Super Hero](https://www.disneyplus.com/browse/entity-f07a1991-849f-4766-b33e-74d76ce849a7) |
| 100 | 2022-03-16 | Mushoku Tensei: Jobless Reincarnation | [Eris auf Goblinjagd](https://www.netflix.com/title/80987039) |
| 101 | 2022-02-18 | Fruits Basket | [Hauptserie](https://www.crunchyroll.com/de/fruits-basket) · [Staffel 2](https://www.crunchyroll.com/de/fruits-basket) · [Prelude](https://www.crunchyroll.com/de/fruits-basket) |
| 102 | 2022-01-19 | Miss Kobayashi’s Dragon Maid | [Miss Kobayashi's Dragon Maid: Valentinstag und Onsen (Erwartet nicht zu viel!)](http://www.crunchyroll.com/de/miss-kobayashis-dragon-maid/episode-14-valentines-and-hot-springs-please-dont-get-your-hopes-up-761513) · [S: Japanische Gastfreundschaft - Der Reiseführer ist ein Drache](https://www.crunchyroll.com/de/miss-kobayashis-dragon-maid/episode-13-japanese-hospitality-the-attendant-is-a-dragon-814608) |
| 103 | 2021-12-23 | Pokémon | [Mystery Dungeon: Team Flinke Freunde](https://www.youtube.com/watch?v=rAOmQ-foqeg) · [Mystery Dungeon: Erkundungsteams Zeit und Dunkelheit](https://www.youtube.com/watch?v=V0PlwsTLoM0) · [Mystery Dungeon: Portale in die Unendlichkeit](https://www.youtube.com/watch?v=zbwSAruo3QU) · [Der Film - Volcanion und das mechanische Wunderwerk](https://www.youtube.com/watch?v=9A22nfAK1V4) · [Entwicklungen](https://youtube.com/playlist?list=PLQWzKIaERirwN5po6LduiSLm8qc7GtuAl&si=I6QtXoF-i7cfG2c8) |
| 104 | 2021-10-21 | Kaguya-sama: Love Is War | [Ultra Romantic: Ishigami Yu möchte sich unterhalten](https://www.youtube.com/watch?v=cxTxrKrYkcY) |
| 105 | 2021-09-30 | My Next Life as a Villainess: Wie überlebe ich in einem Dating-Game? | [My Next Life as a Villainess: All Routes Lead to Doom! Ich habe die mir vorbestimmte Person getroffen](https://www.crunchyroll.com/de/my-next-life-as-a-villainess-all-routes-lead-to-doom/my-next-life-as-a-villainess-all-routes-lead-to-doom-x-i-met-my-destined-one-814444) |
| 106 | 2021-09-21 | Meine Wiedergeburt als Schleim in einer anderen Welt | [Hauptserie](http://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) · [Staffel 2](https://www.crunchyroll.com/de/that-time-i-got-reincarnated-as-a-slime) |
| 107 | 2021-08-06 | My Hero Academia | [World Heroes’ Mission](https://www.crunchyroll.com/watch/GG1U2NW9Q) |
| 108 | 2021-07-30 | Fate/Zero | [Fate/Stay Night: Unlimited Blade Works - Sunny Day](https://www.netflix.com/title/80040330) · [Fate/Grand Order: Final Singularity - The Grand Temple of Time: Solomon](https://www.netflix.com/watch/82850867) |
| 109 | 2021-07-30 | Fire Force | [Staffel 2 Miniepisoden](https://www.youtube.com/playlist?list=PLY_DM8ieCRPqNeMV1z2EJZDSgLWySL_Cx) |
| 110 | 2021-06-27 | Don’t Toy with Me, Miss Nagatoro | [Hauptserie](https://www.amazon.de/s?k=DON'T%20TOY%20WITH%20ME%2C%20MISS%20NAGATORO&i=instant-video) |
| 111 | 2021-06-25 | The Journey: Die Legende vom guten Dieb | [Hauptserie](https://www.crunchyroll.com/de/the-journey/) |
| 112 | 2021-06-11 | How Not to Summon a Demon Lord | [Ω](https://www.crunchyroll.com/de/how-not-to-summon-a-demon-lord) |
| 113 | 2021-04-16 | Detektiv Conan | [Die scharlachrote Kugel](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.9c92f9a9-a36f-4f4e-8ccd-e0d6b3649bee) |
| 114 | 2021-03-26 | The Promised Neverland | [Hauptserie](https://www.crunchyroll.com/de/the-promised-neverland) · [Staffel 2](https://www.crunchyroll.com/de/the-promised-neverland) |
| 115 | 2021-03-24 | Re:Zero - Starting Life in Another World | [Staffel 2](https://www.crunchyroll.com/de/rezero-starting-life-in-another-world-) · [Staffel 2](https://www.crunchyroll.com/de/rezero-starting-life-in-another-world-) |
| 116 | 2021-03-22 | Otherside Picnic | [Hauptserie](https://www.crunchyroll.com/de/otherside-picnic) |
| 117 | 2021-02-11 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Pretty Guardian Sailor Moon Eternal The Movie Teil 2](https://www.netflix.com/title/81214399) |
| 118 | 2020-12-27 | Talentless Nana | [Hauptserie](https://www.crunchyroll.com/de/talentless-nana) |
| 119 | 2020-12-24 | Akudama Drive | [Hauptserie](https://www.crunchyroll.com/de/akudama-drive) |
| 120 | 2020-12-17 | Sylvanian Families | [Mini-Episodes - Ivy](https://www.youtube.com/playlist?list=PLTYXZZKHiowqVVc80wtIBlUNCcRy2SKPV) · [Mini-Episoden - Klee](https://www.youtube.com/playlist?list=PLTYXZZKHiowqllFesHWXbJI3MVvxQU0Cz) · [Mini Episodes - Peony](https://www.youtube.com/playlist?list=PLduwKEaYhJ45z5Gf4Nj3jmsMvOFcpTikR) |
| 121 | 2020-12-11 | Marudase Kintaro | [Hauptserie](https://www.crunchyroll.com/de/marudase-kintaro) |
| 122 | 2020-12-11 | Yes, No, or Maybe? | [Hauptserie](https://www.crunchyroll.com/de/yes-no-or-maybe) |
| 123 | 2020-11-27 | Over the Sky | [Hauptserie](https://crunchyroll.com/de/series/G24H1N5JG/over-the-sky) |
| 124 | 2020-06-27 | Kaguya-sama: Love Is War | [Hauptserie](https://www.crunchyroll.com/de/kaguya-sama-love-is-war) · [?](https://www.crunchyroll.com/de/kaguya-sama-love-is-war) |
| 125 | 2020-06-17 | Dorohedoro | [Teuflische Anekdoten](https://www.netflix.com/title/80991903) |
| 126 | 2020-04-04 | My Hero Academia | [4](https://www.amazon.de/s?k=My%20Hero%20Academia%20Season%204&i=instant-video) |
| 127 | 2020-03-28 | Kabukicho Sherlock | [Hauptserie](https://www.crunchyroll.com/de/case-file-n221-kabukicho) |
| 128 | 2020-03-27 | One Punch Man | [Hauptserie](https://www.crunchyroll.com/series/G63K98PZ6/one-punch-man) · [OVAs](https://www.crunchyroll.com/watch/GPWU8KM42/the-shadow-that-snuck-up-too-close) · [Staffel 2 OVAs](https://www.crunchyroll.com/watch/G9DU9E4QG/saitama-and-the-mediocre-gang) |
| 129 | 2020-03-21 | Fate/Zero | [Hauptserie](http://www.crunchyroll.com/de/fatezero) · [Hauptserie](http://www.crunchyroll.com/de/fatezero) · [Fate/Stay Night: Unlimited Blade Works](https://www.crunchyroll.com/de/series/GY8V11X7Y/fatestay-night-unlimited-blade-works) · [Fate/Stay Night: Unlimited Blade Works 2](https://www.crunchyroll.com/de/series/GY8V11X7Y/fatestay-night-unlimited-blade-works) · [Fate/Grand Order: First Order](http://www.crunchyroll.com/de/fategrand-order-first-order) · [Fate/stay night [Heaven's Feel] I. presage flower](https://www.crunchyroll.com/de/series/GXJHM39V0/fatestay-night-heavens-feel) · [Fate/Grand Order Absolute Demonic Front: Babylonia - Initium Iter](https://www.crunchyroll.com/de/fategrand-order-absolute-demonic-front-babylonia) · [Fate/Grand Order Absolute Demonic Front: Babylonia](https://www.crunchyroll.com/de/fategrand-order-absolute-demonic-front-babylonia) |
| 130 | 2020-03-07 | Welcome to Demon School! Iruma-kun | [Hauptserie](https://www.disneyplus.com/browse/entity-b042544d-cd7d-40c6-9be4-db79666a1b51) |
| 131 | 2019-12-29 | Special 7: Special Crime Investigation Unit | [Hauptserie](https://www.crunchyroll.com/de/special-7-special-crime-investigation-unit) |
| 132 | 2019-12-29 | Special 7: Special Crime Investigation Unit | [Hauptserie](https://www.amazon.de/s?k=Special%207%3A%20Special%20Crime%20Investigation%20Unit&i=instant-video) |
| 133 | 2019-12-25 | How Heavy Are the Dumbbells You Lift? | [Gnadenlose Trainingsstunde](https://www.crunchyroll.com/series/GP5HJ80VJ/how-heavy-are-the-dumbbells-you-lift) |
| 134 | 2019-12-13 | Dr. Stone | [Hauptserie](https://www.amazon.de/s?k=Dr.%20STONE&i=instant-video) |
| 135 | 2019-12-13 | Seven Days War | [Hauptserie](https://www.crunchyroll.com/seven-days-war/seven-days-war-unbekannt-821929?ssid=423562) |
| 136 | 2019-12-12 | Legend of the Galactic Heroes: Die Neue These | [Hauptserie](https://crunchyroll.com/de/series/GRW4DXNEY) · [Hauptserie](https://crunchyroll.com/de/series/GRW4DXNEY) |
| 137 | 2019-12-06 | Lupin III.: Teil 1 | [Lupin III: Der Höllentrip](https://www.crunchyroll.com/lupin-the-3rd-tv-specials/lupin-iii-tv-special-mordbefehl-an-lupin-der-hllentrip-unbekannt-813888?ssid=407176) · [Lupin III: Der goldene Drache](https://www.crunchyroll.com/lupin-the-3rd-tv-specials/lupin-iii-tv-special-brenne-zantetsuken-der-goldene-drache-unbekannt-813890?ssid=407178) · [Lupin III.: Der Schatz des Harimao](https://www.crunchyroll.com/lupin-the-3rd-tv-specials/lupin-iii-tv-special-der-schatz-des-harimao-unbekannt-813894?ssid=407180) · [Lupin III: Der Diamant der Dämmerung](https://www.crunchyroll.com/lupin-the-3rd-tv-specials/lupin-iii-tv-special-das-geheimnis-des-twilight-gemini-der-diamant-der-dmmerung-unbekannt-813886?ssid=407187) · [Lupin III.: Daisuke Jigens Grabstein](https://www.crunchyroll.com/lupin-the-3rd-movies/daisuke-jigens-grabstein-unbekannt-822025?ssid=423942) · [Lupin III.: Goemon Ishikawa, der es Blut regnen lässt](https://www.crunchyroll.com/lupin-the-3rd-movies/goemon-ishikawa-der-es-blut-regnen-lsst-unbekannt-822028?ssid=423944) · [Lupin III.: Fujiko Mines Lüge](https://www.crunchyroll.com/lupin-the-3rd-movies/fujiko-mines-lge-unbekannt-822260?ssid=424587) · [Lupin III.: The First](https://www.crunchyroll.com/lupin-the-3rd-movies/lupin-iii-the-first-unbekannt-827115?ssid=429156) |
| 138 | 2019-11-22 | Fragtime | [Hauptserie](https://www.crunchyroll.com/fragtime/fragtime-unbekannt-813782?ssid=406732) |
| 139 | 2019-11-22 | Midnight Occult Civil Servants | [Hauptserie](https://www.crunchyroll.com/de/midnight-occult-civil-servants) · [OVA](https://www.crunchyroll.com/de/midnight-occult-civil-servants) |
| 140 | 2019-11-03 | Pokémon | [Die TV-Serie - Sonne & Mond](https://www.amazon.de/s?k=Pok%C3%A9mon%20the%20Series%3A%20Sun%20%26%20Moon&i=instant-video) |
| 141 | 2019-10-22 | Human Lost | [Hauptserie](https://www.crunchyroll.com/de/series/G24H1NJQ2/human-lost) |
| 142 | 2019-10-01 | Cop Craft | [Hauptserie](https://www.crunchyroll.com/de/cop-craft) |
| 143 | 2019-09-25 | Mob Psycho 100 | [Reigen: Der Unbekannte Typ mit Kräften](http://www.crunchyroll.com/de/mob-psycho-100) · [II OVA: Der erste superbillige Ausflug des PS-Büros](https://www.crunchyroll.com/de/mob-psycho-100) |
| 144 | 2019-09-23 | Hensuki: Are You Willing to Fall in Love with a Pervert, as Long as She’s a Cutie? | [Hauptserie](https://www.amazon.de/s?k=Hensuki%3A%20Are%20you%20willing%20to%20fall%20in%20love%20with%20a%20pervert%2C%20as%20long%20as%20she%E2%80%99s%20a%20cutie%3F&i=instant-video) |
| 145 | 2019-09-22 | The Ones Within | [Hauptserie](https://www.crunchyroll.com/de/the-ones-within) |
| 146 | 2019-09-22 | The Ones Within | [Hauptserie](https://www.amazon.de/s?k=The%20Ones%20Within&i=instant-video) |
| 147 | 2019-09-21 | Fruits Basket | [Hauptserie](https://www.amazon.de/s?k=Fruits%20Basket%20(2019)&i=instant-video) |
| 148 | 2019-09-19 | Demon Lord, Retry! | [Hauptserie](https://www.crunchyroll.com/series/GXJHM37KD/demon-lord-retry) |
| 149 | 2019-09-18 | Astra Lost in Space | [Hauptserie](https://www.crunchyroll.com/de/astra-lost-in-space) |
| 150 | 2019-09-18 | Astra Lost in Space | [Hauptserie](https://www.amazon.de/s?k=ASTRA%20LOST%20IN%20SPACE&i=instant-video) |
| 151 | 2019-09-07 | The Legend of Hei: Die Kraft in dir | [Hauptserie](https://www.crunchyroll.com/de/series/G4PH0WJ7Z/the-legend-of-hei) |
| 152 | 2019-07-28 | JoJo’s Bizarre Adventure | [Hauptserie](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Stardust Crusaders](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Stardust Crusaders - Battle in Egypt](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Diamond Is Unbreakable](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) · [Golden Wind](https://animationdigitalnetwork.com/de/video/444-jojo-s-bizarre-adventure) |
| 153 | 2019-07-28 | JoJo’s Bizarre Adventure | [Diamond Is Unbreakable](https://www.amazon.de/s?k=JoJo's%20Bizarre%20Adventure%3A%20Diamond%20is%20Unbreakable&i=instant-video) · [Golden Wind](https://www.amazon.de/s?k=JoJo's%20Bizarre%20Adventure%3A%20Golden%20Wind&i=instant-video) |
| 154 | 2019-06-29 | Cencoroll | [Connect](https://www.crunchyroll.com/cencoroll-connect/de-cencoroll-connect-unbekannt-850430) |
| 155 | 2019-06-21 | Ride Your Wave | [Hauptserie](https://www.crunchyroll.com/ride-your-wave/ride-your-wave-unbekannt-806160?ssid=392654) |
| 156 | 2019-06-07 | Children of the Sea | [Hauptserie](https://www.disneyplus.com/de-de/movies/children-of-the-sea/PPmmokvapG3T) |
| 157 | 2019-04-01 | Captain Tsubasa: Die tollen Fußballstars | [Captain Tsubasa](https://www.crunchyroll.com/series/GZJH3D7G9/captain-tsubasa) |
| 158 | 2019-03-29 | Boogiepop and Others | [Hauptserie](https://www.crunchyroll.com/de/boogiepop-and-others) |
| 159 | 2019-03-20 | Hi Score Girl | [Extra Stage](https://www.netflix.com/title/80997338) |
| 160 | 2019-03-01 | Star Blazers 2199: Space Battleship Yamato | [Hauptserie](https://www.crunchyroll.com/de/star-blazers-space-battleship-yamato) · [Star Blazers 2202: Space Battleship Yamato](https://www.crunchyroll.com/de/pt-br/series/G65V4P4K6/star-blazers-space-battleship-yamato) |
| 161 | 2019-02-08 | Saga of Tanya the Evil | [The Movie](https://www.crunchyroll.com/de/saga-of-tanya-the-evil) |
| 162 | 2018-12-30 | Goblin Slayer | [Hauptserie](https://www.amazon.de/s?k=GOBLIN%20SLAYER&i=instant-video) |
| 163 | 2018-12-29 | Die Welt in allen Farben: Iroduku | [Hauptserie](https://www.amazon.de/s?k=IRODUKU%3A%20The%20World%20in%20Colors&i=instant-video) |
| 164 | 2018-12-25 | Tokyo Ghoul | [√A](https://www.amazon.de/s?k=Tokyo%20Ghoul%20%E2%88%9AA&i=instant-video) · [re](https://www.amazon.de/s?k=Tokyo%20Ghoul%3Are&i=instant-video) · [re](https://www.amazon.de/s?k=Tokyo%20Ghoul%3Are%202&i=instant-video) |
| 165 | 2018-12-24 | Golden Kamuy | [2](https://www.amazon.de/s?k=Golden%20Kamuy%20Season%202&i=instant-video) |
| 166 | 2018-10-19 | Haikara-san: Here Comes Miss Modern – Teil 1 | [Hauptserie](https://www.amazon.de/s?k=Haikara-san%3A%20Here%20Comes%20Miss%20Modern%20%E2%80%93%20Part%201&i=instant-video) · [Haikara-san: Here Comes Miss Modern – Teil 2](https://www.amazon.de/s?k=Haikara-san%3A%20Here%20Comes%20Miss%20Modern%20%E2%80%93%20Part%202&i=instant-video) |
| 167 | 2018-09-29 | Yunas Geisterhaus | [Hauptserie](http://www.crunchyroll.com/de/yuuna-and-the-haunted-hot-springs) |
| 168 | 2018-09-21 | Angels of Death | [Hauptserie](http://www.crunchyroll.com/de/angels-of-death) |
| 169 | 2018-09-21 | Angels of Death | [Hauptserie](https://www.amazon.de/s?k=Angels%20of%20Death&i=instant-video) |
| 170 | 2018-09-21 | Angels of Death | [Hauptserie](https://www.joyn.de/serien/angels-of-death) |
| 171 | 2018-09-21 | Okko’s Inn | [Okko und ihre Geisterfreunde](https://www.crunchyroll.com/okkos-inn/okko-und-ihre-geisterfreunde-der-film-unbekannt-810007?ssid=397785) |
| 172 | 2018-07-20 | GREEN DA KA RA x Mirai no Mirai | [Mirai: Das Mädchen aus der Zukunft](https://www.crunchyroll.com/watch/GQJUGQWMW/) |
| 173 | 2018-07-04 | Calamity of a Zombie Girl | [Hauptserie](http://www.crunchyroll.com/de/calamity-of-a-zombie-girl) |
| 174 | 2018-07-03 | Highschool D×D | [Hero](http://www.crunchyroll.com/de/high-school-dxd) |
| 175 | 2018-06-21 | Comic Girls | [Hauptserie](http://www.crunchyroll.com/de/comic-girls) |
| 176 | 2018-06-10 | Cardcaptor Sakura | [Clear Card Arc](http://www.crunchyroll.com/de/cardcaptor-sakura-clear-card) |
| 177 | 2018-06-09 | Kase-san and Morning Glories | [Hauptserie](https://www.crunchyroll.com/kase-san-and-morning-glories/kase-san-and-morning-glories-unbekannt-813883) |
| 178 | 2018-05-05 | Digimon | [Fusion](http://www.crunchyroll.com/de/digimon-xros-wars-the-young-hunters-who-leapt-through-time) · [Xros Wars: The Evil Death Generals and the Seven Kingdoms](http://www.crunchyroll.com/de/digimon-xros-wars-the-young-hunters-who-leapt-through-time) · [Adventure tri. Chapter 1: Reunion](http://www.crunchyroll.com/de/digimon-adventure-tri/) · [Adventure tri. Chapter 2: Determination](https://www.crunchyroll.com/de/digimon-adventure-tri) · [Adventure tri. Chapter 3: Confession](https://www.crunchyroll.com/de/digimon-adventure-tri) · [Adventure tri. Chapter 4: Loss](https://www.crunchyroll.com/de/digimon-adventure-tri) · [Adventure tri. Chapter 5: Coexistance](https://www.crunchyroll.com/de/digimon-adventure-tri) · [Adventure tri. Chapter 6: Our Future](https://www.crunchyroll.com/de/digimon-adventure-tri) |
| 179 | 2018-04-05 | Cats: Ein schnurriges Abenteuer | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.2eb82736-4d63-bfcd-21db-a04b6a8928e3) |
| 180 | 2018-03-26 | Kokkoku: Moment für Moment | [Hauptserie](https://www.amazon.de/s?k=KOKKOKU&i=instant-video) |
| 181 | 2018-03-21 | ReLIFE | [Hauptserie](http://www.crunchyroll.com/de/relife) · [Final Arc](http://www.crunchyroll.com/de/relife) |
| 182 | 2017-12-24 | Two Car: Racing Sidecar | [Hauptserie](http://www.crunchyroll.com/de/twocar) |
| 183 | 2017-12-23 | Das Land der Juwelen | [Hauptserie](https://www.amazon.de/s?k=Land%20of%20the%20Lustrous&i=instant-video) |
| 184 | 2017-12-22 | Inuyashiki Last Hero | [Hauptserie](https://www.crunchyroll.com/de/series/G8DHV7E9Q/inuyashiki-last-hero) |
| 185 | 2017-12-22 | Inuyashiki Last Hero | [Hauptserie](https://www.amazon.de/s?k=INUYASHIKI%20LAST%20HERO&i=instant-video) |
| 186 | 2017-12-17 | Welcome to the Ballroom | [Hauptserie](https://www.amazon.de/s?k=Welcome%20to%20the%20Ballroom&i=instant-video) |
| 187 | 2017-11-25 | Armed Girl’s Machiavellism | [Herzklopfen! Betriebsausflug der „Fünf Schwerter“](https://www.crunchyroll.com/armed-girls-machiavellism/episode-13-799297?ssid=385722) |
| 188 | 2017-09-24 | Knight’s & Magic | [Hauptserie](http://www.crunchyroll.com/de/knights-magic) |
| 189 | 2017-09-24 | Touken Ranbu: Hanamaru | [Katsugeki: Touken Ranbu](http://www.crunchyroll.com/de/katsugeki-touken-ranbu) |
| 190 | 2017-09-24 | Touken Ranbu: Hanamaru | [Katsugeki: Touken Ranbu](https://www.amazon.de/s?k=Katsugeki%20TOUKEN%20RANBU&i=instant-video) |
| 191 | 2017-09-23 | Kakegurui: Das Leben ist ein Spiel | [Hauptserie](https://www.netflix.com/title/80175351) |
| 192 | 2017-09-20 | NTR: Netsuzou Trap | [Hauptserie](http://www.crunchyroll.com/de/netsuzou-trap-ntr-) |
| 193 | 2017-08-25 | Your Voice: Kimikoe | [Hauptserie](https://www.crunchyroll.com/your-voice-kimikoe-/de-your-voice-kimikoe-unbekannt-850378) |
| 194 | 2017-08-18 | Fireworks: Alles eine Frage der Zeit | [Hauptserie](https://www.amazon.de/s?k=Fireworks&i=instant-video) |
| 195 | 2017-08-18 | Fireworks: Alles eine Frage der Zeit | [Hauptserie](https://www.youtube.com/watch?v=RXD_V4p2iiA) |
| 196 | 2017-08-04 | Haikyu!! | [Sonderbeitrag: Die Jugend beim Frühlingsturnier](https://www.crunchyroll.com/de/haikyu-dubs/episode-3-special-feature-the-spring-tournament-of-their-youth-848359) |
| 197 | 2017-07-08 | Astro Boy | [Hauptserie](https://www.amazon.de/s?k=Astro%20Boy%20(1980)&i=instant-video) · [Atom: The Beginning](https://www.amazon.de/s?k=Atom%3A%20The%20Beginning&i=instant-video) |
| 198 | 2017-06-30 | Tsukigakirei | [Hauptserie](http://www.crunchyroll.com/de/tsukigakirei) |
| 199 | 2017-06-27 | Anonymous Noise | [Hauptserie](https://www.amazon.de/s?k=Anonymous%20Noise&i=instant-video) |
| 200 | 2017-06-26 | Grimoire of Zero | [Hauptserie](https://www.amazon.de/s?k=Grimoire%20of%20Zero&i=instant-video) |
| 201 | 2017-06-25 | Eromanga Sensei | [Hauptserie](http://www.crunchyroll.com/de/eromanga-sensei) |
| 202 | 2017-06-25 | Granblue Fantasy: The Animation | [Hauptserie](http://www.crunchyroll.com/de/granblue-fantasy-the-animation) |
| 203 | 2017-06-23 | Saekano: How to Raise a Boring Girlfriend | [.flat](https://www.amazon.de/s?k=Saekano%3A%20How%20to%20Raise%20a%20Boring%20Girlfriend%20%E2%99%AD&i=instant-video) |
| 204 | 2017-05-19 | Lu over the Wall | [Hauptserie](https://www.crunchyroll.com/lu-over-the-wall/lu-over-the-wall-unbekannt-811213?ssid=399959) |
| 205 | 2017-04-29 | Tales of Zestiria the X | [Hauptserie](https://www.crunchyroll.com/de/tales-of-zestiria-the-x) · [Staffel 2](https://www.crunchyroll.com/de/tales-of-zestiria-the-x) |
| 206 | 2017-04-07 | Night is Short, Walk on Girl | [Hauptserie](https://www.crunchyroll.com/night-is-short-walk-on-girl/night-is-short-walk-on-girl-unbekannt-811211?ssid=399939) |
| 207 | 2017-03-31 | Scum’s Wish | [Hauptserie](https://www.amazon.de/s?k=Scum's%20Wish&i=instant-video) |
| 208 | 2017-03-18 | Kuroko’s Basketball: | [Staffel 1](http://www.crunchyroll.com/de/kurokos-basketball) · [Tip Off](https://www.crunchyroll.com/de/kurokos-basketball/episode-225-tip-off-690095) · [Staffel 2](http://www.crunchyroll.com/de/kurokos-basketball) · [Staffel 3](http://www.crunchyroll.com/de/kurokos-basketball) · [Das Beste Geschenk](https://www.crunchyroll.com/de/kurokos-basketball/episode-755-the-greatest-present-728751) · [Winter Cup Highlights Episode 1 – Winter Cup Highlights -Shadow and Light-](https://www.crunchyroll.com/de/kurokos-basketball) · [Winter Cup Highlights Episode 2 – Winter Cup Highlights -Beyond the Tears-](https://www.crunchyroll.com/de/kurokos-basketball) · [Winter Cup Highlights Episode 3 – Winter Cup Highlights -Crossing the Door-](https://www.crunchyroll.com/de/kurokos-basketball) · [Kuroko’s Basketball The Movie: Last Game](https://www.crunchyroll.com/de/kurokos-basketball/kurokos-basketball-the-movie-last-game-kurokos-basketball-the-movie-last-game-778592) |
| 209 | 2017-02-25 | The Dragon Dentist | [Hauptserie](https://www.crunchyroll.com/the-dragon-dentist/deomu-the-dragon-dentist-unbekannt-811630?ssid=401190) |
| 210 | 2017-02-03 | Project Itoh: Genocidal Organ | [Hauptserie](https://www.crunchyroll.com/genocidal-organ/genocidal-organ-unbekannt-807915?ssid=394444) |
| 211 | 2016-09-29 | Danganronpa 3: The End of Hope’s Peak Academy - Future Arc | [Hauptserie](https://www.crunchyroll.com/de/danganronpa-3-the-end-of-hopes-peak-high-school) · [Danganronpa 3: The End of Hope’s Peak High School - Hope Arc - The School of Hope and the Students of Despair](https://www.crunchyroll.com/de/danganronpa-3-the-end-of-hopes-peak-high-school) |
| 212 | 2016-09-26 | Orange | [Hauptserie](http://www.crunchyroll.com/de/orange) |
| 213 | 2016-09-24 | Food Wars! Shokugeki no Soma | [Hauptserie](https://www.amazon.de/s?k=Food%20Wars!&i=instant-video) · [Food Wars! The Second Plate](https://www.amazon.de/s?k=Food%20Wars!%20The%20Second%20Plate&i=instant-video) |
| 214 | 2016-09-22 | Danganronpa | [Hauptserie](https://www.crunchyroll.com/de/danganronpa-the-animation) · [3: The End of Hope’s Peak Academy - Despair Arc](https://www.crunchyroll.com/de/danganronpa-3-the-end-of-hopes-peak-high-school) |
| 215 | 2016-09-20 | Servamp | [Hauptserie](https://www.crunchyroll.com/de/servamp) |
| 216 | 2016-09-20 | Servamp | [Hauptserie](https://www.amazon.de/s?k=SERVAMP&i=instant-video) |
| 217 | 2016-09-03 | Planetarian: Storyteller of the Stars | [Hauptserie](https://www.crunchyroll.com/de/planetarian) |
| 218 | 2016-08-26 | Your Name. Gestern, heute und für immer | [Hauptserie](https://www.amazon.de/s?k=Your%20Name.&i=instant-video) |
| 219 | 2016-08-26 | Your Name. Gestern, heute und für immer | [Hauptserie](https://www.youtube.com/watch?v=duoOTzpeWSE) |
| 220 | 2016-07-08 | Big Fish & Begonia: Zwei Welten - Ein Schicksal | [Hauptserie](https://www.crunchyroll.com/de/big-fish-begonia) |
| 221 | 2016-06-27 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Pretty Guardian Sailor Moon Crystal](http://www.crunchyroll.com/de/sailor-moon-crystal) · [Pretty Guardian Sailor Moon Crystal Season III](http://www.crunchyroll.com/de/sailor-moon-crystal) |
| 222 | 2016-06-18 | The Asterisk War | [Hauptserie](http://www.crunchyroll.com/de/the-asterisk-war) · [II](http://www.crunchyroll.com/de/the-asterisk-war) |
| 223 | 2016-06-17 | Concrete Revolutio | [Hauptserie](https://www.crunchyroll.com/de/concrete-revolutio) · [The Last Song](https://www.crunchyroll.com/de/concrete-revolutio) |
| 224 | 2016-03-29 | Aokana: Four Rhythm Across the Blue | [Hauptserie](http://www.crunchyroll.com/de/aokana) |
| 225 | 2016-03-29 | Die rothaarige Schneeprinzessin | [Hauptserie](https://www.crunchyroll.com/de/snow-white-with-the-red-hair) · [Staffel 2](https://www.crunchyroll.com/de/snow-white-with-the-red-hair) |
| 226 | 2016-03-27 | Dimension W | [Hauptserie](https://www.amazon.de/s?k=Dimension%20W&i=instant-video) |
| 227 | 2016-03-26 | God Eater | [Hauptserie](http://www.crunchyroll.com/de/god-eater) |
| 228 | 2016-03-25 | Divine Gate | [Hauptserie](https://www.crunchyroll.com/de/divine-gate) |
| 229 | 2016-03-25 | Erased: Die Stadt, in der es mich nicht gibt | [Hauptserie](http://www.crunchyroll.com/de/erased) |
| 230 | 2016-02-20 | Doukyusei: Verliebt in meinen Mitschüler | [Hauptserie](https://www.amazon.de/s?k=Doukyuusei%20-Classmates-&i=instant-video) |
| 231 | 2015-12-26 | Noragami | [Hauptserie](https://www.crunchyroll.com/de/series/G6WEV3WM6/noragami) · [Aragoto](https://www.crunchyroll.com/de/series/G6WEV3WM6/noragami) |
| 232 | 2015-12-26 | Noragami | [Aragoto](https://www.amazon.de/s?k=Noragami%20Aragoto&i=instant-video) |
| 233 | 2015-12-26 | Valkyrie Drive: Mermaid | [Hauptserie](https://www.crunchyroll.com/de/valkyrie-drive-mermaid-) |
| 234 | 2015-12-24 | Anti Magic Academy: Test-Trupp 35 | [Hauptserie](http://www.crunchyroll.com/de/anti-magic-academy-the-35th-test-platoon) |
| 235 | 2015-12-23 | Shomin Sample | [Hauptserie](https://www.crunchyroll.com/de/shomin-sample) |
| 236 | 2015-12-16 | Sound! Euphonium | [Hauptserie](http://www.crunchyroll.com/de/sound-euphonium) · [Auf die Plätze, fertig, Monaka](https://www.crunchyroll.com/de/sound-euphonium) |
| 237 | 2015-11-13 | Project Itoh: Harmony | [Hauptserie](https://www.crunchyroll.com/harmony/harmony-unbekannt-807914?ssid=394443) |
| 238 | 2015-10-02 | Project Itoh: The Empire of Corpses | [Hauptserie](https://www.crunchyroll.com/the-empire-of-corpses/the-empire-of-corpses-unknown-808170?ssid=395057) |
| 239 | 2015-09-27 | Charlotte | [Hauptserie](http://www.crunchyroll.com/de/charlotte) |
| 240 | 2015-09-24 | School-Live! | [Hauptserie](http://www.crunchyroll.com/de/school-live) |
| 241 | 2015-09-24 | Sky Wizards Academy | [Hauptserie](https://www.crunchyroll.com/de/series/GR4980206/sky-wizards-academy) |
| 242 | 2015-09-20 | Rokka: Braves of the Six Flowers | [Hauptserie](http://www.crunchyroll.com/de/rokka) |
| 243 | 2015-07-11 | Der Junge und das Biest | [Hauptserie](https://www.crunchyroll.com/de/the-boy-and-the-beast) |
| 244 | 2015-06-26 | Amagi Brilliant Park | [Keine Zeit zum Ausruhen!](https://www.crunchyroll.com/amagi-brilliant-park/episode-14-800072?ssid=387020) |
| 245 | 2015-06-20 | Ghost in the Shell: Stand Alone Complex | [Ghost in the Shell: Arise - Border:1 Ghost Pain](https://www.crunchyroll.com/de/ghost-in-the-shell-arise) · [Ghost in the Shell: Arise - Border:2 Ghost Whispers](https://www.crunchyroll.com/de/ghost-in-the-shell-arise) · [Ghost in the Shell: Arise - Border:3 Ghost Tears](https://www.crunchyroll.com/de/ghost-in-the-shell-arise) · [Ghost in the Shell: Arise - Border:4 Ghost Stands Alone](https://www.crunchyroll.com/de/ghost-in-the-shell-arise) · [Ghost in the Shell: Arise - Pyrophoric Cult](https://www.crunchyroll.com/de/ghost-in-the-shell-arise) · [Ghost in the Shell: The New Movie](https://www.crunchyroll.com/de/ghost-in-the-shell-arise) |
| 246 | 2015-06-11 | Triage X | [Hauptserie](http://www.crunchyroll.com/de/triage-x) |
| 247 | 2015-06-05 | Typhoon Noruda | [Hauptserie](https://www.crunchyroll.com/typhoon-noruda/typhoon-noruda-unbekannt-859032) |
| 248 | 2015-03-31 | Kamisama Kiss | [Hauptserie](https://crunchyroll.com/de/kamisama-hajimemashita) · [Staffel 2](https://www.crunchyroll.com/de/kamisama-hajimemashita) |
| 249 | 2015-03-31 | Kamisama Kiss | [Hauptserie](https://www.amazon.de/s?k=Kamisama%20Kiss&i=instant-video) · [Staffel 2](https://www.amazon.de/s?k=Kamisama%20Kiss%E2%97%8E&i=instant-video) |
| 250 | 2015-03-28 | Ronja Räubertochter | [Hauptserie](https://www.amazon.de/s?k=Ronja%2C%20the%20Robber's%20Daughter&i=instant-video) |
| 251 | 2015-03-28 | Tenkai Knights: Die Tenkai Ritter | [Hauptserie](https://www.amazon.de/s?k=Tenkai%20Knights&i=instant-video) |
| 252 | 2015-03-20 | Shigatsu wa Kimi no Uso: Sekunden in Moll | [Hauptserie](http://www.crunchyroll.com/de/your-lie-in-april) |
| 253 | 2014-12-29 | Rage of Bahamut: Genesis | [Hauptserie](https://www.amazon.de/s?k=Rage%20of%20Bahamut%3A%20Genesis&i=instant-video) |
| 254 | 2014-12-21 | Wolf Girl & Black Prince | [Hauptserie](http://www.crunchyroll.com/de/ookami) |
| 255 | 2014-12-19 | Psycho-Pass | [2](https://www.crunchyroll.com/de/psycho-pass) |
| 256 | 2014-12-12 | Akuma no Riddle | [Wer siegt? (Überraschungstest)](https://www.crunchyroll.com/watch/GK9U3Z4XE/) |
| 257 | 2014-12-11 | Chaika, die Sargprinzessin | [Hauptserie](https://www.crunchyroll.com/de/chaika-the-coffin-princess-) · [Avenging Battle](https://www.crunchyroll.com/de/chaika-the-coffin-princess-) |
| 258 | 2014-11-22 | Love Stage!! | [Daran war gar nichts leicht](https://www.crunchyroll.com/love-stage/episode-11-841216) |
| 259 | 2014-09-28 | The Irregular at Magic High School | [Hauptserie](https://www.crunchyroll.com/series/GRMGDGZVR/the-irregular-at-magic-high-school) |
| 260 | 2014-09-26 | Terror in Tokio | [Hauptserie](https://www.crunchyroll.com/de/terror-in-resonance) |
| 261 | 2014-09-24 | Hunter x Hunter | [Hunter × Hunter](http://www.crunchyroll.com/de/hunter-x-hunter) |
| 262 | 2014-09-16 | Love, Chunibyo & Other Delusions! | [Love, Chunibyo & Other Delusions: Heart Throb - Offenbarung des wahren Auges des bösen Königs … Wiederholung](https://www.crunchyroll.com/love-chunibyo-other-delusions-heart-throb-/episode-13-799361?ssid=387047) |
| 263 | 2014-06-20 | Kuroko’s Basketball: Kannst du das gleich nochmal machen? | [Hauptserie](https://www.crunchyroll.com/de/kurokos-basketball/episode-415-lets-do-that-again-690097) |
| 264 | 2014-06-20 | Selector Infected Wixoss | [Hauptserie](https://www.amazon.de/s?k=selector%20infected%20WIXOSS&i=instant-video) |
| 265 | 2014-04-03 | Nagi no Asukara | [Hauptserie](http://www.crunchyroll.com/de/nagi-no-asukara-nagi-asu-a-lull-in-the-sea) |
| 266 | 2014-03-30 | Magi: The Labyrinth of Magic | [Hauptserie](http://www.crunchyroll.com/de/magi) · [Magi: The Kingdom of Magic](http://www.crunchyroll.com/de/magi) |
| 267 | 2014-03-29 | Sekai Seifuku: World Conquest Zvezda Plot | [Hauptserie](http://www.crunchyroll.com/de/world-conquest-zvezda-plot ) |
| 268 | 2014-03-28 | Kill La Kill | [Hauptserie](https://www.crunchyroll.com/de/kill-la-kill) |
| 269 | 2014-03-28 | Kill La Kill | [Hauptserie](http://www.netflix.com/WiMovie/70305217) |
| 270 | 2014-03-27 | Space Dandy | [Hauptserie](https://www.amazon.de/s?k=Space%20Dandy&i=instant-video) |
| 271 | 2014-03-20 | Maken-Ki: Battling Venus | [Hauptserie](https://www.crunchyroll.com/de/maken-ki) · [Maken-Ki! Battling Venus: Staffel 2](https://www.crunchyroll.com/de/maken-ki) |
| 272 | 2013-12-28 | Yoyo & Nene: Die magischen Schwestern | [Hauptserie](https://www.crunchyroll.com/watch/G50UZV2GM/) |
| 273 | 2013-12-24 | Arpeggio of Blue Steel: Ars Nova | [Hauptserie](https://www.crunchyroll.com/de/arpeggio-of-blue-steel) |
| 274 | 2013-12-22 | Wanna Be the Strongest in the World! | [Hauptserie](http://www.crunchyroll.com/de/wanna-be-the-strongest-in-the-world) |
| 275 | 2013-12-20 | Freezing | [Hauptserie](https://www.crunchyroll.com/de/freezing) · [Vibration](https://www.crunchyroll.com/de/freezing) |
| 276 | 2013-11-09 | Patema Inverted | [Hauptserie](https://www.crunchyroll.com/watch/GK9U31019/) |
| 277 | 2013-09-29 | The Eccentric Family | [Hauptserie](http://www.crunchyroll.com/de/the-eccentric-family) |
| 278 | 2013-03-29 | Haganai: I Don’t Have Many Friends | [Hauptserie](https://www.crunchyroll.com/de/haganai) · [Next](https://www.crunchyroll.com/de/series/GYX0PN4MR/haganai) |
| 279 | 2013-03-26 | The Pet Girl of Sakurasou | [Hauptserie](http://www.crunchyroll.com/de/the-pet-girl-of-sakurasou) |
| 280 | 2013-03-26 | The Pet Girl of Sakurasou | [Hauptserie](https://www.amazon.de/s?k=The%20Pet%20Girl%20of%20Sakurasou&i=instant-video) |
| 281 | 2013-03-09 | Hanasaku Iroha | [Hauptserie](https://www.crunchyroll.com/de/hanasaku-iroha) · [the Movie: Home Sweet Home](https://www.crunchyroll.com/de/hanasaku-iroha) |
| 282 | 2012-12-26 | Hellsing | [Hauptserie](https://www.crunchyroll.com/de/hellsing) · [Ultimate OVA](https://www.crunchyroll.com/de/hellsing-ultimate) |
| 283 | 2012-12-26 | Jormungand | [Hauptserie](https://www.amazon.de/s?k=Jormungand&i=instant-video) · [Perfect Order](https://www.amazon.de/s?k=Jormungand%3A%20Perfect%20Order&i=instant-video) |
| 284 | 2012-12-20 | Btooom! | [Hauptserie](https://www.amazon.de/s?k=BTOOOM!&i=instant-video) |
| 285 | 2012-11-29 | Mass Effect: Paragon Lost | [Hauptserie](https://www.crunchyroll.com/de/mass-effect) |
| 286 | 2012-11-17 | Neon Genesis Evangelion | [Evangelion: 3.33 - You Can (Not) Redo.](https://www.amazon.de/s?k=Evangelion%3A%203.0%20You%20Can%20(Not)%20Redo&i=instant-video) |
| 287 | 2012-10-27 | Raumstation Cyborg 009 & Gefährlicher Countdown für Cyborg 009 | [009 Re:Cyborg](https://www.amazon.de/s?k=009%20Re%3ACyborg&i=instant-video) |
| 288 | 2012-10-24 | Tales of Symphonia: Sylvarant Arc | [Hauptserie](https://www.crunchyroll.com/de/tales-of-symphonia-the-animation) · [Tales of Symphonia: Tethe’alla Arc](https://www.crunchyroll.com/de/tales-of-symphonia-the-animation) · [Tales of Symphonia: The United World Arc](https://www.crunchyroll.com/de/tales-of-symphonia-the-animation) |
| 289 | 2012-09-30 | B-Daman Crossfire | [Hauptserie](https://www.youtube.com/playlist?list=PL4o1lot_6q1EHL3vw_t4BGuHK6uBHyETT) |
| 290 | 2012-09-29 | The Knight in the Area | [Hauptserie](http://www.crunchyroll.com/de/the-knight-in-the-area) |
| 291 | 2012-09-27 | Good Luck Girl! | [Hauptserie](https://www.crunchyroll.com/de/good-luck-girl) |
| 292 | 2012-09-25 | So, I Can’t Play H! | [Hauptserie](http://www.crunchyroll.com/de/so-i-cant-play-h) |
| 293 | 2012-09-24 | Yu-Gi-Oh! Zexal | [Hauptserie](https://www.crunchyroll.com/series/GRDQD8PDY/yu-gi-oh-zexal) |
| 294 | 2012-09-16 | Hyouka | [Hauptserie](https://www.crunchyroll.com/de/hyouka) |
| 295 | 2012-08-18 | Fairy Tail | [The Movie - Phoenix Priestess](https://www.crunchyroll.com/fairy-tail-movies/fairy-tail-the-movie-phoenix-princess-unbekannt-821316?ssid=422327) |
| 296 | 2012-07-21 | Starship Troopers: Invasion | [Hauptserie](https://www.amazon.de/gp/video/detail/amzn1.dv.gti.8ca9f6c3-21de-5225-749f-931196618766) |
| 297 | 2012-06-07 | Is This a Zombie? | [Hauptserie](https://www.crunchyroll.com/de/is-this-a-zombie) · [of the Dead](https://www.crunchyroll.com/de/is-this-a-zombie) |
| 298 | 2012-05-25 | Holy Knight | [Hauptserie](http://www.crunchyroll.com/de/holy-knight) |
| 299 | 2012-04-15 | Mirai Nikki | [Hauptserie](https://www.crunchyroll.com/de/the-future-diary) |
| 300 | 2012-03-27 | Another | [Hauptserie](http://www.crunchyroll.com/de/another) |
| 301 | 2012-03-24 | Shakugan no Shana | [Hauptserie](https://www.crunchyroll.com/de/shakugan-no-shana) · [Der Film](https://www.crunchyroll.com/de/shakugan-no-shana) · [Second](https://www.crunchyroll.com/de/shakugan-no-shana) · [S](https://www.crunchyroll.com/de/shakugan-no-shana) · [Season III](https://www.crunchyroll.com/de/shakugan-no-shana) |
| 302 | 2012-03-24 | Shakugan no Shana | [Season III](https://www.amazon.de/s?k=Shakugan%20no%20Shana%3A%20Season%20III&i=instant-video) |
| 303 | 2012-03-23 | Black Rock Shooter | [Hauptserie](https://www.crunchyroll.com/de/series/GMEHME53W/black-rock-shooter) |
| 304 | 2012-03-23 | Guilty Crown | [Hauptserie](https://www.crunchyroll.com/de/guilty-crown) |
| 305 | 2011-12-24 | Sekaiichi Hatsukoi: The World’s Greatest First Love | [Hauptserie](https://www.crunchyroll.com/de/sekai-ichi-hatsukoi-worlds-greatest-first-love) · [2](https://www.crunchyroll.com/de/sekai-ichi-hatsukoi-worlds-greatest-first-love) |
| 306 | 2011-12-03 | K-On! | [Extrafolge: Livemusik-Klub!](https://www.crunchyroll.com/k-on/episode-14-807608?ssid=394401) · [! Pläne!](https://www.crunchyroll.com/k-on/episode-27-809423?ssid=397229) · [The Movie](https://www.crunchyroll.com/k-on/k-on-the-movie-unbekannt-822264?ssid=424604) |
| 307 | 2011-10-24 | Appleseed: Kampf um die Freiheit | [Appleseed XIII: Tartaros](https://www.amazon.de/s?k=Appleseed%20XIII%3A%20Tartaros&i=instant-video) · [Appleseed XIII: Ouranos](https://www.amazon.de/s?k=Appleseed%20XIII%3A%20Ouranos&i=instant-video) |
| 308 | 2011-10-08 | Deadman Wonderland | [Hauptserie](https://www.crunchyroll.com/de/deadman-wonderland) · [Der Besitzer der roten Messer](https://www.crunchyroll.com/de/deadman-wonderland) |
| 309 | 2011-09-16 | Usagi Drop | [Hauptserie](http://www.crunchyroll.com/de/usagi-drop) |
| 310 | 2011-07-02 | Gosick | [Hauptserie](https://www.crunchyroll.com/de/gosick) |
| 311 | 2011-06-24 | AnoHana: Die Blume, die wir an jenem Tag sahen | [Hauptserie](http://www.crunchyroll.com/de/anohana-the-flower-we-saw-that-day) |
| 312 | 2011-06-24 | AnoHana: Die Blume, die wir an jenem Tag sahen | [Hauptserie](https://www.netflix.com/title/80075178) |
| 313 | 2011-04-29 | Onigamiden: Legend of the Millennium Dragon | [Hauptserie](https://www.youtube.com/watch?v=W8YuJXFKZ-k) |
| 314 | 2011-04-22 | Puella Magi Madoka Magica | [Hauptserie](http://www.crunchyroll.com/de/puella-magi-madoka-magica) |
| 315 | 2010-12-18 | Angeloid: Sora no Otoshimono | [Hauptserie](https://www.crunchyroll.com/de/heavens-lost-property) · [Forte](https://www.crunchyroll.com/de/heavens-lost-property) |
| 316 | 2010-09-29 | Rainbow: Die Sieben von Zelle Sechs | [Hauptserie](https://www.crunchyroll.com/de/series/G8DHV78Q4/rainbow) |
| 317 | 2010-07-04 | Fullmetal Alchemist | [Brotherhood](http://www.crunchyroll.com/de/fullmetal-alchemist-brotherhood) |
| 318 | 2010-06-26 | Angel Beats! | [Hauptserie](https://www.crunchyroll.com/de/angel-beats) |
| 319 | 2010-06-25 | Bakemonogatari | [Hauptserie](https://www.crunchyroll.com/de/bakemonogatari) |
| 320 | 2010-06-25 | Durarara!! | [Hauptserie](https://www.crunchyroll.com/series/G619XVNEY/durarara) |
| 321 | 2010-04-02 | Trigun | [Hauptserie](https://www.crunchyroll.com/de/trigun) · [The Movie - Badlands Rumble](https://www.crunchyroll.com/de/trigun) |
| 322 | 2010-04-01 | Dance in the Vampire Bund | [Hauptserie](https://www.crunchyroll.com/de/dance-in-the-vampire-bund) |
| 323 | 2010-03-28 | Beyblade | [Metal Fusion](http://www.crunchyroll.com/de/beyblade-metal-fusion) |
| 324 | 2010-03-25 | Gintama | [Hauptserie](https://www.crunchyroll.com/series/GYQ4MKDZ6/gintama) |
| 325 | 2010-03-13 | Eden of the East | [Hauptserie](https://www.crunchyroll.com/de/eden-of-the-east) · [Der König von Eden](https://www.crunchyroll.com/de/eden-of-the-east) · [Das verlorene Paradies](https://www.crunchyroll.com/de/eden-of-the-east) |
| 326 | 2010-02-16 | Halo Legends | [Hauptserie](https://www.amazon.de/s?k=Halo%20Legends&i=instant-video) |
| 327 | 2009-09-24 | Spice and Wolf | [Hauptserie](https://www.crunchyroll.com/de/spice-and-wolf) · [OVA](https://www.crunchyroll.com/de/spice-and-wolf) · [II](https://www.crunchyroll.com/de/spice-and-wolf) |
| 328 | 2009-03-30 | Soul Eater | [Hauptserie](https://www.crunchyroll.com/de/soul-eater) |
| 329 | 2009-03-27 | Black Butler | [Hauptserie](http://movies.netflix.com/WiMovie/Black_Butler/70204955) |
| 330 | 2009-03-26 | Toradora! | [Hauptserie](http://www.crunchyroll.com/de/toradora) |
| 331 | 2009-03-26 | Toradora! | [Hauptserie](https://www.amazon.de/s?k=Toradora!&i=instant-video) |
| 332 | 2008-12-25 | Corpse Princess: Shikabane Hime Aka | [Hauptserie](https://www.crunchyroll.com/de/corpse-princess-shikabane-hime) |
| 333 | 2008-09-30 | D.Gray-man | [Hauptserie](https://www.crunchyroll.com/de/dgray-man) |
| 334 | 2008-08-22 | Death Note | [Relight](https://www.netflix.com/title/70204970) |
| 335 | 2008-07-07 | Rin: Daughters of Mnemosyne | [Hauptserie](https://www.crunchyroll.com/de/rin-daughters-of-mnemosyne) |
| 336 | 2007-09-30 | Gurren Lagann | [Hauptserie](http://www.crunchyroll.com/de/gurren-lagann) |
| 337 | 2007-09-29 | Sword of the Stranger | [Hauptserie](https://www.crunchyroll.com/de/sword-of-the-stranger) |
| 338 | 2007-09-26 | Romeo × Juliet | [Hauptserie](https://www.crunchyroll.com/de/romeo-x-juliet) |
| 339 | 2007-09-25 | El Cazador de la Bruja | [Hauptserie](https://www.crunchyroll.com/de/el-cazador-de-la-bruja) |
| 340 | 2007-09-17 | Lucky Star | [Hauptserie](https://www.crunchyroll.com/de/series/GY8V7NP8Y/lucky-star) |
| 341 | 2007-09-12 | Zombie-Loan | [Hauptserie](http://www.crunchyroll.com/de/zombie-loan) |
| 342 | 2007-09-12 | Zombie-Loan | [Hauptserie](https://www.amazon.de/s?k=Zombie%20Loan&i=instant-video) |
| 343 | 2007-09-06 | Devil May Cry | [Hauptserie](https://www.crunchyroll.com/de/devil-may-cry) |
| 344 | 2007-08-29 | Murder Princess | [Hauptserie](https://www.crunchyroll.com/de/murder-princess) |
| 345 | 2007-06-27 | Death Note | [Hauptserie](https://www.amazon.de/s?k=Death%20Note&i=instant-video) |
| 346 | 2007-03-18 | Pumpkin Scissors | [Hauptserie](https://www.crunchyroll.com/de/pumpkin-scissors) |
| 347 | 2007-03-15 | Kanon | [Hauptserie](https://www.crunchyroll.com/de/kanon) |
| 348 | 2006-12-18 | Welcome to the N.H.K. | [Hauptserie](https://www.crunchyroll.com/de/welcome-to-the-n-h-k) |
| 349 | 2006-12-03 | Project Blue Earth SOS | [Hauptserie](https://www.crunchyroll.com/de/project-blue-earth-sos) |
| 350 | 2006-11-24 | Black Blood Brothers | [Hauptserie](https://www.crunchyroll.com/de/black-blood-brothers) |
| 351 | 2006-09-27 | Ouran High School Host Club | [Hauptserie](https://crunchyroll.com/de/series/GRGGJWD2R/ouran-high-school-host-club) |
| 352 | 2006-09-21 | Witchblade | [Hauptserie](https://www.crunchyroll.com/de/witchblade) |
| 353 | 2006-09-19 | Coyote Ragtime Show | [Hauptserie](https://www.crunchyroll.com/de/coyote-ragtime-show) |
| 354 | 2006-08-12 | Ergo Proxy | [Hauptserie](https://www.crunchyroll.com/de/ergo-proxy) |
| 355 | 2006-07-08 | Brave Story: Ein Abenteuer jenseits der Realität | [Hauptserie](https://www.crunchyroll.com/brave-story/brave-story-unbekannt-821310?ssid=422329) |
| 356 | 2006-07-03 | Die Melancholie der Haruhi Suzumiya | [Hauptserie](https://www.crunchyroll.com/de/the-melancholy-of-haruhi-suzumiya) |
| 357 | 2006-06-23 | Planet of the Beast King - Jyu-Oh-Sei | [Hauptserie](https://www.crunchyroll.com/de/jyu-oh-sei) |
| 358 | 2006-04-08 | Yonna in the Solitary Fortress | [Hauptserie](http://www.crunchyroll.com/de/yonna-in-the-solitary-fortress) |
| 359 | 2006-03-30 | Solty Rei | [Hauptserie](https://www.crunchyroll.com/de/solty-rei) |
| 360 | 2006-01-07 | Origin: Spirits of the Past | [Hauptserie](https://www.crunchyroll.com/de/origin-spirits-of-the-past) |
| 361 | 2005-10-28 | Trinity Blood | [Hauptserie](https://www.crunchyroll.com/de/trinity-blood) |
| 362 | 2005-09-30 | Speed Grapher | [Hauptserie](https://www.crunchyroll.com/de/speed-grapher) |
| 363 | 2005-09-21 | Basilisk: Chronik der Koga-Ninja | [Hauptserie](https://www.crunchyroll.com/de/basilisk) |
| 364 | 2005-09-14 | Final Fantasy VII: Advent Children | [Hauptserie](https://www.youtube.com/watch?v=IFKqfiIE66Q) |
| 365 | 2005-06-19 | Emma: Eine viktorianische Liebe | [Hauptserie](https://www.crunchyroll.com/de/emma-a-victorian-romance) |
| 366 | 2005-03-31 | My-HiME | [Hauptserie](https://www.crunchyroll.com/de/series/G60X904VR/my-hime) |
| 367 | 2005-03-30 | Der Graf von Monte Christo: Gankutsuou | [Hauptserie](http://www.crunchyroll.com/de/gankutsuou) |
| 368 | 2005-03-19 | Samurai Champloo | [Hauptserie](https://crunchyroll.com/de/series/G6WEK0026/samurai-champloo) |
| 369 | 2005-03-19 | Samurai Champloo | [Hauptserie](http://movies.netflix.com/WiMovie/Samurai_Champloo/70213065) |
| 370 | 2005-03-19 | Samurai Champloo | [Hauptserie](https://www.amazon.de/s?k=Samurai%20Champloo&i=instant-video) |
| 371 | 2005-03-16 | Tenjo Tenge | [Hauptserie](https://www.amazon.de/s?k=Tenjho%20Tenge&i=instant-video) · [OVA](https://www.amazon.de/s?k=Tenjho%20Tenge%3A%20The%20Ultimate%20Fight&i=instant-video) |
| 372 | 2004-12-25 | Samurai 7 | [Hauptserie](https://www.crunchyroll.com/de/samurai-7) |
| 373 | 2004-09-29 | Ragnarök: The Animation | [Hauptserie](https://www.crunchyroll.com/de/ragnarok-the-animation) |
| 374 | 2004-09-14 | Burst Angel | [Hauptserie](https://www.crunchyroll.com/de/burst-angel) |
| 375 | 2004-09-13 | InuYasha | [Hauptserie](https://www.amazon.de/s?k=InuYasha&i=instant-video) |
| 376 | 2004-06-27 | Hinotori: The Phoenix | [Hauptserie](https://www.crunchyroll.com/de/phoenix) |
| 377 | 2004-06-10 | Chrono Crusade | [Hauptserie](https://www.crunchyroll.com/de/chrono-crusade) |
| 378 | 2004-05-18 | Paranoia Agent | [Hauptserie](https://www.crunchyroll.com/de/paranoia-agent) |
| 379 | 2003-12-29 | Beyblade | [Hauptserie](https://www.amazon.de/s?k=Beyblade&i=instant-video) · [V Force](https://www.amazon.de/s?k=Beyblade%20V-Force&i=instant-video) · [G Revolution](https://www.amazon.de/s?k=Beyblade%20G%20Revolution&i=instant-video) |
| 380 | 2003-11-08 | Tokyo Godfathers | [Hauptserie](https://www.youtube.com/watch?v=jderzQDdDHc) |
| 381 | 2003-10-18 | Full Metal Panic! | [Hauptserie](http://www.crunchyroll.com/de/full-metal-panic) · [Full Metal Panic? Fumoffu](https://www.crunchyroll.com/de/full-metal-panic-fumoffu) |
| 382 | 2003-10-07 | Scrapped Princess | [Hauptserie](https://www.crunchyroll.com/de/scrapped-princess) |
| 383 | 2003-09-29 | Last Exile | [Hauptserie](https://www.crunchyroll.com/de/last-exile) |
| 384 | 2003-09-26 | Heat Guy J | [Hauptserie](https://www.crunchyroll.com/de/heat-guy-j) · [Angel](https://www.crunchyroll.com/de/heat-guy-j) |
| 385 | 2003-07-24 | Parasite Dolls | [Hauptserie](http://www.crunchyroll.com/de/parasite-dolls) |
| 386 | 2003-07-15 | Ninja Scroll: Die Serie | [Hauptserie](https://www.crunchyroll.com/de/series/GMEHMENP7/ninja-scroll-the-series) |
| 387 | 2002-12-24 | Witch Hunter Robin | [Hauptserie](https://www.crunchyroll.com/de/witch-hunter-robin) |
| 388 | 2002-09-14 | Millennium Actress | [Hauptserie](https://www.amazon.de/s?k=Millennium%20Actress&i=instant-video) |
| 389 | 2002-06-18 | Full Metal Panic! | [Hauptserie](https://www.amazon.de/s?k=Full%20Metal%20Panic!&i=instant-video) |
| 390 | 2002-03-27 | Love Hina | [Again](https://www.crunchyroll.com/de/series/GQWH0M4NN/love-hina-again) |
| 391 | 2002-03-27 | X: TV-Serie | [Hauptserie](https://www.crunchyroll.com/de/x) |
| 392 | 2001-01-10 | Gravitation | [OVA](https://www.crunchyroll.com/de/series/G9VHN9DXX/) · [Hauptserie](https://www.crunchyroll.com/de/series/G9VHN9DXX/gravitation) |
| 393 | 2000-10-24 | Sin: The Movie | [Hauptserie](http://www.crunchyroll.com/de/sin-the-movie) |
| 394 | 2000-06-03 | Jin-Roh: Die Wolfsbrigade | [Hauptserie](https://www.crunchyroll.com/de/watch/G3WF2491E/jin-roh) |
| 395 | 2000-03-27 | The Candidate for Goddess | [Hauptserie](https://www.crunchyroll.com/de/pilot-candidate) |
| 396 | 2000-03-27 | The Candidate for Goddess | [Hauptserie](https://www.amazon.de/s?k=Pilot%20Candidate&i=instant-video) |
| 397 | 2000-03-25 | Blue Submarine No. 6 | [Hauptserie](http://www.crunchyroll.com/de/blue-submarine-no-6) |
| 398 | 1999-04-24 | Cowboy Bebop | [Hauptserie](http://www.crunchyroll.com/de/cowboy-bebop) |
| 399 | 1999-04-24 | Cowboy Bebop | [Hauptserie](https://www.amazon.de/s?k=Cowboy%20Bebop&i=instant-video) |
| 400 | 1999-04-23 | City Hunter: Ein Fall für Ryo Saeba | [Hauptserie](https://www.crunchyroll.com/de/city-hunter) · [2](https://www.crunchyroll.com/de/city-hunter) · [City Hunter: Magnum with Love and Fate](https://www.crunchyroll.com/de/city-hunter) · [City Hunter 3](https://www.crunchyroll.com/de/city-hunter) · [City Hunter: Bay City Wars](https://www.crunchyroll.com/de/city-hunter) · [City Hunter: Million Dollar Conspiracy](https://www.crunchyroll.com/de/city-hunter) · [City Hunter '91](https://www.crunchyroll.com/de/city-hunter) · [City Hunter: Goodbye My Sweetheart](https://www.crunchyroll.com/de/city-hunter) · [City Hunter: Ryo Saeba, Live on the Scene](https://www.crunchyroll.com/de/city-hunter) |
| 401 | 1998-06-25 | Maho Tsukai Tai! Magic User’s Club | [Hauptserie](https://www.crunchyroll.com/de/magic-users-club-ova) · [Shamanic Princess](http://www.crunchyroll.com/de/shamanic-princess) |
| 402 | 1998-03-31 | Berserk | [Hauptserie](https://www.netflix.com/search?q=berserk&jbv=80243876) |
| 403 | 1997-08-01 | Kimba, der weiße Löwe | [Jungle Emperor Leo: Der Kinofilm](https://www.crunchyroll.com/de/jungle-emperor-leo) |
| 404 | 1997-04-23 | Sorcerer Hunters | [Hauptserie](https://www.crunchyroll.com/de/sorcerer-hunters) · [Heiße Früchtchen zum Vernaschen](https://www.crunchyroll.com/de/sorcerer-hunters) |
| 405 | 1996-11-30 | Black Jack | [The Movie](https://www.amazon.de/s?k=Black%20Jack%3A%20The%20Movie&i=instant-video) |
| 406 | 1996-06-28 | Golden Boy | [Hauptserie](http://www.crunchyroll.com/de/golden-boy) |
| 407 | 1995-12-23 | Sailor Moon: Das Mädchen mit den Zauberkräften | [Sailor Moon R Movie: Gefährliche Blumen](https://www.amazon.de/s?k=Sailor%20Moon%20R%3A%20The%20Movie&i=instant-video) · [Sailor Moon S: Schneeprinzessin Kaguya](https://www.amazon.de/s?k=Sailor%20Moon%20S%20Movie%3A%20Hearts%20in%20Ice&i=instant-video) · [Sailor Moon Super S: Reise ins Land der Träume](https://www.amazon.de/s?k=Sailor%20Moon%20SuperS%20the%20Movie%3A%20Black%20Dream%20Hole&i=instant-video) |
| 408 | 1995-01-07 | Yū Yū Hakusho | [Hauptserie](https://www.crunchyroll.com/de/yu-yu-hakusho) |
| 409 | 1994-08-06 | Street Fighter II: The Animated Movie | [Hauptserie](https://www.crunchyroll.com/de/street-fighter-ii-the-animated-movie) |
| 410 | 1994-08-06 | Street Fighter II: The Animated Movie | [Hauptserie](https://www.amazon.de/s?k=Street%20Fighter%20II%3A%20The%20Animated%20Movie&i=instant-video) |
| 411 | 1993-05-28 | Dragon Half | [Hauptserie](https://www.amazon.de/s?k=Dragon%20Half&i=instant-video) |
| 412 | 1991-11-23 | Record of Lodoss War: Chronicles of the Heroic Knight | [Record of Lodoss War](https://www.crunchyroll.com/de/record-of-lodoss-war) |
| 413 | 1991-10-04 | Cyber City Oedo 808 | [Hauptserie](https://www.crunchyroll.com/de/series/G8DHV7874/cyber-city-oedo-808) |
| 414 | 1991-10-03 | Die Mumins | [Hauptserie](https://www.youtube.com/playlist?list=PLL0kUUHCSZA6VQjBcZ8TJ-tshEMyPsSt6) |
| 415 | 1991-02-12 | Samurai Pizza Cats | [Hauptserie](http://www.crunchyroll.com/de/samurai-pizza-cats) |
| 416 | 1990-12-22 | The Wind of Amnesia: Wind des Vergessens | [Hauptserie](https://www.crunchyroll.com/de/a-wind-named-amnesia) |
| 417 | 1989-07-15 | Little Nemo: Abenteuer im Schlummerland | [Hauptserie](https://www.amazon.de/s?k=Little%20Nemo%3A%20Adventures%20in%20Slumberland&i=instant-video) |
| 418 | 1988-07-16 | Akira | [Hauptserie](https://www.crunchyroll.com/de/akira) |
| 419 | 1987-09-25 | Manie Manie | [Hauptserie](https://www.crunchyroll.com/de/series/GQWH0M1K3/manie-manie-neo-tokyo) |
| 420 | 1987-07-18 | Knights of the Zodiac: Saint Seiya Teil 2 | [Saint Seiya: Die Krieger des Zodiac - Movie 1: Die Legende des goldenen Apfels](https://www.amazon.de/s?k=Saint%20Seiya%3A%20Evil%20Goddess%20Eris&i=instant-video) |
| 421 | 1985-07-13 | Night on the Galactic Railroad | [Hauptserie](https://www.crunchyroll.com/de/night-on-the-galactic-railroad) |
| 422 | 1985-05-21 | Die Abenteuer des Sherlock Holmes | [Hauptserie](http://www.crunchyroll.com/de/sherlock-hound) |
| 423 | 1982-02-24 | Voltron: Verteidiger des Universums | [Hauptserie](http://www.crunchyroll.com/de/go-lion) |
| 424 | 1981-12-27 | Familie Robinson | [Hauptserie](https://www.amazon.de/s?k=Swiss%20Family%20Robinson&i=instant-video) |
| 425 | 1981-03-14 | Unico: Das phantastische Abenteuer eines Hörnchens | [Hauptserie](https://www.crunchyroll.com/de/watch/GZ4FVQE90/fantastic-adventures-of-unico) |
| 426 | 1981-03-14 | Unico: Das phantastische Abenteuer eines Hörnchens | [Hauptserie](https://www.amazon.de/s?k=Fantastic%20Adventures%20of%20Unico&i=instant-video) |
| 427 | 1980-12-28 | Tom Sawyers Abenteuer | [Hauptserie](https://www.amazon.de/s?k=The%20Adventures%20of%20Tom%20Sawyer&i=instant-video) |
| 428 | 1980-09-03 | Lady Oscar: Die Rose von Versailles | [Hauptserie](https://www.amazon.de/s?k=Lady%20Oscar%3A%20The%20Rose%20of%20Versailles&i=instant-video) |
| 429 | 1968-04-07 | Choppy und die Prinzessin | [Hauptserie](http://www.crunchyroll.com/de/princess-knight) |
| 430 | 1968-04-07 | Choppy und die Prinzessin | [Hauptserie](https://www.youtube.com/watch?v=A0DaeCtJTG0) |
| 431 | 1968-03-31 | Speed Racer | [Hauptserie](https://www.youtube.com/playlist?list=PLnY1FL_e1HO5NAcu_AaLWeYkpUc5KqVI3) |
| 432 | 1960-08-14 | Alakazam: König der Tiere | [Hauptserie](https://www.amazon.de/s?k=Alakazam%20the%20Great&i=instant-video) |

## Warum die einzelnen Anbieter unsicher sind

- **ADN:** Der Titel steht nicht im ADN-Bestand mit Sprachcode vde. Möglich, dass er inzwischen dazugekommen ist.
- **Crunchyroll:** Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.
- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Joyn:** Joyn nennt die Sprachfassung nirgends öffentlich.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
- **YouTube:** YouTube nennt in den Metadaten keine Tonspur. Ob der Kanal die deutsche Fassung hochgeladen hat, sieht man erst im Video.
