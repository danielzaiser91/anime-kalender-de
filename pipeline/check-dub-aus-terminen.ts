/** Zusicherungen für den Synchro-Beleg am kuratierten Termin (`lib/dub-aus-terminen.ts`). */
import { dubChecksAusTerminen, dubFeldFehler } from './lib/dub-aus-terminen.ts'
import type { CuratedEntry } from './lib/curated.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const artikel = 'https://www.anime2you.de/news/1/x/'
const gut: CuratedEntry = {
  slug: 'x-paramountplus',
  anilistId: -1,
  titleDe: 'X',
  platform: 'paramountplus',
  platformUrl: 'https://www.paramountplus.com/de/shows/x/',
  releaseType: 'weekly',
  sources: [artikel],
  dub: true,
  dubQuelle: artikel,
  dubZitat: 'Die Folgen stehen sowohl mit deutscher Synchronisation als auch im Original mit Untertiteln bereit.',
  dubGeprueftAm: '2026-10-11',
}

pruefe('vollständiger Beleg ist in Ordnung', dubFeldFehler(gut) === undefined, dubFeldFehler(gut))
pruefe('ohne dub kein Beleg und kein Fehler', dubFeldFehler({ ...gut, dub: undefined }) === undefined)
pruefe('Quelle außerhalb der sources', dubFeldFehler({ ...gut, dubQuelle: 'https://a.de/' }) !== undefined)
pruefe('Untertitel allein belegen keine Synchro', dubFeldFehler({ ...gut, dubZitat: 'Start mit Untertiteln bei Paramount+.' }) !== undefined)
pruefe('verneinter Satz zählt nicht', dubFeldFehler({ ...gut, dubZitat: 'Eine deutsche Synchronisation gibt es noch nicht.' }) !== undefined)
pruefe('Lesedatum fehlt', dubFeldFehler({ ...gut, dubGeprueftAm: undefined }) !== undefined)
pruefe('TV-Termin trägt keinen Streambeleg', dubFeldFehler({ ...gut, platform: 'tv' }) !== undefined)
pruefe('ohne anilistId nicht zuordenbar', dubFeldFehler({ ...gut, anilistId: undefined }) !== undefined)

const aus = dubChecksAusTerminen([gut], [])
pruefe('Beleg wird ein Check mit Adresse', aus.length === 1 && aus[0]!.dub === true && aus[0]!.url === gut.platformUrl && aus[0]!.anilistId === -1, aus)

const hand: DubCheck = { anilistId: -1, platform: 'paramountplus', dub: false, checkedAt: '2026-10-12' }
pruefe('ein Handurteil zum selben Anbieter hat Vorrang', dubChecksAusTerminen([gut], [hand]).length === 0)
const adresse: DubCheck = { anilistId: -1, platform: 'paramountplus', url: gut.platformUrl, checkedAt: '2026-10-12' }
pruefe('ein Adressbeleg ohne Urteil verdrängt ihn nicht', dubChecksAusTerminen([gut], [adresse]).length === 1)

if (fehler) {
  console.error(`check-dub-aus-terminen: ${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('check-dub-aus-terminen: alles grün')
