# Projektregeln: anime-kalender-de

## Grundsatz: nichts behaupten, was nicht belegt ist

Dieses Projekt lebt davon, dass die Termine stimmen. Deshalb gilt ausnahmslos:

- **Kein Termin ohne `sources`.** `npm run data:validate` bricht sonst ab, und das ist Absicht.
- **Keine erfundenen Uhrzeiten.** Ist die Uhrzeit nicht belegt, bleibt `time` leer — die
  Oberfläche schreibt dann „Zeit offen". Das ist besser als eine plausible Falschangabe.
- **Abgeleitetes kennzeichnen.** Datum aus dem Simulcast-Start übernommen statt aus einer
  Dub-Ankündigung? Dann `estimated: true`. Folgenzahl geraten? Setzt die Pipeline selbst als
  `episodeCountAssumed`. Beides erscheint im UI als `≈`.
- Bei Fortsetzungen die **AniList-ID prüfen**, nicht der Suche vertrauen. `npx tsx
  pipeline/qa-resolve.ts` zeigt Verdachtsfälle; die Folgenzahl wird nur übernommen, wenn das
  japanische Ausstrahlungsjahr zum deutschen Termin passt.

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

## Vor dem Commit

```bash
npm run data:validate && npx tsc -b && npm run build
```
