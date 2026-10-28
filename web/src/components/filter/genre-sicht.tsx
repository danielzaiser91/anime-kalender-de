import { useState, type ReactNode } from 'react'
import type { FilterState } from '../../lib/filters.ts'
import { genreAnzeige } from '../../lib/filter-liste.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { Chip } from '../ui.tsx'

/**
 * Welche Genres der Kalender-Filter zeigt und der Knopf „alle anzeigen“ dazu. Ohne `genreListe`
 * (Datenbank) zeigt der Filter ohnehin alle (`ohneKuerzung`).
 */
export function useGenreSicht(genreListe: string[] | undefined, ohneKuerzung: string[], filters: FilterState, sucht: boolean, t: Translate): { alle: string[]; sichtbar: string[]; mehrChip: ReactNode } {
  const [alle, setAlle] = useState(false)
  if (!genreListe) return { alle: ohneKuerzung, sichtbar: ohneKuerzung, mehrChip: null }
  const sicht = genreAnzeige(genreListe, [...filters.genres, ...filters.excluded.genres], alle, sucht)
  const zeigeKnopf = !sucht && (sicht.versteckt > 0 || alle)
  const beschriftung = alle ? t('filter.showLess') : `(…) ${t('filter.showMore', { count: genreListe.length })}`
  return { alle: genreListe, sichtbar: sicht.sichtbar, mehrChip: zeigeKnopf ? <Chip onClick={() => setAlle((v) => !v)}>{beschriftung}</Chip> : null }
}
