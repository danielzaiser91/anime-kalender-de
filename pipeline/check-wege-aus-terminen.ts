/**
 * Zusicherungen zu den Wegen aus sicheren Kalenderterminen (11.10.2026, `pipeline/bau/11-7-wege-aus-terminen.ts`).
 * Läuft in `check:logic`; prüft die Regel an erfundenen Titeln, nicht am Bestand.
 */
import type { Release, Title } from '../shared/types.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'
import { ergaenzeWegeAusTerminen, istKeineTitelseite, termineOhneWeg, tonOhneBeleg } from './bau/11-7-wege-aus-terminen.ts'

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
const NETFLIX_404 = 'https://www.netflix.com/title/81253271'
const PLUTO = 'https://pluto.tv/de/on-demand/series/dr-stone-1'
const PRIME_SUCHE = 'https://www.amazon.de/s?k=TANK%20CHAIR&i=instant-video'
const titles = new Map([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((id) => [id, titel(id)]))
const GESCHAETZT = { firstEpisodeDate: '2026-11-03', estimated: true }
const PRIME_SEITE = 'https://www.amazon.de/gp/video/detail/B0GZ8BBZD8'
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
  termin(11, 'primevideo', { platformUrl: PRIME_SUCHE }),
  termin(12, 'primevideo', { platformUrl: PRIME_SUCHE }),
  termin(13, 'disneyplus', { platformUrl: DISNEY }),
  termin(14, 'netflix', { platformUrl: NETFLIX_404 }),
  termin(15, 'plutotv', { platformUrl: PLUTO }),
  termin(16, 'plutotv', { platformUrl: PLUTO, schedule: { firstEpisodeDate: '2026-10-02', estimated: true } }),
  termin(17, 'primevideo', { schedule: GESCHAETZT }),
  termin(18, 'primevideo', { schedule: GESCHAETZT }),
  termin(19, 'primevideo', { schedule: GESCHAETZT }),
  termin(20, 'primevideo', { schedule: GESCHAETZT }),
  termin(21, 'primevideo', { schedule: GESCHAETZT, sources: [] }),
  termin(22, 'primevideo', { platformUrl: PRIME_SUCHE }),
  termin(23, 'disc', { schedule: GESCHAETZT }),
]
const entfernt = [{ titleId: 10, plattform: 'disneyplus' }] as Parameters<typeof ergaenzeWegeAusTerminen>[0]['verweiseEntfernt']
const tot = new Set<string>([])
/* Handbelege wie in data/dub-confirmed.yaml: 11 Kamisama Hajimemashita (nicht verfügbar), 12 TANK CHAIR (Folge 1 deutsch), 13 ohne deutschen Ton. */
const hand: Record<string, Partial<DubCheck>> = {
  '11|primevideo': { available: false },
  '12|primevideo': { dub: true, dubRanges: [{ from: 1, to: 1, dub: true }] },
  '13|disneyplus': { dub: false },
  // Geschätzter Termin („ab sofort“) mit Handbeleg wie Z wie Zorro – Der Film: 17 deutsch mit Titelseite, 18 ohne deutschen Ton, 19 nicht verfügbar, 20 deutsch mit Suchadresse, 21 ohne Quelle, 22 sicherer Termin
  '17|primevideo': { dub: true, url: PRIME_SEITE },
  '18|primevideo': { dub: false, url: PRIME_SEITE },
  '19|primevideo': { available: false },
  '20|primevideo': { dub: true, url: PRIME_SUCHE },
  '21|primevideo': { dub: true, url: PRIME_SEITE },
  '22|primevideo': { dub: true, url: PRIME_SEITE },
  '23|disc': { dub: true, url: PRIME_SEITE },
}
const belegFuer = (id: number, plattform: string) => hand[`${id}|${plattform}`] as DubCheck | undefined
ergaenzeWegeAusTerminen({ titles, releases, istTot: (u: string) => tot.has(u) || u === NETFLIX_404, verweiseEntfernt: entfernt, belegFuer })
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

pruefe('laut Linkprüfung tote Termin-Adresse (Beelzebub, 02.11.2026) wird nie die Adresse', weg(14).length === 1 && weg(14)[0]!.url === '')
pruefe('Pluto TV ist ein Streaming-Anbieter: der sichere Termin ergibt einen Weg mit Titelseite', weg(15).length === 1 && weg(15)[0]!.platform === 'plutotv' && weg(15)[0]!.url === PLUTO, JSON.stringify(weg(15)))
pruefe('Pluto TV: ein geschätzter Termin ergibt keinen Weg', weg(16).length === 0)
pruefe('Handbeleg „nicht verfügbar“: kein Weg aus dem Termin (Kamisama Hajimemashita)', weg(11).length === 0)
pruefe('Handbeleg „ohne deutschen Ton“: kein Weg aus dem Termin', weg(13).length === 0)
pruefe('Handbeleg „deutsch“: Weg mit Urteil und Folgenbereich, ohne Herkunft Termin (TANK CHAIR)', weg(12).length === 1 && weg(12)[0]!.dub === true && weg(12)[0]!.dubRanges?.[0]?.to === 1 && weg(12)[0]!.herkunft === undefined)

pruefe('geschätzter Termin mit Handbeleg „deutsch“: Weg mit Urteil und der Adresse des Belegs (Z wie Zorro)', weg(17).length === 1 && weg(17)[0]!.dub === true && weg(17)[0]!.url === PRIME_SEITE && weg(17)[0]!.herkunft === undefined, JSON.stringify(weg(17)))
pruefe('geschätzter Termin mit Handbeleg „ohne deutschen Ton“ oder „nicht verfügbar“: kein Weg', weg(18).length === 0 && weg(19).length === 0)
pruefe('geschätzter Termin mit Handbeleg „deutsch“ und Suchadresse: Weg ohne Adresse', weg(20).length === 1 && weg(20)[0]!.dub === true && weg(20)[0]!.url === '', JSON.stringify(weg(20)))
pruefe('geschätzter Termin ohne Quelle oder Disc-Termin: auch mit Handbeleg kein Weg', weg(21).length === 0 && weg(23).length === 0)
pruefe('sicherer Termin ohne Titelseite behält die leere Adresse, auch wenn der Beleg eine kennt', weg(22).length === 1 && weg(22)[0]!.url === '', JSON.stringify(weg(22)))

pruefe('danach fehlt keinem sicheren Termin der Weg', termineOhneWeg(titles, releases, new Set(['10|disneyplus', '11|primevideo', '13|disneyplus'])).length === 0)
pruefe('ohne die Ergänzung würde die Zusicherung greifen', termineOhneWeg(new Map([[1, titel(1)]]), [releases[0]!], new Set()).length === 1)
pruefe('kein Weg aus einem Termin trägt dub', tonOhneBeleg(titles).length === 0)
pruefe('die Zusicherung findet ein erfundenes Tonurteil', tonOhneBeleg(new Map([[1, titel(1, [{ platform: 'netflix', url: '', herkunft: 'termin', dub: true }])]])).length === 1)

pruefe('Suchen und Startseiten sind keine Titelseite', [PRIME_SUCHE, 'https://www.netflix.com/search?q=x', 'https://www.joyn.de/suche?search=x', 'https://www.aniverse.de/?s=x', 'https://netflix.com'].every(istKeineTitelseite))
pruefe('Titelseiten sind keine Suche', ![DISNEY, 'https://www.netflix.com/title/1', 'https://animationdigitalnetwork.com/de/video/1423-eighty-six'].some(istKeineTitelseite))

if (fehler) process.exit(1)
console.log('check-wege-aus-terminen: ok')
