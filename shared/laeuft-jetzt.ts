/*
  „Was läuft gerade, was kommt gleich": reine Zustandsrechnung für den Fernseh-Kasten und die Kacheln der Woche
  (Variante D, Daniel 13.10.2026). Ohne DOM und React, damit Seite, Bühnen-Mockup und Test sie gemeinsam laden.
  `jetzt` ist „HH:MM" Berliner Zeit (`nowHhMm()`), `heute` ein Datum; Vergleiche laufen als Zeichenkette wie in der Seite.
*/
import { zeitGeschaetzt } from './zeit-text.ts'

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
  alleVorbei: boolean
}

const minuten = (uhr: string): number => Number(uhr.slice(0, 2)) * 60 + Number(uhr.slice(3, 5))
const geschaetzt = (t: Termin): boolean => zeitGeschaetzt(t)

/** „in 12 Min", „in 1 Std 5 Min", „in 2 Std" — ab einer Minute. */
export function restText(n: number): string {
  if (n < 60) return `in ${n} Min`
  const std = Math.floor(n / 60)
  const rest = n % 60
  return rest ? `in ${std} Std ${rest} Min` : `in ${std} Std`
}

/** Die Sendung des Programms, die zu diesem Termin gehört: gleicher Tag, gleiche Uhrzeit. */
export function sendungZuTermin<S extends Sendung>(sendungen: S[], t: Pick<Termin, 'date' | 'time'>): S | undefined {
  return sendungen.find((s) => s.start === `${t.date}T${t.time ?? ''}`)
}

/**
 * Die Sendung, die zu `jetzt` auf dem Schirm ist: vom Beginn bis vor das Ende, auf die Minute. Das Programm gilt auch ohne
 * Termin im Plan (Stand 13.10.2026: 23 von 92 Sendungen); die Zeilen des Kastens fragen nur ihre eigenen Termine (`laufende`).
 */
export function laufendeSendung<S extends Sendung>(sendungen: S[], heute: string, jetzt: string): S | undefined {
  const jetztIso = `${heute}T${jetzt}`
  return sendungen.find((s) => s.start <= jetztIso && jetztIso < s.ende)
}

/** Die Folgennummer eines Termins: die belegte, sonst die der Sendung im Programm. */
export function folgeDesTermins(t: Pick<Termin, 'episode' | 'sichtung'>, sendung: Sendung | undefined): number | undefined {
  return t.episode && !t.sichtung ? t.episode : sendung?.nr
}

/** Sendet gerade etwas dieser Zeile? Nur Termine mit belegter Uhrzeit und einer Sendung im Programm, deren Ende bekannt ist. */
function laufende(gruppe: Termin[], sendungen: Sendung[], heute: string, jetzt: string): Zeilenzustand | undefined {
  for (const [i, t] of gruppe.entries()) {
    if (!t.time || geschaetzt(t)) continue
    const sendung = sendungZuTermin(sendungen, t)
    if (!sendung || !laufendeSendung([sendung], heute, jetzt)) continue
    const nr = folgeDesTermins(t, sendung)
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

/** Zustand des Fernseh-Kastens für heute; `sendungen[i]` gehört zur Zeile `gruppen[i]`. Mehrere Zeilen können gleichzeitig laufen. */
export function kastenZustand(gruppen: Termin[][], sendungen: Sendung[][], heute: string, jetzt: string): Kastenzustand {
  const zeilen = gruppen.map((g, i) => grundzustand(g, sendungen[i] ?? [], heute, jetzt))
  markiereNaechste(gruppen, zeilen, jetzt)
  return { zeilen, alleVorbei: zeilen.length > 0 && zeilen.every((z) => z.art === 'vorbei') }
}

/** Wo die Jetzt-Linie des Kastens steht und was dazugehört. */
export interface LinienStand {
  /** Die Linie steht vor dieser Zeile (`gruppen.length` heißt nach der letzten); leer, wenn keine steht. */
  linieVor?: number
  /** Minuten bis zur ersten Sendung, wenn die Linie davor steht (noch nichts gelaufen) — für die Kopfzeile. */
  ersteIn?: number
  nichtsMehr: boolean
  /** „· in 13 Min" gehört an die Senderzeile der nächsten Sendung. */
  restInZeile: boolean
}

/** Zeigt die Seite eine Restzeit, dann nur an der ersten ausstehenden Zeile: davor stehende Schätzungen könnten früher kommen. */
const ersteAusstehendeIstNaechste = (zeilen: Zeilenzustand[]): boolean =>
  zeilen.find((z) => z.art === 'spaeter' || z.art === 'naechste')?.art === 'naechste'

/**
 * Die Linie steht nur, wenn gerade nichts läuft (Daniel, 13.10.2026): vor der ersten, zwischen zwei Sendungen, nach der letzten.
 * Ohne belegte Uhrzeit der ersten Zeile keine Linie vor ihr und keine Restzeit.
 */
export function linienStand(zustand: Kastenzustand, gruppen: Termin[][], jetzt: string): LinienStand {
  const { zeilen } = zustand
  const rest = ersteAusstehendeIstNaechste(zeilen)
  if (zeilen.some((z) => z.art === 'laeuft')) return { nichtsMehr: false, restInZeile: rest }
  if (zustand.alleVorbei) return { linieVor: zeilen.length, nichtsMehr: true, restInZeile: false }
  const i = zeilen.findIndex((z) => z.art !== 'vorbei')
  if (i > 0) return { linieVor: i, nichtsMehr: false, restInZeile: rest }
  const erste = gruppen[0]?.[0]
  if (i < 0 || !erste?.time || geschaetzt(erste) || erste.time <= jetzt) return { nichtsMehr: false, restInZeile: false }
  return { linieVor: 0, ersteIn: minuten(erste.time) - minuten(jetzt), nichtsMehr: false, restInZeile: false }
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

/** Was eine Streaming-Kachel zur Uhrzeit sagt; Schätzungen, Ausgebliebenes und Termine ohne Uhrzeit sagen nichts. */
export function kachelAngabe(termin: Termin, heute: string, jetzt: string, fruehste: string | undefined): KachelAngabe {
  if (termin.date !== heute || !termin.time || geschaetzt(termin) || termin.verpasst) return {}
  if (termin.time <= jetzt) return { seit: termin.time }
  const n = minuten(termin.time) - minuten(jetzt)
  return termin.time === fruehste && n <= NAECHSTE_BIS_MINUTEN ? { in: restText(n) } : {}
}
