import { addDays } from '../../shared/time.ts'
import type { NichtZugeordnet } from './sammel-unzugeordnet.ts'

/** Ab wie vielen Tagen nach der Meldung ein Termin mit deutschem Ton im Kalender stehen muss. */
export const FRIST_TAGE = 2

export interface OhneReleaseBefund {
  eintrag: NichtZugeordnet
  /** Tag der Meldung; fehlt er, gilt der Eintrag als überfällig (fail closed). */
  gemeldetAm?: string
}

/**
 * **Meldungen mit Termin und deutschem Ton, die nach `FRIST_TAGE` Tagen noch kein Release haben** (Bass X Machina: Anime2You meldete den
 * 03.11. am 21.08., der Bau verwarf die Meldung 74 Tage lang still). `liste` ist `data/proposals/nicht-zugeordnet.json`, `gemeldetAm`
 * liefert den Meldetag je Artikeladresse (`anime2you.json`, `publishedAt`), `heute` der Stand der Liste.
 */
export function ueberfaelligOhneRelease(liste: NichtZugeordnet[], gemeldetAm: Map<string, string>, heute: string): OhneReleaseBefund[] {
  const grenze = addDays(heute, -FRIST_TAGE)
  return liste
    .map((eintrag) => ({ eintrag, gemeldetAm: gemeldetAm.get(eintrag.artikel) }))
    .filter((b) => b.gemeldetAm === undefined || b.gemeldetAm < grenze)
}
