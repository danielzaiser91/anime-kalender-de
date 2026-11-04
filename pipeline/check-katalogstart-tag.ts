/**
 * Katalogstart am Starttag ohne Uhrzeit (Bass X Machina, Netflix, 6 Folgen am 03.11.2026): Der Kasten schrieb bis Mitternacht „0 von 6 Folgen
 * erschienen" samt Leiste und blendete die Stream-Pille (mit „Deutsch") aus. Läuft in `check:logic`.
 * Die Uhr steht fest am Starttag um 22:00 Berlin; die Systemuhr spielt keine Rolle.
 */
import type { Release, Title } from '../shared/types.ts'
import { istErschienen } from '../shared/logic.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const TAG = '2026-11-03'
const ABENDS = new Date('2026-11-03T21:00:00Z')
const FRUEH = new Date('2026-11-02T22:00:00Z')

function release(art: 'batch' | 'weekly', plattform = 'netflix'): Release {
  return {
    slug: `katalogtag-${art}-${plattform}`,
    titleId: 900101,
    name: 'Katalogtag',
    platform: plattform,
    platformUrl: 'https://www.example.org/katalogtag',
    releaseType: art,
    schedule: { firstEpisodeDate: TAG, episodeCount: 6 },
    sources: ['https://www.example.org/katalogtag'],
  } as unknown as Release
}

const titel = {
  id: 900101,
  format: 'TV',
  episodes: 6,
  titleEn: 'Katalogtag',
  streams: [{ platform: 'netflix', url: 'https://www.example.org/katalogtag', dub: true, dubRanges: [{ from: 1, to: 6, dub: true }] }],
} as unknown as Title

const batchAbends: any = berechneAntwort({ title: titel, releases: [release('batch')], today: TAG, jetzt: ABENDS })
pruefe('Katalogstart ohne Uhrzeit: am Starttag abends alle erschienen (fertig, 6 von 6)', batchAbends?.art === 'fertig', String(batchAbends?.art))

const batchFrueh: any = berechneAntwort({ title: titel, releases: [release('batch')], today: '2026-11-02', jetzt: FRUEH })
pruefe('Katalogstart ohne Uhrzeit: vor dem Starttag noch nicht erschienen', batchFrueh?.art !== 'fertig', String(batchFrueh?.art))

/* Kontrolle: Ein Wochentakt ohne Uhrzeit bleibt bis Tagesende offen, sonst wäre die Regel zu weit. */
const woche: any = berechneAntwort({ title: titel, releases: [release('weekly')], today: TAG, jetzt: ABENDS })
pruefe('Wochentakt ohne Uhrzeit am Starttag: Folge 1 noch nicht erschienen (laeuft, 0)', woche?.art === 'laeuft' && woche.raus === 0, `${woche?.art} ${woche?.raus}`)

/* Direkt an der Entscheidung: gleiche Eingabe, nur die Veröffentlichungsart wechselt; TV-Sichtung bleibt ausgenommen. */
const jetzt = ABENDS
pruefe('istErschienen: batch ohne Uhrzeit am Starttag', istErschienen({ date: TAG, releaseType: 'batch', platform: 'netflix' }, jetzt))
pruefe('istErschienen: batch im Fernsehen ohne Uhrzeit bleibt offen', !istErschienen({ date: TAG, releaseType: 'batch', platform: 'tv' }, jetzt))
pruefe('istErschienen: weekly ohne Uhrzeit bleibt offen', !istErschienen({ date: TAG, releaseType: 'weekly', platform: 'netflix' }, jetzt))
pruefe('istErschienen: batch mit Uhrzeit 23:00 Berlin um 22:00 noch offen', !istErschienen({ date: TAG, time: '23:00', releaseType: 'batch', platform: 'netflix' }, jetzt))
pruefe('istErschienen: batch am Vortag der Uhr (Datum morgen) offen', !istErschienen({ date: '2026-11-04', releaseType: 'batch', platform: 'netflix' }, jetzt))

if (fehler > 0) process.exit(1)
console.log('✓ Katalogstart-Tag: 8 Fälle (Kasten fertig/laeuft, Vorabend, Wochentakt, TV, Uhrzeit, Folgetag)')
