import { schlicht } from './tmdb-plakat.ts'

/**
 * **Specials, OVAs und Filme über Staffel 0 einer TMDB-Serie zuordnen.** TMDB führt sie nicht als eigenes Werk, sondern als Folge der Staffel 0
 * („Specials“) der Hauptserie. Die Serie selbst erbt der Titel nicht (`tmdb-hauptserie.ts`: Anbieter, FSK, Handlung wären fremd);
 * zugeordnet wird genau eine Folge, und nur deren Bilder (Standbild als Banner, Plakat der Staffel 0) gehören dem Titel.
 *
 * **Sicher heißt:** Datum der Folge höchstens einen Tag neben unserem japanischen Start, der Name der Folge (englisch oder japanisch) gleich einem
 * unserer Namen und die Länge gleich (Abstand höchstens zwei Minuten oder 15 %). Fehlt unsere Länge, gilt es nur bei gleichem Tag. Der Treffer muss
 * der einzige solche in der Staffel 0 aller Serien der Reihe sein. Alles darunter ist **unsicher** (Prüfliste) oder **kein**; nie raten.
 */
export interface Staffel0Folge {
  e: number
  name: string
  /** Der Name der Folge in der Originalsprache (TMDB `ja-JP`); unser `titleNative` trägt ihn, wo die englische Übersetzung abweicht. */
  nameJa?: string
  datum: string | null
  minuten: number | null
}

export interface Staffel0Serie {
  tmdbId: number
  folgen: Staffel0Folge[]
}

export interface Staffel0Titel {
  folgen?: number
  minuten?: number
  start?: string
  namen: (string | undefined)[]
}

/** Die gemessenen Merkmale eines Kandidaten; das Urteil rechnet nur damit (und `check-tmdb-staffel0.ts` rechnet es nach). */
export interface Staffel0Merkmale {
  /** TMDB-Datum minus unser Start in Tagen. */
  tage: number
  /** Längenabstand in Minuten, `null` wenn eine Seite fehlt. */
  laenge: number | null
  name: boolean
}

export type Staffel0Stufe = 'sicher' | 'unsicher' | 'kein'

export interface Staffel0Treffer {
  serie: number
  e: number
  merkmale: Staffel0Merkmale
}

export interface Staffel0Urteil {
  stufe: Staffel0Stufe
  grund: string
  treffer?: Staffel0Treffer
}

const TAG_MS = 864e5
const MIN_NAME = 3
/** Ab dieser Länge zählt „im langen Titel enthalten“; in CJK-Schrift trägt ein Zeichen mehr, dort schon ab 4. */
const MIN_TEIL = 6
const MIN_TEIL_CJK = 4
const CJK = /[぀-ヿ一-鿿]/
/** Namen, die TMDB für beliebige Folgen vergibt und die jeden Titel mit dem Wort „enthalten“ würden. */
const ALLGEMEIN = /^(special|specials|ova|oad|ona|movie|extra|recap|summary|episode\d*|specialepisode\d*)$/

/** Zulässiger Längenabstand: zwei Minuten oder 15 Prozent unserer Länge. */
export const laengeToleranz = (minuten: number): number => Math.max(2, minuten * 0.15)

function gleichName(eigene: string[], n: string): boolean {
  if (n.length < MIN_NAME || ALLGEMEIN.test(n)) return false
  const teil = n.length >= (CJK.test(n) ? MIN_TEIL_CJK : MIN_TEIL)
  return eigene.some((x) => x === n || (teil && (x.includes(n) || n.includes(x))))
}

/** Die Merkmale einer Folge gegen unseren Titel; ohne Datum auf einer Seite gibt es keinen Vergleich. */
export function merkmale(t: Staffel0Titel, f: Staffel0Folge): Staffel0Merkmale | undefined {
  if (!f.datum || !t.start) return undefined
  const tage = Math.round((Date.parse(f.datum) - Date.parse(t.start)) / TAG_MS)
  if (!Number.isFinite(tage)) return undefined
  const laenge = f.minuten && t.minuten ? Math.abs(f.minuten - t.minuten) : null
  const eigene = t.namen.filter((x): x is string => Boolean(x)).map(schlicht)
  const name = [f.name, f.nameJa].some((n) => gleichName(eigene, schlicht(n ?? '')))
  return { tage, laenge, name }
}

/** Ob die Merkmale „sicher“ tragen (die Eindeutigkeit prüft `urteilStaffel0`). */
export function traegtSicher(m: Staffel0Merkmale, minuten: number | undefined): boolean {
  if (!m.name || Math.abs(m.tage) > 1) return false
  if (m.laenge === null) return m.tage === 0
  return m.laenge <= laengeToleranz(minuten ?? 0)
}

/** Gehört die Folge auf die Prüfliste? Datum nah oder Name gleich, und die Länge widerspricht nicht. */
function kannBetragen(m: Staffel0Merkmale | undefined, minuten: number | undefined): m is Staffel0Merkmale {
  if (!m) return false
  const laengeWiderspricht = m.laenge !== null && m.laenge > laengeToleranz(minuten ?? 0)
  return !laengeWiderspricht && (m.name || Math.abs(m.tage) <= 3)
}

/** Die Rangzahl für „bester Treffer, nicht erster“: Name zählt vor Länge vor Datum. */
const rang = (m: Staffel0Merkmale): number => (m.name ? 8 : 0) + (m.laenge !== null ? 4 : 0) + (m.tage === 0 ? 2 : 0) - Math.min(Math.abs(m.tage), 60) / 100

/** Gibt es ab `e` genau `n` aufeinanderfolgende Folgen? */
function folgenFolgen(serie: Staffel0Serie, e: number, n: number): boolean {
  const nummern = new Set(serie.folgen.map((f) => f.e))
  return Array.from({ length: n }, (_, i) => e + i).every((x) => nummern.has(x))
}

type Kandidat = { serie: Staffel0Serie; f: Staffel0Folge; m: Staffel0Merkmale }

const alsTreffer = (k: Kandidat): Staffel0Treffer => ({ serie: k.serie.tmdbId, e: k.f.e, merkmale: k.m })

function ohneSicheren(feste: number, moegliche: Kandidat[]): Staffel0Urteil {
  const bester = [...moegliche].sort((a, b) => rang(b.m) - rang(a.m))[0]!
  const grund = feste > 1 ? 'mehrere Folgen passen' : bester.m.name ? 'Name gleich, aber Datum oder Länge tragen nicht' : 'Datum nah, aber Name oder Länge tragen nicht'
  return { stufe: 'unsicher', grund, treffer: alsTreffer(bester) }
}

/**
 * Das Urteil für einen Titel gegen die Staffel 0 aller Serien seiner Reihe. Ein Titel mit mehreren Folgen wird an seiner ersten gemessen;
 * die Folgenzahl muss in der Staffel 0 aufeinanderfolgend vorhanden sein.
 */
export function urteilStaffel0(t: Staffel0Titel, serien: Staffel0Serie[]): Staffel0Urteil {
  const alle = serien.flatMap((s) => s.folgen.map((f) => ({ serie: s, f, m: merkmale(t, f) })))
  if (!alle.length) return { stufe: 'kein', grund: 'keine Staffel 0 bei TMDB' }
  const moegliche = alle.filter((k): k is Kandidat => kannBetragen(k.m, t.minuten))
  if (!moegliche.length) return { stufe: 'kein', grund: 'keine Folge der Staffel 0 mit passendem Datum oder Namen' }
  const feste = moegliche.filter((k) => traegtSicher(k.m, t.minuten))
  if (feste.length !== 1) return ohneSicheren(feste.length, moegliche)
  const wahl = feste[0]!
  if ((t.folgen ?? 1) > 1 && !folgenFolgen(wahl.serie, wahl.f.e, t.folgen!)) {
    return { stufe: 'unsicher', grund: `${t.folgen} Folgen, aber die folgenden Folgen fehlen in der Staffel 0`, treffer: alsTreffer(wahl) }
  }
  const grund = wahl.m.laenge === null ? 'Datum und Name gleich, Länge fehlt auf einer Seite' : 'Datum, Name und Länge gleich'
  return { stufe: 'sicher', grund, treffer: alsTreffer(wahl) }
}

/**
 * Eintrag in `data/tmdb-staffel0.json` (Titelkennung → Folge): unser Urteil (`tmdbId`, `e`) mit den Merkmalen, auf denen es beruht, damit
 * `check-tmdb-staffel0.ts` es nachrechnet. `min` ist unsere Länge (die Toleranz hängt an ihr), `inhaltAm` der Tag der letzten Prüfung gegen TMDB.
 */
export interface Staffel0Eintrag extends Staffel0Merkmale {
  tmdbId: number
  e: number
  min?: number
  inhaltAm: string
  /** Pfade der Bilder, die diese Zuordnung in `tmdb-poster.json` und `tmdb-banner.json` gesetzt hat; nur solche streicht sie wieder. */
  pp?: string
  sp?: string
}

export const eintragAus = (t: Staffel0Titel, treffer: Staffel0Treffer, tag: string): Staffel0Eintrag => ({
  tmdbId: treffer.serie,
  e: treffer.e,
  ...treffer.merkmale,
  ...(t.minuten ? { min: t.minuten } : {}),
  inhaltAm: tag,
})

/** Trägt der gespeicherte Eintrag das Urteil „sicher“ noch aus seinen eigenen Merkmalen? */
export const eintragHaelt = (e: Staffel0Eintrag): boolean => traegtSicher({ tage: e.tage, laenge: e.laenge, name: e.name }, e.min)

/** Titelkennungen, deren Folge (Serie und Nummer) noch ein anderer Titel trägt: eine Folge gehört genau einem Titel. */
export function mehrfachBelegt(eintraege: Record<string, Pick<Staffel0Eintrag, 'tmdbId' | 'e'>>): Set<string> {
  const je = new Map<string, string[]>()
  for (const [id, x] of Object.entries(eintraege)) je.set(`${x.tmdbId}/${x.e}`, [...(je.get(`${x.tmdbId}/${x.e}`) ?? []), id])
  return new Set([...je.values()].filter((ids) => ids.length > 1).flat())
}
