/** Geratene Wikipedia-Seitennamen für einen Titel: seine eigenen Namen (Ebene „titel“) und die der Reihe ohne Staffel- und Teilmarken (Ebene „reihe“). */
import type { Ebene } from './typen.ts'

export interface Kandidat {
  name: string
  ebene: Ebene
}

// Staffel-/Teilmarken am Ende oder nach Doppelpunkt/Strich: „Staffel 2“, „2nd Season“, „Part 2“, „Cour 1“, „Teil 3“, „Final Season“, „(2026)“.
const MARKE = /\s*(?:[:\-–—]\s*)?(?:\(\d{4}\)|(?:staffel|season|teil|part|cour|kapitel|chapter)\s*\d+(?:\s*[-–—:]\s*(?:cour|teil|part)\s*\d+)?|\d+(?:st|nd|rd|th)\s+season|final season|die finale staffel|the final season|(?:second|third|fourth|fifth) season)\s*$/i

// Formatzusätze: „Angel Beats! Specials“ gehört zum Artikel „Angel Beats!“. Nur für die Reihe; als Titelname bleibt „… Film“ ein eigener Name.
const FORMAT = /\s*(?:[:\-–—]\s*)?(?:specials?|ova|oad|the movie|movie|film|spezial)\s*$/i

export function ohneMarke(name: string, auchFormat = false): string {
  let s = name.trim()
  for (let i = 0; i < 3; i++) {
    const ohne = s.replace(MARKE, '')
    const neu = (auchFormat ? ohne.replace(FORMAT, '') : ohne).trim()
    if (neu === s) break
    s = neu
  }
  return s
}

/** Vor dem ersten Doppelpunkt: „Bakugan: Legends“ → „Bakugan“ (Reihenname vor dem Untertitel). */
export function vorDoppelpunkt(name: string): string | undefined {
  const i = name.indexOf(':')
  return i > 2 ? name.slice(0, i).trim() : undefined
}

const gleich = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Reihenfolge: eigene Namen (Englisch, Deutsch, Romaji) → Reihe. Ein Name, aus dem eine Marke fiel, gilt als Reihe, nicht als Titel — der Artikel dazu beschreibt die Reihe.
 * Doppelte Namen (ohne Rücksicht auf Groß-/Kleinschreibung) entfallen.
 */
export function seitenKandidaten(t: { titleEn?: string; titleDe?: string; titleRomaji?: string }, reiheNamen: string[]): Kandidat[] {
  const liste: Kandidat[] = []
  const nimm = (name: string | undefined, ebene: Ebene) => {
    const n = name?.trim().replace(/[’‘]/g, "'")
    if (n && n.length > 2 && !liste.some((k) => gleich(k.name, n))) liste.push({ name: n, ebene })
  }
  const eigene = [t.titleEn, t.titleDe, t.titleRomaji]
  for (const n of eigene) nimm(n && ohneMarke(n) === n ? n : undefined, 'titel')
  for (const n of eigene) nimm(n ? ohneMarke(n, true) : undefined, 'reihe')
  for (const n of eigene) nimm(n ? vorDoppelpunkt(ohneMarke(n, true)) : undefined, 'reihe')
  for (const n of reiheNamen) {
    nimm(ohneMarke(n, true), 'reihe')
    nimm(vorDoppelpunkt(ohneMarke(n, true)), 'reihe')
  }
  return liste
}
