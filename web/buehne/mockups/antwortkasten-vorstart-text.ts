import { formatDate } from '@shared/time.ts'

/** Wie der Titel erscheint: Folgen (Stream, TV), Disc mit Volumes oder Film. */
export type Erscheinung =
  | { art: 'folgen'; datum: string }
  | { art: 'disc'; datum: string; vol: string; folgen: string }
  | { art: 'film'; datum: string }

/** Die beiden Textzeilen des Kastens vor dem ersten deutschen Termin; `neben` fehlt, wenn die Überschrift alles sagt. */
export interface Vorstartzeilen {
  haupt: string
  neben?: string
}

/**
 * Titel vor ihrem ersten deutschen Termin (Kennung `ak`). Virgin Road: 30.10.2026 wie die Pille darunter (die Fälle tragen den
 * Stand vom 27.10.; live nennt Daniel den 06.11.), Folgen 1–4 nach seiner Angabe. Edgerunners II: Netflix-Start 20.10.2026.
 */
export const VORSTART: Record<number, Erscheinung> = {
  12466: { art: 'disc', datum: '2026-10-30', vol: 'Vol. 1', folgen: '1–4' },
  16917: { art: 'folgen', datum: '2026-10-20' },
}

/** Variante A: Daniels Satz als Überschrift, keine Nebenzeile. */
export function satzAlsUeberschrift(e: Erscheinung): Vorstartzeilen {
  const datum = formatDate(e.datum)
  if (e.art === 'disc') return { haupt: `${e.vol} (Folgen ${e.folgen}) erscheint am ${datum}` }
  if (e.art === 'film') return { haupt: `Der Film mit deutscher Synchro erscheint voraussichtlich am ${datum}` }
  return { haupt: `Die erste Folge mit deutscher Synchro erscheint voraussichtlich am ${datum}` }
}

/** Variante B: kurze Überschrift „Deutsch angekündigt“, das Datum in der Nebenzeile. */
export function angekuendigtMitNebenzeile(e: Erscheinung): Vorstartzeilen {
  const datum = formatDate(e.datum)
  if (e.art === 'disc') return { haupt: 'Deutsch angekündigt', neben: `${e.vol} (Folgen ${e.folgen}) am ${datum}` }
  if (e.art === 'film') return { haupt: 'Deutsch angekündigt', neben: `Film am ${datum}` }
  return { haupt: 'Deutsch angekündigt', neben: `Erste Folge am ${datum}` }
}
