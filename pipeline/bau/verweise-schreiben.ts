import { addDays, todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import { ladeHandbelege } from '../lib/dub-confirmed.ts'
import { bestandVorher } from '../lib/bestand-vorher.ts'
import { log, readJson, writeJson } from '../lib/util.ts'
import { belegGestrichen } from './beleg-wege-protokoll.ts'
import { NEIN_GILT_TAGE, type EntfernterVerweis } from './grundlagen.ts'
import { gedaechtnisAusgabe, type GedaechtnisDatei } from './verweise-gedaechtnis.ts'

/**
 * Schreibt `data/verweise-entfernt.json`: die in diesem Lauf entfernten Verweise samt übernommenen alten Einträgen, dazu die per
 * Handbeleg gestrichenen Wege fürs Wachprotokoll (Lehre 140: sonst „ohne protokollierten Grund weg“). Ohne neuen Eintrag bleibt
 * die Datei unberührt.
 */
export function schreibeVerweiseGedaechtnis(allTitles: Title[], verweiseEntfernt: EntfernterVerweis[]): void {
  const vorher = bestandVorher()
  const belegNeu = vorher.length ? belegGestrichen(vorher, allTitles, ladeHandbelege(), todayIso()) : []
  if (belegNeu.length) log(`${belegNeu.length} Wege per Handbeleg (available: false) gestrichen, ins Wachprotokoll eingetragen`)
  if (!verweiseEntfernt.length && !belegNeu.length) return
  const alt = readJson<GedaechtnisDatei>('data/verweise-entfernt.json', {})
  const datei = gedaechtnisAusgabe(alt, verweiseEntfernt, belegNeu, allTitles, addDays(todayIso(), -NEIN_GILT_TAGE))
  const uebernommen = datei.verweise.length - verweiseEntfernt.length
  if (uebernommen) log(`${uebernommen} gesperrte Verweise aus dem Gedächtnis übernommen`)
  writeJson('data/verweise-entfernt.json', datei, true)
}
