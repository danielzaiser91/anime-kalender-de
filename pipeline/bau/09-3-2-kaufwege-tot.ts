import { log } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'

/**
 * Auch Kaufwege können ins Leere führen.
 *
 * Die Bereinigung fasste bis zum 20.08.2026 nur `streams` an. In den
 * `watchLinks` standen daneben **188** Adressen, die mit 404 oder einer
 * Regionssperre antworten — dieselbe Prüfung, dieselben Befunde, nur nie
 * angewendet. Aufgefallen ist es, weil Daniel einen Kaufweg anklickte, der
 * nicht funktionierte.
 */
export function entferneToteKaufwege({ titles, linkBefunde }: {
  titles: Map<number, Title>
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
}) {
  let kaufwegeEntfernt = 0
  for (const title of titles.values()) {
    if (!title.watchLinks?.length) continue
    const vorher = title.watchLinks.length
    title.watchLinks = title.watchLinks.filter((w) => {
      const s = linkBefunde[w.url]?.status
      return !(s === 404 || s === 'region')
    })
    kaufwegeEntfernt += vorher - title.watchLinks.length
    if (!title.watchLinks.length) delete title.watchLinks
  }
  if (kaufwegeEntfernt) log(`${kaufwegeEntfernt} Kaufwege entfernt: die Seite dahinter ist weg oder hier gesperrt`)
}
