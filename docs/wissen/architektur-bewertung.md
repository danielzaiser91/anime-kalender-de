# Architekturbewertung — kritisch, mit Alternativen

Stand 02.10.2026. Grundlage: Code, Datensatz, Live-Messung (siehe [karte.md](karte.md), [befund-2026-10-02.md](befund-2026-10-02.md)).
Maßstab ist das Projektziel in `CLAUDE.md`: *nichts behaupten, was nicht belegt ist* — bei einem Ein-Personen-Betrieb mit Agenten als Hauptentwickler.

## Urteil in drei Sätzen

Die **Auslieferung** (statische Dateien, Nachladen in Gruppen, kein Tracking) ist richtig und billig. Die **Datenherstellung** ist das Risiko:
Wahrheit entsteht aus ~200 Skripten, Dateien als Schnittstelle, reihenfolgeabhängigen Regeln in `build.ts`-Phasen und einer
Prüfung, die nur die Fehler kennt, die schon einmal passiert sind (Befund B-07). Das Projekt kompensiert mit enormer Disziplin
(Wache, Gleichheitsbeweise, Chronik) — der nächste Schritt ist, diese Disziplin aus Prosa in **Invarianten** zu überführen, die der Bau erzwingt.

## Bewertung je Baustein

| Baustein | Note | Begründung |
|---|---|---|
| Statische Auslieferung (Pages + JSON) | **gut** | 0 € Betrieb, schnell, ausfallsicher; Gruppennachladen (Synopsen/Disc/Stimmen) sauber. Aber: Erstaufruf 470 statt 142 KB, 93 % der Termine sind Vergangenheit (C-01) |
| Daten im Git-Repo | **tragfähig, wird teuer** | Nachvollziehbare Historie, aber 209 MB `data/`, 64 MB+ `.git`, und die Läufe kollidieren (`concurrency: daten`, `commit-data.sh` „rettet" Dateien, Regel „während eines Datenlaufs keine QUELLEN-Datei committen"). Je mehr Sonderregeln, desto klarer das Signal, dass Git hier als Datenbank und als Quellcode-Verwaltung zugleich dient |
| Pipeline (TS, Phasen `bau/NN-*`) | **gewachsen, mit Rissen** | Gute Zerlegung nach 7.809-Zeilen-`main()`; Phase `09-*` bleibt riesig (`werteWeitereQuellenAus` 619 Z.). Reihenfolgeabhängigkeiten sind real („Riegel prüft den Wert, den er sieht", `if (stream.dub !== undefined) continue`) und nur in Prosa festgehalten |
| Beweismodell (Handbeleg > Urteil > API > JW > aniSearch > News) | **richtige Idee, verteilt umgesetzt** | Es gibt vier parallele Stellen, die „deutsch ja/nein" setzen (26 Setzstellen in `build.ts`, `urteile.json`, `dub-confirmed.yaml`, `verweise-von-hand.yaml`); das Meldemodell in vier Stufen (`docs/konzept-meldungen-architektur.md`) löst genau das — bei 74,8 % Deckung, Stufe 3 offen |
| Prüfungen | **viel, aber nach Vorfall statt nach Invariante** | 91 Prüfdateien, `check-logic.ts` 7.749 Zeilen Eigenbau-Asserts, trotzdem grün bei B-02…B-06. Kein Testframework, keine Laufzeit-Schemas an den Dateigrenzen |
| Web-App (React 19, Vite, Tailwind 4) | **solide, aber schwergewichtig** | Typisiert, schnelle Ladekette (Preload der Startdaten), gute A11y-Basis. `DetailPanel` 1.290 Z., `StaticViews` 1.282 Z., Entscheidungslogik des Panels (`antwort-*`) umfangreich und kaum isoliert testbar. Hash-Router + Pfadumschreibung (`/r/<slug>/`) ist eine Eigenkonstruktion mit Sonderfällen (`panelUnterlegen`, `popstate`+`hashchange`) |
| Worker + D1 + DO + R2 | **angemessen** | Genau das Bewegliche (Newsletter, Push, Meldungen). Ein Token für alle Routen (C-02), zwei Cloudflare-Konfigurationen im Repo, Hosting der Seite bei GitHub statt Cloudflare (keine Header, C-03) |
| Browser-Erweiterung | **Engpass und Risiko** | 31,8 k Zeilen untypisiertes JS, `amazon.js` 11.174 Zeilen in einer Datei (eine Funktion 1.906 Z.). Sie ist die *einzige* Quelle für Prime/Netflix/Disney+-Tonspuren und hängt an deren DOM. Jeder Umbau dort ist teuer, jeder Fehler ein Falschbeleg |
| Betrieb (18 Workflows, Claude-Läufe, Wache) | **überdurchschnittlich** | Stille Ausfälle werden gesucht (`recordSource`-Pflicht, Fristen). Es fehlt ein **Risikoregister** (welche Quelle trägt wie viel, was passiert bei Sperre, Ersatzweg) — heute verteilt auf `quellen.md` und `status.md` |
| Dokumentation | **tief, schwer zu finden** | 8.000 Zeilen Chronik; kein Gesamtbild (jetzt `karte.md`); drei Dateien mit veralteten Zahlen (`ARCHITEKTUR.md`, `TODO.md`, `ZIELE.md`). Agenten laden zu viel oder das Falsche |

## Die drei größten Hebel (nach Nutzen/Aufwand)

1. **Invarianten am Ergebnis, ausführbar als SQL.** `tools/bestand-db.mjs` + `bestand.sqlite` existieren (Datenbank-Plan Stufe 1). Der Bau lädt den
   fertigen Datensatz in SQLite (`UNIQUE(slug)`, Fremdschlüssel `titleId`, `episode ≤ episodeCount`, Monotonie per Window-Funktion,
   Zählwörter aus `COUNT(*)` statt aus Konstanten) und bricht bei Verletzung ab. Das hätte B-02…B-08 beim Entstehen gefangen und macht
   die Zählworte der Oberfläche (B-01) ableitbar statt behauptet. Aufwand M, Wirkung hoch, kein Umbau der Pipeline nötig.
2. **Ein Beweisregister statt vier Setzstellen.** Jede Aussage als Datensatz `(Gegenstand, Aussage, Quelle, Beobachtet-am, Stufe)`; die Entscheidung
   „deutsch ja/nein/unbekannt" ist *eine reine, getestete Funktion* über diese Zeilen (Eigenschaftstests: Handbeleg schlägt API, neuerer schlägt älteren
   gleicher Stufe, unbekannt ≠ nein). Das ist das Meldemodell Stufe 3/4, nur konsequent zu Ende: dann sind Reihenfolgeabhängigkeiten im Code unmöglich.
   Aufwand L, Wirkung sehr hoch, Weg ist vorgezeichnet.
3. **Ladelast und Header durch Verlagerung zu Cloudflare.** Seite von Pages auf Cloudflare Workers Assets/Pages (Vite-Plugin und `wrangler.jsonc` mit SPA-Fallback
   sind schon da): Sicherheits-Header, Cache-Regeln je Dateityp (JSON `max-age` + `stale-while-revalidate`, gehashte Assets `immutable`), Brotli, ggf. Bildproxy
   mit Größenstufen für die AniList-Cover (Mobilwoche 4,3 MB → < 1 MB) und Datenschutzgewinn (kein Direktabruf bei AniList/TMDB). Dazu `events.json` in
   „ab heute −14 Tage" (Start) und Archiv je Jahr (nachgeladen). Aufwand M.

## Weitere Alternativen und Abwägungen

| Frage | Heute | Alternative | Empfehlung |
|---|---|---|---|
| Wo liegen Daten? | Git (`data/`, `public/data/`) | (a) eigener Daten-Branch/-Repo; (b) Objektspeicher R2 mit versionierten Snapshots, Bau zieht Stand; (c) SQLite als Wahrheit, JSON nur Export | (c) langfristig, (a) kurzfristig gegen Konflikte; (b) erst bei > 1 GB |
| Router | Hash + Pfad-Umschreibung | Echte Pfade (`/woche`, `/datenbank`, `/r/slug`) mit SPA-Fallback — nach Hosting-Wechsel möglich; SEO-/Teilen-Probleme entfallen, `panelUnterlegen` entfällt | nach Hosting-Wechsel |
| SEO/Teilen | Vorgerenderte `/r/`- und `/t/`-Köpfe + SPA | Statische Generierung mit echtem Inhalt je Titel (Astro/Next-Export, 2.783 Seiten) — Suchmaschinen sehen Text, nicht nur Metadaten | prüfen: Search-Console-Daten auswerten, bevor investiert wird |
| Tests | Eigenbau-Asserts + Screenshot-Skripte | Vitest für `shared/` + `pipeline/lib/`, Playwright-Test-Runner für `check:ansichten`, `axe-core` für A11y, dazu ein Smoke-Test aller Routen in `aussehen-pruefen.yml` | M; `check-logic.ts` schrittweise nach Vitest ziehen |
| Laufzeit-Schemas | nur TypeScript | `zod`/`valibot` an den Rändern (jede `data/*.json` beim Lesen, `public/data/*` beim Schreiben) — fängt kaputte Quellen vor dem Bau | M |
| Erweiterung | 3 große JS-Dateien | TypeScript + esbuild-Bündel, Module je Plattform, Fixture-Tests mit gespeicherten Seiten (`extension/*.test.cjs` gibt es teilweise) — oder Umfang senken: MotN/JustWatch als Primärquelle, Erweiterung nur für Nachprüfung | L; zuerst `amazon.js` zerlegen (Skill `zerlegen`) |
| Tokens | ein `LAUF_TOKEN` | getrennte Schlüssel je Zweck/Richtung, Header-only, Rotation dokumentiert | S |
| Quellenrisiko | verteilt dokumentiert | Risikoregister (Quelle · Anteil am Bestand · Rechtslage · Ersatz · Sperre-Stand) mit Datum, erneuert durch die Wache | S, hoher Nutzen |
| Dokumentation für Agenten | `CLAUDE.md` + 5 Wissensdateien | Kurzer Einstieg (neu: `karte.md`), Projekt-Skill `anime-kalender-orientierung`, Chronik nur auf Abruf, Zahlen in Dokus *generiert* (Skript schreibt Kennzahlen in `ARCHITEKTUR.md`) | S, umgesetzt (siehe unten) |

## Was nicht geändert werden sollte

- **Keine Datenbank für Lesedaten** (Argument in `ARCHITEKTUR.md` bleibt richtig) — SQLite ist ein *Prüfwerkzeug im Bau*, kein Laufzeit-Backend.
- **Kein SSR/Server im Ladepfad**, kein Live-Abruf fremder Seiten beim Seitenaufruf.
- **„Unsicher kennzeichnen statt weglassen"** und die Trennung `note`/`herkunft` — das ist der Qualitätskern.
- **Gleichheitsbeweise bei Umbauten** (`bau-vergleich`, `panel-vergleich`) — ausbauen, nicht ersetzen.

## Vorgeschlagene Reihenfolge

1. B-07 (fünf Prüfzeilen in `pruefung.ts`) und B-06/B-04 beheben — Stunden.
2. B-01 Zählwörter an Belegklassen binden; `ARCHITEKTUR.md` durch generierte Kennzahlen ersetzen — ein Tag.
3. Schwellenwächter für Ladelast (Test in `check:vor-commit`: Startdaten gzip < 300 KB) und `events.json`-Teilung — ein Tag.
4. SQLite-Invarianten im Bau (Hebel 1).
5. Hosting-Wechsel mit Headern, Bildproxy, echten Pfaden (Hebel 3).
6. Beweisregister (Hebel 2) als Fortsetzung des Meldemodells.
