import { deutscheFolgenNachDemEnde, type CrSerie } from './crunchyroll-dub.ts'

/**
 * Liegen die deutschen Folgen jedes Katalogeintrags der Kennung hinter dem Ende des Titels?
 * Nur dann sperrt es das Ja: Steht dieselbe Kennung unter zwei Adressen (frischer Abruf mit 1–3,
 * alter mit 49–51), darf der alte den frischen nicht verdecken. Ohne Eintrag: nein.
 */
export function alleHinterDemEnde(eintraege: CrSerie[] | undefined, folgen: number | undefined): boolean {
  return !!eintraege?.length && eintraege.every((s) => deutscheFolgenNachDemEnde(s.staffeln ?? [], folgen))
}
