# Prime: offene Gruppen nach dem Serienvorsatz (Stand Meldungskopie 03.11.2026 03:01)

Messung: `fetch-rohfolgen.ts` (Worker-Auswahl: `uebernommen = 0`, `vorhanden` nicht „nein“, Adresse nicht in `titel_zeile`; 5.657 Prime-Zeilen) gegen `public/data`, `data/anisearch-folgen.json`, `data/tmdb-folgen.json` von `dd6647374`. Vorher 1 Adresse / 1 Folge zugeordnet, nachher 4 Adressen / 62 Folgen; neu: Eden of the East (5630, 9 Folgen), Tayo (163828, 26), Titipo (188066, 26); 0 bestehende Einträge geändert.

Von den 20 Anime-Adressen, die den Zuordner bis „offen“ führen, sind 3 gelöst. 17 bleiben, jede mit Grund. Keine ließ sich mit den vorhandenen Quellen von Hand belegen: Bei allen steht der Beleg nicht in aniSearch oder TMDB, ein Eintrag ohne Quelle wäre geraten (Amazon-Abrufe sind in diesem Auftrag ausgeschlossen).

| Titel (Kennung) | Zeilen / gemeldete Staffel | Grund |
|---|---|---|
| Pac-Man und die Geisterabenteuer (110364) | 26 / 1 | aniSearch führt nur englische Titel („The Adventure Begins, Part I“), TMDB keine passende Staffel; Prime „Das Abenteuer beginnt - Teil I“. Deutsche Titel fehlen in beiden Quellen. |
| Pokémon Reisen (112153) | 12 / 2501 | Prime führt deutsche Titel von 2022 („Der Geister-Express!“); aniSearch beginnt bei „Hallo, Pikachu“ (2019), kein TMDB-Anker. Andere Staffel der Reihe als die geführte. |
| Es war einmal … der Weltraum (11307), 4 Adressen (Staffel 1, 3, 5, 6) | je 26 / 1, 3, 5, 6 | Staffel 3, 5, 6 sind Prime-Staffeln anderer „Es war einmal …“-Reihen (Zelle/Geburt, Die Chinesen, Die ersten Seefahrer) unter dem Titel des ersten; Staffel 1 trägt Titel der Reihe „der Mensch“ („Der Neandertaler“). Falscher Titel gemeldet. |
| Es war einmal … Amerika (10004750), … Entdecker und Erfinder (10005293), … Die Entdeckung unserer Welt (10005217) | je 26 / 4, 5, 6 | Die Einträge haben weder aniSearch- noch TMDB-Folgentitel. Kein Anker vorhanden. |
| Reporter Blues (10003873) | 26 / 1 | TMDB-Staffel hat 52 Folgen, unser Eintrag 26: keine eindeutige Staffel; aniSearch ohne Folgen. |
| JoJo’s Bizarre Adventure: Diamond Is Unbreakable (21450), 2 Adressen | je 48 / 1, 3 | Die Prime-Titel sind die von Staffel 1 („Der von einem bösen Geist Besessene“, Phantom Blood): unter dem falschen Titel gemeldet. |
| JoJo’s Bizarre Adventure: Golden Wind (102883) | 48 / 3 | Dasselbe Phantom-Blood-Material. |
| Higurashi: When They Cry Sotsu (131149) und Higurashi no Naku Koro ni Kai (1889) | je 26 / 1 | Prime-Titel „Es beginnt“, „Geheimnisse“ (2006) sind die der ersten Staffel. |
| KonoSuba: God’s Blessing on This Wonderful World! 2 (21699) | 10 / 2 | Wortlaut verschieden („Eine Rettung von dieser gerichtlichen Ungerechtigkeit!“ gegen aniSearch und TMDB „Law & Order: Axel“). Das Prime-Datum liegt durchgehend einen Tag vor dem Anker (11., 18., 25.01. gegen 12., 19., 26.01.); ein Datumsanker mit ±1 Tag wäre denkbar, ist aber ein neuer Spielraum und hier nicht gebaut. |
| Yuna & Stitch Staffel 2 (6899) | 10 / 102 | Prime-Titel („Die kleine Sternschnuppe“) stehen in keinem Anker. |

## Entscheidungen 03.11.2026 (Restliste von Hand)

Quellen: `prime_folge` der Meldungskopie (Stand 03.11. 03:01) je Adresse und Seitenkennung, `data/dub-confirmed.yaml`, `data/kanal-seiten.json`, `public/data/titles.json`, `data/tmdb-folgen.json`. Kein Amazon-Abruf.

| Gruppe | Entscheidung | Beleg |
|---|---|---|
| Es war einmal … der Weltraum, Staffel 1/3/5/6 (4 Adressen) | Falscher Titel. Die Serienseite B088K17QGJ führt acht Staffeln, nur Staffel 2 („Auf der Suche nach dem Leben“, Seitenkennung = Adresse) ist Weltraum. Staffel 4/5/6 (B00IKSSO70, B00IKSHXG8, B00IKSJP6O) gehören Amerika, Entdecker und Erfinder, Entdeckung unserer Welt; deren Handbelege lagen seit 24.10. schon dort, die Weltraum-Kopien (Staffel 4–8) sind entfernt. Staffel 1 (B00ERN03GM, 26 Folgen, Kauf) wandert zu „der Mensch“ (10004749, bisher ohne Prime-Weg). Staffel 3 (B00ERK3MQ8) gehört Das Leben (3624, schon so). Staffel 7/8 (Alternative Energien, Solar Impulse) gehören einer Reihe, die wir nicht führen. | `dub-confirmed.yaml`, `kanal-seiten.json`, `belege-entfernt.yaml` |
| Es war einmal … Amerika / Entdecker und Erfinder / Entdeckung unserer Welt | Über dieselbe Umhängung gelöst: Der Beleg lag schon bei ihnen, die Weltraum-Kopie auf derselben Seite stand davor. Einzelfolgen bleiben offen (keine Folgentitel in aniSearch/TMDB), Link und Häkchen der Staffelseite stehen. | wie oben |
| JoJo Diamond Is Unbreakable ×2, Golden Wind | Kein Link betroffen. Die Gruppen sind die Staffeln Phantom Blood (Seitenkennung B0F4V6JFH9, B0CH1GVRKK) und Stardust Crusaders (B0CJC149XP) auf den Sammelseiten B0F9FWKDXT, B0GXK7RJFW, B0G1ZD14D3. Die eigene Staffel jeder Seite ist dem richtigen Titel zugeordnet (Diamond 21450, Golden Wind 102883, Seitenkennung = Adresse, `titel_id` gesetzt); Phantom Blood und Stardust halten ihre Seiten (B0CH1GVRKK, B0GX7VDJK3). | Meldungskopie, `titles.json` |
| Higurashi Sotsu (131149) | Kein Link betroffen. „Es beginnt“ ist Staffel 1 (2006) auf der Sotsu-Seite; Sotsu hält seine eigene Staffel (B0CW5RP53F). Staffel 1 gehört jetzt dem ersten Titel (nächste Zeile). | Meldungskopie |
| Higurashi Kai (1889) | Falscher Titel. B09JTSD79F ist Staffel 1 (2006, „Brennende Eifersucht“) und gehört Higurashi no Naku Koro ni (934, bisher ohne Prime-Weg); B0CBKJKYM4 ist Gou (2020, „Dämonentäuschung“ = Onidamashi-Kapitel, TMDB 114446 Folge 1–4). Beide hingen bei Kai. Umgehängt: 5 Handbelege zu 934, 1 zu Gou, Merk- und Sperrliste mitgezogen. Kai behält seine Staffel-2-Seite B09KX2VLPR. | `dub-confirmed.yaml`, TMDB-Folgentitel |
| KonoSuba 2 (21699) | Nur gemessen, nicht gebaut (Messung unten). | Wegwerfskript |
| Pac-Man (110364) | Bleibt offen: Prime „Das Abenteuer beginnt - Teil I“, aniSearch nur englische Titel, TMDB keine Staffel. Link und Häkchen stehen (Handbeleg B0CC2XXCZG), nur die Einzelfolgen fehlen. | Meldungskopie |
| Pokémon Reisen (112153) | Link stimmt: B0B75V3WSK ist Prime-Staffel 2501 (12 Folgen, 2022), B0B8JG2PSD Staffel 2503; beide hängen als Handbeleg bei Reisen. Einzelfolgen offen: deutsche Titel ohne Anker. | `dub-confirmed.yaml` |
| Reporter Blues (10003873) | Bleibt offen: TMDB-Staffel hat 52 Folgen, unser Titel 26. Link B0FKFDLQDH und Häkchen stehen. | `titles.json` |
| Yuna & Stitch Staffel 2 (6899) | Bleibt offen: „Staffel 1 Teil 2“ (10 Folgen, Oktober 2012) kann zu Staffel 1 (5027) oder zu 6899 gehören; weder Datum noch Titel in aniSearch/TMDB entscheidet es. | Meldungskopie |
| Z wie Zorro (3010) | Nur notiert (Abschnitt unten, Zugewinn 1 Folge). | |

Offen nach Entscheidung: 6 Titel mit Einzelfolgen (Pac-Man, Pokémon Reisen, Reporter Blues, Yuna & Stitch S2, Z wie Zorro, KonoSuba 2) und die Folgentitel der drei umgehängten Es-war-einmal-Titel; kein Link ist dabei falsch.

### Messung KonoSuba: Datumsanker ±1 Tag (nur gemessen)

Welt: Meldungskopie 03.11. 03:01 gegen `data/anisearch-folgen.json` und `data/tmdb-folgen.json` des Zweigs; je offener Adresse und Seitenkennung wurde gezählt, wie viele Zeilen genau oder um einen Tag neben einem Anker-Datum liegen und ob die Folgennummer stimmt (Wegwerfskript im Scratchpad, 102 Gruppen auf den offenen Adressen). KonoSuba 2: 10 von 10 Zeilen nur mit ±1 Tag, 10 von 10 mit gleicher Folgennummer. Nur mit ±1 getroffen: 30 Gruppen; mit Nummernprobe sauber: KonoSuba 2 (10/10), Rothaarige Schneeprinzessin 2 (12/13), Vinland Saga 2 (13/13), Tokyo Ghoul 2 (2/12), Higurashi Staffel 1 (5/26, zwei Adressen). Falsch wäre ±1 allein bei Pokémon Staffel 2201–2204 (28 Zeilen, Nummer stimmt 0 mal) und Pac-Man Staffel 2 (2 Zeilen, 0 mal). Schluss: ±1 Tag nur zusammen mit gleicher Folgennummer. Nicht gebaut.

## Die drei Adressen aus dem Bericht

- **Jormungand (12413, B0DNCF1M3N) und Kuroko 2 (16894, B09ZJW8HGH):** Alle 24 Zeilen je Adresse tragen `vorhanden = 'nein'` (Seite nicht geladen, laut Notiz „nicht mehr im Abo“). Der Worker liefert sie nicht aus (`worker/src/rohfolgen-seiten.ts`, `offenAusPrime`); der Zuordner sieht sie nie. Kein Fehler: Diese Folgen sind dort nicht abspielbar. Der „Gewinn 5 → 9 / 23 → 24“ des Berichts rechnete mit den gesperrten Zeilen (1.209 Zeilen / 55 Adressen); ohne sie entfällt er.
- **Z wie Zorro (3010, B0GFP5CLMN):** `vorhanden = 'ja'`, 26 Zeilen mit gemeldeter Staffel 2. Der Staffel-Riegel in `fetch-rohfolgen.ts` (gemeldete Staffel ab 2 bei einem Reihenkopf) übergeht die Gruppe; Z wie Zorro ist ein einziger Eintrag mit 52 Folgen, die Adresse steht seit der ersten Zuordnung als `…B0GFP5CLMN#1` mit 21 Folgen im Bestand. Möglicher Zugewinn: 1 Folge. Nicht angefasst: Den Riegel für Einzeltitel zu lockern träfe auch Titel, deren zweite Staffel nur fehlt.
