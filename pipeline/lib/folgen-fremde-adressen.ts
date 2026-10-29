import { ordneFolgenZu, type Beobachtung, type FolgenZuordnung, type Kontext } from './folgen-je-folge.ts'

/** Was die Sperre verwirft — der Lauf meldet es (kein stiller Ausfall). */
export interface Verworfen {
  /** Beobachtungen an Adressen, die ein Eintrag außerhalb von `titles.json` führt (Cartoon, ohne Synchro, fremder Beleg). */
  beobachtungen: number
  /** Folgen, die nur solche Beobachtungen hatten: ihre bisherige Zuordnung entfällt. */
  folgen: number
  /** Frühere Zuordnungen auf einen Titel, der nicht mehr in `titles.json` steht. */
  veraltet: number
}

const schluesselVon = (b: Beobachtung) => `${b.plattform}:${b.asin ?? b.gti}`

/**
 * **`ordneFolgenZu` ohne fremde Adressen** (29.10.2026): Eine Beobachtung an einer Cartoon-, Ohne-Synchro- oder
 * fremden Beleg-Adresse ordnet keinem Titel zu, und eine frühere Zuordnung auf einen Titel außerhalb von
 * `titles.json` bleibt nicht stehen (Hell Mode, Dragon Ball Super: Beerus waren dorthin gewandert, 37 Folgen).
 * Beides wird zu „ohne Kandidat“ und gezählt.
 */
export function ordneFolgenOhneFremde(
  beobachtungen: Beobachtung[],
  k: Kontext & { istFremd: (url: string) => boolean },
  bisher: Record<string, FolgenZuordnung>,
): { ergebnis: Record<string, FolgenZuordnung>; verworfen: Verworfen } {
  const eigene = beobachtungen.filter((b) => !k.istFremd(b.url))
  const eigeneSchluessel = new Set(eigene.filter((b) => b.asin ?? b.gti).map(schluesselVon))
  /* Folge → jüngste Meldung, für Folgen, die nur an fremden Adressen gemeldet wurden. */
  const nurFremd = new Map<string, string>()
  for (const b of beobachtungen) {
    const s = schluesselVon(b)
    if (!(b.asin ?? b.gti) || eigeneSchluessel.has(s)) continue
    if (b.gemeldet_am > (nurFremd.get(s) ?? '')) nurFremd.set(s, b.gemeldet_am)
  }
  const erhalten: Record<string, FolgenZuordnung> = {}
  const ohne: Record<string, FolgenZuordnung> = {}
  let veraltet = 0
  for (const [s, z] of Object.entries(bisher)) {
    if (nurFremd.has(s)) continue
    if (z.titel && !k.titel.has(z.titel)) {
      veraltet++
      if (!eigeneSchluessel.has(s)) ohne[s] = { grund: 'ohne-kandidat', gesehen: z.gesehen }
    } else erhalten[s] = z
  }
  for (const [s, am] of nurFremd) ohne[s] = { grund: 'ohne-kandidat', gesehen: am }
  return {
    ergebnis: { ...ordneFolgenZu(eigene, k, erhalten), ...ohne },
    verworfen: { beobachtungen: beobachtungen.length - eigene.length, folgen: nurFremd.size, veraltet },
  }
}
