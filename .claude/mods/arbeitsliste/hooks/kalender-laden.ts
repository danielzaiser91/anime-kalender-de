// Lädt „Kalender heute“: stat je Takt, gelesen und geparst wird nur bei geänderter Datei (mtime/Größe).
import { heuteBerlin, kalenderHeute, termineAusDatei, wocheDeckt } from './kalender'
import type { KalenderStand, WocheDatei } from './kalender'

export const WOCHE_DATEI = 'C:/code/ai/anime-kalender-de/public/data/woche.json'
export const EVENTS_DATEI = 'C:/code/ai/anime-kalender-de/public/data/events.json'

export type KalenderDateien = {
  stat: (pfad: string) => Promise<{ mtimeMs: number; size: number }>
  read: (pfad: string) => Promise<string>
}
// Zwischenspeicher je Datei: Stempel (mtime:Größe) und ihr Inhalt.
export type KalenderCache = Record<string, { stempel: string; daten: WocheDatei }>

async function leseDatei(d: KalenderDateien, pfad: string, cache: KalenderCache): Promise<WocheDatei> {
  const s = await d.stat(pfad)
  const stempel = `${s.mtimeMs}:${s.size}`
  if (cache[pfad]?.stempel !== stempel) cache[pfad] = { stempel, daten: termineAusDatei(await d.read(pfad)) }
  return cache[pfad]!.daten
}

// Zeilen für den Berliner Tag zu `jetztMs`; ein Lesefehler lässt den Stand der letzten Lesung stehen (nie ein Wurf).
export async function ladeKalender(dateien: KalenderDateien, jetztMs: number, cache: KalenderCache): Promise<KalenderStand> {
  const datum = heuteBerlin(jetztMs)
  try {
    let daten = await leseDatei(dateien, WOCHE_DATEI, cache)
    if (!wocheDeckt(daten, datum)) daten = await leseDatei(dateien, EVENTS_DATEI, cache)
    return { datum, zeilen: kalenderHeute(daten.events ?? [], datum) }
  } catch {
    const alt = cache[WOCHE_DATEI]?.daten
    const daten = alt && wocheDeckt(alt, datum) ? alt : cache[EVENTS_DATEI]?.daten
    return { datum, zeilen: daten ? kalenderHeute(daten.events ?? [], datum) : [] }
  }
}
