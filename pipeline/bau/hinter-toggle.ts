import type { Release, ReleaseEvent, Title } from '../../shared/types.ts'
import { log } from '../lib/util.ts'
import { nurOmuTitel } from './omu-ohne-termin.ts'
import { anisearchNurKatalog } from './anisearch-titel.ts'
import { ausgestrahltOhneBeleg, keineSynchroGilt, ohneSynchroVonHand } from './ohne-beleg.ts'

/**
 * Titel, deren japanische Ausstrahlung noch gar nicht begonnen hat, gehören
 * hinter den Toggle „Anime ohne deutsche Synchro".
 *
 * Daniels Begründung ist zwingend (15.08.2026): „wenn nichtmal jap release,
 * dann logischerweise kein de release." Eine deutsche Synchro entsteht aus
 * einer japanischen Fassung; gibt es die noch nicht, kann es die Synchro auch
 * nicht geben. Was MyDubList dazu führt, ist dann eine **Ankündigung**, und
 * die im selben Topf mit erschienenen Synchros zu führen macht aus einer
 * Ankündigung eine Tatsache.
 *
 * Der Filter ist bewusst grob — das ist er auch in Daniels Auswahl gewesen.
 * Die schärfere Regel („mindestens eine Folge auf Deutsch erschienen") setzt
 * eine verlässliche Synchro-Erkennung voraus, und die ist es gerade nicht:
 * Crunchyroll zeigt Gästen weniger als Angemeldeten, siehe CLAUDE.md. Eine
 * scharfe Regel auf unscharfen Daten würde Titel verstecken, die längst
 * synchronisiert sind.
 *
 * Verloren geht dabei nichts: Die Titel stehen weiter in `ohne-synchro.json`,
 * sind über den Toggle auffindbar, lassen sich merken, und der Newsletter
 * meldet sich, sobald eine Synchro belegt ist.
 *
 * Die Verschobenen werden aufbewahrt, nicht weggeworfen: `schreibeOhneSynchro` bekommt sie übergeben
 * und trägt nach, wer nicht schon über den AniList-Katalog dorthin gelangt. Ohne diese Liste hing es
 * vom Zufall ab, ob ein Titel hinter dem Toggle wieder auftaucht.
 *
 * Ein Titel mit Terminen, die alle nur Originalton nennen (`nurOmuTitel`), wandert ebenfalls und nimmt seine Termine mit
 * (Daniel, 26.10.2026): Nächste Folge und Folgenzähler liefen sonst, als gäbe es eine deutsche Fassung. Deutsche Sprechrollen halten ihn drin.
 */
export function verschiebeHinterToggle({ titles, releases, jpStart, mitStimmen, heuteIso }: {
  titles: Map<number, Title>
  releases: Release[]
  jpStart: Map<number, string>
  mitStimmen: Set<number>
  heuteIso: string
}): Title[] {
  const mitRelease = new Set(releases.map((r) => r.titleId))
  const verschoben: Title[] = []
  const handNein = new Set([...ohneSynchroVonHand(), ...anisearchNurKatalog()])
  const nurOmu = nurOmuTitel(titles, releases)
  for (const id of [...titles.keys()]) {
    if (nurOmu.has(id) && !mitStimmen.has(id)) {
      verschoben.push(titles.get(id)!)
      titles.delete(id)
      continue
    }
    if (mitRelease.has(id)) continue
    /**
     * Deutsche Sprechrollen schlagen jede Ableitung.
     *
     * Ein deutscher Sprecher zu einer Rolle belegt, dass eine deutsche Fassung
     * **existiert** — das ist kein Indiz, sondern eine Auskunft. Sie gilt auch
     * gegen ein japanisches Startdatum in der Zukunft: AniList führt für
     * Vorabveröffentlichungen und Kinofassungen mitunter beides.
     */
    if (mitStimmen.has(id) && !handNein.has(id)) continue
    // Ohne bekanntes Startdatum wird nichts entfernt — Unwissen ist kein Beleg.
    const start = jpStart.get(id)
    if (!(start && start > heuteIso) && !handNein.has(id) && !ausgestrahltOhneBeleg(titles.get(id)!, heuteIso) && !keineSynchroGilt(titles.get(id)!, heuteIso)) continue
    const titel = titles.get(id)
    if (titel) verschoben.push(titel)
    titles.delete(id)
  }
  entferneTermineVon(new Set(verschoben.map((t) => t.id)), releases)
  if (verschoben.length) log(`${verschoben.length} Titel hinter den Toggle verschoben: japanische Ausstrahlung steht noch aus oder keine deutsche Fassung belegt`)
  return verschoben
}

/** Nimmt die Releases der verschobenen Titel aus der Liste selbst; sonst verweist ein Release auf einen Titel, den es im Hauptbestand nicht mehr gibt. */
function entferneTermineVon(ids: Set<number>, releases: Release[]): void {
  for (let i = releases.length - 1; i >= 0; i--) {
    if (ids.has(releases[i]!.titleId)) releases.splice(i, 1)
  }
}

/** Die Ereignisse ohne die der verschobenen Titel. */
export function ohneVerschobene(events: ReleaseEvent[], verschoben: Title[]): ReleaseEvent[] {
  const ids = new Set(verschoben.map((t) => t.id))
  return events.filter((e) => !ids.has(e.titleId))
}
