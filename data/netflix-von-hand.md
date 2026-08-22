# Netflix: was kein Automat beantworten kann

Stand 2026-08-22 · **75 Titel**.

Diese Titel kennt die Streaming Availability API nicht — ein zweiter Abruf bringt nichts.
Netflix selbst darf nicht abgerufen werden (`robots.txt`). Bleibt der Blick von Hand.

**Ablauf mit der Erweiterung aus `extension/`:** Titelseite öffnen, dort auf **Abspielen**
klicken, dann den Knopf unten rechts drücken und zurück. Er sagt schon vorher, was er melden
würde: grün heißt deutsche Tonspur gefunden, gelb heißt keine.

**Der Umweg über die Titelseite ist nötig:** Ein Klick direkt auf die Abspieladresse leitet
Netflix auf die erste **Folge** um, und deren Kennung kennt unser Datensatz nicht — neun von
zwölf Meldungen aus Batch 1 waren deshalb nicht zuzuordnen (22.08.2026). Von der Titelseite
aus merkt sich die Erweiterung die Reihe; ohne sie meldet der Knopf gar nicht erst.

Erzeugt von `npm run data:netflix-rest`, nicht von Hand pflegen.

| # | Titel | Folgen | Jahr | Verweis |
|---|---|---:|---:|---|
| 1 | Sword Art Online: Alicization | 24 | 2018 | [öffnen](https://www.netflix.com/title/70302573) |
| 2 | K | 13 | 2012 | [öffnen](http://www.netflix.com/title/80040118) |
| 3 | Haganai NEXT | 12 | 2013 | [öffnen](https://www.netflix.com/title/80132156) |
| 4 | Attack on Titan Season 2 | 12 | 2017 | [öffnen](https://www.netflix.com/title/70299043) |
| 5 | Blue Exorcist: Kyoto Saga | 12 | 2017 | [öffnen](https://www.netflix.com/title/70304252) |
| 6 | ID-0 | 12 | 2017 | [öffnen](https://www.netflix.com/title/80174918) |
| 7 | One-Punch Man Season 2 | 12 | 2019 | [öffnen](https://www.netflix.com/title/80117291) |
| 8 | Blood Blockade Battlefront & Beyond | 12 | 2017 | [öffnen](https://www.netflix.com/title/80205560) |
| 9 | Attack on Titan Season 3 | 12 | 2018 | [öffnen](https://www.netflix.com/title/70299043) |
| 10 | Tokyo Ghoul:re | 12 | 2018 | [öffnen](https://www.netflix.com/title/80023687) |
| 11 | SWORDGAI The Animation Part II | 12 | 2018 | [öffnen](https://www.netflix.com/title/80175350) |
| 12 | Tokyo Ghoul:re 2 | 12 | 2018 | [öffnen](https://www.netflix.com/title/80023687) |
| 13 | Forest of Piano Season 2 | 12 | 2019 | [öffnen](https://www.netflix.com/title/80986797) |
| 14 | Teasing Master Takagi-san Season 2 | 12 | 2019 | [öffnen](https://www.netflix.com/title/80228274) |
| 15 | Sword Art Online: Alicization - War of Underworld | 12 | 2019 | [öffnen](https://www.netflix.com/title/70302573) |
| 16 | 7SEEDS Part 2 | 12 | 2020 | [öffnen](https://www.netflix.com/title/80183051) |
| 17 | BEASTARS Season 2 | 12 | 2021 | [öffnen](https://www.netflix.com/title/81054847) |
| 18 | Ghost in the Shell: SAC_2045 Season 2 | 12 | 2022 | [öffnen](https://www.netflix.com/title/81030224) |
| 19 | 86 EIGHTY-SIX Part 2 | 12 | 2021 | [öffnen](https://www.netflix.com/title/81442047) |
| 20 | ULTRAMAN: The Final Season | 12 | 2023 | [öffnen](https://www.netflix.com/title/80231373) |
| 21 | One-Punch Man Season 3 | 12 | 2025 | [öffnen](https://netflix.com/title/80117291) |
| 22 | My Dress-Up Darling Season 2 | 12 | 2025 | [öffnen](https://www.netflix.com/title/81569754) |
| 23 | DAN DA DAN (Staffel 2) | 12 | 2025 | [öffnen](https://www.netflix.com/title/81736884) |
| 24 | Ranma1/2 (2024) Season 2 | 12 | 2025 | [öffnen](https://www.netflix.com/title/81301833) |
| 25 | Anohana: The Flower We Saw That Day | 11 | 2011 | [öffnen](https://www.netflix.com/browse?jbv=80075178&jbp=0&jbr=11) |
| 26 | PSYCHO-PASS 2 | 11 | 2014 | [öffnen](https://www.netflix.com/title/80006146) |
| 27 | Darwin's Game | 11 | 2020 | [öffnen](https://www.netflix.com/title/81234353) |
| 28 | KONOSUBA -God's blessing on this wonderful world! 3 | 11 | 2024 | [öffnen](https://www.netflix.com/title/80131674) |
| 29 | Pokémon: To Be a Pokémon Master: Ultimate Journeys: The Series | 11 | 2023 | [öffnen](https://www.netflix.com/title/81706101) |
| 30 | SHIBOYUGI: Playing Death Games to Put Food on the Table | 11 | 2026 | [öffnen](https://www.netflix.com/title/82047155) |
| 31 | Aggretsuko: Season 2 | 10 | 2019 | [öffnen](https://www.netflix.com/title/80198505) |
| 32 | Hi Score Girl II | 9 | 2019 | [öffnen](https://www.netflix.com/title/80997338) |
| 33 | Rilakkuma's Theme Park Adventure | 8 | 2022 | [öffnen](https://www.netflix.com/title/81341765) |
| 34 | Knights of the Zodiac: Saint Seiya Part 2 | 6 | 2020 | [öffnen](https://www.netflix.com/title/80186926) |
| 35 | SPRIGGAN (ONA) | 6 | 2022 | [öffnen](https://www.netflix.com/title/81050064) |
| 36 | ULTRAMAN Season 2 | 6 | 2022 | [öffnen](https://www.netflix.com/title/80231373) |
| 37 | Pokémon Concierge: Season 1: Part 2 | 4 | 2025 | [öffnen](http://netflix.com/pokemonconcierge) |
| 38 | Cyborg 009 vs Devilman | 3 | 2015 | [öffnen](http://www.netflix.com/title/80094557) |
| 39 | Princess Mononoke | 1 | 1997 | [öffnen](https://www.netflix.com/title/28630857) |
| 40 | My Neighbors the Yamadas | 1 | 1999 | [öffnen](https://www.netflix.com/title/70035035) |
| 41 | Howl‘s Moving Castle | 1 | 2004 | [öffnen](https://www.netflix.com/title/70028883) |
| 42 | Naruto the Movie: Ninja Clash in the Land of Snow | 1 | 2004 | [öffnen](https://www.netflix.com/title/70074559) |
| 43 | InuYasha the Movie 4: Fire on the Mystic Island | 1 | 2004 | [öffnen](https://www.netflix.com/title/70052492) |
| 44 | Kiki's Delivery Service | 1 | 1989 | [öffnen](https://www.netflix.com/title/60027106) |
| 45 | Castle in the Sky | 1 | 1986 | [öffnen](https://www.netflix.com/title/60027393) |
| 46 | My Neighbor Totoro | 1 | 1988 | [öffnen](https://www.netflix.com/title/60032294) |
| 47 | Nausicaä of the Valley of the Wind | 1 | 1984 | [öffnen](https://www.netflix.com/title/70019062) |
| 48 | Grave of the Fireflies | 1 | 1988 | [öffnen](https://www.netflix.com/title/557010) |
| 49 | The Cat Returns | 1 | 2002 | [öffnen](https://www.netflix.com/title/70019058) |
| 50 | Ocean Waves | 1 | 1993 | [öffnen](https://www.netflix.com/title/80158668) |
| 51 | Tales from Earthsea | 1 | 2006 | [öffnen](https://www.netflix.com/title/70142821) |
| 52 | The Secret World of Arrietty | 1 | 2010 | [öffnen](https://www.netflix.com/title/70216227) |
| 53 | Kizumonogatari Part 1: Tekketsu | 1 | 2016 | [öffnen](https://www.netflix.com/title/80097748) |
| 54 | From Up on Poppy Hill | 1 | 2011 | [öffnen](https://www.netflix.com/title/70262786) |
| 55 | Berserk: The Golden Age Arc I - The Egg of the King | 1 | 2012 | [öffnen](https://www.netflix.com/title/70258995) |
| 56 | Iron Man: Rise of Technovore | 1 | 2013 | [öffnen](https://www.netflix.com/title/70267410) |
| 57 | The Wind Rises | 1 | 2013 | [öffnen](https://www.netflix.com/title/70293674) |
| 58 | The Tale of The Princess Kaguya | 1 | 2013 | [öffnen](https://www.netflix.com/title/80013552) |
| 59 | When Marnie Was There | 1 | 2014 | [öffnen](https://www.netflix.com/title/80036398) |
| 60 | The Boy and the Beast | 1 | 2015 | [öffnen](https://www.netflix.com/title/80063800) |
| 61 | Fate/Grand Order: First Order | 1 | 2016 | [öffnen](https://www.netflix.com/title/80213886) |
| 62 | Mary and The Witch's Flower | 1 | 2017 | [öffnen](https://www.netflix.com/title/80217130) |
| 63 | The Boy and the Heron | 1 | 2023 | [öffnen](https://www.netflix.com/title/81725555) |
| 64 | Godzilla: City on the Edge of Battle | 1 | 2018 | [öffnen](https://www.netflix.com/title/80180376) |
| 65 | Violet Evergarden: Special | 1 | 2018 | [öffnen](https://www.netflix.com/title/81010662) |
| 66 | Godzilla: The Planet Eater | 1 | 2018 | [öffnen](https://www.netflix.com/title/80198623) |
| 67 | Dragon Quest: Your Story | 1 | 2019 | [öffnen](https://www.netflix.com/title/81170086) |
| 68 | Altered Carbon: Resleeved | 1 | 2020 | [öffnen](https://www.netflix.com/title/81001991) |
| 69 | STAND BY ME Doraemon 2 | 1 | 2020 | [öffnen](https://www.netflix.com/title/81451264) |
| 70 | A Whisker Away | 1 | 2020 | [öffnen](https://www.netflix.com/title/81281872) |
| 71 | Earwig and the Witch | 1 | 2020 | [öffnen](https://www.netflix.com/title/81316559) |
| 72 | Bright: Samurai Soul | 1 | 2021 | [öffnen](https://www.netflix.com/title/81001990) |
| 73 | Drifting Home | 1 | 2022 | [öffnen](https://www.netflix.com/title/81328781) |
| 74 | Baki Hanma VS Kengan Ashura | 1 | 2024 | [öffnen](https://www.netflix.com/title/81648184) |
| 75 | Cosmic Princess Kaguya! | 1 | 2026 | [öffnen](https://www.netflix.com/title/81756595) |
