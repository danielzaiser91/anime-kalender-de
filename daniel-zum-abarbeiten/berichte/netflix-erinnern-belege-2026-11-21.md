# Netflix-Handbelege aus dem „Erinnern“-Knopf (21.11.2026)

Stand: `origin/main` d7f7c4eef, `data/dub-confirmed.yaml`. Zählbasis: Einträge mit `platform: netflix` und `available: false` (390 von 1413 Netflix-Zeilen), davon die Gruppe „Titelseite ohne abspielbare Folge“.

## 1. Menge

- **141 sichere Erinnern-Belege** (Notiz enthält „nur „Erinnern““; alle `checkedAt` 21.08.–21.10.2026, aus den Browser-Meldungen der Erweiterung vor der Änderung vom 18.11.2026, wo „Erinnern ohne Termin“ zu „angekündigt“ wurde; 140 verschiedene Kennungen).
- **2 unsichere** (Notiz nur „Titelseite ohne abspielbare Folge“ ohne „Erinnern“): eigene Liste unten, nicht in der Korrektur.
- Nicht Teil dieser Menge: 185 Belege „Umleitung auf Startseite“ vom 17./18.11. (Durchgang, Anmeldung nötig), 30 „toter Verweis / leitet auf die Startseite um“, die übrigen Staffel-, Notiz- und Leerbelege (zusammen 390 Zeilen mit `available: false`).

Erkennung: Notiztext `Titelseite ohne abspielbare Folge — nur „Erinnern"` (feste Zeichenkette, vom Abholweg der Erweiterung erzeugt). Kein weiteres Feld unterscheidet sie (ohne `url` bis auf 4, ohne `dub`).

## 2. Heutiger Stand je Quelle (offline, Zählung über alle 141)

- JustWatch (`data/justwatch-audio.json`, geprüft 09.–19.11.): Netflix-Angebot (FLATRATE) bei **1** Kennung (112153), und das ist die Franchise-Seite „Pokemon“ (Staffel 1, 102 Folgen, Indigo League), nicht „Reisen“: **kein Beleg**. 142 ohne Netflix-Angebot.
- TMDB-Cache (`data/tmdb-titles.json`): Netflix unter den DE-Anbietern bei **0**; 86 haben andere Anbieter, 19 sind TMDB-Fehltreffer (`miss`), Rest ohne Anbieterliste. Live-TMDB-Abruf: nicht gefahren, kein Zugang zum Schlüssel in dieser Sitzung (offen).
- MOTN (`data/motn.json`/`motn-links.json`): Netflix-Eintrag bei 6 Kennungen, alle falsch zugeordnet (Fate/Zero statt First Order, Naruto-Serie statt Film, Pokémon 1997 für drei Pokémon-Staffeln, Takagi-san 2024 statt Season 2): **kein Beleg**.
- aniSearch-Listung (`streams` mit Netflix-Adresse): 13 Kennungen, davon 13 ohne jüngeren Netflix-Beleg. Das ist eine Listung, kein heutiger Stand (siehe Tabelle).
- Netflix-Titelseiten: nicht abgerufen (Projektregel).

## 3. Stichprobe (5 Titel von Hand)

Fünf Titel einzeln gegen alle Quellen im Repo gelesen (Stand der Dateien: JustWatch 07.–19.11., TMDB-Cache 19.10.–16.11., link-check 02.–04.11.):

| Kennung | Titel | JustWatch DE (Anbieter) | TMDB-Cache DE | aniSearch-Listung / link-check | Urteil |
|---|---|---|---|---|---|
| 47 | Akira | Joyn, Magenta, Kauf/Leihe; **kein Netflix** | Prime, Kauf/Leihe; kein Netflix | `netflix.com/title/60021103`, 200 am 02.11. | kein Beleg für Verfügbarkeit; Seite existiert |
| 1943 | Paprika | nur Kauf/Leihe; **kein Netflix** | Prime, Kauf; kein Netflix | `title/70065105`, 200 am 02.11. | wie oben |
| 481 | Yu-Gi-Oh! | Disney+, RTL+, Pluto, Toggo, Amazon-Channels; **kein Netflix** | Disney+, RTL+, Prime, Crunchyroll; kein Netflix | `title/70177034`, link-check ungemessen | Erinnern am 18.11. durch Daniels Durchgang-Bericht bestätigt (`docs/wissen/erweiterung.md`, Abschnitt 18.11.2026, „Anlass: Daniels Bericht 09:42“) = Stand „angekündigt“ |
| 112153 | Pokémon Journeys | Netflix-Treffer gehört zur Franchise-Seite „Pokemon“ (Staffel 1, 102 Folgen, Indigo League), nicht zu „Reisen“ | TMDB-Fehltreffer (`miss`) | `title/81291575`, ungemessen | **falscher Treffer**, kein Beleg |
| 106286 | Weathering With You | nur Kauf/Leihe; kein Netflix | nur Prime, Kauf/Leihe; kein Netflix | `title/81172898`, 200 am 04.11. | kein Beleg |

Ergebnis der Stichprobe: Keine der beiden Preisquellen (JustWatch, TMDB) führt bei diesen fünf Titeln ein Netflix-Angebot, und „angekündigt“ kann keine der beiden ausdrücken. Alles, was für Netflix spricht, ist die aniSearch-Listung samt link-check-Status 200 (Seite existiert), und der August-Befund „nur Erinnern“ passt dazu: Netflix kennt die Titelseite, bietet aber (noch) keine Folge an.

## 4. Liste der 141 sicheren Belege

| Kennung | Titel | Datum | JustWatch Netflix | TMDB-DE-Anbieter | aniSearch-Netflix (link-check) | jüngerer Netflix-Beleg |
|---|---|---|---|---|---|---|
| 112153 | Pokémon Journeys: The Series | 2026-08-21 | ja (Franchise-Seite, falscher Treffer) | – | https://www.netflix.com/search?q=pokemon&jbv=81291578 https://www.netflix.com/title/81291575 ?,? | – |
| 6707 | Black Butler II | 2026-08-22 | nein | – | – | – |
| 9136 | Black Butler II OVA | 2026-08-22 | nein | – | – | – |
| 179054 | Black Butler: Emerald Witch Arc | 2026-08-22 | nein | – | – | – |
| 20617 | Ronja, the Robber's Daughter | 2026-08-22 | nein | primevideo,Viaplay Amazon Channel,Apple TV Store | – | – |
| 1575 | Code Geass: Lelouch of the Rebellion | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 2904 | Code Geass: Lelouch of the Rebellion R2 | 2026-08-22 | nein | – | – | – |
| 4654 | A Certain Magical Index | 2026-08-22 | nein | crunchyroll,Crunchyroll,Crunchyroll Amazon Channel | – | – |
| 8937 | A Certain Magical Index II | 2026-08-22 | nein | – | – | – |
| 6213 | A Certain Scientific Railgun | 2026-08-22 | nein | crunchyroll,Crunchyroll,Crunchyroll Amazon Channel | – | – |
| 16049 | A Certain Scientific Railgun S | 2026-08-22 | nein | – | – | – |
| 5081 | Bakemonogatari | 2026-08-22 | nein | crunchyroll,adn,primevideo,Crunchyroll,Animation Digital Network,Anime Digital Network Amazon Channel | – | – |
| 384 | Gantz | 2026-08-22 | nein | primevideo,adn,Amazon Prime Video,Amazon Prime Video with Ads,Aniverse Amazon Channel,Animation Digital Network,Anime Digital Network Amazon Channel | – | – |
| 395 | Gantz: Second Stage | 2026-08-22 | nein | primevideo,adn,Amazon Prime Video,Amazon Prime Video with Ads,Aniverse Amazon Channel,Animation Digital Network,Anime Digital Network Amazon Channel | – | – |
| 20923 | Food Wars! | 2026-08-22 | nein | crunchyroll,Crunchyroll,Crunchyroll Amazon Channel | – | – |
| 21518 | Food Wars! The Second Plate | 2026-08-22 | nein | – | – | – |
| 99255 | Food Wars! The Third Plate | 2026-08-22 | nein | – | – | – |
| 109963 | Food Wars! The Fourth Plate | 2026-08-22 | nein | – | – | – |
| 20458 | The Irregular at Magic High School | 2026-08-22 | nein | primevideo,crunchyroll,Amazon Prime Video,Crunchyroll,Amazon Prime Video with Ads,Aniverse Amazon Channel,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 112300 | The Irregular at Magic High School: Visitor Arc | 2026-08-22 | nein | – | – | – |
| 116674 | BLEACH: Thousand-Year Blood War | 2026-08-22 | nein | – | – | – |
| 14467 | K | 2026-08-22 | nein | – | – | – |
| 47 | Akira | 2026-08-22 | nein | primevideo,Apple TV Store,Amazon Video,YouTube,Sky Store,Rakuten TV | https://www.netflix.com/title/60021103 200@2026-11-02 | – |
| 6547 | Angel Beats! | 2026-08-22 | nein | – | – | – |
| 99629 | Angels of Death | 2026-08-22 | nein | joyn,primevideo,Joyn Plus,Aniverse Amazon Channel,ProSieben Fun Amazon Channel,Seven Entertainment Amazon Channel,Magenta TV+ | – | – |
| 20786 | Appleseed Alpha | 2026-08-22 | nein | primevideo,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Rakuten TV,Videoload | https://www.netflix.com/title/70307393 200@2026-11-02 | – |
| 100248 | Batman Ninja | 2026-08-22 | nein | primevideo,Apple TV Store,Amazon Video,YouTube,MagentaTV,maxdome Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 10218 | Berserk: The Golden Age Arc I - The Egg of the King | 2026-08-22 | nein | – | – | – |
| 12113 | Berserk: The Golden Age Arc II - The Battle for Doldrey | 2026-08-22 | nein | – | – | – |
| 12115 | Berserk: The Golden Age Arc III - The Advent | 2026-08-22 | nein | – | – | – |
| 5962 | Beyblade: Metal Fusion | 2026-08-22 | nein | primevideo,Amazon Prime Video,Amazon Prime Video with Ads,Amazon Video | – | – |
| 10259 | Big Fish & Begonia | 2026-08-22 | nein | primevideo,ArthouseCNMA,Arthouse CNMA Amazon Channel,Apple TV Store,Amazon Video,YouTube,MagentaTV,maxdome Store,Sky Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 889 | Black Lagoon | 2026-08-22 | nein | – | – | – |
| 1519 | Black Lagoon: The Second Barrage | 2026-08-22 | nein | – | – | – |
| 4901 | Black Lagoon: Roberta's Blood Trail | 2026-08-22 | nein | – | – | – |
| 20727 | Blood Blockade Battlefront | 2026-08-22 | nein | primevideo,Aniverse Amazon Channel,Amazon Video | – | – |
| 97886 | Blood Blockade Battlefront & Beyond | 2026-08-22 | nein | – | – | – |
| 21861 | Blue Exorcist: Kyoto Saga | 2026-08-22 | nein | – | – | – |
| 11737 | Blue Exorcist: The Movie | 2026-08-22 | nein | – | – | – |
| 21220 | Boruto: Naruto the Movie | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Sky Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 20997 | Charlotte | 2026-08-22 | nein | – | – | – |
| 21231 | Cyborg 009 vs Devilman | 2026-08-22 | nein | – | – | – |
| 87481 | (ohne title) | 2026-08-22 | nein | – | – | – |
| 105190 | Darwin's Game | 2026-08-22 | nein | crunchyroll,Crunchyroll,Crunchyroll Amazon Channel | – | – |
| 7088 | Demon King Daimao | 2026-08-22 | nein | crunchyroll,adn,Crunchyroll,Animation Digital Network,Akibapass | – | – |
| 20931 | Death Parade | 2026-08-22 | nein | adn,primevideo,Animation Digital Network,Anime Digital Network Amazon Channel,Amazon Video | – | – |
| 99531 | Devils' Line | 2026-08-22 | nein | – | – | – |
| 3576 | Dinosaur King | 2026-08-22 | nein | – | – | – |
| 6746 | Durarara!! | 2026-08-22 | nein | crunchyroll,Crunchyroll,Crunchyroll Amazon Channel | – | – |
| 21123 | DRIFTERS | 2026-08-22 | nein | – | – | – |
| 21234 | ERASED | 2026-08-22 | nein | primevideo,Aniverse Amazon Channel | – | – |
| 98035 | Fate/Apocrypha | 2026-08-22 | nein | – | https://www.netflix.com/title/80180849 200@2026-11-02 | – |
| 21717 | Fate/EXTRA Last Encore | 2026-08-22 | nein | – | https://www.netflix.com/title/80185145 200@2026-11-02 | – |
| 97815 | Fate/Grand Order: First Order | 2026-08-22 | nein | – | – | – |
| 18507 | Free! -Iwatobi Swim Club- | 2026-08-22 | nein | crunchyroll,adn,primevideo,Crunchyroll,Animation Digital Network,Crunchyroll Amazon Channel,Akibapass,Amazon Video | – | – |
| 20614 | Free! -Eternal Summer- | 2026-08-22 | nein | crunchyroll,adn,primevideo,Crunchyroll,Animation Digital Network,Crunchyroll Amazon Channel,Akibapass,Amazon Video | – | – |
| 121 | Fullmetal Alchemist | 2026-08-22 | nein | primevideo,Amazon Prime Video,Amazon Prime Video with Ads,Aniverse Amazon Channel,Amazon Video | – | – |
| 5114 | Fullmetal Alchemist: Brotherhood | 2026-08-22 | nein | rtlplus,primevideo,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Amazon Video | – | – |
| 21496 | Gantz:O | 2026-08-22 | nein | – | – | – |
| 14131 | Girls und Panzer | 2026-08-22 | nein | primevideo,Amazon Prime Video,Amazon Prime Video with Ads,Aniverse Amazon Channel,Amazon Video | – | – |
| 12191 | Glitter Force | 2026-08-22 | nein | – | – | – |
| 16419 | Glitter Force Doki Doki | 2026-08-22 | nein | – | – | – |
| 20849 | God Eater | 2026-08-22 | nein | primevideo,Aniverse Amazon Channel,Amazon Video | – | – |
| 101165 | GOBLIN SLAYER | 2026-08-22 | nein | primevideo,Amazon Prime Video,Amazon Prime Video with Ads,Aniverse Amazon Channel,Amazon Video | – | – |
| 21361 | Granblue Fantasy: The Animation | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll,Aniverse Amazon Channel,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 10793 | Guilty Crown | 2026-08-22 | nein | – | – | – |
| 10719 | Haganai | 2026-08-22 | nein | primevideo,Amazon Prime Video,Amazon Prime Video with Ads,Aniverse Amazon Channel,Amazon Video | – | – |
| 14967 | Haganai NEXT | 2026-08-22 | nein | – | – | – |
| 6867 | Halo Legends | 2026-08-22 | nein | – | – | – |
| 8074 | High School of the Dead | 2026-08-22 | nein | adn,primevideo,Animation Digital Network,Anime Digital Network Amazon Channel | – | – |
| 11061 | Hunter x Hunter (2011) | 2026-08-22 | nein | primevideo,rtlplus,Amazon Prime Video,Amazon Prime Video with Ads,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Amazon Video | – | – |
| 13271 | Hunter x Hunter: Phantom Rouge | 2026-08-22 | nein | – | – | – |
| 19951 | Hunter x Hunter: The Last Mission | 2026-08-22 | nein | primevideo,Amazon Video | – | – |
| 21683 | I Want to Deliver Your Voice | 2026-08-22 | nein | – | – | – |
| 249 | InuYasha | 2026-08-22 | nein | crunchyroll,rtlplus,primevideo,Crunchyroll,RTL+,RTL+ Max Amazon Channel,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 450 | InuYasha the Movie 2: The Castle Beyond the Looking Glass | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 451 | InuYasha the Movie 3: Swords of an Honorable Ruler | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 449 | InuYasha the Movie 4: Fire on the Mystic Island | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 452 | InuYasha the Movie: Affections Touching Across Time | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 97922 | INUYASHIKI LAST HERO | 2026-08-22 | nein | – | – | – |
| 8841 | Is this a Zombie? | 2026-08-22 | nein | primevideo,Aniverse Amazon Channel,Amazon Video | – | – |
| 9260 | Kizumonogatari Part 1: Tekketsu | 2026-08-22 | nein | adn,Animation Digital Network | – | – |
| 21377 | Kuroko's Basketball: Last Game | 2026-08-22 | nein | primevideo,Aniverse Amazon Channel | – | – |
| 20628 | Legend of the Galactic Heroes: Die Neue These | 2026-08-22 | nein | primevideo,Aniverse Amazon Channel | – | – |
| 21394 | Magi: Adventure of Sinbad | 2026-08-22 | nein | – | – | – |
| 14513 | Magi: The Labyrinth of Magic | 2026-08-22 | nein | crunchyroll,Crunchyroll,Crunchyroll Amazon Channel | – | – |
| 20790 | Magic Kaito 1412 | 2026-08-22 | nein | crunchyroll,adn,primevideo,Crunchyroll,Animation Digital Network,Anime Digital Network Amazon Channel,Akibapass,Amazon Video | – | – |
| 100298 | Megalobox | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll,Crunchyroll Amazon Channel,Amasia+ Amazon Channel,Apple TV Store,Amazon Video,maxdome Store,Freenet meinVOD | – | – |
| 2472 | Naruto Shippuden the Movie | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Videoload,Freenet meinVOD | – | – |
| 10589 | Naruto Shippuden the Movie: Blood Prison | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 4437 | Naruto Shippuden the Movie: Bonds | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Videoload,Freenet meinVOD | – | – |
| 8246 | Naruto Shippuden the Movie: The Lost Tower | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 6325 | Naruto Shippuden the Movie: The Will of Fire | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 2144 | Naruto the Movie: Guardians of the Crescent Moon Kingdom | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 936 | Naruto the Movie: Legend of the Stone of Gelel | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 442 | Naruto the Movie: Ninja Clash in the Land of Snow | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Videoload,Freenet meinVOD | – | – |
| 19815 | No Game, No Life | 2026-08-22 | nein | primevideo,Aniverse Amazon Channel,Amazon Video | – | – |
| 21128 | Noragami Aragoto | 2026-08-22 | nein | – | – | – |
| 20832 | Overlord | 2026-08-22 | nein | primevideo,Amazon Prime Video,Amazon Prime Video with Ads,Aniverse Amazon Channel,Amazon Video | – | – |
| 110364 | Pac-Man and the Ghostly Adventures | 2026-08-22 | nein | primevideo,Amazon Prime Video,Amazon Prime Video with Ads,Amazon Video | https://www.netflix.com/de/title/80000139 200@2026-11-02 | – |
| 1943 | Paprika | 2026-08-22 | nein | primevideo,Apple TV Store,Amazon Video,YouTube | https://www.netflix.com/title/70065105 200@2026-11-02 | – |
| 98298 | Pokémon the Movie: I Choose You! | 2026-08-22 | nein | rtlplus,primevideo,RTL+,Apple TV Store,Amazon Video,YouTube | – | – |
| 100744 | Pokémon the Movie: The Power of Us | 2026-08-22 | nein | rtlplus,primevideo,RTL+,Apple TV Store,Amazon Video,YouTube | – | – |
| 158870 | Pokémon: To Be a Pokémon Master: Ultimate Journeys: The Series | 2026-08-22 | nein | – | https://www.netflix.com/title/81706101 200@2026-11-04 | – |
| 13601 | PSYCHO-PASS | 2026-08-22 | nein | primevideo,crunchyroll,Amazon Prime Video,Crunchyroll,Amazon Prime Video with Ads,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 20513 | PSYCHO-PASS 2 | 2026-08-22 | nein | – | – | – |
| 20514 | PSYCHO-PASS: The Movie | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 9756 | Puella Magi Madoka Magica | 2026-08-22 | nein | adn,primevideo,Animation Digital Network,Anime Digital Network Amazon Channel,Apple TV Store,Amazon Video,maxdome Store,Freenet meinVOD | – | – |
| 97768 | Record of Grancrest War | 2026-08-22 | nein | crunchyroll,Crunchyroll,Crunchyroll Amazon Channel | – | – |
| 13667 | Road to Ninja: Naruto the Movie | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Sky Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 20993 | Seraph of the End: Battle in Nagoya | 2026-08-22 | nein | – | – | – |
| 101361 | Sirius the Jaeger | 2026-08-22 | nein | – | – | – |
| 100183 | Sword Art Online Alternative: Gun Gale Online | 2026-08-22 | nein | crunchyroll,adn,primevideo,Crunchyroll,Animation Digital Network,Anime Digital Network Amazon Channel,Crunchyroll Amazon Channel | – | – |
| 107068 | Teasing Master Takagi-san Season 2 | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll,Aniverse Amazon Channel,Amazon Video | – | – |
| 20968 | The Anthem of the Heart | 2026-08-22 | nein | – | – | – |
| 21131 | The Asterisk War | 2026-08-22 | nein | primevideo,Aniverse Amazon Channel,Amazon Video | – | – |
| 20981 | The Boy and the Beast | 2026-08-22 | nein | rtlplus,primevideo,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Sky Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 16782 | The Garden of Words | 2026-08-22 | nein | Apple TV Store | – | – |
| 16870 | The Last: Naruto the Movie | 2026-08-22 | nein | wow,rtlplus,primevideo,WOW,Sky Go,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Wow Fiction Amazon Channel,Apple TV Store,Amazon Video,MagentaTV,maxdome Store,Sky Store,Videoload,Freenet meinVOD | – | – |
| 13759 | The Pet Girl of Sakurasou | 2026-08-22 | nein | – | – | – |
| 20605 | Tokyo Ghoul | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 20850 | Tokyo Ghoul √A | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll Amazon Channel,Amazon Video | – | – |
| 100240 | Tokyo Ghoul:re | 2026-08-22 | nein | – | – | – |
| 102351 | Tokyo Ghoul:re 2 | 2026-08-22 | nein | – | – | – |
| 4224 | Toradora! | 2026-08-22 | nein | – | – | – |
| 21188 | Undefeated Bahamut Chronicle | 2026-08-22 | nein | adn,primevideo,Animation Digital Network,Anime Digital Network Amazon Channel | – | – |
| 106286 | Weathering With You | 2026-08-22 | nein | primevideo,Apple TV Store,Amazon Video,YouTube,MagentaTV,maxdome Store,Sky Store,Rakuten TV,Videoload,Freenet meinVOD | https://www.netflix.com/title/81172898 200@2026-11-04 | – |
| 6918 | Wolverine | 2026-08-22 | nein | primevideo,Apple TV Store,Amazon Video | – | – |
| 6919 | X-Men | 2026-08-22 | nein | maxdome Store | – | – |
| 19157 | Yo-kai Watch | 2026-08-22 | nein | – | – | – |
| 21519 | Your Name. | 2026-08-22 | nein | crunchyroll,primevideo,Crunchyroll,JustWatch TV Plus,ArthouseCNMA,Arthouse CNMA Amazon Channel,Crunchyroll Amazon Channel,Apple TV Store,Amazon Video,YouTube,MagentaTV,maxdome Store,Sky Store,Rakuten TV,Videoload,Freenet meinVOD | – | – |
| 9989 | AnoHana: Die Blume, die wir an jenem Tag sahen | 2026-08-26 | nein | primevideo,Aniverse Amazon Channel | – | 2026-10-21 weg |
| 9989 | AnoHana: Die Blume, die wir an jenem Tag sahen | 2026-08-26 | nein | primevideo,Aniverse Amazon Channel | – | 2026-10-21 weg |
| 4898 | Black Butler | 2026-08-30 | nein | crunchyroll,Crunchyroll,Crunchyroll Amazon Channel | – | – |
| 18679 | Kill La Kill | 2026-08-30 | nein | crunchyroll,Crunchyroll,Crunchyroll Amazon Channel | – | – |
| 205 | Samurai Champloo | 2026-08-30 | nein | – | – | – |
| 21403 | Sword Art Online The Movie: Ordinal Scale | 2026-08-30 | nein | crunchyroll,adn,primevideo,Crunchyroll,Animation Digital Network,Anime Digital Network Amazon Channel,Crunchyroll Amazon Channel | https://www.netflix.com/title/80180071 200@2026-11-09 | – |
| 158869 | Pokémon: Blauer Himmel in der Ferne! | 2026-08-30 | nein | – | https://www.netflix.com/title/81706101 200@2026-11-04 | – |
| 131520 | The Quintessential Quintuplets Movie | 2026-10-21 | nein | crunchyroll,primevideo,Crunchyroll,Crunchyroll Amazon Channel,Amazon Video,maxdome Store,Freenet meinVOD | https://www.netflix.com/title/81717895 200@2026-11-04 | – |
| 97634 | Pokémon: Die TV-Serie - Sonne & Mond | 2026-10-21 | nein | – | – | – |
| 481 | Yu-Gi-Oh! | 2026-10-21 | nein | disneyplus,rtlplus,primevideo,crunchyroll,Disney Plus,RTL+,RTL+ Max Amazon Channel,Aniverse Amazon Channel,Anime Digital Network Amazon Channel,Crunchyroll Amazon Channel,Amazon Video | https://www.netflix.com/title/70177034 ? | – |

## 5. Unsichere (nicht in der Korrektur)

| Kennung | Titel | Datum | Notiz |
|---|---|---|---|
| 21236 | Beyblade Burst | 2026-08-22 | Titelseite ohne abspielbare Folge |
| 232 | Cardcaptor Sakura | 2026-08-22 | Titelseite ohne abspielbare Folge |

## 6. Schnellweg: was ein Entfernen bewirkte (ohne Änderung im PR)

Aufruf: `npx tsx <scratchpad>/ne-kb/schnell.mts <Worktree> vorher|nachher` (je ein Prozess; Kulisse mit `AK_ROOT`, `ladeHandbelege` → `neinHandbelege` → `wegVerneint('netflix', Kennung, Adresse)`; „nachher“ = dieselbe Datei ohne die 141 Zeilen, nur in der Wegwerf-Kulisse).

| | vorher (heute) | nachher (141 Zeilen entfernt) |
|---|---|---|
| Titel mit Netflix-Plattformsperre durch Handbeleg (140 Kennungen im Test) | 140 | 4 (andere, jüngere Netflix-Belege) |
| aniSearch-Netflix-Adressen dieser Titel gesperrt | 13 von 13 | 2 von 13 |

Entsperrt würden also höchstens **11 Netflix-Wege** (aniSearch-Listung, Seite 200 am 02.–09.11.): Akira, Appleseed Alpha, Fate/Apocrypha, Fate/EXTRA Last Encore, Pac-Man, Paprika, Pokémon Journeys, Pokémon Ultimate Journeys, Pokémon Blauer Himmel, Weathering With You, SAO Ordinal Scale (Kennungen in Abschnitt 4, Spalte aniSearch). Gesperrt bleiben vier Titel (AnoHana 9989, Quintuplets Movie 131520, Pokémon Sonne & Mond 97634, Yu-Gi-Oh! 481), weil für sie ein jüngerer Netflix-Beleg vom 21.10. („toter Verweis“ bzw. weiterer Erinnern-Beleg mit Adresse) steht; zwei davon (481, 131520) tragen eine aniSearch-Netflix-Adresse. Die übrigen rund 129 Titel hätten auch ohne Totbeleg keinen Netflix-Weg: weder JustWatch, TMDB noch aniSearch nennen dort Netflix. Der Bau selbst (`data:build`) wurde nicht gefahren; die Zahl misst nur die Sperre, nicht die Wege im fertigen Datensatz (Sprachangabe „?“ und weitere Filter folgen danach).

## 7. Entscheidung dieses PR

- **`data/dub-confirmed.yaml` bleibt unverändert.** Nach dem Wortlaut „Korrektur nur, wo eine Quelle es belegt“ gibt es keinen heutigen Beleg für „verfügbar“ oder „angekündigt“: JustWatch und TMDB führen für keine der 141 Kennungen ein passendes Netflix-Angebot (der eine JustWatch- und die sechs MOTN-Treffer sind Fehlzuordnungen auf andere Werke), „angekündigt“ können diese Quellen nicht ausdrücken, Netflix-Titelseiten dürfen wir nicht abrufen.
- **Der Totbeleg ist trotzdem dem Wortlaut nach falsch:** „available: false“ heißt „gibt es dort gar nicht“, die Notiz belegt nur „Erinnern“, und seit 18.11. gilt „Erinnern ohne Termin = angekündigt“. Für Yu-Gi-Oh!, Pokémon Sonne & Mond, Quintessential Quintuplets Movie und AnoHana liegt zudem ein Erinnern-Bericht vom 18.11. vor (Daniel, `docs/wissen/erweiterung.md`).
- **Offen für die startende Sitzung (Empfehlung: ja):** Block-Rücknahme der 141 Zeilen nach dem Muster „Zurückgenommen am 10.09.2026“ in der YAML (Kopfkommentar mit Grund, Zeilen entfernen, `belege-entfernt.yaml` prüfen, `check:handbelege`). Wirkung nach Abschnitt 6: 11 Netflix-Wege kämen zurück, sonst nichts. Gegenargument: Der Zustand „angekündigt“ wäre weiter unsichtbar (die Seite hat kein Feld dafür), und die 11 Wege zeigten eine Seite ohne abspielbare Folge. Ob das als Gewinn zählt, entscheidet nicht der Bauer.
- Die 2 unsicheren und die Belege mit jüngerem Umleitungs-Beleg (AnoHana) bleiben in jedem Fall.
- Offen: Live-TMDB-Abruf (kein Schlüsselzugang in dieser Sitzung); Netflix-Seiten (Projektregel); Cyborg 009 vs Devilman (21231) ist nicht im Datensatz (`titles.json`), Beleg trifft ins Leere.
