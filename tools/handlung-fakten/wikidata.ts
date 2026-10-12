/** Wikidata-Brücke: MAL-Kennung (P4086) und aniSearch-Kennung (P12477) → Wikipedia-Seiten des Werks (Sitelinks de/en). Ergebnisse, auch leere, liegen im Cache. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { CACHE, UA } from './typen.ts'
import type { Luecke } from './typen.ts'

export interface Seiten {
  de?: string
  en?: string
}
/** Schlüssel „mal:123“ oder „as:456“. */
export type Bruecke = Record<string, Seiten>

const BLOCK = 60
const PAUSE_MS = 2000
const BACKOFF_SEK = [30, 90, 240]
const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const malSchluessel = (id: number) => `mal:${id}`
export const asSchluessel = (id: number) => `as:${id}`

/** Alle Schlüssel, die für diese Titel (eigene und Geschwister) nachzuschlagen sind. */
export function schluesselVon(luecken: Luecke[]): string[] {
  const menge = new Set<string>()
  for (const l of luecken) {
    if (l.malId) menge.add(malSchluessel(l.malId))
    if (l.anisearchSeite) menge.add(asSchluessel(l.anisearchSeite))
    for (const g of l.geschwister) {
      if (g.malId) menge.add(malSchluessel(g.malId))
      if (g.anisearchSeite) menge.add(asSchluessel(g.anisearchSeite))
    }
  }
  return [...menge]
}

function abfrage(art: 'mal' | 'as', ids: string[]): string {
  const prop = art === 'mal' ? 'P4086' : 'P12477'
  return `SELECT ?k ?de ?en WHERE {
  VALUES ?k { ${ids.map((i) => `"${i}"`).join(' ')} }
  ?werk wdt:${prop} ?k .
  OPTIONAL { ?de schema:about ?werk ; schema:isPartOf <https://de.wikipedia.org/> }
  OPTIONAL { ?en schema:about ?werk ; schema:isPartOf <https://en.wikipedia.org/> }
}`
}

const seitenname = (url?: { value: string }) => (url ? decodeURIComponent(url.value.split('/wiki/')[1]!).replace(/_/g, ' ') : undefined)

async function einBlock(art: 'mal' | 'as', ids: string[], fetchFn: typeof fetch): Promise<Bruecke | undefined> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(abfrage(art, ids))}`
  for (let versuch = 0; versuch <= BACKOFF_SEK.length; versuch++) {
    try {
      const res = await fetchFn(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } })
      if (res.ok) return auswerten(art, ids, await res.json())
      console.log(`  Wikidata ${res.status} (Block ${art}, Versuch ${versuch + 1})`)
    } catch (e) {
      console.log(`  Wikidata-Netzfehler: ${(e as Error).message}`)
    }
    if (versuch < BACKOFF_SEK.length) await warte(BACKOFF_SEK[versuch]! * 1000)
  }
  return undefined
}

interface Treffer {
  results: { bindings: { k: { value: string }; de?: { value: string }; en?: { value: string } }[] }
}

/** Jede angefragte Kennung bekommt einen Eintrag, auch ohne Treffer (leer), damit sie nicht erneut gefragt wird. */
export function auswerten(art: 'mal' | 'as', ids: string[], daten: Treffer): Bruecke {
  const raus: Bruecke = Object.fromEntries(ids.map((i) => [`${art}:${i}`, {} as Seiten]))
  for (const b of daten.results.bindings) {
    const eintrag = raus[`${art}:${b.k.value}`]
    if (!eintrag) continue
    if (b.de) eintrag.de ??= seitenname(b.de)
    if (b.en) eintrag.en ??= seitenname(b.en)
  }
  return raus
}

/** Holt fehlende Schlüssel in 60er-Blöcken (2 s Pause). Ein Block, der auch nach Wiederholungen scheitert, bleibt ungefragt und wird beim nächsten Lauf nachgeholt. */
export async function ladeBruecke(schluessel: string[], fetchFn: typeof fetch = fetch, pfad = `${CACHE}/wikidata.json`): Promise<Bruecke> {
  mkdirSync(CACHE, { recursive: true })
  const bruecke: Bruecke = existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf8')) : {}
  for (const art of ['mal', 'as'] as const) {
    const offen = schluessel.filter((s) => s.startsWith(`${art}:`) && !(s in bruecke)).map((s) => s.slice(art.length + 1))
    for (let i = 0; i < offen.length; i += BLOCK) {
      const neu = await einBlock(art, offen.slice(i, i + BLOCK), fetchFn)
      if (neu) Object.assign(bruecke, neu)
      writeFileSync(pfad, JSON.stringify(bruecke))
      await warte(PAUSE_MS)
    }
  }
  return bruecke
}
