import { readJson, writeJson, log } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import type { TeilseitenPruefung } from '../lib/teilseiten.ts'
import { PRUEFLISTE } from './09-7-cr-teilseiten.ts'

/**
 * Die Prüfliste der geteilten Crunchyroll-Seiten entsteht in Phase 09-7, vor dem Dublettenabgleich der aniSearch-Zeilen.
 * Eine Zeile, die dort zugunsten ihres AniList-Titels entfällt (JJK Kouhen 10021915, 12.10.2026), steht dann in keiner
 * Ausgabedatei mehr, wohl aber auf der Liste. Ein Titel, den es nicht gibt, ist nichts zu prüfen: Er fliegt hier raus.
 */
export const nurAusgelieferte = (liste: TeilseitenPruefung[], ausgeliefert: Set<number>) => liste.filter((p) => ausgeliefert.has(p.titleId))

export function bereinigePruefliste(ausgeliefert: Set<number>): void {
  const liste = readJson<TeilseitenPruefung[]>(PRUEFLISTE, [])
  const bleibt = nurAusgelieferte(liste, ausgeliefert)
  if (bleibt.length === liste.length) return
  writeJson(PRUEFLISTE, bleibt)
  log(`Prüfliste geteilter Crunchyroll-Seiten: ${liste.length - bleibt.length} Titel ohne Ausgabe gestrichen (Dublette oder entfallen)`)
}

/** Kennungen der beiden Ausgabedateien: Hauptbestand (`slim`) und Datei hinter dem Schalter. */
export function ausgelieferteKennungen(slim: Title[]): Set<number> {
  const hinter = readJson<{ id: number }[]>('public/data/ohne-synchro.json', [])
  return new Set([...slim.map((t) => t.id), ...hinter.map((t) => t.id)])
}
