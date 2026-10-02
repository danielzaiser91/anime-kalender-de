import type { Title } from '../../shared/types.ts'
import type { CrSerie, CrStaffel, Urteil } from './crunchyroll-dub.ts'
import { ankuendigungenLaden, type Ankuendigung } from './ankuendigungen.ts'
import { ROOT } from './util.ts'

/**
 * **Alle Blöcke deutsch heißt nicht: alle unsere Staffeln deutsch.** Ein Eintrag, der erst nach der
 * Prüfung der Serie beginnt, kann in ihren Blöcken nicht stehen (`vorDemStart`) und bleibt ohne
 * Urteil, bis ein neuer Abruf ihren Block zeigt.
 *
 * Anlass: „A Wild Last Boss Appeared!" Staffel 2 stand als „Auf Deutsch
 * verfügbar" — Staffel 1 (12 von 12 deutsch, geprüft 21.09.) war der einzige Block unter derselben
 * Kennung, Staffel 2 startete am 26.09. nur mit Untertiteln. Eine Zuordnung über die Folgenzahl
 * wurde gemessen und verworfen: Crunchyroll zählt zu oft anders (74 echte Synchros verlören ihr
 * Urteil, etwa Iruma Staffel 4 mit 23 statt 24 Folgen).
 */
export function vollstaendigDeutsch(serie: CrSerie, staffeln: CrStaffel[], unsere: Title[]): Urteil[] {
  return unsere
    .filter((t) => !vorDemStart(t, serie.geprueftAm))
    .map((t) => ({ titleId: t.id, dub: true, grund: `alle ${staffeln.length} Blöcke vollständig deutsch` }))
}

/**
 * **Eine Messung vor dem Untertitel-Start sagt nichts über die Staffel** — sie kann darin nicht
 * vorkommen. Gilt für die Blockliste (`geprueftAm`) wie für den Katalog (`geholtAm`). Gemessen am
 * 27.09.2026: vier Titel mit angekündigter Synchro standen so auf Deutsch (Last Boss S2, Black
 * Clover S2, Apothekerin S3, Reincarnated Aristocrat S3), sonst keiner.
 */
export function vorDemStart(t: Title, stand: string | undefined): boolean {
  const omuAb = ankuendigungVon(t)?.omuAb
  return Boolean(stand && omuAb && omuAb > stand.slice(0, 10))
}

/**
 * Die Ankündigung eines Titels. **Im Bau hängt sie noch nicht am Titel** — `mitAnkuendigung` setzt
 * sie erst beim Schreiben von `titles.json`; der erste Fix las nur das Feld und griff deshalb im
 * Bestandslauf nie (gemessen 27.09.2026: Staffel 2 blieb deutsch). Darum aus der Datei selbst.
 */
let ankuendigungen: Map<number, Ankuendigung> | undefined
function ankuendigungVon(t: Title): Pick<Ankuendigung, 'omuAb' | 'synchro'> | undefined {
  ankuendigungen ??= ankuendigungenLaden(ROOT)
  return t.ankuendigung ?? ankuendigungen.get(t.id)
}
