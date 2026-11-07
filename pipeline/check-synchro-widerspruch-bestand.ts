/**
 * Bestandswache: Kein Titel mit Synchro-Beleg steht hinter dem Toggle „ohne deutsche Synchro“ (Devils' Crest, 06./07.11.2026: aniSearch
 * führte „synchronisiert“, der Titel blieb live ohne Synchro). Belege: aniSearch-Marke `d`/`c` oder Handbeleg `dub: true`.
 * Liest den frisch gebauten `public/data`-Stand (Probebau), nicht den von main. Rot meldet die Titel (Quarantäne).
 * Test: `check-synchro-widerspruch.ts`.
 *
 * Aufruf: npx tsx pipeline/check-synchro-widerspruch-bestand.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import { ROOT } from './lib/util.ts'
import { dubIdsNachAnisearch, dubsNachTitel } from './lib/anisearch-marke.ts'
import { handJaSchluessel, ladeHandbelege } from './lib/dub-confirmed.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import { widerspruechlich, widerspruchText } from './lib/synchro-widerspruch.ts'

const hinten = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'ohne-synchro.json'), 'utf8')) as Title[]
const handJa = new Set([...handJaSchluessel(ladeHandbelege())].map((s) => Number(s.split('|')[0])))
const treffer = widerspruechlich(hinten, { nachAnisearch: dubIdsNachAnisearch(), nachTitel: dubsNachTitel(), handJa })
const ids = new Set(treffer.map((x) => x.titel.id))
meldeVerletzte(hinten, 'synchro-widerspruch-bestand', 'Synchro-Beleg, steht aber ohne Synchro', (t) => ids.has(t.id))
for (const { titel, grund } of treffer) console.error(`FEHLER: ${widerspruchText(titel, grund)}`)
if (treffer.length) {
  console.log(`VERSTÖSSE: ${treffer.length}`)
  process.exit(1)
}
console.log(`  ✓ Synchro-Widerspruch: keiner der ${hinten.length} Titel ohne Synchro trägt einen Synchro-Beleg`)
console.log('VERSTÖSSE: 0')
