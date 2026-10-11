/**
 * Ein Synchro-Beleg aus der Streaming-Availability-Quelle verschwindet nur durch einen Widerspruch, nicht durch ein
 * Fernsehprogramm (Wache-Urteil 11.10.2026: der Netflix-Beleg von „Hell's Paradise" ging verloren, als die
 * Fernsehausstrahlung am 11.10. begann, obwohl die Quelle unverändert „deutsch" sagte).
 *
 * Aufruf: npx tsx pipeline/check-motn-reihe.ts   (Exit 1 bei Verstoß)
 */
import { laufendJeAnbieter, laufendSchluessel } from './lib/motn.ts'
import type { Release } from '../shared/types.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
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
