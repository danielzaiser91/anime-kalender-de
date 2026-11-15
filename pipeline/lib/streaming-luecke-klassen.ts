/**
 * Titel ohne Streaming-Weg nach Klassen (Bericht `streaming-restluecke-2026-11-15.md`, Zählskript des Analysten): erste zutreffende Klasse gilt,
 * die Summe der Klassen ist die Zahl der Titel ohne Streaming-Weg. Die Klasse sagt, ob ein vorhandener Sammler den Weg holen kann.
 *
 * A1 JustWatch-Abo da, Bau übernimmt nicht (a: Handbeleg-Nein, b: nur Amazon Channel, c: ohne deutschen Ton, x: deutscher Ton ohne Grund = Fehler)
 * A3 aniSearch-Stream da (a: Handbeleg-Nein, b: Dienst bekannt/Link unbestätigt, c: nur unbekannter Dienst, d: nur YouTube)
 * K  angekündigt oder Kino · B1/B2 keine TMDB-Kennung (Einzelwerk / übrige) · C1 JW ohne Treffer · C2 JW ohne Angebot · C3 JW nur Disc/Kauf/Leihe · C4 sonst
 */
import type { Title } from '../../shared/types.ts'

export type TitelFuerKlasse = Pick<Title, 'id' | 'ankuendigung' | 'jpYear' | 'jpEnd' | 'format' | 'episodes'>

export interface JwEintrag {
  tmdbId?: number
  ohneTreffer?: boolean
  angebote?: { art: string; anbieter: string; audio?: string[] }[]
}

export interface LueckenQuellen {
  /** `data/justwatch-audio.json`, Schlüssel Titelkennung. */
  jw: Record<string, JwEintrag | undefined>
  /** `data/tmdb-titles.json`. */
  tmdb: Record<string, { tmdbId?: number } | undefined>
  /** `data/anisearch.json`. */
  anisearch: Record<string, { streams?: { provider: string }[] } | undefined>
  /** Kennungen aus `data/verweise-entfernt.json` (belegtes Nein). */
  verweiseEntfernt: ReadonlySet<number>
  /** `anilistId` der Funde aus `data/tmdb-kino.json`. */
  kino: ReadonlySet<number>
}

/** Reihenfolge der Ausgabe. */
export const LUECKEN_KLASSEN = ['A1a', 'A1b', 'A1c', 'A1x', 'A3a', 'A3b', 'A3c', 'A3d', 'K', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4'] as const
export type LueckenKlasse = (typeof LUECKEN_KLASSEN)[number]

const ABO = new Set(['FLATRATE', 'FREE', 'ADS', 'FAST'])
const KAUF = new Set(['BUY', 'RENT', 'CINEMA'])
const PHYS = /videobuster|amazon dvd|thalia|justwatch tv|dvd|blu-ray|bluray|e-sixt|buch|bookbeat|kindle/i
/** Dienste, die `09-6-anisearch-wege.ts` auf einen Weg abbildet. */
const BEKANNT = new Set(['adn-de', 'netflix', 'primevideo', 'prime', 'crunchyroll', 'disneyplus', 'joyn', 'rtlplus', 'wakanim'])
const EINZELWERK = new Set(['ONA', 'OVA', 'SPECIAL', 'MOVIE', 'TV_SHORT'])

function klasseAnisearch(provider: string[], nein: boolean): LueckenKlasse {
  if (nein) return 'A3a'
  if (provider.every((p) => p === 'youtube')) return 'A3d'
  const fremd = provider.some((p) => !BEKANNT.has(p) && p !== 'youtube')
  return fremd && !provider.some((p) => BEKANNT.has(p)) ? 'A3c' : 'A3b'
}

export function klasseDerLuecke(t: TitelFuerKlasse, q: LueckenQuellen): LueckenKlasse {
  const id = String(t.id)
  const j = q.jw[id]
  const angebote = j?.angebote ?? []
  const nein = q.verweiseEntfernt.has(t.id)
  const abo = angebote.filter((a) => ABO.has(a.art) && !/justwatch tv/i.test(a.anbieter))
  if (abo.length) {
    if (nein) return 'A1a'
    if (!abo.some((a) => (a.audio ?? []).includes('de'))) return 'A1c'
    return abo.every((a) => /Amazon Channel/i.test(a.anbieter)) ? 'A1b' : 'A1x'
  }
  const as = q.anisearch[id]?.streams ?? []
  if (as.length) return klasseAnisearch(as.map((s) => s.provider), nein)
  if (t.ankuendigung || q.kino.has(t.id) || angebote.some((a) => a.art === 'CINEMA') || ((t.jpYear ?? 0) >= 2026 && !t.jpEnd)) return 'K'
  if (!(q.tmdb[id]?.tmdbId || j?.tmdbId)) return EINZELWERK.has(t.format ?? '') && (t.episodes ?? 1) <= 1 ? 'B1' : 'B2'
  if (j?.ohneTreffer) return 'C1'
  if (!angebote.length) return 'C2'
  return angebote.every((a) => PHYS.test(a.anbieter) || KAUF.has(a.art)) ? 'C3' : 'C4'
}

/** Anzahl je Klasse über die übergebenen Titel (die Titel ohne Streaming-Weg). */
export function zaehleLueckenKlassen(titel: TitelFuerKlasse[], q: LueckenQuellen): Record<LueckenKlasse, number> {
  const n = Object.fromEntries(LUECKEN_KLASSEN.map((k) => [k, 0])) as Record<LueckenKlasse, number>
  for (const t of titel) n[klasseDerLuecke(t, q)]++
  return n
}

/** Eine Logzeile; die Summe steht dabei, damit sie gegen „ohne Streaming-Weg“ gehalten werden kann. */
export function lueckenKlassenZeile(n: Record<LueckenKlasse, number>): string {
  const teile = LUECKEN_KLASSEN.filter((k) => n[k] > 0).map((k) => `${k} ${n[k]}`)
  return `Streaming-Lücke nach Klassen: ${teile.join(', ')} (Summe ${LUECKEN_KLASSEN.reduce((s, k) => s + n[k], 0)})`
}
