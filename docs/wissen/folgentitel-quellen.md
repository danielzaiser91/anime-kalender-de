# Folgentitel: woher sie kommen, wo sie fehlen, welche Quelle die beste ist (04.10.2026)

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

## Umsetzung

- **Stufe 1 gebaut am 04.10.2026** (`pipeline/bau/folgentitel-cr.ts`, eingebunden in `folgen-dateien.ts`): Titel je Folgennummer über die `guid` der deutschen Folge (`crunchyroll-dub.json`) und die `versions`
  der archivierten Antwort; nur für Titel mit **eigenem** Crunchyroll-Weg, eindeutigen Nummern und höchstens so vielen wie die Folgenzahl (wie die Synchro-Bereiche). aniSearch-Titel bleiben;
  Platzhalter („Episode 1") fallen weg; fehlt die Liste ganz, entsteht sie aus Crunchyroll. **Gemessen an den echten Daten: 6 der 43 TV-Lücken** (Ascendance of a Bookworm, Black Torch,
  Inept Villainess, Jaadugar, Das Band der Unterwelt, Tomb Raider King nach Platzhalterfilter vermutlich nicht), weitere 21 Titel mit teilweise leeren Listen.
- **Offen — Stufe 1b:** Serien, die sich **mehrere Staffeln einen Crunchyroll-Weg teilen** (`sharedWith`: Mushoku Tensei, Iruma-kun, Black Clover …), brauchen die Staffelzuordnung: Die Titel stehen
  in der Antwort je Staffel (`episodes[staffelId]`), die Zuordnung Staffel ↔ Bestandstitel liegt in `bau/09-4`; dort sollte das Ergebnis je Staffel bleiben, statt es hier neu zu raten.
- **Offen — Stufe 2:** TMDB als dritte Stufe (nur echte Titel, 14 der 43 Lücken), danach Wikipedia für Langläufer.
