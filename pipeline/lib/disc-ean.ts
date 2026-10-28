/**
 * **Kauflink einer Disc: Handlink > EAN-Suche > Namenssuche** (Daniel, 27.10.2026).
 *
 * Die Namenssuche bei Amazon findet für „Detektiv Conan – Box 1 (30th Anniversary Edition) Anime Blu-ray" 616 Treffer, die
 * Suche nach der EAN genau das Produkt. Die EAN steht in `data/anisearch-artikel.json`; die Ausgabe ordnet
 * `data/disc-ausgaben.json` dem Titel und Tag zu. Gilt nur, wenn die Zuordnung eindeutig ist (eine Ausgabe, ggf. in
 * mehreren Medien) — sonst bleibt es die Namenssuche.
 */
import { amazonEanUrl, amazonLinkArt, amazonSearchUrl } from '../../shared/plattform-suche.ts'
import { readJson } from './util.ts'
import type { Artikel } from './anisearch-artikel.ts'

export interface DiscAusgabeRoh {
  datum: string
  url?: string
  format?: string
  kurz?: string
}
export interface DiscIndex {
  ausgaben: Record<string, DiscAusgabeRoh[]>
  artikel: Record<string, Pick<Artikel, 'ean' | 'publisher' | 'umfang'>>
}

export const discIndexLaden = (): DiscIndex => ({
  ausgaben: readJson('data/disc-ausgaben.json', {}),
  artikel: readJson('data/anisearch-artikel.json', {}),
})

const istEan = (e: string | undefined): e is string => /^\d{8,14}$/.test(e ?? '')

/** Die EAN der Ausgabe von Titel und Tag — oder nichts, wenn mehrere verschiedene Ausgaben am selben Tag erscheinen. */
export function discEan(index: DiscIndex, titleId: number | undefined, datum: string): string | undefined {
  const treffer = (index.ausgaben[String(titleId)] ?? []).filter((a) => a.datum === datum)
  if (!treffer.length) return undefined
  const mitArtikel = treffer.map((a) => ({ a, art: index.artikel[/article\/(\d+)/.exec(a.url ?? '')?.[1] ?? ''] }))
  const schluessel = new Set(mitArtikel.map(({ a, art }) => `${a.kurz}|${art?.publisher}|${art?.umfang}`))
  if (schluessel.size !== 1) return undefined
  const eans = mitArtikel.filter(({ art }) => istEan(art?.ean))
  if (eans.length === 1) return eans[0]!.art!.ean
  const blurays = eans.filter(({ a }) => a.format === 'Blu-ray')
  return blurays.length === 1 ? blurays[0]!.art!.ean : undefined
}

export function discKaufUrl(
  entry: { buyUrl?: string; releaseType: string },
  titleId: number | undefined,
  datum: string,
  name: string,
  index: DiscIndex,
): string | undefined {
  if (entry.buyUrl || entry.releaseType !== 'disc') return entry.buyUrl
  const ean = discEan(index, titleId, datum)
  return ean ? amazonEanUrl(ean) : amazonSearchUrl(name)
}

/** Nach einer Terminverschiebung: eine Namenssuche wird zur EAN-Suche, wenn die Ausgabe am neuen Tag eindeutig ist; Handlinks und EAN-Links bleiben. */
export function buyUrlNachVerschiebung(buyUrl: string | undefined, titleId: number | undefined, nach: string, index: DiscIndex): string | undefined {
  if (amazonLinkArt(buyUrl) !== 'name') return buyUrl
  const ean = discEan(index, titleId, nach)
  return ean ? amazonEanUrl(ean) : buyUrl
}
