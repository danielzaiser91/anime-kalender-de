/**
 * Katalogstart am Starttag ohne Uhrzeit (Bass X Machina, Netflix, 6 Folgen am 03.11.2026): Der Kasten schrieb bis Mitternacht „0 von 6 Folgen
 * erschienen" samt Leiste und blendete die Stream-Pille (mit „Deutsch") aus. Ab 00:00 gilt ein Katalogstart (`batch`, nicht TV) ohne Uhrzeit als
 * da, der Kasten sagt aber „Uhrzeit offen" (`heuteOffen`) statt „alle erschienen"; ab dem Folgetag normal. Läuft in `check:logic`.
 * Die Uhr steht fest (Berlin im November = UTC+1); die Systemuhr spielt keine Rolle.
 */
import type { Release, Title } from '../shared/types.ts'
import { istErschienen } from '../shared/logic.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const TAG = '2026-11-03'
/** Berlin 00:30, 08:00, 22:00 am Starttag und 11:00 am Folgetag. */
const UHREN = { nachts: '2026-11-02T23:30:00Z', morgens: '2026-11-03T07:00:00Z', abends: '2026-11-03T21:00:00Z', folgetag: '2026-11-04T10:00:00Z' }
const HEUTE = { nachts: TAG, morgens: TAG, abends: TAG, folgetag: '2026-11-04' }
type Zeit = keyof typeof UHREN

function release(art: 'batch' | 'weekly' | 'movie', plattform: string, time?: string): Release {
  return {
    slug: `katalogtag-${art}-${plattform}`,
    titleId: 900101,
    name: 'Katalogtag',
    platform: plattform,
    platformUrl: 'https://www.example.org/katalogtag',
    releaseType: art,
    schedule: { firstEpisodeDate: TAG, time, episodeCount: art === 'movie' ? 1 : 6 },
    sources: ['https://www.example.org/katalogtag'],
  } as unknown as Release
}

const titel = (format: string, folgen: number) =>
  ({
    id: 900101,
    format,
    episodes: folgen,
    titleEn: 'Katalogtag',
    streams: [{ platform: 'netflix', url: 'https://www.example.org/katalogtag', dub: true, dubRanges: [{ from: 1, to: folgen, dub: true }] }],
  }) as unknown as Title

function antwort(art: 'batch' | 'weekly' | 'movie', zeit: Zeit, time?: string, plattform = 'netflix'): any {
  const t = art === 'movie' ? titel('MOVIE', 1) : titel('TV', 6)
  return berechneAntwort({ title: t, releases: [release(art, plattform, time)], today: HEUTE[zeit], jetzt: new Date(UHREN[zeit]) })
}

/* Katalogstart ohne Uhrzeit: nachts, morgens und abends dieselbe Zwischenform, am Folgetag „alle erschienen". */
for (const zeit of ['nachts', 'morgens', 'abends'] as const) {
  const a = antwort('batch', zeit)
  pruefe(`batch ohne Uhrzeit, ${zeit}: fertig mit heuteOffen`, a?.art === 'fertig' && a.heuteOffen === true, `${a?.art} ${a?.heuteOffen}`)
}
const folgetag = antwort('batch', 'folgetag')
pruefe('batch ohne Uhrzeit, Folgetag: fertig ohne heuteOffen', folgetag?.art === 'fertig' && !folgetag.heuteOffen, `${folgetag?.art} ${folgetag?.heuteOffen}`)

/* Mit belegter Uhrzeit (09:00): vorher noch nichts, danach normal fertig, nie die Zwischenform. */
pruefe('batch 09:00, 00:30: noch nichts erschienen', antwort('batch', 'nachts', '09:00')?.art === 'laeuft' && antwort('batch', 'nachts', '09:00').raus === 0)
pruefe('batch 09:00, 08:00: noch nichts erschienen', antwort('batch', 'morgens', '09:00')?.art === 'laeuft' && antwort('batch', 'morgens', '09:00').raus === 0)
const abend09 = antwort('batch', 'abends', '09:00')
pruefe('batch 09:00, 22:00: fertig ohne heuteOffen', abend09?.art === 'fertig' && !abend09.heuteOffen, `${abend09?.art} ${abend09?.heuteOffen}`)

/* Wochentakt ohne Uhrzeit: Folge 1 gilt bis Tagesende als offen (laeuft, 0), am Folgetag ist sie da. */
for (const zeit of ['nachts', 'morgens', 'abends'] as const) {
  const w = antwort('weekly', zeit)
  pruefe(`weekly ohne Uhrzeit, ${zeit}: laeuft, 0 erschienen`, w?.art === 'laeuft' && w.raus === 0, `${w?.art} ${w?.raus}`)
}
const wFolgetag = antwort('weekly', 'folgetag')
pruefe('weekly ohne Uhrzeit, Folgetag: Folge 1 erschienen', wFolgetag?.art === 'laeuft' && wFolgetag.raus === 1, `${wFolgetag?.art} ${wFolgetag?.raus}`)

/* Film (movie) ohne Uhrzeit: nie die Zwischenform, am Starttag nicht erschienen. */
for (const zeit of ['nachts', 'morgens', 'abends'] as const) {
  const f = antwort('movie', zeit)
  pruefe(`movie ohne Uhrzeit, ${zeit}: keine Zwischenform`, !f?.heuteOffen, `${f?.art} ${f?.heuteOffen}`)
}
const ev = (releaseType: string, platform = 'netflix', time?: string) => ({ date: TAG, releaseType, platform, time })
for (const zeit of ['nachts', 'morgens', 'abends'] as const) {
  pruefe(`istErschienen movie ohne Uhrzeit, ${zeit}: offen`, !istErschienen(ev('movie'), new Date(UHREN[zeit])))
  pruefe(`istErschienen weekly ohne Uhrzeit, ${zeit}: offen`, !istErschienen(ev('weekly'), new Date(UHREN[zeit])))
}
pruefe('istErschienen movie ohne Uhrzeit, Folgetag: da', istErschienen(ev('movie'), new Date(UHREN.folgetag)))

/* Direkt an der Entscheidung. */
pruefe('istErschienen batch ohne Uhrzeit, 00:30: da', istErschienen(ev('batch'), new Date(UHREN.nachts)))
pruefe('istErschienen batch ohne Uhrzeit, 22:00 Vortag: offen', !istErschienen(ev('batch'), new Date('2026-11-02T21:00:00Z')))
pruefe('istErschienen batch im Fernsehen ohne Uhrzeit: offen', !istErschienen(ev('batch', 'tv'), new Date(UHREN.abends)))
pruefe('istErschienen batch mit 23:00: um 22:00 offen', !istErschienen(ev('batch', 'netflix', '23:00'), new Date(UHREN.abends)))
pruefe('istErschienen batch Datum morgen: offen', !istErschienen({ date: '2026-11-04', releaseType: 'batch', platform: 'netflix' }, new Date(UHREN.abends)))

/* Push (dritter Parameter false): ohne Uhrzeit weiter 23:59, auch für den Katalogstart. */
pruefe('Push: batch ohne Uhrzeit, 00:30: offen', !istErschienen(ev('batch'), new Date(UHREN.nachts), false))
pruefe('Push: batch ohne Uhrzeit, 22:00: offen', !istErschienen(ev('batch'), new Date(UHREN.abends), false))
pruefe('Push: batch ohne Uhrzeit, Folgetag: da', istErschienen(ev('batch'), new Date(UHREN.folgetag), false))
pruefe('Push: batch mit Uhrzeit 08:00 um 09:00: da', istErschienen(ev('batch', 'netflix', '08:00'), new Date(UHREN.morgens), false))

if (fehler > 0) process.exit(1)
console.log(`✓ Katalogstart-Tag: ${faelle} Fälle (batch/weekly/movie × 00:30, 08:00, 22:00, Folgetag, mit und ohne Uhrzeit, Push 23:59)`)
