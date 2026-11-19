import { addDays, todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import { log, readJson, writeJson } from '../lib/util.ts'
import { NEIN_GILT_TAGE, type EntfernterVerweis } from './grundlagen.ts'
import { neuerStand, uebernommeneVerweise } from './verweise-gedaechtnis.ts'

/**
 * Schreibt `data/verweise-entfernt.json`: die in diesem Lauf entfernten Verweise samt übernommenen alten Einträgen.
 * Ohne neuen Eintrag bleibt die Datei unberührt.
 */
export function schreibeVerweiseGedaechtnis(allTitles: Title[], verweiseEntfernt: EntfernterVerweis[]): void {
  if (verweiseEntfernt.length) {
    const grenze = addDays(todayIso(), -NEIN_GILT_TAGE)
    const alt = readJson<{ stand?: string; verweise?: EntfernterVerweis[] }>('data/verweise-entfernt.json', {})
    const uebernommen = uebernommeneVerweise(alt.verweise ?? [], verweiseEntfernt, allTitles, grenze)
    if (uebernommen.length) log(`${uebernommen.length} gesperrte Verweise aus dem Gedächtnis übernommen`)
    const verweise = [...verweiseEntfernt, ...uebernommen]
    writeJson('data/verweise-entfernt.json', { stand: neuerStand(alt, verweise), verweise }, true)
  }
}
