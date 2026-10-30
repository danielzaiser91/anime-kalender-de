/**
 * Widerlegt ist der Termin, nicht die Ankündigung: Ist die Synchro angekündigt und alle Termine widerlegt, sagt `berechneAntwort`
 * `terminOffen` (Panel: „Deutsche Synchro angekündigt“); ohne Ankündigung bleibt es beim „widerlegt“. Die Bedingung (ein widerlegter
 * Release und kein Ereignis) ist `widerlegterTermin` in `shared/ankuendigung.ts`. Läuft in `check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { widerlegterTermin } from '../shared/ankuendigung.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const HEUTE = '2026-10-30'
const JETZT = new Date('2026-10-30T12:00:00Z')
/** Ein Release des Testtitels; jedes Feld eigene Zeile, damit keine Kette entsteht. */
function release(slug: string, platform: string, schedule: object, extra: object = {}): Release {
  return {
    slug,
    titleId: 900101,
    name: 'Testtitel',
    platform,
    platformUrl: 'https://www.example.org/',
    releaseType: 'weekly',
    schedule,
    sources: [],
    ...extra,
  } as unknown as Release
}
const widerlegt = release('bc-widerlegt', 'crunchyroll', { firstEpisodeDate: '2026-10-03', estimated: true, episodeCount: 12 }, {
  widerlegt: { am: '2026-10-03', grund: 'nur OmU', gemeldet: true },
})
/** Gültiger Release ohne Termin (kein Starttag, also kein Ereignis). */
const gueltigOhneTermin = release('bc-offen', 'netflix', {})
/** Gültiger Release mit Termin in der Zukunft (Ereignis). */
const gueltigMitTermin = release('bc-termin', 'netflix', { firstEpisodeDate: '2026-11-20', episodeCount: 12 })
const ank = { platform: 'crunchyroll', omuAb: '2026-10-03', synchro: 'angekuendigt', quellen: [], stand: '2026-09-15' }
const mitAnk = { id: 900101, format: 'TV', titleDe: 'Testtitel', streams: [], os: true, ankuendigung: ank } as unknown as Title
const ohneAnk = { id: 900101, format: 'TV', titleDe: 'Testtitel', streams: [], os: true } as unknown as Title
const offen = (title: Title, releases: Release[]) => {
  const a = berechneAntwort({ title, releases, today: HEUTE, jetzt: JETZT })
  return a?.art === 'widerlegt' ? { widerlegt: true, terminOffen: a.terminOffen } : { widerlegt: false, art: a?.art }
}

pruefe('Funktion: ohne Ereignisse gilt der widerlegte Termin', widerlegterTermin([widerlegt], 0)?.am === '2026-10-03')
pruefe('Funktion: ein Ereignis hebt „widerlegt“ auf', widerlegterTermin([widerlegt], 1) === undefined)
pruefe('Funktion: ohne widerlegten Release nichts', widerlegterTermin([gueltigOhneTermin], 0) === undefined)

const a1 = offen(mitAnk, [widerlegt])
pruefe('angekündigt, alle Termine widerlegt: widerlegt mit terminOffen', a1.widerlegt && a1.terminOffen === true, JSON.stringify(a1))
const a2 = offen(mitAnk, [widerlegt, gueltigOhneTermin])
pruefe('Mehrmitglied: ein Release widerlegt, einer gültig ohne Termin: weiter terminOffen', a2.widerlegt && a2.terminOffen === true, JSON.stringify(a2))
const a3 = offen(mitAnk, [widerlegt, gueltigMitTermin])
pruefe('widerlegt plus gültig mit Termin: nicht „widerlegt“', !a3.widerlegt, JSON.stringify(a3))
const a4 = offen(ohneAnk, [widerlegt])
pruefe('ohne Ankündigung: „widerlegt“ ohne terminOffen', a4.widerlegt && a4.terminOffen === false, JSON.stringify(a4))

if (fehler) process.exit(1)
console.log('check-synchro-termin-offen: 7 Fälle ok')
