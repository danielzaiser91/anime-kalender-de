import { type Title } from '../../shared/types.ts'
import { log } from '../lib/util.ts'

/**
 * **Magenta führt Joyn und Disney+ nur durch** (Daniel, 04.10.2026): Was dort als Abo-Folgenseite (`/serie/-/GN_EP…`) steht, leitet an den Anbieter selbst weiter — diese Wege haben
 * schon ihre eigene Pille. Die Magenta-Pille daneben führt zur selben Folge, nur mit Umweg, und behauptet ein zweites Angebot, das keines ist.
 *
 * Gestrichen wird **eng**: nur die Folgenadresse mit Abo-Zugang, und nur wo der Titel einen Joyn- oder Disney+-Weg hat. Staffelübersichten (z. B. Tokyo Revengers Staffel 1, ProSieben fun
 * bleibt auf Magenta) und Kauf-/Leihseiten bleiben. Gemessen 05.10.2026: 162 Magenta-Verweise, davon 8 so.
 */
export function streicheMagentaPartner(titles: Map<number, Title>): number {
  let weg = 0
  for (const t of titles.values()) {
    if (!t.watchLinks?.length || !t.streams?.some((s) => s.platform === 'joyn' || s.platform === 'disneyplus')) continue
    const vorher = t.watchLinks.length
    t.watchLinks = t.watchLinks.filter((w) => !(/magenta\.tv\/serie\/-\/GN_EP/.test(w.url) && w.zugang === 'abo'))
    weg += vorher - t.watchLinks.length
    if (!t.watchLinks.length) delete t.watchLinks
  }
  if (weg) log(`${weg} MagentaTV-Folgenseiten gestrichen (Joyn/Disney+ haben eigene Pillen)`)
  return weg
}
