/**
 * **Marken je Titel in einem Sammelartikel** (Magic Knight Rayearth, 29.10.2026): Ein Artikel, der mehrere Titel belegt, bekommt für jeden Titel eine Marke im Bild
 * oder einen Grund, warum nicht — sonst zeigt der Beleg-Dialog das Bild eines anderen Titels, und niemand sieht, dass eine Marke fehlt.
 */
import type { BelegGedaechtnis } from './beleg-lesung.ts'
import type { Gruppe } from './beleg-suche.ts'

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
