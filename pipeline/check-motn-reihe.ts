/**
 * Ein Synchro-Beleg aus der Streaming-Availability-Quelle verschwindet nur durch einen Widerspruch, nicht durch Beifang
 * in der Reihe oder ein Fernsehprogramm (Wache-Urteil 11.10.2026: Netflix-Belege von „Onmyoji", „Gokushufudou",
 * „Hell's Paradise" gingen an drei Tagen verloren, obwohl die Quelle unverändert „deutsch" sagte).
 *
 * Aufruf: npx tsx pipeline/check-motn-reihe.ts   (Exit 1 bei Verstoß)
 */
import { bewerteTreffer, passtZuSerie, volltreffer } from './lib/adn.ts'
import { laufendJeAnbieter, laufendSchluessel, ordneShowsZu, uebernehmbar, type MotnBestand } from './lib/motn.ts'
import type { Release, StreamLink, Title } from '../shared/types.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const NETFLIX: StreamLink = { platform: 'netflix', url: 'https://www.netflix.com/title/1', zugang: 'abo' }
const titel = (id: number, name: string, folgen: number, jahr: number, streams: StreamLink[] = []): Title =>
  ({ id, titleRomaji: name, titleEn: name, format: 'ONA', episodes: folgen, jpYear: jahr, jpSeason: 'SPRING', franchiseId: 1, streams }) as unknown as Title
const show = (name: string, jahr: number, folgen: number): Record<string, MotnBestand> => ({
  tt1: {
    imdbId: 'tt1',
    titel: name,
    jahr,
    folgen,
    dienste: { netflix: { gelistet: nummern(folgen), deutsch: nummern(folgen), seit: '2024-03-09' } },
    geprueftAm: '2026-10-11',
  },
})
const nummern = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1)
const vergleiche = { passtZuSerie, bewerteTreffer, volltreffer }
const belegeFuer = (reihe: Title[], quelle: Record<string, MotnBestand>) => ordneShowsZu(reihe, quelle, () => reihe, vergleiche)

console.log('\nBeifang in der Reihe')
{
  const werbefilm = titel(10, 'Yinyang Shi: Buzhi Huo', 1, 2019)
  const onmyoji = titel(20, 'Onmyoji', 13, 2023, [NETFLIX])
  const belege = belegeFuer([werbefilm, onmyoji], show('Onmyoji', 2023, 13))
  const b = belege.find((x) => x.titleId === 20 && x.platform === 'netflix')
  pruefe('Einzelfolge ohne Weg vor der Staffel: Beleg bleibt (Onmyoji)', !!b && b.deutsch && b.eindeutig && b.von === 1 && b.bis === 13, belege)
  pruefe('der Beifang bekommt keinen Beleg', !belege.some((x) => x.titleId === 10))
  pruefe('und der Beleg ist übernehmbar', !!b && uebernehmbar(b, false, '2026-10-11'))

  const s1 = titel(1, 'Gokushufudou', 5, 2021, [NETFLIX])
  const s1b = titel(2, 'Gokushufudou Part 2', 5, 2021, [NETFLIX])
  const op = titel(3, 'Crimecatch Policure OP', 1, 2022)
  const s2 = titel(4, 'Gokushufudou Season 2', 5, 2023, [NETFLIX])
  const g = belegeFuer([s1, s1b, op, s2], show('Gokushufudou', 2021, 15)).filter((x) => x.platform === 'netflix')
  pruefe('Einzelfolge mitten in der Reihe: alle drei Staffeln behalten ihren Beleg', [1, 2, 4].every((id) => g.some((x) => x.titleId === id && x.deutsch)), g)
  pruefe('Folgenbereiche 1–5, 6–10, 11–15', g.find((x) => x.titleId === 4)?.von === 11 && g.find((x) => x.titleId === 4)?.bis === 15, g)

  const mitWeg = titel(11, 'Yinyang Shi: Buzhi Huo', 1, 2019, [NETFLIX])
  pruefe('trägt die Einzelfolge einen Weg, wird sie mitgezählt und nichts geraten', belegeFuer([mitWeg, onmyoji], show('Onmyoji', 2023, 13)).length === 0)
}

console.log('\nLaufende Staffel zählt nur beim eigenen Anbieter')
{
  const release = (platform: Release['platform']): Release =>
    ({ titleId: 128893, platform, slug: 'x', schedule: { firstEpisodeDate: '2026-10-11', episodeCount: 4 } }) as unknown as Release
  const heute = '2026-10-11'
  const tv = laufendJeAnbieter([release('tv')], heute)
  pruefe('Fernsehausstrahlung ist laufend', tv.has(laufendSchluessel(128893, 'tv')), [...tv])
  pruefe('hält den Netflix-Beleg nicht zurück (Hell\'s Paradise)', !tv.has(laufendSchluessel(128893, 'netflix')))
  const nf = laufendJeAnbieter([release('netflix')], heute)
  pruefe('eine laufende Netflix-Staffel hält den Netflix-Beleg zurück', nf.has(laufendSchluessel(128893, 'netflix')))
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
