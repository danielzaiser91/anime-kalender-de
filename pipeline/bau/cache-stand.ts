import { readJson, log, warn } from '../lib/util.ts'

interface RegisterEintrag {
  bauBraucht: boolean
  fehlt: string
}

/**
 * Zählt, was der Bau aus `data/cache/` mitbringt, und sagt es laut, wenn eine Datei leer oder
 * ohne Einträge ist: Mehrere Leser fallen still auf `{}` zurück, ein leerer Cache sah im Log
 * sonst aus wie ein gesunder Bau. Welche Dateien gelten, steht in `data/cache-register.json`.
 */
export function meldeCacheStand(): void {
  const register = readJson<{ dateien?: Record<string, RegisterEintrag> }>('data/cache-register.json', {}).dateien ?? {}
  const zahlen: string[] = []
  for (const [name, e] of Object.entries(register)) {
    if (!e.bauBraucht) continue
    const inhalt = readJson<unknown>(`data/cache/${name}`, null)
    const n = zaehle(inhalt)
    zahlen.push(`${name} ${n}`)
    if (n === 0) warn(`Cache ${name} fehlt oder ist leer — ${e.fehlt}`)
  }
  log(`Cache-Stand (Einträge): ${zahlen.join(', ')}`)
}

function zaehle(inhalt: unknown): number {
  if (Array.isArray(inhalt)) return inhalt.length
  if (inhalt && typeof inhalt === 'object') {
    const eintraege = (inhalt as { eintraege?: unknown }).eintraege
    return Array.isArray(eintraege) ? eintraege.length : Object.keys(inhalt).length
  }
  return 0
}
