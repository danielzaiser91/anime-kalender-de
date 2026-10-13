import { log } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import { kennzeichneFreenet, schwesterFehler } from '../lib/schwester-shop.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'

/** Zuletzt in den Wegen (nach allen Urteilen der Schwester-Shops): freenet bekommt „Deutsch laut Schwester-Shop", wo die Regel greift. */
export function kennzeichneFreenetLautSchwester(titles: Map<number, Title>): void {
  let gekennzeichnet = 0
  for (const t of titles.values()) gekennzeichnet += kennzeichneFreenet(t.watchLinks ?? [])
  if (gekennzeichnet) log(`${gekennzeichnet} freenet-Wege als „Deutsch laut Schwester-Shop" gekennzeichnet`)
  brichAbBeiWiderspruch(schwesterFehler(titles.values()), 'freenet-Wege mit unzulässiger Schwester-Shop-Kennzeichnung — nichts geschrieben.')
}
