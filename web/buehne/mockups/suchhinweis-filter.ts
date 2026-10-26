import { EMPTY_FILTERS, LIST_KEYS, type FilterState, type ListKey } from '../../src/lib/filters.ts'

/** Die Schalter des Filters, die nur an oder aus sind (jeder einzeln entfernbar). */
export const SCHALTER = [
  'favoritesOnly',
  'kostenlosOnly',
  'confirmedOnly',
  'availableOnly',
  'favoritesExcluded',
  'kostenlosExcluded',
  'confirmedExcluded',
  'availableExcluded',
  'zweitanbieterExcluded',
] as const
export type SchalterFeld = (typeof SCHALTER)[number]

/** Eine Einheit, die der Nutzer gesetzt hat und die sich geschlossen entfernen lässt: eine Liste (Einschluss oder Ausschluss), ein Schalter, die Mindeststufe. */
export interface Einheit {
  id: string
  art: 'liste' | 'ausschluss' | 'schalter' | 'vertrauen'
  feld: ListKey | SchalterFeld | 'minConfidence'
  entferne: (f: FilterState) => FilterState
}

/** Alle gesetzten Filter als Einheiten; die Suche selbst zählt nicht. */
export function aktiveEinheiten(f: FilterState): Einheit[] {
  const liste: Einheit[] = []
  for (const key of LIST_KEYS) {
    if (f[key].length) liste.push({ id: `liste:${key}`, art: 'liste', feld: key, entferne: (g) => ({ ...g, [key]: [] }) })
    if (f.excluded[key].length) liste.push({ id: `ausschluss:${key}`, art: 'ausschluss', feld: key, entferne: (g) => ({ ...g, excluded: { ...g.excluded, [key]: [] } }) })
  }
  for (const feld of SCHALTER) {
    if (f[feld]) liste.push({ id: `schalter:${feld}`, art: 'schalter', feld, entferne: (g) => ({ ...g, [feld]: false }) })
  }
  if (f.minConfidence !== EMPTY_FILTERS.minConfidence) liste.push({ id: 'vertrauen', art: 'vertrauen', feld: 'minConfidence', entferne: (g) => ({ ...g, minConfidence: EMPTY_FILTERS.minConfidence }) })
  return liste
}

/** Ein Titel, dessen Name genau zur Suche passt; `nurMitSchalter`: er gehört zu den Titeln ohne deutsche Synchro. */
export interface Kandidat<T> {
  titel: T
  nurMitSchalter: boolean
}

/** Was einen exakten Treffer versteckt: die gesetzten Filter, die ihn ausschließen, und ob der Synchro-Schalter dazugehört. */
export interface Blockade<T> {
  titel: T
  einheiten: Einheit[]
  synchro: boolean
}

const ohne = (f: FilterState, einheiten: Einheit[]): FilterState => einheiten.reduce((g, e) => e.entferne(g), f)

function blockadeFuer<T>(k: Kandidat<T>, f: FilterState, synchroAn: boolean, passt: (t: T, f: FilterState) => boolean): Blockade<T> | undefined {
  const alle = aktiveEinheiten(f)
  if (!passt(k.titel, ohne(f, alle))) return undefined
  /* Blockierer: der Titel fällt schon durch, wenn nur diese eine Einheit gesetzt ist. */
  const blockierer = alle.filter((u) => !passt(k.titel, ohne(f, alle.filter((e) => e !== u))))
  const einheiten = passt(k.titel, ohne(f, blockierer)) ? blockierer : alle
  return { titel: k.titel, einheiten, synchro: k.nurMitSchalter && !synchroAn }
}

const umfang = <T>(b: Blockade<T>): number => b.einheiten.length + (b.synchro ? 1 : 0)

/**
 * Warum fehlt der exakte Treffer? `undefined`, wenn einer schon sichtbar ist oder keiner da ist; sonst die kleinste
 * Gruppe von Filtern (samt Synchro-Schalter), nach deren Entfernen ein exakter Treffer erscheint.
 */
export function findeBlockade<T>(kandidaten: Kandidat<T>[], f: FilterState, synchroAn: boolean, passt: (t: T, f: FilterState) => boolean): Blockade<T> | undefined {
  const blockaden = kandidaten.map((k) => blockadeFuer(k, f, synchroAn, passt))
  if (blockaden.some((b) => b && umfang(b) === 0)) return undefined
  let beste: Blockade<T> | undefined
  for (const b of blockaden) if (b && (!beste || umfang(b) < umfang(beste))) beste = b
  return beste
}

/** Die Filter ohne die Einheiten der Blockade (die Suche bleibt). */
export const loeseBlockade = <T>(f: FilterState, b: Blockade<T>): FilterState => ohne(f, b.einheiten)
