import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { leseAuslieferbarePatchnotes } from './lib/patchnotes.ts'

/**
 * Nach `vite build`: schreibt die Patch-Notes mit dem Tag ihres Commits in das Bauwerk (`dist/data/`), unabhängig davon, wann der
 * Bestandsbau zuletzt `public/data/patchnotes.json` geschrieben hat. So geht ein Eintrag mit dem Deploy live, in dem seine Zeile steht.
 * Die versionierten Dateien unter `public/data/` bleiben unberührt (kein Zusatzdiff in PRs).
 */
const DIST_DATEN = 'dist/data'
const liste = leseAuslieferbarePatchnotes()
writeFileSync(`${DIST_DATEN}/patchnotes.json`, JSON.stringify(liste), 'utf8')

const metaPfad = `${DIST_DATEN}/meta.json`
if (existsSync(metaPfad)) {
  const meta = JSON.parse(readFileSync(metaPfad, 'utf8')) as Record<string, unknown>
  meta.patchnotesStand = liste[0]?.datum
  writeFileSync(metaPfad, JSON.stringify(meta), 'utf8')
}
console.log(`dist: patchnotes.json mit ${liste.length} Einträgen, jüngster Tag ${liste[0]?.datum ?? '–'}`)
