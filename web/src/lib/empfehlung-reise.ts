import type { Kandidat } from '@shared/empfehlung-pool.ts'
import { fortschritt, UNTERGRENZE_REST, VORSCHLAEGE, vorschlaege, type Zustand } from '@shared/empfehlung-kern.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'

/** Rechenschritte der Ansicht ohne DOM: Abzüge beim Start, Vorrang der eigenen Anbieter, Ersatz auf der Galerie, Zeilen und Zahlen. */

/** Alles, was der Nutzer schon kennt oder nicht sehen will: Favoriten, Gesehenes, Ausgeblendetes und „gesehen bis“ (Schlüssel = Kennung). */
export function ausgeschlossenFuerReise(mengen: {
  favoriten: Iterable<number>
  gesehen: Iterable<number>
  ausgeblendet: Iterable<number>
  gesehenBis: Record<string, number>
}): number[] {
  const alle = new Set<number>([...mengen.favoriten, ...mengen.gesehen, ...mengen.ausgeblendet])
  for (const id of Object.keys(mengen.gesehenBis)) alle.add(Number(id))
  return [...alle]
}

/** Zahl der Plätze, die die Rangliste vorhält: genug Ersatz für ✕ und ✓ auf der Galerie. */
export const RANGLISTE_LAENGE = 60

/** Wie weit vorn ein Titel bei den eigenen Anbietern stehen darf, um nach vorn zu rücken (Rest der Reihenfolge bleibt). */
const VORRANG_TIEFE = 20

const beiAnbieter = (k: Kandidat, eigene: ReadonlySet<string>): boolean => k.p.some(([platform]) => eigene.has(platform))

/**
 * Rangliste der Vorschläge aus dem Rechenkern; die eigenen Anbieter rücken innerhalb der ersten `VORRANG_TIEFE` nach vorn
 * (Vorrang, kein Filter: alle anderen bleiben im Pool, Mockup R4).
 */
export function rangliste(k: Kontext, z: Zustand, weg: number[], eigene: ReadonlySet<string>): Kandidat[] {
  const rang = vorschlaege(k, z, weg, RANGLISTE_LAENGE)
  if (!eigene.size) return rang
  const vorn = rang.slice(0, VORRANG_TIEFE)
  const eigeneVorn = vorn.filter((x) => beiAnbieter(x, eigene))
  const andere = vorn.filter((x) => !beiAnbieter(x, eigene))
  return [...eigeneVorn, ...andere, ...rang.slice(VORRANG_TIEFE)]
}

/** Die ersten Plätze der Galerie. */
export const ersteVorschlaege = (rang: Kandidat[]): number[] => rang.slice(0, VORSCHLAEGE).map((x) => x.id)

/** Ersetzt `entfernt` durch den nächsten Titel der Rangliste, der noch nicht gezeigt wird; gibt es keinen, rückt die Galerie zusammen. */
export function ersetzeVorschlag(gezeigt: number[], entfernt: number, rang: Kandidat[]): number[] {
  const naechster = rang.find((x) => !gezeigt.includes(x.id))
  if (naechster) return gezeigt.map((id) => (id === entfernt ? naechster.id : id))
  return gezeigt.filter((id) => id !== entfernt)
}

export const artWort = (k: Pick<Kandidat, 'f'>): string => (k.f === 'MOVIE' ? 'Film' : 'Serie')

/** „Film · 1997 · 133 Min“ bzw. „Serie · 2023 · 28 Folgen · ca. 24 Min“; Fehlendes entfällt, nichts wird erfunden. */
export function metaZeile(k: Pick<Kandidat, 'f' | 'y' | 'e'>, minuten?: number): string {
  if (k.f === 'MOVIE') return ['Film', k.y, minuten ? `${minuten} Min` : undefined].filter((x) => x !== undefined).join(' · ')
  const folgen = k.e ? `${k.e} ${k.e === 1 ? 'Folge' : 'Folgen'}` : undefined
  return ['Serie', k.y, folgen, minuten ? `ca. ${minuten} Min` : undefined].filter((x) => x !== undefined).join(' · ')
}

export interface Stand {
  /** Nummer des laufenden Duells, höchstens das Ziel. */
  nr: number
  ziel: number
  gesamt: number
  /** Restmenge; `null`, wenn sie an der Untergrenze klebt und die Zahl nur eine Grenze ist (kein Messwert). */
  rest: number | null
  fertig: boolean
}

export function stand(k: Kontext, z: Zustand, ziel: number): Stand {
  const f = fortschritt(k, z, ziel)
  return { nr: Math.min(f.gewertet + 1, ziel), ziel, gesamt: f.gesamt, rest: f.rest <= UNTERGRENZE_REST ? null : f.rest, fertig: f.fertig }
}

/** Gewertete Duelle, die „Noch vier Duelle – genauer“ ergibt: höchstens `max`. */
export const naechstesZiel = (ziel: number, max: number): number => Math.min(max, ziel + 4)

/** Gleichmäßig über den Pool verteilte Kennungen für das Cover-Mosaik der Einleitung (höchstens `anzahl`). */
export function mosaikIds(einstiege: Array<Pick<Kandidat, 'id'>>, anzahl: number): number[] {
  const schritt = Math.max(1, Math.floor(einstiege.length / anzahl))
  return einstiege.filter((_, i) => i % schritt === 0).slice(0, anzahl).map((k) => k.id)
}
