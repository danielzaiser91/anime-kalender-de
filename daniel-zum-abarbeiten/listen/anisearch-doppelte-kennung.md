# aniSearch: dieselbe Kennung bei mehreren Titeln — Fraglich

Stand 2026-10-12. Gemessen an `public/data/titles.json`: **42 Kennungen, 117 Titel**; alle 42 sind gewollt (Handdatei bindet sie, aniSearch führt Filmreihen und Serie samt Special auf einer Seite).
Nichts davon ist geändert. Hier stehen die Fälle, die nicht eindeutig belegt sind. Quelle: lokale Archivseiten `data/anisearch-raw/<Kennung>.html.gz`, kein Abruf.
**Stand 13.10.2026 (die drei Fraglichen, Beleg in `docs/wissen/datensatz.md` und `berichte/live-messung-rest-2026-10-13.md`):** Durarara!! Specials (8408) entfällt als Sammeleintrag (Regel „Teilung“, Daniel 13.10.: Crunchyroll-Beleg an Tenka Taihei 6986); Tachikoma 2005 und Afro Samurai Movie bleiben bei Dominiks Bindung — keine aniSearch-Seite trägt ihre MAL, nichts widerlegt. Die fünf „vorübergehend doppelten“ Paare unten sind geheilt.

## Titel, deren Seite nicht sicher zu ihnen passt

| Titel (AniList-Kennung) | Jahr | Umfang | aniSearch-Seite | Grund |
|---|---|---|---|---|
| Ghost in the Shell SAC: The Laughing Man – Tachikoma no Hibi (10947) | 2005 | 1 Folge | 4405 („Bonus, 26", 2002–2003) | Jahr und Folgenzahl der Seite passen nicht zum Titel; ein eigener Eintrag für das Special aus 2005 ist lokal nicht zu sehen (Seite nicht abgerufen). |
| AFRO SAMURAI Movie (13709) | 2007 | 1 Film | 1119 (Serie, 5 Folgen) | Zusammenschnitt der Serie; aniSearch führt dazu keine eigene Film-Seite (nur „Resurrection" und „Pilot Film" in den Beziehungen). Vermutlich richtig, nur nicht belegt. |

## Vorübergehend doppelt (heilt beim nächsten Abruf, nachmessen)

Dieselbe Kennung steht in `titles.json` (aniSearch-Zeile mit Deutsch) und in `ohne-synchro.json` (AniList-Titel). `data/anisearch-dubs.json` führt die AniList-Titel seit 12.10. 05:30 mit `d`; `fetch.ts` holt sie dann ins Hauptbestand (`ausAnisearchDubs`), die Zeile entfällt. Bleibt das Paar nach dem nächsten Datenlauf stehen, gehört es in `data/anisearch-ids-hand.yaml`.

| Titel | Jahr | Umfang | Zeile / AniList | aniSearch |
|---|---|---|---|---|
| BeyWheelz | 2012 | TV, 13 | 10014517 / 136668 | 14517 |
| Spycies: Zwei tierisch coole Agenten | 2020 | Film | 10014868 / 163696 | 14868 |
| Titipo Titipo 2 | 2019 | TV, 26 | 10017355 / 188067 | 17355 |
| Rick and Morty: The Anime | 2024 | TV, 10 | 10019445 / 150103 | 19445 |
| Der Herr der Ringe: Die Schlacht der Rohirrim | 2024 | Film | 10019566 / 185613 | 19566 |

## Eine MAL-Kennung, mehrere aniSearch-Seiten (13.10.2026)

Befund und Regel „Teilung“ stehen an einer Stelle: `docs/wissen/datensatz.md`, Abschnitt „Eine MAL-Kennung, mehrere aniSearch-Seiten“. Hier die Messung für den ganzen Datensatz.

<!-- mal-mehrfach:anfang -->
Stand 2026-10-13, gemessen an `data/anisearch-eintraege.json`, `public/data/titles.json`, `public/data/ohne-synchro.json` (kein Abruf). Erzeugt mit `node tools/anisearch-mal-mehrfach.mjs --schreiben`.

**79 MAL-Kennungen** tragen zwei oder mehr aniSearch-Seiten (216 Seiten).

| Art | Gruppen | davon im Hauptbestand |
|---|---|---|
| teilung-voll: AniList fasst zusammen, aniSearch teilt (Summe der Seiten = Folgen des Titels) | 19 | 3 |
| teilung-teil: Special/Bonus unter der MAL einer größeren Einheit (Summe passt nicht oder mehrere Titel) | 16 | 5 |
| ohne-anilist: kein AniList-Titel mit dieser MAL im Bestand; jede Seite eine eigene Zeile | 29 | 2 |
| getrennt: jede Seite hat ihren eigenen AniList-Titel | 15 | 0 |

### teilung-voll

| MAL | Seite (erste) | AniList-Titel (Folgen, Ort) | aniSearch-Seiten (Folgen, dt. = Deutsch, [Zeile im Ort], ← getragen von) | Σ Folgen |
|---|---|---|---|---|
| 8408 | Durarara!!: Tenmou Kaikai | 8408 (2 F., Hauptbestand) | 6984: 1 dt. [Hauptbestand] Beleg; 6986: 1 dt. [Hauptbestand] Beleg | 2 |
| 9062 | Angel Beats! Stairway to Heaven | 9062 (2 F., Hauptbestand) | 6864: 1 dt. [Hauptbestand] Beleg; 10510: 1 [Katalog] | 2 |
| 34325 | Pocket Monsters XY & Z: XYZ no Denset… | 106499 (2 F., Hauptbestand) | 11938: 1 dt. [Hauptbestand] Beleg; 11939: 1 [Katalog] | 2 |
| 1236 | SF Saiyuuki Starzinger | 1236 (73 F., Katalog) | 84: 64 ← 1236; 1032: 9 [Katalog] | 73 |
| 2458 | Kimagure Orange Road: Wagahai wa Neko… | 2458 (8 F., Katalog) | 341: 1 [Katalog]; 391: 1 [Katalog]; 1641: 1 [Katalog]; 2129: 1 [Katalog]; 2636: 1 [Katalog]; 2989: 1 [Katalog]; … (8 Seiten) | 8 |
| 6864 | xxxHOLiC Rou | 6864 (2 F., Katalog) | 5573: 1 ← 6864; 6940: 1 [Katalog] | 2 |
| 9982 | Fairy Tail: Youkoso Fairy Hills!! | 9982 (5 F., Katalog) | 6666: 1 ← 9982; 7079: 1 [Katalog]; 7695: 1 [Katalog]; 8291: 1 [Katalog]; 8811: 1 [Katalog] | 5 |
| 10497 | Hetalia World Series Extra Episodes | 10497 (4 F., Katalog) | 7876: 3 ← 10497; 8997: 1 [Katalog] | 4 |
| 13159 | Kuromajo-san ga Tooru!! | 13159 (60 F., Katalog) | 7656: 32 ← 13159; 8575: 28 [Katalog] | 60 |
| 24471 | Hoozuki no Reitetsu OAD | 20732 (4 F., Katalog) | 10009: 3 ← 20732; 12685: 1 [Katalog] | 4 |
| 26123 | Seitokai Yakuindomo * OVA | 20826 (10 F., Katalog) | 9884: 6 ← 20826; 14686: 4 [Katalog] | 10 |
| 32930 | Fairy Tail: Yousei-tachi no Batsu Game | 150078 (3 F., Katalog) | 11479: 1 [Katalog]; 11551: 1 [Katalog]; 11552: 1 [Katalog] | 3 |
| 32956 | Aware! Meisaku-kun | 21727 (230 F., Katalog) | 11255: 39 ← 21727; 15455: 39 [Katalog]; 15460: 39 [Katalog]; 15614: 39 [Katalog]; 15615: 37 [Katalog]; 16351: 37 [Katalog] | 230 |
| 33083 | Wa Wa Wa Wappi-chan | 107295 (26 F., Katalog) | 3660: 13 ← 107295; 16869: 13 [Katalog] | 26 |
| 36740 | Dragon Egg | 103706 (52 F., Katalog) | 16018: 7 ← 103706; 16101: 45 [Katalog] | 52 |
| 37948 | Hentatsu | 111433 (9 F., Katalog) | 13298: 7 ← 111433; 15449: 2 [Katalog] | 9 |
| 39222 | Move to the Future: Prolog | 123284 (10 F., Katalog) | 14174: 1 [Katalog]; 16369: 9 ← 123284 | 10 |
| 41219 | Fanren Xiuxian Chuan: Feng Qi Tian Nan | 115844 (17 F., Katalog) | 14801: 8 ← 115844; 16921: 9 [Katalog] | 17 |
| 53249 | Fengzi Wuyu Yinhe Pian | 129228 (20 F., Katalog) | 18048: 8 ← 129228; 18049: 12 [Katalog] | 20 |

### teilung-teil

| MAL | Seite (erste) | AniList-Titel (Folgen, Ort) | aniSearch-Seiten (Folgen, dt. = Deutsch, [Zeile im Ort], ← getragen von) | Σ Folgen |
|---|---|---|---|---|
| 5578 | Aoyama Goushou Tanpenshuu 2 | 5578 (7 F., Hauptbestand) | 5879: 3 dt. [Hauptbestand] Beleg; 10586: 1 dt. [Hauptbestand] Beleg | 4 |
| 7791 | K-On!! Bangai-hen: Kikaku Kaigi! | 7791 (26 F., Hauptbestand, Beleg) | 7051: 1 dt. [Hauptbestand] Beleg; 7052: 1 dt. [Hauptbestand] Beleg | 2 |
| 9136 | Kuroshitsuji II: Making of Kuroshitsu… | 9136 (6 F., Hauptbestand, Beleg) | 6990: 1 dt. [Hauptbestand] Beleg; 6994: 2 dt. [Hauptbestand] Beleg | 3 |
| 33191 | Kishibe Rohan wa Ugokanai: Mutsukabez… | 21778 (4 F., Hauptbestand, Beleg) | 13343: 1 dt. [Hauptbestand] Beleg; 14752: 2 dt. [Hauptbestand] Beleg | 3 |
| 37396 | Shikioriori: Hidamari no Choushoku | 101231 (3 F., Hauptbestand, Beleg) | 13418: 1 dt. [Hauptbestand] Beleg; 13419: 1 dt. [Hauptbestand] Beleg | 2 |
| 1072 | End of the World | 1072 (5 F., Katalog) | 785: 1 [Katalog]; 854: 1 [Katalog]; 1698: 1 [Katalog]; 5192: 1 [Katalog] | 4 |
| 3121 | Kodomo no Jikan: Kodomo no Natsu Jikan | 3121 (3 F., Katalog) | 6955: 1 [Katalog]; 6958: 1 [Katalog] | 2 |
| 6832 | Shoujouji no Tanuki-bayashi Ban Dan’e… | 6832 (1 F., Katalog) | 5683: 1 ← 6832; 9823: 1 | 2 |
| 7031 | Satsujin Kyou Jidai | 7031 (1 F., Katalog) | 6707: 1 ← 7031; 6708: 1 | 2 |
| 28149 | Ryuu no Haisha | 20947 (36 F., Katalog) | 9958: 1 [Katalog]; 10057: 1 [Katalog]; 10059: 1 [Katalog]; 10061: 1 [Katalog]; 10116: 1 [Katalog]; 10177: 1 [Katalog]; … (27 Seiten) | 27 |
| 32773 | Nintama Rantarou no Uchuu Daibouken w… | 126606 (2 F., Katalog) | 14331: 2 ← 126606; 15571: 2 [Katalog]; 15572: 2 [Katalog]; 15573: 2 [Katalog]; 15603: 2 [Katalog] | 10 |
| 35757 | Gin no Guardian (2018) | 99148 (6 F., Katalog) | 12602: 6 ← 99148; 12913: 12 [Katalog] | 18 |
| 50250 | Chiikawa | 140842 (? F., Katalog) | 16709: 256 ← 140842; 20736: 125 [Katalog]; 21980: 12 [Katalog] | 393 |
| 56216 | Juan Siliang Feng Yan Dieqi | 137758 (15 F., Katalog) | 19409: 15 ← 137758; 21674: 15 | 30 |
| 59183 | Sangou Sha Taiping Tian Shu | 137647 (12 F., Katalog) | 19422: 12 ← 137647; 21670: 12 | 24 |
| 60583 | Xian Di Gui Lai | 185858 (16 F., Katalog) | 21602: 16 ← 185858; 21603: 1 [Katalog] | 17 |

### ohne-anilist

| MAL | Seite (erste) | AniList-Titel (Folgen, Ort) | aniSearch-Seiten (Folgen, dt. = Deutsch, [Zeile im Ort], ← getragen von) | Σ Folgen |
|---|---|---|---|---|
| 6674 | Reporter Blues | — | 3873: 26 dt. [Hauptbestand] Beleg; 8939: 26 [Katalog] | 52 |
| 33712 | Bikini Warriors (2016) | — | 11635: 2 dt. [Hauptbestand] Beleg; 13220: 1 dt. [Hauptbestand] Beleg; 13718: 2 [Katalog] | 5 |
| 1481 | Urusei Yatsura: Shuugakuryokou! Kunoi… | — | 8388: 1 [Katalog]; 8616: 1 [Katalog] | 2 |
| 1998 | Global Astroliner Gou | — | 3992: 1 [Katalog]; 4036: 1 [Katalog]; 4037: 1 [Katalog]; 4161: 1 [Katalog] | 4 |
| 2306 | Kidou Senshi SD Gundam no Gyakushuu: … | — | 2149: 1 [Katalog]; 11603: 1 [Katalog] | 2 |
| 2520 | Dragon Ball: Gokuu no Koutsuu Anzen | — | 4281: 1 [Katalog]; 5508: 1 [Katalog] | 2 |
| 3245 | Kindaichi Shounen no Jikenbo: Operaza… | — | 4608: 1 [Katalog]; 4609: 1 [Katalog] | 2 |
| 8197 | Sora no Oto Bangai-hen Dai-13-wa: Sor… | — | 7631: 1 [Katalog]; 7753: 1 [Katalog] | 2 |
| 10083 | Shiki: Daifutatou to Hanwa | — | 7557: 1 [Katalog]; 7558: 1 [Katalog] | 2 |
| 10178 | Otona Joshi no Anime Time: Kawamo o S… | — | 6822: 1 [Katalog]; 8265: 3 [Katalog] | 4 |
| 12337 | Soukou Kihei Votoms: Woodo | — | 8966: 1 [Katalog]; 8967: 1 [Katalog]; 8969: 1 [Katalog]; 8970: 1 [Katalog] | 4 |
| 12921 | Morita-san wa Mukuchi.: Deai wa Ano T… | — | 10822: 1 [Katalog]; 10876: 1 [Katalog] | 2 |
| 13767 | Junjou Romantica: Junjou Egoist / Jun… | — | 7869: 1 [Katalog]; 12353: 1 [Katalog] | 2 |
| 17879 | Tamako Market: Dera's Bar | — | 8550: 3 [Katalog]; 8910: 3 [Katalog] | 6 |
| 28087 | Ehon Yose | — | 11947: 70 [Katalog]; 20338: 2 [Katalog] | 72 |
| 30370 | Akatsuki no Yona: Sono Se ni wa | — | 10326: 1 [Katalog]; 11235: 2 [Katalog] | 3 |
| 31071 | Kinyoru, Abe Reiji | — | 10583: 5 [Katalog]; 14342: 5 [Katalog] | 10 |
| 31690 | Chuu-gakusei: Super Deluxe | — | 7590: 1 [Katalog]; 7592: 1 [Katalog] | 2 |
| 34465 | Ao no Exorcist: Kyoto Fujouou Hen - H… | — | 12316: 1 [Katalog]; 12856: 1 [Katalog] | 2 |
| 36492 | Road to You: Hoshi Furu Oka no Yakuso… | — | 13932: 1 [Katalog]; 14654: 1 [Katalog] | 2 |
| 38537 | Huoli Shaonian Wang: You Quan Yingxio… | — | 18677: 26 [Katalog]; 21136: 16 [Katalog] | 42 |
| 38710 | Golden Kamuy: Koi o Shita kara Datsug… | — | 14454: 1 [Katalog]; 14472: 1 [Katalog]; 15964: 1 [Katalog] | 3 |
| 40873 | Granblue Fantasy The Animation Season… | — | 14825: 1 [Katalog]; 15129: 1 [Katalog] | 2 |
| 45080 | Shuke Beita | — | 15349: 26 [Katalog]; 15559: 26 [Katalog] | 52 |
| 48344 | Taoreujima Buster | — | 16699: 26 [Katalog]; 16700: 20 [Katalog] | 46 |
| 50475 | 86: Eighty Six - Shishite Kai Aru Mon… | — | 16844: 1 [Katalog]; 19748: 1 [Katalog] | 2 |
| 56363 | Poliwa Hamkkehaneun Gyotonganjeon Iya… | — | 21517: 14 [Katalog]; 21519: 12 [Katalog] | 26 |
| 57743 | Kaixin Chaoren: Shikong Yingjiu | — | 21251: 1 [Katalog]; 21631: 1 [Katalog] | 2 |
| 61753 | Shixiong A Shixiong Nian Fan 2 | 195885 (78 F., Katalog) | 21617: 78 ← 195885; 21619: 24 [Katalog] | 102 |

### getrennt

| MAL | Seite (erste) | AniList-Titel (Folgen, Ort) | aniSearch-Seiten (Folgen, dt. = Deutsch, [Zeile im Ort], ← getragen von) | Σ Folgen |
|---|---|---|---|---|
| 567 | The Big O | 567 (13 F., Katalog); 129608 (13 F., Katalog) | 1022: 13 ← 567; 9663: 13 ← 129608 | 26 |
| 1744 | Wagamama Fairy Mirumo de Pon! Wonderf… | 1744 (78 F., Katalog); 170426 (24 F., Katalog); 170427 (48 F., Katalog); 170428 (22 F., Katalog) | 363: 48 ← 170427; 2225: 22 ← 170428; 3279: 24 ← 170426 | 94 |
| 1935 | Megazone 23 | 1935 (1 F., Katalog); 129591 (2 F., Katalog); 129595 (1 F., Katalog) | 1587: 1 ← 1935; 1848: 1 ← 129595; 3408: 2 ← 129591 | 4 |
| 3401 | The Apple Incident | 126174 (1 F., Katalog); 126175 (1 F., Katalog) | 3770: 1 ← 126175; 8834: 1 ← 126174 | 2 |
| 8663 | Tokuten Eizou Anthology No. 1 | 8663 (1 F., Katalog); 178307 (1 F., Katalog); 178308 (1 F., Katalog) | 4101: 1 ← 178307; 4102: 1 ← 8663; 4103: 1 ← 178308 | 3 |
| 9520 | Zero Tester | 9520 (39 F., Katalog); 9522 (27 F., Katalog) | 63: 38 ← 9520; 2738: 28 ← 9522 | 66 |
| 12279 | Kinnikuman II Sei: Muscle Ninjin Soud… | 6310 (1 F., Katalog); 12279 (1 F., Katalog) | 748: 1 ← 12279; 1172: 1 ← 6310 | 2 |
| 31667 | Ponkotsu Quest: Maou to Haken no Mamo… | 121961 (12 F., Katalog); 177226 (12 F., Katalog); 177227 (12 F., Katalog); 177228 (12 F., Katalog); 177229 (12 F., Katalog) | 10850: 24 ← 121961; 12323: 12 ← 177226; 12324: 12 ← 177227; 14593: 12 ← 177228; 14614: 12 ← 177229 | 72 |
| 36761 | Osomatsu-san Short Film Series Dai 2 … | 13781 (1 F., Katalog); 145985 (4 F., Katalog) | 21604: 4 ← 145985; 21605: 1 ← 13781 | 5 |
| 39638 | Choujigen Game Neptune The Animation:… | 108758 (1 F., Katalog); 139806 (1 F., Katalog); 143766 (1 F., Katalog) | 14322: 1 ← 108758; 16809: 1 ← 139806; 17890: 1 ← 143766 | 3 |
| 42364 | Re:Zero kara Hajimeru Break Time (202… | 120700 (13 F., Katalog); 128306 (12 F., Katalog) | 15370: 13 ← 120700; 15885: 12 ← 128306 | 25 |
| 44053 | Hua Jianghu: Gui Yexing | 120268 (20 F., Katalog); 132312 (20 F., Katalog) | 16126: 20 ← 120268; 17049: 20 ← 132312 | 40 |
| 45658 | Dokidoki! Mini Mini! Kakushi Dungeon … | 128367 (12 F., Katalog); 131708 (2 F., Katalog) | 15919: 12 ← 128367; 17046: 2 ← 131708 | 14 |
| 50025 | Huanmeng Shan Hai Yao | 122522 (15 F., Katalog); 141864 (16 F., Katalog) | 21647: 15 ← 122522; 21648: 16 ← 141864 | 31 |
| 52523 | Feiren Zai Di-er Ji | 151691 (12 F., Katalog); 168084 (24 F., Katalog) | 17601: 12 ← 151691; 21072: 24 ← 168084 | 36 |
<!-- mal-mehrfach:ende -->
