/**
 * Staffelnummern aus Namen: Crunchyroll schreibt „Staffel 3“ oder „Season 3“, unsere Titel „Season 3“ oder „3rd Season“.
 * Gemeinsame Grundlage für den Namensabgleich von Blöcken (`cr-nein-ueberholt.ts`, `crunchyroll-termine.ts`).
 */
import type { Title } from '../../shared/types.ts'

const STAFFEL = /\b(?:staffel|season)\s*(\d+)\b/i
const ORDINAL = /\b(\d+)(?:st|nd|rd|th)\s+season\b/i

/** Staffelnummer (`Season 2` ≙ `Staffel 2`) und der Rest des Namens ohne Satzzeichen. */
export function zerlege(name: string): { nr: number | null; kern: string } {
  const nr = STAFFEL.exec(name)?.[1]
  const kern = name
    .replace(STAFFEL, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  return { nr: nr ? Number(nr) : null, kern }
}

/** Die Staffelnummer, die einer unserer Titel in einem seiner Namen trägt — `null`, wenn keiner eine nennt. */
export function titelStaffelNr(t: Pick<Title, 'titleDe' | 'titleEn' | 'titleRomaji'>): number | null {
  for (const name of [t.titleDe, t.titleEn, t.titleRomaji]) {
    if (!name) continue
    const nr = zerlege(name).nr ?? (ORDINAL.exec(name)?.[1] ? Number(ORDINAL.exec(name)![1]) : null)
    if (nr !== null) return nr
  }
  return null
}
