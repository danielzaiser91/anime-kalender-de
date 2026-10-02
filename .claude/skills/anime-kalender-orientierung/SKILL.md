---
name: anime-kalender-orientierung
description: Einstieg in dieses Repo (anime-kalender-de) für Agenten — wo was liegt, welche Datei bei welcher Änderung, wie Datensatz und Live-Seite unabhängig geprüft werden und welche Werkzeugfallen es gibt. Vor jeder Arbeit an Daten, Pipeline, Web-App, Worker oder Erweiterung laden, besonders bei „wo gehört das hin?" und bei Fragen zur Datenrichtigkeit.
---

# Orientierung: anime-kalender-de

1. **Karte lesen:** `docs/wissen/karte.md` (Datenfluss, Verzeichnisse, Dateien je Änderungsart, Rezepte). Nicht die ganze Chronik in
   `docs/wissen/*.md` laden — nur den Abschnitt zum Thema: `grep -n "^## " docs/wissen/<datei>.md`.
2. **Änderung einordnen:**
   - falsche Aussage im Datensatz → die *Quelle* korrigieren (`data/dub-confirmed.yaml`, `data/curated/*.yaml`, `data/*-von-hand.yaml`,
     `data/ankuendigungen.yaml`), nie `public/data/*` (wird überschrieben); danach Zusicherung in `pipeline/check-logic.ts`
   - neue Regel im Bau → Phase in `pipeline/bau/`, Helfer in `pipeline/lib/`; Prüfung des Ergebnisses in `pipeline/lib/pruefung.ts`
   - Anzeige → `web/src/components/…` (Zuordnung in `karte.md` §5); Texte `web/src/lib/i18n*.ts`
   - Status/Erschienen/Nächste Folge → ausschließlich `shared/logic.ts`
3. **Datenrichtigkeit unabhängig messen** (vor „funktioniert" und nach jedem Bau): `node tools/daten-befund.mjs` — liest nur, endet immer mit Exit 0, jede ✗-Zeile
   ist ein Befund (doppelte Slugs/Folgen, Datumsreihenfolge, Release ohne Titel, Meta-Zahlen, Titel ohne Beleg, Disc-Suchadressen, Ladelast).
   Die Bauprüfung allein genügt nicht (`docs/wissen/befund-2026-10-02.md`, B-07).
4. **Live prüfen** ohne Server: Playwright (`node_modules/playwright`, Chromium installiert) gegen `https://anime-kalender.de/`, Service Worker
   blockieren (`serviceWorkers: 'block'`), Desktop 1440×900 **und** `devices['Pixel 7']`. Karten per `[aria-label^="Details zu …"]` oder
   Direktlink `/r/<slug>/` öffnen, nicht per Text (`text=` trifft zuerst Verstecktes). Auf Mobil sitzt die Suche hinter einem Symbol.
5. **Zahlen immer messen:** `ARCHITEKTUR.md`, `TODO.md`, `ZIELE.md` sind Momentaufnahmen vom August; `meta.json` zählt Releases anders als die Datei (B-08);
   „belegte Synchro" im Kopf der Datenbank ist keine Belegzahl (B-01).

## Werkzeugfallen (Daniels Rechner, gemessen 02.10.2026)

- Bash: `ls`, `wc`, `head`, `tail`, `cat` scheitern mit `rtk: command not found` (Hook); `node` fehlt im PATH. Stattdessen Read/Glob/Grep und
  `"/c/Program Files/nodejs/node.exe" <skript>`; Wegwerfskripte ins Scratchpad. TypeScript: `node node_modules/tsx/dist/cli.mjs pipeline/x.ts`.
- `Glob` ohne Unterverzeichnis läuft in `worker/node_modules` — immer Pfad angeben.
- Läuft ein Datenlauf, keine Datei aus `tools/quellen-liste.sh` committen (siehe `CLAUDE.md`).
- Im Arbeitsverzeichnis liegen oft fremde, uncommittete Änderungen anderer Sitzungen: nur eigene Pfade stagen (`git add <pfad>`), nie `git add -A`.

## Vor „fertig"

`npm run check:vor-commit` (Kette steht in `CLAUDE.md`); bei Änderungen an `web/src` zusätzlich `check:ansichten`, `check:panel`; bei Datenänderungen
`check:handbelege`. Neue Erkenntnisse als `##`-Abschnitt mit Datum in die passende `docs/wissen/`-Datei, Kennzahlen mit Datum.
