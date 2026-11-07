/**
 * Eingabestand: Welcher Abrufzeitpunkt jeder Sammler-Eingabe steckt im erzeugten Datensatz (`meta.json` → `eingabeStand`)?
 * Ein Bau auf älteren Eingaben als der vorige fällt als Warnung im Bau-Log auf — kein Abbruch: ein zurückgenommener
 * Sammler-Stand („Sammler-Stand zurückgenommen“) ist legitim und dürfte den Bestandsbau sonst dauerhaft rot machen.
 * Nur Dateien, die ihren Zeitstempel selbst tragen; hier wird keiner erfunden.
 */
import { readJson, log } from './util.ts'
import type { DataMeta } from '../../shared/types.ts'

/** Eingaben des Baus mit eigenem Abrufzeitpunkt (Stand 07.11.2026, gegen die Köpfe der Dateien gemessen); Schlüssel in `meta.json` = Dateiname ohne `.json`. */
export const EINGABEN: readonly { datei: string; feld: string }[] = [
  { datei: 'data/cache/anilist-katalog.json', feld: 'geholtAm' },
  { datei: 'data/adn-catalog.json', feld: 'scrapedAt' },
  { datei: 'data/adn-news.json', feld: 'geholtAm' },
  { datei: 'data/adn.json', feld: 'scrapedAt' },
  { datei: 'data/anime-ids.json', feld: 'updatedAt' },
  { datei: 'data/ann-ids.json', feld: 'updatedAt' },
  { datei: 'data/cinestar.json', feld: 'geholtAm' },
  { datei: 'data/cr-katalog-de.json', feld: 'geholtAm' },
  { datei: 'data/crunchyroll-dub.json', feld: 'scrapedAt' },
  { datei: 'data/crunchyroll-neu.json', feld: 'geholtAm' },
  { datei: 'data/crunchyroll-series-ids.json', feld: 'aufgeloestAm' },
  { datei: 'data/crunchyroll-woche.json', feld: 'geholtAm' },
  { datei: 'data/crunchyroll.json', feld: 'scrapedAt' },
  { datei: 'data/motn-changes.json', feld: 'fetchedAt' },
  { datei: 'data/motn.json', feld: 'fetchedAt' },
  { datei: 'data/rtlplus-folgen.json', feld: 'geholtAm' },
  { datei: 'data/toggo.json', feld: 'geholtAm' },
  { datei: 'data/tv-programm.json', feld: 'geholtAm' },
  { datei: 'data/wikipedia-folgen.json', feld: 'geholtAm' },
]

export type EingabeStand = Record<string, string>

export interface Rueckschritt {
  eingabe: string
  alt: string
  neu: string
}

const schluesselVon = (datei: string): string => datei.replace(/^data\//, '').replace(/\.json$/, '')

/** Zeitstempel der Eingaben; eine fehlende Datei, ein fehlendes oder kein Zeitstempel-Feld lässt den Eintrag weg. */
export function leseEingabeStand(lies: (datei: string) => unknown): EingabeStand {
  const stand: EingabeStand = {}
  for (const { datei, feld } of EINGABEN) {
    const wert = (lies(datei) as Record<string, unknown> | null | undefined)?.[feld]
    if (typeof wert === 'string' && !Number.isNaN(Date.parse(wert))) stand[schluesselVon(datei)] = wert
  }
  return stand
}

/** Einträge, die gegenüber dem vorigen Stand älter geworden sind; ohne vorigen Stand (erste Ausgabe) oder bei Gleichstand kein Befund. */
export function findeRueckschritte(alt: EingabeStand | undefined, neu: EingabeStand): Rueckschritt[] {
  const gefunden: Rueckschritt[] = []
  for (const [eingabe, vorher] of Object.entries(alt ?? {})) {
    const jetzt = neu[eingabe]
    if (jetzt !== undefined && Date.parse(jetzt) < Date.parse(vorher)) gefunden.push({ eingabe, alt: vorher, neu: jetzt })
  }
  return gefunden
}

/** Setzt `meta.eingabeStand` und warnt je Rückschritt gegenüber der bisher ausgelieferten `meta.json` (vor deren Neuschreiben aufrufen). */
export function vermerkeEingabeStand(meta: DataMeta, vorige: Pick<DataMeta, 'eingabeStand'>, lies: (datei: string) => unknown = (d) => readJson<unknown>(d, null)): void {
  meta.eingabeStand = leseEingabeStand(lies)
  for (const r of findeRueckschritte(vorige.eingabeStand, meta.eingabeStand)) {
    log(`⚠ WARNUNG Eingabestand zurück: ${r.eingabe} ${r.alt} → ${r.neu} (Bau auf älterer Eingabe als der vorige)`)
  }
}
