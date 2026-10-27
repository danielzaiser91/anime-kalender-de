/**
 * **Die Wochenprogramm-Zeit überlebt ihren Beleg** (Prüfer 2207): `data/crunchyroll-woche-belege.json` verliert Zeilen nach 21 Tagen
 * (`BEHALTEN_TAGE`), die API stempelt aber weiter falsch. Jede Zeit, die den API-Stempel tatsächlich ersetzt hat, merkt sich der Bau
 * in `data/cr-zeit-korrekturen.json` (Schlüssel `Serienkennung|Tag`, nur Abweichungen — eine Handvoll je Zeitumstellung) und liest sie
 * beim nächsten Bau als Beleg zurück. Ein frischer Beleg desselben Tages schlägt den gemerkten.
 */
import { readJson, writeJson } from './util.ts'
import type { WocheBelege } from './cr-zeit-woche.ts'

export const KORREKTUREN_DATEI = 'data/cr-zeit-korrekturen.json'
const BELEGE_DATEI_BAU = 'data/crunchyroll-woche-belege.json'

export type ZeitKorrekturen = Record<string, { seriesId: string; datum: string; zeit: string; artikel: string }>

/** Frische Belege plus gemerkte Zeiten für Tage, die kein frischer Beleg mehr abdeckt. */
export function belegeMitKorrekturen(belege: WocheBelege, korrekturen: ZeitKorrekturen): WocheBelege {
  const frisch = new Set(Object.values(belege).map((b) => `${b.seriesId}|${b.datum}`))
  const gemerkt = Object.entries(korrekturen).filter(([schluessel]) => !frisch.has(schluessel))
  return { ...Object.fromEntries(gemerkt.map(([schluessel, k]) => [`gemerkt|${schluessel}`, k])), ...belege }
}

/** Alt plus die Termine, deren Zeit der Beleg ersetzt hat; gibt die neue Merkliste zurück. */
export function korrekturenNach(alt: ZeitKorrekturen, termine: { time?: string; zeitQuelle?: string; zeitSchluessel?: string }[]): ZeitKorrekturen {
  const neu: ZeitKorrekturen = { ...alt }
  for (const t of termine) {
    if (!t.time || !t.zeitQuelle || !t.zeitSchluessel) continue
    const [seriesId, datum] = t.zeitSchluessel.split('|') as [string, string]
    neu[t.zeitSchluessel] = { seriesId, datum, zeit: t.time, artikel: t.zeitQuelle }
  }
  return neu
}

/** Die Belege des Bau-Laufs: Beleg-Datei und Merkliste zusammen. */
export function ladeZeitBelege(): WocheBelege {
  return belegeMitKorrekturen(readJson<WocheBelege>(BELEGE_DATEI_BAU, {}), readJson<ZeitKorrekturen>(KORREKTUREN_DATEI, {}))
}

/** Schreibt die Merkliste, nur wenn sich etwas ändert (kein Wechsel des Dateistands bei jedem Bau). Gibt die Zahl neuer Einträge zurück. */
export function merkeZeitKorrekturen(termine: Parameters<typeof korrekturenNach>[1]): number {
  const alt = readJson<ZeitKorrekturen>(KORREKTUREN_DATEI, {})
  const neu = korrekturenNach(alt, termine)
  const zahl = Object.keys(neu).length - Object.keys(alt).length
  if (JSON.stringify(neu) !== JSON.stringify(alt)) writeJson(KORREKTUREN_DATEI, neu, true)
  return zahl
}
