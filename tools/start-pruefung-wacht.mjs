/**
 * Wächter (Daniel, 17.10.2026, PR 1452): Die Startprüfung eines Skripts darf den `file:`-Vergleich nie selbst aus `process.argv[1]` bauen.
 * Unter Linux ergibt das `file:////home/…`, die Prüfung ist nie wahr, `main()` läuft nicht, und das Skript endet grün ohne zu messen.
 * Richtig: `import.meta.url === pathToFileURL(process.argv[1]).href`.
 * Aufruf: `node tools/start-pruefung-wacht.mjs [<wurzel>]` (in `check:logic`); prüft alle versionierten .mjs/.cjs/.js/.ts im Repo.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const MUSTER = /file:\/\/\/(?:\$\{\s*|['"`]\s*\+\s*)process\.argv\[1\]/

/** Pfade der Dateien (aus `texte`: Pfad → Inhalt), die das verbotene Muster enthalten. */
export function findeFehlstarts(texte) {
  return Object.keys(texte).filter((pfad) => MUSTER.test(texte[pfad]))
}

function main() {
  /* Wurzel per Argument: der Test startet den Wächter gegen ein Wegwerf-Repo. */
  const wurzel = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const liste = execFileSync('git', ['ls-files', '*.mjs', '*.cjs', '*.js', '*.ts', '*.tsx'], { cwd: wurzel, encoding: 'utf8' }).split('\n').filter(Boolean)
  const texte = Object.fromEntries(liste.map((p) => [p, readFileSync(path.join(wurzel, p), 'utf8')]))
  const falsch = findeFehlstarts(texte)
  console.log(`Startprüfung: ${liste.length} Dateien geprüft, ${falsch.length} mit selbstgebautem file:///-Vergleich.`)
  if (falsch.length) {
    console.error(`${falsch.join('\n')}\nStartprüfung nur als import.meta.url === pathToFileURL(process.argv[1]).href (unter Linux passt die selbstgebaute nie).`)
    return 1
  }
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
