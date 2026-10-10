import { existsSync } from 'node:fs'
import { ARCHIV_DIR } from './anisearch-warteschlange.ts'

/** Titel, die nur bei aniSearch stehen, tragen `10.000.000 + aniSearch-Kennung` (`bau/anisearch-titel.ts`). */
const ANISEARCH_AB = 10_000_000
const TAG_MS = 86_400_000
/** So lange gilt eine Auskunft „Seite gibt es nicht" (HTTP 404/410) bzw. „Seite ohne Archivabschnitte" (200), bevor erneut gefragt wird. */
const WEG_TAGE = { 404: 60, 410: 60, 200: 14 } as const

export interface Zeile {
  id: number
  anisearchId?: number
  titleDe?: string
  dubConfidence?: string
}
/** Eine Seite, die ein Lauf holen soll; `titelIds` sind die AniList-Titel, deren Cache-Eintrag sie füllt (leer = nur Archiv, so bei reinen aniSearch-Titeln). */
export interface Auftrag {
  asId: number
  titelIds: number[]
}
/** Kennung → letzte endgültige Auskunft (`data/anisearch-archiv-weg.json`). */
export type WegListe = Record<string, { code: number; am: string }>

const archivDatei = (asId: number): string => `${ARCHIV_DIR}/${asId}.html.gz`
export const hatArchiv = (asId: number): boolean => existsSync(archivDatei(asId))

export function kennungVon(t: Zeile, bruecke: Record<number, number>): number | undefined {
  return t.id >= ANISEARCH_AB ? t.id - ANISEARCH_AB : (bruecke[t.id] ?? t.anisearchId)
}

/** Nach einer endgültigen Auskunft erst nach Ablauf der Frist wieder fragen; eine Nichtauskunft (Sperre, Zeitüberschreitung) steht nie hier. */
export function zurueckgestellt(weg: WegListe, asId: number, jetztMs: number): boolean {
  const w = weg[asId]
  if (!w) return false
  const tage = WEG_TAGE[w.code as keyof typeof WEG_TAGE] ?? 14
  return jetztMs - new Date(w.am).getTime() < tage * TAG_MS
}

/** Die Katalogtitel mit deutschem Titel und sicherer Synchro zuerst — dort ist die Trefferquote am höchsten (Stichprobe 06.09.2026). */
const katalogVorn = (a: Zeile, b: Zeile): number =>
  Number(Boolean(b.titleDe)) - Number(Boolean(a.titleDe)) || Number(b.dubConfidence === 'high') - Number(a.dubConfidence === 'high')

/**
 * **Die Vorrangliste für Archivseiten:** erst die Lücken im Hauptbestand (Titel mit Termin zuerst, AniList-Titel vor reinen aniSearch-Titeln),
 * dann die des Katalogs. Eine Lücke ist eine Kennung ohne Archivdatei — bei einem AniList-Titel mit eigener Kennung auch ohne Cache-Eintrag. Jede Kennung
 * steht einmal. Teilen sich mehrere Titel eine Kennung (GANTZ und GANTZ 2: 42 Kennungen, 117 Titel, 10.10.2026), gehört die Seite keinem von ihnen allein:
 * sie wird archiviert, füllt aber keinen Cache-Eintrag (im Cache steht bis heute keine Kennung doppelt).
 */
export function archivLuecken(e: {
  haupt: Zeile[]
  katalog: Zeile[]
  bruecke: Record<number, number>
  mitTermin: Set<number>
  hatCache: (titelId: number) => boolean
  weg: WegListe
  jetztMs: number
}): { haupt: Auftrag[]; katalog: Auftrag[] } {
  const gesehen = new Map<number, Auftrag>()
  const anspruch = new Map<number, number>()
  for (const t of [...e.haupt, ...e.katalog]) {
    const as = kennungVon(t, e.bruecke)
    if (as) anspruch.set(as, (anspruch.get(as) ?? 0) + 1)
  }
  const sammle = (liste: Zeile[]): Auftrag[] => {
    const raus: Auftrag[] = []
    for (const t of liste) {
      const asId = kennungVon(t, e.bruecke)
      if (!asId || zurueckgestellt(e.weg, asId, e.jetztMs)) continue
      const fuelltCache = t.id < ANISEARCH_AB && anspruch.get(asId) === 1
      if (hatArchiv(asId) && (!fuelltCache || e.hatCache(t.id))) continue
      if (gesehen.has(asId)) continue
      const neu = { asId, titelIds: fuelltCache ? [t.id] : [] }
      gesehen.set(asId, neu)
      raus.push(neu)
    }
    return raus
  }
  const haupt = [...e.haupt].sort(
    (a, b) =>
      Number(e.mitTermin.has(b.id)) - Number(e.mitTermin.has(a.id)) || Number(a.id >= ANISEARCH_AB) - Number(b.id >= ANISEARCH_AB),
  )
  return { haupt: sammle(haupt), katalog: sammle([...e.katalog].sort(katalogVorn)) }
}

/** Reiht Aufträge hintereinander; dieselbe Kennung steht nur beim ersten, ihre Cache-Schlüssel wachsen zusammen. */
export function verbinde(...listen: Auftrag[][]): Auftrag[] {
  const je = new Map<number, Auftrag>()
  for (const a of listen.flat()) {
    const da = je.get(a.asId)
    if (!da) je.set(a.asId, { asId: a.asId, titelIds: [...a.titelIds] })
    else for (const id of a.titelIds) if (!da.titelIds.includes(id)) da.titelIds.push(id)
  }
  return [...je.values()]
}
