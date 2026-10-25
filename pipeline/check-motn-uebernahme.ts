/**
 * Zusicherung (25.10.2026): `uebernehmeMotnBelege` setzt `dub: true` nur an Verweise ohne Urteil und vermerkt genau diese in `motnTon`
 * (die Belegstärke zählt sie als mittlere Quelle). Kennungen ab 900000, feste Uhr.
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-motn-uebernahme.ts`
 */
import type { PlatformId, Release, Title } from '../shared/types.ts'
import type { MotnBeleg } from './lib/motn.ts'
import { LEER, laufendSchluessel, type MotnBestand, type MotnDaten } from './lib/motn.ts'
import { uebernehmeMotnBelege, werteMotnAus } from './bau/09-5-1-motn-uebernahme.ts'
import { motnTonSchluessel } from './lib/belegstaerke.ts'

const HEUTE = '2026-10-25'
let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const weg = (platform: PlatformId, url: string, dub?: boolean) => ({ platform, url, ...(dub === undefined ? {} : { dub }) })
const titel = (id: number, streams: ReturnType<typeof weg>[]) => ({ id, streams }) as unknown as Title
const beleg = (titleId: number, platform: PlatformId, extra: Partial<MotnBeleg> = {}): MotnBeleg =>
  ({ titleId, platform, imdbId: 'tt0', von: 1, bis: 12, deutsch: true, eindeutig: true, ...extra }) as MotnBeleg

const offen = titel(900101, [weg('netflix', 'https://n/1')])
const schonBelegt = titel(900102, [weg('netflix', 'https://n/2', true)])
const laufend = titel(900103, [weg('netflix', 'https://n/3')])
const disney = titel(900104, [weg('disneyplus', 'https://d/4')])
const englisch = titel(900105, [weg('netflix', 'https://n/5')])
const abgelaufen = titel(900106, [weg('netflix', 'https://n/6')])
const zweiWege = titel(900107, [weg('netflix', 'https://n/7a', true), weg('netflix', 'https://n/7b')])
const alle = [offen, schonBelegt, laufend, disney, englisch, abgelaufen, zweiWege]

console.log('\nMotn-Übernahme: nur Verweise ohne Urteil, mit Vermerk')
const e = uebernehmeMotnBelege({
  belege: [
    beleg(900101, 'netflix'),
    beleg(900102, 'netflix'),
    beleg(900103, 'netflix'),
    beleg(900104, 'disneyplus'),
    beleg(900105, 'netflix', { deutsch: false }),
    beleg(900106, 'netflix', { laeuftAusAm: '2026-01-01' }),
    beleg(900107, 'netflix'),
  ],
  titles: new Map(alle.map((t) => [t.id, t])),
  laeuft: new Set([laufendSchluessel(900103, 'netflix')]),
  heute: HEUTE,
})
const dubVon = (t: Title) => t.streams.map((s) => s.dub)
pruefe('Verweis ohne Urteil bekommt dub:true und den Vermerk', dubVon(offen)[0] === true && e.motnTon.has(motnTonSchluessel(900101, 'https://n/1')), [...e.motnTon])
pruefe('Verweis mit Urteil bleibt unberührt und ohne Vermerk', dubVon(schonBelegt)[0] === true && !e.motnTon.has(motnTonSchluessel(900102, 'https://n/2')), [...e.motnTon])
pruefe('laufende Staffel: nichts gesetzt, als ausgelassen gezählt', dubVon(laufend)[0] === undefined && e.ausgelassenLaufend === 1, e.ausgelassenLaufend)
pruefe('Disney+ wird nicht übernommen', dubVon(disney)[0] === undefined)
pruefe('Beleg ohne Deutsch setzt nichts', dubVon(englisch)[0] === undefined)
pruefe('abgelaufenes Angebot setzt nichts', dubVon(abgelaufen)[0] === undefined)
pruefe('zwei Netflix-Wege: der erste hat schon ein Urteil, nichts wird gesetzt', dubVon(zweiWege).join() === 'true,', dubVon(zweiWege))
pruefe('genau ein Vermerk, Zähler stimmt', e.motnTon.size === 1 && e.motnBelege === 1, [e.motnTon.size, e.motnBelege])

console.log('\nMotn-Übernahme: der ganze Weg von der Quelle zum Vermerk (Onmyoji, Netflix, 13 Folgen)')
{
  const folgen = Array.from({ length: 13 }, (_, i) => i + 1)
  const quelle: Record<string, MotnBestand> = {
    tt1: { imdbId: 'tt1', titel: 'Onmyoji', jahr: 2023, folgen: 13, dienste: { netflix: { gelistet: folgen, deutsch: folgen, seit: '2024-03-09' } }, geprueftAm: '2026-10-11' },
  }
  const neuerTitel = () => ({ id: 900120, titleRomaji: 'Onmyoji', titleEn: 'Onmyoji', format: 'ONA', episodes: 13, jpYear: 2023, jpSeason: 'SPRING', franchiseId: 1, streams: [weg('netflix', 'https://n/onmyoji')] }) as unknown as Title
  const lauf = (motn: MotnDaten, t: Title) => werteMotnAus({ motn, tmdbTitles: {}, titles: new Map([[t.id, t]]), releases: [], heute: HEUTE })
  const onmyoji = neuerTitel()
  const mit = lauf({ ...LEER, shows: quelle }, onmyoji)
  pruefe('Serie der Quelle wird zugeordnet: dub:true und genau ein Vermerk', onmyoji.streams[0]?.dub === true && mit.motnBelege === 1 && mit.motnTon.has(motnTonSchluessel(900120, 'https://n/onmyoji')), [...mit.motnTon])
  const laufendeStaffel = neuerTitel()
  const release = { titleId: 900120, platform: 'netflix', slug: 'x', schedule: { firstEpisodeDate: HEUTE, episodeCount: 13 } } as unknown as Release
  const laeuft = werteMotnAus({ motn: { ...LEER, shows: quelle }, tmdbTitles: {}, titles: new Map([[900120, laufendeStaffel]]), releases: [release], heute: HEUTE })
  pruefe('läuft die Staffel bei Netflix gerade, bleibt der Verweis ohne Urteil', laufendeStaffel.streams[0]?.dub === undefined && laeuft.motnTon.size === 0, [...laeuft.motnTon])
  const ohneKatalog = neuerTitel()
  const ohne = lauf(LEER, ohneKatalog)
  pruefe('ohne Serien im Katalog: nichts gesetzt, kein Vermerk', ohneKatalog.streams[0]?.dub === undefined && ohne.motnBelege === 0 && ohne.motnTon.size === 0, [...ohne.motnTon])
}

if (verletzt > 0) process.exit(1)
console.log('Motn-Übernahme: alle Zusicherungen halten (7 Titel, 1 Vermerk).')
