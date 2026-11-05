// ladePruefTitel folgt derselben Schaltung wie die Listen: =0 schlägt die Regeldatei, =1 die fehlende Datei.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ladePruefTitel } from './lib/pruef-titel.ts'

function wurzel(regeln: object | null): string {
  const w = mkdtempSync(join(tmpdir(), 'pruef-titel-'))
  mkdirSync(join(w, 'public/data'), { recursive: true })
  mkdirSync(join(w, 'data'), { recursive: true })
  writeFileSync(join(w, 'public/data/titles.json'), JSON.stringify([{ id: 1 }]))
  writeFileSync(join(w, 'public/data/cartoons.json'), JSON.stringify([{ id: -1 }]))
  if (regeln) writeFileSync(join(w, 'data/pruefliste-regeln.json'), JSON.stringify(regeln))
  return w
}
function ids(w: string, env: string | undefined): number[] {
  const alt = process.env.PRUEFLISTE_ERWEITERT
  if (env === undefined) delete process.env.PRUEFLISTE_ERWEITERT
  else process.env.PRUEFLISTE_ERWEITERT = env
  try {
    return ladePruefTitel<{ id: number }>(w).map((t) => t.id)
  } finally {
    if (alt === undefined) delete process.env.PRUEFLISTE_ERWEITERT
    else process.env.PRUEFLISTE_ERWEITERT = alt
  }
}
const mit = wurzel({ erweitert: true })
const ohne = wurzel(null)
assert.deepEqual(ids(mit, '0'), [1], '=0 mit Regeldatei erweitert: ohne Cartoons')
assert.deepEqual(ids(ohne, '1'), [1, -1], '=1 ohne Regeldatei: mit Cartoons')
assert.deepEqual(ids(mit, undefined), [1, -1], 'unbelegt: Regeldatei entscheidet (an)')
assert.deepEqual(ids(ohne, undefined), [1], 'unbelegt ohne Regeldatei: ohne Cartoons')
rmSync(mit, { recursive: true })
rmSync(ohne, { recursive: true })
console.log('✓ pruef-titel-schaltung: 4 Fälle')
