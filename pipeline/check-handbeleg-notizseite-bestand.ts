/**
 * Zusicherung: **Keine neue Seite eines Prime-Handbeleg-Blocks gehört einem anderen Titel** (02.11.2026, PR 2701/2704).
 * Altfälle stehen als Ratsche in `ALTFAELLE` (darf nur sinken, Ziel 0). Liest `public/data` und `data/` → `check:bestand`;
 * die Fälle ohne Bestand stehen in `check-handbeleg-notizseite.ts`.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { baueBesitz, findeFremdeNotizseiten, type BesitzTitel, type BlockSeite } from './lib/handbeleg-notizseite.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import { ALTFAELLE } from './lib/handbeleg-notizseite-altfaelle.ts'

const titel = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as BesitzTitel[]
const zugeordnet = JSON.parse(readFileSync('data/prime-zugeordnet.json', 'utf8')) as Record<string, { titleId: number }>
const belege = (yaml.load(readFileSync('data/dub-confirmed.yaml', 'utf8')) as BlockSeite[] | null) ?? []
const treffer = findeFremdeNotizseiten(belege, baueBesitz(titel, zugeordnet))
const neu = treffer.filter((t) => !ALTFAELLE.includes(t))
const neuIds = new Set(neu.map((t) => Number(t.split('@')[0])))
meldeVerletzte(titel, 'handbeleg-notizseite', 'Handbeleg-Block an der Seite eines anderen Titels', (t) => neuIds.has(t.id))
const erledigt = ALTFAELLE.filter((a) => !treffer.includes(a))

if (process.argv.includes('--liste')) console.log(JSON.stringify(treffer))
console.log('\nHandbeleg-Block an der Seite eines anderen Titels:')
if (neu.length) console.error(`  ✖ Neue Treffer (Beleg entfernen oder Besitz klären): ${neu.join(', ')}`)
else console.log('  ✓ Kein neuer Treffer')
if (erledigt.length) console.log(`⚠ WARNUNG Altfälle behoben, aus ALTFAELLE streichen: ${erledigt.join(', ')}`)
console.log(`check-handbeleg-notizseite-bestand: ${treffer.length} Treffer, davon ${treffer.length - neu.length} Altfälle (Ratsche ${ALTFAELLE.length}, Ziel 0), ${neu.length} neu.`)
console.log(`VERSTÖSSE: ${neu.length}`)
process.exit(neu.length ? 1 : 0)
