/**
 * Zusicherung: Der aniSearch-Link eines Titels kommt nie aus einer geliehenen Beschreibung (10.10.2026, Gachiakuta S2 verlinkte die
 * Seite von Staffel 1, 1.831 Titel betroffen). Läuft in `check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { eigenerAsZiel } from '../web/src/components/detail/plot.ts'
import { verweiseFuer } from '../web/src/components/detail/verweise.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`)
}

const S1 = 'https://www.anisearch.de/anime/19329,gachiakuta'
const S2 = 'https://www.anisearch.de/anime/21122,gachiakuta-staffel-2'
const geliehen = { vonTeil: { id: 1 }, quelle: { name: 'anisearch.de', url: S1 } }
const eigen = { quelle: { name: 'anisearch.de', url: S2 } }
const gachiakuta2 = { id: 1, titleEn: 'X', anisearchId: 21122 } as unknown as Title

pruefe('geliehene Beschreibung: kein Ziel aus deren Quelle', eigenerAsZiel(geliehen, undefined) === undefined)
pruefe('geliehene Beschreibung: das Ziel der eigenen Seite bleibt', eigenerAsZiel(geliehen, S2) === S2)
pruefe('eigene aniSearch-Beschreibung: ihre Adresse gilt', eigenerAsZiel(eigen, undefined) === S2)
pruefe('eigener englischer Text von AniList: Ziel aus der eigenen Seite', eigenerAsZiel({ quelle: { url: 'https://anilist.co/anime/1' } }, S2) === S2)
pruefe('ohne Beschreibung: Ziel aus der eigenen Seite', eigenerAsZiel(undefined, S2) === S2)
pruefe(
  'Gachiakuta S2 mit geliehener Beschreibung verlinkt die eigene Kennung, nicht Staffel 1',
  verweiseFuer(gachiakuta2, eigenerAsZiel(geliehen, undefined))[0]?.ziel === 'https://www.anisearch.de/anime/21122',
)

if (fehler > 0) process.exit(1)
console.log('check-verweis-ziel: ok')
