import type { Kandidat } from './empfehlung-pool.ts'
import { cos, zufall, type Kontext } from './empfehlung-vektor.ts'

/** Gewertete Duelle bis zu den ersten Vorschlägen, und bis „Noch vier Duelle – genauer“ (Spezifikation 17.4/18). */
export const DUELLE_START = 6
export const DUELLE_MAX = 10
/** Gezeigte Duelle einschließlich „Andere Vorschläge“: danach ist Schluss, auch ohne Antworten. */
export const SCHRITTE_MAX = 30
/** Die Restmenge schrumpft nie unter so viele Titel (die nächsten am Sieger). */
export const UNTERGRENZE_REST = 12
export const VORSCHLAEGE = 5
const PAAR_VERSUCHE = 40

/** Alles, was ein Schritt braucht; reine Daten (JSON), Indizes in `Kontext.datei.einstiege`. */
export interface Zustand {
  startwert: number
  /** Gezeigte Duelle, auch neutrale. */
  schritt: number
  /** Duelle mit Antwort (Fortschritt „n von 6“). */
  gewertet: number
  /** Restmenge: Einstiege „in deiner Richtung“. */
  rest: number[]
  sieger: number[]
  /** Titel, die in einem Duell standen; sie sind kein Vorschlag. */
  gesehen: number[]
  /** Paar des letzten neutralen Duells: das nächste zeigt in eine andere Richtung. */
  neutral: [number, number] | null
  /** Einstiege, die nie als Paar oder Vorschlag kommen (Liste, Geguckt, ★ …). */
  ausgeschlossen: number[]
}

export type Antwort = 'A' | 'B' | 'N'

/** Kennungen beliebiger Pool-Titel → Indizes ihrer Einstiege; Unbekanntes fällt weg. */
export function einstiegsIndizes(k: Kontext, kennungen: number[]): number[] {
  const indizes = new Set<number>()
  for (const id of kennungen) {
    const i = k.index.get(k.datei.reihe[String(id)] ?? id)
    if (i !== undefined) indizes.add(i)
  }
  return [...indizes].sort((a, b) => a - b)
}

/** Start: alle Einstiege außer den ausgeschlossenen (Kennungen beliebiger Teile einer Reihe). */
export function neuerZustand(k: Kontext, startwert: number, ausgeschlossen: number[] = []): Zustand {
  const aus = einstiegsIndizes(k, ausgeschlossen)
  const weg = new Set(aus)
  const rest = k.datei.einstiege.map((_, i) => i).filter((i) => !weg.has(i))
  return { startwert, schritt: 0, gewertet: 0, rest, sieger: [], gesehen: [], neutral: null, ausgeschlossen: aus }
}

function differenz(k: Kontext, a: number, b: number): Float64Array {
  return k.vektoren[a].map((x, m) => x - k.vektoren[b][m])
}

/** 0 = parallel zur Richtung des letzten neutralen Duells, 1 = senkrecht dazu. */
function richtungsAbstand(k: Kontext, a: number, b: number, vorher: [number, number] | null): number {
  if (!vorher) return 1
  const d = differenz(k, a, b)
  const p = differenz(k, vorher[0], vorher[1])
  let punkt = 0
  let nd = 0
  let np = 0
  for (let m = 0; m < d.length; m++) {
    punkt += d[m] * p[m]
    nd += d[m] * d[m]
    np += p[m] * p[m]
  }
  return 1 - Math.abs(punkt / (Math.sqrt(nd * np) || 1))
}

/** Anteil der Restmenge, der näher an `a` als an `b` liegt. */
export function teilung(k: Kontext, rest: number[], a: number, b: number): number {
  let naeher = 0
  for (const t of rest) if (cos(k, t, a) >= cos(k, t, b)) naeher++
  return naeher / rest.length
}

/** Paarkandidaten: nur Einstiege mit Teil 1 im Pool (`duell`), ungesehene zuerst. */
function paarKandidaten(k: Kontext, z: Zustand): number[] {
  const duellfaehig = z.rest.filter((i) => k.datei.einstiege[i].duell === true)
  const frisch = duellfaehig.filter((i) => !z.gesehen.includes(i))
  return frisch.length >= 2 ? frisch : duellfaehig
}

/** Das nächste Paar, eine reine Funktion des Zustands; `null`, wenn keins mehr zu bilden ist. */
export function naechstesPaar(k: Kontext, z: Zustand): [number, number] | null {
  const kandidaten = paarKandidaten(k, z)
  if (kandidaten.length < 2) return null
  const r = zufall(z.startwert * 977 + z.schritt * 31 + 5)
  let bestes: [number, number] | null = null
  let bestePunkte = -1
  for (let versuch = 0; versuch < PAAR_VERSUCHE; versuch++) {
    const a = kandidaten[Math.floor(r() * kandidaten.length)]
    const b = kandidaten[Math.floor(r() * kandidaten.length)]
    if (a === b) continue
    const f = teilung(k, z.rest, a, b)
    const punkte = (1 - cos(k, a, b)) * 4 * f * (1 - f) * richtungsAbstand(k, a, b, z.neutral)
    if (punkte > bestePunkte) {
      bestePunkte = punkte
      bestes = [a, b]
    }
  }
  return bestes ?? [kandidaten[0], kandidaten[1]]
}

/** Restmenge nach einem Duell: wer dem Sieger näher liegt als dem Verlierer; nie unter die Untergrenze. */
function eingrenzen(k: Kontext, rest: number[], sieger: number, verlierer: number): number[] {
  const bleibt = rest.filter((t) => cos(k, t, sieger) >= cos(k, t, verlierer))
  if (bleibt.length >= UNTERGRENZE_REST) return bleibt
  return rest.slice().sort((p, q) => cos(k, q, sieger) - cos(k, p, sieger) || p - q).slice(0, UNTERGRENZE_REST)
}

/** Antwort auf das aktuelle Paar; der alte Zustand bleibt unverändert. Ohne Paar bleibt der Zustand, wie er ist. */
export function antworte(k: Kontext, z: Zustand, antwort: Antwort): Zustand {
  const paar = naechstesPaar(k, z)
  if (!paar) return z
  const gesehen = [...z.gesehen, ...paar.filter((i) => !z.gesehen.includes(i))]
  const neu = { ...z, schritt: z.schritt + 1, gesehen }
  if (antwort === 'N') return { ...neu, neutral: paar }
  const [sieger, verlierer] = antwort === 'A' ? paar : [paar[1], paar[0]]
  return { ...neu, gewertet: z.gewertet + 1, neutral: null, sieger: [...z.sieger, sieger], rest: eingrenzen(k, z.rest, sieger, verlierer) }
}

/** Fertig: Ziel an gewerteten Duellen erreicht, zu viele „kann mich nicht entscheiden“ oder kein Paar mehr. */
export function istFertig(k: Kontext, z: Zustand, ziel: number): boolean {
  return z.gewertet >= ziel || z.schritt >= SCHRITTE_MAX || naechstesPaar(k, z) === null
}

function tie(i: number, startwert: number): number {
  return ((i * 2654435761 + startwert * 40503) % 1000) / 1e7
}

/**
 * Die besten Vorschläge: Restmenge vor dem Rest, darin nach mittlerer Nähe zu den Siegern. Duell-Titel, Ausgeschlossene und
 * Verworfene (Kennungen beliebiger Teile) kommen nie vor; weniger als `anzahl`, wenn nicht mehr übrig sind.
 */
export function vorschlaege(k: Kontext, z: Zustand, verworfen: number[] = [], anzahl: number = VORSCHLAEGE): Kandidat[] {
  const weg = new Set([...z.gesehen, ...z.ausgeschlossen, ...einstiegsIndizes(k, verworfen)])
  const imRest = new Set(z.rest)
  const punkte = (i: number): number => {
    const nah = z.sieger.length ? z.sieger.reduce((s, w) => s + cos(k, w, i), 0) / z.sieger.length : 0
    return (imRest.has(i) ? 10 : 0) + nah + tie(i, z.startwert)
  }
  return k.datei.einstiege
    .map((_, i) => i)
    .filter((i) => !weg.has(i))
    .sort((a, b) => punkte(b) - punkte(a) || a - b)
    .slice(0, anzahl)
    .map((i) => k.datei.einstiege[i])
}

/** „Duell n von 6“ und „Noch ca. m von N Titeln“. */
export function fortschritt(k: Kontext, z: Zustand, ziel: number): { gewertet: number; ziel: number; rest: number; gesamt: number; fertig: boolean } {
  return { gewertet: z.gewertet, ziel, rest: z.rest.length, gesamt: k.datei.einstiege.length - z.ausgeschlossen.length, fertig: istFertig(k, z, ziel) }
}

/** Zustand mit allen früheren, damit „Zurück“ den Vorzustand exakt herstellt. */
export interface Sitzung {
  zustand: Zustand
  verlauf: Zustand[]
}

export const neueSitzung = (z: Zustand): Sitzung => ({ zustand: z, verlauf: [] })

export function antworteSitzung(k: Kontext, s: Sitzung, antwort: Antwort): Sitzung {
  const neu = antworte(k, s.zustand, antwort)
  return neu === s.zustand ? s : { zustand: neu, verlauf: [...s.verlauf, s.zustand] }
}

/** Ein Duell zurück: derselbe Zustand wie davor, also dasselbe Paar. Am Anfang bleibt alles, wie es ist. */
export function zurueck(s: Sitzung): Sitzung {
  const vorher = s.verlauf.at(-1)
  return vorher ? { zustand: vorher, verlauf: s.verlauf.slice(0, -1) } : s
}
