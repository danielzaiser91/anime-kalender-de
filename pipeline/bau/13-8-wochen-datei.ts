import type { Release, ReleaseEvent, Title } from '../../shared/types.ts'
import { baueWochenDatei, pruefeWochenDatei, type WochenDatei } from '../../shared/wochen-datei.ts'
import { baueKachelDatei, pruefeKachelDatei } from '../../shared/wochen-kacheln.ts'
import { todayIso } from '../../shared/time.ts'
import { log, readJson, writeJson } from '../lib/util.ts'
import { OUT } from './grundlagen.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'

/**
 * **`woche.json` — der Start der Wochenansicht.** Wird aus den fertig geschriebenen Kerndateien geschnitten (nach dem Titelrang, dem letzten Schreiber
 * von `titles-core.json`), damit jeder Eintrag byte-gleich in den vollen Dateien steht; stimmt das nicht, bricht der Bau ab.
 */
export function schreibeWochenDatei(baueKacheln: (woche: WochenDatei) => WochenDatei = baueKachelDatei): void {
  const titles = readJson<Title[]>(`${OUT}/titles-core.json`, [])
  const releases = readJson<Release[]>(`${OUT}/releases.json`, [])
  const events = readJson<ReleaseEvent[]>(`${OUT}/events.json`, [])
  const woche = baueWochenDatei(todayIso(), titles, releases, events)
  const fehler = pruefeWochenDatei(woche, titles, releases, events)
  brichAbBeiWiderspruch(fehler, 'Widerspruch/Widersprüche in woche.json — Bau abgebrochen.')
  writeJson(`${OUT}/woche.json`, woche)
  const kacheln = baueKacheln(woche)
  brichAbBeiWiderspruch(pruefeKachelDatei(kacheln, woche), 'Widerspruch/Widersprüche in woche-kacheln.json — Bau abgebrochen.')
  writeJson(`${OUT}/woche-kacheln.json`, kacheln)
  log(`woche.json ${woche.von}–${woche.bis}: ${woche.events.length} Termine, ${woche.releases.length} Releases, ${woche.titles.length} Titel`)
}
