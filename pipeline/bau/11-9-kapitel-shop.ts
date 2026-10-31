import { log } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import { entferneKapitelShopWege, kapitelShopFehler } from '../lib/kapitel-shop-wege.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'

/** Nach den Wegen aus JustWatch: Telekom-Shop-Wege „über TMDB" bei nummerierten Filmkapiteln fallen weg, gezählt und je Titel im Log. */
export function verwirfKapitelShopWege(titles: Map<number, Title>): void {
  const verworfen = entferneKapitelShopWege(titles.values())
  if (!verworfen.length) return
  const je = verworfen.map((v) => `${v.name} (${v.id}): ${v.weg}`).join('; ')
  log(`${verworfen.length} Telekom-Shop-Wege über TMDB bei nummerierten Filmkapiteln verworfen — Ziel nicht prüfbar: ${je}`)
}

/** Ganz zuletzt in den Wegen: Kein später angelegter Weg darf die Regel umgehen. */
export function sichereKapitelShopWege(titles: Map<number, Title>): void {
  brichAbBeiWiderspruch(kapitelShopFehler(titles.values()), 'Telekom-Shop-Wege über TMDB bei nummerierten Filmkapiteln — nichts geschrieben.')
}
