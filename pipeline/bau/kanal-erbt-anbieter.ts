import type { StreamLink, Title } from '../../shared/types.ts'
import { anbieterDesKanals } from '../../shared/kanal-anbieter.ts'

/** Ein Weg, den der Anbieter noch führt (`entferntAm` markiert einen Weg, der nur noch als Vermerk steht). */
const geschaltet = (s: StreamLink): boolean => !s.entferntAm

/** Der Anbieter-Weg, dessen Deutsch den Kanal-Weg trägt: gleiche Plattform wie der Kanal, dort belegtes Ja. */
function anbieterMitJa(s: StreamLink, streams: StreamLink[]): StreamLink | undefined {
  const plattform = s.platform === 'primevideo' ? anbieterDesKanals(s.kanal) : undefined
  return plattform ? streams.find((q) => q.platform === plattform && q.dub === true && geschaltet(q)) : undefined
}

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
      const quelle = anbieterMitJa(s, t.streams)
      if (!quelle) continue
      s.dub = true
      if (!s.dubRanges?.length && quelle.dubRanges?.length) s.dubRanges = quelle.dubRanges.map((r) => ({ ...r }))
      geerbt++
    }
  }
  return geerbt
}
