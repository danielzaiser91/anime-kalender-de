/**
 * Der Rückweg von einem gemeldeten Namen zu unseren Kennungen (aus `fetch-pruefungen.ts` herausgelöst, Ausgabe unverändert).
 *
 * Nur für Meldungen, deren Adresse nichts trifft — und nur als Vorschlag, außer der Name stimmt **genau** auf genau einen Titel.
 */
import { titelSchluessel } from './zuordnung.ts'

export interface NamensTreffer {
  /** Die gefundenen Kennungen, ohne Doppelte. */
  treffer: number[]
  /** Genau ein Titel, und sein deutscher (sonst englischer) Name ist der gemeldete — da gibt es nichts zu entscheiden. */
  exakt: boolean
}

/**
 * Erst exakt, dann als Anfang eines längeren Namens („magi" findet „magi the labyrinth of magic", nicht „imagination";
 * Daniel, 23.08.2026, „Magi – Netflix"). `unserName` nennt den Namen, mit dem wir den Titel führen.
 */
export function ratePerName(name: string, nachTitel: Map<string, number[]>, unserName: (id: number) => string): NamensTreffer {
  const schluessel = name ? titelSchluessel(name) : ''
  let geraten = schluessel ? (nachTitel.get(schluessel) ?? []) : []
  if (!geraten.length && schluessel.length >= 4) {
    for (const [k, ids] of nachTitel) {
      if (k === schluessel || k.startsWith(schluessel + ' ')) geraten = [...geraten, ...ids]
    }
  }
  const treffer = [...new Set(geraten)]
  const unser = treffer.length === 1 ? unserName(treffer[0]!) : ''
  return { treffer, exakt: Boolean(unser) && titelSchluessel(name) === titelSchluessel(unser) }
}
