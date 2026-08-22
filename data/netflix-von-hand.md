# Netflix: was kein Automat beantworten kann

Stand 2026-08-22 · **121 Titel**.

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
| 1 | Cardcaptor Sakura | 70 | 1998 | [öffnen](https://www.netflix.com/title/70309056) |
| 2 | Beyblade Burst Surge | 52 | 2020 | [öffnen](https://www.netflix.com/title/81567663) |
| 3 | Beyblade Burst QuadDrive | 52 | 2021 | [öffnen](https://www.netflix.com/title/81670673) |
| 4 | A Little Princess Sara | 46 | 1985 | [öffnen](https://www.netflix.com/sa-en/title/81311604?source=35) |
| 5 | JoJo's Bizarre Adventure: Diamond is Unbreakable | 39 | 2016 | [öffnen](https://www.netflix.com/title/80179831) |
| 6 | JoJo's Bizarre Adventure: Golden Wind | 39 | 2018 | [öffnen](https://www.netflix.com/title/80179831) |
| 7 | Frieren: Beyond Journey’s End | 28 | 2023 | [öffnen](https://www.netflix.com/title/81726714) |
| 8 | Baki Hanma Season 2 | 27 | 2023 | [öffnen](https://www.netflix.com/title/81236338) |
| 9 | Ronja, the Robber's Daughter | 26 | 2014 | [öffnen](https://www.netflix.com/title/80074221) |
| 10 | Code Geass: Lelouch of the Rebellion R2 | 25 | 2008 | [öffnen](https://www.netflix.com/title/80065146) |
| 11 | Kuroko's Basketball | 25 | 2012 | [öffnen](https://www.netflix.com/title/80063153) |
| 12 | Kuroko's Basketball 2 | 25 | 2013 | [öffnen](https://www.netflix.com/title/80063153) |
| 13 | My Hero Academia Season 2 | 25 | 2017 | [öffnen](https://www.netflix.com/title/80135674) |
| 14 | Little Witch Academia (TV) | 25 | 2017 | [öffnen](https://www.netflix.com/title/80156387) |
| 15 | My Hero Academia Season 3 | 25 | 2018 | [öffnen](https://www.netflix.com/title/80135674) |
| 16 | Shangri-La Frontier Season 2 | 25 | 2024 | [öffnen](https://www.netflix.com/title/81727242) |
| 17 | A Certain Magical Index II | 24 | 2010 | [öffnen](https://www.netflix.com/title/70308188) |
| 18 | A Certain Scientific Railgun S | 24 | 2013 | [öffnen](https://www.netflix.com/title/70308190) |
| 19 | The Seven Deadly Sins: Revival of the Commandments | 24 | 2018 | [öffnen](https://www.netflix.com/title/80050063) |
| 20 | Sword Art Online: Alicization | 24 | 2018 | [öffnen](https://www.netflix.com/title/70302573) |
| 21 | The Seven Deadly Sins: Imperial Wrath of the Gods | 24 | 2019 | [öffnen](https://www.netflix.com/title/80050063) |
| 22 | Fire Force Season 2 | 24 | 2020 | [öffnen](https://www.netflix.com/title/81143589) |
| 23 | Vinland Saga – Staffel 2 | 24 | 2023 | [öffnen](https://www.netflix.com/title/81249833) |
| 24 | Die Tagebücher der Apothekerin – Staffel 1 | 24 | 2023 | [öffnen](https://www.netflix.com/title/81712068) |
| 25 | The Apothecary Diaries Season 2 | 24 | 2025 | [öffnen](https://www.netflix.com/title/81712068) |
| 26 | Daemons of the Shadow Realm | 24 | 2026 | [öffnen](https://www.netflix.com/title/82719204) |
| 27 | JUJUTSU KAISEN Season 2 | 23 | 2023 | [öffnen](https://www.netflix.com/title/81278456) |
| 28 | Urusei Yatsura (2022) Seasons 3 & 4 | 23 | 2024 | [öffnen](https://www.netflix.com/title/81642888) |
| 29 | Dino Girl Gauko Season 2 | 19 | 2020 | [öffnen](https://www.netflix.com/title/80216180) |
| 30 | KENGAN ASHURA Season 2 Part.2 | 16 | 2024 | [öffnen](https://www.netflix.com/title/80992228) |
| 31 | Bakemonogatari | 15 | 2009 | [öffnen](https://www.netflix.com/title/80060347) |
| 32 | BLUE LOCK Season 2 | 14 | 2024 | [öffnen](https://www.netflix.com/title/81640753) |
| 33 | Gantz: Second Stage | 13 | 2004 | [öffnen](https://www.netflix.com/title/80133769) |
| 34 | K | 13 | 2012 | [öffnen](http://www.netflix.com/title/80040118) |
| 35 | Food Wars! The Second Plate | 13 | 2016 | [öffnen](https://www.netflix.com/title/80182054) |
| 36 | Larva Island Season 2 | 13 | 2019 | [öffnen](https://www.netflix.com/title/80991329) |
| 37 | Baki: The Great Raitai Tournament Saga | 13 | 2020 | [öffnen](https://www.netflix.com/title/80204451) |
| 38 | The Irregular at Magic High School: Visitor Arc | 13 | 2020 | [öffnen](https://www.netflix.com/title/80009361) |
| 39 | BLEACH: Thousand-Year Blood War | 13 | 2022 | [öffnen](https://www.netflix.com/title/70204957) |
| 40 | SPY x FAMILY Cour 2 | 13 | 2022 | [öffnen](https://www.netflix.com/title/81511410) |
| 41 | OSHI NO KO Season 2 | 13 | 2024 | [öffnen](https://www.netflix.com/title/81684733) |
| 42 | My Happy Marriage Season 2 | 13 | 2025 | [öffnen](https://www.netflix.com/title/81564905) |
| 43 | Black Butler: Emerald Witch Arc | 13 | 2025 | [öffnen](https://www.netflix.com/title/70204955) |
| 44 | Black Butler II | 12 | 2010 | [öffnen](https://www.netflix.com/title/70204955) |
| 45 | Haganai NEXT | 12 | 2013 | [öffnen](https://www.netflix.com/title/80132156) |
| 46 | Attack on Titan Season 2 | 12 | 2017 | [öffnen](https://www.netflix.com/title/70299043) |
| 47 | Blue Exorcist: Kyoto Saga | 12 | 2017 | [öffnen](https://www.netflix.com/title/70304252) |
| 48 | ID-0 | 12 | 2017 | [öffnen](https://www.netflix.com/title/80174918) |
| 49 | One-Punch Man Season 2 | 12 | 2019 | [öffnen](https://www.netflix.com/title/80117291) |
| 50 | Blood Blockade Battlefront & Beyond | 12 | 2017 | [öffnen](https://www.netflix.com/title/80205560) |
| 51 | Attack on Titan Season 3 | 12 | 2018 | [öffnen](https://www.netflix.com/title/70299043) |
| 52 | Food Wars! The Third Plate | 12 | 2017 | [öffnen](https://www.netflix.com/title/80182054) |
| 53 | Tokyo Ghoul:re | 12 | 2018 | [öffnen](https://www.netflix.com/title/80023687) |
| 54 | SWORDGAI The Animation Part II | 12 | 2018 | [öffnen](https://www.netflix.com/title/80175350) |
| 55 | Tokyo Ghoul:re 2 | 12 | 2018 | [öffnen](https://www.netflix.com/title/80023687) |
| 56 | Forest of Piano Season 2 | 12 | 2019 | [öffnen](https://www.netflix.com/title/80986797) |
| 57 | Teasing Master Takagi-san Season 2 | 12 | 2019 | [öffnen](https://www.netflix.com/title/80228274) |
| 58 | Sword Art Online: Alicization - War of Underworld | 12 | 2019 | [öffnen](https://www.netflix.com/title/70302573) |
| 59 | KENGAN ASHURA Part II | 12 | 2019 | [öffnen](https://www.netflix.com/title/80992228) |
| 60 | 7SEEDS Part 2 | 12 | 2020 | [öffnen](https://www.netflix.com/title/80183051) |
| 61 | BEASTARS Season 2 | 12 | 2021 | [öffnen](https://www.netflix.com/title/81054847) |
| 62 | Ghost in the Shell: SAC_2045 Season 2 | 12 | 2022 | [öffnen](https://www.netflix.com/title/81030224) |
| 63 | 86 EIGHTY-SIX Part 2 | 12 | 2021 | [öffnen](https://www.netflix.com/title/81442047) |
| 64 | ULTRAMAN: The Final Season | 12 | 2023 | [öffnen](https://www.netflix.com/title/80231373) |
| 65 | One-Punch Man Season 3 | 12 | 2025 | [öffnen](https://netflix.com/title/80117291) |
| 66 | My Dress-Up Darling Season 2 | 12 | 2025 | [öffnen](https://www.netflix.com/title/81569754) |
| 67 | JUJUTSU KAISEN Season 3: The Culling Game Part 1 | 12 | 2026 | [öffnen](https://www.netflix.com/title/81278456) |
| 68 | DAN DA DAN (Staffel 2) | 12 | 2025 | [öffnen](https://www.netflix.com/title/81736884) |
| 69 | Ranma1/2 (2024) Season 2 | 12 | 2025 | [öffnen](https://www.netflix.com/title/81301833) |
| 70 | Anohana: The Flower We Saw That Day | 11 | 2011 | [öffnen](https://www.netflix.com/browse?jbv=80075178&jbp=0&jbr=11) |
| 71 | PSYCHO-PASS 2 | 11 | 2014 | [öffnen](https://www.netflix.com/title/80006146) |
| 72 | Darwin's Game | 11 | 2020 | [öffnen](https://www.netflix.com/title/81234353) |
| 73 | KONOSUBA -God's blessing on this wonderful world! 3 | 11 | 2024 | [öffnen](https://www.netflix.com/title/80131674) |
| 74 | Pokémon: To Be a Pokémon Master: Ultimate Journeys: The Series | 11 | 2023 | [öffnen](https://www.netflix.com/title/81706101) |
| 75 | SHIBOYUGI: Playing Death Games to Put Food on the Table | 11 | 2026 | [öffnen](https://www.netflix.com/title/82047155) |
| 76 | Oshi no Ko – Staffel 3 | 11 | 2026 | [öffnen](https://www.netflix.com/title/81684733) |
| 77 | Aggretsuko: Season 2 | 10 | 2019 | [öffnen](https://www.netflix.com/title/80198505) |
| 78 | Hi Score Girl II | 9 | 2019 | [öffnen](https://www.netflix.com/title/80997338) |
| 79 | Rilakkuma's Theme Park Adventure | 8 | 2022 | [öffnen](https://www.netflix.com/title/81341765) |
| 80 | Knights of the Zodiac: Saint Seiya Part 2 | 6 | 2020 | [öffnen](https://www.netflix.com/title/80186926) |
| 81 | SPRIGGAN (ONA) | 6 | 2022 | [öffnen](https://www.netflix.com/title/81050064) |
| 82 | ULTRAMAN Season 2 | 6 | 2022 | [öffnen](https://www.netflix.com/title/80231373) |
| 83 | Pokémon Concierge: Season 1: Part 2 | 4 | 2025 | [öffnen](http://netflix.com/pokemonconcierge) |
| 84 | Cyborg 009 vs Devilman | 3 | 2015 | [öffnen](http://www.netflix.com/title/80094557) |
| 85 | Princess Mononoke | 1 | 1997 | [öffnen](https://www.netflix.com/title/28630857) |
| 86 | My Neighbors the Yamadas | 1 | 1999 | [öffnen](https://www.netflix.com/title/70035035) |
| 87 | Howl‘s Moving Castle | 1 | 2004 | [öffnen](https://www.netflix.com/title/70028883) |
| 88 | Naruto the Movie: Ninja Clash in the Land of Snow | 1 | 2004 | [öffnen](https://www.netflix.com/title/70074559) |
| 89 | InuYasha the Movie 4: Fire on the Mystic Island | 1 | 2004 | [öffnen](https://www.netflix.com/title/70052492) |
| 90 | Kiki's Delivery Service | 1 | 1989 | [öffnen](https://www.netflix.com/title/60027106) |
| 91 | Castle in the Sky | 1 | 1986 | [öffnen](https://www.netflix.com/title/60027393) |
| 92 | My Neighbor Totoro | 1 | 1988 | [öffnen](https://www.netflix.com/title/60032294) |
| 93 | Nausicaä of the Valley of the Wind | 1 | 1984 | [öffnen](https://www.netflix.com/title/70019062) |
| 94 | Grave of the Fireflies | 1 | 1988 | [öffnen](https://www.netflix.com/title/557010) |
| 95 | The Cat Returns | 1 | 2002 | [öffnen](https://www.netflix.com/title/70019058) |
| 96 | Ocean Waves | 1 | 1993 | [öffnen](https://www.netflix.com/title/80158668) |
| 97 | Tales from Earthsea | 1 | 2006 | [öffnen](https://www.netflix.com/title/70142821) |
| 98 | The Secret World of Arrietty | 1 | 2010 | [öffnen](https://www.netflix.com/title/70216227) |
| 99 | Kizumonogatari Part 1: Tekketsu | 1 | 2016 | [öffnen](https://www.netflix.com/title/80097748) |
| 100 | From Up on Poppy Hill | 1 | 2011 | [öffnen](https://www.netflix.com/title/70262786) |
| 101 | Berserk: The Golden Age Arc I - The Egg of the King | 1 | 2012 | [öffnen](https://www.netflix.com/title/70258995) |
| 102 | Iron Man: Rise of Technovore | 1 | 2013 | [öffnen](https://www.netflix.com/title/70267410) |
| 103 | The Wind Rises | 1 | 2013 | [öffnen](https://www.netflix.com/title/70293674) |
| 104 | The Tale of The Princess Kaguya | 1 | 2013 | [öffnen](https://www.netflix.com/title/80013552) |
| 105 | When Marnie Was There | 1 | 2014 | [öffnen](https://www.netflix.com/title/80036398) |
| 106 | The Boy and the Beast | 1 | 2015 | [öffnen](https://www.netflix.com/title/80063800) |
| 107 | Fate/Grand Order: First Order | 1 | 2016 | [öffnen](https://www.netflix.com/title/80213886) |
| 108 | Mary and The Witch's Flower | 1 | 2017 | [öffnen](https://www.netflix.com/title/80217130) |
| 109 | The Boy and the Heron | 1 | 2023 | [öffnen](https://www.netflix.com/title/81725555) |
| 110 | Godzilla: City on the Edge of Battle | 1 | 2018 | [öffnen](https://www.netflix.com/title/80180376) |
| 111 | Violet Evergarden: Special | 1 | 2018 | [öffnen](https://www.netflix.com/title/81010662) |
| 112 | Godzilla: The Planet Eater | 1 | 2018 | [öffnen](https://www.netflix.com/title/80198623) |
| 113 | Dragon Quest: Your Story | 1 | 2019 | [öffnen](https://www.netflix.com/title/81170086) |
| 114 | Altered Carbon: Resleeved | 1 | 2020 | [öffnen](https://www.netflix.com/title/81001991) |
| 115 | STAND BY ME Doraemon 2 | 1 | 2020 | [öffnen](https://www.netflix.com/title/81451264) |
| 116 | A Whisker Away | 1 | 2020 | [öffnen](https://www.netflix.com/title/81281872) |
| 117 | Earwig and the Witch | 1 | 2020 | [öffnen](https://www.netflix.com/title/81316559) |
| 118 | Bright: Samurai Soul | 1 | 2021 | [öffnen](https://www.netflix.com/title/81001990) |
| 119 | Drifting Home | 1 | 2022 | [öffnen](https://www.netflix.com/title/81328781) |
| 120 | Baki Hanma VS Kengan Ashura | 1 | 2024 | [öffnen](https://www.netflix.com/title/81648184) |
| 121 | Cosmic Princess Kaguya! | 1 | 2026 | [öffnen](https://www.netflix.com/title/81756595) |
