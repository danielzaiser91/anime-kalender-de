/**
 * aniSearch-Amazon-Adressen für die Link-Prüfung.
 *
 * Stand 12.11.2026: Wege wie Ragna Crimson (B0F1XK58VQ: Prime-Handbeleg, kein Stream, tote
 * Seite ohne Befund) kamen nie in die Schlange, weil aniSearch-Adressen nur bei Titeln mit
 * Prime-**Such**-Stream geprüft wurden. Jetzt kommt jede solche Adresse hinein — aber nur,
 * wenn ihre ASIN nicht schon unter anderer Form (Stream `/gp/video/detail/ASIN`, Bestand) in
 * der Schlange steht: aniSearch führt `/dp/ASIN`, der Bestand dieselbe Seite als
 * `/gp/video/detail/ASIN` (1166 Adressen, 827 davon mit schon geprüfter ASIN, Checkout f29ca0dbc).
 * `vorrang` (zuerst dran) bleibt den Titeln mit Suchadresse vorbehalten, deren Suche sie ablösen
 * könnte; die übrigen neuen Adressen (`zusatz`) sind je Lauf begrenzt (`begrenzeZusatz`).
 */
import type { Title } from '../../shared/types.ts'
import { AMAZON_VIDEO, SUCHADRESSE } from './amazon-adresse.ts'

export type AniSearchStreams = Record<string, { streams?: Array<{ url?: string }> }>

/** Zusätzliche, nie geprüfte Adressen je Lauf; Altbefunde behalten so ihre Plätze (Limit 400 im Wochenlauf). */
export const ZUSATZ_JE_LAUF = 40

const ASIN = /\/(?:gp\/video\/detail|dp)\/([A-Z0-9]{10,26})(?=[/?#]|$)/

function kennungen(urls: Iterable<string>): Set<string> {
  const k = new Set<string>()
  for (const u of urls) {
    const a = ASIN.exec(u)?.[1]
    if (a) k.add(a)
  }
  return k
}

/** `bekannt`: alle Adressen, die ohnehin geprüft werden (Bestand, Streams, watchLinks). */
export function aniSearchAmazon(
  titles: Pick<Title, 'id' | 'streams'>[],
  anisearch: AniSearchStreams,
  bekannt: ReadonlySet<string> = new Set(),
): { zusatz: Set<string>; vorrang: Set<string> } {
  const gesehen = kennungen(bekannt)
  const zusatz = new Set<string>()
  const vorrang = new Set<string>()
  for (const t of titles) {
    const sucht = (t.streams ?? []).some((s) => s.platform === 'primevideo' && SUCHADRESSE.test(s.url))
    for (const s of anisearch[String(t.id)]?.streams ?? []) {
      const u = s.url?.split('?')[0]
      if (!u || !AMAZON_VIDEO.test(u)) continue
      if (sucht) vorrang.add(u)
      else if (!bekannt.has(u)) zusatz.add(u)
    }
  }
  const neu = new Set<string>()
  for (const u of zusatz) {
    const a = ASIN.exec(u)?.[1]
    if (vorrang.has(u) || (a && gesehen.has(a))) continue
    if (a) gesehen.add(a)
    neu.add(u)
  }
  return { zusatz: neu, vorrang }
}

/** Lässt von den fälligen Adressen höchstens `max` Zusatzadressen übrig; alles andere bleibt. */
export function begrenzeZusatz(offen: string[], zusatz: ReadonlySet<string>, max: number): string[] {
  let n = 0
  return offen.filter((u) => !zusatz.has(u) || ++n <= max)
}
