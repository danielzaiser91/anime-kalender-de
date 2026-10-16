/**
 * Bestandsteil der Lückenlisten: `ladeKontext` reicht `data/tmdb-staffel0.json` als `staffel0` durch.
 * Liest `public/data` (über `ladeKontext`) und gehört deshalb in `check:bestand`, nicht in `check:logic`.
 */
import { ladeKontext } from './lib/luecken-kontext.ts'
import { readJson } from './lib/util.ts'

const datei = readJson<Record<string, unknown>>('data/tmdb-staffel0.json', {})
const geladen = ladeKontext(new Date().toISOString().slice(0, 10)).staffel0
if (!Object.keys(datei).length) {
  console.error('  ✖ data/tmdb-staffel0.json ist leer')
  process.exit(1)
}
if (JSON.stringify(Object.keys(geladen)) !== JSON.stringify(Object.keys(datei))) {
  console.error('  ✖ ladeKontext().staffel0 weicht von data/tmdb-staffel0.json ab')
  process.exit(1)
}
console.log(`  ✓ ladeKontext reicht ${Object.keys(datei).length} Staffel-0-Zuordnungen durch`)
