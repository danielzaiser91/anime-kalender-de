/**
 * Zusicherungen zu den Wegen aus sicheren Kalenderterminen (11.10.2026, `pipeline/bau/11-7-wege-aus-terminen.ts`).
 * Läuft in `check:logic`; prüft die Regel an erfundenen Titeln, nicht am Bestand.
 */
import type { Release, Title } from '../shared/types.ts'
import { ergaenzeWegeAusTerminen, istSuchadresse, termineOhneWeg, tonOhneBeleg } from './bau/11-7-wege-aus-terminen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, detail = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const titel = (id: number, streams: Title['streams'] = []) => ({ id, streams }) as unknown as Title
const termin = (titleId: number, platform: string, mehr: Partial<Release> = {}) =>
  ({
    slug: `t${titleId}-${platform}`,
    titleId,
    platform,
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-10-02' },
    sources: ['https://quelle.example/'],
    ...mehr,
  }) as unknown as Release

const DISNEY = 'https://www.disneyplus.com/de-de/browse/entity-be391742'
const PRIME_SUCHE = 'https://www.amazon.de/s?k=TANK%20CHAIR&i=instant-video'
const titles = new Map([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => [id, titel(id)]))
titles.get(3)!.streams = [{ platform: 'disneyplus', url: DISNEY, dub: true }]
const releases = [
  termin(1, 'disneyplus', { platformUrl: DISNEY }),
  termin(2, 'primevideo', { platformUrl: PRIME_SUCHE }),
  termin(3, 'disneyplus', { platformUrl: DISNEY }),
  termin(4, 'disneyplus', { platformUrl: DISNEY, schedule: { firstEpisodeDate: '2026-10-02', estimated: true } }),
  termin(5, 'disc'),
  termin(6, 'tv'),
  termin(7, 'netflix', { platformUrl: 'https://www.netflix.com/title/81234567' }),
  termin(8, 'primevideo', { platformUrl: PRIME_SUCHE, kanal: 'Crunchyroll' }),
  termin(9, 'adn', { sources: [] }),
  termin(10, 'disneyplus', { platformUrl: DISNEY }),
]
const entfernt = [{ titleId: 10, plattform: 'disneyplus' }] as Parameters<typeof ergaenzeWegeAusTerminen>[0]['verweiseEntfernt']
const tot = new Set<string>([])
ergaenzeWegeAusTerminen({ titles, releases, toteAdressen: tot, verweiseEntfernt: entfernt })
const weg = (id: number) => titles.get(id)!.streams

pruefe('Titelseite des Termins wird die Adresse', weg(1)[0]?.url === DISNEY && weg(1)[0]?.platform === 'disneyplus')
pruefe('Prime-Suche wird nie die Adresse: url bleibt leer', weg(2).length === 1 && weg(2)[0]!.url === '')
pruefe('kein Tonurteil: dub fehlt, Herkunft ist der Termin', weg(1)[0]!.dub === undefined && weg(1)[0]!.herkunft === 'termin')
pruefe('Prime-Weg ohne Adresse: Preis unbekannt', weg(2)[0]!.zugang === 'unbekannt')
pruefe('vorhandener Weg zum selben Anbieter bleibt unberührt', weg(3).length === 1 && weg(3)[0]!.dub === true)
pruefe('geschätzter Termin ergibt keinen Weg', weg(4).length === 0)
pruefe('Disc und Fernsehen sind keine Streaming-Wege', weg(5).length === 0 && weg(6).length === 0)
pruefe('Netflix-Titelseite wird übernommen', weg(7)[0]?.url === 'https://www.netflix.com/title/81234567')
pruefe('Prime-Kanal wandert mit', weg(8)[0]?.kanal === 'Crunchyroll')
pruefe('Termin ohne Quelle ergibt keinen Weg', weg(9).length === 0)
pruefe('bewusst entfernter Verweis kommt nicht zurück', weg(10).length === 0)

pruefe('danach fehlt keinem sicheren Termin der Weg', termineOhneWeg(titles, releases, new Set(['10|disneyplus'])).length === 0)
pruefe('ohne die Ergänzung würde die Zusicherung greifen', termineOhneWeg(new Map([[1, titel(1)]]), [releases[0]!], new Set()).length === 1)
pruefe('kein Weg aus einem Termin trägt dub', tonOhneBeleg(titles).length === 0)
pruefe('die Zusicherung findet ein erfundenes Tonurteil', tonOhneBeleg(new Map([[1, titel(1, [{ platform: 'netflix', url: '', herkunft: 'termin', dub: true }])]])).length === 1)

pruefe('Suchadressen werden erkannt', [PRIME_SUCHE, 'https://www.netflix.com/search?q=x', 'https://www.joyn.de/suche?search=x', 'https://www.aniverse.de/?s=x'].every(istSuchadresse))
pruefe('Titelseiten sind keine Suche', ![DISNEY, 'https://www.netflix.com/title/1', 'https://animationdigitalnetwork.com/de/video/1423-eighty-six'].some(istSuchadresse))

if (fehler) process.exit(1)
console.log('check-wege-aus-terminen: ok')
