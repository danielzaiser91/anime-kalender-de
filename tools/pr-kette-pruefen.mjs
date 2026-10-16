/**
 * Wächter für `.github/workflows/pr-pruefung.yml`: Die Teiljobs der PR-Prüfkette müssen zusammen genau `check:vor-commit` abdecken,
 * und der Sammeljob `PR-Prüfkette` darf keinen Teiljob verlieren (16.10.2026, Aufteilung in parallele Jobs).
 * Regeln:
 *  - jede `npm run X` aus `check:vor-commit` steht in genau einem Teiljob (ruft ein Job `check:vor-commit` selbst auf, zählt jeder Eintrag);
 *  - der Sammeljob (Name `PR-Prüfkette`) führt jeden anderen Job außer `PR-Aussehen` in `needs`;
 *  - sein `if` beginnt mit `always()` (sonst überspringt ein roter Teiljob ihn, und übersprungen zählt als bestanden) und
 *    seine Schritte prüfen jedes Ergebnis auf `success`.
 * Aufruf: node tools/pr-kette-pruefen.mjs  (Exit 1 bei Verstoß; läuft über tools/pr-kette-pruefen.test.mjs in check:workflows)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const WURZEL = resolve(import.meta.dirname, '..')
const SAMMEL = 'PR-Prüfkette'
const NICHT_VERPFLICHTEND = 'PR-Aussehen'

/** Alle `npm run X`-Namen in einem Text, in Reihenfolge. */
function npmNamen(text) {
  return [...String(text ?? '').matchAll(/npm run ([\w:.-]+)/g)].map((m) => m[1])
}

/** Zählt je Prüfung, in wie vielen Vorkommen sie über alle Teiljobs läuft. */
function zaehleVorkommen(teiljobs, vorCommit) {
  const zaehler = new Map(vorCommit.map((n) => [n, 0]))
  for (const job of teiljobs) {
    for (const schritt of job.steps ?? []) {
      for (const name of npmNamen(schritt.run)) {
        const liste = name === 'check:vor-commit' ? vorCommit : [name]
        for (const n of liste) if (zaehler.has(n)) zaehler.set(n, zaehler.get(n) + 1)
      }
    }
  }
  return zaehler
}

/** Verstöße des Sammeljobs: `needs`, `always()`, Ergebnisprüfung. */
function pruefeSammler(jobs, sammlerId) {
  const fehler = []
  const sammler = jobs[sammlerId]
  const erwartet = Object.entries(jobs)
    .filter(([id, j]) => id !== sammlerId && j.name !== NICHT_VERPFLICHTEND)
    .map(([id]) => id)
  const needs = [sammler.needs ?? []].flat()
  for (const id of erwartet) if (!needs.includes(id)) fehler.push(`Sammeljob: Teiljob "${id}" fehlt in needs`)
  for (const id of needs) if (!jobs[id]) fehler.push(`Sammeljob: needs nennt unbekannten Job "${id}"`)
  if (!/^\$\{\{\s*always\(\)/.test(String(sammler.if ?? ''))) {
    fehler.push('Sammeljob: if beginnt nicht mit always() — ein roter Teiljob ließe ihn überspringen (= bestanden)')
  }
  const text = (sammler.steps ?? []).map((s) => `${s.run ?? ''} ${JSON.stringify(s.env ?? {})}`).join('\n')
  if (!/toJSON\(needs\)/.test(text) || !/\.result == "success"/.test(text)) {
    fehler.push('Sammeljob: prüft die Ergebnisse der Teiljobs nicht auf success')
  }
  return fehler
}

/** Gesamtprüfung: Liste der Verstöße (leer = in Ordnung). */
export function pruefeKette(doc, scripts) {
  const vorCommit = npmNamen(scripts['check:vor-commit'])
  const jobs = doc.jobs ?? {}
  const sammlerId = Object.keys(jobs).find((id) => jobs[id].name === SAMMEL)
  if (!sammlerId) return [`Kein Job mit dem Namen "${SAMMEL}" (Pflicht-Check im Ruleset)`]
  const teiljobs = Object.entries(jobs)
    .filter(([id, j]) => id !== sammlerId && j.name !== NICHT_VERPFLICHTEND)
    .map(([, j]) => j)
  const fehler = pruefeSammler(jobs, sammlerId)
  for (const [name, anzahl] of zaehleVorkommen(teiljobs, vorCommit)) {
    if (anzahl !== 1) fehler.push(`Prüfung "${name}" läuft ${anzahl}-mal in den Teiljobs (verlangt: genau einmal)`)
  }
  return fehler
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const doc = parse(readFileSync(resolve(WURZEL, '.github/workflows/pr-pruefung.yml'), 'utf8'))
  const { scripts } = JSON.parse(readFileSync(resolve(WURZEL, 'package.json'), 'utf8'))
  const fehler = pruefeKette(doc, scripts)
  for (const f of fehler) console.error(`✗ ${f}`)
  if (fehler.length > 0) process.exit(1)
  console.log(`pr-kette-pruefen: ${npmNamen(scripts['check:vor-commit']).length} Prüfungen, jede in genau einem Teiljob; Sammeljob vollständig.`)
}
