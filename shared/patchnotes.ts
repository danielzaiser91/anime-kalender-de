/**
 * Patch-Notes „Neu auf der Webseite": Form, Prüfung und Auslieferung. Die Quelle ist der Ordner `data/patchnotes/` (jeder PR mit
 * sichtbarer Wirkung legt seine Datei an), ausgeliefert wird `patchnotes.json` — nur beim Klick auf den Knopf geladen.
 * Der Tag eines Eintrags ist der Tag des Commits, der seine Datei angelegt hat (`pipeline/lib/patchnotes-datum.ts`); `datum` in der
 * Datei ist nur ein Nachtrag (Altbestand, Bündeln, Umbenennen) und darf nicht nach dem Anlagetag der Datei liegen (`pipeline/check-patchnotes.ts`).
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
  /** Der Tag liegt nach `data/patchnotes/_ueberarbeitet-bis.txt`: Text noch nicht überarbeitet (Stift im Dialog). */
  entwurf?: true
}

export const MAX_WOERTER = 8
export const MAX_HIGHLIGHTS_JE_TAG = 2
/** Mehr Tage zeigt der Dialog nicht (die Zähler der Filter zählen nur diese). */
export const MAX_TAGE = 30

const FELDER = new Set(['datum', 'kategorie', 'text', 'highlight', 'untertitel', 'symbol', 'link'])
/** Nichts, was ein Besucher nicht sehen darf oder nicht versteht (Debug, Pipeline, Prüfungen, Erweiterung, versteckte Einstellungen). */
export const VERBOTENE_WOERTER = /debug|pipeline|prüf|\bwache|wächter|worker|erweiterung|\bintern|geheim|zusicherung|invariante|workflow|datensatz/i
const woerter =(s: string): number => s.trim().split(/\s+/).filter(Boolean).length

export function istTag(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Liefert die Widersprüche der Rohliste aus den YAML-Dateien (`datum` darf fehlen); `namen`: Dateinamen für die Meldungen. Leer heißt in Ordnung. */
export function pruefePatchnotes(roh: unknown, namen: string[] = []): string[] {
  if (!Array.isArray(roh)) return ['Patch Notes: muss eine Liste von Einträgen sein']
  const fehler: string[] = []
  const gesehen = new Set<string>()
  roh.forEach((e: Record<string, unknown> | null, i) => {
    const wo = namen[i] ?? `Eintrag ${i + 1}`
    if (!e || typeof e !== 'object') return void fehler.push(`${wo}: kein Objekt`)
    for (const k of Object.keys(e)) if (!FELDER.has(k)) fehler.push(`${wo}: unbekanntes Feld „${k}“`)
    if (e.datum !== undefined && !istTag(e.datum)) fehler.push(`${wo}: datum „${String(e.datum)}“ ist kein gültiger Tag (JJJJ-MM-TT, in Anführungszeichen)`)
    if (!PATCH_KATEGORIEN.includes(e.kategorie as PatchKategorie)) fehler.push(`${wo}: kategorie „${String(e.kategorie)}“ ungültig`)
    if (typeof e.text !== 'string' || !e.text.trim()) fehler.push(`${wo}: text fehlt`)
    else {
      const anzahl = woerter(e.text)
      if (anzahl > MAX_WOERTER) fehler.push(`${wo}: text hat ${anzahl} Wörter, höchstens ${MAX_WOERTER} („${e.text}“)`)
      if (/[.!]$/.test(e.text.trim())) fehler.push(`${wo}: text endet mit Satzzeichen („${e.text}“)`)
    }
    for (const feld of ['text', 'untertitel'] as const) {
      const treffer = typeof e[feld] === 'string' ? VERBOTENE_WOERTER.exec(e[feld]) : null
      if (treffer) fehler.push(`${wo}: ${feld} nennt „${treffer[0]}“ – nur Sichtbares für Besucher (${feld}: „${String(e[feld])}“)`)
    }
    if (e.untertitel !== undefined && (typeof e.untertitel !== 'string' || woerter(e.untertitel) > 10)) fehler.push(`${wo}: untertitel ungültig oder länger als 10 Wörter`)
    if (e.symbol !== undefined && !PATCH_SYMBOLE.includes(e.symbol as PatchSymbol)) fehler.push(`${wo}: symbol „${String(e.symbol)}“ ungültig`)
    if (e.link !== undefined && (typeof e.link !== 'string' || !e.link.startsWith('#/'))) fehler.push(`${wo}: link muss eine Hash-Adresse („#/…“) sein`)
    if (e.highlight !== undefined && e.highlight !== true) fehler.push(`${wo}: highlight nur als true`)
    if (gesehen.has(String(e.text))) fehler.push(`${wo}: doppelt („${String(e.text)}“)`)
    gesehen.add(String(e.text))
  })
  return [...fehler, ...pruefeHighlightsJeTag(roh as Record<string, unknown>[])]
}

/** Höchstens `MAX_HIGHLIGHTS_JE_TAG` je Tag. Einträge ohne aufgelöstes `datum` zählen nicht (ihr Tag steht erst nach dem Git-Abgleich fest). */
export function pruefeHighlightsJeTag(roh: Record<string, unknown>[]): string[] {
  const highlights = new Map<string, number>()
  for (const e of roh) if (e?.highlight === true && e.datum !== undefined) highlights.set(String(e.datum), (highlights.get(String(e.datum)) ?? 0) + 1)
  return [...highlights].filter(([, n]) => n > MAX_HIGHLIGHTS_JE_TAG).map(([tag, n]) => `${tag}: ${n} Highlights, erlaubt sind ${MAX_HIGHLIGHTS_JE_TAG}`)
}

const RANG: Record<string, number> = { highlight: 0, feature: 1, bugfix: 2 }

/** `ueberarbeitetBis`: letzter überarbeiteter Tag, alle späteren Einträge tragen `entwurf`. Erwartet Einträge mit aufgelöstem `datum`; neueste Tage oben (höchstens `MAX_TAGE`), im Tag: Highlights, Features, Bugfixes; sonst Reihenfolge der Datei. */
export function auslieferbarePatchnotes(roh: Record<string, unknown>[], ueberarbeitetBis?: string): Patchnote[] {
  const tage = [...new Set(roh.map((e) => e.datum as string))].sort().reverse().slice(0, MAX_TAGE)
  const rang = (e: Record<string, unknown>) => RANG[e.highlight === true ? 'highlight' : (e.kategorie as string)]!
  return tage.flatMap((tag) =>
    roh
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
        ...(ueberarbeitetBis !== undefined && (e.datum as string) > ueberarbeitetBis && { entwurf: true as const }),
      })),
  )
}
