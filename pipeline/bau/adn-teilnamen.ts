/**
 * **Ist der Teil selbst der Eintrag, gehört seine Nummer in den Namen** (22.09.2026).
 *
 * `werkTitel()` schneidet „– Teil N" ab, damit ein Block nicht wie das Werk
 * heißt. Führt AniList den Teil aber als eigenen Eintrag („Girls und Panzer das
 * Finale - Part 4", „BEASTARS Final Season Part 2"), ist die Nummer der Name des
 * Werks. Gemessen am selben Tag: 20 Titel verloren sie, darunter zweimal „Pretty
 * Guardian Sailor Moon Eternal: Der Film" und zweimal „Beastars Letzte Staffel"
 * — zwei Einträge, ein Name. Anlass: Teil 4 von Girls und Panzer: Das Finale
 * hieß ohne Nummer neben „Teil 1" bis „Teil 3" (Daniel an der Videoload-Suche).
 *
 * Liegt in einer eigenen Datei, weil `ergaenzeAdnTitel` die Längengrenze reißt.
 */
import type { Title } from '../../shared/types.ts'

export function ergaenzeTeilnamen(titles: Map<number, Title>): number {
  let teilNamen = 0
  for (const title of titles.values()) {
    if (!title.titleDe) continue
    const quelle = [title.titleEn, title.titleRomaji].find((s) => /(?:part|teil|vol\.?|volume)\s*\d+\s*$/i.test(s ?? ''))
    const nr = quelle?.match(/(\d+)\s*$/)?.[1]
    if (!nr || new RegExp(`\\b${nr}\\b`).test(title.titleDe)) continue
    title.titleDe = `${title.titleDe} – Teil ${nr}`
    teilNamen++
  }
  return teilNamen
}
