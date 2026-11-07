import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { laufendeSammler } from './sammler-laeuft.mjs'

// Erwartete Liste fest im Test (kein Import als Orakel).
const NICHT_SAMMLER = [
  'PR-Prüfkette',
  'PR-Prüfer',
  'PR-Prüfer — Neustart bei Nachtrag',
  'Aussehen prüfen',
  'Mutationsprobe',
  'Deploy auf GitHub Pages',
  'Bestand — zusammenführen und bauen',
  'Claude — Daten-PR zusammenführen',
]
for (const n of NICHT_SAMMLER) assert.deepEqual(laufendeSammler([n]), [], n)

assert.deepEqual(laufendeSammler([]), [])
assert.deepEqual(laufendeSammler(['Prime-Kanal messen']), ['Prime-Kanal messen'])
assert.deepEqual(laufendeSammler(['PR-Prüfkette 2']), ['PR-Prüfkette 2'])
assert.deepEqual(laufendeSammler(['Deploy auf GitHub Pages (Vorschau)']), ['Deploy auf GitHub Pages (Vorschau)'])
assert.deepEqual(laufendeSammler(['Stündlich — Sendezeiten']), ['Stündlich — Sendezeiten'])
assert.deepEqual(laufendeSammler(['Täglich — alle Quellen', 'PR-Prüfkette', 'Täglich — alle Quellen', '']), ['Täglich — alle Quellen'])
assert.deepEqual(laufendeSammler(['b-Lauf', 'a-Lauf']), ['a-Lauf', 'b-Lauf'])

// Jede Ausnahme muss als `name:` eines echten Workflows existieren (Umbenennung -> rot).
const dir = new URL('../.github/workflows/', import.meta.url)
const namen = new Set()
for (const f of readdirSync(dir).filter((x) => x.endsWith('.yml'))) {
  const m = readFileSync(new URL(f, dir), 'utf8').match(/^name:\s*(.+?)\s*$/m)
  if (m) namen.add(m[1].replace(/^["']|["']$/g, ''))
}
for (const n of NICHT_SAMMLER) assert.ok(namen.has(n), `kein Workflow heißt mehr "${n}"`)

console.log(`sammler-laeuft: ${NICHT_SAMMLER.length} Ausnahmen gegen ${namen.size} echte Workflow-Namen, 15 Fälle grün`)
