import type { CrunchyrollEntry } from './crunchyroll.ts'

/** Welcher von mehreren Kalendereinträgen derselben Serienkennung gilt (Reihenfolge = Reihenfolge in `german`). */
export function waehleKalenderEintrag(eintraege: CrunchyrollEntry[]): CrunchyrollEntry {
  return eintraege[eintraege.length - 1]!
}
