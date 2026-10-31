/**
 * Zusicherung (Super Beerus und Fool Night, 13.10.2026): Ein Termin mit Sprachkennzeichnung (`sprache`: omu/offen) belegt keine Synchro.
 * Er setzt weder `dub: true` am Stream (`terminBelegtNichts`) noch bleibt ein solcher Stream unbemerkt (`deutschNurAusSpracheTermin`).
 * Aufruf: `npm run check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { terminBelegtNichts } from './bau/09-1-belege.ts'
import { deutschNurAusSpracheTermin } from './lib/pruefung.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-13'
const termin = (extra: Partial<Release> = {}): Release =>
  ({ slug: 'netflix-x', titleId: 206814, platform: 'netflix', schedule: { firstEpisodeDate: '2026-10-18' }, ...extra }) as unknown as Release
const titel = (dub: boolean | undefined): Map<number, Title> =>
  new Map([[206814, { id: 206814, streams: [{ platform: 'netflix', url: 'u', ...(dub === undefined ? {} : { dub }) }] } as unknown as Title]])

console.log('\nTermin mit Sprachkennzeichnung belegt keine Synchro:')
pruefe('omu: belegt nichts', terminBelegtNichts(termin({ sprache: 'omu' }), HEUTE))
pruefe('offen: belegt nichts', terminBelegtNichts(termin({ sprache: 'offen' }), HEUTE))
pruefe('auch ein vergangener Termin mit Kennzeichnung belegt nichts', terminBelegtNichts(termin({ sprache: 'omu', schedule: { firstEpisodeDate: '2026-10-01' } } as Partial<Release>), HEUTE))
pruefe('ohne Kennzeichnung und ohne Schätzung bleibt ein Beleg', !terminBelegtNichts(termin(), HEUTE))

console.log('\nBauprüfung:')
pruefe('Stream „deutsch", alle Termine gekennzeichnet: gemeldet', deutschNurAusSpracheTermin([termin({ sprache: 'omu' })], titel(true)).length === 1)
pruefe('Stream ohne Urteil: ruhig', deutschNurAusSpracheTermin([termin({ sprache: 'omu' })], titel(undefined)).length === 0)
pruefe('ein Termin ohne Kennzeichnung dabei: ruhig', deutschNurAusSpracheTermin([termin({ sprache: 'omu' }), termin({ slug: 'zwei' })], titel(true)).length === 0)
pruefe('anderer Anbieter: ruhig', deutschNurAusSpracheTermin([termin({ sprache: 'omu', platform: 'crunchyroll' })], titel(true)).length === 0)
pruefe('Handbeleg deutsch, Termin nur offen: ruhig', deutschNurAusSpracheTermin([termin({ sprache: 'offen' })], titel(true), new Set(['206814|netflix'])).length === 0)
pruefe('Handbeleg deutsch, Termin omu: gemeldet', deutschNurAusSpracheTermin([termin({ sprache: 'omu' })], titel(true), new Set(['206814|netflix'])).length === 1)

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
