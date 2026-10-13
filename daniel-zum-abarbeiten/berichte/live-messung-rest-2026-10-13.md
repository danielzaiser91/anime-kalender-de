# Live-Messung Rest 13.10.2026 (Durarara-Specials, Tachikoma 2005, Afro Samurai Movie, deutsche Folgenzahl)

Gemessen 13.10.2026 gegen `origin/main` 506064017 (`meta.generatedAt` 14:44Z) und `https://anime-kalender.de/data/*.json` (`meta.generatedAt` 14:56Z, gleiche Felder). Live trägt eigene Kennungen (`id` 4527 für AniList 8408), Zuordnung über `tr`/`malId`. Der eine aniSearch-API-Abruf (`/v1/anime/4405,1119,5473,6984,6986,875`, mit Token) ist der einzige Abruf bei aniSearch; keine Seite von aniSearch, Netflix, Prime, Disney+ oder freenet geholt, Archivseiten nur lokal gelesen. Wegwerfskripte: Scratchpad `…/live-rest/`.

Erwartet hatte `listen/anisearch-doppelte-kennung.md` (12.10.): drei Bindungen von Dominik (06.10.) seien „fraglich, nicht eindeutig belegt“, nachmessen nach dem nächsten Abruf.

## 1. Durarara!! Specials (AniList/MAL 8408, 2 Folgen) — Bindung bleibt, Zeilen heil

- aniSearch-API: Bonus-Seiten **6984** (Tenmou Kaikai, 25.08.2010) und **6986** (Tenka Taihei, 23.02.2011) tragen beide MAL 8408; die Serie 5473 trägt MAL 6746. Der Handeintrag `8408: 5473` bindet also die Serie, nicht die Seiten des Specials.
- Datensatz = live: 8408 `anisearchId` 5473, `dubConfidence very-high`, „Auf Deutsch, ≈ 2 Folgen“, aniSearch-Link `…/anime/5473,durarara`; die Zeilen 10006984/10006986 stehen in `titles.json` (nicht in `ohne-synchro.json`, anders als die Liste vom 12.10. sagte) mit Beez-Erstausgabe und deutschem Titel, Links auf 6984 bzw. 6986.
- Versuch: `8408: 6984` (früheste Teilung wie Fairy Tail OVA). `tools/bau-vergleich.mjs 506064017 975e70c1a` (VERSCHIEDEN, 30 Dateien; die Sprecher-Dateien und das Protokoll tragen nur den Stand vom Tag): die Zeile 10006984 verliert titleDe „Gottes Mühlen mahlen langsam, aber sicher“, Slug wird „heaven-s-vengeance“, `dubConfidence` high → normal, 8408 bekommt Wertung 71 und andere Schlagwörter dieser einen Folge. Schlechter als vorher, **verworfen**; der Eintrag bleibt, die Begründung steht jetzt als Kommentar an der Zeile.
- Rest (kein Fehler, Entwurf): ein Werk steht dreifach da (8408 plus zwei Zeilen). Eine saubere Lösung braucht eine Regel für 1 AniList-Titel : 2 aniSearch-Seiten (Zeilen wegfallen lassen, Erstausgabe/Titel auf 8408 übernehmen); eigener Auftrag, nicht angefasst.

## 2. Ghost in the Shell: S.A.C. / Tachikoma 2005 (10947, 1 Folge) — fraglich, nicht widerlegt, unverändert

- aniSearch 4405 = „Bonus, 26“, 2002–2003, **MAL 1335** (das ist unser Titel 1335, „Der Alltag der Tachikoma“, hängt ebenfalls an 4405); 6847 = 2004 (2nd GIG); 15092 = 2007 (TV, 12); 875 = Laughing Man (OVA 2005, MAL 2449). Keine Seite trägt MAL 10947.
- Datensatz = live: 10947 `anisearchId` 4405 (Handbindung), `dubConfidence normal`, `einzelquelle`, „Auf Deutsch verfügbar“ ohne Anbieter; Link `…/anime/4405,…`. Die deutsche Aussage stammt allein von der Seite der 26 Kurzfilme; ob die DVD „Der Alltag der Tachikoma“ (Panini 2005) das Special aus 2005 enthält, ist nicht belegt.
- Nicht geändert: nichts widerlegt es, die Kennzeichnung „normal/Einzelquelle“ steht schon da.

## 3. Afro Samurai the Movie (13709, 2007, 1 Film) — fraglich, nicht widerlegt, unverändert

- aniSearch kennt zur Reihe 1119 (Serie, MAL 1292, 5 Folgen), 5008 (Resurrection), 7847 (Pilot Film); keine Seite trägt MAL 13709, die Beziehungen der Serie nennen keinen Film von 2007.
- Datensatz = live: 13709 `anisearchId` 1119, `dubConfidence normal`, `einzelquelle`, „Deutsch synchronisiert“, Link `…/anime/1119,afro-samurai`. Die deutsche Fassung ist die der Serie (Dybex/Leonine); ob der Kinozusammenschnitt auf Deutsch erschien, ist nicht belegt.
- Nicht geändert, gleiche Begründung wie 2. Wer es klären will: Dominik fragen, ob 4405 bzw. 1119 die beiden Titel absichtlich mit abdecken.

## 4. Deutsche Folgenzahl live (PR 1024) — erledigt

- Live `synopses/22.json` (Kirby) und `synopses/29.json` (Wundersame Geschichten) tragen `deFolgen`: Kirby n 52 („Anime 52 Folgen in 2 Staffeln“, fernsehserien.de), Wundersame n 26 („26 tlg. US-jap. Zeichentrickserie“).
- Panel live (Playwright, Handy 393 px, ohne Service Worker): Kirby „52 von 100 Folgen auf Deutsch“ + „Laut fernsehserien.de: „Anime 52 Folgen in 2 Staffeln““; Wundersame „26 von 41 Folgen auf Deutsch“ + „Laut fernsehserien.de: „26 tlg. US-jap. Zeichentrickserie““.
- Gegenprobe ohne `deFolgen` (`berechneAntwortMitDeFolgen` gegen die Live-Daten): beide zeigten nur „teilweise, Rest unbelegt“ ohne Zahl — die Anzeige kommt also tatsächlich aus der neuen Zahl.

## Nebenbefund

Die fünf „vorübergehend doppelten“ Paare (BeyWheelz, Spycies, Titipo Titipo 2, Rick and Morty: The Anime, Rohirrim) sind geheilt: je nur noch der AniList-Titel in `titles.json`, keine aniSearch-Zeile (`ohne-synchro.json` ohne Kennung). Die „Offen“-Zeile in `datensatz.md` ist nachgeführt.

Schätzung vs. Ist: geschätzt 60 min, Ist ca. 75 min (Bauvergleich stand 15 min in der Schlange).
