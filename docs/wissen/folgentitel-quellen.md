# Folgentitel: woher sie kommen, wo sie fehlen, welche Quelle die beste ist (04.10.2026; Stand und Regel „nur deutsch" ab 24.10.2026 unten)

Anlass: Daniel (04.10.2026) an Hana-Kimi S2: Auch nach dem aniSearch-Lauf fehlen „für viele Serien" die Folgentitel
(`anisearch.de/anime/21327,…/episodes` führt keine); er schlug Wikipedia vor und bat, Quellen zu suchen und die beste zu wählen.

## Messung (Datensatz vom 04.10.2026, `public/data/folgen/*.json`)

- 2.785 Bestandstitel, **1.768 mit Folgenliste**, davon 1.681 vollständig betitelt, 7 teilweise, 80 ohne jeden Titel.
- **1.097 Titel ohne Folgentitel — aber 692 davon sind Filme, 146 Specials, 162 OVAs, 52 ONAs.** Ein Film hat keine Folgentitel.
  **Echte Lücke: 43 TV-Serien (1,5 % des Bestands).** Davon sind rund 25 Serien der laufenden Saison 2026 bei Crunchyroll
  (Saga of Tanya S2, Ascendance of a Bookworm, Mushoku Tensei S3, Iruma-kun, Black Clover S2 …), dazu Prime-/Netflix-Serien
  und einige ältere TV-Titel (Cat's Eye, Koalabärchen, Gantz …). Ursache der Saison-Lücke: aniSearch trägt Titel erst ein, wenn
  Folgen gelaufen sind und jemand sie pflegt.

## Kandidaten

| Quelle | Sprache | Abdeckung für unsere Lücke | Kosten, Bedingungen | Urteil |
|---|---|---|---|---|
| **Crunchyroll, deutsche Fassung** (API, Sprache `de-DE`) | deutsch, **genau die Titel der Synchro** | alle Crunchyroll-Serien; die Antworten liegen schon archiviert (`data/crunchyroll-raw/*.de.json.gz`, 1.402 Dateien, in den ersten 300 tragen 3.071 von 3.072 Folgen einen `title`) | **keine zusätzlichen Abrufe**, dieselbe Antwort wie für die Synchro-Messung | **beste Quelle für die 2026er-Serien** |
| aniSearch (`/episodes`) | deutsch/englisch/japanisch | bleibt Hauptquelle (1.681 vollständige Listen) | im Takt-Budget | behalten; wo leer, springen die anderen ein |
| TMDB (`/tv/{id}/season/{n}`, `language=de`) | deutsch, wo Übersetzer waren; sonst Platzhalter „Folge N" | `data/tmdb-folgen.json`: 858 Einträge, 740 mit ≥ 50 % echten Titeln; für die 43 Lücken **14** mit echten Titeln | kostenlos nur nicht kommerziell, Attribution Pflicht, Cache höchstens 6 Monate | **Rückfall** (Platzhalter „Folge N" nie übernehmen) |
| Erweiterungs-Meldungen (D1 `prime_folge.titel`) | deutsch, wie im Dienst | Prime, Netflix, Disney+ — nur, was Daniel geöffnet hat | liegt im Worker, nicht im Repo | später für Prime/Netflix-Lücken, nicht für die Fläche |
| Wikipedia (de), „Episodenliste" | deutsch (Fernsehtitel), mit Datum | in `de.wikipedia.org` tragen **rund 54 Anime-Seiten** eine Liste (Kategorie „Liste (Anime)" 54, Titelsuche 54); heute 7 genutzt | frei (CC BY-SA, Quellenangabe) | **richtig, aber schmal:** nur Langläufer (One Piece, Conan, Naruto …) und Fernsehtitel; für die Saison-Lücke nutzlos |
| AniList (`streamingEpisodes`) | englisch | alle | Nutzungsbedingungen (siehe `quellen.md`) | keine deutschen Titel — ungeeignet |
| TheTVDB, fernsehserien.de, AniDB | deutsch | gut | TheTVDB Lizenz, fernsehserien.de untersagt Abruf, AniDB sperrt schnell | nicht verwenden |

## Entscheidung

**Primär bleibt aniSearch; wo es keinen Titel hat, kommt der deutsche Titel aus Crunchyroll (aus den bereits archivierten API-Antworten),
danach TMDB (nur echte Titel), Wikipedia nur für die Langläufer, für die es eine Liste gibt.** Wikipedia ist nicht die beste Quelle: Es gibt
dort nur rund 54 Anime-Listen gegenüber 43 Lücken, die zu 60 % Crunchyroll-Serien der laufenden Saison sind.

## Langläufer ohne Folgenzahl (24.10.2026)

`tmdbFolgentitel` übernimmt auch Titel **ohne** `episodes` (Shin-chan, Beyblade X), wenn die Staffeln ab 1 hintereinander gelegt die durchgehende Nummerierung ergeben: unsere Nummern genau 1 bis N, N = Summe aller TMDB-Staffeln (Staffel 0 zählt nicht), Staffel- und Folgennummern lückenlos, Staffel 1 beginnt im Beginnjahr, erste Sendetage streng aufsteigend. Sonst keine Titel.

**Reihenfolge:** Ohne Folgenzahl fehlt die Gegenprobe, dass TMDB-Nr. n unsere Nr. n ist (Anthologie Halo Legends: TMDB-Nr. 1 „Die Ursprünge“, unsere Nr. 1 „Der Babysitter“). Darum prüfen die bei uns schon vorhandenen Titel (aniSearch, Crunchyroll, Kitsu) die Nummern: Gleicht einer dem TMDB-Titel (deutsch oder englisch) einer **anderen** Nummer statt der eigenen, gibt es nichts, und mindestens die Hälfte der vorhandenen Titel muss der eigenen Nummer gleichen (Name gleich oder enthalten, oder die Hälfte der Wörter ab vier Buchstaben gemeinsam und dieselben Zahlen). Eine bloß andere Übersetzung zählt nicht als Widerspruch, belegt die Reihenfolge aber auch nicht. **Grenze:** Hat eine Serie gar keinen vorhandenen Titel in dem Bereich, gibt es keinen Vergleich; dann gilt allein die Staffelrechnung. Sie liegt falsch, wenn TMDB die Staffeln in anderer Reihenfolge als die Sendung führt und Summe, Beginnjahr und Sendetage trotzdem passen (Anthologien); bei einem Langläufer mit Dutzenden vorhandener Titel (Shin-chan im Stand von #1944: 66 von 1.092 Nummern) würde eine solche Abweichung am Vergleich scheitern.

Gegenprobe (Stand `bf4f3df0b`, 24.10.2026, `npx tsx tools/tmdb-ohne-zahl-bilanz.ts bf4f3df0b`): an allen 871 Titeln mit Eintrag und Folgenzahl, Folgenzahl weggelassen, vorhandene Titel aus der Folgendatei: alte Regel gibt bei 513 Titeln etwas, neue bei 333; 333 identisch, 0 abweichend, 180 strenger (davon 22 vom Vergleich der vorhandenen Titel abgewiesen, u. a. Halo Legends 6867; mehrere sind bloß anders übersetzt oder haben denselben Titel zweimal in der Serie), 0 neu. Die Messung ist nicht unabhängig, weil die Folgendatei Titel enthält, die die alte Regel selbst gesetzt hat.

Wirkung erst, wenn `data/tmdb-folgen.json` Einträge für diese Titel hat (Abruf: #1948).

## Umsetzung

- **Stufe 1 gebaut am 04.10.2026** (`pipeline/bau/folgentitel-cr.ts`, eingebunden in `folgen-dateien.ts`): Titel je Folgennummer über die `guid` der deutschen Folge (`crunchyroll-dub.json`) und die `versions`
  der archivierten Antwort; nur für Titel mit **eigenem** Crunchyroll-Weg, eindeutigen Nummern und höchstens so vielen wie die Folgenzahl (wie die Synchro-Bereiche). aniSearch-Titel bleiben;
  Platzhalter („Episode 1") fallen weg; fehlt die Liste ganz, entsteht sie aus Crunchyroll. **Gemessen an den echten Daten: 6 der 43 TV-Lücken** (Ascendance of a Bookworm, Black Torch,
  Inept Villainess, Jaadugar, Das Band der Unterwelt, Tomb Raider King nach Platzhalterfilter vermutlich nicht), weitere 21 Titel mit teilweise leeren Listen.
- **Stufe 1b gebaut am 01.11.2026 (`folgentitel-cr-geteilt.ts`, Abschnitt unten):** Serien, die sich **mehrere Staffeln einen Crunchyroll-Weg teilen** (`sharedWith`: Mushoku Tensei, Iruma-kun, Black Clover …), brauchen die Staffelzuordnung: Die Titel stehen
  in der Antwort je Staffel (`episodes[staffelId]`), die Zuordnung Staffel ↔ Bestandstitel liegt in `bau/09-4`; dort sollte das Ergebnis je Staffel bleiben, statt es hier neu zu raten.
- **Offen — Stufe 2:** TMDB als dritte Stufe (nur echte Titel, 14 der 43 Lücken), danach Wikipedia für Langläufer.

## Stand und Regel „nur deutsch" (24.10.2026)

Der Stand vom 04.10. oben ist überholt: Stufe 2 (TMDB, `folgentitel-tmdb.ts`) und Kitsu (`folgentitel-kitsu.ts`, nur noch Folgenlängen) sind gebaut; Stufe 1b ist offen geblieben.

- **Regel (Daniel, F57, 24.10.2026: „nur deutsche, so schnell wie möglich die deutschen folgentitel nachholen, aktuellen bestand einmal komplett beheben"):** Eine Zeile der Folgendatei trägt den deutschen Titel (`de`: aniSearch, Crunchyroll de-DE, TMDB de) oder gar keinen. Der frühere Rückfall `de ?? en ?? ja` ist abgeschaltet (`folgentitel-zeilen.ts`, `folgenZeilen`); Kitsu liefert keine Titel mehr; ein Crunchyroll-/TMDB-Titel, der dem englischen oder japanischen aniSearch-Titel der Folge gleicht, gilt nicht als deutsch (`mitCrTiteln`). Die Oberfläche zeigt eine Folge ohne Titel als „—" (alle leer: „Die Folgentitel liegen noch nicht vor.").
- **Wirkung am Bestand (Bau vom 24.10.2026, 41.597 Folgen in 1.807 Dateien):** Rückfälle aus aniSearch 4.081 → 0; Folgen mit Titel 40.932 → 36.747, leere Folgen 665 → 4.850. Wächter: `check:logic` (Fälle „Nur deutsch") und `check:bestand` (`pipeline/check-folgentitel-sprache-bestand.ts`, zählt Zeilen, deren Titel dem en/ja der aniSearch-Folge gleicht, wo diese keinen deutschen Titel hat; muss 0 sein).
- **Erreichbare Obergrenze:** Von ≈ 4.861 Lückenfolgen liegen 3.210 in Folgen ohne belegte deutsche Synchro (kein deutscher Titel zu erwarten), nur **1.651 in 78 Titeln** in belegt deutschen Folgen. Nur diese sind noch zu füllen (Bericht `daniel-zum-abarbeiten/berichte/folgentitel-deutsch-2026-10-24.md`).
- **Rechtslage der Alternativen:** JustWatch: Nutzungsbedingungen verbieten „data mining, robots, scraping or similar data gathering" (trotz offener robots.txt) — nicht verwenden. Wunschliste (`wunschliste.de`): Impressum erlaubt Vervielfältigung nur „mit schriftlicher Genehmigung" — nicht ohne Genehmigung. Erweiterungs-Meldungen decken 0 % der Lücke. Offen als eigener Schritt: TMDB auf die 294 Lückentitel ausdehnen (PR 1938 für laufende Serien).
- **Vorschlag, nicht umgesetzt:** Noch nicht erschienene Folgen (Marronniers: 16 von 19 leeren) gar nicht erst in die Dateien aufnehmen.
- **Lücke des Wächters (Stand 24.10.2026, Folgeschritt):** `check-folgentitel-sprache-bestand.ts` fängt nur Titel, die dem aniSearch-`en`/`ja` exakt gleichen. Gemessen am Bestand (36.747 Titel vor dem Platzhalterfilter): 3 sichere englische Zeilen ohne diese Gleichheit (116673 Folge 1 und 2, 395 Folge 10), 30 Zeilen gleich einem Kitsu-Titel (27 davon in 13185, Transformers-Kurzwörter, wohl legitim), 744 gleich dem TMDB-`en` (überwiegend Lehnwörter, nicht einzeln geprüft). Platzhalter („Ohne Titel", „Untitled", „Folge N", „Episode N") stehen nicht mehr in den Dateien (`istPlatzhalter`); Flowers of Evil (16201) trug 13× „Ohne Titel" aus Crunchyroll.
- **Folgeauftrag (offen, 25.10.2026):** Der Wächter soll englische Titel auch ohne exakte Gleichheit mit aniSearch-`en` erkennen (`mitCrTiteln` vergleicht exakt): die 3 sicheren Zeilen (116673 F1/F2, 395 F10) als Testfälle, die 30 Kitsu- und 744 TMDB-gleichen Zeilen stichprobenartig prüfen. Dazu 7 Folgendateien mit 34 doppelten Folgennummern (zwei aniSearch-Reihen in einer Datei). Steht in `stand.md` unter „Als Nächstes“.

## Laufende Serien: TMDB-Abruf nach 6 Tagen statt 30 (24.10.2026)

Anlass: „Die sieben Ritter des Königreichs der Marronniers" (AniList 212799) hatte 4 Folgen, aber nur Folge 1 einen Titel; `data/tmdb-folgen.json` war am 12.10. geholt (Folgen 2–3 dort „Folge N"), der nächste Abruf wäre erst nach 30 Tagen gekommen (ebenso Overgeared 212888).

- `pipeline/lib/tmdb-folgen-auswahl.ts` (`waehleFaellige`, geprüft von `check-tmdb-folgen-auswahl.ts`): Ein Eintrag ist zusätzlich fällig, wenn der Abruf mindestens 6 Tage alt ist (6 statt 7, damit ein einen Tag früher startender Wochenlauf ihn nicht um eine Woche verschiebt; Prüfer 1938) und eine Folge der Staffeln ab 1 mit TMDB-Datum in den letzten 21 Tagen (bis heute) keinen echten Titel trägt (leer, Platzhalter nach `PLATZHALTER` aus `bau/folgentitel-tmdb.ts`, oder gleich dem englischen). Diese Titel stehen vor den übrigen, damit sie unter `--limit 300` nicht hinter den 30-Tage-Fälligen verhungern.
- Das 21-Tage-Fenster ist nötig: ohne es wären 368 von 817 Kandidaten jede Woche fällig (alte Serien, deren Titel bei TMDB dauerhaft englisch sind). Mit Fenster, Stand 24.10.2026: Wochenlauf hätte vorher 11, nachher 31 Titel fällig (20 frisch fällig); alle 20 liegen unter dem Limit 300. Die 30-Tage-Welle (803 am 07.11., alles am 06.10. geholt) übersteigt das Limit weiterhin; sie läuft über mehrere Wochenläufe aus.

## TMDB-Abruf für Lückentitel ohne Eintrag (24.10.2026, F57)

Anlass: Bericht `daniel-zum-abarbeiten/berichte/folgentitel-deutsch-2026-10-24.md`: 252 der 339 Titel mit Titellücke hatten keinen Eintrag in `data/tmdb-folgen.json`, weil der Abruf nur Titel mit Anbieter (`streams`) nahm; 191 davon sind reine Heimvideo-Synchros ohne Anbieter, 126 haben keine `tmdbId` in `data/tmdb-titles.json` (die suchen wir hier nicht, das macht `data:tmdb`).

- `pipeline/lib/tmdb-folgen-luecke.ts` (`dubLuecke`, `waehleLuecke`, `waehleAbrufe`; geprüft von `check-tmdb-folgen-luecke.ts` und, mit dem echten Lauf gegen eine Kulisse, `check-tmdb-folgen-luecke-lauf.ts`): Lückentitel = Folgen im belegt deutschen Bereich (`de` der Folgendatei) mit leerem oder Platzhalter-Titel. Ohne Eintrag, mit `tmdbId`, keine Filme, mehr als 1 Folge, auch ohne Anbieter: sie stehen vor den regulär Fälligen, größte Lücke zuerst.
- Riegel: höchstens `LUECKE_LIMIT` = 128 Lückentitel je Lauf (900 Abrufe ÷ 7 je Titel; Ø 2,06 Staffeln je Eintrag, je Titel 1 Serien-Abruf plus deutsche und englische Liste je Staffel) und überall das bestehende `--limit`. TMDB-Grenze (developer.themoviedb.org/docs/rate-limiting, 24.10.2026): keine feste Quote mehr, Obergrenze ≈ 40 Anfragen/s, 429 beachten; der Abruf pausiert 120 ms (≈ 8/s).
- Probelauf: lokal `npx tsx pipeline/fetch-tmdb-folgen.ts --nur-luecke --limit 20` (braucht den TMDB-Schlüssel, in CI nicht erreichbar). In CI reicht `daten-auf-abruf.yml` nur `--limit` durch: `gh workflow run daten-auf-abruf.yml --repo danielzaiser91/anime-kalender-de -f lauf=data:tmdb-folgen -f grenze=5` holt wegen der Reihenfolge (Lückentitel zuerst) genau die ersten 5 Lückentitel; ein Eingang `--nur-luecke` im Workflow gibt es nicht (nur zu ändern, wenn kein Sammler läuft).
- Gezählt (24.10.2026, Auswahl ohne Netz, `heute` = 24.10.): Stand main `545a8ff07` (Folgendateien noch mit englischem Rückfall): 56 Titel mit Dub-Lücke, davon Eintrag da 28, keine `tmdbId` 22, Film 3, neu abrufbar 3 (Edgerunners 2, Bleach TYBW, Tank Chair) mit 17 Lückenfolgen. Stand #1944 `f310f9fa6` (nur deutsche Titel): 84 / 44 / 30 / 5 Filme / 5 abrufbar mit 1.042 Lückenfolgen; dazu kommen Shin-chan 966 und Beyblade X 165159 (ohne `episodes`, holt der Abruf trotzdem). Auf main haben beide keine leere Lücke, weil Rückfalltitel die Lücke verdecken; die 1.042 gelten erst nach #1944.
- Riegel gilt auch mit `--nur-luecke` (höchstens 128, egal welches `--limit`).
- Fehlschläge: ein Abruf, der mit 5xx, 429, 403 oder Netzfehler scheitert, schreibt nichts; der Titel bleibt im nächsten Lauf dran. Nur die Antwort 404 auf den Serien-Abruf ist eine Auskunft (25.10.2026: AniList 195539 Edgerunners 2 → TMDB 326788 und 185874 BLEACH Kashin-tan → TMDB 333069 belegten bei `--limit 5` jeden Lauf zwei Plätze): sie schreibt einen Negativvermerk `{tmdbId, geprueft}` in `data/tmdb-folgen-404.json` (eigene Datei, damit kein Leser von `tmdb-folgen.json` eine leere Folgenliste sieht; Leser des vermerks: nur `waehleAbrufe` und `tools/tmdb-ohne-zahl-bilanz.ts`, das ihn als Lückengrund „TMDB 404“ getrennt zählt). Der Titel bleibt `--alter` Tage (Standard 30) draußen und ist am 30. Tag wieder dran; ein Vermerk zu einer anderen `tmdbId` zählt nicht, ein Erfolg räumt ihn ab (`lib/tmdb-folgen-404.ts`, geprüft von `check-tmdb-folgen-404.ts` und `check-tmdb-folgen-404-lauf.ts`).
- Nur deutsche Titel: der Abruf schreibt wie bisher `titel` (de-DE) und `en`; ausgespielt wird im Bau nur, was `echterTitel` (`bau/folgentitel-tmdb.ts`) durchlässt, also weder leer noch „Folge N" noch gleich dem englischen Titel. Ein Lückentitel bekommt den Abruf einmal (kein Eintrag → Eintrag); danach gilt die Grundfrist nur, wenn er einen Anbieter hat.

## Lückenfolgen im deutschen Bereich schließen und halten (01.11.2026)

Anlass: Beyblade X trug ab Folge 66 keine Titel, obwohl `data/rtlplus-folgen.json` sie führt. Ursache: Keine Stufe las RTL+; der Rest „Lücke füllen“ aus dem Bericht vom 24.10. (Schritte 3 und 4) war nach dem Listenabgleich aus `stand.md` gefallen.
Gemessen mit Wegwerfskript auf dem Stand `public/data/folgen/*.json` vom 01.11.2026: 1.649 Folgen ohne Titel im deutschen Bereich in 86 Titeln (davon Shin-chan 962, Beyblade X 57); Nachbau der Stufen auf diesen Zeilen: 1.511 in 70 Titeln (ohne die neuen Stufen 1.619).

- **RTL+ (`folgentitel-rtlplus.ts`):** `nr` ist durchgezählt über alle Staffeln. Gilt nur, wenn mindestens drei vorhandene Titel auf RTL+-Nummern liegen und vier Fünftel gleichen (`folgentitel-abgleich.ts`); eine Staffel mit eigener Zählung ab 1 fällt so heraus. Beyblade X: 56 von 57 Lückenfolgen; Nummer 102 (Staffel 3 Folge 2) führt RTL+ nicht.
- **Crunchyroll, mehrere Staffeln je Verweis (`folgentitel-cr-geteilt.ts`):** genau eine Staffel mit lückenlosen Nummern (auch 25…36), erstem deutschen Tag im Beginnjahr, höchstens unserer Folgenzahl und derselben Staffelzahl im Namen wie unser Titel (Aoashi Staffel 1 und 2 starten beide 2026); widersprechen drei oder mehr vorhandene Titel, gibt es nichts. Nur Serienformate.
- **Handzuordnung (`data/folgentitel-hand.yaml`, `folgentitel-hand.ts`):** letzte Stufe, füllt nur Lücken; je Eintrag Fundstelle, Pflichtfelder und doppelte Folgen prüft `handFehler` (der Bau wirft). 13 Folgen (Disney Twisted-Wonderland 8, Kishibe Rohan 4 aus TMDB, Urusei Yatsura S2 Folge 4 aus ADN).
- **Restliste mit Grund je Titel: `data/folgentitel-offen.json`** (70 Titel, 1.511 Folgen). Die Zahl je Titel darf nur sinken: `lib/folgentitel-luecke-bestand.ts` (aus `check-folgentitel-sprache-bestand.ts`) meldet mehr Lücken, einen ungelisteten Titel, einen RTL+-Titel, der in der Datei fehlt, und eine zu hohe Liste als `⚠ WARNUNG`-Zeile. Rot nur bei fehlender Liste.
- **Verworfen:** Shin-chan (962): TMDB und aniSearch ordnen die Teilgeschichten ab Folge 2 in anderer Reihenfolge (bei 130 vorhandenen Titeln nur 2 gleich nach Sendedatum), ab Folge 131 hat TMDB nur „Folge N“; Pokémon Folge 161: aniSearch führt den TMDB-Titel schon unter 160; Halo Legends: Anthologie, Titel 5–8 nicht eindeutig.
- **ADN** (`data/adn-raw/*.json.gz`, Feld `name`) liefert deutsche Titel je Staffel mit Zählung ab der Reihe (Urusei Yatsura S2: 24…46); als Stufe nicht gebaut, weil nur ein Titel in der Lücke liegt (Super Cube trägt dort „Folge N“).
