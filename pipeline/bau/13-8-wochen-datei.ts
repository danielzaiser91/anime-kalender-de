import type { Release, ReleaseEvent, Title } from '../../shared/types.ts'
import { baueWochenDatei, pruefeWochenDatei } from '../../shared/wochen-datei.ts'
import { todayIso } from '../../shared/time.ts'
import { log, readJson, writeJson } from '../lib/util.ts'
import { OUT } from './grundlagen.ts'

/**
 * **`woche.json` — der Start der Wochenansicht.** Wird aus den fertig geschriebenen Kerndateien geschnitten (nach dem Titelrang, dem letzten Schreiber
 * von `titles-core.json`), damit jeder Eintrag byte-gleich in den vollen Dateien steht; stimmt das nicht, bricht der Bau ab.
 */
export function schreibeWochenDatei(): void {
  const titles = readJson<Title[]>(`${OUT}/titles-core.json`, [])
  const releases = readJson<Release[]>(`${OUT}/releases.json`, [])
  const events = readJson<ReleaseEvent[]>(`${OUT}/events.json`, [])
  const woche = baueWochenDatei(todayIso(), titles, releases, events)
  const fehler = pruefeWochenDatei(woche, titles, releases, events)
  if (fehler.length) {
    for (const f of fehler) console.error('  ✖', f)
    console.error(`\n${fehler.length} Widerspruch/Widersprüche in woche.json — Bau abgebrochen.`)
    process.exit(1)
  }
  writeJson(`${OUT}/woche.json`, woche)
  log(`woche.json ${woche.von}–${woche.bis}: ${woche.events.length} Termine, ${woche.releases.length} Releases, ${woche.titles.length} Titel`)
}
