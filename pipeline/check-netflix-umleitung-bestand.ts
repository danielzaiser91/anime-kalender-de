/**
 * Zusicherung am gebauten Bestand: keine Netflix-Umleitung als Verweis oder eigene Reihe, keine zwei Kennungen
 * einer Franchise mit denselben Staffeln (Ranma ½, 24.10.2026). Läuft in `check:bestand`.
 * Optional: Pfad der Titel- und der Staffeldatei als Argumente (Ablauftest `check-netflix-umleitung-ablauf.ts`).
 */
import { readFileSync } from 'node:fs'
import { findeDoppelteNetflixKennungen, type StaffelListen, type TitelMitWegen } from './lib/netflix-doppelte-kennung.ts'

const lies = <T>(pfad: string | URL): T => JSON.parse(readFileSync(pfad, 'utf8')) as T
const titelPfad = process.argv[2] ?? new URL('../public/data/titles.json', import.meta.url)
const listenPfad = process.argv[3] ?? new URL('../data/anbieter-staffeln.json', import.meta.url)
const titles = lies<TitelMitWegen[]>(titelPfad)
const listen = lies<StaffelListen>(listenPfad)
const funde = findeDoppelteNetflixKennungen(titles, listen)
if (funde.length) {
  console.error(`FEHL check-netflix-umleitung-bestand: ${funde.join('; ')}`)
  process.exit(1)
}
console.log(`check-netflix-umleitung-bestand: ${titles.length} Titel, keine doppelte Netflix-Kennung.`)
