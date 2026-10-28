import type { Title } from '@shared/types.ts'
import { anzeigeName, hauptstaffeln, reihenAnfang, reihenVertreter, staffelBeschriftungen, staffelStaende } from '@shared/titles.ts'

/**
 * „Staffel 2" je Mitglied einer Reihe mit mehreren Staffeln, damit eine Kachel in „Läuft jetzt" und „Demnächst" sagt,
 * welche Staffel sie meint. Dieselbe Zählung wie im Panel (`staffelBeschriftungen`); trägt eine Staffel einen eigenen Namen (Naruto Shippuden)
 * und fehlt sie dort, gilt die Nummer aus `staffelStaende`. Filme, Specials und Reihen mit einer Staffel bleiben ohne Marke.
 */
export function staffelMarken(members: Title[]): Map<number, string> {
  const teile = hauptstaffeln(members.map((m) => ({ ...m, name: anzeigeName(m) })))
  if (teile.length < 2) return new Map()
  const vertreter = reihenVertreter(teile)
  const reihenName = reihenAnfang(vertreter.name, teile.map((m) => m.name))
  const beschriftung = staffelBeschriftungen(teile, reihenName)
  const staende = staffelStaende(teile, reihenName)
  const marken = new Map<number, string>()
  for (const m of teile) {
    const marke = beschriftung.get(m.id) ?? (staende.has(m.id) ? `Staffel ${staende.get(m.id)!.staffel}` : undefined)
    if (marke) marken.set(m.id, marke)
  }
  return marken
}
