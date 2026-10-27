/**
 * Wache für Crunchyroll-Abwürfe (`releaseType: batch`, „Neu bei Crunchyroll“): Ein Abwurf behauptet, alle Folgen seien auf einmal
 * gekommen. Das belegen nur Folgen mit Datum — mehr Folgen zu behaupten, als belegt sind, ist falsch (Aoashi Staffel 2,
 * 26.10.2026: eine belegte Folge, „24 Folgen“, „Neu bei Crunchyroll“). Die Zahl der belegten Folgen steht in der Herkunft des
 * Termins (`crHerkunft`), gesetzt in `bau/09-4-4-termine.ts`.
 */
import type { Release } from '../../shared/types.ts'

/** Die Herkunftszeile eines abgeleiteten Crunchyroll-Termins; `belegteFolgen` liest sie zurück. */
export function crHerkunft(datiert: number, blockName: string): string {
  return `Deutsche Fassung bei Crunchyroll — ${datiert} Folgen mit belegtem Termin (Block „${blockName}“)`
}

/** Die belegten Folgen aus der Herkunftszeile, sonst `null`. */
export function belegteFolgen(herkunft: string | undefined): number | null {
  const m = /— (\d+) Folgen mit belegtem Termin/.exec(herkunft ?? '')
  return m ? Number(m[1]) : null
}

/** Abwürfe, die mehr Folgen behaupten, als die Ableitung belegt (ein Film mit 1 von 1 ist keiner). */
export function batchUeberBelegt(releases: Release[]): Release[] {
  return releases.filter((r) => {
    const belegt = belegteFolgen(r.herkunft)
    const zahl = r.schedule?.episodeCount
    return r.platform === 'crunchyroll' && r.releaseType === 'batch' && belegt !== null && zahl !== undefined && zahl > belegt
  })
}
