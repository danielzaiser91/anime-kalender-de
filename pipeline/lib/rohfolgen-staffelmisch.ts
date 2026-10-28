import { ohneDoppelte } from './rohfolgen-doppelte.ts'

/**
 * Ab diesem Zeitpunkt liest die Erweiterung nach einem Staffelwechsel ohne Neuladen die Folgen der neuen Seite
 * (4.20.8/4.20.9, Commits cb57345e7 und 8d67c2f60 vom 15.09.2026, Folgetag wegen Neuladens der Erweiterung).
 */
export const STAFFELWECHSEL_BEHOBEN = '2026-09-16T00:00:00Z'

/** Rohfolgen, wie der Worker sie ausliefert — nur die Felder, die der Riegel braucht. */
interface MitStaffel {
  id: number
  url: string
  nummer: number | null
  titel: string | null
  erschienen: string | null
  sprachen: string | null
  gemeldet_am: string
  plattform?: string | null
  staffel_nr?: number | null
  seiten_kennung?: string | null
}

/**
 * Prime-Zeilen mit Staffelangabe, die vor dem Staffelwechsel-Fix und ohne Seitenkennung gemeldet wurden: Sie können
 * Folgen einer anderen Staffel unter der Adresse dieser Seite tragen (Bungo Stray Dogs 10.09.2026: „Staffel 1“ mit
 * Staffelnummer 5). Wer wirklich vermischt ist, lässt sich aus der Zeile nicht erkennen, also gilt die ganze Gruppe als unsicher.
 * Seiten ohne Staffelangabe (Filme) kennen keine Staffelauswahl und bleiben.
 */
export function istStaffelmischVerdacht(f: MitStaffel): boolean {
  return (f.plattform ?? 'primevideo') === 'primevideo' && f.staffel_nr != null && !f.seiten_kennung && f.gemeldet_am < STAFFELWECHSEL_BEHOBEN
}

/** Die Rohfolgen ohne die Verdachtszeilen; `verworfen` sind deren Kennungen (werden abgehakt, nicht zugeordnet). */
export function ohneStaffelmischung<T extends MitStaffel>(folgen: T[]): { folgen: T[]; verworfen: number[] } {
  const verworfen = folgen.filter(istStaffelmischVerdacht).map((f) => f.id)
  if (!verworfen.length) return { folgen, verworfen }
  const weg = new Set(verworfen)
  return { folgen: folgen.filter((f) => !weg.has(f.id)), verworfen }
}

/** Entdoppeln und Mischverdacht in einem Zug: `veraltet` sind alle Kennungen, die abgehakt werden. */
export function bereinigeAltbestand<T extends MitStaffel>(folgen: T[]): { folgen: T[]; veraltet: number[] } {
  const entdoppelt = ohneDoppelte(folgen)
  const gemischt = ohneStaffelmischung(entdoppelt.folgen)
  return { folgen: gemischt.folgen, veraltet: [...entdoppelt.veraltet, ...gemischt.verworfen] }
}
