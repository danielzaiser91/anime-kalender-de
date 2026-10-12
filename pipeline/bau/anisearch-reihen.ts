import { otherZaehlt } from '../../shared/mappings.ts'

/**
 * **Reihen aus aniSearch-Beziehungen** (Stufe C der AniList-Ablösung, 10.10.2026): Titel, die über zählende Beziehungen (oder gleiche MAL-Kennung)
 * zusammenhängen, bilden eine Reihe. Nur Messung — ausgeliefert wird weiter die `franchiseId` aus `03-reihen.ts`. Reine Funktionen; gelesen und
 * geschrieben wird in `anisearch-reihen-abweichungen.ts`. Rechnet in aniSearch-Kennungen (Titel mit gleicher Kennung sind dieselbe Einheit).
 */
export type Kante = { a: number; b: number; art: string }
/** `nie`; `immer`; Zahl = Mindestlänge des gemeinsamen Namensanfangs (Wörter ganz, wie `otherZaehlt`). */
export type Bedingung = 'nie' | 'immer' | number
export type Regel = Record<string, Bedingung>

/** Die Art, mit der gleiche MAL-Kennungen als Kante eingehen. */
export const ART_MAL = 'MAL'

/**
 * Regel, eingestellt an Hälfte A der Titel (Koordinatensuche über nie/5/8/12/immer je Sammelart) und geprüft an Hälfte B; Hälften siehe `anisearch-reihen-vergleich.ts`.
 * Stand 10.10.2026, 14.245 Titel mit Seite: gleiche Mitglieder wie die `franchiseId` bei A 76,1 % (eingestellt), B 79,0 % (Gegenprobe); nur Kernarten: A 64,6 %, B 67,5 %.
 * Kernarten zählen immer; Sammelarten (`Anderes`, `Charakter`, `Gemeinsames Universum`, `Crossover`, `?`) nach der Bedingung; alles andere nie.
 */
export const REGEL: Regel = {
  Sequel: 'immer',
  Prequel: 'immer',
  Hauptgeschichte: 'immer',
  Nebengeschichte: 'immer',
  Zusammenfassung: 'immer',
  'Komplette Geschichte': 'immer',
  'Alternative Version': 'immer',
  'Alternative Umgebung': 'immer',
  Remake: 'immer',
  [ART_MAL]: 'immer',
  '?': 'immer',
  Anderes: 5,
  Charakter: 12,
  'Gemeinsames Universum': 5,
  Crossover: 12,
}

export type Namen = Map<number, string[]>

/** Zählt die Kante als Reihenzugehörigkeit? Die Namensbedingung nutzt dieselbe Wortanfang-Regel wie AniLists `OTHER` (`otherZaehlt`). */
export function zaehlt(k: Kante, regel: Regel, namen: Namen): boolean {
  const b = regel[k.art] ?? 'nie'
  if (b === 'nie') return false
  if (b === 'immer') return true
  return otherZaehlt(namen.get(k.a) ?? [], namen.get(k.b) ?? [], b)
}

/** Union-Find: liefert zu jeder Kennung die Wurzel ihrer Komponente (die kleinste Kennung); unbekannte Kennungen sind ihre eigene Wurzel. */
export function komponenten(paare: Iterable<[number, number]>): (id: number) => number {
  const eltern = new Map<number, number>()
  const find = (x: number): number => {
    let r = x
    while (eltern.has(r) && eltern.get(r) !== r) r = eltern.get(r)!
    return r
  }
  for (const [a, b] of paare) {
    const [ra, rb] = [find(a), find(b)]
    if (ra === rb) continue
    eltern.set(Math.max(ra, rb), Math.min(ra, rb))
    eltern.set(Math.min(ra, rb), Math.min(ra, rb))
  }
  return find
}

/** Die Wurzelfunktion der Reihen, die die Kanten unter der Regel bilden. */
export const reihenWurzel = (kanten: Kante[], regel: Regel, namen: Namen): ((id: number) => number) =>
  komponenten(kanten.filter((k) => zaehlt(k, regel, namen)).map((k): [number, number] => [k.a, k.b]))

/** Kanten zwischen aniSearch-Kennungen, deren Titel dieselbe MAL-Kennung tragen. */
export function malKanten(einheiten: { anisearchId?: number; mal?: number }[]): Kante[] {
  const jeMal = new Map<number, number[]>()
  for (const e of einheiten) {
    if (!e.mal || !e.anisearchId) continue
    const l = jeMal.get(e.mal) ?? []
    if (!l.includes(e.anisearchId)) l.push(e.anisearchId)
    jeMal.set(e.mal, l)
  }
  return [...jeMal.values()].flatMap((l) => l.slice(1).map((b): Kante => ({ a: l[0]!, b, art: ART_MAL })))
}
