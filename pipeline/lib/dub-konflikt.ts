import { widerspruechlicheFolgen } from './dub-bereiche.ts'
import { adressKern, dubKey, verschmelze, type DubCheck } from './dub-confirmed.ts'

/** Zwei Meldungen vom selben Tag, die für dieselbe Folge Ja und Nein sagen; `verschmelze` lässt dort das Nein gelten. */
export type Konflikt = { schluessel: string; titel?: string; folgen: number[] }

/** Belege in Dateireihenfolge verschmelzen wie `loadDubChecks` und jeden Tagesgleichstand mit Widerspruch melden. */
export function findeKonflikte(belege: DubCheck[]): Konflikt[] {
  const stand = new Map<string, DubCheck>()
  const faelle: Konflikt[] = []
  for (const b of belege) {
    if (!b?.anilistId || !b.platform || !b.checkedAt) continue
    const schluessel = `${dubKey(b.anilistId, b.platform)}|${adressKern(b.url)}`
    const alt = stand.get(schluessel)
    if (alt && alt.checkedAt === b.checkedAt) {
      const folgen = widerspruechlicheFolgen(alt.dubRanges ?? [], b.dubRanges ?? [])
      if (folgen.length) faelle.push({ schluessel, titel: b.title, folgen })
    }
    stand.set(schluessel, alt ? verschmelze(alt, b) : b)
  }
  return faelle
}
