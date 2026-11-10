# Netflix: was kein Automat beantworten kann

Stand 2026-11-10 · **188 Titel**.

Netflix gibt seine Tonspuren nur an einen laufenden Player heraus — fünfmal gemessen,
fünfmal bestätigt. Es gibt keinen Abruf, der das hier abnehmen könnte.
Netflix selbst darf nicht abgerufen werden (`robots.txt`). Bleibt der Blick von Hand.

**Ablauf mit der Erweiterung aus `extension/`:** Titelseite öffnen, auf **Abspielen** klicken,
warten bis der Player die Tonspuren geladen hat, zurück. Die Meldung geht von selbst raus —
der Knopf unten rechts zeigt nur noch, was angekommen ist.

Bei mehreren Staffeln lohnt es, **erste und letzte Folge** anzusehen: Weicht der Befund ab,
trägt der Datensatz die Grenze ein statt eines pauschalen Ja. Netflix zählt dabei über alle
Staffeln durch — bei Jujutsu Kaisen bis 59 (Daniel, 22.08.2026).

**Der Umweg über die Titelseite ist nötig:** Ein Klick direkt auf die Abspieladresse leitet
Netflix auf die erste **Folge** um, und deren Kennung kennt unser Datensatz nicht — neun von
zwölf Meldungen aus Batch 1 waren deshalb nicht zuzuordnen (22.08.2026). Von der Titelseite
aus merkt sich die Erweiterung die Reihe; ohne sie meldet der Knopf gar nicht erst.

Erzeugt von `npm run data:netflix-rest`, nicht von Hand pflegen.

| # | Titel | Folgen | Jahr | Verweis |
|---|---|---:|---:|---|
| 1 | Inazuma Eleven | 127 | 2008 | [öffnen](https://www.netflix.com/title/80007757) |
| 2 | Sonic X | 52 | 2003 | [öffnen](https://www.netflix.com/title/60036794) |
| 3 | Bakugan: Armored Alliance | 52 | 2020 | [öffnen](https://www.netflix.com/title/81310654) |
| 4 | Beyblade | 51 | 2001 | [öffnen](https://www.netflix.com/title/70155614) |
| 5 | Naruto Spin off! Rock Lee & seine Ninja-Kumpels | 51 | 2012 | [öffnen](https://www.netflix.com/title/80151421) |
| 6 | Beyblade Burst: Evolution | 51 | 2017 | [öffnen](https://www.netflix.com/title/81018295) |
| 7 | Mobile Suit Gundam Seed | 50 | 2002 | [öffnen](https://www.netflix.com/title/80146549) |
| 8 | Captain Tsubasa: Staffel 2 - Die Junioren | 39 | 2023 | [öffnen](https://www.netflix.com/title/81003894) |
| 9 | Sailor Moon S | 38 | 1994 | [öffnen](https://www.netflix.com/title/70020763) |
| 10 | Samurai 7 | 26 | 2004 | [öffnen](https://www.netflix.com/title/70205019) |
| 11 | Ghost in the Shell: Stand Alone Complex | 26 | 2002 | [öffnen](https://www.netflix.com/title/70213091) |
| 12 | Ghost in the Shell: Stand Alone Complex 2nd GIG | 26 | 2004 | [öffnen](https://www.netflix.com/title/70213091) |
| 13 | Higurashi no Naku Koro ni | 26 | 2006 | [öffnen](https://www.netflix.com/title/70308793) |
| 14 | Maid-sama | 26 | 2010 | [öffnen](https://www.netflix.com/title/81104406) |
| 15 | Pretty Guardian Sailor Moon Crystal | 26 | 2014 | [öffnen](https://www.netflix.com/title/80145747) |
| 16 | Nagi no Asukara | 26 | 2013 | [öffnen](https://www.netflix.com/title/80132218) |
| 17 | Titipo Titipo 2 | 26 | 2019 | [öffnen](https://www.netflix.com/title/81099976) |
| 18 | Magi: The Kingdom of Magic | 25 | 2013 | [öffnen](https://www.netflix.com/title/80028089) |
| 19 | Re:Zero - Starting Life in Another World | 25 | 2016 | [öffnen](https://www.netflix.com/title/80131659) |
| 20 | Spice and Wolf: Merchant Meets the Wise Wolf | 25 | 2024 | [öffnen](https://www.netflix.com/title/81768918) |
| 21 | Gosick | 24 | 2011 | [öffnen](https://www.netflix.com/title/80209888) |
| 22 | Parasyte: The Maxim | 24 | 2014 | [öffnen](https://www.netflix.com/title/80191008) |
| 23 | Darling in the Franxx | 24 | 2018 | [öffnen](https://www.netflix.com/title/81010668) |
| 24 | Ich bin eine Spinne, na und? | 24 | 2021 | [öffnen](https://www.netflix.com/title/81392169) |
| 25 | Higurashi: When They Cry Gou | 24 | 2020 | [öffnen](https://www.netflix.com/title/81336986) |
| 26 | Yashahime: Princess Half-Demon | 24 | 2020 | [öffnen](https://www.netflix.com/title/81336398) |
| 27 | Tokyo Revengers | 24 | 2021 | [öffnen](https://www.netflix.com/title/81442520) |
| 28 | A Couple of Cuckoos | 24 | 2022 | [öffnen](https://www.netflix.com/title/81594245) |
| 29 | 2.5 Dimensional Seduction | 24 | 2024 | [öffnen](https://www.netflix.com/title/81909977) |
| 30 | Welcome to Demon School! Iruma-kun | 23 | 2019 | [öffnen](https://www.netflix.com/title/81194192) |
| 31 | Welcome to Demon-School! Iruma-kun: Staffel 2 | 21 | 2021 | [öffnen](https://www.netflix.com/title/81194192) |
| 32 | Welcome to Demon School! Iruma-kun: Staffel 3 | 21 | 2022 | [öffnen](https://www.netflix.com/title/81672787) |
| 33 | To Your Eternity | 20 | 2021 | [öffnen](https://www.netflix.com/title/81333467) |
| 34 | Re:Zero - Starting Life in Another World: Staffel 3 | 16 | 2024 | [öffnen](https://www.netflix.com/title/81262169) |
| 35 | Higurashi: When They Cry Sotsu | 15 | 2021 | [öffnen](https://www.netflix.com/title/81336986) |
| 36 | Die Melancholie der Haruhi Suzumiya | 14 | 2006 | [öffnen](https://www.netflix.com/title/81056036) |
| 37 | Paranoia Agent | 13 | 2004 | [öffnen](https://www.netflix.com/title/70014551) |
| 38 | Spice and Wolf | 13 | 2008 | [öffnen](https://www.netflix.com/title/70205026) |
| 39 | Vampire Knight Guilty | 13 | 2008 | [öffnen](https://www.netflix.com/title/70309457) |
| 40 | Kamisama Kiss | 13 | 2012 | [öffnen](https://www.netflix.com/title/80070071) |
| 41 | The Devil Is a Part-Timer! | 13 | 2013 | [öffnen](https://www.netflix.com/title/80006149) |
| 42 | Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth | 13 | 2015 | [öffnen](https://www.netflix.com/title/80185873) |
| 43 | Pretty Guardian Sailor Moon Crystal Season III | 13 | 2016 | [öffnen](https://www.netflix.com/title/80145747) |
| 44 | Katsugeki: Touken Ranbu | 13 | 2017 | [öffnen](https://www.netflix.com/title/80232868) |
| 45 | Miss Kobayashi’s Dragon Maid | 13 | 2017 | [öffnen](https://www.netflix.com/title/80186349) |
| 46 | A Place Further Than the Universe | 13 | 2018 | [öffnen](https://www.netflix.com/title/80995912) |
| 47 | Cells at Work! | 13 | 2018 | [öffnen](https://www.netflix.com/title/81028791) |
| 48 | Bloom into You | 13 | 2018 | [öffnen](https://www.netflix.com/title/81025783) |
| 49 | Gleipnir | 13 | 2020 | [öffnen](https://www.netflix.com/title/81263648) |
| 50 | Re:Zero - Starting Life in Another World Season 2 | 13 | 2020 | [öffnen](https://www.netflix.com/title/80131659) |
| 51 | Tower of God | 13 | 2020 | [öffnen](https://www.netflix.com/title/81329313) |
| 52 | Cells at Work! Code Black | 13 | 2021 | [öffnen](https://www.netflix.com/title/81392162) |
| 53 | Lycoris Recoil | 13 | 2022 | [öffnen](https://www.netflix.com/title/81620000) |
| 54 | Atelier of Witch Hat | 13 | 2026 | [öffnen](https://www.netflix.com/title/82741721) |
| 55 | Tomo-chan Is a Girl! | 13 | 2023 | [öffnen](https://www.netflix.com/title/81680192) |
| 56 | Wind Breaker | 13 | 2024 | [öffnen](https://www.netflix.com/title/81771389) |
| 57 | Girls Band Cry | 13 | 2024 | [öffnen](https://www.netflix.com/title/81940284) |
| 58 | My Hero Academia: Vigilantes Staffel 2 | 13 | 2026 | [öffnen](https://www.netflix.com/title/82036361) |
| 59 | Magic Kaito: Kid the Phantom Thief | 12 | 2010 | [öffnen](https://www.netflix.com/title/81757633) |
| 60 | Another | 12 | 2012 | [öffnen](https://www.netflix.com/title/80241072) |
| 61 | Highschool D×D | 12 | 2012 | [öffnen](https://www.netflix.com/title/80005873) |
| 62 | Btooom! | 12 | 2012 | [öffnen](https://www.netflix.com/title/80052713) |
| 63 | Love, Chunibyo & Other Delusions! | 12 | 2012 | [öffnen](https://www.netflix.com/title/80239860) |
| 64 | Highschool D×D New | 12 | 2013 | [öffnen](https://www.netflix.com/title/80005873) |
| 65 | Beyond the Boundary: Kyoukai no Kanata | 12 | 2013 | [öffnen](https://www.netflix.com/title/80052668) |
| 66 | Love, Chunibyo & Other Delusions! Heart Throb | 12 | 2014 | [öffnen](https://www.netflix.com/title/80239860) |
| 67 | Aldnoah.Zero | 12 | 2014 | [öffnen](https://www.netflix.com/title/80040104) |
| 68 | Shojo-Mangaka Nozaki-kun | 12 | 2014 | [öffnen](https://www.netflix.com/title/80081848) |
| 69 | Highschool D×D BorN | 12 | 2015 | [öffnen](https://www.netflix.com/title/80005873) |
| 70 | Kamisama Kiss: Staffel 2 | 12 | 2015 | [öffnen](https://www.netflix.com/title/80070071) |
| 71 | Aldnoah.Zero 2 | 12 | 2015 | [öffnen](https://www.netflix.com/title/80040104) |
| 72 | Gate | 12 | 2015 | [öffnen](https://www.netflix.com/title/80182163) |
| 73 | Bungo Stray Dogs | 12 | 2016 | [öffnen](https://www.netflix.com/title/80132126) |
| 74 | Gate – Teil 2 | 12 | 2016 | [öffnen](https://www.netflix.com/title/80182163) |
| 75 | Grimgar, Ashes and Illusions | 12 | 2016 | [öffnen](https://www.netflix.com/title/80142717) |
| 76 | Bungo Stray Dogs 2 | 12 | 2016 | [öffnen](https://www.netflix.com/title/80132126) |
| 77 | Danmachi: Sword Oratoria | 12 | 2017 | [öffnen](https://www.netflix.com/title/80187572) |
| 78 | Küss ihn, nicht mich! | 12 | 2016 | [öffnen](https://www.netflix.com/title/81107662) |
| 79 | Eromanga Sensei | 12 | 2017 | [öffnen](https://www.netflix.com/title/80193052) |
| 80 | Scum’s Wish | 12 | 2017 | [öffnen](https://www.netflix.com/title/80194878) |
| 81 | Akashic Records of Bastard Magical Instructor | 12 | 2017 | [öffnen](https://www.netflix.com/title/80192978) |
| 82 | Masamune-kun’s Revenge | 12 | 2017 | [öffnen](https://www.netflix.com/title/80165290) |
| 83 | WorldEnd: What Do You Do at the End of the World? Are You Busy? Will You Save Us? | 12 | 2017 | [öffnen](https://www.netflix.com/title/80193136) |
| 84 | Citrus | 12 | 2018 | [öffnen](https://www.netflix.com/title/80231942) |
| 85 | Juni Taisen: Zodiac War | 12 | 2017 | [öffnen](https://www.netflix.com/title/80227111) |
| 86 | In Another World with My Smartphone | 12 | 2017 | [öffnen](https://www.netflix.com/title/80196595) |
| 87 | Classroom of the Elite | 12 | 2017 | [öffnen](https://www.netflix.com/title/80193178) |
| 88 | Hinamatsuri | 12 | 2018 | [öffnen](https://www.netflix.com/title/80991680) |
| 89 | Yunas Geisterhaus | 12 | 2018 | [öffnen](https://www.netflix.com/title/81037377) |
| 90 | How Not to Summon a Demon Lord | 12 | 2018 | [öffnen](https://www.netflix.com/title/81004514) |
| 91 | Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth II | 12 | 2019 | [öffnen](https://www.netflix.com/title/80185873) |
| 92 | Kaguya-sama: Love Is War | 12 | 2019 | [öffnen](https://www.netflix.com/title/81061754) |
| 93 | Bungo Stray Dogs 3 | 12 | 2019 | [öffnen](https://www.netflix.com/title/80132126) |
| 94 | Cautious Hero: The Hero Is Overpowered but Overly Cautious | 12 | 2019 | [öffnen](https://www.netflix.com/title/81196818) |
| 95 | Bofuri: I Don’t Want to Get Hurt, So I’ll Max Out My Defense. | 12 | 2020 | [öffnen](https://www.netflix.com/title/81234294) |
| 96 | How Heavy Are the Dumbbells You Lift? | 12 | 2019 | [öffnen](https://www.netflix.com/title/81143618) |
| 97 | Astra Lost in Space | 12 | 2019 | [öffnen](https://www.netflix.com/title/81144576) |
| 98 | Sing “Yesterday” for Me | 12 | 2020 | [öffnen](https://www.netflix.com/title/81266992) |
| 99 | Deca-Dence | 12 | 2020 | [öffnen](https://www.netflix.com/title/81299341) |
| 100 | Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth III | 12 | 2020 | [öffnen](https://www.netflix.com/title/80185873) |
| 101 | Kaguya-sama: Love Is War? | 12 | 2020 | [öffnen](https://www.netflix.com/title/81061754) |
| 102 | Rent-a-Girlfriend | 12 | 2020 | [öffnen](https://www.netflix.com/title/81299211) |
| 103 | By the Grace of the Gods | 12 | 2020 | [öffnen](https://www.netflix.com/title/81341928) |
| 104 | Iwakakeru! Sport Climbing Girls | 12 | 2020 | [öffnen](https://www.netflix.com/title/81403488) |
| 105 | Re:Zero - Starting Life in Another World Season 2 | 12 | 2021 | [öffnen](https://www.netflix.com/title/80131659) |
| 106 | Don’t Toy with Me, Miss Nagatoro | 12 | 2021 | [öffnen](https://www.netflix.com/title/81427422) |
| 107 | Chainsaw Man | 12 | 2022 | [öffnen](https://www.netflix.com/title/81215627) |
| 108 | My Isekai Life: I Gained a Second Character Class and Became the Strongest Sage in the World! | 12 | 2022 | [öffnen](https://www.netflix.com/title/81617962) |
| 109 | The World’s Finest Assassin Gets Reincarnated in Another World as an Aristocrat | 12 | 2021 | [öffnen](https://www.netflix.com/title/81511191) |
| 110 | Bocchi the Rock! | 12 | 2022 | [öffnen](https://www.netflix.com/title/81641170) |
| 111 | I’m Quitting Heroing | 12 | 2022 | [öffnen](https://www.netflix.com/title/81594273) |
| 112 | Ayakashi Triangle | 12 | 2023 | [öffnen](https://www.netflix.com/title/81680115) |
| 113 | NieR:Automata Ver1.1a | 12 | 2023 | [öffnen](https://www.netflix.com/title/81680344) |
| 114 | Masamune-kun’s Revenge R | 12 | 2023 | [öffnen](https://www.netflix.com/title/80165290) |
| 115 | In Another World with My Smartphone 2 | 12 | 2023 | [öffnen](https://www.netflix.com/title/80196595) |
| 116 | Mashle: Magic and Muscles | 12 | 2023 | [öffnen](https://www.netflix.com/title/81685164) |
| 117 | Solo Leveling | 12 | 2024 | [öffnen](https://www.netflix.com/title/81748512) |
| 118 | Raeliana: Warum sie die Verlobte des Dukes wurde | 12 | 2023 | [öffnen](https://www.netflix.com/title/81684407) |
| 119 | Die Parallelwelt-Chroniken des Aristokraten | 12 | 2023 | [öffnen](https://www.netflix.com/title/81768275) |
| 120 | Dead Mount Death Play | 12 | 2023 | [öffnen](https://www.netflix.com/title/81686706) |
| 121 | Zom 100: Bucket List of the Dead | 12 | 2023 | [öffnen](https://www.netflix.com/title/81680101) |
| 122 | Alya Sometimes Hides Her Feelings in Russian | 12 | 2024 | [öffnen](https://www.netflix.com/title/81661821) |
| 123 | Mashle: Magic and Muscles - The Divine Visionary Candidate Exam Arc | 12 | 2024 | [öffnen](https://www.netflix.com/title/81685164) |
| 124 | A Sign of Affection | 12 | 2024 | [öffnen](https://www.netflix.com/title/81748453) |
| 125 | Loner Life in Another World | 12 | 2024 | [öffnen](https://www.netflix.com/title/81955440) |
| 126 | Failure Frame: I Became the Strongest and Annihilated Everything with Low-Level Spells | 12 | 2024 | [öffnen](https://www.netflix.com/title/81910037) |
| 127 | Wistoria: Wand and Sword | 12 | 2024 | [öffnen](https://www.netflix.com/title/81900358) |
| 128 | Possibly the Greatest Alchemist of All Time | 12 | 2025 | [öffnen](https://www.netflix.com/title/82058586) |
| 129 | Wistoria: Wand and Sword | 12 | 2026 | [öffnen](https://www.netflix.com/title/81900358) |
| 130 | Terror in Tokio | 11 | 2014 | [öffnen](https://www.netflix.com/title/80020759) |
| 131 | Steel Ball Run: Jojo’s Bizarre Adventure - Phase 2-3 | 11 | 2026 | [öffnen](https://www.netflix.com/title/82116553) |
| 132 | Hellsing Ultimate OVA | 10 | 2006 | [öffnen](https://www.netflix.com/title/80988066) |
| 133 | Ranking of Kings: The Treasure Chest of Courage | 10 | 2023 | [öffnen](https://www.netflix.com/title/81644043) |
| 134 | Cells at Work!! Staffel 2 | 8 | 2021 | [öffnen](https://www.netflix.com/title/81028791) |
| 135 | Devil May Cry | 8 | 2025 | [öffnen](https://www.netflix.com/title/81506915) |
| 136 | Uzumaki | 4 | 2024 | [öffnen](https://www.netflix.com/title/81943371) |
| 137 | 5 Centimeters per Second | 3 | 2007 | [öffnen](https://www.netflix.com/title/70093699) |
| 138 | Meine ganz besondere Hochzeit: Special | 3 | 2026 | [öffnen](https://www.netflix.com/title/82643530) |
| 139 | Ghost in the Shell | 1 | 1995 | [öffnen](https://www.netflix.com/title/540533) |
| 140 | Appleseed | 1 | 2004 | [öffnen](https://www.netflix.com/title/70023531) |
| 141 | Sailor Moon R Movie: Gefährliche Blumen | 1 | 1993 | [öffnen](https://www.netflix.com/title/26588007) |
| 142 | Detektiv Conan: Der Magier des letzten Jahrhunderts | 1 | 1999 | [öffnen](https://www.netflix.com/title/70126871) |
| 143 | Sailor Moon S: Schneeprinzessin Kaguya | 1 | 1994 | [öffnen](https://www.netflix.com/title/80116992) |
| 144 | Detektiv Conan: Die Kreuzung des Labyrinths | 1 | 2003 | [öffnen](https://www.netflix.com/title/81757599) |
| 145 | Ghost in the Shell: Stand Alone Complex - Solid State Society | 1 | 2006 | [öffnen](https://www.netflix.com/title/70071919) |
| 146 | One Piece: Abenteuer in Alabasta - Die Wüstenprinzessin | 1 | 2007 | [öffnen](https://www.netflix.com/title/70086565) |
| 147 | One Piece: Chopper und das Wunder der Winterkirschblüte | 1 | 2008 | [öffnen](https://www.netflix.com/title/80998780) |
| 148 | Clannad: OVA - Das Tomoyo Kapitel | 1 | 2008 | [öffnen](https://www.netflix.com/title/70204963) |
| 149 | Redline | 1 | 2009 | [öffnen](https://www.netflix.com/title/70153298) |
| 150 | Die Reise nach Agartha | 1 | 2011 | [öffnen](https://www.netflix.com/title/80104167) |
| 151 | One Piece Z | 1 | 2012 | [öffnen](https://www.netflix.com/title/80198443) |
| 152 | Girls und Panzer: Der Film | 1 | 2015 | [öffnen](https://www.netflix.com/title/80159876) |
| 153 | One Piece 3D2Y: Überwinde Ace’s Tod! Das Gelübde der Kameraden | 1 | 2014 | [öffnen](https://www.netflix.com/title/81679587) |
| 154 | Dragon Nest: Die Chroniken von Altera | 1 | 2014 | [öffnen](https://www.netflix.com/title/80084763) |
| 155 | Detektiv Conan: Die Sonnenblumen des Infernos | 1 | 2015 | [öffnen](https://www.netflix.com/title/81757600) |
| 156 | A Silent Voice | 1 | 2016 | [öffnen](https://www.netflix.com/title/80223226) |
| 157 | Haikyu!! Movie 1 - Ende und Anfang | 1 | 2015 | [öffnen](https://www.netflix.com/title/80134173) |
| 158 | Haikyu!! Movie 2 - Gewinner und Verlierer | 1 | 2015 | [öffnen](https://www.netflix.com/title/80134174) |
| 159 | No Game No Life Zero | 1 | 2017 | [öffnen](https://www.netflix.com/title/81068687) |
| 160 | Overlord (Movies) | 1 | 2017 | [öffnen](https://www.netflix.com/title/81285994) |
| 161 | Overlord - Der dunkle Held | 1 | 2017 | [öffnen](https://www.netflix.com/title/81285995) |
| 162 | Detektiv Conan: Der purpurrote Liebesbrief | 1 | 2017 | [öffnen](https://www.netflix.com/title/81757605) |
| 163 | Fireworks: Alles eine Frage der Zeit | 1 | 2017 | [öffnen](https://www.netflix.com/title/81000505) |
| 164 | Lu over the Wall | 1 | 2017 | [öffnen](https://www.netflix.com/title/80238911) |
| 165 | Haikyu!! Movie 3 - Talent Und Gespür | 1 | 2017 | [öffnen](https://www.netflix.com/title/81030151) |
| 166 | Haikyu!! Movie 4 - Ein Kampf der Konzepte | 1 | 2017 | [öffnen](https://www.netflix.com/title/81030152) |
| 167 | I Want to Eat Your Pancreas | 1 | 2018 | [öffnen](https://www.netflix.com/title/81037593) |
| 168 | Mirai: Das Mädchen aus der Zukunft | 1 | 2018 | [öffnen](https://www.netflix.com/title/81004268) |
| 169 | Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Arrow of the Orion | 1 | 2019 | [öffnen](https://www.netflix.com/title/81101468) |
| 170 | Okko und ihre Geisterfreunde | 1 | 2018 | [öffnen](https://www.netflix.com/title/81037597) |
| 171 | Children of the Sea | 1 | 2019 | [öffnen](https://www.netflix.com/title/81208104) |
| 172 | The Deer King | 1 | 2022 | [öffnen](https://www.netflix.com/title/81700393) |
| 173 | Mutafukaz | 1 | 2017 | [öffnen](https://www.netflix.com/title/81037697) |
| 174 | Rascal Does Not Dream of a Dreaming Girl | 1 | 2019 | [öffnen](https://www.netflix.com/title/81228006) |
| 175 | Hello World | 1 | 2019 | [öffnen](https://www.netflix.com/title/81295070) |
| 176 | The Legend of Hei: Die Kraft in dir | 1 | 2019 | [öffnen](https://www.netflix.com/title/81427481) |
| 177 | Demon Slayer: Kimetsu no Yaiba - The Movie: Mugen Train | 1 | 2020 | [öffnen](https://www.netflix.com/title/81410810) |
| 178 | Josie, der Tiger und die Fische | 1 | 2020 | [öffnen](https://www.netflix.com/title/81508630) |
| 179 | Belle | 1 | 2021 | [öffnen](https://www.netflix.com/title/81492822) |
| 180 | The First Slam Dunk | 1 | 2022 | [öffnen](https://www.netflix.com/title/81765372) |
| 181 | Jujutsu Kaisen 0 | 1 | 2021 | [öffnen](https://www.netflix.com/title/81602834) |
| 182 | Overlord: The Sacred Kingdom | 1 | 2024 | [öffnen](https://www.netflix.com/title/82040442) |
| 183 | Detektiv Conan: Die Halloween-Braut | 1 | 2022 | [öffnen](https://www.netflix.com/title/81757621) |
| 184 | Blue Giant | 1 | 2023 | [öffnen](https://www.netflix.com/title/81763062) |
| 185 | Rascal Does Not Dream of a Sister Venturing Out | 1 | 2023 | [öffnen](https://www.netflix.com/title/81765074) |
| 186 | Spy × Family Code: White | 1 | 2023 | [öffnen](https://www.netflix.com/title/81924850) |
| 187 | Resident Evil: Death Island | 1 | 2023 | [öffnen](https://www.netflix.com/title/81714596) |
| 188 | Fool Night | — | 2026 | [öffnen](https://www.netflix.com/title/81991076) |
