import { istFertig, type Zustand } from '@shared/empfehlung-kern.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import type { Ablauf } from './empfehlung-ablauf.ts'
import { fuelleAuf, rangliste } from './empfehlung-reise.ts'

/** Die letzten Vorschläge im Browser: wer zurückkommt, landet wieder bei ihnen. Nur Ergebnis und Leinwand werden gemerkt, kein halbes Duell. */

export const REISE_SCHLUESSEL = 'empfehlung:reise'

export interface GemerkteReise {
  ziel: number
  gezeigt: number[]
  zustand: Zustand
  /** Kennung der Pool-Reihenfolge: der Zustand trägt Indizes, die nach einem neuen Titel nicht mehr stimmen. */
  pool: number
}

/** Das schmale Stück von `Storage`; Tests setzen eine Attrappe ein. */
export interface ReiseSpeicher {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const istZahlenliste = (x: unknown, unter: number): x is number[] =>
  Array.isArray(x) && x.every((n) => Number.isInteger(n) && n >= 0 && n < unter)

/** Ob der Duellstand aus Indizes zu dieser Pool-Größe passt. */
function zustandPasst(z: Partial<Zustand>, einstiege: number): boolean {
  const indizes = [z.rest, z.sieger, z.gesehen, z.ausgeschlossen]
  if (!indizes.every((l) => istZahlenliste(l, einstiege))) return false
  if (![z.startwert, z.schritt, z.gewertet].every((n) => typeof n === 'number')) return false
  return z.neutral === null || (Array.isArray(z.neutral) && z.neutral.length === 2 && istZahlenliste(z.neutral, einstiege))
}

/**
 * Prüft ein gelesenes Objekt. Die Vorschläge (Titel-IDs) überleben einen neuen Pool; der Duellstand (Indizes) nur bei gleicher
 * Kennung und Größe, sonst fehlt `zustand` und die Vorschläge stehen ohne „genauer“.
 */
function alsReise(roh: unknown, einstiege: number, pool: number): (Omit<GemerkteReise, 'zustand'> & { zustand?: Zustand }) | undefined {
  const r = roh as Partial<GemerkteReise> | null
  const z = r?.zustand as Partial<Zustand> | undefined
  if (!r || !z || typeof r.pool !== 'number' || typeof r.ziel !== 'number' || !Array.isArray(r.gezeigt) || !r.gezeigt.every((n) => Number.isInteger(n))) return undefined
  const passt = r.pool === pool && zustandPasst(z, einstiege)
  if (r.pool === pool && !passt) return undefined
  return { ziel: r.ziel, gezeigt: r.gezeigt, zustand: passt ? (z as Zustand) : undefined, pool: r.pool }
}

export function reiseMerken(a: Ablauf, k: Kontext | undefined, speicher: ReiseSpeicher = localStorage): void {
  const imDuell = a.phase === 'duell' && (a.sitzung?.zustand.gewertet ?? 0) > 0
  if (!k || !a.sitzung || (a.phase !== 'ergebnis' && a.phase !== 'leinwand' && !imDuell)) return
  const reise: GemerkteReise = { ziel: a.ziel, gezeigt: a.gezeigt, zustand: a.sitzung.zustand, pool: poolKennung(k) }
  try {
    speicher.setItem(REISE_SCHLUESSEL, JSON.stringify(reise))
  } catch {
    /* Gesperrter oder voller Speicher: die Vorschläge gelten dann für diesen Besuch. */
  }
}

export function reiseVergessen(speicher: ReiseSpeicher = localStorage): void {
  try {
    speicher.removeItem(REISE_SCHLUESSEL)
  } catch {
    /* Gesperrter Speicher: dort steht auch nichts. */
  }
}

/**
 * Der gemerkte Stand als Ablauf: bei erreichtem Ziel auf den Vorschlägen, bei abgebrochenem Duell auf dem Start (zum Fortfahren);
 * `undefined`, wenn nichts da ist, es nicht mehr zum Pool passt oder kein Vorschlag übrig bleibt (verworfen oder gesehen seitdem).
 */
export function reiseWiederherstellen(
  k: Kontext,
  weg: ReadonlySet<number>,
  speicher: ReiseSpeicher = localStorage,
  eigene: ReadonlySet<string> = new Set(),
): Ablauf | undefined {
  try {
    const roh = speicher.getItem(REISE_SCHLUESSEL)
    const reise = roh ? alsReise(JSON.parse(roh), k.datei.einstiege.length, poolKennung(k)) : undefined
    if (!reise) return undefined
    const uebrig = reise.gezeigt.filter((id) => k.index.has(id) && !weg.has(id))
    /* Ohne Duellstand (neuer Pool) gibt es keine Rangliste zum Nachfüllen. */
    const gezeigt = uebrig.length && reise.zustand ? fuelleAuf(uebrig, rangliste(k, reise.zustand, [...weg], eigene)) : uebrig
    if (!reise.zustand) return gezeigt.length ? { phase: 'ergebnis', ziel: reise.ziel, gezeigt } : undefined
    const sitzung = { zustand: reise.zustand, verlauf: [] }
    if (!istFertig(k, reise.zustand, reise.ziel)) return { phase: 'start', sitzung, ziel: reise.ziel, gezeigt }
    return gezeigt.length ? { phase: 'ergebnis', sitzung, ziel: reise.ziel, gezeigt } : undefined
  } catch {
    return undefined
  }
}

/** Prüfsumme über Kennungen und Reihenfolge der Einstiege (FNV-1a); ändert sich, sobald sich ein Index verschiebt. */
export function poolKennung(k: Kontext): number {
  let h = 2166136261
  for (const e of k.datei.einstiege) h = Math.imul(h ^ e.id, 16777619) >>> 0
  return h
}
