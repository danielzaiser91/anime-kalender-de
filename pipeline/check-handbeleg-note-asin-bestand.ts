/**
 * Zusicherung: **Keine neue Notizseite eines Prime-Handbeleg-Blocks ist die Adresse eines Blocks eines anderen Titels**
 * (03.11.2026, Anlass Es war einmal … der Weltraum). Altfälle des Notizseiten-Wächters führt `ALTFAELLE`.
 * Bots schreiben `dub-confirmed.yaml` laufend, deshalb `check:bestand`; Fälle ohne Bestand: `check-handbeleg-note-asin.ts`.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { findeFremdeNoteAsins } from './lib/handbeleg-note-asin.ts'
import { leseAltfaelle } from './lib/handbeleg-notizseite-altfaelle.ts'
import type { BlockSeite } from './lib/handbeleg-notizseite.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'

const titel = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as { id: number }[]
const belege = (yaml.load(readFileSync('data/dub-confirmed.yaml', 'utf8')) as BlockSeite[] | null) ?? []
const ALTFAELLE_LISTE = leseAltfaelle()
const treffer = findeFremdeNoteAsins(belege).filter((t) => !ALTFAELLE_LISTE.includes(t))
const neuIds = new Set(treffer.map((t) => Number(t.split('@')[0])))
meldeVerletzte(titel, 'handbeleg-note-asin', 'Handbeleg mit der Notizseite eines anderen Titels', (t) => neuIds.has(t.id))

console.log('\nHandbeleg mit der Notizseite eines anderen Titels:')
if (treffer.length) console.error(`  ✖ Neue Treffer (Beleg entfernen oder Besitz klären): ${treffer.join(', ')}`)
else console.log('  ✓ Kein neuer Treffer')
console.log(`check-handbeleg-note-asin-bestand: ${treffer.length} Treffer (Ziel 0).`)
process.exit(treffer.length ? 1 : 0)
