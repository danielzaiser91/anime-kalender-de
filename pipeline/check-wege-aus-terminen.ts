/**
 * Zusicherungen zu den Wegen aus sicheren Kalenderterminen (11.10.2026, `pipeline/bau/11-7-wege-aus-terminen.ts`).
 * Läuft in `check:logic`; prüft die Regel an erfundenen Titeln, nicht am Bestand.
 */
import type { Release, Title } from '../shared/types.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'
import { ergaenzeWegeAusTerminen, istKeineTitelseite, termineOhneWeg, tonOhneBeleg, ueberholteNeins } from './bau/11-7-wege-aus-terminen.ts'

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
const titles = new Map([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((id) => [id, titel(id)]))
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
]
const entfernt = [{ titleId: 10, plattform: 'disneyplus' }] as Parameters<typeof ergaenzeWegeAusTerminen>[0]['verweiseEntfernt']
const tot = new Set<string>([])
/* Handbelege wie in data/dub-confirmed.yaml: 11 Kamisama Hajimemashita (nicht verfügbar), 12 TANK CHAIR (Folge 1 deutsch), 13 ohne deutschen Ton. */
const hand: Record<string, Partial<DubCheck>> = {
  '11|primevideo': { available: false },
  '12|primevideo': { dub: true, dubRanges: [{ from: 1, to: 1, dub: true }] },
  '13|disneyplus': { dub: false },
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

pruefe('danach fehlt keinem sicheren Termin der Weg', termineOhneWeg(titles, releases, new Set(['10|disneyplus', '11|primevideo', '13|disneyplus'])).length === 0)
pruefe('ohne die Ergänzung würde die Zusicherung greifen', termineOhneWeg(new Map([[1, titel(1)]]), [releases[0]!], new Set()).length === 1)
pruefe('kein Weg aus einem Termin trägt dub', tonOhneBeleg(titles).length === 0)
pruefe('die Zusicherung findet ein erfundenes Tonurteil', tonOhneBeleg(new Map([[1, titel(1, [{ platform: 'netflix', url: '', herkunft: 'termin', dub: true }])]])).length === 1)

pruefe('Suchen und Startseiten sind keine Titelseite', [PRIME_SUCHE, 'https://www.netflix.com/search?q=x', 'https://www.joyn.de/suche?search=x', 'https://www.aniverse.de/?s=x', 'https://netflix.com'].every(istKeineTitelseite))
pruefe('Titelseiten sind keine Suche', ![DISNEY, 'https://www.netflix.com/title/1', 'https://animationdigitalnetwork.com/de/video/1423-eighty-six'].some(istKeineTitelseite))

/*
  Überholtes Nein (17.11.2026), Datenform der echten Fälle: 14713 Kamisama Kiss (Prime-Nein „Suche ohne Treffer“ 27.08., Aniverse-Termin 08.10., Termin ohne Adresse),
  102836 Kuroko Movie 2 (Nein 30.08., Termin 13.09. ohne Kanal, Suchadresse), 103631 Trinity Seven (Nein dub:false, Aniverse-Termin).
*/
const nein = (anilistId: number, mehr: Partial<DubCheck>) => ({ anilistId, platform: 'primevideo', checkedAt: '2026-08-27', ...mehr }) as DubCheck
const belegeAlt = [nein(14713, { available: false }), nein(102836, { available: false, checkedAt: '2026-08-30', url: PRIME_SUCHE }), nein(103631, { dub: false, checkedAt: '2026-10-16' }), nein(20801, { available: false, checkedAt: '2026-10-20' }), nein(41, { available: false }), nein(42, { dub: true }), nein(43, { available: false }), nein(44, { available: false })]
const kanalTermin = (id: number, ab: string, mehr: Partial<Release> = {}) =>
  termin(id, 'primevideo', { kanal: 'Aniverse', schedule: { firstEpisodeDate: ab, episodeCount: 13 }, ...mehr })
const termineAlt = [
  kanalTermin(14713, '2026-10-08'),
  termin(102836, 'primevideo', { platformUrl: PRIME_SUCHE, schedule: { firstEpisodeDate: '2026-09-13' } }),
  kanalTermin(103631, '2026-10-15'),
  kanalTermin(20801, '2026-10-08'),
  kanalTermin(40, '2026-10-08'),
  kanalTermin(41, '2026-08-01'),
  kanalTermin(41, '2026-10-08', { slug: 'zweiter-41' }),
  kanalTermin(42, '2026-10-08'),
  kanalTermin(44, '2026-11-20'),
  kanalTermin(43, '2026-10-08', { slug: 'kanal-43' }),
  termin(43, 'primevideo', { platformUrl: PRIME_SUCHE, schedule: { firstEpisodeDate: '2026-09-13' } }),
]
const titelAlt = new Map([14713, 102836, 103631, 20801, 43].map((id) => [id, titel(id)]))
const ueberholt = ueberholteNeins(belegeAlt, termineAlt, '2026-11-17')
pruefe('überholtes Nein: Kamisama Kiss und 43 (Nein älter als der Kanal-Termin), sonst keiner', [...ueberholt].sort().join() === '14713|primevideo,43|primevideo', [...ueberholt].join())
ergaenzeWegeAusTerminen({ titles: titelAlt, releases: termineAlt, istTot: () => false, verweiseEntfernt: [], belegFuer: (id) => belegeAlt.find((b) => b.anilistId === id), nein: ueberholt })
const wegAlt = (id: number) => titelAlt.get(id)!.streams
pruefe('Kamisama Kiss: Weg mit Kanal, ohne Adresse, ohne Tonurteil', wegAlt(14713).length === 1 && wegAlt(14713)[0]!.kanal === 'Aniverse' && wegAlt(14713)[0]!.url === '' && wegAlt(14713)[0]!.dub === undefined && wegAlt(14713)[0]!.herkunft === 'termin', JSON.stringify(wegAlt(14713)))
pruefe('Kuroko: ohne Kanal bleibt das Nein (kein Weg ohne Adresse und Ton)', wegAlt(102836).length === 0)
pruefe('Trinity Seven: „ohne deutschen Ton“ bleibt, auch bei jüngerem Termin', wegAlt(103631).length === 0)
pruefe('Nein jünger als der Termin gilt weiter', wegAlt(20801).length === 0)
pruefe('ein Ja-Beleg (42) ist kein überholtes Nein', !ueberholt.has('42|primevideo'))
pruefe('ein erst kommender Termin (44, Call of the Night: 20.11.) überholt das Nein noch nicht', !ueberholt.has('44|primevideo'))
const weg43 = titelAlt.get(43)!.streams
pruefe('neben einem Termin ohne Kanal (43) entsteht der Weg aus dem Kanal-Termin, mit Kanal', weg43.length === 1 && weg43[0]!.kanal === 'Aniverse', JSON.stringify(weg43))
pruefe('ohne Handbeleg gibt es nichts zu überholen (40); ein Nein, das älter als nur der spätere Termin ist, gilt dem früheren (41)', !ueberholt.has('40|primevideo') && !ueberholt.has('41|primevideo'))

if (fehler) process.exit(1)
console.log('check-wege-aus-terminen: ok')
