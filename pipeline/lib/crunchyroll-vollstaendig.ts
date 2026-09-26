import type { Title } from '../../shared/types.ts'
import type { CrSerie, CrStaffel, Urteil } from './crunchyroll-dub.ts'

/**
 * **Alle Blöcke deutsch heißt nicht: alle unsere Staffeln deutsch.** Ein Eintrag, der erst nach der
 * Prüfung der Serie beginnt, kann in ihren Blöcken nicht stehen; einer, dessen Synchro nur
 * angekündigt ist, hat noch keine. Beide bleiben ohne Urteil, bis ein neuer Abruf ihren Block zeigt.
 *
 * Anlass (Daniel, 27.09.2026): „A Wild Last Boss Appeared!" Staffel 2 stand als „Auf Deutsch
 * verfügbar" — Staffel 1 (12 von 12 deutsch, geprüft 21.09.) war der einzige Block unter derselben
 * Kennung, Staffel 2 startete am 26.09. nur mit Untertiteln. Eine Zuordnung über die Folgenzahl
 * wurde gemessen und verworfen: Crunchyroll zählt zu oft anders (74 echte Synchros verlören ihr
 * Urteil, etwa Iruma Staffel 4 mit 23 statt 24 Folgen).
 */
export function vollstaendigDeutsch(serie: CrSerie, staffeln: CrStaffel[], unsere: Title[]): Urteil[] {
  return unsere
    .filter((t) => t.ankuendigung?.synchro !== 'angekuendigt')
    .filter((t) => !serie.geprueftAm || !t.ankuendigung?.omuAb || t.ankuendigung.omuAb <= serie.geprueftAm)
    .map((t) => ({ titleId: t.id, dub: true, grund: `alle ${staffeln.length} Blöcke vollständig deutsch` }))
}
