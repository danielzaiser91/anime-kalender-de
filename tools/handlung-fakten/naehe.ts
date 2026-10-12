/** Wortnähe: gemeinsame Wortfolgen eines eigenen Textes mit seinen Quelltexten (aus dem PoC vom 12.10.2026). Ein gemeinsamer 5-Wort-Abschnitt ist ein Fehler. */

export const FEHLER_AB = 5

export const woerter = (t: string): string[] =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

function gramme(w: string[], n: number): Set<string> {
  const s = new Set<string>()
  for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' '))
  return s
}

/** Längste gemeinsame Wortfolge (Suffix-Verfahren über die Positionen jedes Wortes in `b`). */
export function laengsteFolge(a: string[], b: string[]): { len: number; folge: string } {
  const pos = new Map<string, number[]>()
  b.forEach((w, j) => pos.set(w, [...(pos.get(w) ?? []), j]))
  let best = { len: 0, ende: 0 }
  let vorher = new Map<number, number>()
  for (let i = 0; i < a.length; i++) {
    const jetzt = new Map<number, number>()
    for (const j of pos.get(a[i]!) ?? []) {
      const len = (vorher.get(j - 1) ?? 0) + 1
      jetzt.set(j, len)
      if (len > best.len) best = { len, ende: i }
    }
    vorher = jetzt
  }
  return { len: best.len, folge: a.slice(best.ende - best.len + 1, best.ende + 1).join(' ') }
}

export interface NaeheZeile {
  quelle: string
  woerterQuelle: number
  gemeinsam5: number
  gemeinsam4: number
  gemeinsam3: number
  laengste: number
  folge: string
}

export function vergleiche(eigenerText: string, quelle: { name: string; text: string }): NaeheZeile {
  const eigen = woerter(eigenerText)
  const w = woerter(quelle.text)
  const gemeinsam = (n: number) => {
    const fremd = gramme(w, n)
    return [...gramme(eigen, n)].filter((x) => fremd.has(x)).length
  }
  const l = laengsteFolge(eigen, w)
  return {
    quelle: quelle.name,
    woerterQuelle: w.length,
    gemeinsam5: gemeinsam(5),
    gemeinsam4: gemeinsam(4),
    gemeinsam3: gemeinsam(3),
    laengste: l.len,
    folge: l.folge,
  }
}

export function istBestanden(zeilen: NaeheZeile[]): boolean {
  return zeilen.every((z) => z.laengste < FEHLER_AB)
}
