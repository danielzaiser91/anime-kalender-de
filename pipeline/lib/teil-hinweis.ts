/**
 * Part-, Cour- und Box-Hinweise in Überschriften ohne Staffel-/Film-Wort.
 *
 * „Dr. Stone … Part 2" oder „zweite Blu-ray-Filmbox zu Dragon Ball Z" nennen einen
 * Teil, den `teilAusUeberschrift` nicht kennt; ohne Hinweis hing die Meldung am
 * Basistitel (25.10.2026: drei Disc-Termine am falschen Teil).
 */
import type { Title } from '../../shared/types.ts'

export type TeilHinweis = { art: 'part'; nummer: number } | { art: 'box' }

const ORDINAL = /\b(erste[nr]?|zweite[nr]?|dritte[nr]?|vierte[nr]?|fünfte[nr]?|sechste[nr]?|siebte[nr]?|achte[nr]?|neunte[nr]?|zehnte[nr]?)\b/i

export function teilHinweis(text: string): TeilHinweis | undefined {
  const part = /\b(?:part|cour)\s*0*(\d{1,2})\b/i.exec(text)
  if (part) return { art: 'part', nummer: Number(part[1]) }
  // Nur die Filmbox: Eine Box einer Serie gehört zur Serie, eine Filmbox zu keinem TV-Teil.
  const istBox = /\bfilmbox\b/i.test(text)
  const mitZahl = ORDINAL.test(text) || /\bfilmbox\s*\d{1,2}\b/i.test(text)
  return istBox && mitZahl ? { art: 'box' } : undefined
}

/** Der einzige Titel der Reihe, dessen Name „Part N" bzw. „Cour N" trägt — sonst nichts geraten. */
export function teilNachPartNummer(inReihe: Title[], nummer: number): Title | undefined {
  const imNamen = new RegExp(`\\b(?:part|cour)\\s*0*${nummer}\\b`, 'i')
  const treffer = inReihe.filter((t) => [t.titleDe, t.titleEn, t.titleRomaji].some((n) => n && imNamen.test(n)))
  return treffer.length === 1 ? treffer[0] : undefined
}

/** Ordnet einen Hinweis zu: Part/Cour über den Namen, Filmbox nie (gehört zu keinem TV-Teil). */
export function ordneTeilHinweis(hinweis: TeilHinweis, basis: Title, alle: Title[]): Title | undefined {
  if (hinweis.art === 'box') return undefined
  const reihe = basis.franchiseId ?? basis.id
  const inReihe = alle.filter((t) => (t.franchiseId ?? t.id) === reihe)
  return teilNachPartNummer(inReihe, hinweis.nummer)
}

/** Für `releasesAus`: vermerkt die verworfene Überschrift, wenn sie einen Hinweis trägt; liefert immer undefined. */
export function vermerkeVerworfen(artikel: string, verworfen?: string[]): undefined {
  if (teilHinweis(artikel)) verworfen?.push(artikel)
  return undefined
}
