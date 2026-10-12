import { falte, ohneGrossschrift, sprecherAnzeige, sprecherSchluessel, type Schreibweisen } from './sprecher-namen.ts'

/**
 * Sprecher eines Titels: aniSearch zuerst, AniList und ANN nur, wo aniSearch den Sprecher nicht führt
 * (Stufe D der AniList-Ablösung, `docs/wissen/quellen.md`, Abschnitt „Sprecher aus aniSearch statt AniList").
 *
 * Eine Rolle aus AniList oder ANN fällt weg, wenn derselbe Sprecher (erstes + letztes Namenswort, gefaltet)
 * bei aniSearch im selben Titel steht — aniSearch führt die ganze Besetzung, AniList höchstens 25 Figuren.
 * Dieselbe Figur mit **anderem** Sprecher bleibt: Das ist eine zweite Besetzung (Neusynchro) oder ein
 * Aliasname, und beides lässt sich nicht aus den Namen entscheiden (`quellen.md`).
 */
export interface Rolle {
  character: string
  actor: string
  role?: string
  /** Fehlt = AniList. */
  von?: 'ann' | 'anisearch'
}

export interface AnisearchRolle {
  figur: string
  sprecher: string
}

export interface Zusammen {
  rollen: Rolle[]
  /** Rollen aus AniList/ANN, die aniSearch ersetzt hat. */
  ersetzt: number
  /** Rollen aus AniList/ANN, die bleiben, weil aniSearch den Sprecher nicht führt. */
  behalten: number
}

const rollenSchluessel = (r: Rolle): string => `${falte(r.character)}|${falte(r.actor)}`

/** Rollen einer Quelle, die aniSearch noch nicht abdeckt. */
function nochNichtAbgedeckt<T extends { actor: string }>(rest: T[], sprecherAS: Set<string>): T[] {
  return rest.filter((r) => !sprecherAS.has(sprecherSchluessel(r.actor)))
}

/** Für die Sammler: neue Rollen einer anderen Quelle ohne die, deren Sprecher aniSearch im Titel schon führt (sonst kämen sie nach jedem Bau wieder). */
export function ohneAnisearchAbgedeckte<T extends { actor: string }>(vorhanden: Rolle[], neu: T[]): T[] {
  const sprecherAS = new Set(vorhanden.filter((r) => r.von === 'anisearch').map((r) => sprecherSchluessel(r.actor)))
  return sprecherAS.size ? nochNichtAbgedeckt(neu, sprecherAS) : neu
}

export function fuehreZusammen(vorhanden: Rolle[], anisearch: AnisearchRolle[], bekannt: Schreibweisen): Zusammen {
  const aus: Rolle[] = []
  const gesehen = new Set<string>()
  for (const a of anisearch) {
    const rolle: Rolle = { character: ohneGrossschrift(a.figur.trim()), actor: sprecherAnzeige(a.sprecher, bekannt), von: 'anisearch' }
    if (!rolle.character || !rolle.actor || gesehen.has(rollenSchluessel(rolle))) continue
    gesehen.add(rollenSchluessel(rolle))
    aus.push(rolle)
  }
  const sprecherAS = new Set(aus.map((r) => sprecherSchluessel(r.actor)))
  const uebrig = vorhanden.filter((r) => r.von !== 'anisearch')
  const bleibt = nochNichtAbgedeckt(uebrig, sprecherAS)
  return { rollen: [...aus, ...bleibt], ersetzt: uebrig.length - bleibt.length, behalten: bleibt.length }
}
