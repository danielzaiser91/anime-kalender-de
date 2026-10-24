/**
 * `check:logic` läuft in CI alle Prüfungen durch (17.10.2026): Ohne das blieben die Prüfungen hinter der ersten roten in fremden PRs ungeprüft.
 * Eine Wegwerf-Liste mit einer roten Prüfung vorn und mehr grünen, als der Pool gleichzeitig startet; die letzte legt eine Marke ab.
 * Fehlt die Marke bei `CI=true`, ist der Schalter weg; ist sie ohne CI da, bricht der Lauf nicht mehr beim ersten Fehler ab.
 * Aufruf: node tools/check-logic-ci-alle.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { POOLGROESSE } from './arbeiterpool.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const ordner = mkdtempSync(join(tmpdir(), 'ci-alle-'))
const marke = join(ordner, 'letzte-lief.txt').replace(/\\/g, '/')
const posix = (p) => p.replace(/\\/g, '/')

/** Rot vorn, dann mehr Prüfungen, als der Pool gleichzeitig startet; die alphabetisch letzte legt die Marke ab. */
function schreibeListe() {
  const namen = ['a-rot']
  for (let i = 0; i < POOLGROESSE + 1; i++) namen.push(`b-gruen-${String(i).padStart(2, '0')}`)
  namen.push('z-marke')
  const pfade = namen.map((n) => posix(join(ordner, `${n}.mjs`)))
  writeFileSync(pfade[0], 'console.error("absichtlich rot")\nprocess.exit(3)\n')
  for (const p of pfade.slice(1, -1)) writeFileSync(p, 'await new Promise((r) => setTimeout(r, 400))\n')
  writeFileSync(pfade.at(-1), `import { writeFileSync } from 'node:fs'\nwriteFileSync('${marke}', 'ja')\n`)
  const liste = join(ordner, 'liste.txt')
  writeFileSync(liste, `${pfade.join('\n')}\n`)
  return { liste, rot: pfade[0] }
}

function lauf(liste, ci) {
  rmSync(marke, { force: true })
  const env = { ...process.env }
  delete env.CI
  if (ci !== undefined) env.CI = ci
  const r = spawnSync(process.execPath, [join(WURZEL, 'tools/check-logic-alle.mjs'), liste, 'wegwerf'], { cwd: WURZEL, encoding: 'utf8', env })
  return { status: r.status, text: `${r.stdout}\n${r.stderr}`, letzteLief: existsSync(marke) }
}

try {
  const { liste, rot } = schreibeListe()

  const ci = lauf(liste, 'true')
  assert.equal(ci.status, 1, 'mit CI=true ist der Lauf rot')
  assert.ok(ci.letzteLief, 'mit CI=true laufen auch die Prüfungen hinter der roten')
  assert.ok(ci.text.includes(`- ${rot}`), `mit CI=true steht die rote Prüfung in der Liste am Ende: ${ci.text.slice(-400)}`)

  const ab = ci.text.indexOf('--- ')
  const auszug = (text, pfad) => text.includes(`--- ${pfad} (Exit 3), letzte Zeilen:
    absichtlich rot
`)
  assert.ok(ab > ci.text.indexOf(`- ${rot}`), 'der Auszug steht hinter der Liste der roten')
  assert.ok(auszug(ci.text.slice(ab), rot), 'der Auszug nennt Namen, Exit-Code und die Fehlerzeile')

  const lokal = lauf(liste, undefined)
  assert.ok(auszug(lokal.text, rot), 'ohne CI steht der Auszug ebenfalls da')
  assert.equal(lokal.status, 3, 'ohne CI ist der Lauf rot und übernimmt den Exit-Code der roten Prüfung')
  assert.ok(!lokal.letzteLief, 'ohne CI startet nach dem ersten Fehler keine weitere Prüfung')

  rmSync(marke, { force: true })
  const mitSchalter = spawnSync(process.execPath, [join(WURZEL, 'tools/check-logic-alle.mjs'), liste, 'wegwerf', '--alle'], { cwd: WURZEL, encoding: 'utf8' })
  assert.equal(mitSchalter.status, 1, 'mit --alle ist der Lauf rot')
  assert.ok(existsSync(marke), '--alle läuft ebenfalls durch')

  const nichtWahr = lauf(liste, 'false')
  assert.ok(!nichtWahr.letzteLief, 'CI=false schaltet nichts um')
  console.log('check-logic-ci-alle: alle Zusicherungen gehalten.')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
