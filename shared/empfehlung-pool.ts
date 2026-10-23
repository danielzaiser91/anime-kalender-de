import { anzeigeName, ausstrahlungsZeit, hauptstaffeln, nachJahrUndId, staffelStaende } from './titles.ts'
import type { FranchiseMember, Franchises } from './franchise-typ.ts'
import type { Title } from './types.ts'

/** Untergrenze der Bewertung (aniSearch-Prozent) für den Empfehlungs-Pool; ohne Bewertung bleibt der Titel drin (F5/F43). */
export const MIN_BEWERTUNG = 60

/** Ein Vorschlagskandidat in `empfehlung.json`: der Einstieg einer Reihe. Cover und Banner stehen bewusst nicht drin (Gegenentwurf 19.10.2026). */
export interface Kandidat {
  id: number
  n: string
  f?: string
  y?: number
  e?: number
  /** Indizes in `EmpfehlungsDatei.genres` bzw. `.keywords`. */
  g: number[]
  k: number[]
  fsk?: number
  v?: number
  /** Anbieter mit belegter Synchro: [Plattform, Zugangsart?]. */
  p: Array<[string] | [string, string]>
  trailer?: true
  /** Teil 1 der Reihe liegt im Pool: nur solche Titel bilden ein Duellpaar. */
  duell?: true
  /** Staffelnummer, wenn der Einstieg nicht der erste Teil der Reihe ist („Beginnt mit Staffel n"). */
  ab?: number
}

export interface EmpfehlungsDatei {
  /** Titel im Pool (alle Teile aller Reihen), nicht nur Einstiege. */
  pool: number
  genres: string[]
  keywords: string[]
  einstiege: Kandidat[]
  /** Pool-Kennung → Kennung des Einstiegs ihrer Reihe, nur wo sie abweicht (ein Einstieg ist seine eigene Reihe). */
  reihe: Record<string, number>
}

type PoolFeld = Pick<Title, 'streams' | 'score' | 'sperre'>

/** Synchro-Stream belegt (`dub === true`), nicht gesperrt, Bewertung ≥ 60 oder keine. */
export function imEmpfehlungsPool(t: PoolFeld): boolean {
  return !t.sperre && (t.score == null || t.score >= MIN_BEWERTUNG) && t.streams.some((s) => s.dub === true)
}

export function reiheVon(t: Pick<Title, 'id' | 'franchiseId'>): number {
  return t.franchiseId ?? t.id
}

/** Reihe → frühester Teil im Pool (`jpYear`, dann `id`). */
export function einstiegeJeReihe(pool: Title[]): Map<number, Title> {
  const einstiege = new Map<number, Title>()
  for (const t of pool) {
    const bisher = einstiege.get(reiheVon(t))
    if (!bisher || nachJahrUndId(t, bisher) < 0) einstiege.set(reiheVon(t), t)
  }
  return einstiege
}

/** Teil 1 der Reihe: die früheste Staffel (`hauptstaffeln`), bei Reihen ohne Staffel (Filme, OVAs) der früheste Teil ohne Beiwerk und Special; `franchises.json` führt alle Teile, auch ohne Synchro. */
export function ersterTeil(teile: FranchiseMember[]): FranchiseMember | undefined {
  const staffeln = hauptstaffeln(teile)
  const kandidaten = staffeln.length ? staffeln : teile.filter((m) => !m.beiwerk && !m.eigenesWerk && m.format !== 'SPECIAL')
  const sortiert = kandidaten.slice().sort((a, b) => ausstrahlungsZeit(a).localeCompare(ausstrahlungsZeit(b)))
  return sortiert[0]
}

/** Staffelnummer des Einstiegs, wie das Panel sie zählt; leer bei Einzelstaffel, Film oder Beiwerk. */
function staffelNummer(einstieg: Title, teile: FranchiseMember[], kopf: Title | undefined): number | undefined {
  const name = anzeigeName(kopf ?? einstieg)
  return staffelStaende(hauptstaffeln(teile), name).get(einstieg.id)?.staffel
}

function indexVon(wert: string, woerter: string[], index: Map<string, number>): number {
  const bekannt = index.get(wert)
  if (bekannt !== undefined) return bekannt
  woerter.push(wert)
  index.set(wert, woerter.length - 1)
  return woerter.length - 1
}

function anbieter(t: Title): Kandidat['p'] {
  const gesehen = new Set<string>()
  const liste: Kandidat['p'] = []
  for (const s of t.streams) {
    const schluessel = `${s.platform}|${s.zugang ?? ''}`
    if (s.dub !== true || gesehen.has(schluessel)) continue
    gesehen.add(schluessel)
    liste.push(s.zugang ? [s.platform, s.zugang] : [s.platform])
  }
  return liste
}

/** `duell`: Teil 1 der Reihe liegt im Pool (oder die Reihe kennt keinen anderen); sonst `ab`: die Staffelnummer des Einstiegs, soweit zählbar. */
function reihenMerkmal(t: Title, teile: FranchiseMember[], poolIds: Set<number>, kopf: Title | undefined): Pick<Kandidat, 'duell' | 'ab'> {
  const erster = ersterTeil(teile)
  if (!erster || poolIds.has(erster.id) || ausstrahlungsZeit(t) <= ausstrahlungsZeit(erster)) return { duell: true }
  const nr = staffelNummer(t, teile, kopf)
  return nr && nr >= 2 ? { ab: nr } : {}
}

/** Baut die Pool-Datei aus den ausgelieferten Titeln und den Reihen. Reine Funktion, deterministisch. */
export function baueEmpfehlung(titles: Title[], franchises: Franchises): EmpfehlungsDatei {
  const pool = titles.filter(imEmpfehlungsPool)
  const einstiege = einstiegeJeReihe(pool)
  const poolIds = new Set(pool.map((t) => t.id))
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const genres: string[] = []
  const keywords: string[] = []
  const genreIndex = new Map<string, number>()
  const keywordIndex = new Map<string, number>()
  const kandidaten = [...einstiege.values()]
    .sort((a, b) => a.id - b.id)
    .map((t): Kandidat => {
      const k: Kandidat = {
        id: t.id,
        n: anzeigeName(t),
        f: t.format,
        y: t.jpYear,
        e: t.episodes,
        g: t.genres.map((w) => indexVon(w, genres, genreIndex)),
        k: t.keywords.map((w) => indexVon(w, keywords, keywordIndex)),
        fsk: t.fsk,
        v: t.score,
        p: anbieter(t),
      }
      if (t.trailer?.video) k.trailer = true
      return { ...k, ...reihenMerkmal(t, franchises[reiheVon(t)] ?? [], poolIds, nachId.get(reiheVon(t))) }
    })
  const reihe: Record<string, number> = {}
  for (const t of pool) {
    const einstieg = einstiege.get(reiheVon(t))!
    if (einstieg.id !== t.id) reihe[String(t.id)] = einstieg.id
  }
  return { pool: pool.length, genres, keywords, einstiege: kandidaten, reihe }
}

/** Obergrenze der Pool-Datei über die Leitung (gzip), Leitziel Mobile. */
export const MAX_GZIP_BYTES = 40 * 1024

/** Widersprüche zwischen Pool-Datei und Titeln; leer = in Ordnung. */
export function pruefeEmpfehlung(d: EmpfehlungsDatei, titles: Title[]): string[] {
  const fehler: string[] = []
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const pool = titles.filter(imEmpfehlungsPool)
  const reihen = new Set(pool.map(reiheVon))
  if (d.pool !== pool.length) fehler.push(`pool ${d.pool} ≠ ${pool.length} Titel im Pool`)
  if (d.einstiege.length !== reihen.size) fehler.push(`${d.einstiege.length} Einstiege ≠ ${reihen.size} Reihen im Pool`)
  const ids = new Set(d.einstiege.map((k) => k.id))
  if (ids.size !== d.einstiege.length) fehler.push('Kennung doppelt unter den Einstiegen')
  for (const k of d.einstiege) {
    const t = nachId.get(k.id)
    if (!t || !imEmpfehlungsPool(t)) fehler.push(`Einstieg ${k.id} liegt nicht im Pool`)
    if (k.ab !== undefined && (k.duell || k.ab < 2)) fehler.push(`Einstieg ${k.id}: ab ${k.ab} bei duell=${k.duell ?? false}`)
    if (k.g.some((i) => !d.genres[i]) || k.k.some((i) => !d.keywords[i])) fehler.push(`Einstieg ${k.id}: Index außerhalb der Wörterbücher`)
  }
  for (const [id, einstieg] of Object.entries(d.reihe)) {
    const t = nachId.get(Number(id))
    if (!t || !ids.has(einstieg) || reiheVon(t) !== reiheVon(nachId.get(einstieg)!)) fehler.push(`reihe[${id}] → ${einstieg} gehört nicht zur selben Reihe`)
  }
  return fehler
}
