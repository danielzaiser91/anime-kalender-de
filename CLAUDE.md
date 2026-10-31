# Projektregeln: anime-kalender-de

Kurzfassung. Volltext, Anlässe, Zahlen, Laufkennungen: [docs/wissen/projektregeln-im-detail.md](docs/wissen/projektregeln-im-detail.md) — bei Zweifeln dort nachlesen; neue Anlässe kommen dorthin, hier höchstens ein Halbsatz.

## Projektziel

Gesamtüberblick aller **Animation mit deutscher Synchronfassung** (nicht nur japanisch), erschienen und angekündigt: filterbar, durchsuchbar, als Kalendereintrag übernehmbar. Synchro ist nicht Untertitel; nichts behaupten, was nicht belegt ist; Unsicheres kennzeichnen statt weglassen (gestrichen wird nur, was eine Quelle widerlegt); nicht nur wann, auch wo; rechtzeitig Bescheid geben (Kalender-Abo, ICS, Newsletter). Kein Ziel: Community, Bewertungen.

**Leitziel Mobile Performance** (Skill `web-best-practice`, [ZIELE.md](ZIELE.md)). **Nichtkommerziell, für immer:** keine Werbung, kein Tracking zu Werbezwecken.

## Harte Grundsätze (Details im Volltext)

- Kein Termin ohne `sources`; keine erfundenen Uhrzeiten (Ausnahmen als `timeEstimated`: Netflix-Eigenproduktion 08:00 UTC; Regeltermin aus Sichtungsfenster (`timeSighting`, unter 60 min ohne ≈); Altfall in `FESTGELEGTE_ZEITEN`, sonst prüft `data:validate` jede `time` + `timeEstimated`); keine erfundene Folgenzahl.
- Abgeleitetes kennzeichnen (`estimated`, `episodeCountAssumed`, „≈"); Wochentakt wird gemessen (`bestimmeRhythmus()`); belegtes Ende (`lastEpisodeDate`) schlägt Fortschreibung.
- Plattform-Serienkennung = Franchise, keine Staffel (Zuordnung über Folgenzahl); ein Anime gehört genau einer Kennung. Namensabgleich: bester Treffer, nicht erster (`bewerteTreffer`).
- Ein Vorfilter verschiebt, er löscht. „Früheste Beobachtung" ≠ erste Folge; „Im Angebot seit" ≠ „erschienen am". Anime auf AniList/aniSearch/MAL ist kein Cartoon (`cartoon-umzug.json`).
- News-Meldung = Aussage zu ihrem Tag, nie umschreiben ([news-plan.md](docs/wissen/news-plan.md)). Geteilte Staffelstarts: `schedule.firstEpisodeNumber`; bei Fortsetzungen AniList-ID prüfen (`npx tsx pipeline/qa-resolve.ts`).
- Der erzeugte Datensatz wird geprüft (`pipeline/lib/pruefung.ts`, `check:logic`, `check:handbelege`, `check:cr-zuordnung`, `check:quellen`); Handbelege (`data/dub-confirmed.yaml`) haben Vorrang (Reihenfolge in `build.ts`).
- **Datenkorrektur gehört ins Repo (`data/…`), nie nach `data/cache/`**; fertig = nach Deploy live gemessen.

## Daten, Läufe, Architektur

- Auf `main` schreibt nur der Bestandsbau; Sammler liefern per Pull Request. Neue Datei im Lauf → `tools/quellen-liste.sh`. Nichts nach `.github/workflows/` pushen, solange ein Sammler läuft (`gh run list --status in_progress`). Zeitpläne vom Cloudflare-Wecker. Datenläufe remote: `gh workflow run <datei>.yml --repo danielzaiser91/anime-kalender-de`. **Auswertungen und Einmal-SQL nie an der echten D1**, sondern an der Kopie: `node tools/meldungskopie.mjs holen` (Agenten nur über `mit-lauf-token.mjs meldungskopie-holen`), dann `node tools/meldungskopie.mjs abfrage "…"` (betrieb.md, Abschnitt Meldungskopie).
- Roter Lauf wird bemerkt, nicht gemeldet: `node tools/laeufe-aufraeumen.mjs --trocken` an jeder Wachphase und nach jedem Push; eine `ALARM`-Zeile (Bestandsbau > 6 h rot, rot > 1 h mit ≥ 2 Fehlerschritten, Deploy > 6 h ohne Erfolg; `tools/bestand-rot-alarm.mjs`) geht vor allem anderen.
- Fluss: `data/curated/*.yaml` + `data/cache/*` → `pipeline/build.ts` (Phasen `pipeline/bau/`) → `public/data/*` (committet). Bauweise: [ARCHITEKTUR.md](ARCHITEKTUR.md); neues Feld nur in `titles.json`, wenn die Mehrheit es braucht.
- `shared/` ohne Node/DOM (Pipeline, Web, Worker). Status nur über `shared/logic.ts`; Zeitzonen nur `shared/time.ts` (Daten Europe/Berlin). Oberfläche/Doku deutsch, Feldnamen englisch. Newsletter-Worker optional; DSGVO-Pflichten nie entfernen.

## Codegestalt und Oberfläche

Neues = eigene Funktion/Modul (nicht in Funktion > 80 oder Datei > 800 Zeilen anbauen; `check:umfang` darf nur sinken). Daten als Parameter/Rückgabe. Vorher in `pipeline/lib/`, `shared/`, `web/src/lib/` suchen. Kommentare: Warum in 1–3 Zeilen. Umbau und Verhaltensänderung nie im selben Commit (`tools/bau-vergleich.mjs`, `panel-vergleich.mjs`, Skill `zerlegen`). Keine Information zweimal auf demselben Bildschirm. Klasse an html/body: CSS-Regeln nur mit Vorfahr; Fake-document-Tests sehen keine Stil-Kollision, der Prüfer prüft jede solche Klasse auf Kollision mit CSS-Regeln. Alte Farbklassen (`slate-`, `sky-`, `dark:`, Hex …) in `web/src` dürfen nur sinken (`tools/design-klassen.mjs`, in `check:logic`; seit 14.10.2026), neuer Code nimmt `ak-*`-Tokens. Mockups nur auf der Bühne (echte App), nie freistehendes HTML (Skill `mockups`).

## Vor dem Commit

```bash
npm run check:vor-commit
```

Agenten fahren `check:vor-commit` nicht lokal, die PR-Prüfkette tut es (F40, 19.10.2026; lokal nur berührte Tests und `tsc --noEmit`, Ablauf in `~/.claude/agents/bauer.md`). Prüfer nach Risiko: `node tools/pr-stufe.mjs <PR>` (Stufe 0 ohne eigenen Prüfer-Agent, der CI-Prüfer prüft schlank; Details im Volltext). Nach Generatorlauf **alles** stagen. Lokal zusätzlich nur `check:handbelege` (bei geänderten Belegen); `check:ansichten`/`check:panel` laufen in der Kette als PR-Aussehen. Jedes `tsc` mit `--noEmit`. Mess-/Versuchsläufe enden mit Exit 0.

## Wissen nach Thema (`grep -n "^## " docs/wissen/<datei>.md`)

[karte.md](docs/wissen/karte.md) (Einstieg) · [erweiterung.md](docs/wissen/erweiterung.md) · [quellen.md](docs/wissen/quellen.md) · [betrieb.md](docs/wissen/betrieb.md) · [datensatz.md](docs/wissen/datensatz.md) · [daten-detektiv.md](docs/wissen/daten-detektiv.md) · [meine-woche.md](docs/wissen/meine-woche.md) · [seo.md](docs/wissen/seo.md) · [projektregeln-im-detail.md](docs/wissen/projektregeln-im-detail.md). Neue Erkenntnisse als `##`-Abschnitt mit Datum in die passende Datei.
