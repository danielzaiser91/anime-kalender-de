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

## Die drei Adressen aus dem Bericht

- **Jormungand (12413, B0DNCF1M3N) und Kuroko 2 (16894, B09ZJW8HGH):** Alle 24 Zeilen je Adresse tragen `vorhanden = 'nein'` (Seite nicht geladen, laut Notiz „nicht mehr im Abo“). Der Worker liefert sie nicht aus (`worker/src/rohfolgen-seiten.ts`, `offenAusPrime`); der Zuordner sieht sie nie. Kein Fehler: Diese Folgen sind dort nicht abspielbar. Der „Gewinn 5 → 9 / 23 → 24“ des Berichts rechnete mit den gesperrten Zeilen (1.209 Zeilen / 55 Adressen); ohne sie entfällt er.
- **Z wie Zorro (3010, B0GFP5CLMN):** `vorhanden = 'ja'`, 26 Zeilen mit gemeldeter Staffel 2. Der Staffel-Riegel in `fetch-rohfolgen.ts` (gemeldete Staffel ab 2 bei einem Reihenkopf) übergeht die Gruppe; Z wie Zorro ist ein einziger Eintrag mit 52 Folgen, die Adresse steht seit der ersten Zuordnung als `…B0GFP5CLMN#1` mit 21 Folgen im Bestand. Möglicher Zugewinn: 1 Folge. Nicht angefasst: Den Riegel für Einzeltitel zu lockern träfe auch Titel, deren zweite Staffel nur fehlt.
