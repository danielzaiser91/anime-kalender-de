/**
 * Riegel „Meldung nennt Staffel ab 2, Treffer ist der Reihenkopf" (07.09.2026, Date a Live): die Seite wird verworfen.
 *
 * Ausnahme (03.11.2026, Z wie Zorro): Führt unser Titel mehr Folgen als die gemeldete Seite und liegen alle eindeutigen
 * Folgentreffer (Titel oder Datum; ordneZu rät nie nach Position) jenseits der ersten `seitenFolgen` Folgen, ist die Seite die zweite Hälfte
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

/** Mindestzahl eindeutiger Treffer jenseits der Seitenlänge: ein Titelzufall (ein Treffer) rettet keine Fortsetzungsseite. */
const MIN_TREFFER = 2

/** Eindeutige Folgentreffer der Seite in unserer Zählung, über alle Anker-Listen. */
function treffer(e: RiegelEingabe): number[] {
  const t: number[] = []
  for (const liste of e.ankerListen) {
    for (const z of ordneZu(e.anbieter, liste.folgen)) {
      if (z.unsere !== null) t.push(z.unsere)
    }
  }
  return t
}

/** Trefferzahl, wenn alle jenseits der Seitenlänge liegen (längerer Titel vorausgesetzt), sonst 0. */
function trefferJenseits(e: RiegelEingabe): number {
  const seitenFolgen = e.anbieter.length
  if (!e.titelFolgen || e.titelFolgen <= seitenFolgen) return 0
  const t = treffer(e)
  return t.every((n) => n > seitenFolgen) ? t.length : 0
}

/** Liegt die Seite jenseits der ersten Seite eines längeren Einzeltitels? */
export function istZweiteHaelfte(e: RiegelEingabe): boolean {
  return trefferJenseits(e) >= MIN_TREFFER
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
  if (staffelSeiteVerwerfen(eingabe)) {
    if (gemeldeteStaffel !== null && gemeldeteStaffel > 1 && istReihenkopf && trefferJenseits(eingabe) === 1) {
      log(`Staffel ${gemeldeteStaffel} verworfen (ein Treffer jenseits, Titelzufall möglich: ${titel.titleDe ?? titel.id}): ${url}`)
    }
    return true
  }
  if (gemeldeteStaffel !== null && gemeldeteStaffel > 1 && istReihenkopf) {
    log(`Staffel ${gemeldeteStaffel} behalten (zweite Hälfte von ${titel.titleDe ?? titel.id}): ${url}`)
  }
  return false
}
