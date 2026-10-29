import type { Title } from '@shared/types.ts'

/**
 * **Ecchi-Titel sind ausgeblendet, bis jemand sie in den Einstellungen zeigt** (Daniel, 28.10.2026).
 *
 * Die Wahl liegt im Browser (`localStorage`) und gilt nach dem Neuladen: Die Datendateien werden einmal beim Laden gefiltert
 * (`data.ts`), nicht in jeder Ansicht. Titel-Nachschläge (`titleById`, geteilter Link `/t/<id>`) bleiben vollständig.
 */
const SCHLUESSEL = 'ecchiZeigen'
const GENRE = 'Ecchi'

export function ecchiZeigen(): boolean {
  try {
    return localStorage.getItem(SCHLUESSEL) === '1'
  } catch {
    /* Gesperrter Speicher: dann gilt die Vorgabe, ausblenden. */
    return false
  }
}

export function ecchiSetzen(zeigen: boolean): void {
  try {
    if (zeigen) localStorage.setItem(SCHLUESSEL, '1')
    else localStorage.removeItem(SCHLUESSEL)
  } catch {
    /* Gesperrter Speicher: die Wahl gilt dann nicht. */
  }
}

/** Die eine Regel, was „Ecchi“ ist: das Genre. */
export const istEcchi = (t: Pick<Title, 'genres'>): boolean => t.genres?.includes(GENRE) === true

const versteckt = new Map<number, Title>()

/** Die Titel ohne Ecchi, solange die Vorgabe gilt; die ausgeblendeten merkt sich `versteckteEcchi` für den Suchhinweis. */
export function ohneEcchi(titel: Title[], zeigen = ecchiZeigen()): Title[] {
  if (zeigen) return titel
  const sichtbar: Title[] = []
  for (const t of titel) {
    if (istEcchi(t)) versteckt.set(t.id, t)
    else sichtbar.push(t)
  }
  return sichtbar
}

/** Ecchi-Titel, die beim Laden ausgeblendet wurden (leer, wenn der Schalter an ist). */
export const versteckteEcchi = (): Title[] => [...versteckt.values()]

/** Nur für Tests. */
export const vergissVersteckte = (): void => versteckt.clear()

/** Ob dieser Titel gerade ausgeblendet ist — für Listen, die nicht über die geladenen Titel laufen (Meldungen). */
export const istAusgeblendet = (t: Title | undefined): boolean => t !== undefined && istEcchi(t) && !ecchiZeigen()

/** Ein Genre-Filter „Ecchi“ aus Adresse oder Merkzettel gilt bei ausgeblendetem Ecchi nicht: er ergäbe eine leere Liste ohne Chip. */
export function ohneEcchiGenre<F extends { genres: string[] }>(filters: F, zeigen = ecchiZeigen()): F {
  if (zeigen || !filters.genres.includes(GENRE)) return filters
  return { ...filters, genres: filters.genres.filter((g) => g !== GENRE) }
}

/** Die Einträge (Meldungen, Kinofilme), deren Titel gerade nicht ausgeblendet ist; unbekannte Titel bleiben. */
export const ohneAusgeblendete = <T extends { titelId: number }>(liste: T[], titleById: Map<number, Title>): T[] =>
  liste.filter((e) => !istAusgeblendet(titleById.get(e.titelId)))
