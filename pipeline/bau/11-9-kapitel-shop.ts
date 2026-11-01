import { log } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import { entferneKapitelShopWege, ladeShopWegeFalsch, type ShopWegFalsch } from '../lib/kapitel-shop-wege.ts'

/** Nach den Wegen aus JustWatch: Wege der Handliste fallen weg, gezählt und je Titel im Log; gibt die Zählzeile zurück (leer, wenn nichts fiel). */
export function verwirfKapitelShopWege(
  titles: Map<number, Title>,
  liste: ShopWegFalsch[] = ladeShopWegeFalsch(),
  melde: (zeile: string) => void = log,
): string {
  const verworfen = entferneKapitelShopWege(titles.values(), liste)
  if (!verworfen.length) return ''
  const je = verworfen.map((v) => `${v.name} (${v.id}): ${v.weg}`).join('; ')
  const zeile = `${verworfen.length} Telekom-Shop-Wege über TMDB mit belegt falschem Ziel verworfen: ${je}`
  melde(zeile)
  return zeile
}
