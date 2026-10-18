/** Zusicherung: Eine Uhrzeit aus Sichtungsfenster steht nur in timeSighting.time, Fenster ≤ 30 min, Datum, Quelle; jede andere festgelegte Zeit braucht eine benannte Ausnahme (18.10.2026). */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Schedule } from '../shared/types.ts'
import type { Sichtung } from '../shared/sichtung.ts'
import { FESTGELEGTE_ZEITEN, sichtungsFehler as pruefeSichtung, zeitFehler } from './lib/sichtungsfenster.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const HEUTE = '2026-10-20'
const fenster: Sichtung = { time: '16:30', notSeen: '16:18', seen: '16:32', date: '2026-10-18', source: 'Daniel' }
const gut = (extra: Partial<Schedule> = {}): Schedule => ({ firstEpisodeDate: '2026-10-04', timeSighting: { ...fenster }, ...extra })
const mitFenster = (teil: Partial<Sichtung>): Schedule => gut({ timeSighting: { ...fenster, ...teil } })
const sichtungsFehler = (s: Schedule, heute = HEUTE): string[] => pruefeSichtung(s, heute)
const meldung = (s: Schedule): string => sichtungsFehler(s).join('|')

pruefe('gültig: keine Meldung', sichtungsFehler(gut()).length === 0, meldung(gut()))
pruefe('ohne timeSighting: nicht zuständig', sichtungsFehler({ firstEpisodeDate: '2026-10-04' }).length === 0)
pruefe('Fenster genau 30 min ist erlaubt', sichtungsFehler(mitFenster({ notSeen: '16:02' })).length === 0)
pruefe('Fenster 31 min zu weit', /länger als 30/.test(meldung(mitFenster({ notSeen: '16:01' }))), meldung(mitFenster({ notSeen: '16:01' })))
pruefe('Fenster rückwärts', /länger als 30/.test(meldung(mitFenster({ notSeen: '16:40' }))))
pruefe('schedule.time neben der Sichtung', /gehört nach timeSighting.time/.test(meldung(gut({ time: '16:30' }))))
for (const feld of ['time', 'notSeen', 'seen', 'date', 'source'] as const) {
  pruefe(`Angabe ${feld} fehlt`, /braucht time, notSeen, seen, date und source/.test(meldung(mitFenster({ [feld]: '' }))), meldung(mitFenster({ [feld]: '' })))
}
pruefe('time vor dem Fenster', /außerhalb/.test(meldung(mitFenster({ time: '16:17' }))))
pruefe('time nach dem Fenster', /außerhalb/.test(meldung(mitFenster({ time: '16:33' }))))
pruefe('time am Fensterrand ok', sichtungsFehler(mitFenster({ time: '16:18' })).length === 0 && sichtungsFehler(mitFenster({ time: '16:32' })).length === 0)
pruefe('Zeit kein HH:MM', /ISO/.test(meldung(mitFenster({ seen: '4:32' }))))
pruefe('time kein HH:MM', /ISO/.test(meldung(mitFenster({ time: '16:3' }))))
pruefe('Stunde 24 ist keine Zeit', /ISO/.test(meldung(mitFenster({ seen: '24:00' }))))
pruefe('Minute 60 ist keine Zeit', /ISO/.test(meldung(mitFenster({ notSeen: '16:60' }))))
pruefe('Datum kein ISO', /ISO/.test(meldung(mitFenster({ date: '18.10.2026' }))))
pruefe('Datum mit einstelligem Tag ist kein ISO', /ISO/.test(meldung(mitFenster({ date: '2026-10-1' }))))
pruefe('Sichtung vor der ersten Folge', /vor der ersten Folge/.test(meldung(mitFenster({ date: '2026-10-03' }))))
pruefe('Sichtung am ersten Tag ist erlaubt', sichtungsFehler(mitFenster({ date: '2026-10-04' })).length === 0)
pruefe('Sichtung in der Zukunft', /Zukunft/.test(sichtungsFehler(gut(), '2026-10-17').join()))
pruefe('Sichtung heute ist erlaubt', sichtungsFehler(gut(), '2026-10-18').length === 0)
pruefe('Fenster über die Stundengrenze, 30 min, ist erlaubt', sichtungsFehler(mitFenster({ time: '16:10', notSeen: '15:50', seen: '16:20' })).length === 0)
pruefe('Fenster der Länge null ist erlaubt', sichtungsFehler(mitFenster({ notSeen: '16:30', seen: '16:30' })).length === 0)

const plan = (extra: Partial<Schedule>): Schedule => ({ firstEpisodeDate: '2026-10-04', ...extra })
const avatar = Object.keys(FESTGELEGTE_ZEITEN)[0]!
pruefe('zeitFehler: time ohne HH:MM', zeitFehler(plan({ time: '16:3' }), HEUTE, 'x').join() === 'time "16:3" ist nicht HH:MM')
pruefe('zeitFehler: gemessene time (ohne timeEstimated) still', zeitFehler(plan({ time: '16:30' }), HEUTE, 'x').length === 0)
pruefe('zeitFehler: festgelegte Zeit ohne Ausnahme', /ohne benannte Ausnahme/.test(zeitFehler(plan({ time: '11:00', timeEstimated: true }), HEUTE, 'x').join()))
pruefe('zeitFehler: benannte Altausnahme still', zeitFehler(plan({ time: '11:00', timeEstimated: true }), HEUTE, avatar).length === 0)
pruefe('zeitFehler: Ausnahme gilt nur für ihren Slug', zeitFehler(plan({ time: '11:00', timeEstimated: true }), HEUTE, `${avatar}-x`).length === 1)
pruefe('zeitFehler: Zeit neben Sichtung meldet genau einen Fehler', zeitFehler(gut({ time: '16:30', timeEstimated: true }), HEUTE, 'x').length === 1)
pruefe('zeitFehler: gültige Sichtung still', zeitFehler(gut(), HEUTE, 'x').length === 0)

/* Verdrahtung: data:validate gegen eine Kulisse (AK_ROOT) mit drei Einträgen, der mittlere trägt die Zeitzeilen. */
function validiere(zeilen: string[], slug = 'mitte'): { code: number | null; aus: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'ak-sichtung-'))
  mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
  const eintrag = (name: string, extra: string[]): string =>
    [`- slug: ${name}`, '  anilistId: 1', '  platform: primevideo', '  releaseType: weekly', '  schedule:', '    firstEpisodeDate: "2026-10-04"', ...extra, '  sources:', '    - https://example.org/', ''].join('\n')
  writeFileSync(join(wurzel, 'data', 'curated', 'k.yaml'), [eintrag('a', []), eintrag(slug, zeilen), eintrag('c', [])].join('\n'))
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'pipeline/validate.ts'], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8', windowsHide: true })
  rmSync(wurzel, { recursive: true, force: true })
  return { code: r.status, aus: `${r.stdout}${r.stderr}` }
}
const sichtung = (von: string, datum = '2026-10-18', zeit = '16:30'): string[] => [
  `    timeSighting: { time: "${zeit}", notSeen: "${von}", seen: "16:32", date: "${datum}", source: Daniel }`,
]
const gutLauf = validiere(sichtung('16:18'))
pruefe('validate: gültiges Fenster läuft durch', gutLauf.code === 0, gutLauf)
const schlecht = validiere(sichtung('15:00'))
pruefe('validate: zu weites Fenster bricht ab und nennt den Eintrag', schlecht.code === 1 && /"mitte": timeSighting: Fenster 15:00/.test(schlecht.aus), schlecht)
const zukunft = validiere(sichtung('16:18', '2999-01-01'))
pruefe('validate: Sichtung in der Zukunft bricht ab', zukunft.code === 1 && /Zukunft/.test(zukunft.aus), zukunft)
const zeitFormat = validiere(['    time: "16:3"'])
pruefe('validate: time ohne HH:MM bricht ab', zeitFormat.code === 1 && /"mitte": time "16:3" ist nicht HH:MM/.test(zeitFormat.aus), zeitFormat)
const festgelegt = validiere(['    time: "11:00"', '    timeEstimated: true'])
pruefe('validate: festgelegte Zeit ohne Ausnahme bricht ab', festgelegt.code === 1 && /"mitte": time \+ timeEstimated ohne benannte Ausnahme/.test(festgelegt.aus), festgelegt)
const altfall = validiere(['    time: "11:00"', '    timeEstimated: true'], avatar)
pruefe('validate: benannte Altausnahme läuft durch', altfall.code === 0, altfall)

if (fehler) process.exit(1)
console.log('check-sichtungsfenster: alle Zusicherungen erfüllt')
