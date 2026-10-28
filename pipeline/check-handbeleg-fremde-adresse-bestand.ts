/**
 * Zusicherung: **Kein Handbeleg eines Titels aus `titles.json` liegt an einer Adresse, die auch ein Cartoon oder ein Titel
 * ohne Synchro als Stream führt** (28.10.2026, Anlass Heidi: der Disney+-Beleg von Heidi 1974 stützte die Sperre
 * `fremdeAdressen` gegen sich selbst, `belegtEigen` öffnet die Adresse). Echte Sammelseiten stehen mit Grund in `SAMMELSEITEN`.
 * Liest `public/data` und gehört deshalb in `check:bestand`; die Fälle ohne Bestand stehen in `check-handbeleg-fremde-adresse.ts`.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { streamAdressen } from './lib/fremde-adressen.ts'
import { findeFremdeBelege, SAMMELSEITEN, type BelegAdresse } from './lib/handbeleg-fremde-adresse.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'

const titel = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as { id: number }[]
const belege = (yaml.load(readFileSync('data/dub-confirmed.yaml', 'utf8')) as BelegAdresse[] | null) ?? []
const { offen, ausgenommen } = findeFremdeBelege(belege, new Set(titel.map((t) => t.id)), streamAdressen('.'))
const offeneIds = new Set(offen.map((o) => o.anilistId))
meldeVerletzte(titel, 'handbeleg-fremde-adresse', 'Handbeleg an der Adresse eines Cartoons oder Titels ohne Synchro', (t) => offeneIds.has(t.id))
const veraltet =Object.keys(SAMMELSEITEN).map(Number).filter((id) => !ausgenommen.includes(id))

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nHandbeleg an fremder Adresse (Cartoon, Titel ohne Synchro):')
pruefe('Kein Handbeleg eines Titels liegt an einer Adresse, die ein Cartoon oder Titel ohne Synchro führt (sonst Beleg korrigieren oder als Sammelseite begründen)', offen.length === 0, offen)
pruefe('Jede Sammelseite hat noch einen Treffer (sonst aus SAMMELSEITEN streichen)', veraltet.length === 0, veraltet)
pruefe('Jede Sammelseite nennt ihren Grund', Object.values(SAMMELSEITEN).every((s) => s.grund.length > 20))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : `\ncheck-handbeleg-fremde-adresse-bestand: ${ausgenommen.length} Sammelseiten-Belege, keine fremde Adresse offen.`)
process.exit(verletzt ? 1 : 0)
