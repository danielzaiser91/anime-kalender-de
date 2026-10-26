import { hauptstaffeln, nachAusstrahlung, reihenVertreter, staffelStaende, zaehlgruppen, zaehlgruppeVon } from '../../shared/titles.ts'
import type { FranchiseMember } from '../../shared/types.ts'
import { zaehltAlsNeuverfilmung } from '../bau/remake-von.ts'

export interface DoppelteNummer {
  reihe: string
  nummer: string
  teile: string[]
  /** Kennungen derselben Teile, für die Titelmarke des Bestandswächters. */
  ids: number[]
  /** Die Reihe enthält eine Neuverfilmung (`remakeVon`) — genau die Klasse, die die Zählgruppen schließen. */
  mitRemake: boolean
}

/**
 * Zwei Teile derselben Zählgruppe mit gleicher Staffelnummer (und gleichem Teil), so wie das Panel zählt
 * (`staffelStaende`, auch bei eigenem Namen). Yaiba: 2025 und 2027 hießen beide „Staffel 2".
 */
export function doppelteNummern(reihen: Record<string, FranchiseMember[]>): DoppelteNummer[] {
  const aus: DoppelteNummer[] = []
  for (const reihe of Object.values(reihen)) {
    const haupt = hauptstaffeln(reihe)
    if (haupt.length < 2) continue
    const name = reihenVertreter(reihe.slice().sort(nachAusstrahlung)).name
    const stand = staffelStaende(haupt, name)
    for (const gruppe of zaehlgruppen(haupt)) {
      const jeNummer = new Map<string, FranchiseMember[]>()
      for (const m of gruppe) {
        const s = stand.get(m.id)
        if (!s) continue
        const schluessel = `${s.staffel}/${s.teil ?? '-'}`
        jeNummer.set(schluessel, [...(jeNummer.get(schluessel) ?? []), m])
      }
      for (const [nummer, glieder] of jeNummer) {
        if (glieder.length < 2) continue
        const teile = glieder.map((m) => `${m.name} (${m.jpYear})`)
        aus.push({ reihe: name, nummer, teile, ids: glieder.map((m) => m.id), mitRemake: reihe.some((m) => m.remakeVon !== undefined) })
      }
    }
  }
  return aus
}

/** Neuverfilmungen, die mit ihrem Original in derselben Zählgruppe stehen (`paare`: Neuverfilmung → Original, nur Serien derselben Reihe). */
export function remakeMitOriginalInGruppe(reihen: Record<string, FranchiseMember[]>, paare: Map<number, number>): FranchiseMember[] {
  const aus: FranchiseMember[] = []
  for (const reihe of Object.values(reihen)) {
    for (const m of reihe) {
      const original = paare.get(m.id)
      const vorlage = reihe.find((x) => x.id === original)
      if (!vorlage || !zaehltAlsNeuverfilmung(m, vorlage)) continue
      if (zaehlgruppeVon(reihe, m.id).some((x) => x.id === original)) aus.push(m)
    }
  }
  return aus
}
