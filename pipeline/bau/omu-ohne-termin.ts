import type { ReleaseEvent, Title } from '../../shared/types.ts'
import { deutschLautAnisearch, deutschGeplantLautAnisearch } from './ohne-beleg.ts'

/**
 * **Ein Termin, dessen Quelle nur den Originalton nennt, gehört nicht in den Kalender**, solange weder eine deutsche Fassung
 * belegt noch eine angekündigt ist (Daniel, 14.10.2026, Dragon Ball Super: Beerus auf Netflix: „keine Deutsch-Ankündigung = Erwartung OmU = kein Eintrag").
 * Der Titel bleibt im Bestand, auch die Releases (der Weg trägt weiter „nur Untertitel“); nur die Ereignisse entfallen.
 */
export function omuOhneDeutschBeleg(t: Title | undefined): boolean {
  if (!t) return false
  if (t.streams.some((s) => s.dub === true) || t.deErstausgabe) return false
  if (t.ankuendigung?.synchro === 'angekuendigt') return false
  return !deutschLautAnisearch(t) && !deutschGeplantLautAnisearch(t.id)
}

/** Lässt die OmU-Termine der Titel ohne Deutsch-Beleg weg; alles andere (auch `sprache: 'offen'`) bleibt. */
export function ohneOmuTermine(events: ReleaseEvent[], titles: Map<number, Title>): ReleaseEvent[] {
  return events.filter((e) => !(e.sprache === 'omu' && omuOhneDeutschBeleg(titles.get(e.titleId))))
}
