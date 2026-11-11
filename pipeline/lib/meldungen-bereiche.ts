/** Aus `fetch-pruefungen.ts` herausgelöst: Bereiche der Meldungen auf die Staffeln einer Adresse verteilen. */
import { verteileAufStaffeln, type Folgenbereich, type Staffeleintrag } from './folgenbereiche.ts'

/** Die Bereiche einer durchgezählten Meldungsliste, die in die Staffel `id` fallen, in deren eigener Zählung. */
export function bereicheDerStaffel(
  bereiche: { von: number; bis: number; dub: boolean }[],
  staffeln: Staffeleintrag[],
  id: number,
): Folgenbereich[] {
  return bereiche
    .flatMap((b) => verteileAufStaffeln(b, staffeln))
    .filter((v) => v.staffel.id === id)
    .map((v) => ({ von: v.von, bis: v.bis, dub: v.dub, belegt: [] as number[] }))
}
