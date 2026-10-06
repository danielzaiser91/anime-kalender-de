/**
 * Holt die URL-Slugs der aniSearch-Titelseiten (`GET /v1/anime/slugs`, Kennung → Slug).
 *
 * Anlass (Dominik, aniSearch, 06.10.2026): Quellenlinks an übernommenen Beschreibungen sollen direkt auf die kanonische Titelseite
 * `anime/<Kennung>,<Slug>` führen; sonst wird jeder Besucher einmal umgeleitet. Der Endpunkt hat ein eigenes Limit (ein Abruf je Stunde
 * mit Token), liefert alle rund 30.000 Titel auf einmal und wird hier auf die Kennungen reduziert, die wir führen.
 *
 * Das Token steht in `ANISEARCH_TOKEN`; lokal liest das Skript es aus `my_secrets.md`, ohne es auszugeben. Ohne Browser-Kennung
 * antwortet die API mit 423 (gemessen 05.10.2026).
 *
 * Aufruf: `npx tsx pipeline/fetch-anisearch-slugs.ts`
 */
import { existsSync, readFileSync } from 'node:fs'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const GEHEIM = 'C:/code/ai/ai helper files/my_secrets.md'

function token(): string | undefined {
  if (process.env.ANISEARCH_TOKEN) return process.env.ANISEARCH_TOKEN
  if (!existsSync(GEHEIM)) return undefined
  const block = readFileSync(GEHEIM, 'utf8').split(/\n## /).find((b) => /aniSearch-API-Token/i.test(b))
  return /([A-Za-z0-9_|.-]{24,})/.exec(block?.split('\n').find((z) => /^-\s*Wert\s*:/i.test(z)) ?? '')?.[1]
}

async function main(): Promise<void> {
  const t = token()
  const antwort = await fetch('https://api.anisearch.com/v1/anime/slugs', {
    headers: {
      ...(t ? { authorization: `Bearer ${t}` } : {}),
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      accept: 'application/json',
    },
  })
  if (!antwort.ok) {
    warn(`aniSearch-Slugs: HTTP ${antwort.status}`)
    recordSource('anisearch-slugs', 0, `HTTP ${antwort.status}`)
    return
  }
  const alle = (await antwort.json()) as Record<string, string>
  const unsere = new Set<string>()
  for (const e of Object.values(readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {}))) if (e.anisearchId) unsere.add(String(e.anisearchId))
  for (const m of readFileSync('data/anisearch-ids-hand.yaml', 'utf8').matchAll(/^\d+:\s*(\d+)/gm)) unsere.add(m[1]!)
  const aus: Record<string, string> = {}
  for (const id of [...unsere].sort((a, b) => Number(a) - Number(b))) if (alle[id]) aus[id] = alle[id]
  writeJson('data/anisearch-slugs.json', aus)
  log(`${Object.keys(alle).length} Slugs bei aniSearch, ${Object.keys(aus).length} von ${unsere.size} unserer Kennungen übernommen`)
  recordSource('anisearch-slugs', Object.keys(aus).length)
}

await main()
