import type { StreamLink, Title } from '../../shared/types.ts'
import { anbieterWegMitJa, geerbteWege } from '../../shared/kanal-anbieter.ts'

/** Ein Weg, den der Anbieter noch führt (`entferntAm` markiert einen Weg, der nur noch als Vermerk steht). */
const geschaltet = (s: StreamLink): boolean => !s.entferntAm

/**
 * **Ein Prime-Kanal ist so deutsch wie sein Anbieter** (Daniel, 13.10.2026: „Prime Video (Crunchyroll)“ wie Crunchyroll,
 * Reborn as a Space Mercenary). Hat der Anbieter-Weg (Crunchyroll, ADN) ein belegtes Ja und der Kanal-Weg kein eigenes
 * Urteil, übernimmt der Kanal `dub` und `dubRanges`. Ein Nein oder ein offenes Urteil des Anbieters (Golden Wind, Hell Mode),
 * ein fehlender Anbieter-Weg und ein eigenes Urteil des Kanals (Ja oder Nein) bleiben unberührt. Gibt die Zahl der Wege zurück.
 */
export function kanalErbtVomAnbieter(titles: Iterable<Title>): number {
  let geerbt = 0
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      if (s.dub !== undefined || !geschaltet(s)) continue
      const quelle = anbieterWegMitJa(s, t.streams)
      if (!quelle) continue
      s.dub = true
      geerbteWege.add(s)
      if (!s.dubRanges?.length && quelle.dubRanges?.length) s.dubRanges = quelle.dubRanges.map((r) => ({ ...r }))
      geerbt++
    }
  }
  return geerbt
}
