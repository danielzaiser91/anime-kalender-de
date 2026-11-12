import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { streamAdressen } from './fremde-adressen.ts'
import { bekanntZeile } from './zuordnung-fremd-bestand.ts'
import { findeFremdZugeordnete, type FremdZugeordnet, type ZuordnungEintrag } from './zuordnung-fremd.ts'
import { leseZugeordnet } from './prime-meldung-riegel.ts'
import type { BelegAdresse } from './handbeleg-fremde-adresse.ts'
import { liegenGeblieben, type OhneZuordnung } from './meldungen-liste.ts'

/** Ein Zeitpunkt als Datum in Ortszeit Europe/Berlin (aus `fetch-pruefungen.ts` herausgelöst, damit die Datei nicht wächst). */
export function berlinDatum(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(iso))
}

/** Der Besitz an Adressen, gegen den ein neuer Handbeleg geprüft wird (einmal je Lauf geladen). */
export interface Besitz {
  zugeordnet: [string, ZuordnungEintrag][]
  streams: ReadonlyMap<string, string[]>
  belege: BelegAdresse[]
  /** Zahl der Belege, die dieser Lauf wegen fremder Adresse nicht geschrieben hat. */
  verschoben: number
  /** Meldungen (erste ID je Gruppe), bei denen mindestens ein Beleg ausfiel: der Schluss der Schleife meldet sie nicht noch einmal. */
  gruppen: Set<number>
}

export function ladeBesitz(wurzel: string): Besitz {
  const datei = resolve(wurzel, 'data/dub-confirmed.yaml')
  const belege = (existsSync(datei) ? (yaml.load(readFileSync(datei, 'utf8')) as BelegAdresse[] | null) : null) ?? []
  return { zugeordnet: Object.entries(leseZugeordnet<ZuordnungEintrag>()), streams: streamAdressen(wurzel), belege, verschoben: 0, gruppen: new Set() }
}

/**
 * **Ein neuer Handbeleg an einer Adresse, die schon einem anderen Titel gehört** (12.11.2026, Anlass: Beleg 143277 an der
 * Prime-Seite von 155645 machte `check-zuordnung-fremd-bestand` und damit den Bestandsbau rot). Dieselbe Besitz-Logik wie die
 * Prüfung (`findeFremdZugeordnete`): gesucht sind die Treffer, die erst durch den Beleg entstehen. Ist die Kennung selbst
 * Besitzerin der Adresse, entsteht keiner. Teilt die Meldung die Seite mit dem Besitzer (`mitBeteiligte`: alle Titel der
 * Meldung, z. B. die JoJo-Staffeln an einer ADN-Seite), schreibt der Lauf dessen Beleg selbst: kein Treffer.
 */
export function fremdeBesitzer(besitz: Besitz, kennung: number, mitBeteiligte: readonly number[], url: string): FremdZugeordnet[] {
  const vorher = new Set(findeFremdZugeordnete(besitz.zugeordnet, besitz.streams, besitz.belege).map(bekanntZeile))
  const mit = findeFremdZugeordnete(besitz.zugeordnet, besitz.streams, [...besitz.belege, { anilistId: kennung, url }])
  return mit.filter((t) => !vorher.has(bekanntZeile(t)) && !mitBeteiligte.includes(t.titleId))
}

/** Die Zeile für Lauf-Log und Arbeitsliste: wem die Adresse gehört (Titel der Zuordnung), der Beleg wird nicht geschrieben. */
export const fremdBesitzText = (t: FremdZugeordnet): string => `Adresse gehört schon Titel ${t.titleId}`

/**
 * Schützt vor dem Schreiben: gehört die Adresse schon einem anderen Titel, wird kein Beleg geschrieben. Die Meldung bleibt im
 * Briefkasten (verschoben, nicht gelöscht), steht in Warnungen und Arbeitsliste und zählt in `besitz.verschoben`.
 * Gibt `true` zurück, wenn der Beleg ausfällt.
 */
export function verschiebeFremdenBeleg(
  besitz: Besitz,
  kennung: number,
  ids: readonly number[],
  url: string,
  gruppe: readonly { id: number }[],
  p: { url: string; plattform: string; befund: string; serientitel: string | null; titel: string | null },
  warnungen: string[],
  liste: OhneZuordnung[],
): boolean {
  const fremd = fremdeBesitzer(besitz, kennung, ids, url)
  if (!fremd.length) return false
  besitz.verschoben++
  besitz.gruppen.add(gruppe[0]!.id)
  const grund = `Beleg für Titel ${kennung} (Meldung ${gruppe.map((x) => x.id).join(', ')}) nicht geschrieben: ${[...new Set(fremd.map(fremdBesitzText))].join(', ')}`
  liegenGeblieben(warnungen, liste, p, grund, [kennung], `Seite ${url} gehört schon einem anderen Titel: Zuordnung klären (Beleg wird nicht geschrieben)`)
  return true
}
