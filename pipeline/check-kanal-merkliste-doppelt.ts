/**
 * Zusicherung: `ergaenzeMerkliste` schreibt jede Kanal-Seite einmal — ein zweiter Lauf mit denselben Belegen ändert nichts,
 * ein neuer Beleg kommt genau einmal dazu. Wegwerf-Wurzel unter `os.tmpdir()`, erfundene Kennungen ab 900000.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DubCheck } from './lib/dub-confirmed.ts'

/* Fangwurzel vor dem Import: Eine Mutante, die den Parameter `wurzel` ignoriert und nach `ROOT` schreibt, landet hier statt in `data/kanal-seiten.json` (der Test wird dann rot). */
const falle = mkdtempSync(join(tmpdir(), 'kanal-merkliste-falle-'))
mkdirSync(join(falle, 'data'))
process.env.AK_ROOT = falle
const { ergaenzeMerkliste, MERKLISTE } = await import('./lib/kanal-merkliste.ts')

const beleg = (anilistId: number, url: string): DubCheck =>
  ({ anilistId, platform: 'prime', url, checkedAt: '2026-01-01', note: 'ACHTUNG: Kanal-Titel', kanalOhneBeleg: true }) as unknown as DubCheck

const wurzel = mkdtempSync(join(tmpdir(), 'kanal-merkliste-doppelt-'))
mkdirSync(join(wurzel, 'data'))
let verletzt = 0
const pruefe = (name: string, ist: unknown, soll: unknown): void => {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}: erwartet ${JSON.stringify(soll)}, gefunden ${JSON.stringify(ist)}`)
}
const zeilen = (): number[] => (JSON.parse(readFileSync(join(wurzel, MERKLISTE), 'utf8')) as DubCheck[]).map((e) => e.anilistId)

try {
  const a = beleg(900_002, 'https://www.amazon.de/dp/B0TEST0002')
  const b = beleg(900_001, 'https://www.amazon.de/dp/B0TEST0001')
  pruefe('erster Lauf: ein Beleg neu', ergaenzeMerkliste([a], wurzel), 1)
  pruefe('zweiter Lauf, derselbe Beleg: nichts neu', ergaenzeMerkliste([a], wurzel), 0)
  pruefe('Datei nach dem zweiten Lauf: eine Zeile', zeilen(), [900_002])
  pruefe('dritter Lauf, dazu ein neuer Beleg und der alte: einer neu', ergaenzeMerkliste([a, b], wurzel), 1)
  pruefe('Datei sortiert, jede Seite einmal', zeilen(), [900_001, 900_002])
} finally {
  rmSync(wurzel, { recursive: true, force: true })
  rmSync(falle, { recursive: true, force: true })
}
if (verletzt) process.exit(1)
console.log('\ncheck-kanal-merkliste-doppelt: 5 Fälle grün')
