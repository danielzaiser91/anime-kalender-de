import { expandEvents } from '../../shared/logic.ts'
import { type Release, type ReleaseEvent, type Title } from '../../shared/types.ts'
import { log, readJson, writeJson } from '../lib/util.ts'
import { OUT, mitAnkuendigung } from './grundlagen.ts'
import { nachTagUndZeit } from './10-termine.ts'
import { markiereErstausgabe } from './erstausgabe-markieren.ts'
import { loadDubChecks, neinHandbelege } from '../lib/dub-confirmed.ts'

/** Rechnet die Termine der Releases nach und sortiert sie in `events` ein; gibt die neuen zurück. */
export function fuegeTermineEin(events: ReleaseEvent[], neue: Release[]): ReleaseEvent[] {
  const termine = neue.flatMap(expandEvents)
  events.push(...termine)
  events.sort(nachTagUndZeit)
  return termine
}

/** Markiert die Erstveröffentlichungen unter den neuen Releases, dann erst werden ihre Termine gerechnet (die Marke hängt an `expandEvents`). */
export function terminiereNeueReleases({ events, neue, alle, titles, handNein }: {
  events: ReleaseEvent[]
  neue: Release[]
  alle: Release[]
  titles: Map<number, Title>
  handNein: ReadonlySet<string>
}): ReleaseEvent[] {
  markiereErstausgabe({ alle, pruefen: neue, titles, handNein })
  return fuegeTermineEin(events, neue)
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
export function ergaenzeAngebotTermine({ events, releases, ab, slim, titles }: {
  events: ReleaseEvent[]
  /** Alle Releases; die ab Index `ab` sind die eben angehängten, die früheren gehören in die Prüfung „kein Anbieter vorher“. */
  releases: Release[]
  ab: number
  slim: Title[]
  titles: Map<number, Title>
},
/* Austauschbar nur für die Prüfung (Kern-Datei, Nein-Handbelege); was fehlt, ist der echte Standard, den die Prüfung festhält. */
quelle: { handNein?: () => ReadonlySet<string>; kern?: { lies: () => Title[]; schreibe: (kern: Title[]) => void } } = {},
): number {
  const handNein = (quelle.handNein ?? (() => neinHandbelege(loadDubChecks())))()
  const termine = terminiereNeueReleases({ events, neue: releases.slice(ab), alle: releases, titles, handNein })
  if (!termine.length) return 0
  const datei = quelle.kern ?? { lies: () => readJson<Title[]>(`${OUT}/titles-core.json`, []), schreibe: (k: Title[]) => writeJson(`${OUT}/titles-core.json`, k) }
  const kern = kernMitTerminTiteln(datei.lies(), slim, termine)
  datei.schreibe(kern)
  log(`${termine.length} Termine für „Im Angebot seit“ nachgetragen, Kern jetzt ${kern.length} Titel`)
  return termine.length
}
