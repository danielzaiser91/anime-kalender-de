import { ordneFolgenZu, type Beobachtung, type FolgenZuordnung, type Kontext } from './folgen-je-folge.ts'

/** Was die Sperre verwirft — der Lauf meldet es (kein stiller Ausfall). */
export interface Verworfen {
  /** Beobachtungen an Adressen, die ein Eintrag außerhalb von `titles.json` führt (Cartoon, ohne Synchro, fremder Beleg). */
  beobachtungen: number
  /** Folgen, die nur solche Beobachtungen hatten: ihre bisherige Zuordnung entfällt. */
  folgen: number
  /** Frühere Zuordnungen auf einen Titel, der nicht mehr in `titles.json` steht. */
  veraltet: number
  /** Je Titel-ID: Einträge, die vorher einen Titel hatten und jetzt keinen mehr (ein falsch gesperrter eigener Titel fiele hier auf). */
  entfallen: Record<number, number>
}

/** Die Aufstellung „Titel-ID: Anzahl“ für das Lauflog, größte Zahl zuerst (bei Gleichstand die kleinere ID). */
export function entfallenZeile(entfallen: Record<number, number>): string {
  const liste = Object.entries(entfallen).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
  if (!liste.length) return 'keine'
  return liste.map(([id, n]) => `${id}: ${n}`).join(', ')
}

function zaehleEntfallen(bisher: Record<string, FolgenZuordnung>, ergebnis: Record<string, FolgenZuordnung>): Record<number, number> {
  const entfallen: Record<number, number> = {}
  for (const [s, z] of Object.entries(bisher)) {
    if (!z.titel || ergebnis[s]?.titel) continue
    entfallen[z.titel] = (entfallen[z.titel] ?? 0) + 1
  }
  return entfallen
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
  const ergebnis = { ...ordneFolgenZu(eigene, k, erhalten), ...ohne }
  return {
    ergebnis,
    verworfen: {
      beobachtungen: beobachtungen.length - eigene.length,
      folgen: nurFremd.size,
      veraltet,
      entfallen: zaehleEntfallen(bisher, ergebnis),
    },
  }
}
