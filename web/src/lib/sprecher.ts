import { sprecherNormal, type SprecherGruppe, type SprecherIndex, type SprecherTitel } from '@shared/sprecher.ts'
import { loadJson } from './data.ts'
import { syncSharePath } from './router.ts'

/**
 * Sprecher-Suche (Vorschau `sprecher-suche`): Der Index `sprecher.json` kommt erst, wenn jemand das Suchfeld
 * fokussiert oder mindestens drei Zeichen sucht — nie im Startpfad. Die Rollen eines Sprechers liegen in
 * `sprecher/<gruppe>.json` und kommen erst beim Aufklappen. Gesucht wird im Browser; nichts verlässt das Gerät.
 */
export const SPRECHER_AB_ZEICHEN = 3

let indexPromise: Promise<SprecherIndex> | undefined
const gruppen = new Map<string, Promise<SprecherGruppe>>()

export function ladeSprecherIndex(): Promise<SprecherIndex> {
  indexPromise ??= loadJson<SprecherIndex>('sprecher.json').catch((e) => {
    indexPromise = undefined
    throw e
  })
  return indexPromise
}

/** Vorladen beim Fokus auf das Suchfeld — Fehler sind hier egal, die Suche versucht es erneut. */
export function sprecherVorladen(): void {
  ladeSprecherIndex().catch(() => undefined)
}

export function ladeSprecherGruppe(gruppe: string): Promise<SprecherGruppe> {
  let p = gruppen.get(gruppe)
  if (!p) {
    p = loadJson<SprecherGruppe>(`sprecher/${gruppe}.json`).catch((e) => {
      gruppen.delete(gruppe)
      throw e
    })
    gruppen.set(gruppe, p)
  }
  return p
}

export interface SprecherTreffer {
  name: string
  titel: number
  gruppe: string
  /** 0 = ganzer Name, 1 = jedes Suchwort am Wortanfang, 2 = irgendwo im Namen. */
  guete: 0 | 1 | 2
}

/**
 * Namensabgleich: jedes Suchwort muss im normalisierten Namen vorkommen; am Wortanfang zählt mehr, der ganze
 * Name am meisten. Bei gleicher Güte zuerst, wer mehr Titel hat. Unscharfe Treffer (Tippfehler) gibt es nicht —
 * ein Name ist eine Behauptung über eine Person, da soll nichts „ungefähr" passen.
 */
export function sucheSprecher(index: SprecherIndex, suche: string, max = 8): { treffer: SprecherTreffer[]; weitere: number } {
  const woerter = sprecherNormal(suche).split(' ').filter(Boolean)
  if (!woerter.length) return { treffer: [], weitere: 0 }
  const ganz = woerter.join(' ')
  const alle: SprecherTreffer[] = []
  for (const [name, titel, gruppe] of index.sprecher) {
    const n = sprecherNormal(name)
    if (!woerter.every((w) => n.includes(w))) continue
    const guete = n === ganz ? 0 : woerter.every((w) => n.startsWith(w) || n.includes(` ${w}`)) ? 1 : 2
    alle.push({ name, titel, gruppe, guete })
  }
  alle.sort((a, b) => a.guete - b.guete || b.titel - a.titel || a.name.localeCompare(b.name, 'de'))
  return { treffer: alle.slice(0, max), weitere: Math.max(0, alle.length - max) }
}

/** Die Titel eines Sprechers, mit den meisten Rollen zuerst. */
export function titelVon(gruppe: SprecherGruppe, name: string): SprecherTitel[] {
  return [...(gruppe[name] ?? [])].sort((a, b) => b.rollen.length - a.rollen.length)
}

/** Aus dem Panel zur Suche nach diesem Namen: Panel zu (Pfad zurück auf die Wurzel), Datenbank mit `q=`. */
export function zurSprecherSuche(name: string): void {
  syncSharePath()
  window.location.hash = `#/datenbank?q=${encodeURIComponent(name)}`
}
