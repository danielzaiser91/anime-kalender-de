/**
 * Wächter: eine Wiederholmeldung eines Belegs mit `sonderfolgen` wird nicht noch einmal angehängt (31.10.2026).
 *
 * Anlass: Higurashi Kai, Amazon B09KX2VLPR. Der Handbeleg trägt `sonderfolgen: [25]` (Bonusfolge), die Erweiterung
 * misst Folge 25 ohne dieses Feld; `belegSchluessel` sah zwei verschiedene Belege, der Bau zählte „bis Folge 25 bei 24“
 * und stellte 30 Meldungen jeden Bau wieder zurück.
 */
import yaml from 'js-yaml'
import { belegSchluessel, neueBelegBloecke } from './lib/dub-confirmed.ts'

const fehler: string[] = []
function pruefe(name: string, ok: boolean, info?: unknown): void {
  if (ok) console.log(`✓ ${name}`)
  else {
    fehler.push(name)
    console.log(`✖ ${name}`, info ?? '')
  }
}

const alt = [
  '- anilistId: 900001',
  '  platform: primevideo',
  '  url: https://www.amazon.de/dp/B09KX2VLPR',
  '  dub: false',
  '  dubRanges:',
  '    - from: 1',
  '      to: 25',
  '      dub: false',
  '      checked: [1, 25]',
  '  sonderfolgen: [25]',
  "  checkedAt: '2026-10-13'",
  '',
].join('\n')

const messung = (bis: number, datum: string, extra: string[] = []): string[] => [
  '- anilistId: 900001',
  '  platform: primevideo',
  '  url: https://www.amazon.de/dp/B09KX2VLPR',
  '  dub: false',
  '  dubRanges:',
  '    - from: 1',
  `      to: ${bis}`,
  '      dub: false',
  `      checked: [1, ${bis}]`,
  ...extra,
  `  checkedAt: '${datum}'`,
]

const wieder = neueBelegBloecke(alt, messung(25, '2026-10-31')).neu
pruefe('Wiederholmeldung ohne sonderfolgen wird nicht angehängt', wieder.length === 0, wieder)

const echteNeue = neueBelegBloecke(alt, messung(24, '2026-10-31')).neu
pruefe('echte neue Messung (andere Spanne) wird angehängt', echteNeue.length === 1, echteNeue)

const anderesFeld = neueBelegBloecke(alt, messung(25, '2026-10-31', ['  teilBereich:', '    von: 1', '    bis: 12'])).neu
pruefe('anderes Zusatzfeld (teilBereich) bleibt ein Unterschied', anderesFeld.length === 1, anderesFeld)

const a = yaml.load(alt) as unknown[]
const b = yaml.load(messung(25, '2026-10-31').join('\n')) as unknown[]
pruefe('Schlüssel gleich trotz sonderfolgen und checkedAt', belegSchluessel(a[0]) === belegSchluessel(b[0]))

console.log(`check-beleg-sonderfolgen: ${fehler.length ? fehler.length + ' rot' : '4 Fälle grün'}`)
process.exit(fehler.length ? 1 : 0)
