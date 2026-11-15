/**
 * Streaming-Tageswert (15.11.2026): Zählung `hatStreamingWeg` an echten Titeln (Ausschnitt aus titles.json: 1, 63, 7)
 * und die Rückgang-Warnung von `check-qualitaet`. Aufruf: `npm run check:logic`.
 */
import { hatStreamingWeg } from '../tools/streaming-weg-zaehlen.mjs'
import { streamingRueckgang } from './lib/streaming-rueckgang.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kauf = { name: 'aniSearch', url: 'https://www.anisearch.de/article/10894,witch-hunter-robin', kind: 'buy' }
const stream = { name: 'Amazon Prime (Crunchyroll)', url: 'https://www.amazon.de/gp/video/detail/B0CGMSXB24', kind: 'stream' }
const netflix = { platform: 'netflix', url: 'https://www.netflix.com/title/80001305', dub: true }

const titel = [
  { id: 1, streams: [netflix], watchLinks: [{ ...kauf, kind: 'buy' }] },
  { id: 63, streams: [], watchLinks: [stream, kauf] },
  { id: 7, streams: [], watchLinks: [kauf] },
  { id: 900001, streams: [] },
  { id: 900002, streams: [netflix], watchLinks: [stream] },
]
pruefe('streams nicht leer zählt', hatStreamingWeg(titel[0]!))
pruefe('leeres streams, watchLinks stream zählt', hatStreamingWeg(titel[1]!))
pruefe('watchLinks nur buy zählt nicht', !hatStreamingWeg(titel[2]!))
pruefe('weder streams noch watchLinks zählt nicht', !hatStreamingWeg(titel[3]!))
pruefe('beides zählt einmal', hatStreamingWeg(titel[4]!))
pruefe('Summe über den Ausschnitt', titel.filter(hatStreamingWeg).length === 3, titel.filter(hatStreamingWeg).length)

pruefe('Rückgang 1947 → 1927 (>1 %) warnt', streamingRueckgang(1927, 1947) !== null)
pruefe('Rückgang 1947 → 1928 (<1 %) warnt nicht', streamingRueckgang(1928, 1947) === null)
pruefe('Rückgang genau 1 % (100 → 99) warnt nicht', streamingRueckgang(99, 100) === null)
pruefe('Rückgang 100 → 98 warnt', streamingRueckgang(98, 100) !== null)
pruefe('Anstieg warnt nicht', streamingRueckgang(1950, 1947) === null)
pruefe('gleicher Wert warnt nicht', streamingRueckgang(1947, 1947) === null)
pruefe('kein Vorwert warnt nicht', streamingRueckgang(0, undefined) === null && streamingRueckgang(5, 0) === null)
pruefe('Warntext nennt beide Werte', /1947.*1927/.test(streamingRueckgang(1927, 1947) ?? ''))

if (verletzt) process.exit(1)
console.log('check-streaming-rueckgang: 14 Fälle grün')
