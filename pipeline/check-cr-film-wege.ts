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

/* Beide Kennungen gehören zum selben Film: die Episode (JustWatch bis 17.09.2026) und ihre deutsche Fassung (`deutscheFolgen[].guid` im
   deutschen Crunchyroll-Katalog, `data/crunchyroll-dub.json`; JustWatch nennt sie seit dem Wochenlauf vom 03.11.2026). */
const FILM_1 = ['GR0XPDJ0Y', 'GD9UV5DDX']
const FILM_2 = ['GR790PW36', 'GQJUGK77Q']
const fuehrtZu = (urls: string[], ids: string[]): boolean => urls.some((u) => ids.some((id) => new RegExp(`/watch/${id}(?:[/?#]|$)`).test(u)))

const SERIE ='https://www.crunchyroll.com/de/series/GR24GX896/kabaneri-of-the-iron-fortress'
const titel = (id: number, episodes: number, format: string, name: string): Title =>
  ({ id, episodes, format, titleEn: name, streams: [{ platform: 'crunchyroll', url: SERIE, dub: true, sharedWith: 3 }] }) as unknown as Title
const staffeln = new Map([['GR24GX896', [{ name: 'Kabaneri of the Iron Fortress', folgen: 12 }]]])

console.log('Kabaneri-Filme: eigene Crunchyroll-Adresse statt Serienseite')
const titles = new Map([
  [21196, titel(21196, 12, 'TV', 'Kabaneri of the Iron Fortress')],
  [98662, titel(98662, 1, 'MOVIE', 'Kabaneri of the Iron Fortress: Light That Gathers')],
  [98663, titel(98663, 1, 'MOVIE', 'Kabaneri of the Iron Fortress: Life That Burns')],
])
fuelleWegeAusJustwatch({ titles, tmdbMehrdeutig: new Set(), istTot: () => false, staffeln })
const crUrls = (id: number): string[] =>
  [...(titles.get(id)!.streams ?? []), ...(titles.get(id)!.watchLinks ?? [])].map((w) => w.url).filter((u) => u.includes('crunchyroll.com'))
pruefe('die Serie behält ihren Serien-Weg', crUrls(21196).includes(SERIE), crUrls(21196))
pruefe('Film 1 zeigt nicht mehr auf die Serienseite', !crUrls(98662).includes(SERIE), crUrls(98662))
pruefe('Film 1 führt zur eigenen Film-Adresse (GR0XPDJ0Y oder deutsche Fassung GD9UV5DDX)', fuehrtZu(crUrls(98662), FILM_1), crUrls(98662))
pruefe('Film 2 führt zur eigenen Film-Adresse (GR790PW36 oder deutsche Fassung GQJUGK77Q)', fuehrtZu(crUrls(98663), FILM_2), crUrls(98663))

console.log('Adress-Urteil fuehrtZu: Serienseite und fremde Kennung bleiben rot')
pruefe('Serienseite allein ist keine Film-Adresse', !fuehrtZu([SERIE], FILM_1))
pruefe('Kennung des anderen Films ist keine Film-Adresse', !fuehrtZu(['https://www.crunchyroll.com/watch/GQJUGK77Q'], FILM_1))
pruefe('Teilstück einer längeren Kennung zählt nicht', !fuehrtZu(['https://www.crunchyroll.com/watch/GD9UV5DDXX'], FILM_1))
pruefe('Episoden-Kennung zählt', fuehrtZu(['https://www.crunchyroll.com/watch/GR0XPDJ0Y'], FILM_1))
pruefe('deutsche Fassung zählt (JustWatch seit 03.11.2026)', fuehrtZu(['https://www.crunchyroll.com/watch/GD9UV5DDX'], FILM_1))

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
