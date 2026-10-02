# Karte der Anwendung — wo was liegt und wie man gezielt ändert

Stand 02.10.2026, aus Code, Datensatz und Live-Seite gelesen (Zahlen gemessen, nicht aus der Doku übernommen).
**Wann lesen:** vor jeder Änderung, bei der unklar ist, *wo* sie hingehört. Die übrigen Dateien in `docs/wissen/` sind
Chronik („warum so, nach welchem Vorfall"); diese Datei ist der Index dazu. Befunde: [befund-2026-10-02.md](befund-2026-10-02.md),
Bewertung: [architektur-bewertung.md](architektur-bewertung.md).

## 1. Was das Produkt ist (ein Absatz)

Statische React-Seite (Vite, Tailwind 4, Hash-Router) über einem Datensatz aus JSON-Dateien. Der Datensatz wird von einer
Pipeline (`tsx`-Skripte, GitHub Actions) aus ~15 Quellen gebaut und mit ins Repo committet; ein Deploy-Workflow stellt
`dist/` auf GitHub Pages (`anime-kalender.de`). Beweglich sind nur ein Cloudflare Worker (+ D1-Datenbank: Newsletter,
Push, Favoriten-Abgleich, Prüfungen der Browser-Erweiterung, Laufstatus) und eine Chrome-Erweiterung, mit der Daniel
Tonspuren bei Netflix/Prime/Disney+ von Hand meldet. Umfang (02.10.2026): 2.783 Anime + 917 westliche Serien,
722 Releases, 3.059 Termine, 15.147 Titel „ohne Synchro" (nachladbar), 358 News-Tage.

## 2. Datenfluss

```
Quellen ──fetch-*/scrape-* (Actions, Cron)──► data/*.json, data/cache (Rohdaten, Gedächtnis, Belege)
Handarbeit ─► data/curated/*.yaml · data/dub-confirmed.yaml (Handbelege, 1 MB) · verweise-von-hand.yaml · ankuendigungen.yaml …
Erweiterung ─► Worker /pruefung (D1) ─► Wache/Briefkasten ─► Daniel ─► dub-confirmed.yaml
        │
        ▼  pipeline/build.ts  (Phasen pipeline/bau/NN-*.ts, Helfer pipeline/lib/)
public/data/*.json  (titles-core, titles, releases, events, news, franchises, cartoons, ohne-synchro,
                     synopses/N, disc/N, voices/<id>, feeds/*.ics, meta.json …)  ── wird mit committet
        ▼  vite build + pipeline/build-share-pages.ts  ──► dist/  ──► GitHub Pages
```

Reihenfolge im Bau (`pipeline/build.ts`): 01 Quellen laden → 02 Titel → 03 Reihen → 04 CR-Sendeplätze → 05 Releases →
06 CR-Simuldubs → 07 ADN → 08 News/TV → 09 Synchro je Plattform (`09-1…09-7`, die größte Phase) → 10 Termine ausrollen →
11 Wege abschließen (`11-1…11-4`) → 12 Meta → 13 Schreiben (`13-1…13-5`) → 14 ICS. Am Ende prüft
`pipeline/lib/pruefung.ts` den erzeugten Datensatz (siehe Befund B-07: lückenhaft).

## 3. Verzeichnisse

| Pfad | Inhalt | Umfang 02.10.2026 |
|---|---|---|
| `shared/` | Typen und reine Logik für Pipeline, Web **und** Worker (`types.ts`, `logic.ts`, `time.ts`, `titles.ts`, `kostenlos.ts`, `tv-signale.ts` …). Keine Node-/DOM-APIs | 19 Dateien, 4,8 k Zeilen |
| `pipeline/` | Bau (`build.ts`, `bau/`), Abrufer (`fetch-*.ts`, `scrape-*.ts`), Prüfungen (`check-*.ts`), Helfer (`lib/`) | 200 Dateien, 55 k Zeilen |
| `web/src/` | React-App: `App.tsx`, `components/` (Kalender in `kalender/`, Panel in `detail/`), `lib/` | 94 Dateien, 19,6 k Zeilen |
| `worker/` | Cloudflare Worker `src/index.ts` (Routen), D1-Migrationen, Mail, Push, Beleg-Ablage (R2) | 24 Dateien, 5,3 k Zeilen |
| `extension/` | Chrome-Erweiterung (Manifest v3), `amazon.js` 11,2 k, `melder.js` 6,6 k Zeilen | 50 Dateien, 31,8 k Zeilen |
| `tools/` | Prüf-/Messskripte, Umbauhelfer (`bau-vergleich.mjs`, `modul-umzug.mjs`), `claude-global/` | 99 Dateien, 14,6 k Zeilen |
| `data/` | Rohdaten, Gedächtnis, Handbelege (209 MB, 11 k Dateien) — nie ausgeliefert | |
| `public/` | Ausgeliefertes: `data/`, `og/` (Link-Bilder), Icons, `sw.js`, `404.html` | 81 MB |
| `docs/` | `wissen/*` (Chronik je Thema, 8 k Zeilen), `recherche-*`, `messung-*`, `archiv/` | |
| `daniel-zum-abarbeiten/` | Maschinell erzeugte Arbeitslisten für Daniel (Wache, Prüflisten) | 34 Dateien |
| `.github/workflows/` | 18 Workflows (3,9 k Zeilen YAML) | |

Wurzel-Altlasten: `.anisearch*.log`, `crdub-lauf2.log`, `katalog-lauf*.log`, `.tmdb.log`, `weiche-vercel/`, `worker-cr/` (leer),
`dist/` und `.wrangler/` — nicht versioniert oder reiner Müll, siehe Befund B-20.

## 4. Datenmodell in fünf Sätzen

1. **Title** = ein AniList-Eintrag (`id` = AniList-ID; westliche Serien haben **negative** IDs = −TMDB-ID).
2. **Release** = eine deutsche Veröffentlichung eines Titels bei einem Anbieter (`platform`, `releaseType` weekly/batch/movie/disc,
   `schedule`, `sources`, `quellen`). Pflicht: mindestens eine Quelle.
3. **ReleaseEvent** = ein ausgerollter Tag eines Releases (`expandEvents` in `shared/logic.ts` → `events.json`). Ein Wochen-Release
   hat so viele Events wie Folgen; `observed` (gesehene Tage) schlägt jede Rechnung.
4. **StreamLink** an `Title.streams` = ein Weg zum Ansehen mit `dub`, `dubRanges`, `zugang` (abo/kauf/kostenlos);
   `watchLinks` = übrige Wege (Disc-Shops, Maxdome …). Der Beleg dahinter ist ein *Handbeleg* (`data/dub-confirmed.yaml`)
   oder ein *Urteil* (`data/urteile.json`, Konzept `docs/konzept-meldungen-architektur.md`).
5. **Status** (`airing`/`abgeschlossen`/`tba`/`erschienen`/`unbekannt`) wird nie gespeichert, sondern in `shared/logic.ts`
   (`releaseStatus`, `titleStatus`, `istErschienen`, `istAusgeblieben`) aus Daten + Heute berechnet — **jede** Zählung
   „erschienen/nächste Folge" geht über diese Funktionen.

Auslieferungsdateien (`public/data/`), gzip auf der Leitung, gemessen 02.10.2026:

| Datei | roh | gzip | geladen wann |
|---|---|---|---|
| `meta.json` | 9 KB | 3 KB | Start |
| `titles-core.json` (nur Titel mit Release, 509) | 715 KB | 145 KB | Start |
| `releases.json` (722) | 582 KB | 75 KB | Start |
| `events.json` (3.059, davon 93 % vergangen) | 841 KB | 61 KB | Start |
| `index-*.js` / `index-*.css` | 520 / 111 KB | 162 / 25 KB | Start |
| `news.json` | 213 KB | 32 KB | News-Ansicht |
| `titles.json` (2.783) | 3,5 MB | 747 KB | Datenbank |
| `synonyme.json`, `franchises.json`, `cartoons.json` | 0,4–0,8 MB | 140 / 174 / 246 KB | Datenbank / Panel |
| `ohne-synchro.json` (15.147) | 5,5 MB | 1,28 MB | Schalter „ohne Synchro" |
| `synopses/N`, `disc/N` (32 Gruppen, `id % 32`), `voices/<id>` | klein | | Panel |

**Erstaufruf ≈ 470 KB gzip** (Bündel + CSS + vier Startdateien) — nicht 142 KB wie `ARCHITEKTUR.md` (Stand 11.08.) behauptet.

## 5. Oberfläche (Routen und Komponenten)

Hash-Router (`web/src/lib/router.ts`): `#/woche`, `#/monat`, `#/datenbank`, `#/news`, `#/abo`, `#/newsletter`, `#/quellen`,
`#/impressum`, `#/datenschutz`; Filter-Pillen als Query (`p`, `anb`, `rt`, `st`, `fsk`, `y`, `g`, `kw`, `x…` = Ausschluss, `q`, `conf`, `d`, `t`, `sort`).
**Die fünf Schnellfilter** (Nur Favoriten, Kostenlos, Nur bestätigte, Disc ausblenden, Nur verfügbar) sind seit 02.10.2026 **Vorlieben in
`localStorage`** (`lib/vorlieben.ts`, Schlüssel `vorlieben`; TV ausblenden: `tvAus`); `fav=1`, `frei=1`, `sicher=1`, `wo=1` werden nur noch gelesen
(einmalige Aktivierung, z. B. Push-Link), nie geschrieben. Der offene Titel steht **im Pfad**: `/r/<release-slug>/` (vorgerenderte Teilen-Seite mit
OG-Tags, `build-share-pages.ts`) bzw. `/t/<titel-slug>/`. Alte Adressen `#/agenda|favoriten|wo` leiten um (`ALTE_ANSICHTEN`).

| Soll geändert werden … | … dann hier |
|---|---|
| Wochen-/Monatsraster, Karten | `components/WeekView.tsx`, `MonthView.tsx`, `kalender/PosterKarte.tsx`, `kalender/TvKasten.tsx`, `kalender/Schwebe.tsx` |
| Untere Steuerleiste, Filterfeld | `kalender/KalenderKopf.tsx` (`Steuerleiste`), `FilterBar.tsx`, `kalender/FilterFeld.tsx`; Logik `lib/filters.ts` |
| Datenbank-Ansicht, Suche | `DatabaseView.tsx`, `lib/search.ts`, `lib/filter-suche.ts`, `Suchfeld.tsx` |
| Detail-Panel (Kopf, Antwortkasten, Pillen, Reihen, Neuigkeiten) | `DetailPanel.tsx` (1.290 Z., darin eine Funktion `DetailPanel` von 1.237 Z.; Limit 80/800, Überlänge nur sinkend per `check:umfang`) + `detail/*` — Antwort-Logik `detail/antwort-berechnen.ts`, `antwort-regeln.ts`, `antwort-kasten.tsx`; Pillen `detail/pillen.tsx`, `wege-sortieren.ts`, `verweise.ts` |
| News-Seite | `NewsView.tsx`, `news-belege.tsx`, `lib/news-text.ts`; Daten `pipeline/lib/news.ts` |
| Statische Seiten, Newsletter-Formular, Abo | `StaticViews.tsx` (1.282 Z.) |
| Texte (i18n de/en) | `lib/i18n.tsx`, `i18n-kalender.ts`, `i18n-seiten.ts` |
| Favoriten, Push, Newsletter-Abgleich | `lib/favorites.ts`, `push.ts`, `push-nachfuehren.ts`, `newsletterSync.ts` |
| Laden der Daten, Caches | `lib/data.ts`; Service Worker `public/sw.js`; `__BUILD_ID__` aus `vite.config.ts` |
| Farben, Schriften | `web/src/styles.css` (`--ak-*`, Tailwind `bg-ak-grund`); Schriften selbst gehostet (`@fontsource`) |

Oberflächenregeln, die man kennt, bevor man Text schreibt: keine Information zweimal; `note` (für Besucher) vs. `herkunft` (für uns);
„≈" kennzeichnet Geschätztes; Jede neue arbiträre Tailwind-Klasse im gebauten CSS nachprüfen (verschachtelte `calc` fehlen lautlos).

## 6. Pipeline: Abrufer nach Quelle

| Quelle | Skript | Takt (Workflow) | Liefert |
|---|---|---|---|
| Crunchyroll Simulcast-Kalender | `scrape-crunchyroll.ts` | stündlich (`refresh-hourly`, :23) | Termine, Uhrzeit, „(Deutsch)" |
| Crunchyroll Content-API (de-Katalog, braucht 24-h-Zugangspaket aus Deutschland: `tools/cr-zugang-holen.mjs`) | `scrape-crunchyroll-dub.ts`, `fetch-crunchyroll-offene.ts` | täglich/Nachholen | Sprachfassung je Block |
| ADN | `fetch-adn.ts` (`--laufend` alle 6 h) | `adn-laufende`, täglich | Datum, Uhrzeit, `vde`/`vostde` |
| AniList | `fetch.ts`, `fetch-anilist-katalog.ts` | täglich | Stammdaten, Reihen |
| aniSearch | `fetch-anisearch*.ts` | wöchentlich | deutsche Titel/Beschreibung, Ausgaben, Anbieter, Folgen |
| TMDB / JustWatch / MotN | `fetch-tmdb*.ts`, `fetch-justwatch-audio.ts`, `fetch-motn*.ts` | täglich/wöchentlich/monatlich | Anbieter, FSK, Tonspur (Netflix) |
| Anime2You (RSS) | `scrape-anime2you.ts` | täglich | Vorschläge → `data/proposals` |
| TV (tv.de, plus.rtl.de), TOGGO, RTL+, Joyn(via JW) | `fetch-tv-programm.ts`, `fetch-toggo.ts`, `check-rtlplus.mjs` | stündlich/täglich | Sendungen, Fenster |
| Kino | `fetch-cinestar.ts`, `fetch-kinoheld.ts`, `fetch-tmdb-kino.ts` | täglich | Kinostarts |
| Wikipedia/ANN/RTL+ Folgenlisten | `fetch-wikipedia-folgen.ts`, `fetch-ann-*.ts` | wöchentlich | Folgentitel, Sprecher |
| Erweiterung (Netflix/Prime/Disney+) | `extension/*` → Worker → `fetch-pruefungen.ts` | von Hand | Tonspuren je Folge |

Wache/Überwachung: `check-sources.ts` (Frist je Quelle), `delta-wache.yml` (07:20 UTC, Verluste im Bestand),
`d1-verbrauch.yml`, `tools/laeufe-aufraeumen.mjs`, Statusanzeige über den Worker (`/lauf`), `daniel-zum-abarbeiten/00-wache*.md`.
Claude-Läufe in Actions: `claude-verpasst-recherche.yml` (täglich 11:17 UTC, darf nur drei Felder schreiben),
`claude-reparatur.yml`, `claude-auftrag.yml`, `claude-daten-merge.yml`.

## 7. Worker (`worker/src/index.ts`)

Routen: `/subscribe /confirm /unsubscribe /prefs /favorites /push/*` (öffentlich, Newsletter/Push), `/lauf /pruefung /netzfund /vorfall /beleg`
(Header `X-Lauf-Token` = ein gemeinsames Geheimnis `LAUF_TOKEN`, GET teils auch `?token=`), `/status /ereignisse` (Statusanzeige per
Durable Object `EREIGNISSE`), `/cr-zugang`, `/land`, `/debug/*` (eigenes `DEBUG_TOKEN`, ebenfalls als Query), `/restore`, `/sync`, `/rhythmus`,
`/feed/favoriten.ics`. Cron stündlich (`0 * * * *`); ob versendet wird, entscheidet die Berliner Ortszeit (`SEND_HOUR_BERLIN=7`).
Bindings: D1 `DB`, R2 `BELEGE`, DO `EREIGNISSE`. Migrationen in `worker/migrations`; ausliefern **nur** mit
`cd worker && npx wrangler deploy --config wrangler.toml`. Der Worker (`newsletter`) ist von der Wurzel-`wrangler.jsonc`
(Assets-Hosting, nur für `npm run preview`/`deploy`) getrennt — zwei Cloudflare-Konfigurationen im selben Repo.

## 8. Rezepte: gezielte Änderungen

| Aufgabe | Vorgehen |
|---|---|
| Neuen Abruf anbinden | Skript in `pipeline/`, Ergebnis nach `data/`, `recordSource()`/`meldeAbbruch()` aufrufen (Pflicht, `check:workflows` prüft), in `tools/quellen-liste.sh` eintragen, Workflow-Schritt mit `concurrency: daten`, Frist in `check-sources.ts`, Eintrag in `docs/wissen/quellen.md` |
| Falsche Synchro-Angabe an einem Titel | Beleg prüfen (`data/dub-confirmed.yaml`, `urteile.json`, `verweise-von-hand.yaml`), **nicht** in `public/data` editieren (wird überschrieben). Danach `npm run check:handbelege` |
| Termin falsch | Quelle in `data/curated/*.yaml` bzw. `ankuendigungen.yaml` korrigieren; bei Beobachtungen `schedule.observed`; Zusicherung in `pipeline/check-logic.ts` ergänzen |
| Neues Feld am Titel | Typ in `shared/types.ts`; in `13-*` schreiben; **nicht** nach `titles-core.json`, wenn nicht die Mehrheit es braucht (Ladelast) |
| Neue Prüfung am Datensatz | `pipeline/lib/pruefung.ts` (läuft im Bau); Gegenprobe außerhalb: `tools/daten-befund.mjs` |
| Oberflächentext | `lib/i18n*.ts`; Kurztexte nach Skill `kurze-texte-fuer-nutzer` |
| Große Funktion zerlegen | Skill `zerlegen`, `tools/modul-umzug.mjs`, Gleichheitsbeweis `tools/bau-vergleich.mjs` / `panel-vergleich.mjs` |
| Vor dem Commit | `npm run check:vor-commit`; bei `web/src` zusätzlich `check:ansichten`, `check:panel` |

## 9. Werkzeug-Fallen in dieser Umgebung (02.10.2026 gemessen)

- Das Bash-Werkzeug auf Daniels Rechner kennt weder `ls`/`wc`/`tail`/`head`/`cat` (Hook ersetzt sie durch ein fehlendes `rtk`) noch
  `node` im PATH. Funktioniert: `"/c/Program Files/nodejs/node.exe" skript.cjs`, Read/Glob/Grep, `tsx` über
  `node node_modules/tsx/dist/cli.mjs pipeline/x.ts`. PowerShell ist per Regel gesperrt.
- `Glob` über das Repo-Wurzelverzeichnis liefert wegen `worker/node_modules` Müll — immer ein Unterverzeichnis angeben.
- `playwright` liegt in `node_modules`, Chromium unter `%LOCALAPPDATA%\ms-playwright`; gegen die Live-Seite braucht es keinen Server.
- Ein `<a>`/Karte mit mehrfach vorkommendem Text (`text=Hana-Kimi`) trifft erst ein unsichtbares Element — `[aria-label^="Details zu …"]` nehmen.

## 10. Wo die Wahrheit steht (Prüfhierarchie)

Handbeleg (`dub-confirmed.yaml`) > Urteil aus Messung (`urteile.json`) > Anbieter-API (CR-Katalog, ADN `vde`) > JustWatch/MotN >
aniSearch („Synchronisiert"-Marke) > Anime2You-Text > Schätzung. Widerspricht eine niedrigere Stufe einer höheren, gewinnt die höhere und
der Widerspruch kommt auf eine Prüfliste (`check:quellen`, `kanal-gegenprobe`, `verdacht.mjs`). Dass diese Rangfolge existiert, steht
nirgends an einer Stelle — dieser Absatz ist die erste Zusammenfassung (aus `quellen.md`, `datensatz.md` und `build.ts` rekonstruiert).
