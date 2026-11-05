import type { Title } from '@shared/types.ts'
import { anzeigeName, staffelBeschriftungen } from '@shared/titles.ts'
import { zaehleHauptstaffeln } from '@shared/staffel-zaehlung.ts'

/**
 * „Staffel 2" je Mitglied einer Reihe mit mehreren Staffeln, damit eine Kachel in „Läuft jetzt" und „Demnächst" sagt,
 * welche Staffel sie meint. Dieselbe Zählung wie im Panel (`staffelBeschriftungen`); trägt eine Staffel einen eigenen Namen (Naruto Shippuden)
 * und fehlt sie dort, gilt die Nummer aus `staffelStaende`. Filme, Specials und Reihen mit einer Staffel bleiben ohne Marke.
 */
export function staffelMarken(members: Title[]): Map<number, string> {
  const { teile, reihenName, staende } = zaehleHauptstaffeln(members.map((m) => ({ ...m, name: anzeigeName(m) })))
  if (!teile.length) return new Map()
  const beschriftung = staffelBeschriftungen(teile, reihenName)
  const marken = new Map<number, string>()
  for (const m of teile) {
    const marke = beschriftung.get(m.id) ?? (staende.has(m.id) ? `Staffel ${staende.get(m.id)!.staffel}` : undefined)
    if (marke) marken.set(m.id, marke)
  }
  return marken
}

/** Die Marke entfällt, wenn der Anzeigename sie schon trägt („Kamisama Kiss: Staffel 2"): keine Information zweimal auf der Kachel. */
export function markeOhneDoppel(marke: string | undefined, m: Title): string | undefined {
  return marke && !anzeigeName(m).includes(marke) ? marke : undefined
}
