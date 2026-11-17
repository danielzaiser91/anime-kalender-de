/**
 * **Eine Quelle, deren `sagt` vom Termin abweicht, ist nicht mehr „aktuell“, wenn der Termin anders gestützt ist** (16.11.2026).
 * `quellenPflegen` hält jede Adresse aus `sources` auf `aktuell`; ihr altes `sagt` (aus der Historie, damals unser Termin oder eine
 * erste Meldung) blieb dabei stehen, auch nachdem Folge 1 oder ein Shop-Beleg einen anderen Tag festgelegt hatte.
 * Eine echte, noch gültige Abweichung bleibt `aktuell`: Der Termin hat dann weder Folge 1 noch eine zweite Stütze.
 * Plattform `tv` ist ausgenommen: dort ist `sagt` der Sichtungstag des laufenden Sendeplans, kein Gegenbeweis.
 */
import type { Quelle, Release } from '../../shared/types.ts'

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/

/** Aktuelle Quellen mit einem Tag in `sagt`, der nicht der Termin ist (ohne Sendeplan-Quellen). */
export function aktuelleMitAbweichung(r: Pick<Release, 'platform' | 'schedule'>, quellen: Quelle[]): Quelle[] {
  if (r.platform === 'tv') return []
  const termin = r.schedule.firstEpisodeDate
  return quellen.filter((q) => (q.stand ?? 'aktuell') === 'aktuell' && ISO_TAG.test(q.sagt ?? '') && q.sagt !== termin)
}

/** Wodurch der Termin gestützt ist: Folge 1 am Termin beobachtet, oder eine andere aktuelle Quelle trägt ihn (Tag gleich oder ohne eigene Aussage). */
function stuetze(r: Pick<Release, 'schedule'>, quellen: Quelle[], abweichend: Quelle): string | undefined {
  const termin = r.schedule.firstEpisodeDate
  if (r.schedule.observed?.[1] === termin) return `Folge 1 erschien am ${termin}`
  const traegt = quellen.some((q) => q !== abweichend && (q.stand ?? 'aktuell') === 'aktuell' && (q.sagt === termin || !q.sagt))
  return traegt ? `Termin: ${termin}` : undefined
}

/** Dieselben Quellen; abweichende, gestützte Termine tragen `ueberholt` mit Grund. */
export function mitUeberholtDurchTermin(r: Pick<Release, 'platform' | 'schedule'>, quellen: Quelle[]): Quelle[] {
  const abweichend = new Set(aktuelleMitAbweichung(r, quellen))
  return quellen.map((q) => {
    const grund = abweichend.has(q) ? stuetze(r, quellen, q) : undefined
    return grund ? { ...q, stand: 'ueberholt' as const, grund } : q
  })
}
