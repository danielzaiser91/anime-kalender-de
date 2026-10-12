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

/** Ein Verweis, dessen Bereiche aus mehreren Meldungen vereint wurden: Ergebnis als Text, z. B. „1–3 ja, 4–24 nein“. */
export type Vereint = { schluessel: string; titel?: string; plattform: string; ergebnis: string }

/** Belege in Dateireihenfolge verschmelzen wie `loadDubChecks` und jeden Verweis nennen, dessen Bereiche aus mehreren Meldungen stammen. */
export function findeVereinte(belege: DubCheck[]): Vereint[] {
  const stand = new Map<string, DubCheck>()
  const vereint = new Map<string, Vereint>()
  for (const b of belege) {
    if (!b?.anilistId || !b.platform || !b.checkedAt) continue
    const schluessel = `${dubKey(b.anilistId, b.platform)}|${adressKern(b.url)}`
    const alt = stand.get(schluessel)
    const neu = alt ? verschmelze(alt, b) : b
    stand.set(schluessel, neu)
    if (alt?.dubRanges?.length && b.dubRanges?.length) {
      const ergebnis = (neu.dubRanges ?? []).map((r) => `${r.from}–${r.to} ${r.dub ? 'ja' : 'nein'}`).join(', ')
      vereint.set(schluessel, { schluessel, titel: b.title, plattform: b.platform, ergebnis })
    }
  }
  return [...vereint.values()]
}
