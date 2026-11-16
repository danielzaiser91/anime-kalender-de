import type { Title } from '../../shared/types.ts'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Die Titel in »Guillemets« einer Überschrift oder Herkunft („Automatisch übernommen aus …“). */
export const artikelNamen = (text: string): string[] => [...text.matchAll(/»([^«]+)«/g)].map((m) => m[1]!)

export const titelNamen = (t: Title): string[] => [t.titleDe, t.titleEn, t.titleRomaji].flatMap((n) => (n ? [n] : []))

/** Enthält ein Name des Titels den Artikelnamen oder der Artikelname den Titelnamen (auf Buchstaben und Ziffern normiert, Teilstring)? */
export function nameTrifft(t: Title, artikel: string): boolean {
  const a = norm(artikel)
  return titelNamen(t).some((n) => norm(n) && (norm(n).includes(a) || a.includes(norm(n))))
}
