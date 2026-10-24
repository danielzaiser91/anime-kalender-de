/**
 * Zusicherung am gebauten Bestand: keine Netflix-Umleitung als Verweis oder eigene Reihe, keine zwei Kennungen
 * einer Franchise mit denselben Staffeln (Ranma ½, 24.10.2026). Läuft in `check:bestand`.
 */
import { readFileSync } from 'node:fs'
import { findeDoppelteNetflixKennungen, type StaffelListen, type TitelMitWegen } from './lib/netflix-doppelte-kennung.ts'

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(new URL(pfad, import.meta.url), 'utf8')) as T
const titles = lies<TitelMitWegen[]>('../public/data/titles.json')
const listen = lies<StaffelListen>('../data/anbieter-staffeln.json')
const funde = findeDoppelteNetflixKennungen(titles, listen)
if (funde.length) {
  console.error(`FEHL check-netflix-umleitung-bestand: ${funde.join('; ')}`)
  process.exit(1)
}
console.log(`check-netflix-umleitung-bestand: ${titles.length} Titel, keine doppelte Netflix-Kennung.`)
