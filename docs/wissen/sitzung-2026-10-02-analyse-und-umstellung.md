# Sitzung 02.10.2026 — Gesamtanalyse, Quellenfrage und Umstellung auf aniSearch

Festgehalten am 02.10.2026, 23:00 Uhr, damit nichts aus Analyse, Diskussion und Zwischenplan verloren geht, solange wir auf die Antwort
von aniSearch (Token) warten. **Wann lesen:** vor jeder Arbeit an der aniSearch-Anbindung, an der Frage „was heißt belegte Synchro",
an MyDubList, an der ID-Brücke oder am Plan der Datenbereinigung. Ergänzt [karte.md](karte.md), [befund-2026-10-02.md](befund-2026-10-02.md),
[architektur-bewertung.md](architektur-bewertung.md) und den Abschnitt „aniSearch hat eine freie Database-API" in [quellen.md](quellen.md).

## 1. Auftrag und Lieferung

Daniel: Projekt lesen, Funktionsweise verstehen, alle Probleme auflisten (Playwright, Desktop und Mobil), Architektur kritisch bewerten,
**vor allem Datenfehler** suchen, vollständige Doku, verbesserte Skills/Instructions. Geliefert (Commit `86012c070` und Folgecommit):
`karte.md`, `befund-2026-10-02.md`, `architektur-bewertung.md`, Skill `.claude/skills/anime-kalender-orientierung`, Verweis in `CLAUDE.md`,
`tools/daten-befund.mjs` (unabhängige Gegenprobe), aufbewahrte Messskripte in `tools/archiv/analyse-2026-10-02/`.
Vorgehen vereinbart: **erst alles besprechen, dann ein Plan, dann eins nach dem anderen.**

## 2. Kernbefund in einem Satz

Die Seite behauptet an mehreren Stellen mehr, als die eigenen Daten belegen („2.783 Anime mit *belegter* Synchro" bei nur 1.606 belegten),
und die Bauprüfung merkt es nicht, weil sie nur bekannte Fehlerarten prüft. Größte Lücke: `pipeline/lib/pruefung.ts` kennt keine
**Invarianten** (eindeutige Slugs, Titel vorhanden, eindeutige Folgennummern, Datum monoton, Zahlen in `meta.json`). Einzelheiten B-01…B-13 im Befund.

## 3. Was wir im Detail geklärt haben (Beispiele, Belege)

### 3.1 Zählwort „belegte Synchro" (Befund B-01) — fünf Sichtungsbeispiele
115 Titel haben keinen einzigen Beleg (kein Stream, Termin, Disc-Termin, aniSearch-Eintrag/-Marke, Weg, Ankündigung); Verteilung
`low` 49, `normal` 27, `high` 14, `very-high` 25. Beispiele: Yu☆Gi☆Oh! (1998), Xiao Mao Diao Yu (1952), Koori no Jouheki 2nd Season (2026), Mahoyome (2017),
Berserk – Das goldene Zeitalter. Im Hauptbestand stehen sie, weil **MyDubList** (Community-Liste, nach MAL-ID, Stufen `low…very-high`,
`pipeline/fetch.ts` → `data/cache/dub-confidence.json`) sie als deutsch führt.

### 3.2 Beispiel 1 — Yu☆Gi☆Oh! ist ein **falscher Eintrag** (MyDubList irrt)
Gemeint war die Toei-Serie von **1998 (27 Folgen, „Season 0")**, nicht *Duel Monsters* (2000+, 224 Folgen). Season 0 gab es **nie auf Deutsch**:
aniSearch (Seite 482) hat nur einen japanischen Sprachblock (live geprüft und in `data/anisearch.json`), die deutsche Wikipedia schreibt
„nur in Japan ausgestrahlt". Duel Monsters (AniList 481) ist bei uns korrekt belegt (Universal Pictures Germany, 2003–2006, 3 Wege).
MyDubList (`normal`-Stufe) führt trotzdem MAL 550 *und* 481. Daniel erkannte den Fehler am MAL-Screenshot („Yu-Gi-Oh! Season 0").
→ **Eine einzelne Fremdliste kann falsche Titel in den Bestand bringen; wir übernehmen sie ungeprüft.**

### 3.3 Beispiel 2 — Die kleinen Angler (Xiao Mao Diao Yu, 1952): wahr, aber nicht verbunden
aniSearch [19985](https://www.anisearch.de/anime/19985): chinesischer Film, Shanghai Animation Film Studio, **deutsche Fassung 20.08.1954**, Status abgeschlossen.
Wir haben keine aniSearch-Kennung (die ID-Brücke kennt ihn nicht), deshalb nur MyDubList, `low`. Die DDR-/DEFA-Angaben aus Geminis Antwort sind **ungeprüft** und
für den Beleg unnötig. Über die MAL-Kennung (43342) wäre er verbindbar.

### 3.4 Beispiel 3 — Cat's Eye (1983): Ursache der fehlenden aniSearch-Daten
Kette: AniList führt zwei Einträge (**2043: 36 Folgen**, **146310 „2nd Season": 37 Folgen**); MAL und aniSearch führen **ein Werk mit 73 Folgen**
(aniSearch 2213, deutsche Erstausstrahlung RTL II 13.11.1995, alle 73 Folgen synchronisiert). Unsere Brücke (`loadIdMap()` in `pipeline/fetch-anisearch.ts`)
nimmt aus der anime-offline-database nur Datensätze, in denen **AniList- und aniSearch-Adresse zusammen** stehen. Dort hängt aniSearch 2213 nur an MAL 2043, die beiden
AniList-Einträge an nichts → keine Verbindung → aniSearch-Seite nie geholt → Panel verlinkt nur die aniSearch-**Suche** (`detail/verweise.ts:45`), zeigt 36 Folgen
und die Staffel 2 steht gar nicht im Hauptbestand (gestrichelt als „ohne Synchro", falsch). Die `malId` jedes Titels wird von der Brücke **nicht** genutzt.
Maßzahlen: 150 von 2.783 Hauptbestandstiteln ohne Kennung (108 davon Filme); eine MAL-Brücke findet nur **12** (u. a. Cat's Eye S1, Die kleinen Angler), 138 bleiben offen.
Vorsicht: Bei einigen MAL-Treffern weichen Folgenzahlen ab (Saint Seiya Part 2: 6/12, Pretty Guardian Sailor Moon Cosmos Teil 1: 1/2) → prüfen, nicht blind übernehmen.

### 3.5 MyDubList-Triage der 115 (grob, nur lesen)
aniSearch deutscher Block: 5 Titel (Calimero, Buschbabies, Die 3 Musketiere, Der goldene Feuervogel, Goldwing). Wikipedia-Hinweis auf deutsche Fassung (ungenaue
Textsuche, Serienebene): 22 Titel. Weder noch: 66 (darunter Yu-Gi-Oh! 1998). Von Hand bestätigt: **Cat's Eye** (RTL II 1995, 73 Folgen), **Monsuno** (Nickelodeon ab
02.06.2012, deutsche Sprecher), **Berserk-Filme** (Universum Anime, deutsche Tonspur). Vermutlich falsch durch „Erben von der Hauptserie": Maison Ikkoku OVA,
Rozen Maiden Kun-Kun. 62 der 115 haben gar keinen aniSearch-Eintrag bei uns (Brückenlücke, siehe 3.4). Rohtabelle: Messskript `mdl-nur-triage.cjs`.
**Offen:** die 22 Wikipedia-Treffer einzeln prüfen, ob die Fassung den Titel selbst betrifft.

## 4. Frage „Mehrwert von AniList gegenüber aniSearch" — Messung

- Wo beide einen Titel führen, stimmen Basisfakten: Folgenzahl 2.572 von 2.621 gleich, Startjahr 2.520 von 2.583 gleich. Abweichungen: Sonic X (AniList 52, aniSearch 78 =
  deutsche Zählung), Hamtaro (193/296), Baki Hanma S2 (27/13), Stone Ocean Teil 2 (26/12) — **jede Quelle irrt gelegentlich**.
- aniSearch-HTML enthält Genres/Nebengenres/Tags, Cover (`cdn.anisearch.de/images/anime/cover/…_600.webp`), Bewertung, Relationen, Charaktere; unser Parser liest nur
  Sprachen, Format, Folgen, Laufzeit, Saison, Studios, Staff, Vorlage, Websites, Synonyme. Das Roharchiv (`data/anisearch-raw`, 3.190 Dateien, 30,7 MB) erlaubt Nachlesen ohne neue Anfragen
  (`npm run data:anisearch:reparse`). Kein Banner bei aniSearch (AniList: 2.123 Banner).
- **Deutsche Sprecher:** bei **582** Titeln ausschließlich von AniList, 1.164 AniList+ANN, 218 nur ANN. Daniel: aniSearch listet sie auch — bestätigt: `/anime/<id>,<name>/seiyuu`
  (Cat's Eye: Hitomi → Schaukje Könning, Ai → Silvia Missbach; Eyeshield 21: Sena → Grischa Olbrich) und per API `/{id}/characters`.
- Was AniList sonst allein liefert: Katalog der 15.147 Titel „ohne Synchro" und frühe Ankündigungen, Staffelgranularität (36+37), der Schlüssel `id` in Adressen, Favoriten (localStorage und D1),
  ICS-Kennungen, Push-Abos. **Daniel: Schlüsselwechsel ist im Aufbau verkraftbar (Breaking Change akzeptiert).**
- MAL dient nur als Brücke (MyDubList, manami, ANN). Ohne MyDubList und mit der aniSearch-Zuordnung über `/associated` entfällt es als Pflicht.

## 5. Einheit „Werk" (73) oder „Staffel" (36+37)?
Daniel prüfte MAL: 73. Beide stimmen für verschiedene Einheiten; die deutsche Ausstrahlung war ein Werk (73). Daniels Neigung: **voll auf aniSearch wechseln** (Werk). Vorbehalt von mir:
aniSearch teilt Staffeln teils selbst (Eyeshield 21 / GX getrennt, Stone Ocean Teil 2 mit 12 Folgen), der Kalender braucht oft die Einheit des Anbieters (Cour/Teil).
**Offen:** Stichprobe an ~30 Mehrstaffel-Serien (Attack on Titan, Mushoku Tensei, Re:Zero, Slime …), wie aniSearch sie schneidet; Regel für „eine aniSearch-Seite, mehrere AniList-Titel"
(Folgenzahl und Datum nicht auf einen Teil kopieren, nur deutscher Block gilt für beide).

## 6. Scraping-Stand (gemessen 02.10.2026) und die Wende durch die API

- **Heute:** 3.190 aniSearch-Seiten (Hauptbestand 2.631 von 2.632 mit Brücke; Katalog 559 von 11.597 mit Brücke; 3.550 Katalogtitel und 150 Hauptbestandstitel ohne Brücke). Abruf: 1 Seite je 6 s
  (aniSearchs eigenes API-Limit; 60/min führte am 09.08.2026 zur Sperre, am 19.09. wies aniSearch die nackte Projektkennung mit HTTP 423 ab), 120 Seiten im Tageslauf, 60 im Wochenlauf,
  **Wiedervorlage 30 Tage** (laufend, nicht einmalig: Lizenzen laufen aus); zusätzliche Seitentypen: Folgen (`anisearch-folgen`, 2.631 Dateien/37,5 MB), Titelabgleich (`anisearch-titel`).
- **Schätzung per Seitenlesen (6 s):** Sprecherseiten Hauptbestand 2.632 → 4,4 h (≈ 22 Tage bei 120/Tag); Katalog 11.038 → 18,4 h (≈ 92 Tage); alles (≈ 21.100) → ≈ 35 h (≈ 175 Tage).
- **Wende:** `api.anisearch.com` — **Database-API ohne Konto nutzbar**, Token optional per Mail; `/associated?source=myanimelist` (komplette Brücke, 1×/24 h), `/titles`, `/{id}/full` (Details, Folgen,
  Figuren, Sprecher je Sprache), Bereich/Liste bis 10 IDs mit Token; Limits 30 Anfragen/IP, +1/s; Pflicht-User-Agent; aniSearch als Quelle nennen, Synopse mit Link direkt daneben.
  Mit Token: ≈ 2.100 Anfragen für alle ≈ 21.000 Einträge (Schätzung aus den Limits, ungemessen).
- **Stand:** Daniel hat am 02.10.2026 (~22:55) die Token-Mail an `api@anisearch.com` abgeschickt. **Wir warten auf die Antwort.** Der Kopfkommentar in `fetch-anisearch.ts` (OAuth/Konto nötig) ist überholt, noch nicht korrigiert.

## 7. Entscheidungen und offene Fragen

| Thema | Stand |
|---|---|
| Vorgehen: erst besprechen, dann Plan | **entschieden** (Daniel) |
| Schlüsselwechsel AniList → aniSearch | Daniel: verkraftbar, im Aufbau; **Umsetzung erst nach Token-Antwort** |
| Bilder von aniSearch | Daniel: aniSearch hat sie; Empfehlung: selbst hosten statt Hotlink (offen) |
| Einheit Werk vs. Staffel | Neigung Werk (73); **Stichprobe offen** |
| MyDubList | Daniel: komplett streichen, außer es gibt einen Fall „einzige Quelle und stimmt". Gefunden: Cat's Eye, Monsuno, Berserk-Filme (alle über Wikipedia bestätigt, nicht durch MyDubList). Mein Vorschlag: nach der Brückenreparatur messen, ob aniSearch sie ebenfalls abdeckt; wenn ja, streichen. **Entscheidung offen** |
| Zählwort: streng „belegt" mit zwei Zahlen, oder 115 aus dem Hauptbestand? | **nicht entschieden** |
| 917 westliche Serien (Cartoons) im „Anime-Kalender" | **nicht entschieden** (Frage gestellt, unbeantwortet) |
| Rechtsprüfung Datenschutzerklärung (C-04), Lizenzen ODbL/MyDubList (C-05) | **nicht beauftragt** |
| Pilot Cat's Eye (beide AniList-Einträge → aniSearch 2213) | angeboten, **nicht ausgeführt** |

## 8. Vorläufiger Plan (nach Token-Antwort anzupassen)

**Phase 0 — jetzt, ohne aniSearch (kleine, klare Schritte):**
1. Bauprüfung schärfen (`pruefung.ts` + Zusicherungen in `check:logic`): eindeutige Release-Slugs, Titel vorhanden (`titleId < 0` nicht mehr überspringen), eindeutige Folgennummer je Release,
   Datum monoton in der Folgennummer, `meta`-Zahlen = Dateien, Termine ohne Release. Vorlage: `tools/daten-befund.mjs`.
2. Termine reparieren: Hana-Kimi S2, Polar Opposites S2 (Folge 8 dreimal), Pokémon Reisen TOGGO plus (doppelter Slug), Lycoris Recoil (Folge 6), Crunchyroll Anime Awards (kein Titel).
3. Kleinigkeiten mit Messlatte: Cartoons mit Zukunftsjahr/negativer ID-Gruppe, Disc-Suchadressen beschriften oder auflösen, News-Datum aus dem Release ableiten, `localStorage`-Absicherung in `App.tsx:76,106`, Touch-Ziele 44 px.
**Phase 1 — nach Token (Test eine Stunde):** `/associated` und `/{id}/full` für Cat's Eye, Die kleinen Angler, Yu-Gi-Oh! Season 0 ansehen; prüfen, ob sich alles ableiten lässt, was wir heute aus AniList und HTML nehmen.
**Phase 2 — Brücke und Synchro-Angabe:** Brücke über `/associated` (MAL), Regel für Mehrfachzuordnung, Pilot Cat's Eye (inkl. Staffel 2), Zählwort an Belegklassen binden, MyDubList herabstufen/streichen, Triage der 115 abschließen.
**Phase 3 — Umstieg in Stufen** mit Gleichheitsbeweis (`bau-vergleich.mjs`): Metadaten (Genres, Tags, Cover, Score), Sprecher (`/characters`), Schlüsselwechsel (Adressen, Favoriten-Migration in Browser und D1, ICS, Push), Bilder selbst hosten.
**Phase 4 — Betrieb:** Sicherheit (getrennte Tokens, Header, Hosting), Ladelast-Wächter (< 300 KB), `events.json` teilen, Datenschutz und Lizenzen (nach rechtlicher Prüfung), Doku-Zahlen generieren statt schreiben.

## 9. Nicht geprüft in dieser Sitzung (ehrliche Lücken)

Newsletter-Formular und Double-Opt-in im Betrieb, Gültigkeit der ICS-Feeds in Google/Outlook, Service Worker und Offline-Betrieb (für die Messung blockiert), dunkles Design und englische
Oberfläche, Tastatur- und Screenreader-Prüfung (axe), Monats- und News-Ansicht im Detail, Handy-Suche (Skript brach ab), Code-Review der Erweiterung und der Workflows, `npm audit`, Anbieter-Wahrheit selbst
(Netflix/Prime/Disney+/Crunchyroll), Drosselung/Langsamnetz.

## 10. Umgebung

Bash-Werkzeug: `ls/wc/head/tail/cat/git` werden durch ein fehlendes `rtk` ersetzt (Exit 127), `node` fehlt im PATH; Abhilfe: `"/c/Program Files/nodejs/node.exe"` und `"/c/Program Files/Git/cmd/git.exe"`.
Tavily-Suche lieferte HTTP 429. Messskripte: `tools/archiv/analyse-2026-10-02/` (Beschreibung in der README dort).
