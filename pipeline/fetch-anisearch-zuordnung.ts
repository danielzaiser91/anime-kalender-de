/**
 * Holt aniSearchs Brücke MAL → aniSearch (`GET /v1/anime/associated?source=myanimelist`, ein Abruf; ohne Token 1 je 24 h, mit Token 1 je Stunde)
 * und legt die eindeutigen Paare nach `data/anisearch-mal.json`. Der Bau ordnet damit Titeln ohne aniSearch-Kennung ihre Titelseite zu und
 * arbeitet so die Liste `data/anisearch-offen.json` ab (`pipeline/bau/anisearch-kennung.ts`). Kein Abruf von aniSearch-Seiten.
 *
 * Aufruf: `npx tsx pipeline/fetch-anisearch-zuordnung.ts`
 */
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { anisearchKopf, anisearchToken } from './lib/anisearch-api.ts'
import { eindeutigePaare } from './lib/anisearch-zuordnung.ts'

async function main(): Promise<void> {
  const antwort = await fetch('https://api.anisearch.com/v1/anime/associated?source=myanimelist', { headers: anisearchKopf(anisearchToken()) })
  if (!antwort.ok) {
    warn(`aniSearch-Zuordnung: HTTP ${antwort.status}${antwort.headers.get('retry-after') ? `, Retry-After ${antwort.headers.get('retry-after')}` : ''}`)
    recordSource('anisearch-zuordnung', 0, `HTTP ${antwort.status}`)
    return
  }
  const roh = (await antwort.json()) as Record<string, number[]>
  /* Ein Abruf, der fast nichts liefert, ist kein Befund: die Datei bliebe sonst leer, und alle Zuordnungen fielen weg. */
  if (Object.keys(roh).length < 10000) {
    warn(`aniSearch-Zuordnung: nur ${Object.keys(roh).length} Einträge, Datei bleibt unverändert`)
    recordSource('anisearch-zuordnung', 0, 'zu wenige Einträge')
    return
  }
  const paare = eindeutigePaare(roh)
  const vorher = Object.keys(readJson<Record<string, number>>('data/anisearch-mal.json', {})).length
  writeJson('data/anisearch-mal.json', paare)
  log(`${Object.keys(roh).length} MAL-Kennungen bei aniSearch, ${Object.keys(paare).length} eindeutig (vorher ${vorher})`)
  recordSource('anisearch-zuordnung', Object.keys(paare).length)
}

await main()
