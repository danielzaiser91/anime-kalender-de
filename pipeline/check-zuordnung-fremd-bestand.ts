/**
 * Zusicherung: **Keine Plattform-Zuordnung (`data/prime-zugeordnet.json`) liegt an einer Adresse, die einem anderen Titel
 * gehört** (29.10.2026, Anlass: fünf Fehlzuordnungen — vier Netflix-Cartoonseiten an Hero Mask, Swordgai ×2, Pokémon und eine
 * Serienseite an einem Film —, live unsichtbar, weil `adresseFremdBelegt` sie im Bau überspringt, im Bestand aber geblieben).
 * Besitzer: ein Cartoon oder Titel ohne Synchro (`streams`) oder ein Handbeleg einer anderen Kennung.
 * Die 35 Altfälle (Stand 29.10.2026 nach der Sichtung: 40 von 75 gesperrt) stehen in `data/zuordnung-fremd-bekannt.json`: neue Treffer sind rot, ein Eintrag ohne Treffer auch (streichen).
 * Liest `public/data` und gehört deshalb in `check:bestand`; die Fälle ohne Bestand stehen in `check-zuordnung-fremd.ts`.
 */
import { readFileSync } from 'node:fs'
import { melde } from './lib/quarantaene.ts'
import { fremdZugeordneteImBestand, gegenBekannt } from './lib/zuordnung-fremd-bestand.ts'

const treffer = fremdZugeordneteImBestand('.')
const bekannt = JSON.parse(readFileSync('data/zuordnung-fremd-bekannt.json', 'utf8')) as string[]
const { neu, veraltet } = gegenBekannt(treffer, bekannt)
for (const id of new Set(neu.map((t) => t.titleId))) melde(id, 'zuordnung-fremd', 'Zuordnung an der Adresse eines anderen Titels')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nZuordnung an fremder Adresse:')
pruefe(
  'Keine neue Zuordnung liegt an der Adresse eines anderen Titels (sonst Eintrag in data/belege-entfernt.yaml oder Beleg richtigstellen)',
  neu.length === 0,
  neu.map((t) => `Titel ${t.titleId}, Adresse ${t.adresse}, Besitzer ${t.besitzer.join(', ')}`),
)
pruefe('Jede Zeile der Bekannt-Liste hat noch einen Treffer (sonst aus data/zuordnung-fremd-bekannt.json streichen)', veraltet.length === 0, veraltet)
pruefe('Die Bekannt-Liste ist nicht doppelt und sortiert', bekannt.length === new Set(bekannt).size && bekannt.join('\n') === [...bekannt].sort().join('\n'))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : `\ncheck-zuordnung-fremd-bestand: ${treffer.length} Altfälle bekannt, keine neue fremde Adresse.`)
process.exit(verletzt ? 1 : 0)
