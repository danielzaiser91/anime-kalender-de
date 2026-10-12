import { log } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import { deutscheFolgenNachDemEnde, type CrDubData } from '../lib/crunchyroll-dub.ts'

/**
 * **Ein Crunchyroll-Verweis nennt seine deutschen Folgen, wo der Bestand sie kennt.**
 * Black Clover stand als „155 von 170 Folgen auf Deutsch · Für die übrigen fehlt uns
 * eine Angabe", weil nur Netflix Bereiche trug — Crunchyroll führt alle 170 deutsch
 * (vier Blöcke, 1–170). Die Stichprobe vom 16.09.2026 fand dasselbe bei JoJo und My
 * Hero Academia 4. Gesetzt wird nur bei einem Verweis, der genau einen Titel bedient,
 * und nur bei eindeutiger Zählung (keine Nummer doppelt, keine über der Folgenzahl):
 * gemessen 160 Verweise, 157 vollständig.
 */
export function setzeCrBereiche(titles: Map<number, Title>, crDub: CrDubData): void {
  const crDubNachUrl = new Map(crDub.serien.filter((s) => s.katalog === 'de').map((s) => [s.url, s]))
  let crBereiche = 0
  for (const title of titles.values()) {
    for (const s of title.streams) {
      if (s.platform !== 'crunchyroll' || s.dub !== true || s.dubRanges?.length || s.sharedWith) continue
      const serie = crDubNachUrl.get(s.url)
      if (deutscheFolgenNachDemEnde(serie?.staffeln ?? [], title.episodes)) continue
      const nummern = (serie?.staffeln ?? [])
        .flatMap((st) => (st.deutscheFolgen ?? []).map((f) => f.nummer))
        .filter((n): n is number => Number.isInteger(n) && (n as number) > 0)
      if (!nummern.length || !title.episodes) continue
      if (new Set(nummern).size !== nummern.length || Math.max(...nummern) > title.episodes) continue
      const sortiert = [...nummern].sort((a, b) => a - b)
      const bereiche: { from: number; to: number; dub: boolean }[] = []
      for (const n of sortiert) {
        const letzter = bereiche[bereiche.length - 1]
        if (letzter && letzter.to === n - 1) letzter.to = n
        else bereiche.push({ from: n, to: n, dub: true })
      }
      s.dubRanges = bereiche
      crBereiche++
    }
  }
  if (crBereiche) log(`${crBereiche} Crunchyroll-Verweise mit ihren deutschen Folgen aus dem Bestand`)
}
