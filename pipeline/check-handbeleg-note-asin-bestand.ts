/**
 * Zusicherung: **Keine neue Notizseite eines Prime-Handbeleg-Blocks ist die Adresse eines Blocks eines anderen Titels**
 * (03.11.2026, Anlass Es war einmal … der Weltraum). Altfälle stehen als Ratsche in `NOTE_ASIN_ALTFAELLE` (Ziel 0).
 * Bots schreiben `dub-confirmed.yaml` laufend, deshalb `check:bestand`; Fälle ohne Bestand: `check-handbeleg-note-asin.ts`.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { findeFremdeNoteAsins, NOTE_ASIN_ALTFAELLE } from './lib/handbeleg-note-asin.ts'
import { ALTFAELLE } from './lib/handbeleg-notizseite-altfaelle.ts'
import type { BlockSeite } from './lib/handbeleg-notizseite.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'

const titel = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as { id: number }[]
const belege = (yaml.load(readFileSync('data/dub-confirmed.yaml', 'utf8')) as BlockSeite[] | null) ?? []
const treffer = findeFremdeNoteAsins(belege).filter((t) => !ALTFAELLE.includes(t))
const neu = treffer.filter((t) => !NOTE_ASIN_ALTFAELLE.includes(t))
const neuIds = new Set(neu.map((t) => Number(t.split('@')[0])))
meldeVerletzte(titel, 'handbeleg-note-asin', 'Handbeleg mit der Notizseite eines anderen Titels', (t) => neuIds.has(t.id))
const erledigt = NOTE_ASIN_ALTFAELLE.filter((a) => !treffer.includes(a))

console.log('\nHandbeleg mit der Notizseite eines anderen Titels:')
if (neu.length) console.error(`  ✖ Neue Treffer (Beleg entfernen oder Besitz klären): ${neu.join(', ')}`)
else console.log('  ✓ Kein neuer Treffer')
if (erledigt.length) console.log(`⚠ WARNUNG Altfälle behoben, aus NOTE_ASIN_ALTFAELLE streichen: ${erledigt.join(', ')}`)
console.log(`check-handbeleg-note-asin-bestand: ${treffer.length} Treffer, davon ${treffer.length - neu.length} Altfälle (Ratsche ${NOTE_ASIN_ALTFAELLE.length}, Ziel 0), ${neu.length} neu.`)
process.exit(neu.length ? 1 : 0)
