import { expandEvents } from '../../shared/logic.ts'
import { type Release, type ReleaseEvent, type Title } from '../../shared/types.ts'
import { log, readJson, writeJson } from '../lib/util.ts'
import { OUT, mitAnkuendigung } from './grundlagen.ts'
import { nachTagUndZeit } from './10-termine.ts'

/** Rechnet die Termine der Releases nach und sortiert sie in `events` ein; gibt die neuen zurück. */
export function fuegeTermineEin(events: ReleaseEvent[], neue: Release[]): ReleaseEvent[] {
  const termine = neue.flatMap(expandEvents)
  events.push(...termine)
  events.sort(nachTagUndZeit)
  return termine
}

/** Der Kern plus die Titel mit neuem Termin, die ihm fehlen; was schon drinsteht, bleibt unberührt. */
export function kernMitTerminTiteln(kern: Title[], slim: Title[], termine: ReleaseEvent[]): Title[] {
  const drin = new Set(kern.map((t) => t.id))
  const mitTermin = new Set(termine.map((e) => e.titleId))
  return [...kern, ...slim.filter((t) => mitTermin.has(t.id) && !drin.has(t.id)).map(mitAnkuendigung)]
}

/**
 * **Die „Im Angebot seit“-Releases bekommen ihren Termin** (Daniels Entscheidung vom 27.08.2026, umgesetzt 13.10.2026).
 *
 * `13-3-listen.ts` und `13-7-erstausgabe-angebot.ts` hängen ihre Releases erst an, wenn die Termine längst gerechnet sind (`10-termine.ts`);
 * bis dahin bekam keines einen Termin, obwohl das Protokoll „auch als Kalendereintrag“ meldete.
 *
 * Mit dem Termin braucht der Kalender den Titel: `titles-core.json` entstand ebenfalls vorher und kennt diese Titel nicht, die Karte hätte weder
 * Cover noch Namen. Sie werden dort angehängt (nur sie; der Rest der Datei bleibt, wie er war).
 */
export function ergaenzeAngebotTermine({ events, neue, slim }: { events: ReleaseEvent[]; neue: Release[]; slim: Title[] }): number {
  const termine = fuegeTermineEin(events, neue)
  if (!termine.length) return 0
  const kern = kernMitTerminTiteln(readJson<Title[]>(`${OUT}/titles-core.json`, []), slim, termine)
  writeJson(`${OUT}/titles-core.json`, kern)
  log(`${termine.length} Termine für „Im Angebot seit“ nachgetragen, Kern jetzt ${kern.length} Titel`)
  return termine.length
}
