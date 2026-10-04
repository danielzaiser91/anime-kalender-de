# Schattenlauf: Reihen aus aniSearch-Relationen (04.10.2026)

Gemessen mit `node tools/archiv/schattenlauf-reihen.mjs` — **nichts umgestellt**. Die vollständige
Abweichungsliste liegt in [schattenlauf-reihen.json](schattenlauf-reihen.json).

## 1. Was gemessen wurde

- Archiv: **3195 aniSearch-Seiten** (alle mit Relations-Abschnitt),
  **8326 Relationseinträge**, davon **5580 Anime→Anime**.
  Der Rest zeigt auf Manga oder Realfilm — „Originalwerk" fast immer auf die Vorlage.
- **2398 Anime-Kanten haben keine Gegenkante** — das Ziel hat keine
  archivierte Seite (2087 verschiedene Einträge). Diese Relationen werden nicht gesehen.
- Bestand: **2788 Titel**, Vergleichsmenge **2636**
  (152 ohne Brücke in `data/anisearch.json`, 0 mit Brücke, aber ohne Seite).
- Kanten, deren **beide** Enden in der Vergleichsmenge liegen: **2458**.

## 2. Kanten je Relationstyp

Nur Anime→Anime (die übrigen Medien zählen für Reihen nicht):

| Typ | Kanten | davon in der Vergleichsmenge | AniList-Entsprechung |
|---|---:|---:|---|
| Sequel | 1187 | 676 | SEQUEL |
| Prequel | 963 | 676 | PREQUEL |
| Nebengeschichte | 786 | 278 | SIDE_STORY |
| Anderes | 477 | 114 | OTHER (bei uns nur mit Namensprüfung) |
| Hauptgeschichte | 400 | 278 | PARENT |
| Zusammenfassung | 388 | 37 | SUMMARY |
| Alternative Version | 335 | 124 | ALTERNATIVE |
| Charakter | 306 | 52 | (kein Gegenstück) |
| Gemeinsames Universum | 253 | 98 | (kein Gegenstück) |
| ? | 240 | 40 | (aniSearch kennt den Typ nicht) |
| Crossover | 87 | 22 | (kein Gegenstück) |
| Alternative Umgebung | 81 | 16 | (kein Gegenstück) |
| Komplette Geschichte | 60 | 37 | COMPILATION |
| Remake | 17 | 10 | ALTERNATIVE |

**3182 der 5580 Anime-Kanten haben eine Gegenkante** —
aniSearch führt jede Relation auf beiden Seiten, mit umgekehrtem Etikett. Fehlt die
Gegenkante, hat das Ziel keine archivierte Seite (§6). Deshalb stehen in der Tabelle oben
mehrere Typen paarweise gleich hoch. Die häufigsten Paare (je Verbindung einmal gezählt):

| Typ | Gegenkante | Verbindungen |
|---|---|---:|
| Prequel | Sequel | 804 |
| Hauptgeschichte | Nebengeschichte | 365 |
| Alternative Version | Alternative Version | 96 |
| Anderes | Anderes | 84 |
| Gemeinsames Universum | Gemeinsames Universum | 77 |
| Komplette Geschichte | Zusammenfassung | 57 |
| Charakter | Charakter | 40 |
| Alternative Umgebung | Alternative Umgebung | 25 |

Nicht-anime Relationen (nur zur Einordnung):

| Ziel | Typ | Kanten |
|---|---|---:|
| manga | Originalwerk | 1260 |
| manga | ? | 956 |
| movie | Identische Vorlage | 127 |
| manga | Adaption | 121 |
| manga | Identische Vorlage | 105 |
| movie | ? | 74 |
| manga | Adaption: Spin-Off | 53 |
| manga | Adaption: Unvollständig | 19 |
| manga | Adaption: Neufassung | 16 |
| movie | Adaption | 5 |
| movie | Originalwerk | 4 |
| manga | Adaption: Alternatives Ende | 3 |
| movie | Adaption: Spin-Off | 2 |
| movie | Adaption: Neufassung | 1 |

## 3. Die Auswahl der Relationstypen

**Als „gleiche Reihe" gezählt (Kern):**

| Typ | Kanten | warum |
|---|---:|---|
| Sequel | 676 | Fortsetzung derselben Geschichte |
| Prequel | 676 | Vorgänger derselben Geschichte |
| Hauptgeschichte | 278 | der Hauptteil, dem ein Special zugeordnet ist |
| Nebengeschichte | 278 | Side Story derselben Reihe |
| Zusammenfassung | 37 | Recap oder Filmschnitt derselben Reihe |
| Komplette Geschichte | 37 | Zusammenschnitt der ganzen Reihe |

Diese sechs tragen denselben Sinn wie die Typen, aus denen `FRANCHISE_RELATIONS` unsere
`franchiseId` baut (`SEQUEL`, `PREQUEL`, `PARENT`, `SIDE_STORY`, `SUMMARY`, `COMPILATION`).
Kanten je Typ sind hier die Zahlen **in der Vergleichsmenge**, nicht im ganzen Archiv.

**Bewusst nicht gezählt:**

| Typ | Kanten | warum nicht |
|---|---:|---|
| Anderes | 114 | Sammelbecken. aniSearch legt dort Werbeclips und Musikvideos ab, aber auch echte Reihenkanten (siehe §5). AniList hat denselben Topf `OTHER` und wir zählen ihn nur bei passendem Namen (`otherZaehlt`). Als Variante **D** mitgemessen. |
| Charakter | 52 | Auftritt einer Figur, nicht Zugehörigkeit zur Reihe (Sonic taucht bei Herlock auf). Variante **B**. |
| Alternative Version | 124 | eigene Fassung, nicht dieselbe Erzählung. AniList zählt `ALTERNATIVE` mit — Variante **C**. |
| Remake | 10 | Neufassung, wie oben in Variante C. |
| Alternative Umgebung | 16 | andere Welt, dieselben Figuren (Touken Ranbu: Hanamaru gegen Katsugeki). Kein AniList-Gegenstück. |
| Gemeinsames Universum | 98 | lockerer Zusammenhang ohne gemeinsame Handlung (Beyblade gegen BeyWarriors). |
| Crossover | 22 | zwei Reihen zugleich — `03-reihen.ts` zieht das ausdrücklich **nicht** zusammen. |
| ? | 40 | aniSearch kennt den Typ nicht. Nicht geraten. |

Daraus vier Varianten: **A** Kern, **B** Kern + Charakter, **C** Kern + Alternative/Remake
(entspricht AniLists Set am nächsten), **D** alle Anime-Typen als Obergrenze.

Ein **Spin-Off**-Typ für Anime-Ziele fehlt: `Adaption: Spin-Off` steht nur an Kanten zu
Manga- (53) und Film-Einträgen (2), nie zwischen zwei Anime. AniList führt `SPIN_OFF`
dagegen als eigenen Reihentyp — hier decken sich die Quellen nicht.

## 4. Vergleich mit unserer `franchiseId`

Gezählt wird **von unserer Reihe aus**: Was macht aniSearch aus einer Reihe, die wir kennen?

- **gleich** — unsere Reihe ist genau eine aniSearch-Gruppe
- **aniSearch führt mehr zusammen** — unsere Reihe ist echte Teilmenge einer größeren Gruppe
- **aniSearch trennt** — unsere Reihe zerfällt in mehrere Gruppen
- **kreuzen** — beide Einteilungen überschneiden sich nur teilweise

| Variante | aniSearch-Gruppen | gleich | aniSearch mehr | aniSearch trennt | kreuzen |
|---|---:|---:|---:|---:|---:|
| A: Kern | 1661 | 1260 | 11 | 143 | 2 |
| B: Kern + Charakter | 1640 | 1249 | 26 | 135 | 6 |
| C: Kern + Alternative Version/Remake (wie AniLists ALTERNATIVE) | 1604 | 1272 | 24 | 118 | 2 |
| D: alle Anime-Typen (Obergrenze) | 1454 | 1265 | 88 | 58 | 5 |

Dieselbe Zählung nur für unsere Reihen mit **zwei oder mehr** Teilen — die vielen
Einzeltitel verzerren das Bild sonst, weil eine einelementige Gruppe fast immer „gleich"
oder „aniSearch führt mehr zusammen" ist:

| Variante | gleich | aniSearch mehr | aniSearch trennt | kreuzen |
|---|---:|---:|---:|---:|
| A | 299 | 4 | 143 | 2 |
| B | 297 | 10 | 135 | 6 |
| C | 323 | 5 | 118 | 2 |
| D | 353 | 32 | 58 | 5 |

**Der Abstand zwischen den Varianten ist die Antwort auf die Ausgangsfrage:**
„aniSearch trennt" fällt von 143 Fällen im Kern auf 58, wenn alle Anime-Typen
mitzählen — 85 der 143 Trennungen entstehen also allein daraus, **welche
Relationstypen wir mitzählen**. Die übrigen beruhen auf Kanten zu Seiten, die nicht im
Archiv liegen (§6). Umgekehrt steigt „aniSearch führt mehr zusammen" von
11 auf 88: Die locker gebundenen Typen verschmelzen dann Reihen, die bei uns
getrennt stehen — die Obergrenze ist keine Empfehlung.

## 5. Beispiele

Je Abweichungsart 15 Beispiele aus **Variante A**; die vollständigen Listen aller vier
Varianten stehen im JSON. Namen sind `titleDe`, sonst `titleEn`/`titleRomaji`.

### aniSearch führt mehr zusammen als wir (11 Fälle, Variante A)

| unsere Reihe | unsere Teile | aniSearch |
|---|---|---|
| Resident Evil: Degeneration (2) | Resident Evil: Degeneration, Resident Evil: Damnation | eine Gruppe mit 4, zusätzlich: Resident Evil: Vendetta, Resident Evil: Death Island |
| Yu-Gi-Oh! Zexal (2) | Yu-Gi-Oh! Zexal, Yu-Gi-Oh! Zexal II | eine Gruppe mit 8, zusätzlich: Yu-Gi-Oh!, Yu-Gi-Oh! GX, Yu-Gi-Oh! Der Film, Yu-Gi-Oh! 5D’s … (+2) |
| Chaika, die Sargprinzessin (2) | Chaika, die Sargprinzessin, Chaika, die Sargprinzessin: Avenging Battle | eine Gruppe mit 3, zusätzlich: Chaika, die Sargprinzessin OVA |
| Resident Evil: Vendetta (2) | Resident Evil: Vendetta, Resident Evil: Death Island | eine Gruppe mit 4, zusätzlich: Resident Evil: Degeneration, Resident Evil: Damnation |
| Stand By Me Doraemon 2 (kleinster Teil) (1) | Stand By Me Doraemon 2 | eine Gruppe mit 2, zusätzlich: Stand By Me Doraemon |
| Stand By Me Doraemon (kleinster Teil) (1) | Stand By Me Doraemon | eine Gruppe mit 2, zusätzlich: Stand By Me Doraemon 2 |
| Samurai Warriors SP: Die Legende der Sanada (1) | Samurai Warriors SP: Die Legende der Sanada | eine Gruppe mit 2, zusätzlich: Samurai Warriors |
| Yu-Gi-Oh! Arc-V (1) | Yu-Gi-Oh! Arc-V | eine Gruppe mit 8, zusätzlich: Yu-Gi-Oh!, Yu-Gi-Oh! GX, Yu-Gi-Oh! Der Film, Yu-Gi-Oh! 5D’s … (+3) |
| Kuroko’s Basketball: Kannst du das gleich nochmal machen? (1) | Kuroko’s Basketball: Kannst du das gleich nochmal machen? | eine Gruppe mit 7, zusätzlich: Kuroko’s Basketball: 1st Season, Kuroko’s Basketball: 2nd Season, Kuroko’s Basketball: Tip Off, Kuroko’s Basketball: 3rd Season … (+2) |
| Chaika, die Sargprinzessin OVA (1) | Chaika, die Sargprinzessin OVA | eine Gruppe mit 3, zusätzlich: Chaika, die Sargprinzessin, Chaika, die Sargprinzessin: Avenging Battle |
| Samurai Warriors (1) | Samurai Warriors | eine Gruppe mit 2, zusätzlich: Samurai Warriors SP: Die Legende der Sanada |

### aniSearch trennt, was wir zusammenhalten (143 Fälle, Variante A)

| unsere Reihe | unsere Teile | aniSearch |
|---|---|---|
| Pokémon (66) | Pokémon, Pokémon: Der Film - Mewtu gegen Mew, Pokémon 2: Die Macht des Einzelnen, Pokémon: Im Bann der Icognito … (+62) | 24 Gruppen: [Pokémon, Pokémon: Der Film - Mewtu gegen Mew, Pokémon 2: Die Macht des Einzelnen … (+35)] / [Pokémon: Der Film - Du bist dran!, Pokémon: Der Film - Die Macht in uns, Pokémon: Der Film - Geheimnisse des Dschungels … (+1)] / [Pikachu und Pichu, Pichu Bros.: Einer für alle!] / [Die Pokémon-Concierge, Die Pokémon-Concierge – Teil 2] … (+20) |
| Detektiv Conan (39) | Detektiv Conan, Detektiv Conan: Der tickende Wolkenkratzer, Detektiv Conan: Das 14. Ziel, Detektiv Conan: Der Magier des letzten Jahrhunderts … (+35) | 4 Gruppen: [Detektiv Conan, Detektiv Conan: Der tickende Wolkenkratzer, Detektiv Conan: Das 14. Ziel … (+32)] / [Lupin III. vs Detektiv Conan: The Special, Lupin III. vs Detektiv Conan: The Movie] / [Magic Kaito: Kid the Phantom Thief] / [Magic Kaito 1412] |
| Dragon Ball (33) | Dragon Ball, Dragon Ball GT, Dragon Ball: Die Legende von Shenlong, Dragon Ball Z … (+29) | 6 Gruppen: [Dragon Ball, Dragon Ball GT, Dragon Ball Z … (+22)] / [Dragon Ball: Die Legende von Shenlong, Dragon Ball: Das Schloss der Dämonen, Dragon Ball: Son-Gokus erstes Turnier] / [Dragon Ball Z: Kampf der Götter, Dragon Ball Z: Resurrection ‚F‘] / [Dragon Ball: Der Weg zur Macht] … (+2) |
| One Piece (30) | One Piece, One Piece: Der Film, One Piece: Abenteuer auf der Spiralinsel, One Piece: Chopper auf der Insel der seltsamen Tiere … (+26) | 7 Gruppen: [One Piece, One Piece: Der Film, One Piece: Abenteuer auf der Spiralinsel … (+21)] / [One Piece: Jackos Tanz Festival] / [One Piece: Die Könige des Fußballs] / [One Piece: Die Könige des Piraten-Baseballs] … (+3) |
| Fate/Stay Night: Unlimited Blade Works (kleinster Teil) (25) | Fate/Stay Night: Unlimited Blade Works, Fate/Zero, Fate/Zero, Fate/Kaleid Liner Prisma Illya … (+21) | 11 Gruppen: [Fate/Kaleid Liner Prisma Illya, Fate/Kaleid Liner Prisma Illya: Der Tanz am Sporttag, Fate/Kaleid Liner Prisma Illya Mini-Episoden … (+8)] / [Fate/Grand Order Absolute Demonic Front: Babylonia, Fate/Grand Order Absolute Demonic Front: Babylonia - Initium Iter, Fate/Grand Order: Final Singularity - The Grand Temple of Time: Solomon] / [Fate/Zero, Fate/Zero] / [Fate/Stay Night: Unlimited Blade Works, Fate/Stay Night: Unlimited Blade Works 2] … (+7) |
| Naruto (20) | Naruto, Naruto: The Movie - Geheimmission im Land des ewigen Schnees, Naruto: Die Geheimmission - Rettet das Dorf Takigakure, Naruto: The Movie 2 - Die Legende des Steins von Gelel … (+16) | 4 Gruppen: [Naruto, Naruto: The Movie - Geheimmission im Land des ewigen Schnees, Naruto: Die Geheimmission - Rettet das Dorf Takigakure … (+14)] / [Naruto Shippuden: The OVA - Naruto, ein Genie und drei Wünsche] / [Naruto Shippuden: Flammende Chunin-Prüfung - Naruto gegen Konohamaru!] / [Boruto: Naruto the Movie - The Day Naruto Became Hokage] |
| My Hero Academia (18) | My Hero Academia, My Hero Academia 2, My Hero Academia 3, My Hero Academia: Two Heroes … (+14) | 2 Gruppen: [My Hero Academia, My Hero Academia 2, My Hero Academia 3 … (+14)] / [My Hero Academia: I Am a Hero Too] |
| Beyblade (17) | Beyblade, Beyblade G Revolution, Beyblade V Force, Beyblade: Metal Fusion … (+13) | 4 Gruppen: [Beyblade Burst, Beyblade Burst: Evolution, Beyblade Burst Turbo … (+4)] / [Beyblade: Metal Fusion, Beyblade der Film: Die Legende von Atlantis, Beyblade: Metal Masters … (+3)] / [Beyblade, Beyblade G Revolution, Beyblade V Force] / [Beyblade X] |
| Ghost in the Shell (16) | Ghost in the Shell, Ghost in the Shell: Stand Alone Complex, Ghost in the Shell 2: Innocence, Ghost in the Shell: Stand Alone Complex 2nd GIG … (+12) | 5 Gruppen: [Ghost in the Shell: Stand Alone Complex, Ghost in the Shell: Stand Alone Complex 2nd GIG, Ghost in the Shell: Stand Alone Complex - Solid State Society … (+5)] / [Ghost in the Shell, Ghost in the Shell 2: Innocence, Ghost in the Shell 2.0] / [Ghost in the Shell: Stand Alone Complex - Der Alltag der Tachikoma, Ghost in the Shell: S.A.C. 2nd GIG - Der Alltag der Tachikoma] / [Ghost in the Shell: The New Movie, Ghost in the Shell: Arise - Pyrophoric Cult] … (+1) |
| Digimon (13) | Digimon, Digimon Data Squad, Digimon Tamers, Digimon Frontier … (+9) | 6 Gruppen: [Digimon, Digimon 02, Digimon: Der Film … (+2)] / [Digimon Adventure: Last Evolution Kizuna, DIGIMON ADVENTURE 20th memorial story, Digimon Adventure 02: The Beginning] / [Digimon Fusion, Digimon Xros Wars: The Evil Death Generals and the Seven Kingdoms] / [Digimon Data Squad] … (+2) |
| Lupin III.: Part 1 (12) | Lupin III.: Part 1, Lupin III: Der goldene Drache, Lupin III: Farewell to Nostradamus, Das Schloss des Cagliostro … (+8) | 9 Gruppen: [Lupin III.: Part 1, Lupin III.: The Woman Called Fujiko Mine, Lupin III.: Daisuke Jigens Grabstein] / [Lupin III.: Goemon Ishikawa, der es Blut regnen lässt, Lupin III.: Fujiko Mines Lüge] / [Lupin III: Der goldene Drache] / [Lupin III: Farewell to Nostradamus] … (+5) |
| Sword Art Online (12) | Sword Art Online, Sword Art Online: Extra Edition, Sword Art Online II, Sword Art Offline II … (+8) | 4 Gruppen: [Sword Art Online, Sword Art Online: Extra Edition, Sword Art Online II … (+4)] / [Sword Art Online Alternative: Gun Gale Online, Sword Art Online Alternative: Gun Gale Online II] / [Sword Art Online: The Movie - Progressive: Aria of a Starless Night, Sword Art Online: The Movie - Progressive: Scherzo of Deep Night] / [Sword Art Offline II] |
| Attack on Titan (12) | Attack on Titan, Attack on Titan OAD, Attack on Titan: Staffel 2, Attack on Titan: Entscheidung ohne Reue … (+8) | 2 Gruppen: [Attack on Titan, Attack on Titan OAD, Attack on Titan: Staffel 2 … (+8)] / [Shingeki no Kyojin: Chimi Kyara Gekijou - Rivai-han] |
| City Hunter: Ein Fall für Ryo Saeba (11) | City Hunter: Ein Fall für Ryo Saeba, City Hunter: Ein Fall für Ryo Saeba 2, City Hunter 3, City Hunter '91 … (+7) | 2 Gruppen: [City Hunter: Ein Fall für Ryo Saeba, City Hunter: Ein Fall für Ryo Saeba 2, City Hunter 3 … (+7)] / [City Hunter: Angel Dust] |
| Gundam Wing (kleinster Teil) (10) | Gundam Wing, Mobile Suit Gundam Wing: Endless Waltz, Mobile Suit Gundam Seed, Gundam Wing: Endless Waltz … (+6) | 6 Gruppen: [Gundam Wing, Mobile Suit Gundam Wing: Endless Waltz, Gundam Wing: Endless Waltz] / [Mobile Suit Gundam Seed, Mobile Suit Gundam Seed: Epilog] / [Mobile Suit Gundam 00, Mobile Suit Gundam 00 Second Season] / [Mobile Suit Gundam: Cucuruz Doan’s Island] … (+2) |

Die kleinen Stücke sind fast immer über einen Typ verbunden, den der Kern nicht zählt —
meist „Anderes", oft „Gemeinsames Universum". Beispiel aus der Pokémon-Reihe:
„Pikachus Ferien" hängt an „Pokémon: Der Film – Mewtu gegen Mew" mit **Anderes**,
„Pokémon Ranger: Spuren des Lichts" an „Pokémon: Diamant & Perl" mit **Gemeinsames
Universum**. Beide stehen bei uns in der Reihe, weil AniList sie über andere Kanten
anbindet.

### die Einteilungen kreuzen sich (2 Fälle, Variante A)

| unsere Reihe | unsere Teile | aniSearch |
|---|---|---|
| Yu-Gi-Oh! (7) | Yu-Gi-Oh!, Yu-Gi-Oh! GX, Yu☆Gi☆Oh!, Yu-Gi-Oh! Der Film … (+3) | 3 Gruppen: [Yu-Gi-Oh!, Yu-Gi-Oh! GX, Yu-Gi-Oh! Der Film … (+5)] / [Yu☆Gi☆Oh!] / [Yu-Gi-Oh!: Bonds Beyond Time] |
| Kuroko’s Basketball: 1st Season (7) | Kuroko’s Basketball: 1st Season, Kuroko’s Basketball: 2nd Season, Kuroko’s Basketball: Tip Off, Kuroko’s Basketball: 3rd Season … (+3) | 2 Gruppen: [Kuroko’s Basketball: 1st Season, Kuroko’s Basketball: 2nd Season, Kuroko’s Basketball: Tip Off … (+4)] / [Hiyoko no Basket: LAST GAME 0401] |

## 6. Was dieser Lauf nicht sagt

- **2398 Anime-Kanten haben keine Gegenkante** (2087 verschiedene Ziele).
  Da Relationen paarweise gespeichert werden, heißt das: Zu diesen Zielen liegt keine
  archivierte Seite vor. Fehlt die Seite, fehlt die Kante — und ein Titel kann getrennt
  erscheinen, obwohl aniSearch ihn anbindet.
- Ein Relationsabschnitt ist eine Aussage von aniSearch; ob sie stimmt, prüft dieser Lauf nicht.
- Die Variantenwahl ist eine Entscheidung, keine Messung. Die Zahlen dazu stehen in §4.
- „Gleich" bei einelementigen Reihen heißt nur, dass beide Seiten nichts verbinden — nicht,
  dass beide dasselbe über den Titel wissen.
