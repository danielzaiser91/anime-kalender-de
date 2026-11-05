import type { Title } from './types.ts'
import { hauptstaffeln, reihenAnfang, reihenVertreter, staffelStaende, type StaffelNummer } from './titles.ts'

/** Was die Zählung von einem Reihenteil braucht — `FranchiseMember` und die Pipeline-Titel (mit `name = anzeigeName`) passen beide. */
export type Zaehlteil = {
  id: number
  name: string
  format?: string
  episodes?: number
  jpYear?: number
  jpStart?: string
  jpSeason?: Title['jpSeason']
  staffelQuelle?: number
  remakeVon?: number
  beiwerk?: boolean
  eigenesWerk?: boolean
}

export type Hauptzaehlung<T extends Zaehlteil> = {
  /** Die Hauptstaffeln der Reihe (ohne Filme, Specials, Beiwerk, eigene Werke). */
  teile: T[]
  reihenName: string
  /** Staffelnummer je Teil wie im Panel (`staffelStaende`); leer bei nur einer Staffel. */
  staende: Map<number, StaffelNummer>
}

/**
 * **Die eine Staffelzählung einer Reihe**: Panel, Kachel-Marke, Widerlegung, Katalog und Disc-Verschiebung rechnen
 * hier `hauptstaffeln()` und `staffelStaende()` zusammen. Der Reihenname ist der des Panels (Anfang der Namen des
 * Vertreters).
 */
export function zaehleHauptstaffeln<T extends Zaehlteil>(reihe: T[]): Hauptzaehlung<T> {
  const teile = hauptstaffeln(reihe)
  if (!teile.length) return { teile, reihenName: '', staende: new Map() }
  const name = reihenAnfang(reihenVertreter(teile).name, teile.map((m) => m.name))
  return { teile, reihenName: name, staende: staffelStaende(teile, name) }
}

/** Die Staffelnummer von `id` in der Zählung der Reihe; `undefined`, wenn der Teil keine Hauptstaffel ist oder die Reihe nur eine hat. */
export function staffelStandVon<T extends Zaehlteil>(reihe: T[], id: number): StaffelNummer | undefined {
  return zaehleHauptstaffeln(reihe).staende.get(id)
}
