import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

/**
 * **Beziehungen und Titel aus einer archivierten aniSearch-Seite** (`data/anisearch-raw/<Kennung>.html.gz`, Stufe C der AniList-Ablösung, 10.10.2026).
 * Parser aus der Messung Stufe A: Regex auf dem festen Markup (`<section id="relations">`, Stand der Archivseiten 10.10.2026), keine Abhängigkeiten.
 */
export const ARCHIV_SEITEN = 'data/anisearch-raw'

export type Relation = { art: string; medium: string; id: number; name: string }
export type Seite = {
  /** Titel je Sprachkennung (`ja`, `en`, `de` …) aus dem Informationsblock. */
  titel: string[]
  relationen: Relation[]
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&nbsp;': ' ', '&#126;': '~', '&#8209;': '-' }
const dekodiere = (s: string): string => s.replace(/&(?:amp|lt|gt|quot|nbsp|#039|#126|#8209);/g, (m) => ENTITIES[m] ?? m)

/** Inhalt von `<section id="…">` bis `</section>` (die Abschnitte schachteln nicht). */
function abschnitt(html: string, id: string): string | undefined {
  const i = html.indexOf(`<section id="${id}"`)
  if (i < 0) return undefined
  const j = html.indexOf('</section>', i)
  return html.slice(i, j < 0 ? undefined : j)
}

/** Die Relationen-Kästen einer Seite; Art steht deutsch (`Sequel`, `Nebengeschichte`, `?` …) im Kopf jedes Eintrags. */
export function parseRelationen(html: string): Relation[] {
  const rel = abschnitt(html, 'relations')
  if (!rel) return []
  const liste: Relation[] = []
  for (const li of rel.split('<li class="swiper-slide').slice(1)) {
    const a = /<a href="([a-z]+)\/(\d+)(?:,([^"]*))?" class="([a-z]+)-item">/.exec(li)
    if (!a) continue
    const art = /<div class="header">([^<]*)<\/div>/.exec(li)?.[1] ?? ''
    const name = /<span class="title">([^<]*)<\/span>/.exec(li)?.[1] ?? ''
    liste.push({ art: dekodiere(art).trim(), medium: a[1]!, id: Number(a[2]), name: dekodiere(name) })
  }
  return liste
}

/** Die Titel der Seite, einer je Sprache — für den Namensvergleich bei Beziehungen ohne Reihenart. */
export function parseTitel(html: string): string[] {
  const je = new Map<string, string>()
  for (const m of (abschnitt(html, 'information') ?? '').matchAll(/<div class="title" lang="([a-z]+)">[\s\S]*?<strong class="f16">([^<]*)<\/strong>/g)) {
    if (!je.has(m[1]!)) je.set(m[1]!, dekodiere(m[2]!).trim())
  }
  return [...je.values()]
}

/** Liest und entpackt eine Archivseite; `undefined`, wenn sie fehlt. */
export function leseSeite(anisearchId: number, dir = ARCHIV_SEITEN): Seite | undefined {
  const pfad = `${dir}/${anisearchId}.html.gz`
  if (!existsSync(pfad)) return undefined
  const html = gunzipSync(readFileSync(pfad)).toString('utf8')
  return { titel: parseTitel(html), relationen: parseRelationen(html) }
}
