import type { CrunchyrollEntry } from './crunchyroll.ts'

const juengsterTermin = (e: CrunchyrollEntry): string => [...(e.dates ?? [])].sort().at(-1) ?? ''

/**
 * Welcher von mehreren Kalendereinträgen derselben Serienkennung gilt (Reihenfolge = Reihenfolge in `german`):
 * der mit dem jüngsten Termin, dann der mit mehr Beobachtungen; bei Gleichstand der zuletzt gelesene.
 */
export function waehleKalenderEintrag(eintraege: CrunchyrollEntry[]): CrunchyrollEntry {
  let beste = eintraege[0]!
  for (const e of eintraege.slice(1)) {
    const termin = juengsterTermin(e).localeCompare(juengsterTermin(beste))
    const beobachtet = (e.observations?.length ?? 0) - (beste.observations?.length ?? 0)
    if (termin > 0 || (termin === 0 && beobachtet >= 0)) beste = e
  }
  return beste
}
