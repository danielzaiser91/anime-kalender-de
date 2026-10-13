import { adressKern, dubKey, verschmelze, type DubCheck } from './dub-confirmed.ts'

/**
 * Anime: `verschmelze` vereint die Bereiche; eine jüngere Meldung überlagert nur die Folgen, die sie nennt. Belegt der
 * Endstand weniger deutsche Folgen, als eine frühere Meldung nannte, hat eine jüngere Meldung sie ausdrücklich verneint.
 */
export type Schrumpf = { schluessel: string; titel?: string; verloren: number[] }

function jaFolgen(e: DubCheck): Set<number> {
  const folgen = new Set<number>()
  for (const r of e.dubRanges ?? []) if (r.dub) for (let n = r.from; n <= r.to; n++) folgen.add(n)
  return folgen
}

/** Belege in Dateireihenfolge verschmelzen wie `loadDubChecks`; je Verweis zählt, was je als deutsch galt und am Ende fehlt. */
export function findeSchrumpf(belege: DubCheck[]): Schrumpf[] {
  const stand = new Map<string, DubCheck>()
  const jemals = new Map<string, Set<number>>()
  for (const b of belege) {
    if (!b?.anilistId || b.anilistId < 0 || !b.platform || !b.checkedAt) continue
    const schluessel = `${dubKey(b.anilistId, b.platform)}|${adressKern(b.url)}`
    const alt = stand.get(schluessel)
    stand.set(schluessel, alt ? verschmelze(alt, b) : b)
    const bisher = jemals.get(schluessel) ?? new Set<number>()
    for (const n of jaFolgen(b)) bisher.add(n)
    jemals.set(schluessel, bisher)
  }
  const faelle: Schrumpf[] = []
  for (const [schluessel, bisher] of jemals) {
    const heute = jaFolgen(stand.get(schluessel)!)
    const verloren = [...bisher].filter((n) => !heute.has(n)).sort((a, b) => a - b)
    if (verloren.length) faelle.push({ schluessel, titel: stand.get(schluessel)?.title, verloren })
  }
  return faelle
}
