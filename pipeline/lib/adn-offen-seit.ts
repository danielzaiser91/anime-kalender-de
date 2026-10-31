/**
 * Wie lange eine ADN-Serie schon offen ist (31.10.2026).
 *
 * `data/adn-anisearch-offen.json` trägt absichtlich kein Datum (sonst täglich ein Commit). Das Datum der ersten Sichtung je Serie steht
 * deshalb in `data/adn-offen-seit.json` (`{ "887": "2026-10-31" }`); die Datei ändert sich nur, wenn eine Serie dazukommt oder geht.
 * Eine laufende Serie (Folge in den letzten 14 Tagen oder noch kommend), die länger als 3 Tage offen ist, bekommt eine Warnung:
 * Besucher haben dann einen Termin, der im Kalender fehlt.
 */
import { addDays } from '../../shared/time.ts'

/** Eine Serie gilt als laufend, wenn ihre jüngste Folge höchstens so viele Tage zurückliegt. */
export const LAUFEND_TAGE = 14
/** Ab so vielen Tagen ohne Zuordnung warnt die Wache (3 Tage dürfen es sein, der 4. Tag warnt). */
export const WARNUNG_NACH_TAGEN = 3

export type OffenSeit = Record<string, string>

/** Behält das Datum der Serien, die offen bleiben, trägt neue mit `heute` ein und streicht gelöste. */
export function aktualisiereOffenSeit(alt: OffenSeit, offeneIds: number[], heute: string): OffenSeit {
  const neu: OffenSeit = {}
  for (const id of [...offeneIds].sort((a, b) => a - b)) neu[String(id)] = alt[String(id)] ?? heute
  return neu
}

export type OffeneSerie = { showId: number; title: string }
export type OffenLage = {
  heute: string
  /** Erste Sichtung je Serie (`aktualisiereOffenSeit`). */
  seit: OffenSeit
  /** Datum der jüngsten Folge je Serienkennung. */
  letzteFolge: Map<number, string>
  /** Serienkennungen, die schon einem Titel (Cartoon der Handliste) zugeordnet sind. */
  zugeordnet: Set<number>
}

function tageZwischen(von: string, bis: string): number {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 864e5)
}

/** Laufende offene Serien, die seit mehr als `WARNUNG_NACH_TAGEN` Tagen ohne Zuordnung sind, mit der Zahl der Tage. */
export function laufendOhneZuordnung(offen: OffeneSerie[], lage: OffenLage): { showId: number; title: string; tage: number }[] {
  const raus: { showId: number; title: string; tage: number }[] = []
  for (const s of offen) {
    const letzte = lage.letzteFolge.get(s.showId)
    const seit = lage.seit[String(s.showId)]
    if (!letzte || !seit || lage.zugeordnet.has(s.showId)) continue
    if (letzte < addDays(lage.heute, -LAUFEND_TAGE)) continue
    const tage = tageZwischen(seit, lage.heute)
    if (tage > WARNUNG_NACH_TAGEN) raus.push({ showId: s.showId, title: s.title, tage })
  }
  return raus
}
