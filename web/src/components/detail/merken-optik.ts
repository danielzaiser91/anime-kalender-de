import { TIPPFLAECHE } from './tippziel.ts'

/**
 * Klassen des Kalender-Knopfs („Merken") an Pillen. `neben` (Vorschau `anbieter-legende`): Der Knopf sitzt als eigenes Element
 * am Pillenende, nicht auf der Kante, und deckt keinen Pillentext mehr zu. `gross` (Vorschau `tippziele`): 44 px Trefferfläche.
 */
export function merkenHuelleKlasse(mitFarbe: boolean, neben: boolean): string {
  if (!mitFarbe) return 'relative ml-2 shrink-0'
  return neben ? 'relative ml-1 shrink-0' : 'absolute -bottom-1.5 -right-1.5 z-10'
}

export function merkenKnopfKlasse(mitFarbe: boolean, neben: boolean, gross: boolean): string {
  const rund = mitFarbe && !neben
  const basis = rund
    ? 'grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-full bg-white transition hover:brightness-110 dark:bg-[#162238]'
    : mitFarbe
      ? 'grid size-7 shrink-0 cursor-pointer place-items-center rounded-full bg-white transition hover:brightness-110 dark:bg-[#162238]'
      : 'grid size-7 shrink-0 cursor-pointer place-items-center rounded-full bg-slate-500/10 text-slate-700 transition hover:bg-slate-500/20 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
  return gross ? `${basis} ${TIPPFLAECHE}` : basis
}

export const merkenSymbolKlasse = (mitFarbe: boolean, neben: boolean): string => (mitFarbe && !neben ? 'size-3.5' : 'size-4')
