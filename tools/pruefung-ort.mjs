/**
 * Ort jeder Prüfung (18.11.2026): `tools/pruefung-ort.json` nennt die Prüfungen, die nicht in der PR-Kette laufen, sondern nachts gegen main
 * (`.github/workflows/nacht-pruefung.yml`, `npm run check:nachts`). Alles, was dort nicht steht, hat den Ort „pr“. Jede Prüfung hat genau einen Ort:
 * `check:logic` und `tests-alle` lassen die Nacht-Einträge aus, `--nachts` fährt nur sie, `--nachts-deploy` nur die mit `deploy: true`
 * (Prüfungen, die echte Bot-Daten lesen; sie laufen zusätzlich im Deploy, Job `zusicherungen`). Das Urteil über die Datei fällt `tools/pr-kette-ort.mjs`.
 * Fehlt die Datei (Wegwerf-Repos der Tests), gibt es keine Nacht-Einträge.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const ORT_DATEI = 'tools/pruefung-ort.json'

/** Inhalt der Zuordnungsdatei; ohne Datei leer. */
export function leseOrt(wurzel) {
  const pfad = join(wurzel, ORT_DATEI)
  return existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf8')) : { logik: {}, tests: {} }
}

/** Modus aus den Argumenten: `pr` (Standard), `nachts` (`--nachts`) oder `deploy` (`--nachts-deploy`). */
export function leseModus(argv) {
  if (argv.includes('--nachts-deploy')) return 'deploy'
  return argv.includes('--nachts') ? 'nachts' : 'pr'
}

/** Gehört der Eintrag zum Modus? `pr` = alle ohne Nacht-Ort, `nachts` = alle mit, `deploy` = die mit Nacht-Ort und `deploy: true`. */
function passt(eintrag, modus) {
  const nachts = eintrag?.ort === 'nachts'
  if (modus === 'pr') return !nachts
  return nachts && (modus === 'nachts' || eintrag.deploy === true)
}

/** Die Einträge von `liste` zum Modus; `art` = `logik` oder `tests`, `name(eintrag)` = Schlüssel in der Zuordnungsdatei. */
export function nachOrt(liste, ort, art, modus, name = (e) => e) {
  return liste.filter((e) => passt(ort[art]?.[name(e)], modus))
}
