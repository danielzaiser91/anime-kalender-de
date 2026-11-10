/**
 * **Nur deutsche Folgentitel** (Daniel, F57, 24.10.2026: „nur deutsche"): Eine Zeile der Folgendatei trägt `de` oder gar keinen Titel,
 * nie den englischen oder japanischen Rückfall aus aniSearch oder Kitsu. `en` und `ja` bleiben als Vergleichswerte im Bau, sie erscheinen nicht.
 */
export interface FolgeQuelle {
  nr: number
  minuten?: number
  de?: string
  en?: string
  ja?: string
}

export type FolgenZeile = [nr: number, titel: string] | [nr: number, titel: string, minuten: number]

/** Die Zeilen der Folgendatei; sind alle Folgen gleich lang (`einheitlich`), steht die Minutenzahl nicht je Zeile. */
export function folgenZeilen(f: FolgeQuelle[], einheitlich: number | undefined): FolgenZeile[] {
  const titel = (x: FolgeQuelle) => (x.de && !istPlatzhalter(x.de) ? x.de : '')
  return f.map((x) => (einheitlich ? [x.nr, titel(x)] : [x.nr, titel(x), x.minuten ?? 0]))
}

/**
 * Zeilen, deren Titel dem englischen oder japanischen Titel der Quelle gleicht, ohne dass die Quelle einen deutschen Titel hat. Soll 0 sein.
 * `belegtDeutsch` (Nummer → Titel einer rein deutschen Quelle, RTL+): ein Titel, den sie auf derselben Nummer führt, ist ein Lehnwort („Partner“), kein Fremdtitel.
 */
export function fremdtitelZahl(zeilen: readonly (readonly [number, string, ...unknown[]])[], quelle: FolgeQuelle[], belegtDeutsch: ReadonlyMap<number, string> = new Map()): number {
  const jeNr = new Map(quelle.map((x) => [x.nr, x]))
  return zeilen.filter(([nr, titel]) => {
    const q = jeNr.get(nr)
    return Boolean(titel) && Boolean(q) && !q!.de && (titel === q!.en || titel === q!.ja) && belegtDeutsch.get(nr) !== titel
  }).length
}

const PLATZHALTER = /^(?:(?:folge|episode|episod|ep\.?)\s*\d+|ohne titel|untitled)$/i

/** „Ohne Titel", „Untitled", „Folge 3" und „Episode 3" sind kein Titel (Flowers of Evil trug 13× „Ohne Titel" aus Crunchyroll). */
export function istPlatzhalter(titel: string): boolean {
  return PLATZHALTER.test(titel.trim())
}

/** Die Liste ohne Platzhalter-Titel („Episode 4“ aus aniSearch): sonst gilt die Folge als benannt, keine Stufe füllt sie, und die Datei bleibt leer. */
export function ohnePlatzhalterTitel<T extends FolgeQuelle>(f: T[] | undefined): T[] | undefined {
  return f?.map((x) => {
    if (!x.de || !istPlatzhalter(x.de)) return x
    const { de: _weg, ...rest } = x
    return rest as T
  })
}
