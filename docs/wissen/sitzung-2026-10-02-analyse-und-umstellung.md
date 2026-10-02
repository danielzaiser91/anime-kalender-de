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
