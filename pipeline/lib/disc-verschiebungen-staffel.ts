/**
 * Disc-Verschiebungen über die Staffelnummer: „Sailor Moon – Staffel 3" im Anime2You-Artikel ist bei uns
 * (und bei aniSearch) „Sailor Moon S". Der Name allein führt nicht hin (`disc-verschiebungen.ts`), die
 * Nummer der Staffel in ihrer Reihe schon — aber nur, wo zwei unabhängige Zählweisen sie gleich nennen.
 */
import type { Title } from '../../shared/types.ts'
import { anzeigeName, hauptstaffeln, staffelStaende } from '../../shared/titles.ts'
import { staffelnDesFranchise } from './adn.ts'

/** „Reihenname staffel N" am Ende eines `discSchluessel()`; Zusätze wie „vol. 2" passen nicht. */
const STAFFEL_SCHLUESSEL = /^(.+) staffel (\d+)$/

/** Alle Titel je Reihe (`franchiseId`), einmal je Bau. */
export function reihenIndex(titel: Iterable<Title>): Map<number, Title[]> {
  const index = new Map<number, Title[]>()
  for (const t of titel) {
    if (t.franchiseId === undefined) continue
    index.set(t.franchiseId, [...(index.get(t.franchiseId) ?? []), t])
  }
  return index
}

/**
 * Die Staffelnummer eines Titels in seiner Reihe, sonst `undefined`. Gezählt wird zweimal: nach Position
 * der Fernsehstaffeln (`staffelnDesFranchise`) und so, wie das Panel „Staffel N von M" zählt
 * (`staffelStaende`). Nennen beide nicht dieselbe Zahl, hat die Reihe Teile, Beiwerk oder gleichzeitige
 * Starts — dann ist die Nummer mehrdeutig und wird nicht verwendet.
 */
export function staffelNummer(t: Title, reihen: Map<number, Title[]>): number | undefined {
  if (t.franchiseId === undefined) return undefined
  const lauf = staffelnDesFranchise(reihen.get(t.franchiseId) ?? [], t.franchiseId)
  const stelle = lauf.findIndex((x) => x.id === t.id) + 1
  if (!stelle) return undefined
  const teile = lauf.map((x) => ({ id: x.id, name: anzeigeName(x), format: x.format, episodes: x.episodes, jpYear: x.jpYear, jpStart: x.jpStart }))
  const kopf = reihen.get(t.franchiseId)!.find((x) => x.id === t.franchiseId) ?? lauf[0]!
  const stand = staffelStaende(hauptstaffeln(teile), anzeigeName(kopf)).get(t.id)
  return stand && stand.teil === undefined && stand.staffel === stelle ? stelle : undefined
}

/**
 * Die Kette zu „<Reihe> Staffel N", die ein Disc-Eintrag mit anderem Namen meint: Sein Name beginnt mit
 * dem Reihennamen der Meldung, und sein Titel ist die N-te Staffel der Reihe. Mehrere Reihennamen
 * passen → der längste (bester Treffer).
 */
export function staffelKette<K>(
  nameSchluessel: string,
  t: Title | undefined,
  nachName: Map<string, K[]>,
  reihen: Map<number, Title[]>,
): K[] | undefined {
  const nr = t && staffelNummer(t, reihen)
  if (!nr) return undefined
  let beste: { reihe: string; kette: K[] } | undefined
  for (const [schluessel, kette] of nachName) {
    const m = STAFFEL_SCHLUESSEL.exec(schluessel)
    if (!m || Number(m[2]) !== nr) continue
    const reihe = m[1]!
    if (nameSchluessel !== reihe && !nameSchluessel.startsWith(`${reihe} `)) continue
    if (!beste || reihe.length > beste.reihe.length) beste = { reihe, kette }
  }
  return beste?.kette
}
