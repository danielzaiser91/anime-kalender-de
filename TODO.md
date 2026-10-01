# TODO

## Quellenlage — Stand 24.08.2026

Ziel war: nicht nur Crunchyroll maschinell, sondern jede legale deutsche Bezugsquelle, und der
Datenbestand mindestens täglich aktuell. Was daraus geworden ist:

### Maschinell, mit belegter Uhrzeit und belegter Synchro

| Quelle | Liefert | Wie |
|---|---|---|
| Crunchyroll-Simulcastkalender | Uhrzeit, Folgennummer, „(Deutsch)"-Kennzeichnung | Playwright, stündlich |
| Crunchyroll Content-API (**deutscher Katalog**) | Sprachfassung je Staffelblock | beta-api mit Zugangspaket, täglich |
| ADN | Datum, Uhrzeit **und Sprachcode** (`vde` = Synchro, `vostde` = nur UT) | öffentliche JSON-Schnittstelle, täglich |

**Der deutsche Katalog ist der wichtigste Zugewinn seit August.** Crunchyroll leitet die Region
aus der IP ab; GitHub-Runner stehen in den USA und sahen deshalb den falschen Katalog — für
„Fairy Tail" meldete er `ja-JP, en-US`, während in Deutschland 277 Folgen deutsch sind. Ein
Zugangspaket von hier trägt auch aus der Cloud (`tools/cr-zugang-holen.mjs`, gilt 24 Stunden).
Seitdem wird aus einem fehlenden `de-DE` ein belegtes Nein — **aber nur bei `katalog: 'de'`**.

### Maschinell, aber nur als Vorschlag

| Quelle | Liefert | Wie |
|---|---|---|
| Anime2You (drei Feeds) | Ankündigungen zu Netflix, Disney+, Prime, Aniverse, WOW, Joyn, RTL+, Kino, Disc | RSS, täglich → `data/proposals/` |
| Streaming Availability API | Tonspur je Folge, für **Netflix** übernommen | monatlich, 1.000 Anfragen |
| TMDB / JustWatch | wo ein Titel läuft, und ob Abo oder Kauf | täglich |
| aniSearch | welche Anbieter einen Titel führen | wöchentlich, Rohantworten archiviert |

Warum Anime2You nur Vorschlag: Der Text einer Meldung ist kein Datensatz. „Ab dem 4. September"
kann sich auf den Titel in der Überschrift beziehen oder auf einen aus dem dritten Absatz.
`npm run data:report` listet, was gemeldet ist und noch nicht im Datensatz steht.

Warum die Streaming Availability API nur für Netflix: Ihre Prime- und Disney-Daten liegen
erfasst im Repo — **123 und 44 Serien mit deutscher Tonspur** —, aber niemand hat geprüft, ob
sie stimmen. Für Netflix stehen 1.790 Handprüfungen als Maßstab bereit, für Prime Video dreizehn.
Siehe [daniel-zum-abarbeiten/01-prime-video.md](daniel-zum-abarbeiten/01-prime-video.md).

### Handarbeit — aber mit Werkzeug

Netflix, Disney+ und Prime Video veröffentlichen keinen Kalender, nennen keine Uhrzeiten und
weisen die Sprachfassung nicht maschinenlesbar aus. `robots.txt` sperrt Netflix und Disney+
vollständig; Amazons Nutzungsbedingungen untersagen Data Mining ausdrücklich.

**Seit dem 22.08.2026 gibt es dafür eine Browser-Erweiterung** (`extension/`). Sie liest, was
ein Mensch ohnehin auf dem Bildschirm hat, und meldet es mit einem Klick:

- **Netflix**: der Player nennt seine Tonspuren im Manifest; die Erweiterung liest sie mit,
  sobald eine Folge läuft. Auch der Termin einer noch nicht abrufbaren Titelseite wird
  übernommen („Ab 29. September").
- **Prime Video**: die Tonspuren stehen im Quelltext. Ein Seitenaufruf trägt eine ganze Staffel
  statt einer Folge, und die Erweiterung holt die weiteren Folgenabschnitte selbst nach. Sie
  erkennt außerdem, ob ein Titel im Abo läuft, gekauft werden muss oder beides.
- **Disney+**: angebunden (4.24.0). Der Playback-Aufruf liest die acht Tonspuren ohne
  Wiedergabe; „▶ alle durchgehen" läuft die sichtbare Liste Titel für Titel ab.

Die JustWatch-GraphQL-Schnittstelle wäre eine weitere Möglichkeit, ist aber inoffiziell und in
den Nutzungsbedingungen ein Graubereich — bewusst nicht angebunden. aniverse.de ist von hier aus
nicht erreichbar (TLS-Handshake bricht ab).

## Polling

Vier Workflows, alle mit `concurrency: daten`, damit sie sich nicht gegenseitig ins Repo
schreiben:

- **stündlich** (`refresh-hourly.yml`) — Crunchyroll, drei Wochen Fenster
- **täglich** (`refresh-data.yml`) — alle Quellen, danach `data:check`
- **wöchentlich** (`refresh-weekly.yml`) — weite Fenster, Kuratierungsbericht
- **monatlich** (`tonspuren-monatlich.yml`) — Streaming Availability API, am 2. um 4:17

Committet wird nur bei echter Änderung.

`pipeline/check-sources.ts` ist der Wachhund gegen den lautlosesten Fehler dieses Projekts: Ein
Scraper läuft weiter durch, findet aber nichts mehr, weil die Gegenseite ihre Seite umgebaut
hat. Schweigt eine Quelle länger als ihre Frist, wird der Lauf rot — und GitHub schickt die Mail.

## Prüfläufe

Sechs Prüfungen sichern verschiedene Dinge; jede kann grün bleiben, während eine andere einen
echten Ausfall sieht.

| Lauf | misst |
|---|---|
| `check:logic` | die Annahmen, aus denen echte Fehler entstanden sind |
| `check:handbelege` | steht jede der 1.970 Handprüfungen so im Datensatz? |
| `check:cr-zuordnung` | tut die Crunchyroll-Auswertung das Richtige? |
| `check:quellen` | widerspricht eine Quelle einer Handprüfung? |
| `check:zugangsart` | kostenlos, Abo oder Kauf — die einzige Angabe, bei der ein Fehler Geld kostet |
| `check:extension` | die 105 Zusicherungen der Browser-Erweiterung |

## Wiederkehrend

**Kuratierungsbericht abarbeiten** — `npm run data:report` listet, was gemeldet, aber noch nicht
erfasst ist. Die Liste in `data/curated/` übertragen; was keine belegte deutsche Fassung hat,
bleibt draußen. Kein Kästchen, weil sie nie „fertig" ist.

**Was auf Daniel wartet**, steht vollständig in
[daniel-zum-abarbeiten/00-START-HIER.md](daniel-zum-abarbeiten/00-START-HIER.md) — mit Umfang,
Zeitaufwand und dem, was jede Aufgabe löst.

## Offene Kästchen

- [ ] **Apothekerin S3 Cour 1: steht sie am 02.10. im Kalender?** (02.10.2026).
  Erwartung: „Die Tagebücher der Apothekerin: Staffel 3 – Teil 1" steht am **02.10.2026** im Kalender
  (angekündigter Simulcast, `data/ankuendigungen.yaml`, `omuAb: 2026-10-02`; Quelle der Crunchyroll-Artikel).
  Der Termin kam am 01.10. von 01.10. auf 02.10. (vorher eine aniSearch-Schätzung), der Riegel verwirft
  Angekündigtes nicht mehr. **Prüfen** in Woche und Monat sowie im Detail-Panel. **Fehlt er:** Bau-Log
  („verworfen") und `data/termine-verpasst.json` ansehen.

- [ ] **Apothekerin S3 Cour 1: am 03.10. den Stand prüfen — „nicht erschienen" oder neuer DE-Termin** (03.10.2026).
  Die Ankündigung nennt den 02.10. als **OmU**-Start; die **deutsche Synchro** ist zum angekündigten Release
  am 02.10. **nicht** erschienen. Zu prüfen und **sichtbar** zu aktualisieren (nicht still):
  1. Hat der Lauf den 02.10. als „nicht erschienen" markiert — durchgestrichen im Kalender, Eintrag in
     `data/termine-verpasst.json`, News „Nicht erschienen" mit Quelle?
  2. Oder wurde ein **neuer, echter DE-Synchro-Termin** eingereiht (neue Ankündigung → `neuErwartet`,
     Antwort-Kasten „Start am …")?
  3. Die Meldung muss eine der beiden ehrlichen Fassungen tragen:
     - **Termin da:** „Deutsche Synchro startet am <Datum> (Quelle)."
     - **Termin offen:** „Deutsche Synchro ohne offiziellen Termin — wir tragen ihn nach, sobald sie
       erscheint oder neue Infos vorliegen."
     (Panel-Formulierungen: `antwort.synchroOffen` / `antwort.synchroTerminOffen`, `shared/ankuendigung.ts`.)

- [ ] **Disney+ „2 Titel" klären, dann Aufgabe 8 aus `00-START-HIER.md` wieder entfernen** (01.10.2026).
  Laufstatus-App und Erweiterung sagen 2 (Bleach, Though I Am an Inept Villainess), auf der Seite sind
  aber alle Folgen grün. Daniel prüft es (Aufgabe 8, `daniel-zum-abarbeiten/21-disneyplus-gruen.md`);
  **ich** nehme danach den Eintrag aus `pipeline/report-start.ts` wieder heraus und lasse
  `npm run data:start-liste` laufen, damit die Tabelle nicht dauerhaft eine erledigte Frage führt.

- [ ] **Watchlist-Farbe in beiden Oberflächen prüfen, sobald eine Karte grün ist** (30.09.2026).
  `chrome-utilities` 1.10.0.5 färbt grün nur bei deutscher Fassung **und** ungesehen
  (`cu_watchSprache` liest das Sprachpaar aus dem Watch-Link, `cu_watchZustand` den Zustand aus dem
  Untertitel). Gemessen ist bisher nur der gelbe Fall: an Daniels Watchlist sind alle 11 Karten gelb
  (8 ohne deutsche Fassung, 3 deutsch aber schon gesehen), und die englische Fassung zeigt `DEDE` an
  genau denselben drei Stellen wie die deutsche. **Auslöser:** sobald eine ungesehene Folge mit
  deutscher Fassung dasteht — erster Kandidat ist „Meine Wiedergeburt als Schleim in einer anderen
  Welt" Staffel 4, Folge 22 (deutscher Termin im Kalender: 02.10.2026, 17:00). **Dann prüfen:**
  dieselbe Karte in deutscher (`Jetzt anschauen`) und englischer Oberfläche (`Start Watching`) —
  beide müssen **grün** sein; „Erneut anschauen"/„Watch Again" muss **gelb** bleiben.

## Erledigt

- [x] Impressum und Datenschutzerklärung ausformulieren
- [x] Uhrzeiten der laufenden Crunchyroll-Simuldubs belegen
- [x] Newsletter-Worker deployen
- [x] Eigene Domain und Absenderdomain einrichten
- [x] Projekt ins Portfolio eintragen
- [x] Sitemap, robots.txt und Google Search Console eingerichtet
- [x] ADN als zweite maschinelle Quelle anbinden
- [x] Anime2You als Vorschlagsquelle anbinden
- [x] Polling-Kaskade stündlich/täglich/wöchentlich/monatlich
- [x] Wachhund gegen stumm gewordene Quellen
- [x] Browser-Erweiterung für Netflix und Prime Video
- [x] Crunchyroll über den **deutschen** Katalog statt den US-Katalog
- [x] Disney+ in die Erweiterung aufnehmen — 4.24.0; der erste echte Durchgang über „▶ alle durchgehen" steht bei Daniel aus
- [x] 202 Amazon-Suchadressen kennzeichnen — Migration 015 setzt sie auf `unbekannt`, der Bau repariert sie; keine Suchadresse mehr im Datensatz (0 in `titles.json`, nachgezählt 29.09.2026)
- [x] `zugang`-Spalte in der Prüfungstabelle des Workers — Migration 015 (`ALTER TABLE pruefung ADD COLUMN zugang TEXT`), der Worker schreibt sie in `pruefung-speichern.ts`
