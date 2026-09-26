# Projektregeln: anime-kalender-de

Kurzfassung (seit 26.09.2026). Anlässe, Zahlen und Laufkennungen zu jeder Regel stehen in
[docs/wissen/projektregeln-im-detail.md](docs/wissen/projektregeln-im-detail.md) — bei Zweifeln
dort nachlesen; neue Anlässe kommen dorthin, hier höchstens ein Halbsatz.

## Projektziel

Ein **Gesamtüberblick aller Anime mit deutscher Synchronfassung** — erschienen und angekündigt —,
filterbar, durchsuchbar, als Kalendereintrag übernehmbar (Daniel, 11.08.2026). Dazu gehören:

1. **Synchro ist nicht Untertitel** — die Trennlinie des Projekts (Chiikawa: 120 deutsche Folgen,
   alle untertitelt, steht zu Recht nicht im Kalender).
2. **Nichts behaupten, was nicht belegt ist.**
3. **Unsicheres kennzeichnen statt weglassen**; gestrichen wird nur, was eine Quelle aktiv widerlegt.
4. **Nicht nur wann, auch wo** man es sehen oder kaufen kann.
5. **Rechtzeitig Bescheid geben** — Kalender-Abo, ICS, Newsletter sind Kern, kein Beiwerk.

Nicht Ziel: Community, Bewertungen, Wasserstandsmeldungen zu japanischen Ausstrahlungen.

## Grundsatz: nichts behaupten, was nicht belegt ist

- **Kein Termin ohne `sources`** (`npm run data:validate` bricht ab).
- **Keine erfundenen Uhrzeiten** — `time` bleibt leer („Zeit offen"). Einzige Ausnahme Netflix:
  08:00 UTC als `timeEstimated` („≈", ohne Countdown; Daniel, 25.09.2026).
- **Abgeleitetes kennzeichnen:** Datum aus Simulcast statt Dub-Ankündigung → `estimated: true`;
  geratene Folgenzahl → `episodeCountAssumed`; beides „≈" im UI.
- **Keine Folgenzahl erfinden**, auch nicht als Rückfall; ein Termin ohne belegte Stückzahl über
  eins ist ein Einzeltermin.
- **Ein Wochentakt wird gemessen** (Abstand **und** Folgen je Termin, `bestimmeRhythmus()`).
- **Ein belegtes Ende schlägt jede Fortschreibung** (`schedule.lastEpisodeDate`).
- **Eine Plattform-Serienkennung ist ein Franchise, keine Staffel** — zerlegt über `season`,
  zugeordnet über die Folgenzahl; geht die Summe nicht auf, lieber unzugeordnet. Umgekehrt gehört
  ein Anime genau einer Kennung; ist ein Treffer vergeben, nächste Schreibweise probieren.
- **Namensabgleich:** der beste Treffer gewinnt, nicht der erste; `OVA`/`ONA`/`OAD`/`TV` zählen mit,
  der japanische Titel nicht (`bewerteTreffer`). Ein Namensvergleich allein ist kein Beleg.
- **Ein Vorfilter verschiebt, er löscht nicht** — wer aus dem Hauptbestand fällt, muss nachweislich
  hinter dem Toggle ankommen.
- **„Früheste Beobachtung" ist nicht „erste Folge"** (`earliest` ist nur der früheste gesehene Tag),
  und der erste Eintrag einer Staffelliste ist nicht deren erste Folge — nach Nummer zählen.
- **„Im Angebot seit" ist nicht „erschienen am"** (`dateMeaning: 'available-from'`).
- Geteilte Staffelstarts über `schedule.firstEpisodeNumber`. Bei Fortsetzungen die AniList-ID
  prüfen (`npx tsx pipeline/qa-resolve.ts`).

## Was erzeugt wird, wird auch geprüft

`pipeline/lib/pruefung.ts` prüft am Ende jedes Builds den **erzeugten** Datensatz und bricht bei
Widerspruch ab (kein Termin nach `lastEpisodeDate`, keine Folgenzahl über dem Doppelten der
AniList-Angabe ohne Grund, keine Releases mit zusammen mehr Folgen als der Anime, kein Release ohne
Quelle). `check:logic` stellt reale Fehlerfälle nach. Drei Prüfungen sichern die
Synchro-Auswertung, jede mit eigenem blinden Fleck: `check:handbelege` (Handprüfungen im
Datensatz?), `check:cr-zuordnung` (Einzelfälle plus Untergrenze auf dem echten Bestand),
`check:quellen` (Quelle widerspricht Handprüfung?). Handbelege in `data/dub-confirmed.yaml` sind
die einzige Quelle, die weder rät noch schweigt — ihr Vorrang in `build.ts` hängt an einer
Reihenfolge (`if (stream.dub !== undefined) continue`).

## Ein laufender Datenlauf committet den Stand von seinem Start

`tools/commit-data.sh` rettet bei bewegtem Fernstand die Dateien aus `QUELLEN`
(`tools/quellen-liste.sh`) aus dem Arbeitsverzeichnis — eine zwischenzeitliche Korrektur daran
geht dabei verloren. Deshalb: **Läuft ein Datenlauf oder Bau, wird keine Datei aus `QUELLEN`
committet**, sondern im Hintergrund gewartet; `tools/quellen-commit-wache.sh` hält solche Commits
als pre-commit-Hook an (einrichten: `bash tools/quellen-commit-wache.sh --einrichten`). Was ein
Schritt zusammen schreibt, steht zusammen in `QUELLEN` oder gar nicht. Jede neue Datei, die die
Pipeline schreibt, gehört in `tools/quellen-liste.sh`. Zu jeder Datenkorrektur gehört eine
Zusicherung, die meldet, wenn sie verlorengeht.

## Architektur, Datenfluss, Orte

- Bauweise und Schwellen: [ARCHITEKTUR.md](ARCHITEKTUR.md). Ladelast, veröffentlichte Seite und
  Repo-Größe sind drei verschiedene Dinge; ein neues Feld kommt nur nach `titles.json`, wenn die
  Mehrheit der Besucher es braucht, sonst als eigene, nachgeladene Datei.
- `data/curated/*.yaml` (Handarbeit, **jede Datei dort wird als Termine gelesen**) + `data/cache/*`
  (APIs, nicht im Repo) → `pipeline/build.ts` → `public/data/*` (wird mit committet).
- `shared/` wird von Pipeline, Web-App **und** Worker importiert — nichts mit Node-APIs oder DOM.
- Status (`airing`/`abgeschlossen`/`tba`/`unbekannt`) nur über `shared/logic.ts` berechnen, nie
  nachbauen: `lastEpisodeDate` ist meist nicht gesetzt. Ein Anbieter-Verweis gehört zum Release
  seiner eigenen Plattform.
- Zeitzonen nur über `shared/time.ts`; Datumsangaben im Datensatz sind Europe/Berlin.
- Sprache: Oberfläche, Kommentare, Commits, Doku deutsch; Feldnamen englisch.
- Newsletter-Worker (`worker/`) optional; DSGVO-Pflichten (Double-Opt-in, Abmeldelink, Impressum,
  Datenschutz) nie entfernen.

## Codegestalt: Neues bekommt eine eigene Funktion

Anlass: `main()` in `build.ts` hatte 7.809 Zeilen, `DetailPanel` 3.125 — jede Ergänzung war klein.

- **Nicht anbauen, herauslösen:** Keine Zeilen in eine Funktion über 80 oder eine Datei über 800
  Zeilen; Neues wird eigene Funktion bzw. eigenes Modul. `check:umfang` (steckt in `build`) misst
  die Überlänge je Bereich — sie darf nur sinken, gesunkene Werte übernimmt `--festschreiben`,
  angehoben wird nie. `--liste` zeigt die größten Stellen.
- **Daten sichtbar übergeben:** Eingaben als Parameter, Ergebnisse als Rückgabe — nicht über
  geteilte `let`-Variablen einer großen Funktion. Wo Reihenfolge zählt, steht sie in den Aufrufen.
- **Vor dem Schreiben suchen:** vorhandene Helfer in `pipeline/lib/`, `shared/`, `web/src/lib/`.
- **Kommentare sagen warum, in ein bis drei Zeilen.** Anlass, Datum, Laufkennung und Chronik gehören
  in den Commit oder nach `docs/wissen/` (ein Verweis genügt). Wer einen Abschnitt anfasst, kürzt
  dessen Chronik mit.
- **Umbau und Verhaltensänderung nie im selben Commit.** Ein Umbau von `build.ts` beweist
  Gleichheit: `node tools/bau-vergleich.mjs` (Ausgabe byte-gleich zu `origin/main`); Ein- und
  Ausgaben eines Abschnitts nennt `node tools/abschnitt-schnittstelle.mjs <datei> <von> <bis>`.
  Vorgehen: Skill `zerlegen`.
- **Wegwerfskripte gehören ins Scratchpad**, nicht ins Repo; Aufbewahrtes nach `tools/archiv/`.

## Keine Information zweimal

Prüffrage vor jeder Zeile in der Oberfläche: Steht das schon auf demselben Bildschirm? Dann
streichen, nicht umformulieren (Überschrift über Pillen, Zustand in Wort **und** Bild, Reihenname
in jeder Zeile). Zwei Angaben, die heute nur zufällig übereinstimmen, sind keine Dopplung.

## Läufe

- **Datenläufe laufen remote:** `gh workflow run <datei>.yml --repo danielzaiser91/anime-kalender-de`.
  Lokal nur, was nur hier geht (`tools/cr-zugang-holen.mjs`, `check:*`, `typecheck`, `build`, eine
  Einzelmessung ohne Schreiben). Was nach Plan läuft, nicht von Hand anstoßen.
- **Ein roter Lauf wird bemerkt, nicht gemeldet** — an jeder Wachphase und nach jedem eigenen Push
  `LAUF_TOKEN=… node tools/laeufe-aufraeumen.mjs --trocken`, ansehen, handeln, Anzeige leeren. Vor
  `gh run delete` jeden Lauf einzeln ansehen.
- Wer `.github/workflows/*` ändert, macht laufende Datenläufe rot (GitHub-App ohne
  `workflows`-Recht) — danach hinsehen und neu anstoßen.

## Vor dem Commit

```bash
npm run check:vor-commit
```

Die Kette: `data:validate · check:logic · check:workflows · typecheck · check:worker · check:hooks
· check:extension · check:wiedervorlage · check:zugangsart · build`. Zusätzlich vor dem Push, was
die CI zusätzlich fährt: `check:ansichten` und `check:panel` bei Änderungen an `web/src`,
`check:handbelege` nach einem Bau bei geänderten oder umgehängten Belegen. Jeder rote Lauf ist
eine Mail an Daniel.

- Nach jedem Generatorlauf `git status` und **alles** stagen, was er geändert hat.
- Auch ein reiner Daten-Commit läuft durch `check:logic`; Schwellen nie auf den Messwert des
  Augenblicks senken.
- Wer in `build.ts` ändert, was entfernt oder wie ein Feld gebildet wird, sucht zuerst die
  Zusicherungen dazu (`grep -rn "<Feld>" pipeline/check-*.ts tools/*-pruefen*`). Eigenschaften, die
  `pruefeErgebnis()` prüft, beim Anlegen setzen — die Prüfung läuft mitten im Bau, nicht am Ende.
- Ein lokaler `npm run data:build` stoppt am Cache-Abbruch („N Titel würden fallen"), erreicht die
  Prüfungen aber vorher; danach die erzeugten Dateien mit `git checkout` zurücksetzen.
- Jedes `tsc` braucht `--noEmit`; `check:worker` nicht weglassen (eigenes tsconfig);
  `check:hooks` prüft React-Hook-Regeln, die `tsc` nicht sieht.
- Mess- und Versuchsläufe enden mit Exit 0 statt rot.

## Wissen nach Thema — vor der Arbeit lesen, nicht erinnern

Je Thema eine Datei; die Abschnittsüberschriften sind der Index
(`grep -n "^## " docs/wissen/<datei>.md`):

- [docs/wissen/erweiterung.md](docs/wissen/erweiterung.md) — Browser-Erweiterung (Amazon, Netflix,
  Disney+): Melden, Durchgänge, Leser, Prüflisten
- [docs/wissen/quellen.md](docs/wissen/quellen.md) — Datenquellen, ihre Grenzen, Sperren,
  robots.txt, News-Quellen
- [docs/wissen/betrieb.md](docs/wissen/betrieb.md) — Läufe, Worker, Git, Prüfungen
- [docs/wissen/datensatz.md](docs/wissen/datensatz.md) — Bau und Anzeige
- [docs/wissen/projektregeln-im-detail.md](docs/wissen/projektregeln-im-detail.md) — Volltext dieser
  Regeln mit Anlässen

Neue Erkenntnisse als eigener `##`-Abschnitt mit Datum in die passende Datei — ein Eintrag hier
ist nicht mehr nötig.
