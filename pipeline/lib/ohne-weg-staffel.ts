/**
 * Der Beleg des Grunds `abo-andere-staffel` in `ohne-weg.ts` (19.11.2026): JustWatch führt das deutsche Abo an einer anderen Staffel derselben Serie,
 * die ein Titel der Reihe mit eigenem Weg trägt (Chunibyo Staffel 1 gegen Staffel 2, Legend of the Galactic Heroes Second gegen Staffel 1).
 */
import type { JwBefund } from './jw-vertrauen.ts'

const KAUF = new Set<string>(['BUY', 'RENT', 'CINEMA'])

/**
 * Die Staffel mit der Nummer des Titels steht bei JustWatch ohne jedes Angebot, eine andere Staffel hat ein Abo mit deutschem Ton, und ein Titel
 * derselben Reihe (`geschwisterMitWeg`) trägt einen Streaming-Weg. Ohne Staffelnummer oder ohne die eigene Staffel in der Liste gibt es keinen Beleg.
 */
export function aboAndereStaffel(b: JwBefund, nummer: number | undefined, geschwisterMitWeg: boolean): boolean {
  if (!geschwisterMitWeg) return false
  const eigene = (b.staffeln ?? []).find((s) => s.nr === nummer)
  if (!eigene || eigene.angebote.length) return false
  /* Die eigene Staffel trägt kein Angebot, jedes Abo mit Deutsch gehört also einer anderen. */
  return (b.staffeln ?? []).some((s) => s.angebote.some((a) => !KAUF.has(a.art) && a.audio.includes('de')))
}
