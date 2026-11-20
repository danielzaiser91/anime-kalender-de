import type { FranchiseMember } from '@shared/types.ts'
import { istEingeklappt } from './reihen-regeln.ts'

export type Gruppe = { titel: string; teile: FranchiseMember[] }

const suchKern = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Die Gruppen, wie sie gerade zu sehen sind: mit Suchtext alle Treffer, sonst nur die Teile, die der Schalter
 * „ohne Synchro“ zeigt; leere Gruppen fallen weg. Jede Zahl der Reihen-Karte kommt hierher, damit Zahl und Liste nie
 * auseinanderlaufen.
 */
export function gezeigteGruppen(gruppen: Gruppe[], titelId: number, ohneOffen: boolean, suchText: string): Gruppe[] {
  const passt = (m: FranchiseMember) => suchKern(`${m.name} ${m.jpYear ?? ''}`).includes(suchKern(suchText))
  const sichtbar = (m: FranchiseMember) => ohneOffen || !istEingeklappt(m, titelId)
  return gruppen
    .map((g) => ({ ...g, teile: g.teile.filter((m) => (suchText ? passt(m) : sichtbar(m))) }))
    .filter((g) => g.teile.length > 0)
}
