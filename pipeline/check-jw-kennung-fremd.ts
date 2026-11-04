/**
 * Zusicherung: **Keine JustWatch-Kennung hängt an Einträgen mit verschiedenen TMDB-Kennungen** (04.11.2026, Fancy Nancy:
 * Spin-off mit 20 Folgen auf der Hauptserie mit 123 — Bestandsbau rot). Fälle mit den echten Paaren, dann der echte Bestand
 * `data/justwatch-audio.json`. Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import { abweisungsZeile, fremderHalter, geteilteJwKennungen, nimmTreffer, type JwKennungBefund } from './lib/jw-kennung-fremd.ts'

let fehler = 0
let geprueft = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  geprueft++
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

/* Auflage 2: eigener Schlüssel nach TMDB-Wechsel (alte jwId, andere tmdbId) sperrt sich nicht selbst. */
pruefe('Eigener Schlüssel nach TMDB-Wechsel ist kein Fremder', fremderHalter({ '-80056': befund('ts81647', 80056) }, '-80056', 'ts81647', 112652) === undefined)

/* Auflage 1: die Annahme des Sammlers (nimmTreffer), Spin-off gegen Hauptserie mit den echten Kennungen. */
const jwTreffer = { id: 'ts81647' }
const haupt = { '-80056': befund('ts81647', 80056) }
const spin = nimmTreffer(bestand, '-112652', jwTreffer, 112652)
pruefe('Spin-off trifft die Kennung der Hauptserie: abgewiesen, Halter -80056', spin.treffer === undefined && spin.halter === '-80056', spin)
pruefe('Hauptserie bekommt ihre Kennung (Gegenprobe)', nimmTreffer({ '-80056': befund('ts81647', 80056) }, '-80056', jwTreffer, 80056).treffer === jwTreffer)
pruefe('Zweiter Schlüssel derselben TMDB-Reihe wird angenommen (TMDB-Kennung zählt)', nimmTreffer(haupt, '-99', jwTreffer, 80056).treffer === jwTreffer)
pruefe('Eigener Schlüssel nach TMDB-Wechsel wird angenommen', nimmTreffer({ '-80056': befund('ts81647', 80056) }, '-80056', jwTreffer, 112652).treffer === jwTreffer)
pruefe('Unbekannte Kennung wird angenommen', nimmTreffer(bestand, '-112652', { id: 'ts5' }, 112652).treffer?.id === 'ts5')
pruefe('Kein Treffer bleibt kein Treffer', Object.keys(nimmTreffer(bestand, '-112652', undefined, 112652)).length === 0)
pruefe('Erwartet als Zeichenkette wie bei JustWatch wird verglichen', nimmTreffer(haupt, '-99', jwTreffer, '80056').treffer === jwTreffer && nimmTreffer(haupt, '-98', jwTreffer, '112652').halter === '-80056')

/* Auflage 4: die Warnzeile nennt Zahl und Titelnamen. */
const zeile = abweisungsZeile(['Fancy Nancy: Fancy It Yourself (-112652, Halter -80056)', 'Ranking of Kings: Schatzkiste (153452, Halter 113717)'])
pruefe('Warnzeile mit WARNUNG, Zahl und beiden Namen', zeile.startsWith('⚠ WARNUNG') && zeile.includes('2 Treffer') && zeile.includes('Fancy It Yourself') && zeile.includes('Schatzkiste'), zeile)

/* Auflage 3: eingefrorener Ausschnitt des alten Bestands (origin/main de6aef969 vom 04.11.2026) — der Wächter muss darauf rot sein. */
const ALT: Record<string, JwKennungBefund> = {
  '-80056': befund('ts81647', 80056),
  '-112652': befund('ts81647', 112652),
  '113717': befund('ts265144', 112613),
  '153452': befund('ts265144', 207743),
}
const altGeteilt = geteilteJwKennungen(ALT)
pruefe('Alter Bestand (Fancy Nancy, Ranking of Kings) wird als geteilt gemeldet', altGeteilt.size === 2 && altGeteilt.get('ts81647')?.length === 2, [...altGeteilt])

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
    : `check-jw-kennung-fremd: ${geprueft} Prüfungen grün, ${Object.keys(echt).length} Einträge, ${echtGeteilt.size} geteilte JustWatch-Kennungen an verschiedenen TMDB-Reihen`,
)
process.exit(fehler ? 1 : 0)
