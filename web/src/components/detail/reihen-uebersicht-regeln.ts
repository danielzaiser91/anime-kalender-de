import type { FranchiseMember } from '@shared/types.ts'
import { istEingeklappt } from './reihen-regeln.ts'

export type Gruppe = { titel: string; teile: FranchiseMember[] }

/** Über 12 Teile wird eine Gruppe gekappt (design-regeln.md, Abschnitt 13, E4). */
export const GROSSE_GRUPPE = 12
/** Teile im Fenster der Gruppe des geöffneten Titels: er selbst mit je zwei Nachbarn. */
export const FENSTER = 5

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

/** Zahl am Kopf der Karte: alle gerade gezeigten Teile, also die Summe der Gruppenzahlen. */
export function gezeigteZahl(gruppen: Gruppe[]): number {
  return gruppen.reduce((summe, g) => summe + g.teile.length, 0)
}

/** Groß ist eine Reihe, wenn eine Gruppe ohne Schalter über 12 Teile zeigt; der Schalter ändert die Form nicht. */
export function istGrosseReihe(gruppen: Gruppe[], titelId: number): boolean {
  return gezeigteGruppen(gruppen, titelId, false, '').some((g) => g.teile.length > GROSSE_GRUPPE)
}

/** Der geöffnete Teil mit je zwei Nachbarn; am Rand der Gruppe verschoben, damit es immer fünf Teile sind. */
export function fensterUm(teile: FranchiseMember[], gewaehltId: number): FranchiseMember[] {
  const pos = teile.findIndex((m) => m.id === gewaehltId)
  if (pos < 0) return teile
  const start = Math.max(0, Math.min(pos - Math.floor(FENSTER / 2), teile.length - FENSTER))
  return teile.slice(start, start + FENSTER)
}

/** Titel der Gruppe, die den Teil enthält. */
export function gruppeVon(gruppen: Gruppe[], id: number): string | undefined {
  return gruppen.find((g) => g.teile.some((m) => m.id === id))?.titel
}
