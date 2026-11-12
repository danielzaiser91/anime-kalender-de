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

const wurzel = mkdtempSync(join(tmpdir(), 'pr-stufe-pruefdatei-'))
const schreibe = (pfad, text) => {
  const voll = join(wurzel, pfad)
  mkdirSync(join(voll, '..'), { recursive: true })
  writeFileSync(voll, text)
}
for (const n of ['allein', 'vonlib', 'vonshared', 'vonweb', 'vonworker', 'vonbau', 'vonkette', 'hinterkette', 'vontools', 'vondyn', 'nurtest', 'nurname']) {
  schreibe(`pipeline/check-${n}.ts`, `export const x = '${n}'\n`)
}
schreibe('pipeline/lib/a.ts', "import { x } from '../check-vonlib'\n")
schreibe('shared/b.ts', "import { x } from '../pipeline/check-vonshared.ts'\n")
schreibe('web/src/c.tsx', "import { x } from '../../pipeline/check-vonweb'\n")
schreibe('worker/src/d.ts', "const { x } = require('../../pipeline/check-vonworker.js')\n")
schreibe('pipeline/bau/e.ts', "import '../check-vonbau'\n")
schreibe('pipeline/lib/f.ts', "import { x } from '../check-vonkette'\n")
schreibe('pipeline/check-vonkette.ts', "import { x } from './check-hinterkette'\n")
schreibe('tools/g.mjs', "import { x } from '../pipeline/check-vontools.ts'\n")
schreibe('pipeline/lib/h.ts', "const m = await import('../check-vondyn')\n")
schreibe('pipeline/lib/i.ts', "// check-nurname wird nur erwähnt\nconst pfad = '../pipeline/check-nurname.ts'\n")
schreibe('pipeline/check-nurtest.test.ts', "import { x } from './check-nurtest'\n")
schreibe('tools/j.test.mjs', "import { x } from '../pipeline/check-allein.ts'\n")
schreibe('pipeline/check-andere.ts', "import { x } from './check-allein'\n")
const kette = leseKette(wurzel)
const stufe = (...pfade) => bestimmeStufe(pfade.map((pfad) => ({ pfad, hinzu: ['x'], weg: [] })), kette).stufe

try {
  pruefe('ohne Importeur → true', istPruefdatei('pipeline/check-allein.ts', kette), true)
  pruefe('nur Test und andere Prüfdatei importieren → true', istPruefdatei('pipeline/check-allein.ts', kette), true)
  pruefe('nur erwähnt (Kommentar, Pfadzeichenkette) → true', istPruefdatei('pipeline/check-nurname.ts', kette), true)
  pruefe('pipeline/lib importiert → false', istPruefdatei('pipeline/check-vonlib.ts', kette), false)
  pruefe('shared importiert → false', istPruefdatei('pipeline/check-vonshared.ts', kette), false)
  pruefe('web/src importiert → false', istPruefdatei('pipeline/check-vonweb.ts', kette), false)
  pruefe('worker importiert (require) → false', istPruefdatei('pipeline/check-vonworker.ts', kette), false)
  pruefe('pipeline/bau importiert (Nebenwirkungs-Import) → false', istPruefdatei('pipeline/check-vonbau.ts', kette), false)
  pruefe('tools importiert → false', istPruefdatei('pipeline/check-vontools.ts', kette), false)
  pruefe('dynamischer Import → false', istPruefdatei('pipeline/check-vondyn.ts', kette), false)
  pruefe('über Prüfdatei erreicht (Kette) → false', istPruefdatei('pipeline/check-hinterkette.ts', kette), false)
  pruefe('Testdatei ist keine Prüfdatei → false', istPruefdatei('pipeline/check-nurtest.test.ts', kette), false)
  pruefe('fremder Pfad → false', istPruefdatei('pipeline/lib/a.ts', kette), false)
  pruefe('ohne Kette → false', istPruefdatei('pipeline/check-allein.ts', null), false)

  pruefe('PR nur Prüfdatei → 1', stufe('pipeline/check-allein.ts'), 1)
  pruefe('PR Prüfdatei plus Test → 1', stufe('pipeline/check-allein.ts', 'tools/j.test.mjs'), 1)
  pruefe('PR Prüfdatei plus Test in pipeline → 1', stufe('pipeline/check-allein.ts', 'pipeline/check-nurtest.test.ts'), 1)
  pruefe('PR importierte Prüfdatei → 2', stufe('pipeline/check-vonlib.ts'), 2)
  pruefe('PR importierte Prüfdatei plus Test → 2', stufe('pipeline/check-vonlib.ts', 'tools/j.test.mjs'), 2)
  pruefe('PR Prüfdatei plus Quelle → 2', stufe('pipeline/check-allein.ts', 'pipeline/lib/a.ts'), 2)
  pruefe('PR Prüfdatei plus UI-Datei (Stufe 1) → 1', stufe('pipeline/check-allein.ts', 'web/src/c.tsx'), 1)
  pruefe('PR Prüfdatei plus Doku → 1', stufe('pipeline/check-allein.ts', 'docs/wissen/betrieb.md'), 1)
  pruefe('PR importierte Prüfdatei plus UI-Datei → 2', stufe('pipeline/check-vonlib.ts', 'web/src/c.tsx'), 2)
  pruefe('PR Prüfdatei plus Workflow → 2', stufe('pipeline/check-allein.ts', '.github/workflows/x.yml'), 2)
  pruefe('PR mehrere freie Prüfdateien → 1', stufe('pipeline/check-allein.ts', 'pipeline/check-nurname.ts'), 1)
  pruefe('Umbenennung Quelle → Prüfdatei → 2', bestimmeStufe([{ pfad: 'pipeline/check-allein.ts', quelle: 'pipeline/lib/a.ts', hinzu: [], weg: [] }], kette).stufe, 2)
  pruefe('Umbenennung Prüfdatei → Quelle → 2', bestimmeStufe([{ pfad: 'pipeline/lib/neu.ts', quelle: 'pipeline/check-allein.ts', hinzu: [], weg: [] }], kette).stufe, 2)
  pruefe('Prüfdatei über 300 Zeilen → 2', bestimmeStufe([{ pfad: 'pipeline/check-allein.ts', hinzu: Array(301).fill('x'), weg: [] }], kette).stufe, 2)
  pruefe('Prüfdatei mit Moduswechsel → 1', bestimmeStufe([{ pfad: 'pipeline/check-allein.ts', hinzu: [], weg: [], modus: true }], kette).stufe, 1)
  pruefe('Prüfdatei als Symlink → 2', bestimmeStufe([{ pfad: 'pipeline/check-allein.ts', hinzu: [], weg: [], symlink: true }], kette).stufe, 2)
  pruefe('ohne Kette bleibt Prüfdatei 2', bestimmeStufe([{ pfad: 'pipeline/check-allein.ts', hinzu: ['x'], weg: [] }]).stufe, 2)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`pr-stufe-pruefdatei: ${fehler.length} Fälle rot`)
  process.exit(1)
}
console.log('pr-stufe-pruefdatei: alle Fälle grün')
