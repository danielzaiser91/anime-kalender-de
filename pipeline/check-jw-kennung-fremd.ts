/**
 * Zusicherung: **Keine JustWatch-Kennung hängt an Einträgen mit verschiedenen TMDB-Kennungen** (04.11.2026, Fancy Nancy:
 * Spin-off mit 20 Folgen auf der Hauptserie mit 123 — Bestandsbau rot). Fälle mit den echten Paaren, dann der echte Bestand
 * `data/justwatch-audio.json`. Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import { fremderHalter, geteilteJwKennungen, type JwKennungBefund } from './lib/jw-kennung-fremd.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const befund = (jwId: string, tmdbId: number, rest: Partial<JwKennungBefund> = {}): JwKennungBefund => ({ jwId, tmdbId, ...rest })

/* Der Anlass: Hauptserie 80056 hält die Kennung, das Spin-off 112652 will sie auch. */
const bestand: Record<string, JwKennungBefund> = {
  '-80056': befund('ts81647', 80056),
  '-112652': befund('ts81647', 112652),
  '-5': befund('ts1', 11),
  '-6': befund('ts2', 12),
  '-7': { tmdbId: 13, ohneTreffer: true },
}
pruefe('Spin-off wird als fremd erkannt', fremderHalter(bestand, '-112652', 'ts81647', 112652) === '-80056')
pruefe('Haupteintrag sieht den Spin-off ebenfalls als Halter', fremderHalter(bestand, '-80056', 'ts81647', 80056) === '-112652')
pruefe('Dieselbe TMDB-Kennung unter zweitem Schlüssel ist kein Fremder (Dublette einer Reihe)', fremderHalter({ ...bestand, '-99': befund('ts1', 11) }, '-99', 'ts1', 11) === undefined)
pruefe('Eigener Eintrag zählt nicht', fremderHalter(bestand, '-5', 'ts1', 11) === undefined)
pruefe('Ein Eintrag ohne Treffer hält keine Kennung', fremderHalter({ '-7': befund('ts9', 13, { ohneTreffer: true }) }, '-8', 'ts9', 14) === undefined)
pruefe('Unbekannte Kennung hat keinen Halter', fremderHalter(bestand, '-8', 'ts77', 14) === undefined)
pruefe('TMDB-Kennung fehlt am Halter: gilt als verschieden', fremderHalter({ '-1': { jwId: 'ts3' } }, '-2', 'ts3', 4) === '-1')

const geteilt = geteilteJwKennungen(bestand)
pruefe('Geteilte Kennung genau eine, mit beiden Schlüsseln', geteilt.size === 1 && geteilt.get('ts81647')?.join() === '-80056,-112652', [...geteilt])
pruefe('Zwei Schlüssel derselben TMDB-Reihe sind nicht geteilt', geteilteJwKennungen({ a: befund('ts1', 5), b: befund('ts1', 5) }).size === 0)
pruefe('ohneTreffer mit Kennung zählt nicht', geteilteJwKennungen({ a: befund('ts1', 5), b: befund('ts1', 6, { ohneTreffer: true }) }).size === 0)

const echt = JSON.parse(readFileSync('data/justwatch-audio.json', 'utf8')) as Record<string, JwKennungBefund>
const echtGeteilt = geteilteJwKennungen(echt)
pruefe(
  'Im Bestand hängt keine JustWatch-Kennung an zwei TMDB-Reihen (Eintrag der Nebenreihe auf ohneTreffer setzen, Gegenprobe Folgenzahl)',
  echtGeteilt.size === 0,
  [...echtGeteilt],
)

console.log(
  fehler
    ? `check-jw-kennung-fremd: ${fehler} Fehler`
    : `check-jw-kennung-fremd: 11 Prüfungen grün, ${Object.keys(echt).length} Einträge, ${echtGeteilt.size} geteilte JustWatch-Kennungen an verschiedenen TMDB-Reihen`,
)
process.exit(fehler ? 1 : 0)
