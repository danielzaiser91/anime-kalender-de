import { TIPPFLAECHE } from './tippziel.ts'

/**
 * Klassen des Kalender-Knopfs („Merken") an Pillen. Mit Farbe sitzt er als Eckknopf auf der Pille; die Trefferfläche
 * ist 44 px groß (`TIPPFLAECHE`), optisch unverändert.
 */
export function merkenHuelleKlasse(mitFarbe: boolean): string {
  if (!mitFarbe) return 'relative ml-2 shrink-0'
  return 'absolute -bottom-1.5 -right-1.5 z-10'
}

export function merkenKnopfKlasse(mitFarbe: boolean): string {
  const basis = mitFarbe
    ? 'grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-full bg-white transition hover:brightness-110 dark:bg-[#162238]'
    : 'grid size-7 shrink-0 cursor-pointer place-items-center rounded-full bg-slate-500/10 text-slate-700 transition hover:bg-slate-500/20 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
  return `${basis} ${TIPPFLAECHE}`
}

export const merkenSymbolKlasse = (mitFarbe: boolean): string => (mitFarbe ? 'size-3.5' : 'size-4')
