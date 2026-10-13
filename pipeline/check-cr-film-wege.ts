/**
 * Zusicherung: Ein Film, dessen Crunchyroll-Weg auf die Serienseite zeigte (die ihn nicht enthält), bekommt nach dem Entfernen
 * dieses Wegs die eigene Film-Adresse aus JustWatch (Kabaneri-Zusammenfassungsfilme, Wochenwache 12.10.2026). Läuft in `check:logic`.
 */
import { fuelleWegeAusJustwatch } from './bau/11-wege-abschluss.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const SERIE = 'https://www.crunchyroll.com/de/series/GR24GX896/kabaneri-of-the-iron-fortress'
const titel = (id: number, episodes: number, format: string, name: string): Title =>
  ({ id, episodes, format, titleEn: name, streams: [{ platform: 'crunchyroll', url: SERIE, dub: true, sharedWith: 3 }] }) as unknown as Title
const staffeln = new Map([['GR24GX896', [{ name: 'Kabaneri of the Iron Fortress', folgen: 12 }]]])

console.log('Kabaneri-Filme: eigene Crunchyroll-Adresse statt Serienseite')
const titles = new Map([
  [21196, titel(21196, 12, 'TV', 'Kabaneri of the Iron Fortress')],
  [98662, titel(98662, 1, 'MOVIE', 'Kabaneri of the Iron Fortress: Light That Gathers')],
  [98663, titel(98663, 1, 'MOVIE', 'Kabaneri of the Iron Fortress: Life That Burns')],
])
fuelleWegeAusJustwatch({ titles, tmdbMehrdeutig: new Set(), toteAdressen: new Set(), staffeln })
const crUrls = (id: number): string[] =>
  [...(titles.get(id)!.streams ?? []), ...(titles.get(id)!.watchLinks ?? [])].map((w) => w.url).filter((u) => u.includes('crunchyroll.com'))
pruefe('die Serie behält ihren Serien-Weg', crUrls(21196).includes(SERIE), crUrls(21196))
pruefe('Film 1 zeigt nicht mehr auf die Serienseite', !crUrls(98662).includes(SERIE), crUrls(98662))
pruefe('Film 1 führt zur eigenen Film-Adresse (GR0XPDJ0Y)', crUrls(98662).some((u) => u.includes('/watch/GR0XPDJ0Y')), crUrls(98662))
pruefe('Film 2 führt zur eigenen Film-Adresse (GR790PW36)', crUrls(98663).some((u) => u.includes('/watch/GR790PW36')), crUrls(98663))

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
