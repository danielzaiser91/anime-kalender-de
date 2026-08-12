# Projektregeln: anime-kalender-de

## Projektziel

Ein **Gesamtüberblick aller Anime, für die es eine deutsche Synchronfassung gibt oder geben
wird** — die bereits erschienenen ebenso wie die angekündigten. Dazu **filterbar**, **durchsuchbar**
und als **Kalendereintrag** übernehmbar (Daniel, 11.08.2026).

Fünf Punkte gehören aus der bisherigen Arbeit dazu, weil ohne sie keiner der vier oben trägt:

1. **Synchro ist nicht Untertitel.** Das ist die Trennlinie, an der sich das Projekt von jedem
   anderen Kalender scheidet. Chiikawa hat 120 deutsche Folgen — alle untertitelt, keine
   synchronisiert; unser Kalender führt es zu Recht nicht. Wer diese Unterscheidung nicht
   trifft, beantwortet eine andere Frage als die gestellte.
2. **Nichts behaupten, was nicht belegt ist** (siehe nächster Abschnitt). Ein Kalender, dem man
   nicht trauen kann, ist wertlos — er kostet dann Zeit, statt sie zu sparen.
3. **Unsicheres kennzeichnen statt weglassen.** Der Sinn ist vorherzusagen, damit niemand etwas
   verpasst. Ein Eintrag wird nur gestrichen, wenn eine Quelle ihn **aktiv widerlegt** — nicht,
   weil er unbestätigt ist. Sonst fehlt genau der Termin, für den jemand die Seite aufruft.
4. **Nicht nur wann, auch wo.** Zu jedem Titel gehört, wo man ihn sehen oder kaufen kann. Bei
   den meisten Titeln ist das die eigentliche Frage — nur gut hundert haben überhaupt einen
   anstehenden Termin.
5. **Rechtzeitig Bescheid geben.** Kalender-Abo, ICS-Export und Newsletter sind kein Beiwerk:
   Wer die Seite nicht täglich aufruft, verpasst sonst genau das, wovor sie bewahren soll.

Was **nicht** zum Ziel gehört: eine Community-Plattform, Bewertungen, Wasserstandsmeldungen zu
japanischen Ausstrahlungen. Der Kalender beantwortet eine Frage, und die auf Deutsch.

## Grundsatz: nichts behaupten, was nicht belegt ist

Dieses Projekt lebt davon, dass die Termine stimmen. Deshalb gilt ausnahmslos:

- **Kein Termin ohne `sources`.** `npm run data:validate` bricht sonst ab, und das ist Absicht.
- **Keine erfundenen Uhrzeiten.** Ist die Uhrzeit nicht belegt, bleibt `time` leer — die
  Oberfläche schreibt dann „Zeit offen". Das ist besser als eine plausible Falschangabe.
- **Abgeleitetes kennzeichnen.** Datum aus dem Simulcast-Start übernommen statt aus einer
  Dub-Ankündigung? Dann `estimated: true`. Folgenzahl geraten? Setzt die Pipeline selbst als
  `episodeCountAssumed`. Beides erscheint im UI als `≈`.
- **Keine Folgenzahl erfinden, auch nicht als Rückfall.** Ein einzelner Termin im
  Crunchyroll-Kalender ist kein Beleg für eine Wochenserie — dort stehen auch Specials,
  Filmpremieren und die Anime Awards. Ein `Math.max(12, …)` als Standardwert machte daraus neun
  zwölfteilige Reihen (10.08.2026), und der Kalender behauptete Woche für Woche eine Folge, die
  es nicht gibt. Ein Termin ohne belegte Stückzahl über eins ist ein Einzeltermin.
- **Ein Wochentakt muss gemessen sein, nicht angenommen.** „Nicht alles an einem Tag" heißt
  nicht „jede Woche eine Folge". ADN nahm Sword Art Online in zwei Wellen ins Angebot (11.06.
  und 17.07.2025, 49 und 47 Folgen); weil die Einstufung nur `dates.size === 1` prüfte, galt der
  Eintrag als Wochenserie, und der Kalender rechnete daraus 96 Termine bis 2027 — zusammen mit
  Sailor Moon **196 von 867 Terminen frei erfunden** (12.08.2026). Entscheidend sind der
  Abstand zwischen den Terminen **und** die Zahl der Folgen je Termin; beides prüft
  `bestimmeRhythmus()` in `pipeline/lib/adn.ts`.
- **Ein belegtes Ende schlägt jede Fortschreibung.** `expandEvents` bricht bei
  `schedule.lastEpisodeDate` ab. Vorher las nur `releaseStatus()` das Feld, `expandEvents` nicht
  — der Datensatz behauptete gleichzeitig „abgeschlossen seit Juli 2025" und „nächste Folge
  nächsten Mittwoch".
- **Eine Plattform-Serienkennung ist ein Franchise, keine Staffel.** ADN führt unter einer
  Kennung alle drei Staffeln von SAO, alle fünf von Sailor Moon, acht Blöcke von Haikyu!! —
  neun der 37 Serien. Zerlegt wird über das Feld `season` der Quelle
  (`staffelBloecke()`); die Zuordnung zur richtigen AniList-Staffel läuft über die
  **Folgenzahl**, nicht über den Namen: ADN-Staffel 3 von SAO hat 47 Folgen = Alicization 24 +
  War of Underworld 12 + Part 2 11. Geht die Summe nicht exakt auf, bleibt der Block lieber
  unzugeordnet, als einen fremden Titel mitzubringen.
- **„Im Angebot seit" ist nicht „erschienen am".** Nimmt eine Plattform einen Katalogtitel auf,
  kennt sie nur das Datum ihrer eigenen Aufnahme. Für SAO war das der 11.06.2025 — die deutsche
  Fassung gibt es seit 2013, die von Alicization seit August 2019 auf Disc. Deshalb trägt jedes
  nicht-wöchentliche ADN-Release `dateMeaning: 'available-from'`, und die Oberfläche schreibt
  „Im Angebot seit" statt „Start".
- **Geteilte Staffelstarts über `schedule.firstEpisodeNumber` abbilden.** Netflix brachte Steel
  Ball Run als eine Folge im März und den Rest im September. Zwei Releases, aber eine
  durchlaufende Zählung: Ohne das Feld beginnt die Terminliste des zweiten Teils wieder bei „1."
  und liest sich wie der Termin der Auftaktfolge.
- Bei Fortsetzungen die **AniList-ID prüfen**, nicht der Suche vertrauen. `npx tsx
  pipeline/qa-resolve.ts` zeigt Verdachtsfälle; die Folgenzahl wird nur übernommen, wenn das
  japanische Ausstrahlungsjahr zum deutschen Termin passt.

## „Wo läuft es" — ein Verweis ist keine Sprachangabe

Ein Stream-Verweis sagt, **dass** ein Titel dort läuft, nicht **in welcher Sprache**. Belegen
kann die Pipeline die deutsche Fassung nur bei ADN (Sprachcode `vde` je Folge) und Crunchyroll
(„(Deutsch)" im Kalender). Bei YouTube, Netflix, Prime Video, Disney+, RTL+, Joyn und Aniverse
gibt es keine öffentliche Auskunft — dort steht „🇩🇪 ?", und das ist die ehrliche Antwort.

- **Aus dem Fragezeichen wird ein Häkchen nur durch Nachsehen.** Geprüfte Fälle stehen in
  `data/dub-confirmed.yaml`, mit Datum. `dub: false` ist genauso wertvoll wie `true`.
- **Was ein Mensch geprüft hat, schlägt jede Ableitung** — der Eintrag gilt auch gegen ein
  automatisch gesetztes `true`.
- **Nie raten, auch nicht bei starken Indizien.** Eine YouTube-Playlist des deutschen
  Crunchyroll-Kanals ist ein Hinweis, kein Beleg; dieselbe Playlist enthält auch untertitelte
  Folgen.
- `npm run data:dub-checks` erzeugt aus dem aktuellen Stand die Arbeitsliste
  `data/dub-pruefliste.md` — nach hinten sortiert von heute, ohne Künftiges (das kann niemand
  nachsehen) und ohne bereits Geprüftes.

## Was erzeugt wird, wird auch geprüft

`npm run data:validate` sichert nur `data/curated/*.yaml` — also den Teil, den ohnehin jemand
durchdacht hat. Der Fehler vom 12.08.2026 entstand vollständig in `build.ts` und wäre dort nie
aufgefallen. Deshalb prüft `pipeline/lib/pruefung.ts` am Ende jedes Builds den **erzeugten**
Datensatz und bricht bei einem Widerspruch ab, bevor etwas geschrieben wird:

- kein Termin nach dem belegten `lastEpisodeDate`
- keine Folgenzahl über dem Doppelten der AniList-Angabe (Ausnahme: `firstEpisodeNumber` oder
  ein erklärender `note`)
- keine zwei Releases, die zusammen mehr Folgen behaupten, als der Anime hat
- kein Release ohne Quelle

`npm run check:logic` stellt zusätzlich die vier Annahmen nach, aus denen der Fehler entstand.
Beide gehören zur Prüfkette vor dem Commit.

## Beim Scrapen nichts wegwerfen

Der Abruf ist der teure und der schädliche Teil, nicht das Speichern. Wer eine fremde Seite
holt und nur zwei Felder herauslöst, zahlt für jedes später gebrauchte Feld ein zweites Mal —
und zwar mit Last auf einem fremden Server, nicht mit eigenem Speicherplatz.

- **Paginierte Schnittstellen paginiert abfragen.** `?limit=100` ohne `offset` ist keine
  Begrenzung, sondern stiller Datenverlust — und weil ADN die **neuesten** Folgen zuerst
  liefert, fehlte ausgerechnet der Anfang: 99 von 199 Folgen bei Sailor Moon, 45 von 145 bei
  Eyeshield 21, 31 von 131 bei Dragon Ball Super. Bei Sailor Moon fielen dadurch die beiden
  frühesten Veröffentlichungstermine weg, und der Datensatz führte den 23.12.2025 als Start
  statt des richtigen 29.10.2025.
- **Rohantworten archivieren** (`data/adn-raw/*.json.gz`, `data/anisearch-raw/*.html.gz`, rund
  9 KB je Titel). Ein
  nachträglich gebrauchtes Feld ist dann eine Änderung am Parser, kein zweiter Lauf über 2.612
  Seiten. Genau das war am 11.08.2026 der Fall: Die Folgenzahl stand auf jeder bereits geholten
  Seite und war trotzdem nur durch einen kompletten Neuabruf zu bekommen.
- **Infobox vollständig auslesen**, auch Felder, die heute niemand anzeigt. Das kostet nichts.
- **Nicht archiviert werden** Forum, Kommentare, Rezensionen, Umfragen und Bearbeiterlisten.
  Das ist keine Platzfrage: Es sind Beiträge einzelner Menschen, veröffentlicht auf aniSearch
  und nicht in unserem Repo.
- **Kein Live-Scraping beim Seitenaufruf.** Das macht aus einem Abruf je Titel und Woche einen
  Abruf je Besucher — dieselbe Last, unbegrenzt, und ein fremder Server im Ladepfad der
  eigenen Seite.
- `npm run data:anisearch:check` prüft den Parser gegen das Archiv, ohne einen einzigen neuen
  Abruf. Bricht er ab, hat aniSearch die Seitenstruktur geändert.

## Architektur

Bauweise, Grenzen und die Schwellen, ab denen umgebaut werden müsste: [ARCHITEKTUR.md](ARCHITEKTUR.md).

Die eine Regel, die man dort nicht nachlesen muss: **Ladelast, veröffentlichte Seite und
Repo-Größe sind drei verschiedene Dinge.** Rohdaten unter `data/` kosten keine Ladelast und
zählen nicht zur Pages-Grenze — sie wandern nie nach `dist/`. Ein neues Feld gehört nur dann
in `titles.json`, wenn es die Mehrheit der Besucher braucht; alles andere kommt als eigene
Datei, nachgeladen bei Bedarf.

## Datenfluss

`data/curated/*.yaml` (Handarbeit) + `data/cache/*` (APIs) → `pipeline/build.ts` → `public/data/*`

`public/data/` wird **mit committet** — die Seite ist statisch und lädt genau diese Dateien.
`data/cache/` ist bewusst nicht im Repo; die nächtliche Action baut ihn neu auf.

## Sprache

Oberfläche, Kommentare, Commit-Messages und Dokumentation auf Deutsch. Feldnamen im Code
bleiben englisch (`releaseType`, `firstEpisodeDate`), damit sie zu den Fremd-APIs passen.

## Wo was liegt

- `shared/` wird von Pipeline, Web-App **und** Worker importiert. Nichts hier hineinschreiben,
  was Node-APIs oder DOM braucht.
- Statusberechnung (`airing`/`abgeschlossen`/`tba`/`unbekannt`) steht in `shared/logic.ts` und
  wird nie gespeichert, sondern immer gegen das heutige Datum gerechnet.
- Zeitzonen laufen ausschließlich über `shared/time.ts`. Alle Datumsangaben im Datensatz sind
  Ortszeit Europe/Berlin; die Umrechnung nach UTC für ICS und Google Calendar passiert dort
  über `Intl`, damit die Sommerzeit stimmt.

## Newsletter

Der Worker in `worker/` ist optional. Ohne gesetztes `VITE_NEWSLETTER_API` zeigt das Formular
einen ehrlichen Hinweis statt eines kaputten Buttons. DSGVO-Pflichten (Double-Opt-in,
Abmeldelink, Impressum, Datenschutzerklärung) sind kein Nice-to-have — nichts davon entfernen.

## Caches: die Adresse ist die Version

Datenadressen tragen den Datenstand (`/data/events.json?v=20260812142619`), eingesetzt in
`vite.config.ts` aus `meta.generatedAt`. Ohne das blieb nach einem Deploy die alte Fassung
stehen, und nur Strg+Shift+R half — dieselbe Adresse ist für Browser-Cache und Service Worker
dieselbe Datei, egal was darin steht.

- **Datenstand, nicht Commit-Hash.** Ein Deploy ohne Datenänderung soll niemanden 551 KB
  Titeldaten erneut laden lassen.
- **ICS-Feeds bekommen keine Kennung** (`feedUrl`). Die Adresse wird abonniert, nicht abgerufen;
  eine Kennung darin wäre beim nächsten Deploy ein totes Abo.
- **Offline ignoriert die Kennung** (`ignoreSearch` in `sw.js`) — lieber alte Termine als eine
  leere Seite.
- Jeder Cache im Service Worker hat eine Obergrenze. Ohne sie wächst er still: einmal 313 MB
  Cover (10.08.2026), einmal 400 KB Programmdateien je Deploy (12.08.2026).

## Vor dem Commit

```bash
npm run data:validate && npm run check:logic && npx tsc -b && npm run check:worker && npm run build
```

**`npm run check:worker` nicht weglassen.** Das Haupt-`tsconfig.json` deckt nur `web/src`,
`pipeline` und `shared` ab — `worker/` hat ein eigenes und wird von `tsc -b` **nicht** erfasst.
Am 12.08.2026 meldete `tsc -b` „sauber" für Code, in dem fünfmal eine gelöschte Variable stand;
der Fehler wäre erst beim `wrangler deploy` aufgefallen.
