/**
 * Riegel „Meldung nennt Staffel ab 2, Treffer ist der Reihenkopf" (07.09.2026, Date a Live): die Seite wird verworfen.
 *
 * Ausnahme (03.11.2026, Z wie Zorro): Führt unser Titel mehr Folgen als die gemeldete Seite und liegen alle eindeutigen
 * Folgentreffer (Titel/Datum, nie Position) jenseits der ersten `seitenFolgen` Folgen, ist die Seite die zweite Hälfte
 * eines einzelnen Titels (52 Folgen, Prime teilt in zwei Staffeln) und wird behalten.
 */
import { log } from './util.ts'
import { ordneZu, type AnbieterFolge, type TmdbFolge } from '../../shared/folgen-zuordnung.ts'

export interface RiegelEingabe {
  gemeldeteStaffel: number | null
  istReihenkopf: boolean
  /** Folgenzahl unseres Titels. */
  titelFolgen: number | null | undefined
  anbieter: AnbieterFolge[]
  /** Anker-Listen des Titels (aniSearch, TMDB). */
  ankerListen: { folgen: TmdbFolge[] }[]
}

/** Liegt die Seite jenseits der ersten Seite eines längeren Einzeltitels? */
export function istZweiteHaelfte(e: RiegelEingabe): boolean {
  const seitenFolgen = e.anbieter.length
  if (!e.titelFolgen || e.titelFolgen <= seitenFolgen) return false
  const treffer: number[] = []
  for (const liste of e.ankerListen) {
    for (const z of ordneZu(e.anbieter, liste.folgen)) {
      if (z.unsere !== null && z.grund !== 'position') treffer.push(z.unsere)
    }
  }
  return treffer.length > 0 && treffer.every((n) => n > seitenFolgen)
}

/** Wird die Seite vom Staffel-Riegel verworfen? */
export function staffelSeiteVerwerfen(e: RiegelEingabe): boolean {
  if (e.gemeldeteStaffel === null || e.gemeldeteStaffel <= 1 || !e.istReihenkopf) return false
  return !istZweiteHaelfte(e)
}

/** Aufruf aus dem Zuordner: `true` = Seite verwerfen; eine behaltene Seite steht im Lauf-Log (jede einzeln, für die PR-Bilanz). */
export function staffelRiegel(
  url: string,
  gemeldeteStaffel: number | null,
  istReihenkopf: boolean,
  titel: { titleDe?: string | null; id: number; episodes?: number },
  anbieter: AnbieterFolge[],
  ankerListen: { folgen: TmdbFolge[] }[],
): boolean {
  const eingabe = { gemeldeteStaffel, istReihenkopf, titelFolgen: titel.episodes, anbieter, ankerListen }
  if (staffelSeiteVerwerfen(eingabe)) return true
  if (gemeldeteStaffel !== null && gemeldeteStaffel > 1 && istReihenkopf) {
    log(`Staffel ${gemeldeteStaffel} behalten (zweite Hälfte von ${titel.titleDe ?? titel.id}): ${url}`)
  }
  return false
}
