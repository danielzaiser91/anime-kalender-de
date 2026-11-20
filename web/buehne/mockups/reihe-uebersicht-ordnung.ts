import type { FranchiseMember } from '@shared/types.ts'
import { hauptstaffeln, nachJahrUndId, staffelBeschriftungen, staffelStaende } from '@shared/titles.ts'
import { reihenGruppen } from '../../src/components/detail/reihen-gruppen.ts'
import { istEingeklappt } from '../../src/components/detail/reihen-regeln.ts'
import { kuenftig as istKuenftig } from '../../src/components/detail/reihen-teil.ts'
import type { ReihenListeProps } from '../../src/components/detail/reihen-inhalt.tsx'

/** E4 (design-regeln.md, Abschnitt 13): über 12 Einträge wird eingeklappt. */
export const GROSSE_GRUPPE = 12
/** Teile, die das Fenster der anfangs offenen Gruppe zeigt: der geöffnete mit je zwei Nachbarn. */
export const FENSTER = 5

export type Gruppe = { titel: string; teile: FranchiseMember[] }

/** Wie `reihenOrdnung` der Seite (Nachbau fürs Mockup, `web/src` bleibt unberührt): Hauptstaffeln, Gruppen, Staffelnummern. */
export function ordnung({ reihenTeile, reihenName, t }: Pick<ReihenListeProps, 'reihenTeile' | 'reihenName' | 't'>) {
  const jahr = new Date().getFullYear()
  const kuenftig = (m: FranchiseMember) => istKuenftig(m, jahr)
  const hauptIds = new Set(hauptstaffeln(reihenTeile).map((m) => m.id))
  const istHauptstaffel = (m: FranchiseMember) => hauptIds.has(m.id)
  const nachStandUndJahr = (a: FranchiseMember, b: FranchiseMember) => Number(kuenftig(a)) - Number(kuenftig(b)) || nachJahrUndId(a, b)
  const gruppen = reihenGruppen(reihenTeile, istHauptstaffel, nachStandUndJahr, t)
  const haupt = reihenTeile.filter(istHauptstaffel)
  return { kuenftig, istHauptstaffel, gruppen, staffelLabel: staffelBeschriftungen(haupt, reihenName), nummern: staffelStaende(haupt, reihenName) }
}

/** Was gerade gezeigt wird: bei Suche alle Treffer, sonst alles, was nicht hinter dem Schalter „Teile ohne Synchro“ steht. */
export function gezeigteGruppen(gruppen: Gruppe[], titelId: number, ohneOffen: boolean, suchText: string): Gruppe[] {
  const kern = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const passt = (m: FranchiseMember) => kern(`${m.name} ${m.jpYear ?? ''}`).includes(kern(suchText))
  const sichtbar = (m: FranchiseMember) => ohneOffen || !istEingeklappt(m, titelId)
  return gruppen
    .map((g) => ({ ...g, teile: g.teile.filter((m) => (suchText ? passt(m) : sichtbar(m))) }))
    .filter((g) => g.teile.length > 0)
}

/** Groß ist eine Reihe, wenn eine Gruppe über 12 Teile hat, die ohne Schalter gezeigt werden — unabhängig vom Schalter, damit die Form nicht wechselt. */
export function istGrosseReihe(gruppen: Gruppe[], titelId: number): boolean {
  return gezeigteGruppen(gruppen, titelId, false, '').some((g) => g.teile.length > GROSSE_GRUPPE)
}

/** Der geöffnete Teil mit je zwei Nachbarn; am Rand der Gruppe verschoben, damit es immer `breite` Teile sind. */
export function fensterUm(teile: FranchiseMember[], gewaehltId: number, breite = FENSTER): FranchiseMember[] {
  const pos = teile.findIndex((m) => m.id === gewaehltId)
  if (pos < 0) return []
  const start = Math.max(0, Math.min(pos - Math.floor(breite / 2), teile.length - breite))
  return teile.slice(start, start + breite)
}

/** Titel der Gruppe, die den Teil enthält. */
export function gruppeVon(gruppen: Gruppe[], id: number): string | undefined {
  return gruppen.find((g) => g.teile.some((m) => m.id === id))?.titel
}

/** Die „zweite“ Gruppe für den Zustand „von Hand geöffnet“: Filme, sonst die erste andere. */
export function andereGruppe(gruppen: Gruppe[], id: number, filme: string): string | undefined {
  const eigene = gruppeVon(gruppen, id)
  return gruppen.find((g) => g.titel === filme && g.titel !== eigene)?.titel ?? gruppen.find((g) => g.titel !== eigene)?.titel
}
