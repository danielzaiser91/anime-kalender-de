import type { EmpfehlungsDatei, Kandidat } from './empfehlung-pool.ts'

/** Genres und Schlagwörter mit mindestens so vielen Einstiegen werden Dimensionen (Simulation Spezifikation 17.1). */
export const MIN_TITEL_JE_MERKMAL = 5

/** Gewicht der Gruppen Film, Jahrfünft, FSK und Länge gegenüber Genre und Schlagwort. */
const GRUPPEN_GEWICHT = 0.5

/** Alles, was die Rechnung über die Pool-Datei weiß; einmal je Datei gebaut, danach nur gelesen. */
export interface Kontext {
  datei: EmpfehlungsDatei
  /** Kennung des Einstiegs → Index in `datei.einstiege`. */
  index: Map<number, number>
  /** L2-normierter Merkmalsvektor je Einstieg. */
  vektoren: Float64Array[]
  /** Cosinus-Ähnlichkeit, Zeile `i` Spalte `j` bei `i * n + j`. */
  aehnlichkeit: Float64Array
}

/** Namen der Gruppen-Dimensionen; ihre Reihenfolge legt nur die Lage im Vektor fest. */
const GRUPPEN = ['film', 'j<2005', 'j2005', 'j2010', 'j2015', 'j2020', 'fsk<=6', 'fsk12', 'fsk16+', 'fskNA', 'kurz', 'mittel', 'lang']

function jahrGruppe(y: number | undefined): string {
  if (y === undefined) return 'j2020'
  return y < 2005 ? 'j<2005' : y < 2010 ? 'j2005' : y < 2015 ? 'j2010' : y < 2020 ? 'j2015' : 'j2020'
}

function fskGruppe(fsk: number | undefined): string {
  if (fsk == null) return 'fskNA'
  return fsk <= 6 ? 'fsk<=6' : fsk === 12 ? 'fsk12' : 'fsk16+'
}

function laengeGruppe(e: number | undefined): string {
  const n = e || 1
  return n <= 13 ? 'kurz' : n <= 26 ? 'mittel' : 'lang'
}

/** Namen beider Wörterbücher zusammengeführt (ein Name in Genre und Schlagwort ist eine Dimension), nach Häufigkeit gefiltert. */
function merkmalsNamen(d: EmpfehlungsDatei): string[] {
  const zaehler = new Map<string, number>()
  for (const k of d.einstiege) {
    const namen = new Set([...k.g.map((i) => d.genres[i]), ...k.k.map((i) => d.keywords[i])])
    for (const n of namen) zaehler.set(n, (zaehler.get(n) ?? 0) + 1)
  }
  return [...zaehler].filter(([, anzahl]) => anzahl >= MIN_TITEL_JE_MERKMAL).map(([n]) => n).sort()
}

function vektorVon(k: Kandidat, d: EmpfehlungsDatei, dim: Map<string, number>, laenge: number): Float64Array {
  const v = new Float64Array(laenge)
  for (const n of [...k.g.map((i) => d.genres[i]), ...k.k.map((i) => d.keywords[i])]) {
    const stelle = dim.get(n)
    if (stelle !== undefined) v[stelle] = 1
  }
  const gruppen = [jahrGruppe(k.y), fskGruppe(k.fsk), laengeGruppe(k.e)]
  if (k.f === 'MOVIE') gruppen.push('film')
  for (const g of gruppen) v[dim.get(g)!] = GRUPPEN_GEWICHT
  let norm = 0
  for (const a of v) norm += a * a
  norm = Math.sqrt(norm) || 1
  return v.map((a) => a / norm)
}

export function baueKontext(datei: EmpfehlungsDatei): Kontext {
  const namen = [...merkmalsNamen(datei), ...GRUPPEN]
  const dim = new Map(namen.map((n, i) => [n, i]))
  const vektoren = datei.einstiege.map((k) => vektorVon(k, datei, dim, namen.length))
  const n = vektoren.length
  const aehnlichkeit = new Float64Array(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0
      for (let m = 0; m < namen.length; m++) s += vektoren[i][m] * vektoren[j][m]
      aehnlichkeit[i * n + j] = s
      aehnlichkeit[j * n + i] = s
    }
  }
  return { datei, index: new Map(datei.einstiege.map((k, i) => [k.id, i])), vektoren, aehnlichkeit }
}

export function cos(k: Kontext, i: number, j: number): number {
  return k.aehnlichkeit[i * k.vektoren.length + j]
}

/** Zufall aus einem Startwert (mulberry32): gleicher Wert, gleiche Folge. */
export function zufall(startwert: number): () => number {
  let s = startwert | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
