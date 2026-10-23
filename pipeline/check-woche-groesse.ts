/** Einheitenfälle für `lib/woche-groesse.ts` (Kulissen-Dateien mit Zufallsbytes, damit die gzip-Größe feststeht). */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
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
  const skript = fileURLToPath(new URL('./check-woche-groesse-bestand.ts', import.meta.url))
  const lauf = (pfad: string) => spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), skript, pfad], { encoding: 'utf8', windowsHide: true })
  const zuGross = lauf(datei('gross.json', randomBytes(WOCHE_GRENZE + 2000)))
  assert.equal(zuGross.status, 1, 'Prozess meldet Exit 1 bei zu großer Datei')
  assert.match(zuGross.stderr, /über der Grenze/)
  const klein = lauf(datei('klein.json', randomBytes(1000)))
  assert.equal(klein.status, 0, 'Prozess meldet Exit 0 bei kleiner Datei')
  assert.match(klein.stdout, /^check-woche-groesse-bestand: ok – woche\.json/m)
  assert.equal(lauf(join(wurzel, 'fehlt.json')).status, 1, 'Prozess: fehlende Datei ist rot')
  console.log('check-woche-groesse: ok (9 Fälle: Grenze, ein Byte drüber, Luft, fehlt, leer, Vorgabegrenze, Prozess zu groß/klein/fehlt)')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
