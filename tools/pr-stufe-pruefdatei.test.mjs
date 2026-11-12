/** Tests für tools/pr-stufe-pruefdatei.mjs und die Prüfdatei-Regel von tools/pr-stufe.mjs, gegen ein Wegwerf-Repo unter os.tmpdir(). */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bestimmeStufe } from './pr-stufe.mjs'
import { leseKette } from './pr-stufe-kette.mjs'
import { istPruefdatei } from './pr-stufe-pruefdatei.mjs'

const fehler = []
const pruefe = (name, ist, soll) => {
  if (ist === soll) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — ${ist}`)
}

const baue = (zusatz = {}) => {
  const wurzel = mkdtempSync(join(tmpdir(), 'pr-stufe-pruefdatei-'))
  const schreibe = (pfad, text) => {
    mkdirSync(join(wurzel, pfad, '..'), { recursive: true })
    writeFileSync(join(wurzel, pfad), text)
  }
  for (const n of ['allein', 'liste', 'npm', 'wf', 'vonlib', 'vonweb', 'vonbau', 'vontools', 'spawn', 'schreibt', 'andere']) {
    schreibe(`pipeline/check-${n}.ts`, `export const x = '${n}'\n`)
  }
  schreibe('pipeline/check-schreibt.ts', "import { writeFileSync } from 'node:fs'\n")
  schreibe('pipeline/check-allein.test.ts', "import './check-allein'\n")
  schreibe('tools/check-logic-liste.txt', 'pipeline/check-liste.ts\n')
  schreibe('package.json', '{"scripts":{"c":"tsx pipeline/check-npm.ts"}}')
  schreibe('.github/workflows/k.yml', 'run: npx tsx pipeline/check-wf.ts\n')
  schreibe('pipeline/lib/a.ts', "import { x } from '../check-vonlib'\n")
  schreibe('web/src/c.tsx', "import { x } from '../../pipeline/check-vonweb'\n")
  schreibe('pipeline/bau/e.ts', "import '../check-vonbau'\n")
  schreibe('tools/g.mjs', "import { x } from '../pipeline/check-vontools.ts'\n")
  schreibe('tools/h.mjs', "spawnSync('npx', ['tsx', 'pipeline/check-spawn.ts'])\n")
  schreibe('pipeline/check-andere.ts', "import { x } from './check-vonlib'\n")
  for (const [pfad, text] of Object.entries(zusatz)) schreibe(pfad, text)
  return { wurzel, kette: leseKette(wurzel) }
}
const stufeVon = (kette, ...pfade) => bestimmeStufe(pfade.map((pfad) => ({ pfad, hinzu: ['x'], weg: [] })), kette).stufe

const { wurzel, kette } = baue()
try {
  const p = (n) => istPruefdatei(`pipeline/check-${n}.ts`, kette)
  pruefe('nirgends genannt, schreibt nicht → true', p('allein'), true)
  pruefe('Name in Prüfliste (check-logic-liste.txt) → false', p('liste'), false)
  pruefe('Name in package.json → false', p('npm'), false)
  pruefe('Name im Workflow (npx tsx) → false', p('wf'), false)
  pruefe('pipeline/lib importiert → false', p('vonlib'), false)
  pruefe('web/src importiert → false', p('vonweb'), false)
  pruefe('pipeline/bau importiert (Nebenwirkungs-Import) → false', p('vonbau'), false)
  pruefe('tools importiert → false', p('vontools'), false)
  pruefe('spawnSync nennt den Pfad → false', p('spawn'), false)
  pruefe('schreibt Dateien (writeFileSync) → false', p('schreibt'), false)
  pruefe('Testdatei ist keine Prüfdatei', istPruefdatei('pipeline/check-allein.test.ts', kette), false)
  pruefe('fremder Pfad', istPruefdatei('pipeline/lib/a.ts', kette), false)
  pruefe('ohne Kette', istPruefdatei('pipeline/check-allein.ts', null), false)
  pruefe('Datei nicht in der Kette (z. B. gelöscht) → false', istPruefdatei('pipeline/check-fehlt.ts', kette), false)

  pruefe('PR nur freie Prüfdatei → 1', stufeVon(kette, 'pipeline/check-allein.ts'), 1)
  pruefe('PR freie Prüfdatei plus Test → 1', stufeVon(kette, 'pipeline/check-allein.ts', 'pipeline/check-allein.test.ts'), 1)
  pruefe('PR freie Prüfdatei plus UI-Datei (Stufe 1) → 1', stufeVon(kette, 'pipeline/check-allein.ts', 'web/src/c.tsx'), 1)
  pruefe('PR Name in package.json → 2', stufeVon(kette, 'pipeline/check-npm.ts'), 2)
  pruefe('PR Name im Workflow → 2', stufeVon(kette, 'pipeline/check-wf.ts'), 2)
  pruefe('PR Name in Prüfliste → 2', stufeVon(kette, 'pipeline/check-liste.ts'), 2)
  pruefe('PR schreibende Prüfdatei → 2', stufeVon(kette, 'pipeline/check-schreibt.ts'), 2)
  pruefe('PR importierte Prüfdatei plus Test → 2', stufeVon(kette, 'pipeline/check-vonlib.ts', 'pipeline/check-allein.test.ts'), 2)
  pruefe('PR freie Prüfdatei plus Quelle → 2', stufeVon(kette, 'pipeline/check-allein.ts', 'pipeline/lib/a.ts'), 2)
  pruefe('PR freie Prüfdatei plus Workflow → 2', stufeVon(kette, 'pipeline/check-allein.ts', '.github/workflows/x.yml'), 2)
  pruefe('Umbenennung Quelle → Prüfdatei → 2', bestimmeStufe([{ pfad: 'pipeline/check-allein.ts', quelle: 'pipeline/lib/a.ts', hinzu: [], weg: [] }], kette).stufe, 2)
  pruefe('Prüfdatei über 300 Zeilen → 2', bestimmeStufe([{ pfad: 'pipeline/check-allein.ts', hinzu: Array(301).fill('x'), weg: [] }], kette).stufe, 2)
  pruefe('Prüfdatei als Symlink → 2', bestimmeStufe([{ pfad: 'pipeline/check-allein.ts', hinzu: [], weg: [], symlink: true }], kette).stufe, 2)
  pruefe('ohne Kette bleibt Prüfdatei 2', bestimmeStufe([{ pfad: 'pipeline/check-allein.ts', hinzu: ['x'], weg: [] }]).stufe, 2)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

// Dynamische Namen: jede Form macht alle Prüfdateien zu Stufe 2.
for (const [name, text] of [
  ['Template-Import', 'const m = await import(`../check-${n}`)\n'],
  ['Glob in Skript', "const f = glob('pipeline/check-*.ts')\n"],
  ['Verkettung', "const f = 'pipeline/check-' + n\n"],
]) {
  const b = baue({ 'tools/dyn.mjs': text })
  pruefe(`${name} → alle Prüfdateien 2`, istPruefdatei('pipeline/check-allein.ts', b.kette), false)
  rmSync(b.wurzel, { recursive: true, force: true })
}
const b2 = baue({ 'pipeline/check-andere.ts': "const f = 'pipeline/check-' + n\n" })
pruefe('Verkettung nur in einer Prüfdatei zählt nicht → true', istPruefdatei('pipeline/check-allein.ts', b2.kette), true)
rmSync(b2.wurzel, { recursive: true, force: true })

if (fehler.length) {
  console.error(`pr-stufe-pruefdatei: ${fehler.length} Fälle rot`)
  process.exit(1)
}
console.log('pr-stufe-pruefdatei: alle Fälle grün')
