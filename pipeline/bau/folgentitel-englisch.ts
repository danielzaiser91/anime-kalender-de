/**
 * **Unübersetzte Serien** (Daniel, F57, „nur deutsche"): Holt eine Quelle ohne aniSearch-Titel (Crunchyroll, TMDB) für eine ganze
 * Serie nur den englischen Titel (Burn the Witch: 3 von 3 gleich Kitsu/TMDB), zeigen wir keinen. Einzelne Gleichheiten sind
 * Eigennamen oder Songtitel (Gantz „Kurono Alien", Black Torch 8 von 12) und bleiben stehen: erst ab 90 % und drei Zeilen gilt die Serie als unübersetzt.
 * Gemessen am 01.11.2026 über 36.702 Titel: 1 Serie (116673), die nächstgrößte hat 67 %.
 */
export interface EnglischFolge {
  nr: number
  de?: string
}

const MIN_ZEILEN = 3

/** Titel zum Vergleich: Kleinschreibung, gerade Hochkommas, ohne Satzzeichen. */
export function vergleichsform(s: string | undefined | null): string {
  return (s ?? '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * Nummern, deren Titel nicht aus aniSearch stammt (`asDe` hat sie nicht) und die bei einer unübersetzten Serie dem englischen Titel gleichen.
 * Leer, wenn die Serie nicht unübersetzt ist. `englisch` sind die englischen Titel aus Kitsu, TMDB und aniSearch.
 */
export function unuebersetzteNummern(zeilen: readonly (readonly [number, string, ...unknown[]])[], asDe: ReadonlySet<number>, englisch: readonly (string | undefined | null)[]): Set<number> {
  const en = new Set(englisch.map(vergleichsform).filter(Boolean))
  const fremdQuelle = zeilen.filter(([nr, t]) => t && !asDe.has(nr))
  const gleich = fremdQuelle.filter(([, t]) => en.has(vergleichsform(t)))
  const unuebersetzt = gleich.length >= MIN_ZEILEN && gleich.length * 10 >= fremdQuelle.length * 9
  return new Set(unuebersetzt ? gleich.map(([nr]) => nr) : [])
}

/** Die Folgen ohne den Titel der unübersetzten Nummern; sonst dieselbe Liste. */
export function ohneEnglischeTitel<T extends EnglischFolge>(f: T[], asDe: ReadonlySet<number>, englisch: readonly (string | undefined | null)[]): T[] {
  const weg = unuebersetzteNummern(f.map((x) => [x.nr, x.de ?? ''] as const), asDe, englisch)
  return weg.size ? f.map((x) => (weg.has(x.nr) ? { ...x, de: undefined } : x)) : f
}

/** Die englischen Vergleichstitel eines Titels: Kitsu (immer englisch), TMDB-`en`, aniSearch-`en`. */
export function englischeTitel(kitsu: { f?: [number, string, number][] } | undefined, tmdb: { folgen?: { en?: string | null }[] } | undefined, asFolgen: { en?: string }[] | undefined): (string | null | undefined)[] {
  return [...(kitsu?.f ?? []).map((x) => x[1]), ...(tmdb?.folgen ?? []).map((x) => x.en), ...(asFolgen ?? []).map((x) => x.en)]
}
