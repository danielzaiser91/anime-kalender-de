/*
  Reine Zustandsrechnung des Mockups „Relative Uhrzeit in der Woche" (Spezifikation `relative-uhrzeit-spezifikation.md`,
  Abschnitte 3, 4 und 10). Ohne React und ohne Aliase, damit `tools/buehne-relative-uhrzeit.test.mjs` sie direkt lädt.
  `jetzt` ist „HH:MM" Berliner Zeit, `heute` ein Datum; Vergleiche laufen als Zeichenkette wie in der Seite.
*/

/** Eine Sendung aus dem Programm (`release.sendungen`): Beginn und Ende als „YYYY-MM-DDTHH:MM". */
export interface Sendung {
  start: string
  ende: string
  nr?: number
}

/** Das, was die Rechnung von einem Termin liest (ein `ReleaseEvent` passt). */
export interface Termin {
  date: string
  time?: string
  episode?: number
  sichtung?: boolean
  timeEstimated?: boolean
  estimated?: boolean
  verpasst?: unknown
  platform?: string
  releaseType?: string
  zweitanbieter?: unknown
}

/** Länger als drei Stunden hin sagt die Seite nichts Relatives. */
export const NAECHSTE_BIS_MINUTEN = 180

export type Zeilenzustand =
  | { art: 'vorbei' }
  | { art: 'spaeter' }
  /** `folge` nur, wenn die laufende Sendung nicht der erste Termin der Bündelzeile ist. */
  | { art: 'laeuft'; bis: string; folge?: number }
  | { art: 'naechste'; minuten: number }

export interface Kastenzustand {
  zeilen: Zeilenzustand[]
  /** Die Jetzt-Linie steht vor dieser Zeile; leer, wenn noch nichts vorbei ist und nichts läuft oder alles vorbei ist. */
  linieVor?: number
  alleVorbei: boolean
}

const minuten = (uhr: string): number => Number(uhr.slice(0, 2)) * 60 + Number(uhr.slice(3, 5))
const geschaetzt = (t: Termin): boolean => !!(t.timeEstimated || t.estimated)

/** „in 12 Min", „in 1 Std 5 Min", „in 2 Std" — für 1 bis 180 Minuten. */
export function restText(n: number): string {
  if (n < 60) return `in ${n} Min`
  const std = Math.floor(n / 60)
  const rest = n % 60
  return rest ? `in ${std} Std ${rest} Min` : `in ${std} Std`
}

/** Sendet gerade etwas dieser Zeile? Nur Termine mit belegter Uhrzeit und einer Sendung im Programm, deren Ende bekannt ist. */
function laufende(gruppe: Termin[], sendungen: Sendung[], heute: string, jetzt: string): Zeilenzustand | undefined {
  const jetztIso = `${heute}T${jetzt}`
  for (const [i, t] of gruppe.entries()) {
    if (!t.time || geschaetzt(t)) continue
    const sendung = sendungen.find((s) => s.start === `${t.date}T${t.time}`)
    if (!sendung || sendung.start > jetztIso || jetztIso >= sendung.ende) continue
    const nr = t.episode && !t.sichtung ? t.episode : sendung.nr
    return { art: 'laeuft', bis: sendung.ende.slice(11, 16), ...(i > 0 && nr ? { folge: nr } : {}) }
  }
  return undefined
}

function grundzustand(gruppe: Termin[], sendungen: Sendung[], heute: string, jetzt: string): Zeilenzustand {
  const laeuft = laufende(gruppe, sendungen, heute, jetzt)
  if (laeuft) return laeuft
  return gruppe.every((t) => (t.time ?? '99') <= jetzt) ? { art: 'vorbei' } : { art: 'spaeter' }
}

/** Die erste ausstehende Zeile mit belegter Uhrzeit ist „nächste", wenn sie höchstens drei Stunden entfernt ist. */
function markiereNaechste(gruppen: Termin[][], zeilen: Zeilenzustand[], jetzt: string): void {
  const i = zeilen.findIndex((z, k) => z.art === 'spaeter' && !!gruppen[k]![0]!.time && !geschaetzt(gruppen[k]![0]!) && gruppen[k]![0]!.time! > jetzt)
  if (i < 0) return
  const n = minuten(gruppen[i]![0]!.time!) - minuten(jetzt)
  if (n <= NAECHSTE_BIS_MINUTEN) zeilen[i] = { art: 'naechste', minuten: n }
}

function linieVor(zeilen: Zeilenzustand[]): number | undefined {
  const i = zeilen.findIndex((z) => z.art !== 'vorbei')
  if (i < 0) return undefined
  return i > 0 || zeilen[0]!.art === 'laeuft' ? i : undefined
}

/** Zustand des Fernseh-Kastens für heute; `sendungen[i]` gehört zur Zeile `gruppen[i]`. */
export function kastenZustand(gruppen: Termin[][], sendungen: Sendung[][], heute: string, jetzt: string): Kastenzustand {
  const zeilen = gruppen.map((g, i) => grundzustand(g, sendungen[i] ?? [], heute, jetzt))
  markiereNaechste(gruppen, zeilen, jetzt)
  return { zeilen, linieVor: linieVor(zeilen), alleVorbei: zeilen.length > 0 && zeilen.every((z) => z.art === 'vorbei') }
}

/** Variante D: wo die Jetzt-Linie steht und was dazugehört. */
export interface DStand {
  /** Die Linie steht vor dieser Zeile; `gruppen.length` heißt nach der letzten. */
  linieVor: number
  /** Minuten bis zur ersten Sendung, wenn die Linie davor steht (noch nichts gelaufen). */
  ersteIn?: number
  nichtsMehr: boolean
}

/** Variante D setzt die Linie auch vor die erste und hinter die letzte Zeile; ohne belegte Uhrzeit der ersten keine Linie vor ihr. */
export function dStand(zustand: Kastenzustand, gruppen: Termin[][], jetzt: string): DStand | undefined {
  if (zustand.alleVorbei) return { linieVor: gruppen.length, nichtsMehr: true }
  if (zustand.linieVor !== undefined) return { linieVor: zustand.linieVor, nichtsMehr: false }
  const erste = gruppen[0]?.[0]
  if (!erste?.time || geschaetzt(erste) || erste.time <= jetzt) return undefined
  return { linieVor: 0, ersteIn: minuten(erste.time) - minuten(jetzt), nichtsMehr: false }
}

export type Kopfzeile = { art: 'laeuft'; name: string; bis: string } | { art: 'naechste'; minuten: number } | { art: 'nichts' }

/** Variante B: die eine Zeile unter „Im Fernsehen"; ab drei Stunden Abstand keine. */
export function kopfzeile(zustand: Kastenzustand, namen: string[]): Kopfzeile | undefined {
  const lauf = zustand.zeilen.findIndex((z) => z.art === 'laeuft')
  const laeuft = zustand.zeilen[lauf]
  if (laeuft?.art === 'laeuft') return { art: 'laeuft', name: namen[lauf]!, bis: laeuft.bis }
  const naechste = zustand.zeilen.find((z) => z.art === 'naechste')
  if (naechste?.art === 'naechste') return { art: 'naechste', minuten: naechste.minuten }
  return zustand.alleVorbei ? { art: 'nichts' } : undefined
}

/** Die frühste feste Uhrzeit heute, die auf einer Streaming-Kachel noch aussteht. */
export function fruehesteKommende(termine: Termin[], heute: string, jetzt: string): string | undefined {
  const zeiten = termine
    .filter((t) => t.date === heute && t.platform !== 'tv' && t.releaseType !== 'disc' && !t.zweitanbieter && !t.verpasst && !geschaetzt(t))
    .map((t) => t.time)
    .filter((zeit): zeit is string => !!zeit && zeit > jetzt)
  return zeiten.sort()[0]
}

export interface KachelAngabe {
  /** Statt „17:00": „seit 17:00". */
  seit?: string
  /** Zweite Pille: „in 12 Min". */
  in?: string
}

/** Was eine Streaming-Kachel zur Uhrzeit sagt; Schätzungen, Ausgebliebenes und Termine ohne Uhrzeit sagen nichts (Abschnitt 10). */
export function kachelAngabe(termin: Termin, heute: string, jetzt: string, fruehste: string | undefined): KachelAngabe {
  if (termin.date !== heute || !termin.time || geschaetzt(termin) || termin.verpasst) return {}
  if (termin.time <= jetzt) return { seit: termin.time }
  const n = minuten(termin.time) - minuten(jetzt)
  return termin.time === fruehste && n <= NAECHSTE_BIS_MINUTEN ? { in: restText(n) } : {}
}
