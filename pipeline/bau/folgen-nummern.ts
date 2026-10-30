/**
 * **Eine Nummer, eine Zeile** je Folgenliste (30.10.2026): aniSearch führt manche Folgen doppelt, einmal mit Datum und
 * englischem/japanischem Titel, einmal ohne Datum mit dem deutschen Titel (Sieben Schatten, Teufelsprinzen, Makabe, 1575, 877).
 * Zeilen derselben Nummer, die sich nicht widersprechen, werden zu einer ergänzt. Widersprechen sie sich (zwei Fassungen
 * mit eigenem Titel und Datum), sind es echte Doppelungen: sie bleiben beide stehen und stehen in `ECHTE_DOPPELUNGEN`.
 */
export interface NummernFolge {
  nr: number
  minuten?: number
  de?: string
  en?: string
  ja?: string
  datum?: string
}

/** Titel (AniList-ID) → Nummern, die in der Quelle wirklich zweimal vorkommen: 131586 Folge 10 (zwei Ausstrahlungen mit eigenem Titel), 151126 Folge 13 (Teil 1 und Teil 2). */
export const ECHTE_DOPPELUNGEN: Record<number, number[]> = { 131586: [10], 151126: [13] }

const FELDER = ['minuten', 'de', 'en', 'ja', 'datum'] as const

/** Zwei Zeilen widersprechen sich, wenn ein Feld in beiden steht und verschieden ist. */
function widersprechen(a: NummernFolge, b: NummernFolge): boolean {
  return FELDER.some((k) => a[k] !== undefined && b[k] !== undefined && a[k] !== b[k])
}

/** Ergänzt `a` um die Felder von `b`, die `a` fehlen. */
function ergaenze(a: NummernFolge, b: NummernFolge): NummernFolge {
  const aus: NummernFolge = { ...a }
  for (const k of FELDER) if (aus[k] === undefined && b[k] !== undefined) Object.assign(aus, { [k]: b[k] })
  return aus
}

/** Fasst Zeilen gleicher Nummer zusammen, die sich nicht widersprechen; die Reihenfolge der ersten Zeile bleibt. `verschmolzen` zählt die entfallenen Zeilen. */
export function eineZeileJeNummer<T extends NummernFolge>(f: T[]): { folgen: T[]; verschmolzen: number } {
  const aus: T[] = []
  let verschmolzen = 0
  for (const zeile of f) {
    const index = aus.findIndex((x) => x.nr === zeile.nr && !widersprechen(x, zeile))
    if (index < 0) {
      aus.push(zeile)
      continue
    }
    aus[index] = ergaenze(aus[index], zeile) as T
    verschmolzen++
  }
  return { folgen: aus, verschmolzen }
}

/** Nummern, die in einer Folgenliste mehrfach vorkommen. */
export function doppelteNummern(nummern: number[]): number[] {
  const gesehen = new Set<number>()
  const doppelt = new Set<number>()
  for (const n of nummern) (gesehen.has(n) ? doppelt : gesehen).add(n)
  return [...doppelt].sort((a, b) => a - b)
}

/** Doppelte Nummern einer Liste, die nicht als echte Doppelung des Titels vermerkt sind. */
export function unerlaubteDoppelte(titelId: number, nummern: number[]): number[] {
  const erlaubt = ECHTE_DOPPELUNGEN[titelId] ?? []
  return doppelteNummern(nummern).filter((n) => !erlaubt.includes(n))
}
