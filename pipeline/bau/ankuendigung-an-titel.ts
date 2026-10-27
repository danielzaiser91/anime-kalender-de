import type { Title } from '../../shared/types.ts'
import { ankuendigungenLaden } from '../lib/ankuendigungen.ts'
import { ladeKatalogEintraege } from '../lib/katalog-eingefroren.ts'
import { titelAusKatalogEintrag } from './katalog-titel.ts'
import { log } from '../lib/util.ts'

/**
 * **Die Ankündigung gehört vor Phase 10 an den Titel** (F70, 26.10.2026): `rolleTermineAus` und `frischAngekuendigt` lesen sie am Titel,
 * `mitAnkuendigung` (Phase 13) kam dafür zu spät. Ein Titel, dessen Anbieter die Synchro angekündigt hat (`angekuendigt`), der aber nur im
 * AniList-Katalog steht (Magic Knight Rayearth 2026: kein Termin, kein MyDubList-Eintrag), kommt aus dem Katalog in den Bestand —
 * sonst hätte die Regel nichts, das sie halten könnte. Eine Synchro-Aussage „offen“ holt niemanden herein.
 */
export function haengeAnkuendigungAn(titles: Map<number, Title>, jpStart: Map<number, string>, jpStartAnzeige: Map<number, string>, wurzel: string): void {
  const ankuendigungen = ankuendigungenLaden(wurzel)
  const fehlen = [...ankuendigungen].filter(([id, a]) => !titles.has(id) && a.synchro === 'angekuendigt')
  const katalog = fehlen.length ? new Map(ladeKatalogEintraege().map((e) => [e.id, e])) : new Map()
  for (const [id] of fehlen) {
    const e = katalog.get(id)
    if (!e) continue
    titles.set(id, { ...titelAusKatalogEintrag(e), ...(e.mal ? { malId: e.mal } : {}) })
    if (e.start) {
      jpStart.set(id, e.start)
      jpStartAnzeige.set(id, e.start)
    }
    log(`  Titel mit angekündigter Synchro aus dem Katalog ergänzt: ${id} (${e.t[0] ?? e.t[1]})`)
  }
  for (const [id, a] of ankuendigungen) {
    const t = titles.get(id)
    if (t) t.ankuendigung = a
  }
}
