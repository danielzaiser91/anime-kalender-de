/**
 * Bestandsteil von `check-adn-kennung.ts`: Steht eine ADN-showId in Kalender (`data/adn.json`) und Katalog (`data/adn-catalog.json`) und der Katalog ordnet sie
 * einem Titel zu, muss die zusammengeführte Show diese `titleId` tragen (Madoka Film 3, Show 1321, 06.11.2026). Liest Rohdaten und `public/data`, gehört deshalb in `check:bestand`.
 */
import { readFileSync } from 'node:fs'
import { adnShowsMitKatalogKennung, loeseAdnTitelIds } from './bau/adn-show-titel.ts'
import { melde } from './lib/quarantaene.ts'
import type { AdnData } from './lib/adn.ts'
import type { Title } from '../shared/types.ts'

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(new URL(`../${pfad}`, import.meta.url), 'utf8')) as T

const titles = new Map(lies<Title[]>('public/data/titles.json').map((t) => [t.id, t]))
const kalender = lies<AdnData>('data/adn.json').shows
const katalog = lies<AdnData>('data/adn-catalog.json').shows
loeseAdnTitelIds(katalog, titles)
const zusammen = adnShowsMitKatalogKennung(kalender, katalog)
const verloren = kalender
  .filter((k) => katalog.some((s) => s.showId === k.showId && s.titleId))
  .filter((k) => !zusammen.find((s) => s.showId === k.showId)?.titleId)
  .map((k) => k.showId)
for (const showId of verloren) melde(katalog.find((s) => s.showId === showId)!.titleId!, 'adn-kennung-bestand', `ADN-showId ${showId} ohne titleId trotz Katalog-Zuordnung`)

console.log(`ADN: ${kalender.filter((k) => katalog.some((s) => s.showId === k.showId)).length} showIds in Kalender und Katalog, ohne Weg trotz Katalog-Zuordnung: ${verloren.length}`)
if (verloren.length) console.error(`  ✖ ADN-showId ohne titleId trotz Katalog-Zuordnung: ${verloren.join(', ')}`)
console.log(`VERSTÖSSE: ${verloren.length}`)
process.exit(verloren.length ? 1 : 0)
