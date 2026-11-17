/**
 * Zusicherung (17.11.2026): Ein Termin zählt nur mit tonführender Quelle als Synchro-Beleg (`terminBelegtTon`, `lib/ton-quelle.ts`).
 * Formen nach `public/data/releases.json` (Star Wars Visions/Disney+, ADN-Kalender, CR-Simulcastkalender).
 * Aufruf: `npm run check:logic`.
 */
import type { Release } from '../shared/types.ts'
import { plattformenMitTonTermin, terminBelegtTon } from './bau/09-1-belege.ts'
import { quelleNenntTon } from './lib/ton-quelle.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}`)
}

const HEUTE = '2026-11-17'
const ARTIKEL = 'https://www.anime2you.de/news/1036663/disney-plus-sechs-anime-neuzugaenge-august-2026/'
const ADN = 'https://gw.api.animationdigitalnetwork.com/video/calendar?date=2026-10-01'
const CR_KALENDER = 'https://www.crunchyroll.com/de/simulcastcalendar'
const CR_SERIE = 'https://www.crunchyroll.com/de/series/G649PJ0JY/blue-exorcist'
const termin = (sources: string[], schedule: Release['schedule'] = { firstEpisodeDate: '2026-08-05' } as Release['schedule']): Release =>
  ({ slug: 'x', titleId: 213847, platform: 'disneyplus', sources, schedule }) as unknown as Release

console.log('\nTerminquelle nennt den Ton:')
pruefe('Neuzugangsartikel (Disney+): nein', !terminBelegtTon(termin([ARTIKEL]), HEUTE))
pruefe('ADN-Kalender-Endpunkt: ja', terminBelegtTon(termin([ADN]), HEUTE))
pruefe('CR-Simulcastkalender: ja', terminBelegtTon(termin([CR_KALENDER]), HEUTE))
pruefe('CR-Serienseite (kuratiert): nein', !terminBelegtTon(termin([CR_SERIE]), HEUTE))
pruefe('Artikel plus tonführende Quelle: ja', terminBelegtTon(termin([ARTIKEL, ADN]), HEUTE))
pruefe('Movie of the Night: nein', !terminBelegtTon(termin(['https://www.movieofthenight.com/show/x']), HEUTE))
pruefe('ohne Quelle: nein', !terminBelegtTon(termin([]), HEUTE))
pruefe('kaputte Adresse: nein', !quelleNenntTon('kein-link'))

console.log('\nGeschätzt und begonnen:')
const begonnen = { firstEpisodeDate: '2026-10-01', estimated: true } as Release['schedule']
pruefe('CR-Kalender, begonnen, geschätzt: nein', !terminBelegtTon(termin([CR_KALENDER], begonnen), HEUTE))
pruefe('CR-Kalender, begonnen, belegt: ja', terminBelegtTon(termin([CR_KALENDER], { firstEpisodeDate: '2026-10-01' } as Release['schedule']), HEUTE))

console.log('\nBau (Stream-Ja aus Terminen):')
const jeTitel = plattformenMitTonTermin([termin([ARTIKEL]), { ...termin([ADN]), titleId: 2 }], HEUTE)
pruefe('Artikel-Termin: kein Ja für den Titel', !jeTitel.has(213847))
pruefe('ADN-Termin: Ja für Titel und Anbieter', jeTitel.get(2)?.has('disneyplus') === true)

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
