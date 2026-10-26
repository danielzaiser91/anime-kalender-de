import type { Title } from '../../shared/types.ts'
import { anzeigeName, hauptstaffeln, staffelStaende } from '../../shared/titles.ts'

/**
 * Die Staffelnummer eines Titels in seiner Reihe, so wie das Panel sie zählt (`staffelStaende`) — auch für eine
 * Staffel ohne bekannte Folgenzahl. `undefined`, wenn der Titel keine Hauptstaffel ist, die Reihe nur eine hat
 * oder der Titel nur ein Teil einer Staffel ist (Cour 2): dort trägt die Nummer die Folgen nicht.
 */
export function staffelDesTitels(t: Title, titles: Iterable<Title>): number | undefined {
  if (t.franchiseId === undefined) return undefined
  const reihe = [...titles].filter((x) => x.franchiseId === t.franchiseId)
  const teile = reihe.map((x) => ({
    id: x.id,
    name: anzeigeName(x),
    format: x.format,
    episodes: x.episodes,
    jpYear: x.jpYear,
    jpStart: x.jpStart,
  }))
  const kopf = reihe.find((x) => x.id === t.franchiseId) ?? reihe[0]!
  const stand = staffelStaende(hauptstaffeln(teile), anzeigeName(kopf)).get(t.id)
  return stand && stand.teil === undefined ? stand.staffel : undefined
}

/** „Staffel 3“ / „Season 3“ am Ende des Staffelnamens im Katalog. */
export const STAFFEL_IM_NAMEN = /(?:staffel|season)\s+(\d+)\s*$/i
