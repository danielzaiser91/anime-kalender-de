import { deutscheBereicheSeit } from '../bau/widerlegung-woche.ts'
import type { CrDubData } from './crunchyroll-dub.ts'

const folgenVon = (b: { from: number; to: number }): number[] => Array.from({ length: Math.max(0, b.to - b.from + 1) }, (_, i) => b.from + i)

/** Alle Folgennummern, die der Katalog für die Staffel der Serie unter `url` deutsch führt (ohne Datumsgrenze). */
export function belegteFolgen(crDub: CrDubData, url: string | undefined, staffel: number | undefined): Set<number> {
  if (staffel === undefined) return new Set()
  return new Set(deutscheBereicheSeit(crDub, url, '', staffel).flatMap(folgenVon))
}

/** Jeder Bereich ist deutsch (`dub`), nicht leer und jede seiner Folgen ist belegt. */
export function bereicheBelegt(bereiche: { from: number; to: number; dub?: boolean }[], belegt: Set<number>): boolean {
  return bereiche.every((r) => r.dub === true && r.to >= r.from && folgenVon(r).every((n) => belegt.has(n)))
}
