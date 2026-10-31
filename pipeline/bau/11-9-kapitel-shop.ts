import { log } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import { entferneKapitelShopWege } from '../lib/kapitel-shop-wege.ts'

/** Nach den Wegen aus JustWatch: Telekom-Shop-Wege „über TMDB" bei nummerierten Filmkapiteln fallen weg, gezählt und je Titel im Log. */
export function verwirfKapitelShopWege(titles: Map<number, Title>): void {
  const verworfen = entferneKapitelShopWege(titles.values())
  if (!verworfen.length) return
  const je = verworfen.map((v) => `${v.name} (${v.id}): ${v.weg}`).join('; ')
  log(`${verworfen.length} Telekom-Shop-Wege über TMDB bei nummerierten Filmkapiteln verworfen — Ziel nicht prüfbar: ${je}`)
}
