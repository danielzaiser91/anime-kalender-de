/**
 * Quote der Folgentitel aus der TMDB-Containerstaffel (`bau/folgentitel-tmdb-staffel.ts`, Miraculous Staffel 2–4), je Titel. Die Zuordnung hängt nur an
 * Name und Folgenzahl; ob TMDBs Reihenfolge der deutschen Sendereihenfolge entspricht, belegt das nicht. Darum zählt die Prüfung je Titel, wie viele Folgen
 * einen Titel haben und ob einer doppelt vorkommt. Aufgerufen von `folgentitel-staffel-quote-bestand.ts` (Warnung, nie rot). Test: `check-folgentitel-staffel-quote.ts`.
 *
 * Rückgabe von `tmdbStaffelFolgentitel` (Kopfkommentar dort), hier ausgewertet:
 * | Rückgabe            | Bedeutung                                                                                         | hier              |
 * |---------------------|---------------------------------------------------------------------------------------------------|-------------------|
 * | undefined           | kein „… Staffel N" (N ≥ 2), kein Franchise-Eintrag, Format/Folgenzahl (< 6)/Name/Folgenzahl-Lücke passt nicht, keine Ausbeute | Titel zählt nicht |
 * | Map Nummer → Titel  | alle echten deutschen Titel der TMDB-Staffel N für unsere Nummern                                 | Herkunft prüfen   |
 */
import type { Title } from '../../shared/types.ts'
import { tmdbStaffelFolgentitel } from '../bau/folgentitel-tmdb-staffel.ts'
import type { TmdbEintrag } from '../bau/folgentitel-tmdb.ts'
import type { FolgenDatei } from './folgentitel-luecke.ts'

export interface StaffelQuote {
  /** Folgen der Folgendatei mit Titel. */
  titel: number
  /** Folgen, die der Titel führt (`episodes`). */
  folgen: number
  /** Titel, die in der Folgendatei mehrfach vorkommen (Schreibweise ohne Groß-/Kleinschreibung und Randleerraum verglichen). */
  doppelt: string[]
}

/** Weniger als diese Quote gilt als Warnung. */
export const QUOTE_MINDESTENS = 0.5

const schluessel = (t: string): string => t.trim().toLowerCase()

/**
 * Die Quote eines Titels, dessen Folgentitel aus der TMDB-Containerstaffel stammen; sonst undefined. Herkunft: die Zuordnung liefert Titel,
 * und die Folgendatei trägt an jeder dieser Nummern genau diesen Titel (eine andere Stufe schriebe einen anderen Wortlaut).
 */
export function staffelQuote(t: Title, franchise: TmdbEintrag | undefined, datei: FolgenDatei | undefined): StaffelQuote | undefined {
  if (!datei) return undefined
  const aus = tmdbStaffelFolgentitel(t, franchise, datei.f.map(([nr]) => nr))
  if (!aus) return undefined
  const inDatei = new Map(datei.f.map(([nr, titel]) => [nr, titel] as const))
  if (![...aus].every(([nr, titel]) => inDatei.get(nr) === titel)) return undefined
  const titel = datei.f.filter(([, x]) => x).map(([, x]) => schluessel(x))
  const doppelt = [...new Set(titel.filter((x, i) => titel.indexOf(x) !== i))]
  return { titel: titel.length, folgen: t.episodes ?? 0, doppelt }
}

/** Gründe für eine Warnung; leer, wenn die Quote reicht und kein Titel doppelt vorkommt. */
export function quoteGruende(q: StaffelQuote): string[] {
  const gruende: string[] = []
  if (q.titel / q.folgen < QUOTE_MINDESTENS) gruende.push(`nur ${q.titel} von ${q.folgen} Folgen mit Titel`)
  if (q.doppelt.length) gruende.push(`doppelte Titel: ${q.doppelt.join(', ')}`)
  return gruende
}
