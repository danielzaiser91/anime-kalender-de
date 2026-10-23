/** Einheitenfälle für `lib/woche-groesse.ts` (Kulissen-Dateien mit Zufallsbytes, damit die gzip-Größe feststeht). */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { bewerteWocheGroesse, WOCHE_GRENZE } from './lib/woche-groesse.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'woche-groesse-'))
const datei = (name: string, bytes: Buffer): string => {
  const pfad = join(wurzel, name)
  writeFileSync(pfad, bytes)
  return pfad
}
try {
  const roh = randomBytes(5000)
  const gz = gzipSync(roh, { level: 9 }).length
  const p = datei('a.json', roh)
  assert.equal(bewerteWocheGroesse(p, gz).code, 0, 'genau an der Grenze ist in Ordnung')
  assert.equal(bewerteWocheGroesse(p, gz - 1).code, 1, 'ein Byte drüber ist rot')
  assert.match(bewerteWocheGroesse(p, gz - 1).text, /über der Grenze/)
  assert.equal(bewerteWocheGroesse(p, gz + 1000).code, 0)
  assert.equal(bewerteWocheGroesse(join(wurzel, 'fehlt.json')).code, 1, 'fehlende Datei ist rot')
  assert.equal(bewerteWocheGroesse(datei('leer.json', Buffer.alloc(0))).code, 0, 'leere Datei liegt unter der Grenze')
  assert.equal(bewerteWocheGroesse(datei('gross.json', randomBytes(WOCHE_GRENZE + 2000))).code, 1, 'Vorgabegrenze 38 KB greift')
  assert.equal(WOCHE_GRENZE, 38 * 1024)
  console.log('check-woche-groesse: ok (6 Fälle: Grenze, ein Byte drüber, Luft, fehlt, leer, Vorgabegrenze)')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
