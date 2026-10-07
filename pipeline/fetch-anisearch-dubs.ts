/**
 * Holt aniSearchs Sprachangaben (`GET /v1/anime/dubs`) und reduziert sie auf das, was der Bau braucht: je Titel-Kennung von uns,
 * ob Deutsch vertont (`d`), geplant (`p`), abgebrochen (`c`) oder nicht genannt (`-`) ist.
 *
 * Anlass (Daniel, 06.10.2026, Handprüfung E/G): Zehn von zehn Titeln, bei denen aniSearch eine deutsche Ausgabe ohne Marke
 * „Synchronisiert" führt, hatten keine deutsche Tonspur — der Dub-Endpunkt bestätigte alle (14 von 14 Urteilen). Daraus folgt die
 * Regel in `bau/ohne-beleg.ts`. Ein Abruf je Stunde mit Token, ohne Token einer je 24 Stunden.
 *
 * Das Token steht in `ANISEARCH_TOKEN`; lokal liest das Skript es aus `my_secrets.md`. Ohne Browser-Kennung antwortet die API mit 423.
 *
 * Aufruf: `npx tsx pipeline/fetch-anisearch-dubs.ts`
 */
import { existsSync, readFileSync } from 'node:fs'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const GEHEIM = 'C:/code/ai/ai helper files/my_secrets.md'

type Sprachen = { dubbed?: string[]; planned?: string[]; canceled?: string[] }

function token(): string | undefined {
  if (process.env.ANISEARCH_TOKEN) return process.env.ANISEARCH_TOKEN
  if (!existsSync(GEHEIM)) return undefined
  const block = readFileSync(GEHEIM, 'utf8').split(/\n## /).find((b) => /aniSearch-API-Token/i.test(b))
  return /([A-Za-z0-9_|.-]{24,})/.exec(block?.split('\n').find((z) => /^-\s*Wert\s*:/i.test(z)) ?? '')?.[1]
}

export function deutschKennzeichen(s: Sprachen | undefined): 'd' | 'p' | 'c' | '-' {
  if (s?.dubbed?.includes('de')) return 'd'
  if (s?.planned?.includes('de')) return 'p'
  if (s?.canceled?.includes('de')) return 'c'
  return '-'
}

async function main(): Promise<void> {
  const t = token()
  const antwort = await fetch('https://api.anisearch.com/v1/anime/dubs', {
    headers: {
      ...(t ? { authorization: `Bearer ${t}` } : {}),
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      accept: 'application/json',
    },
  })
  if (!antwort.ok) {
    warn(`aniSearch-Dubs: HTTP ${antwort.status}`)
    recordSource('anisearch-dubs', 0, `HTTP ${antwort.status}`)
    return
  }
  const alle = (await antwort.json()) as Record<string, Sprachen>
  /* Unsere Titel-Kennung → aniSearch-Kennung; die Handdatei gilt vor der Brücke. */
  const unsere = new Map<string, string>()
  for (const [id, e] of Object.entries(readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {}))) if (e.anisearchId) unsere.set(id, String(e.anisearchId))
  for (const m of readFileSync('data/anisearch-ids-hand.yaml', 'utf8').matchAll(/^(\d+):\s*(\d+)/gm)) unsere.set(m[1]!, m[2]!)
  const aus: Record<string, string> = {}
  for (const [id, asId] of [...unsere].sort((a, b) => Number(a[0]) - Number(b[0]))) if (alle[asId]) aus[id] = deutschKennzeichen(alle[asId])
  /* Ein Abruf, der fast nichts liefert, ist kein Befund: der Bau würde sonst Titel ohne Eintrag als „nicht genannt" lesen. */
  if (Object.keys(alle).length < 10000) {
    warn(`aniSearch-Dubs: nur ${Object.keys(alle).length} Einträge, Datei bleibt unverändert`)
    recordSource('anisearch-dubs', 0, 'zu wenige Einträge')
    return
  }
  writeJson('data/anisearch-dubs.json', aus)
  log(`${Object.keys(alle).length} Einträge bei aniSearch, ${Object.keys(aus).length} von ${unsere.size} unserer Kennungen übernommen`)
  recordSource('anisearch-dubs', Object.keys(aus).length)
}

await main()
