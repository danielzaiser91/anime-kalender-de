import type { Zustand } from '@shared/empfehlung-kern.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import type { Ablauf } from './empfehlung-ablauf.ts'

/** Die letzten Vorschläge im Browser: wer zurückkommt, landet wieder bei ihnen. Nur Ergebnis und Leinwand werden gemerkt, kein halbes Duell. */

export const REISE_SCHLUESSEL = 'empfehlung:reise'

export interface GemerkteReise {
  ziel: number
  gezeigt: number[]
  zustand: Zustand
}

/** Das schmale Stück von `Storage`; Tests setzen eine Attrappe ein. */
export interface ReiseSpeicher {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const istZahlenliste = (x: unknown, unter: number): x is number[] =>
  Array.isArray(x) && x.every((n) => Number.isInteger(n) && n >= 0 && n < unter)

/** Prüft ein gelesenes Objekt gegen die Pool-Größe; ein Schlüssel, der nicht mehr passt, wird verworfen statt geraten. */
function alsReise(roh: unknown, einstiege: number): GemerkteReise | undefined {
  const r = roh as Partial<GemerkteReise> | null
  const z = r?.zustand as Partial<Zustand> | undefined
  if (!r || !z || typeof r.ziel !== 'number' || !Array.isArray(r.gezeigt) || !r.gezeigt.every((n) => Number.isInteger(n))) return undefined
  const indizes = [z.rest, z.sieger, z.gesehen, z.ausgeschlossen]
  if (!indizes.every((l) => istZahlenliste(l, einstiege))) return undefined
  if (![z.startwert, z.schritt, z.gewertet].every((n) => typeof n === 'number')) return undefined
  if (z.neutral !== null && !(Array.isArray(z.neutral) && z.neutral.length === 2 && istZahlenliste(z.neutral, einstiege))) return undefined
  return { ziel: r.ziel, gezeigt: r.gezeigt, zustand: z as Zustand }
}

export function reiseMerken(a: Ablauf, speicher: ReiseSpeicher = localStorage): void {
  if (!a.sitzung || (a.phase !== 'ergebnis' && a.phase !== 'leinwand')) return
  const reise: GemerkteReise = { ziel: a.ziel, gezeigt: a.gezeigt, zustand: a.sitzung.zustand }
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
 * Der gemerkte Stand als Ablauf auf den Vorschlägen; `undefined`, wenn nichts da ist, es nicht mehr zum Pool passt
 * oder kein Vorschlag übrig bleibt (verworfen oder gesehen seit dem letzten Besuch).
 */
export function reiseWiederherstellen(k: Kontext, weg: ReadonlySet<number>, speicher: ReiseSpeicher = localStorage): Ablauf | undefined {
  try {
    const roh = speicher.getItem(REISE_SCHLUESSEL)
    const reise = roh ? alsReise(JSON.parse(roh), k.datei.einstiege.length) : undefined
    if (!reise) return undefined
    const gezeigt = reise.gezeigt.filter((id) => k.index.has(id) && !weg.has(id))
    if (!gezeigt.length) return undefined
    return { phase: 'ergebnis', sitzung: { zustand: reise.zustand, verlauf: [] }, ziel: reise.ziel, gezeigt }
  } catch {
    return undefined
  }
}
