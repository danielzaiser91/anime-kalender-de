import { existsSync, readFileSync } from 'node:fs'

const GEHEIM = 'C:/code/ai/ai helper files/my_secrets.md'

/** Das Token der aniSearch-Database-API: `ANISEARCH_TOKEN`, lokal aus `my_secrets.md` (wird nie ausgegeben). */
export function anisearchToken(): string | undefined {
  if (process.env.ANISEARCH_TOKEN) return process.env.ANISEARCH_TOKEN
  if (!existsSync(GEHEIM)) return undefined
  const block = readFileSync(GEHEIM, 'utf8').split(/\n## /).find((b) => /aniSearch-API-Token/i.test(b))
  return /([A-Za-z0-9_|.-]{24,})/.exec(block?.split('\n').find((z) => /^-\s*Wert\s*:/i.test(z)) ?? '')?.[1]
}

/** Ohne Browser-Kennung antwortet die API mit 423 (gemessen 05.10.2026). */
export function anisearchKopf(token: string | undefined): Record<string, string> {
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    accept: 'application/json',
  }
}
