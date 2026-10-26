/**
 * Bestandswächter: Keine Angabe aus der Pflege (Daniel) in einem Textfeld von `public/data` (Namensfelder ausgenommen, `lib/interne-angaben.ts`).
 * Läuft in `check:bestand`; der Anlass (Notiz „laut Daniels Sichtung“ im Panel, 26.10.2026) steht in `docs/wissen/datensatz.md`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { interneAngaben } from './lib/interne-angaben.ts'

const WURZEL = 'public/data'

function jsonDateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsonDateien(join(ordner, e.name)) : e.name.endsWith('.json') ? [join(ordner, e.name)] : [],
  )
}

const dateien = jsonDateien(WURZEL)
const treffer = dateien.flatMap((d) => interneAngaben(relative(WURZEL, d).replaceAll('\\', '/'), JSON.parse(readFileSync(d, 'utf8'))))
if (!dateien.length) {
  console.error(`✖ ${WURZEL} enthält keine JSON-Datei — erst bauen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
for (const t of treffer.slice(0, 20)) console.error(`✖ ${t}`)
console.log(`  ${treffer.length === 0 ? '✓' : '✖'} ${dateien.length} Dateien, ${treffer.length} Angaben aus der Pflege außerhalb der Namensfelder`)
console.log(`VERSTÖSSE: ${treffer.length}`)
if (treffer.length) process.exit(1)
