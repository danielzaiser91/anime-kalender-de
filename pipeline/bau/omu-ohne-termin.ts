import type { Release, ReleaseEvent, Title } from '../../shared/types.ts'
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

/**
 * **Ein Titel, dessen Termine alle nur Originalton nennen, steht nicht im Hauptbestand** (Daniel, 26.10.2026, Beerus: „keiner der
 * Anbieter hat deutsche Synchro“). Ein einziger Termin ohne `sprache: 'omu'` (oder nur `offen`, also unklar) hält ihn drin, ebenso jeder
 * Deutsch-Beleg derselben Regel wie bei den Terminen (`omuOhneDeutschBeleg`). Widerlegte Termine zählen nicht.
 */
export function nurOmuTitel(titles: Map<number, Title>, releases: Release[]): Set<number> {
  const sprachen = new Map<number, (string | undefined)[]>()
  for (const r of releases) {
    if (r.widerlegt) continue
    sprachen.set(r.titleId, [...(sprachen.get(r.titleId) ?? []), r.sprache])
  }
  return new Set([...sprachen.keys()].filter((id) => sprachen.get(id)!.every((s) => s === 'omu') && omuOhneDeutschBeleg(titles.get(id))))
}
