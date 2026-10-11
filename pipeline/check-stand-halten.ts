/**
 * Zusicherung: Eine Bau-Datei mit Zeitstempel ändert sich nicht, wenn nur die Zeit vergeht (11.10.2026).
 * `data/termine-ausgelassen.json` trug `erzeugtAm: new Date()` und wurde bei jedem Bestandsbau neu geschrieben.
 * Läuft in `check:logic`.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mitAltemStand, writeJsonStand, writeTextStand } from './lib/stand-halten.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`)
}

const ordner = mkdtempSync(join(tmpdir(), 'stand-halten-'))
try {
  const json = join(ordner, 'a.json')
  const ALT = '2026-10-11T10:00:00.000Z'
  const inhalt = (n: number) => ({ erzeugtAm: new Date().toISOString(), jeGrund: { x: n }, faelle: [n] })
  writeJsonStand(json, { ...inhalt(1), erzeugtAm: ALT }, 'erzeugtAm')
  const erster = readFileSync(json, 'utf8')
  writeJsonStand(json, inhalt(1), 'erzeugtAm')
  pruefe('JSON: gleicher Inhalt, spätere Zeit → Datei bleibt byte-gleich', readFileSync(json, 'utf8') === erster)
  writeJsonStand(json, inhalt(2), 'erzeugtAm')
  pruefe('JSON: anderer Inhalt → Zeitstempel erneuert', JSON.parse(readFileSync(json, 'utf8')).erzeugtAm !== ALT)
  pruefe('JSON: ohne alte Datei gilt der neue Stand', mitAltemStand(null, { stand: 'N', a: 1 }, 'stand').stand === 'N')

  const md = join(ordner, 'b.md')
  const text = (n: number) => (stand: string) => `# Liste\n\n_Stand ${stand} · ${n} offen_\n`
  const standRegel = /^_Stand (\d{4}-\d\d-\d\d)/m
  writeTextStand(md, text(3), '2026-10-11', standRegel)
  const ersterText = readFileSync(md, 'utf8')
  writeTextStand(md, text(3), '2026-10-12', standRegel)
  pruefe('Text: gleicher Inhalt, anderer Tag → Datei bleibt byte-gleich', readFileSync(md, 'utf8') === ersterText)
  writeTextStand(md, text(4), '2026-10-12', standRegel)
  pruefe('Text: anderer Inhalt → neues Datum', readFileSync(md, 'utf8').includes('_Stand 2026-10-12 · 4 offen_'))
} finally {
  rmSync(ordner, { recursive: true, force: true })
}

if (fehler > 0) process.exit(1)
console.log('check-stand-halten: ok')
