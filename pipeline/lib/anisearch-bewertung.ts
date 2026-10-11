import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { ARCHIV_SEITEN } from './anisearch-relationen.ts'
import { SCHLAGWORT_LISTE, SCHLAGWORT_MAX } from '../../shared/schlagworte.ts'

/**
 * **Bewertung und Schlagworte aus einer archivierten aniSearch-Seite** (`data/anisearch-raw/<Kennung>.html.gz`, Daniel 11.10.2026: aniSearch statt AniList).
 *
 * Bewertung ist der „Klarwert“ in Prozent (`Klarwert<b>4.00 = 80%</b>`, der Fünf-Sterne-Mittelwert auf 100 umgerechnet); 0 % heißt keine Stimme.
 * Schlagworte sind die Tags (`href="anime/genre/tag/<kennung>"`) in der Reihenfolge der Seite, gefiltert durch die feste Liste (`shared/schlagworte.ts`).
 */
export type SeitenBewertung = { klarwert?: number; schlagworte: string[] }

/** Klarwert in Prozent oder `undefined` (kein Wert, 0 %). */
export function parseKlarwert(html: string): number | undefined {
  const prozent = Number(/Klarwert<b>[\d.]+ = (\d+)%/.exec(html)?.[1])
  return prozent > 0 ? prozent : undefined
}

/** Deutsche Anzeigenamen der erlaubten Tags dieser Seite, höchstens `SCHLAGWORT_MAX`. */
export function parseSchlagworte(html: string): string[] {
  const von = html.indexOf('<section id="genres-tags"')
  if (von < 0) return []
  const bis = html.indexOf('</section>', von)
  const namen: string[] = []
  for (const m of html.slice(von, bis < 0 ? undefined : bis).matchAll(/href="anime\/genre\/tag\/([a-z0-9_]+)"/g)) {
    const name = SCHLAGWORT_LISTE[m[1]!]
    if (name && !namen.includes(name)) namen.push(name)
  }
  return namen.slice(0, SCHLAGWORT_MAX)
}

let alle: Map<number, SeitenBewertung> | undefined

/** Bewertung und Schlagworte aller Archivseiten, einmal je Prozess gelesen (≈ 5 s für 17.500 Seiten, 11.10.2026). */
export function ladeBewertungen(dir = ARCHIV_SEITEN): Map<number, SeitenBewertung> {
  if (alle && dir === ARCHIV_SEITEN) return alle
  const karte = new Map<number, SeitenBewertung>()
  for (const datei of existsSync(dir) ? readdirSync(dir) : []) {
    const id = Number(datei.replace('.html.gz', ''))
    if (!Number.isInteger(id)) continue
    const html = gunzipSync(readFileSync(`${dir}/${datei}`)).toString('utf8')
    karte.set(id, { klarwert: parseKlarwert(html), schlagworte: parseSchlagworte(html) })
  }
  if (dir === ARCHIV_SEITEN) alle = karte
  return karte
}
