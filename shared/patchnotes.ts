/**
 * Patch-Notes „Neu auf der Webseite": Form, Prüfung und Auslieferung. Die Quelle ist `data/patchnotes.yaml` (Handpflege),
 * ausgeliefert wird `public/data/patchnotes.json` — nur beim Klick auf den Knopf geladen.
 */
export const PATCH_KATEGORIEN = ['feature', 'bugfix'] as const
export type PatchKategorie = (typeof PATCH_KATEGORIEN)[number]
export const PATCH_SYMBOLE = ['stern', 'schluessel'] as const
export type PatchSymbol = (typeof PATCH_SYMBOLE)[number]

export interface Patchnote {
  /** ISO-Tag, Europe/Berlin. */
  datum: string
  kategorie: PatchKategorie
  /** Höchstens 8 Wörter, Besucher-Deutsch, kein Punkt am Ende. */
  text: string
  highlight?: true
  untertitel?: string
  /** Überschreibt das Symbol der Kategorie. */
  symbol?: PatchSymbol
  /** Hash-Adresse der Stelle, an der man es sieht („#/datenbank?t=12"). */
  link?: string
}

export const MAX_WOERTER = 8
export const MAX_HIGHLIGHTS_JE_TAG = 2
/** Mehr Tage zeigt der Dialog nicht (die Zähler der Filter zählen nur diese). */
export const MAX_TAGE = 30

const FELDER = new Set(['datum', 'kategorie', 'text', 'highlight', 'untertitel', 'symbol', 'link', 'live'])
const woerter = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length

function istTag(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Liefert die Widersprüche der Rohliste aus der YAML-Datei; leer heißt in Ordnung. */
export function pruefePatchnotes(roh: unknown): string[] {
  if (!Array.isArray(roh)) return ['patchnotes.yaml: oberste Ebene muss eine Liste sein']
  const fehler: string[] = []
  const gesehen = new Set<string>()
  const highlights = new Map<string, number>()
  roh.forEach((e: Record<string, unknown> | null, i) => {
    const wo = `Eintrag ${i + 1}`
    if (!e || typeof e !== 'object') return void fehler.push(`${wo}: kein Objekt`)
    for (const k of Object.keys(e)) if (!FELDER.has(k)) fehler.push(`${wo}: unbekanntes Feld „${k}“`)
    if (!istTag(e.datum)) fehler.push(`${wo}: datum „${String(e.datum)}“ ist kein gültiger Tag (JJJJ-MM-TT, in Anführungszeichen)`)
    if (!PATCH_KATEGORIEN.includes(e.kategorie as PatchKategorie)) fehler.push(`${wo}: kategorie „${String(e.kategorie)}“ ungültig`)
    if (typeof e.text !== 'string' || !e.text.trim()) fehler.push(`${wo}: text fehlt`)
    else {
      if (woerter(e.text) > MAX_WOERTER) fehler.push(`${wo}: text hat mehr als ${MAX_WOERTER} Wörter („${e.text}“)`)
      if (/[.!]$/.test(e.text.trim())) fehler.push(`${wo}: text endet mit Satzzeichen („${e.text}“)`)
    }
    if (e.untertitel !== undefined && (typeof e.untertitel !== 'string' || woerter(e.untertitel) > 10)) fehler.push(`${wo}: untertitel ungültig oder länger als 10 Wörter`)
    if (e.symbol !== undefined && !PATCH_SYMBOLE.includes(e.symbol as PatchSymbol)) fehler.push(`${wo}: symbol „${String(e.symbol)}“ ungültig`)
    if (e.link !== undefined && (typeof e.link !== 'string' || !e.link.startsWith('#/'))) fehler.push(`${wo}: link muss eine Hash-Adresse („#/…“) sein`)
    if (e.highlight !== undefined && e.highlight !== true) fehler.push(`${wo}: highlight nur als true`)
    if (e.live !== undefined && typeof e.live !== 'boolean') fehler.push(`${wo}: live muss true oder false sein`)
    const schluessel = `${String(e.datum)}|${String(e.text)}`
    if (gesehen.has(schluessel)) fehler.push(`${wo}: doppelt („${String(e.text)}“ am ${String(e.datum)})`)
    gesehen.add(schluessel)
    if (e.highlight === true) highlights.set(String(e.datum), (highlights.get(String(e.datum)) ?? 0) + 1)
  })
  for (const [tag, n] of highlights) if (n > MAX_HIGHLIGHTS_JE_TAG) fehler.push(`${tag}: ${n} Highlights, erlaubt sind ${MAX_HIGHLIGHTS_JE_TAG}`)
  return fehler
}

const RANG: Record<string, number> = { highlight: 0, feature: 1, bugfix: 2 }

/** Nur `live: true`, neueste Tage oben (höchstens `MAX_TAGE`), im Tag: Highlights, Features, Bugfixes; sonst Reihenfolge der Datei. */
export function auslieferbarePatchnotes(roh: Record<string, unknown>[]): Patchnote[] {
  const live = roh.filter((e) => e.live === true)
  const tage = [...new Set(live.map((e) => e.datum as string))].sort().reverse().slice(0, MAX_TAGE)
  const rang = (e: Record<string, unknown>) => RANG[e.highlight === true ? 'highlight' : (e.kategorie as string)]!
  return tage.flatMap((tag) =>
    live
      .filter((e) => e.datum === tag)
      .map((e, i) => ({ e, i }))
      .sort((a, b) => rang(a.e) - rang(b.e) || a.i - b.i)
      .map(({ e }): Patchnote => ({
        datum: e.datum as string,
        kategorie: e.kategorie as PatchKategorie,
        text: e.text as string,
        ...(e.highlight === true && { highlight: true as const }),
        ...(e.untertitel !== undefined && { untertitel: e.untertitel as string }),
        ...(e.symbol !== undefined && { symbol: e.symbol as PatchSymbol }),
        ...(e.link !== undefined && { link: e.link as string }),
      })),
  )
}
