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

## 7b. Klärungsliste — wird mit Daniel der Reihe nach abgehakt (Stand 02.10.2026, 23:30)

Vereinbarung (Daniel): Erst die vier Punkte vom Abend und die „liegen geblieben"-Liste klären, bevor Neues beginnt. **Driftet das Gespräch ab, wird das Neue unten unter „Geparkt" festgehalten und wir kehren hierher zurück.**

| # | Punkt | Stand |
|---|---|---|
| 1 | „Bauprüfung" erklärt (= `pruefeErgebnis()` am Ende des Datenbaus; fünf Invarianten fehlen) | erklärt; Umsetzung = Phase 0, **Freigabe offen** |
| 2 | Alles dokumentieren | **erledigt** (dieses Dokument, `quellen.md`, `status.md`, `tools/archiv/analyse-2026-10-02/`) |
| 3 | MyDubList: wofür brauchen wir es noch? | **in Klärung.** Drei Kandidaten (Cat's Eye, Monsuno, Berserk-Filme). **Cat's Eye bestätigt** (73 Folgen deutsch, Prime-Meldung `9713`, §7c). **Monsuno bestätigt** (YouTube kostenlos, 26 Folgen Staffel 1, §7d, eingetragen). **Berserk-Filme bestätigt** (nur Disc, kein Streaming, §7e, eingetragen). Damit sind alle drei Kandidaten bestätigt — jeweils **nicht durch MyDubList**. Danach: die übrigen Wikipedia-Kandidaten (§3.5) abarbeiten, dann streichen/herabstufen entscheiden |
| 4 | Liegengebliebenes | siehe 4a–4l |

Liegengeblieben (4a–4l): a) Zählwort streng/zwei Zahlen/115 heraus · b) 917 Cartoons · c) Einheit Werk/Staffel + Stichprobe 30 Serien · d) Pilot Cat's Eye (inkl. zweite Staffel) · e) Triage der 22 Wikipedia-Treffer ·
f) Befunde B-02…B-11 beheben · g) Rechtsprüfung Datenschutz/Lizenzen · h) ungeprüfte Bereiche (§9) · i) Kopfkommentar `fetch-anisearch.ts` + `ARCHITEKTUR.md`/`TODO.md`/`ZIELE.md` · j) `rtk`-Hook und `node`-PATH ·
k) Token von aniSearch · l) Live-Test der Schnellfilter-Vorlieben (gebaut, `9d3e06e6e`).

**Geparkt (Abschweifungen, hier festgehalten):** Schnellfilter als Vorlieben — Daniels Wunsch, umgesetzt, nur der Live-Test (4l) steht aus. Trailer-Handüberschreibung und Zulässigkeit von Fan-Kanälen (Berserk, §7e).

### Wo wir stehen geblieben sind (03.10.2026, 00:05 Uhr)

Punkt 3 (MyDubList) ist für die **drei Kandidaten abgeschlossen**: Cat's Eye (Prime-Meldung `9713`), Monsuno (YouTube, §7d), Berserk-Filme (Disc, §7e) — alle von Daniel bestätigt, **keiner über MyDubList belegt**; Daniel hat alle Berserk-/Monsuno-Links gegengelesen („alle richtig").
**Weiter am 03.10.2026 mit:** (a) den übrigen 19 Wikipedia-Kandidaten (§3.5) *oder* gleich der Entscheidung über MyDubList, dann (b) Punkt 4a Zählwort, danach 4b…4l der Reihe nach.
Eingetragen und gepusht: Monsuno (`fe6c74804`), Berserk (`6da45aa92`, `67e54dbba`), Schnellfilter-Vorlieben (`9d3e06e6e`). Live erst nach dem nächsten Datenlauf (Daten) bzw. Deploy (Schnellfilter).

### B1 entschieden (03.10.2026, 11:42): MyDubList fliegt **komplett** raus — nach Detailanalyse

Daniel: „Ich will, dass MyDubList komplett rausfliegt, und mir mit dir zusammen vorher alle Konsequenzen angucken, ganz genau im Detail, sodass nichts rausfliegt, was drin bleiben sollte, aber alles rausfliegt, was falsch ist."
**Befund der Bestandsaufnahme (03.10.2026, gemessen):**
- MyDubList bestimmt heute: (1) die **Mitgliedschaft im Hauptbestand** (`pipeline/fetch.ts`, `bau/01-quellen.ts`, `bau/02-titel.ts`: Liste ∪ `synchro-von-hand.yaml`/Kuratiertes); (2) das Feld `dubConfidence` (4 Stufen) mit Folgen in
  `shared/logic.ts:145-179` (Statusberechnung „erschienen" bei beendeter Serie, nicht bei `low`), dem Filter „Zuverlässigkeit" (`FilterDetails.tsx:658`, `filters.ts:191,398`, Adresse `conf`), der aniSearch-Reihenfolge (`fetch-anisearch.ts`);
  (3) Text `detail.dubProof` „Synchro belegt über MyDubList"; (4) Quellenseite/`meta.attribution` (CC BY 4.0); (5) `tools/bau-vergleich.mjs`, `check-logic.ts`.
- **Belegstufen des Hauptbestands (2.783):** A stark 1.655 (Stream/Termin/Handbeleg/Urteil/Netflix-Tonspur), B mittel 1.012 (aniSearch-Marke, Sprecher, Disc/Kino/Ankündigung, JustWatch; davon 70 allein durch Sprecher),
  **C schwach 39** (deutscher Block ohne Marke / nur Shop), **D nichts 77**. Kandidaten zum Verlassen: C + D = **116** — jeder einzeln zu belegen oder zu widerlegen, **bevor** etwas geändert wird.
- **Katalog (15.147, hinter dem Schalter):** für **keinen** gibt es heute Belege ausser einem Handbeleg (Our Last Crusade S2) — die Prüfdaten (JustWatch, Urteile, Tonspuren, aniSearch) existieren fast nur für den Hauptbestand. „Nichts fehlt, was rein sollte" ist deshalb erst mit der **aniSearch-API über alle Titel** prüfbar (Token).
**Vorgehen:** (1) Beleg-Hauptbuch je Titel (Spalten je Beleg) → (2) die 116 einzeln prüfen (Wikipedia, Videobuster, aniSearch, Daniels Sichtung), Blätter zur Freigabe → (3) neue Mitgliedsregel (ein Prädikat, getestet) → (4) Umbau hinter Gleichheitsbeweis: Vorher-nachher-Liste muss genau der freigegebenen entsprechen →
(5) Folgen im Code und auf der Seite (siehe oben) → (6) Doku, Quellenseite, Attribution. Regel-Entwurf „bleibt": mindestens ein Beleg aus Stream-dub/Termin/Handbeleg/aniSearch-Marke/Sprecher/Disc-Veröffentlichung/Ankündigung; „nur Shop" und „deutscher Block ohne Marke" zählen nicht, solange nichts sie bestätigt.

### Messung der aniSearch-Marke „Synchronisiert" als einziger Beleg (03.10.2026, 11:51)

224 von 2.783 Titeln haben die Marke als **einzigen** Beleg ([Liste](../../daniel-zum-abarbeiten/marke-einziger-beleg.md)). Stichprobe 50 (zufällig, fester Startwert 20261003), Prüfweg: aniSearch-Sprecherseite `/anime/<id>/seiyuu` (deutsche Sprecher = Flagge `de`; geeicht an Eyeshield 21 mit 134, Cat's Eye 73, Yu-Gi-Oh! 1998 mit 0)
und deutsche Wikipedia (Artikeltitel muss passen). **Ergebnis: 34 bestätigt (68 %), 0 widerlegt, 16 offen (32 %).** Von den 34 tragen 29 deutsche Sprecher bei aniSearch, 5 nur ein Wikipedia-Abschnitt „Synchronisation" (Agent Aika, Mirai Nikki OVA 2, Bauzi, Gon, Haru o daiteita —
bei Specials/OVAs gilt der Abschnitt womöglich nur der Hauptserie). Die 16 offenen sind fast alle alt (1975–1989: Jakobus Nimmersatt, Chack der Biber, Pippo, Vier schöne Schwestern, Der gestiefelte Kater reist um die Welt — Verlag Ostalgica/Progress Film = DDR) oder neue Disc-Specials (Trinity Seven OVA, Joker Game, Aoharu×Machinegun, Infinite Stratos OVA, Sengoku Basara Special);
bei einem davon (One Piece Fan Letter) hat Daniel an Netflix „kein Deutsch" gemessen. **Lesart:** keine Gegenbeweise, aber ein Drittel nicht bestätigbar; ältere Titel sind in Deutschland praktisch immer synchronisiert, neue Specials oft nur untertitelt. Liste: [marke-pruefung-sample.md](../../daniel-zum-abarbeiten/marke-pruefung-sample.md).

**Alle 224 geprüft (03.10.2026, 12:17):** **158 bestätigt (70,5 %)**, **0 widerlegt**, **66 offen**, 0 Abruffehler. Bestätigt durch deutsche aniSearch-Sprecher: 145; nur durch einen Wikipedia-Abschnitt „Synchronisation": 13.
Die 66 offenen: 23 aus der Zeit vor 1990 (in Deutschland praktisch immer synchronisiert), 30 ab 2010 (meist neue Specials/OVAs auf Disc oder Streaming — hier ist Untertitel-only möglich), 13 dazwischen. Nach Format: 22 Special, 21 Film, 11 OVA, 5 TV, 5 ONA, 2 TV-Short.
Liste zum Prüfen: [marke-pruefung-alle.md](../../daniel-zum-abarbeiten/marke-pruefung-alle.md). Die Stichprobe (68 %) hat das Gesamtbild vorhergesagt.

### Plan 03.10.2026 — getrennt nach Zuständigkeit

**A. Kann ich selbstständig bearbeiten (keine Entscheidung nötig; nichts davon wird ohne Vorlage der Ergebnisse festgeschrieben, was Daniel entscheidet):**
1. Live-Test der Schnellfilter-Vorlieben mit Playwright (Desktop und Handy), sobald der Deploy durch ist.
2. Die 19 übrigen MyDubList-Kandidaten einzeln prüfen (Wikipedia, Videobuster, fernsehserien.de) und als Tabelle vorlegen.
3. Stichprobe an ~30 Mehrstaffel-Serien: wie schneidet aniSearch sie (Werk oder Staffel)? (Grundlage für Entscheidung c).
4. Bauprüfung schärfen: fünf Invarianten in `pruefung.ts` (eindeutige Slugs, Titel vorhanden, eindeutige Folgennummern, Datum monoton, `meta`-Zahlen), jede mit nachgestelltem Fehlerfall in `check:logic`. *(Daniel hat Phase 0 noch nicht ausdrücklich freigegeben — vor Beginn kurz bestätigen lassen.)*
5. Ladelast-Wächter in `check:vor-commit` (Startdaten < 300 KB) und Vorschlag zur Teilung von `events.json` (93 % Vergangenheit).
6. Kleinbefunde mit Messlatte: Cartoons mit Zukunftsjahr, Gruppe `id % 32` bei negativen IDs, `localStorage`-Absicherung `App.tsx:76,106`, Fehlerzustand statt leer in `lib/data.ts`, Touch-Ziele 44 px, Fußnote „News-Datum aus dem Release ableiten".
7. Doku nachführen: Kopfkommentar `fetch-anisearch.ts`, `ARCHITEKTUR.md`, `TODO.md`, `ZIELE.md` (Zahlen mit Datum).
8. Terminfehler untersuchen (Ursache zuerst, dann Vorschlag): Hana-Kimi S2, Polar Opposites S2, Pokémon Reisen TOGGO plus, Lycoris Recoil.
9. Ungeprüfte Bereiche prüfen (§9): Newsletter-Formular, ICS-Feeds, Dunkelmodus, englische Oberfläche, Barrierefreiheit (axe), `npm audit`.
10. aniSearch-Zugang ohne Token: **zwei** Testabfragen (`/associated`, `/{id}/full` für Cat's Eye) — erst nach Daniels kurzem OK (fremder Dienst).

**B. Mit Daniel zu besprechen / zu entscheiden:**
1. MyDubList: komplett streichen oder als „unbestätigter Hinweis" herabstufen (Empfehlung: streichen, sobald Brücke steht; kein Fall gefunden, in dem es allein etwas wusste).
2. Zählwort „belegte Synchro" (4a): streng mit zwei Zahlen, oder die 115 Titel ohne Beleg aus dem Hauptbestand nehmen.
3. 917 westliche Serien (Cartoons) im „Anime-Kalender": behalten, getrennt führen oder entfernen.
4. Einheit Werk (73) oder Staffel (36+37), abhängig von A3.
5. Monsuno-Kanal „Monsuno Deutsch": offiziell? Weg behalten oder entfernen.
6. Trailer: Fan-Kanäle zulassen? Handüberschreibung `trailer-von-hand.yaml` bauen?
7. Disc-„Kaufen" als Amazon-Suche (138 von 159): beschriften, auflösen oder entfernen.
8. aniSearch: Token abwarten (Mail vom 02.10.), danach Brücke/Umstieg planen; Bilder selbst hosten statt Hotlink.
9. Rechtsprüfung Datenschutzerklärung (Push, Favoriten-Abgleich, TMDB-Bilder, YouTube) und Lizenzen (ODbL, MyDubList, AniList, JustWatch) — wer prüft?
10. Betrieb: getrennte Tokens und Header statt `?token=` (Worker-Deploy), Hosting zu Cloudflare (Sicherheits-Header, Bildproxy), Vorlieben über Geräte abgleichen (`/prefs`).
11. `rtk`-Hook und `node`-PATH in der Bash-Einrichtung.

## 7d. Fall Monsuno (13185) — von Daniel am 02.10.2026, 23:35 Uhr geprüft: bestätigt

Monsuno (2012, Staffel 1 „World Master", 26 Folgen) hat **nur einen Weg: YouTube, kostenlos**, Playlist „Monsuno Staffel 1 | Deutsch/German", Kanal „Monsuno Deutsch" (@monsunodeutsch), alle 26 Folgen,
beginnt bei Folge 1, 360p ([Playlist](https://www.youtube.com/playlist?list=PLGFlb1G8-ThNpiqdBrJZdVMG4V6MlTT74)). Kein anderer Anbieter, Discs nur englisch.
„Alle 26" stimmt für die deutsche Fassung, obwohl die Serie 65 Folgen in 3 Staffeln hat (Wikipedia, fernsehserien.de): Im deutschen Fernsehen lief **nur Staffel 1** (Nickelodeon, 02.06.2012 bis 20.04.2013, erste Sendung „Clash",
gegengelesen auf fernsehserien.de/monsuno/sendetermine/nickelodeon); Staffel 2 „Combat Chaos" und 3 gibt es nicht auf Deutsch. Das erste Video heißt laut oEmbed „Monsuno S1 E01 Clash | Deutsch/German" — passt zur ersten Sendung.
**Eingetragen** (nicht live bis zum nächsten Datenlauf): `data/dub-confirmed.yaml` (dub: true) und `data/verweise-von-hand.yaml` (YouTube, kostenlos). **Offen:** ob der Kanal der Rechteinhaber ist (Linkpolitik wie bei TOGGO/Daima);
Daniel entscheidet. **Lehre für das Zählwort:** Monsuno ist ein Titel, den MyDubList richtig führte und den kein anderer Datensatz kannte — Beleg kam von Hand und aus fernsehserien.de, nicht aus MyDubList.
Fernsehserien.de ist als Quelle für „lief im deutschen Fernsehen" brauchbar (Sendetermine je Sender), nicht als Beleg für Streaming.

## 7e. Fall Berserk – Das goldene Zeitalter I–III (10218, 12113, 12115) — von Daniel geprüft, 02.10.2026 ~23:55: bestätigt, nur Disc

**Ergebnis:** Deutsche Synchro **nur auf Disc**, **kein Streaming** gefunden (Daniel). Videobuster nennt je Teil „Deutsch Dolby Digital 5.1, Japanisch Dolby Digital 5.1" mit deutschen Untertiteln
(Teil 1 Erscheinen 26.10.2012, Teil 2 16.08.2013, Teil 3 laut Videobuster-Verleih 08.08.2014); Wikipedia: Universum Anime, Teil 3 am 27.06.2014, Sprecher Guts Marcel Collé, Griffith Nico Mamone, Casca Anja Stadlober;
„anders als die Serie (1997) enthalten die Filme eine deutsche Tonspur". Gefunden hat Daniel die Angebote über werstreamt.es ([Film 110269](https://www.werstreamt.es/film/details/110269/berserk-das-goldene-zeitalter/)) —
dessen robots.txt untersagt das automatische Auslesen, deshalb nur von Hand übernommen.
**Weg zu den Daten:** *Nicht* über MyDubList und nicht über aniSearch — alle drei Filme haben **keine aniSearch-Kennung** in der Brücke (drei weitere Fälle der Lücke aus §3.4, diesmal Filme), und
`watchLinks` waren leer. Eingetragen (live erst mit dem nächsten Datenlauf, `check:handbelege` danach):
`data/erstausgabe-von-hand.yaml` (deutsche Erstausgabe + `synchro: true`, 3 Einträge) und `data/watch-links.yaml` (Videobuster, Verleihshop, Amazon Blu-ray/DVD/Trilogie, alles `kind: buy`; Videobuster/Verleihshop sind Leih-Discs per Post).
Amazon: Blu-ray B008UE8ICK / B00JCG4ZXG / B00JCG4ZZO, DVD B00A7W8WYC / (Teil 2: nicht gefunden) / B00JCG501C, Trilogie (3 DVDs) B075YL2RJ6. Verleihshop-Seiten sind hinter Cloudflare nicht lesbar; Daniels URLs tragen keine Parameter (nichts zu bereinigen),
die Zuordnung Teil 1/2/3 folgt seiner Reihenfolge.
**Zweiter Befund — Trailer:** Die Seite zeigt für alle drei Filme **englische** Trailer (Warner Bros., vizmedia, Crunchyroll Store Australia; mit Hinweis „Trailer in Englisch"). Daniel fand deutsche:
[I](https://www.youtube.com/watch?v=WcBrfOmBb7Q) „Deutscher Trailer" (Kanal BerserkFanVideo — Fan-Kanal), [II](https://www.youtube.com/watch?v=Yw_fs-O_-Ck) „Trailer (Deutsch | German)" (Movieport), [III](https://www.youtube.com/watch?v=mOPE5FpsfKA) „Niedergang – Deutscher Trailer" (BerserkFanVideo).
Unser Trailer-Lauf (`pipeline/fetch-trailer.ts`: KinoCheck, TMDB-Videoliste, Label-Kanäle) findet Fan-Uploads nicht. **Offen/geparkt:** Handüberschreibung für Trailer (`data/trailer-von-hand.yaml`?) und Regel, ob Fan-Kanäle zulässig sind.
**Lehre für das Zählwort:** Alle drei Filme sind belegt, aber **ohne** MyDubList und aniSearch; MyDubList hat sie nur zufällig richtig geführt. Zusammen mit Cat's Eye und Monsuno: kein einziger Fall, in dem MyDubList etwas wusste, was Wikipedia, Videobuster, fernsehserien.de oder Daniels Sichtung nicht auch lieferte — spricht für Streichen, sobald die Brücke steht.

## 7f. Neuer Befund 03.10.2026, 00:20 — Slime Staffel 4: Prime-Kanal „24 Folgen deutsch", Crunchyroll 22 (Aufgabe für morgen)

Daniel mit Bild: Panel zu „Staffel 4 – Teil 1" (Slime): „Nächste Folge (Folge 23) … am 09.10.2026 um 17:00", „22 von 24 Folgen erschienen", Pillen **Crunchyroll ✓ 22 Fg.** und **Prime Video (Crunchyroll) ✓ 24 Fg.** Daniel prüfte
auf Crunchyroll: Folge 22 erschien am 02.10. auf Deutsch, Folge 23 nur Englisch-Dub, Folge 24 nur OmU — 24 deutsche Folgen bei Prime sind unmöglich. Vorläufige Fakten (nicht ausgewertet): Daniel meldete die Prime-Seite `B0GDGLLYLS` erneut (02.10., 24 Meldungen `9714…`,
„alle 24 Folgen geprüft … ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg"); am 29.09. kam dieselbe Staffel unter `B0CHH3X5QB` (Meldung 9261, ohne Zuordnung). Im Datensatz: Prime-Weg mit `kanal: Crunchyroll`, `dub: true`;
Handbeleg vom 25.08.2026 Folgen 1–15. **Zu klären:** warum eine Kanal-Meldung, die sich selbst als „kein Beleg" kennzeichnet, trotzdem als Folgenbeleg zählt; wo die 24 entstehen; ob andere Prime-Kanal-Titel dasselbe zeigen.
Eintrag in `status.md` (Queue). Gehört zum Themenkreis „Anbieter-Zuordnung" und „Wahrheit je Folge" (Meldemodell, `docs/konzept-meldungen-architektur.md`).

## 7g. Fall Gundam Wing: Endless Waltz — Fassungsbeziehung statt „falsch gelistet" (03.10.2026, 12:30)

**Sachverhalt (Daniel, mit aniSearch-Bild):** Zwei Einträge für **denselben Inhalt**: das OVA „Shin Kidou Senki Gundam W: Endless Waltz" (1997, 3 × 30 Min., AniList 91, aniSearch 1861) und der Kompilationsfilm „Gundam Wing: Endless Waltz" (1998, 90 Min., AniList 2273, aniSearch 1024).
Deutsche Synchro gibt es nur für den **Film** (polyband, 27.10.2003, Marke, Sprecher, DVD `B0000D7ZII`); für das OVA findet Daniel auch nach ausgiebiger Suche keine. aniSearch zeigt unter „Episoden" des OVA deutsche Titel (Stille Bahn / Operation Meteor / Kehren Sie für immer zurück) — kein Beleg für eine Synchro.
**Anders als Yu-Gi-Oh!:** dort zwei *verschiedene* Produktionen (Season 0 1998 / Duel Monsters 2000), MyDubList behauptete Synchro für beide; hier **derselbe Inhalt, zwei Schnitte**.
**aniSearch modelliert das bereits maschinenlesbar:** Relation „Zusammenfassung" (OVA → Film), Gegenrichtung „Komplette Geschichte", dazu die Anmerkung am Film: „Kompilationsfilm aus den drei OVA-Folgen … um zusätzliche Szenen angereichert, Änderungen am Soundtrack". Im Archiv: 336 „Zusammenfassung", 53 „Komplette Geschichte" (gleicher Inhalt) gegenüber 309 „Alternative Version" (andere Produktion, z. B. Yu-Gi-Oh! 1998 → Duel Monsters).
**Gemessen — wie verlässlich ist „aniSearch hat keinen deutschen Block / keine Marke"?** Von 1.575 Titeln mit hartem Beleg von außerhalb (Stream/Handbeleg/Urteil/Tonspur) tragen 1.553 die Marke (98,6 %), 18 einen Block ohne Marke, **4 keinen Block** (Code Geass Picture Drama 2, Space Dandy 2 Picture Drama, The Birth of Kitaro 2023, Lord of Mysteries 2026 — Specials und sehr neue Titel).
Gegenrichtung im Hauptbestand: von 59 Titeln mit aniSearch-Eintrag **ohne** Block haben 4 harte Belege, 10 Sprecher (z. B. Bakuretsu Hunters), 45 nichts. „Kein Block" ist also ein **starkes Indiz, kein Beweis**.
**Beziehungen der 116 Kandidaten zu Titeln mit Marke:** nur 5 — Gundam-OVA (Zusammenfassung → Film), Gurren Lagann: Gurren-hen (Komplette Geschichte → TV), Hunter×Hunter 1999, Yu-Gi-Oh! 1998, Dr. Slump 1981 (je „Alternative Version"). Das Muster „MyDubList führt eine andere Fassung derselben Reihe mit" erklärt also nur wenige der 116.
**Behoben:** `data/watch-links.yaml`: Film 2273 bekommt `Amazon (DVD)` `https://www.amazon.de/dp/B0000D7ZII` (statt nur „Ausgabe bei aniSearch" → Titelseite). Live nach dem nächsten Bau; ob der aniSearch-Notbehelf dann entfällt, ist zu prüfen.
**Vorschlag (Daniel entscheidet):** beide Einträge bleiben (aniSearch 100 % abbilden); jeder bekommt **sein eigenes, wahres Urteil** plus eine **Fassungsangabe**: OVA → hinter „Anime ohne deutsche Synchro", Text „Keine eigene deutsche Fassung bekannt. Auf Deutsch gibt es den Inhalt als Kompilationsfilm ‚Gundam Wing: Endless Waltz' (90 Min.)" mit Link; Film → „Zusammenfassung der drei OVA-Folgen". Automatisierbar über die Relationstypen (nur *gleicher Inhalt*: Zusammenfassung / Komplette Geschichte; „Alternative Version" gilt nicht). Wortwahl „Keine deutsche Fassung **bekannt**" statt „Noch keine" (suggeriert Kommendes) oder „belegt keine" (nicht beweisbar).

## 7h. Entscheidungen zu §7g (Daniel, 03.10.2026, 12:44)

1. **aniSearch-Relationen sind eine automatisierbare Quelle** (gleicher Inhalt: „Zusammenfassung"/„Komplette Geschichte"; nicht: „Alternative Version").
2. **Fassungsangabe beidseitig umsetzen:** OVA ↔ Film verlinken; Wortlaut „**Keine deutsche Fassung bekannt**" (nicht „noch keine", nicht „belegt keine").
3. **Urteil „keine deutsche Fassung bekannt" = Wahrscheinlichkeitsurteil aus mehreren Quellen**, kein Beweis: aniSearch (kein Block/keine Marke), Wikipedia, weitere sichere Quellen (Relationen, JustWatch/Urteile/Tonspuren ohne Deutsch). Taucht später doch eine deutsche Fassung auf, wird die Regel angepasst; als erster starker Weg richtig.
4. **Die 1,4 % genauer ansehen** (Marke fehlt trotz hartem Beleg: 22 von 1.575, davon 4 ohne Block) — Detailprüfung offen.
5. **Alles, was sich automatisch bestätigen lässt, wird im Umbau mitgeplant und vor dem Livegang gegen Daniels Handmessung geprüft** (Abnahme je Regel). Vorgehen: erst die 116 Kandidaten automatisch urteilen (Urteil + Sicherheit), Daniel prüft Stichproben je Muster; bestätigt sich ein Muster, wird es für alle gleichen Fälle übernommen.
6. **Yu-Gi-Oh! 1998 („Season 0") dient als Eichfall** für den Automatismus: aniSearch ohne deutschen Block, Relation „Alternative Version" → Duel Monsters (Marke), Wikipedia „bisher nur in Japan ausgestrahlt", von Daniel von Hand bestätigt.

### Automatisches Urteil für die 116 Kandidaten (03.10.2026, 12:55)

Regel (Entwurf für den Umbau; Quellen: aniSearch-Eintrag/-Block/-Marke/Sprecherseite/Relationen, Wikipedia mit passendem Artikel, JustWatch, Anbieter-Urteile, Netflix-Tonspur): kein aniSearch-Eintrag → *unbekannt*; deutscher Block ohne Marke → *unklar*
(Publisher nur Streamer ⇒ wahrscheinlich Untertitel, Disc-Label ⇒ Synchro möglich); sonst deutsche Sprecher oder Wikipedia-Treffer (nur TV/Film ohne Relation) → *eher deutsch*; sonst *keine bekannt* mit Sicherheit hoch (mind. eine Stütze: Relation zu anderer Fassung, Wikipedia-Verneinung,
JustWatch/Anbieter/Tonspur ohne Deutsch; Titel älter als ein Jahr), niedrig (Wikipedia der Reihe nennt Synchro, keine Relation) oder mittel (keine weitere Stütze).
**Ergebnis:** 6 keine bekannt/hoch (Gundam-Wing-OVA, Hunter×Hunter 1999, Yu-Gi-Oh! 1998 = **Eichfall bestanden**, Dr. Slump 1981, Gurren Lagann: Gurren-hen, Kakegurui-Special), 30 mittel, 2 niedrig, 6 eher deutsch (Maison Ikkoku, City Hunter 3 und '91, Angeloid-Film, Aggretsuko, Digimon Adventure 20th), 32 unklar (7 nur Streamer, 25 Disc/Label), 40 unbekannt (keine aniSearch-Zuordnung).
Lehre aus dem ersten Lauf: Die Wikipedia-Seite der **Reihe** nennt „Synchronisation" für die Hauptserie — als Gegenbeleg für ein OVA/Special oder eine andere Fassung taugt sie nicht; deshalb nur bei TV/Film ohne Relation.
Liste zur Handprüfung: [kandidaten-pruefliste.md](../../daniel-zum-abarbeiten/kandidaten-pruefliste.md).

## 7i. Quellen für „es gab nie eine deutsche Lizenz/Synchro" — Recherche zu Hunter×Hunter 1999 (03.10.2026, 13:20)

Auslöser: Daniel fand bei Hunter×Hunter (1999) den Satz „Keine Lizenz … in Deutschland nie lizenziert". **Befund:** Es gibt **kein Register nicht erteilter Lizenzen**; ein Nein ist immer ein Schluss aus Abwesenheit in mehreren Quellen. Geprüft (selbst abgerufen, 03.10.2026):
- **Deutsche Wikipedia „Hunter × Hunter":** Sprecherliste und Synchronstudio nur für die zweite Serie (2011–2014, G&G Tonstudios Kaarst, 2017–2019) und die Kinofilme (TNT Media, 2016); für 1999 kein Satz zu deutscher Fassung, der Artikel nennt nur andere Ausstrahlungsländer (FR, ES, AR, IT, PT) — **brauchbarer indirekter Beleg** (Wikipedia führt Länder auf, Deutschland fehlt).
- **Deutsche Synchronkartei** (`synchronkartei.de`, `/serie/<id>`): nur „Hunter x Hunter (2011–2014) [Synchro 2017–2019]", **keine** Fassung von 1999 — gutes Negativindiz (sehr umfangreiche, aber von Freiwilligen gepflegte Kartei, nicht „vollständig"). **Nutzung eingeschränkt:** `robots.txt` sperrt `/suche`, die Rechtlichen Hinweise verbieten „automatisiertes Auslesen" und verlangen Quellenangabe. → **nur von Hand nachschlagen, nicht anbinden** (höchstens nach Erlaubnis anfragen, wie bei aniSearch). Hinweis: Die Suchseite habe ich einmal mit dem Abruf-Werkzeug gelesen, obwohl `/suche` in der robots.txt steht; nicht wiederholen, nicht automatisieren.
- **Fandom-Wiki Hunter×Hunter** (von Gemini zitiert): Abruf nicht möglich (HTTP 402), **ungeprüft**; Fan-Wiki, nur als Hinweis brauchbar. **gutefrage.net**: nicht als Beleg.
- **Argument „nie eine Meldung bei Anime2You/AnimaniA":** Schluss aus Schweigen; für uns prüfbar nur gegen das eigene Anime2You-Archiv (seit 2026), nicht über Jahrzehnte.
**Kandidaten für weitere Negativ-/Positivquellen (noch nicht geprüft):** FSK-Prüfdatenbank (jede deutsche Disc-/Kinoveröffentlichung braucht eine Freigabe — fehlender Eintrag ⇒ keine physische deutsche Ausgabe, sagt aber nichts über die Sprache; `fetch-fsk.ts` existiert), Verlagskataloge (Kazé, KSM, peppermint, Universum, AniMoon: Lizenzmeldungen), JustWatch/TMDB (kein deutsches Angebot), aniSearch-News „Lizenz".
**Lesart für die Regel:** Ein „keine deutsche Fassung bekannt, hoch" braucht **mindestens zwei voneinander unabhängige Negativindizien** (aniSearch ohne Block + eines aus: Wikipedia führt andere Fassung/Länder ohne Deutschland, Relation auf andere Fassung, Synchronkartei von Hand, kein JustWatch-Angebot, FSK ohne Eintrag).

## 7j. Ergebnis der Handprüfung, erste Runde (Daniel, 03.10.2026, 15:30)

**13 von 41 Titeln geprüft** (Liste mit allen Einzelergebnissen: `daniel-zum-abarbeiten/poc-handpruefung.md`).
- **„keine deutsche Fassung bekannt" stimmt in allen 11 Fällen ohne aniSearch-Block:** Dr. Slump 1981, Gurren Lagann: Gurren-hen (Film 2008), Kakegurui Picture Drama, Shakugan no Shana III, Ginyuu Mokushiroku, Saint Seiya: Legende der karmesinroten Jugend (Film 1988), Demon King Daimao (Specials), Tsukigakirei (Special), Maison Ikkoku (TV), City Hunter 3 und ’91.
  Die Relationsregel (gleicher Inhalt/andere Fassung) bestand damit **7 von 7**.
- **Wikipedia als Gegenbeleg („nennt Synchronisation ⇒ eher deutsch") lag in 3 von 3 Fällen falsch** (Maison Ikkoku: Sprecherliste nur für den Film, „Auf Deutsch ist nur der Kinofilm bei Kazé erschienen"; City Hunter 3/’91 nie deutsch). **Regel gestrichen:** Wikipedia zählt höchstens als *Hinweis* mit Zitat, nie als Gegenbeleg und nie automatisch ohne gelesenen Satz.
- **Die aniSearch-Marke als alleiniger Beleg stimmte 2 von 2:** One Piece Fan Letter (deutsche Synchro bei **Joyn** ansehbar, JustWatch korrekt, werstreamt.es zeigt nur ADN = Untertitel) und Trinity Seven OVA „The Seven Deadly Sins & the Seven Mages" (KSM, 20.03.2025, deutsche Synchro; Complete Edition mit Serie, beiden Filmen und OVA auf fünf Blu-rays).
**Neue Befunde (nicht automatisch lösbar, in `status.md` eingetragen):**
1. **Dragon Ball Super: Beerus (AniList 206814):** Crunchyroll startet am 11.10.2026 **nur mit Untertiteln** (Quelle: Crunchyroll Season-Lineup Herbst 2026, `crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-anime-lineup-herbst-2026`). Der Serienstart gehört als **News mit Quelle** („nur OmU, keine deutsche Synchro") in Panel und News; kein DE-Termin ⇒ nicht im Kalender, hinter „Anime ohne deutsche Synchro". Das Panel sagt heute „Noch keine deutsche Fassung · mit Untertiteln ab 11.10.2026 · Synchro offen" (richtig), die News fehlt.
2. **Kakegurui Picture Drama:** trägt den deutschen Serientitel und eine Netflix-Pille, die nur zu den zwei Hauptserien-Teilen führt (falscher Weg).
3. **Maison Ikkoku (Film 1988), Amazon-Link B000E8LZWK:** Beschreibung passt zum Film (DVD, Deutsch/Japanisch, 1 Std. 10), das Cover zeigt ein französisches Kochbuch („L'école des chefs") — Fehler in Amazons Eintrag; Verweis prüfen.
4. **Wie Gemini/Google es in Sekunden löst:** Suche + Sprachmodell lesen Wikipedia, fernsehserien.de, Amazon-Listings und fassen mit Zitat zusammen (bei Maison Ikkoku: „Auf Deutsch ist nur der Kinofilm bei Kazé erschienen", „lief nie im deutschen Fernsehen", Amazon-DVD ist der Film). Für uns nachbaubar als **„Leser mit Pflichtzitat"**: ein Modell bekommt die abgerufenen Texte (aniSearch-Seite, Wikipedia, fernsehserien.de) und liefert ein strukturiertes Urteil mit wörtlichen Zitaten, die der Bau per Textsuche in der Quelle **gegenprüft**; ohne belegtes Zitat kein Urteil. Entscheidung offen (B14).
5. **Joyn-Zugang** (Daniels Konto bis ca. 10.10.2026): „alles auf Joyn ist deutsch" ist **keine sichere Regel** (Joyn kann Untertitel-Fassungen führen) — je Titel prüfen; nützlich, um fehlende Joyn-Verweise zu finden (JustWatch führt sie).
6. **werstreamt.es** zeigt je Angebot die Sprache („Japanisch" bei ADN), ist aber per robots.txt für automatisches Lesen gesperrt (siehe `watch-links.yaml`) — nur von Hand.
7. **Amazon-Kurzadresse:** `https://www.amazon.de/dp/B07NNP4Z55` funktioniert für diese (alte) ASIN; für Prime-Videoseiten neuer Art (`0TKA5…`) gilt weiter `/gp/video/detail/…` (siehe `datensatz.md`, 20.09.2026). Kein Regelwechsel.
**Trinity Seven — Verweise, die Daniel gefunden hat (noch nicht eingetragen):** Serie (12 Folgen deutsch): Apple TV `tv.apple.com/de/show/trinity-seven/umc.cmc.7eakl74wi015vmpq0tu4a62oy`, Amazon `B07NNP4Z55` (gemeldet). Film 1 „Eternity Library & Alchemic Girl" (2017, 56 Min.): maxdome `mo40397308`, Apple TV (`umc.cmc.5y798q5s6amanhpfflfucol4b`, dort 2019/55 Min.), Amazon `0OJUVIHWYKKJRXYFBZBRU1KP78` (Kauf/Leihe + aniverse), Meldung `0QWW8SUXC8A16D6DS1QR5AV2VQ`.
Film 2 „Heavens Library & Crimson Lord" (2019, 58 Min.): maxdome `mo45311517`, Amazon `B0HFKQ7R7T` (gemeldet: **kein Deutsch**). OVA: Amazon `0TKA5TG7J16JXLROE6HYTDJDN9` (gemeldet; Erweiterung nennt sie „Film"), gefunden über `fernsehserien.de/trinity_seven/episodenguide/0/33968`. Complete Edition (Serie + 2 Filme + OVA, 5 Blu-rays, KSM): `akibapassshop.de/products/25ksm036-trinity-seven-complete-edition-bluray`.

## 7k. Code Geass: Akito — Bündel ohne Zuordnung (Daniel, 03.10.2026, 16:00)

Daniel fand in Gruppe F, dass aniSearch **doch** einen deutschen Block hat: Die fünf Akito-Filme sind bei aniSearch **ein** Eintrag (`/anime/6300,code-geass-boukoku-no-akito`, Episodenliste: Episode 2 = „The Wyvern divided" = Hikisakareshi Yokuryuu), bei uns fünf AniList-Filme (8888, 15197, 15199, 15201, 21178) **ohne aniSearch-Zuordnung** — das Panel führt auf die Suche. Dasselbe 1:n-Muster wie Cat's Eye (73 Folgen = 36 + 37).
**Meine Verwechslung:** In der Prüfliste stand statt des **Picture Dramas** (AniList 109002, Special 2013, aniSearch 17070, „Bonus", 4 Folgen, nur Japanisch) der **Film** Akito 2 (15197, ohne Zuordnung) — durch Namensanfang gewählt. Korrigiert: Gruppe F enthält jetzt das Picture Drama.
**Folgen für die Regeln:** (1) „Kein aniSearch-Eintrag" ist **nie** „kein deutscher Block" → Urteil bleibt *unbekannt* (so war es gebaut, das Akito-Beispiel bestätigt es); (2) neue Liste **„Zuordnung fehlt"** (151 Hauptbestandstitel ohne `anisearchId`, davon 40 unter den 116 Kandidaten) mit Vorschlag der Zuordnung; (3) **Zuordnung automatisieren** über aniSearchs `/titles` (alle Titel in allen Sprachen, ohne Token 1× je 24 h) und `/associated?source=myanimelist`; bei Bündeln zusätzlich über **Episodentitel** (die Folgentitel des Bündels tragen die Namen der AniList-Filme) und die Relationen; ein Bündel erlaubt mehrere AniList-Titel an einer aniSearch-ID (Folgenzahl/Datum nicht kopieren, nur Block und Marke gelten für alle).
(4) **Gruppe F neu gelesen:** Beim Picture Drama (und wohl auch bei Space Dandy 2 Picture Drama, aniSearch 10180 „Bonus") könnte der „harte Beleg von außen" geerbt sein — ein Anbieterkatalog (Crunchyroll/Prime) listet den Block der Serie, nicht das Special. F prüft damit auch, ob Anbieterbelege bei **Specials** verlässlich sind.
Die übrigen Titel der Prüfliste haben alle eine eigene aniSearch-Seite (40 von 41; die Ausnahme war der Film, jetzt ersetzt).
**Nachtrag (Daniel, 16:04): Der Crunchyroll-Lauf hat die deutsche Synchro bestätigt, die Pille verlinkt sie — das genügt als alleiniges, vollständiges Urteil.** Damit gilt die **Rangfolge der Belege**: Anbieter- oder Handbeleg (Crunchyroll-de-Katalog, ADN `vde`, eigene Messung, Handbeleg) **schlägt** aniSearch; ein fehlender aniSearch-Block ist nie ein Gegenbeleg gegen einen Anbieterbeleg. Die Hypothese „Beleg bei Specials geerbt" (Punkt 4) ist für Crunchyroll durch `check:cr-zuordnung` („ein Special erbt NICHT von der Hauptserie") bereits ausgeschlossen. Gruppe F ist damit geklärt (alle vier: aniSearch hinterher oder Bündel ohne Zuordnung).

**Entscheidung (Daniel, 16:06): Unsere Einteilung folgt aniSearch, nicht AniList.** Die fünf Akito-Filme sind bei aniSearch **ein Werk** („Code Geass: Akito the Exiled", 5 Teile à ca. 58 Min., 2012–2016, bei Crunchyroll mit deutscher Synchro) und gehören bei uns **als ein Eintrag** geführt. **Korrektur (Daniel, 16:07): Es sind auch laut aniSearch Filme — eine Film-Reihe aus fünf Filmen —, keine Hauptserie.** Maßgeblich ist, wie aniSearch kategorisiert und anzeigt (hier: ein Eintrag, Art Film, fünf Teile); wir erfinden keine eigene Art. Die Aufteilung „Hauptserie / Filme / Specials & OVAs" im Panel stammt aus AniList (`franchises.json`: Format `MOVIE`, Relation `PARENT`); sie wird mit der Umstellung durch aniSearchs Einteilung ersetzt: **Werk = aniSearch-Eintrag**, Art laut aniSearch-Format, Reihe laut aniSearch-Relationen (Prequel/Sequel/Nebengeschichte/Zusammenfassung …). Die AniList-Einträge werden zu **Teilen eines Werks** (Cat's Eye: 36 + 37 = 73; Akito: 5 Filme = 1 Werk). Gehört in den Umbauplan (Phase 3) und hängt an der Entscheidung „Werk statt Staffel" (C).

## 7c. Cat's Eye — Prime-Meldung vom 02.10.2026, 23:22 Uhr

Daniel hat die Amazon-Seite gemeldet: Meldung `9713` im Briefkasten (Plattform Prime Video, `https://www.amazon.de/dp/0NRA8APAOPCTKPDYT08UOO3K4B`, Titel „Ein Supertrio - Cat's Eye", Sprache Deutsch,
Befund `dub`, **73 Folgen geprüft**, `zugang=kauf` — also zum Kaufen, nicht im Abo, GTI `amzn1.dv.gti.914ca375-…`). Notiz der Erweiterung: „Staffel nicht im Bestand, Titel von der Seite gelesen". `titel_id` ist leer:
die Meldung kann **nicht** zugeordnet werden, weil sie 73 Folgen nennt und unser Titel (AniList 2043) 36 hat — **dasselbe Werk-/Staffel-Problem, jetzt an einem Anbieterbeleg**. Zur Zuordnung braucht es entweder
die Werk-Einheit (aniSearch 2213) oder die Zerlegung 36 + 37. Der Briefkasten-Abruf geht mit dem Repo-Token als `?token=` (der Header-Weg liefert 403) — passt zu Befund C-02.

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

## 7m. Nachtrag 03.10.2026 (Abend): Specials erben Serien-Treffer, Slime-Pille, Trinity-Seven-OVA

- **Specials/OVAs/ONAs erben den JustWatch- und TMDB-Treffer der Serie** (gemessen 03.10.2026 an `data/justwatch-audio.json` und `data/tmdb-titles.json`): JustWatch **36 Gruppen** mit Serie + Special/OVA/ONA (**38** Specials/OVAs/ONAs), TMDB **48 Gruppen** (**50**). Beispiele: Kakegurui Picture Drama (hängt an der Serie: deutscher Serientitel, Netflix-Pille zur Serie), Oh My Goddess Specials, My-Hime Specials, Air Gear Special, Death Note Relight, Strike Witches OVA, School Rumble OVA, Slayers: The Book of Spells. Ursache ist der Namensabgleich; ein Namensvergleich allein ist kein Beleg. **Offene Entscheidung für Daniel:** Soll ein Special/OVA/ONA nie den Serien-Treffer erben (Titel, Beschreibung, Anbieter-Verweise), oder nur nicht den Titel? Ein Netflix-Verweis zur Serie kann das Special enthalten, muss aber nicht.
- **Slime S4, Prime „24 Fg.":** Ursache gefunden und behoben (`deutschAbgeschlossen`, Commit am 03.10.2026): AniList führt als Ende den 25.09. (Japan), der Titel galt als abgeschlossen, die Pille schrieb bei jedem Weg mit `dub` ohne Bereiche die Titelzahl. Betroffen waren 13 Titel, die nach Japans Ende noch deutsch laufen (Slime S4, Mushoku Tensei S3, Re:Zero S4, Tanya S2, Hana-Kimi S2, Overgeared u. a.). Die Prime-Handbelege (1–19 deutsch, 20–22 nicht) landen nicht in `streams` — die Kanal-Regel hält sie zurück.
- **Trinity Seven:** Der Amazon-Handbeleg `0TKA5TG7J16JXLROE6HYTDJDN9` stand an Film 1 (AniList 21874), ist aber laut Daniel die **OVA** (AniList 21064); auf die OVA umgehängt. Film 1 hat damit die Adresse `0OJUVIHWYKKJRXYFBZBRU1KP78` noch nicht (Meldung `0QWW8SUXC8A16D6DS1QR5AV2VQ`, nicht abgeholt).
- **JoJo Steel Ball Run:** Der Netflix-Wochentermin „2nd & 3rd STAGE" (`data/curated/batch-2026.yaml`) hängt an AniList 190327 (Teil 1, eine Folge); AniList 210482 wäre richtig, steht aber nicht im Bestand. Umhängen ohne einen Abruf von 210482 würde `titleId exists` im Bau verletzen — erst nach einem Lauf, der die Kennung holt.
- **Maison Ikkoku (Film), `B000E8LZWK`:** Die Adresse steht nirgends in unseren Daten, sondern kommt nur aus Daniels Prüfung auf der Live-Seite (vermutlich der Amazon-Absprung der aniSearch-Artikelseite). Ob das Cover falsch ist, entscheidet Amazons Eintrag, nicht unser Datensatz.

## 7n. AniList-Ablösung: Schritt 2 und 3 begonnen (Daniel, 04.10.2026, 18:10)

Anlass: Tokyo Revengers Staffel 3 und Reborn as a Space Mercenary (siehe `quellen.md`, 04.10.2026) — AniList verlinkte Staffeln auf die falsche Crunchyroll-Serie, benannte Teile nach der englischen Staffelzählung („Season 2 Part 2" → „Teil 2") und führt bei laufenden Serien keine Folgenzahl. Daniel: „wir brauchen die Ablösung so schnell wie möglich"; Cover bleiben vorerst von AniList.

- **Schritt 2 (Links nur mit Beleg):** `tools/anilist-links-pruefen.mjs` misst die Crunchyroll-Adressen gegen den deutschen Katalog (Name und Folgensumme). Stand 04.10.2026: 310 Crunchyroll-Wege mit Katalogeintrag, 46 Namensabweichungen (fast alle legitime Franchise-Seiten), 1 überbelegte Serie (Tokyo Revengers) — die Regel dazu steht im Bau (`pipeline/bau/cr-serie-geteilt.ts`). Netflix und Disney+ sind nicht messbar (kein Katalog).
- **Schritt 3 (Schattenlauf):** `tools/schattenlauf-anisearch.mjs` vergleicht Feld für Feld, was der Bestand aus AniList trägt, mit aniSearch (Brücke `data/anisearch.json`); Bericht `schattenlauf-anisearch.md`, vollständige Liste `schattenlauf-anisearch.json`. Ergebnis am 04.10.2026 über 2.636 Titel: Folgenzahl gleich bei 2.574, abweichend bei 51 (aniSearch zählt teils OVAs mit: Wolf's Rain 26 gegen 30; bei 16 Titeln ist die aniSearch-Zahl eine Schätzung, One Piece „1200"); Startjahr gleich bei 2.525, abweichend bei 62 (meist ein Jahr Unterschied bei Filmen); deutscher Name gleich bei 2.526, abweichend bei 48 (aniSearch trägt „(Teil 2)"/„(Staffel 2)" im Namen — bei Digimon, Prinz Arthus); englischer Name gleich bei 1.861, abweichend bei 440; Studio gleich bei 2.175, abweichend bei 253 (Kurzformen wie „TMS" gegen „Tokyo Movie Shinsha"). Das Format ist eine Kreuztabelle (32 Paare): Specials, OVAs und Filme ordnen die beiden Quellen verschieden ein.
- **Lesart:** Für Folgenzahl, Startjahr und deutschen Namen liegt aniSearch bei rund 98 % gleichauf mit AniList; die Abweichungen sind einzeln zu entscheiden, nicht pauschal. Das Format braucht eine eigene Zuordnung. Die nächsten Schritte: Abweichungsliste mit Daniel durchgehen, dann je Feld umschalten (Staffelzählung und Teilnamen zuerst), Cover zuletzt.

### 7n-2. Reihen-Schattenlauf (DeepSeek-Agent, von Claude geprüft, 04.10.2026)

`tools/archiv/schattenlauf-reihen.mjs` liest die Relationen aus den 3.195 archivierten aniSearch-Seiten und vergleicht die Gruppen mit unserer `franchiseId` (Bericht: [schattenlauf-reihen.md](schattenlauf-reihen.md)). Über 2.636 Titel in beiden Quellen: Mit den Typen Sequel, Prequel, Hauptgeschichte, Nebengeschichte, Zusammenfassung und Komplette Geschichte (Variante A) sind 1.260 Reihen **gleich**, bei 143 trennt aniSearch, was wir zusammenhalten. Nimmt man „Alternative Version/Remake" dazu (Variante C, wie AniLists `ALTERNATIVE`), sind es 1.272 gleich und 118 getrennt. **85 der 143 Trennungen kommen allein aus der Wahl der Relationstypen** („Anderes", „Gemeinsames Universum"); die übrigen aus **2.398 Kanten zu Seiten, die nicht archiviert sind** (2.087 Ziele) — sie schließen sich, sobald der Katalog-Lauf die Seiten geholt hat. Lesart: Eine Reihenbildung aus aniSearch-Relationen ist machbar und liegt bei Variante C nah an der heutigen; nach dem Katalog-Lauf ist die Messung zu wiederholen, bevor umgestellt wird. Auffällig: aniSearch kennt keinen „Spin-Off"-Typ zwischen zwei Anime, AniList schon.
