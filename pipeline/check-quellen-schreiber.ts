/**
 * Wächter: Jede Quelle mit Frist in `FRISTEN` (check-sources.ts) hat einen Schreiber
 * (`recordSource('<name>', …)`) im Code. Eine eingestellte Quelle bleibt sonst ewig „stumm“
 * (fsk, 20.10.2026: Abruf seit 08.10. weg, Frist blieb stehen).
 * Aufruf: npx tsx pipeline/check-quellen-schreiber.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fristNamen, ohneSchreiber, schreiberNamen } from './lib/quellen-schreiber.ts'
import { ROOT } from './lib/util.ts'

const ORDNER = ['pipeline', 'tools', 'shared', 'worker/src']

function quelldateien(ordner: string): string[] {
  const treffer: string[] = []
  for (const e of readdirSync(join(ROOT, ordner), { withFileTypes: true })) {
    const pfad = `${ordner}/${e.name}`
    if (e.isDirectory()) treffer.push(...quelldateien(pfad))
    else if (/\.(ts|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) treffer.push(pfad)
  }
  return treffer
}

function main(): number {
  const fristen = fristNamen(readFileSync(join(ROOT, 'pipeline/check-sources.ts'), 'utf8'))
  const schreiber = ORDNER.flatMap(quelldateien).flatMap((d) => schreiberNamen(readFileSync(join(ROOT, d), 'utf8')))
  const fehlt = ohneSchreiber(fristen, schreiber)
  const unklar = schreiber.filter((n) => n === '?').length
  console.log(`check-quellen-schreiber: ${fristen.length} Fristen, ${schreiber.length} Schreiber (${unklar} mit unlesbarem Namen), ${fehlt.length} ohne Schreiber${fehlt.length ? `: ${fehlt.join(', ')}` : ''}`)
  if (fehlt.length) console.error('Frist ohne Schreiber: Quelle eingestellt? Dann aus FRISTEN austragen.')
  if (unklar) console.error('recordSource mit Name als Variable: Name als Zeichenkette schreiben, sonst prüft der Wächter blind.')
  return fehlt.length || unklar ? 1 : 0
}

process.exit(main())
