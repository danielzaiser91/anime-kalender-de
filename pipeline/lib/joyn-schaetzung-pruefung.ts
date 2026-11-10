import type { ReleaseEvent, Title } from '../../shared/types.ts'

/** Ein Fenster ab 00:00 bis 04:59 ist „vor der ersten sicheren Sichtung“ (`setzeJoynFenster`), kein belegtes Sendeende. */
export const istSendeende = (ab: string): boolean => Number(ab.slice(11, 13)) >= 5

/**
 * Joyn-Termine, die „≈“ tragen, obwohl das Abruffenster des Joyn-Wegs ihren Tag und ihre Uhrzeit belegt
 * (Yaiba, 10.11.2026). Die Fenster entstehen aus belegten Sendetagen; der Termin darf dann nicht als Schätzung gelten.
 */
export function joynTerminGeschaetztTrotzFenster(events: ReleaseEvent[], titles: Map<number, Title>): string[] {
  const fehler: string[] = []
  for (const e of events) {
    if (e.platform !== 'joyn' || !e.estimated || typeof e.episode !== 'number') continue
    const weg = titles.get(e.titleId)?.streams?.find((s) => s.platform === 'joyn')
    if (weg?.fenster?.some((f) => f.nr === e.episode && istSendeende(f.ab) && f.ab === `${e.date}T${e.time}`))
      fehler.push(`Joyn-Termin ${e.releaseSlug} Folge ${e.episode} (${e.date}) trägt „≈“, obwohl das Abruffenster des Wegs Tag und Uhrzeit belegt`)
  }
  return fehler
}
