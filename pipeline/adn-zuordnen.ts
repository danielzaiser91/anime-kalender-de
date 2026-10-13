/**
 * Rechnet die aniSearch-Zuordnung der ADN-Serien neu, ohne ADN abzufragen: liest `data/adn-catalog.json`, ordnet über die Titelliste im Cache zu
 * (`lib/adn-zuordnung-lauf.ts`) und schreibt Katalog und `data/adn-anisearch-offen.json`.
 *
 * Aufruf: `npm run data:adn:zuordnen`
 */
import { readJson, writeJson } from './lib/util.ts'
import { ordneKatalogZuAnisearch } from './lib/adn-zuordnung-lauf.ts'
import type { AdnData } from './lib/adn.ts'

const katalog = readJson<AdnData>('data/adn-catalog.json', { scrapedAt: '', window: { from: '', to: '' }, shows: [] })
await ordneKatalogZuAnisearch(katalog.shows, katalog.shows)
writeJson('data/adn-catalog.json', katalog, true)
