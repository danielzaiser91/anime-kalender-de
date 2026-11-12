/**
 * **Marken je Titel in einem Sammelartikel** (Magic Knight Rayearth, 29.10.2026): Ein Artikel, der mehrere Titel belegt, bekommt für jeden Titel eine Marke im Bild
 * oder einen Grund, warum nicht — sonst zeigt der Beleg-Dialog das Bild eines anderen Titels, und niemand sieht, dass eine Marke fehlt.
 */
import type { BelegGedaechtnis } from './beleg-lesung.ts'
import type { Gruppe } from './beleg-suche.ts'
import { terminMarken } from './beleg-stelle.ts'

/** `nicht-gefunden`: Der Artikel nennt den Titel nicht (oder keine Zeile, die ihn nennt). `ausserhalb`: Die Fundstelle liegt außerhalb des Bild-Ausschnitts. */
export type OhneMarkeGrund = 'nicht-gefunden' | 'ausserhalb'

/** Was eine Lesung von den Marken je Titel festhält. */
export interface MarkenStand {
  markierungen?: Record<string, unknown>
  ohneMarke?: Record<string, OhneMarkeGrund>
}

/** Die Titel eines Sammelartikels (ab zwei), die weder eine Marke noch einen Grund haben — bei einem einzelnen Titel gilt die gemeinsame Marke, dort gibt es keine Lücke. */
export function markenLuecken(stand: MarkenStand, gruppen: Gruppe[]): number[] {
  if (gruppen.length < 2) return []
  return gruppen.filter((g) => !stand.markierungen?.[g.id] && !stand.ohneMarke?.[g.id]).map((g) => g.id)
}

/** Gelesene Adressen, deren jüngste Lesung mit Bild noch Titel ohne Marke und ohne Grund hat: Das Lesen hat sie stillschweigend verloren (Wächter am Lauf-Ende, Exit 1). */
export function stilleLuecken(gedaechtnis: BelegGedaechtnis, gruppen: Map<string, Gruppe[]>, gelesen: string[]): string[] {
  const raus: string[] = []
  for (const url of gelesen) {
    const l = gedaechtnis[url]?.lesungen.filter((x) => x.qs === 'ok' && x.bild).at(-1)
    const ids = l ? markenLuecken(l, gruppen.get(url) ?? []) : []
    if (ids.length) raus.push(`${url}: ${ids.length} von ${gruppen.get(url)!.length} Titeln ohne Marke und ohne Grund (${ids.join(', ')})`)
  }
  return raus
}

/**
 * Lauf-Ende: Eine gelesene Adresse mit stiller Lücke wirft (der Lauf wird rot); noch nicht neu gelesene Altlesungen sind eine einzeilige Warnung, sie stehen in der nächsten Schlange vorn.
 * Rückgabe: Zahl der Adressen mit Lücke in einer älteren Lesung.
 */
export function meldeMarkenLuecken(gedaechtnis: BelegGedaechtnis, gruppen: Map<string, Gruppe[]>, gelesen: string[]): number {
  const still = stilleLuecken(gedaechtnis, gruppen, gelesen)
  if (still.length) throw new Error(`Sammelartikel ohne Marke und ohne Grund je Titel — ${still.join('; ')}`)
  const offen = Object.keys(gedaechtnis).filter((u) => markenLuecken(gedaechtnis[u]!.lesungen.at(-1) ?? {}, gruppen.get(u) ?? []).length > 0).length
  if (offen) console.log(`⚠ WARNUNG Belege: ${offen} Sammelartikel haben für einen Titel weder Marke noch Grund und werden neu gelesen`)
  return offen
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * Titel mit Grund `nicht-gefunden`, deren Name (und Termin, sofern die Quelle einen nennt) im gespeicherten Seitentext steht: Dort hat das Lesen die Marke verloren,
 * der Artikel belegt den Titel (anime2you, 59 Adressen, 11.11.2026). Ziel 0; echte Fälle (Termin steht in einer anderen Zeile) gehören auf die Handliste.
 */
export function nameImTextOhneMarke(text: string, ohneMarke: Record<string, OhneMarkeGrund> | undefined, gruppen: Gruppe[]): number[] {
  const t = ` ${norm(text)} `
  const roh = text.toLowerCase()
  return gruppen
    .filter((g) => ohneMarke?.[g.id] === 'nicht-gefunden')
    .filter((g) => g.suchen.some((s) => norm(s).length > 3 && t.includes(` ${norm(s)} `)))
    .filter((g) => !g.tage.length || terminMarken(g.tage).some((m) => roh.includes(m)))
    .map((g) => g.id)
}

const istAnisearchArtikel = (url: string): boolean => /anisearch\.de\/article\//.test(url)
const vergleichsNamen = (gruppen: Gruppe[]): string[] => gruppen.flatMap((g) => g.suchen).filter((s) => norm(s).length > 3)

/** Meldet, wie viele der gelesenen aniSearch-Produktseiten keinen Namen zum Vergleichen haben (dort gilt die Seite ungeprüft); gibt die Zahl zurück. */
export function meldeOhneNamen(adressen: string[], gruppen: Map<string, Gruppe[]>, melde: (zeile: string) => void): number {
  const seiten = adressen.filter(istAnisearchArtikel)
  const ohne = seiten.filter((u) => !vergleichsNamen(gruppen.get(u) ?? []).length).length
  if (ohne) melde(`WARNUNG ${ohne} von ${seiten.length} gelesenen aniSearch-Adressen ohne Namen, Seitentitel ungeprüft`)
  return ohne
}

/**
 * Zeigt eine aniSearch-Produktseite den Titel, den die Adresse belegen soll? Sonst ist ihr Erscheinungstag fremd (Seite 185053 zeigte am 07.11.2026 einen
 * Manga-eBook statt Gods' Games We Play). Ohne bekannte Namen gibt es nichts zu vergleichen: dann gilt die Seite (die Zahl solcher Adressen meldet `meldeOhneNamen`). Ein Fehlschlag meldet sich, er fällt nicht still weg.
 */
export function seitentitelPasst(url: string, text: string, gruppen: Gruppe[], melde: (zeile: string) => void): boolean {
  const namen = vergleichsNamen(gruppen)
  if (!istAnisearchArtikel(url) || !namen.length) return true
  const t = ` ${norm(text)} `
  if (namen.some((s) => t.includes(' ' + norm(s) + ' '))) return true
  melde(`WARNUNG Beleg ${url}: Seite nennt keinen Namen des Titels (${namen.slice(0, 3).join(' | ')}) — Erscheinungstag verworfen`)
  return false
}

/** Meldet die Titel aus `nameImTextOhneMarke` (eine Zeile je Adresse) und gibt ihre Zahl zurück. */
export function meldeNameImText(url: string, text: string, ohneMarke: Record<string, OhneMarkeGrund> | undefined, gruppen: Gruppe[], melde: (zeile: string) => void): number {
  const ids = nameImTextOhneMarke(text, ohneMarke, gruppen)
  if (ids.length) melde(`Beleg ${url}: ${ids.length} Titel stehen im Seitentext, haben aber keine Marke (${ids.join(', ')}) — Lesefehler untersuchen`)
  return ids.length
}

/** Fassung der Markensuche: steigt sie, werden Lesungen mit Grund `nicht-gefunden` einmal neu aufgenommen (2 seit 11.11.2026: Seitenende bei gesperrtem Scrollen, anime2you). */
export const MARKEN_FASSUNG = 2

/** Eine Lesung mit `nicht-gefunden` aus einer älteren Fassung der Markensuche: Der Grund kann ein Lesefehler sein und wird neu geprüft. */
export function markenVeraltet(l: { markenfassung?: number; ohneMarke?: Record<string, OhneMarkeGrund> }): boolean {
  return (l.markenfassung ?? 1) < MARKEN_FASSUNG && Object.values(l.ohneMarke ?? {}).includes('nicht-gefunden')
}
