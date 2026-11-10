/**
 * Zusicherung: **Kein Titel führt zwei Prime-Wege mit derselben gti** (09.11.2026, Anlass Goblin Slayer 2: zwei Adressen derselben
 * Ausgabe, der Termin verlor seine Adresse). Der Bau führt sie zusammen (`fuehrePrimeGleicheGtiZusammen`); was hier noch steht, ist
 * ein Widerspruch der Urteile (Ja gegen Nein) und braucht eine Hand. Auf main waren es 18 Fälle, jetzt 0.
 */
import { readFileSync } from 'node:fs'
import { findeGleicheGti, type GtiBelegt } from './lib/prime-gleiche-gti.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import type { StreamLink } from '../shared/types.ts'

const titel = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as { id: number; streams?: StreamLink[] }[]
const belegt = JSON.parse(readFileSync('data/amazon-gti-belegt.json', 'utf8')) as GtiBelegt
const treffer = findeGleicheGti(titel, belegt)
const ids = new Set(treffer.map((t) => Number(t.split('@')[0])))
meldeVerletzte(titel, 'prime-gleiche-gti', 'Zwei Prime-Wege mit derselben gti', (t) => ids.has(t.id))

console.log('\nPrime-Wege mit derselben gti am selben Titel:')
if (treffer.length) console.error(`  ✖ Treffer (Urteile widersprechen sich, von Hand klären): ${treffer.join(', ')}`)
else console.log('  ✓ Kein Treffer')
console.log(`check-prime-gleiche-gti-bestand: ${treffer.length} Treffer (Ziel 0).`)
process.exit(treffer.length ? 1 : 0)
