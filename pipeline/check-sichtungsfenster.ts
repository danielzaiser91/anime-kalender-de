/** Zusicherung: Ein Regeltermin aus Sichtungsfenster steht in schedule.time, belegt durch timeSighting (Fenster, Datum, Quelle), unter 60 min ohne ≈; jede andere festgelegte Zeit braucht eine benannte Ausnahme (18.10.2026). */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Schedule } from '../shared/types.ts'
import type { Sichtung } from '../shared/sichtung.ts'
import { FESTGELEGTE_ZEITEN, fristStrengIn, sichtungsFehler as pruefeSichtung, zeitFehler } from './lib/sichtungsfenster.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const HEUTE = '2026-10-20'
const fenster: Sichtung = { notSeen: '16:18', seen: '16:32', date: '2026-10-18', source: 'Daniel' }
const gut = (extra: Partial<Schedule> = {}): Schedule => ({ firstEpisodeDate: '2026-10-04', time: '16:30', timeSighting: { ...fenster }, ...extra })
const mitFenster = (teil: Partial<Sichtung>, extra: Partial<Schedule> = {}): Schedule => gut({ timeSighting: { ...fenster, ...teil }, ...extra })
const sichtungsFehler = (s: Schedule, heute = HEUTE): string[] => pruefeSichtung(s, heute)
const meldung = (s: Schedule): string => sichtungsFehler(s).join('|')

pruefe('gültig: keine Meldung', sichtungsFehler(gut()).length === 0, meldung(gut()))
pruefe('ohne timeSighting: nicht zuständig', sichtungsFehler({ firstEpisodeDate: '2026-10-04' }).length === 0)
pruefe('Sichtung ohne Regeltermin', /schedule.time fehlt/.test(meldung(gut({ time: undefined }))))
const w59 = { notSeen: '15:33' }
const w60 = { notSeen: '15:32' }
pruefe('Fenster 59 min ohne ≈ ist belegt', sichtungsFehler(mitFenster(w59, {})).length === 0, meldung(mitFenster(w59)))
pruefe('Fenster 59 min mit ≈ ist ein Fehler', /verlangt timeEstimated: false/.test(meldung(mitFenster(w59, { timeEstimated: true }))))
pruefe('Fenster 60 min mit ≈ ist erlaubt', sichtungsFehler(mitFenster(w60, { timeEstimated: true })).length === 0, meldung(mitFenster(w60, { timeEstimated: true })))
pruefe('Fenster 60 min ohne ≈ ist ein Fehler', /verlangt timeEstimated: true/.test(meldung(mitFenster(w60))))
pruefe('Fenster rückwärts', /liegt vor notSeen/.test(meldung(mitFenster({ notSeen: '16:40' }))))
for (const feld of ['notSeen', 'seen', 'date', 'source'] as const) {
  pruefe(`Angabe ${feld} fehlt`, /braucht notSeen, seen, date und source/.test(meldung(mitFenster({ [feld]: '' }))), meldung(mitFenster({ [feld]: '' })))
}
pruefe('time vor dem Fenster', /außerhalb/.test(meldung(gut({ time: '16:17' }))))
pruefe('time nach dem Fenster', /außerhalb/.test(meldung(gut({ time: '16:33' }))))
pruefe('time am Fensterrand ok', sichtungsFehler(gut({ time: '16:18' })).length === 0 && sichtungsFehler(gut({ time: '16:32' })).length === 0)
pruefe('Zeit kein HH:MM', /ISO/.test(meldung(mitFenster({ seen: '4:32' }))))
pruefe('time kein HH:MM', /ISO/.test(meldung(gut({ time: '16:3' }))))
pruefe('Stunde 24 ist keine Zeit', /ISO/.test(meldung(mitFenster({ seen: '24:00' }))))
pruefe('Minute 60 ist keine Zeit', /ISO/.test(meldung(mitFenster({ notSeen: '16:60' }))))
pruefe('Datum kein ISO', /ISO/.test(meldung(mitFenster({ date: '18.10.2026' }))))
pruefe('Datum mit einstelligem Tag ist kein ISO', /ISO/.test(meldung(mitFenster({ date: '2026-10-1' }))))
pruefe('Sichtung vor der ersten Folge', /vor der ersten Folge/.test(meldung(mitFenster({ date: '2026-10-03' }))))
pruefe('Sichtung am ersten Tag ist erlaubt', sichtungsFehler(mitFenster({ date: '2026-10-04' })).length === 0)
pruefe('Sichtung in der Zukunft', /Zukunft/.test(sichtungsFehler(gut(), '2026-10-17').join()))
pruefe('Sichtung heute ist erlaubt', sichtungsFehler(gut(), '2026-10-18').length === 0)
pruefe('Fenster über die Stundengrenze, 30 min, ist erlaubt', sichtungsFehler(mitFenster({ notSeen: '15:50', seen: '16:20' }, { time: '16:10' })).length === 0)
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
pruefe('zeitFehler: Ausnahme am letzten Tag still', zeitFehler(plan({ time: '11:00', timeEstimated: true }), FESTGELEGTE_ZEITEN[avatar]!.bis, avatar).length === 0)
const tagDanach = '2026-10-26'
pruefe('zeitFehler: Ausnahme am Tag nach der Frist ein Fehler', /abgelaufen/.test(zeitFehler(plan({ time: '11:00', timeEstimated: true }), tagDanach, avatar).join()), zeitFehler(plan({ time: '11:00', timeEstimated: true }), tagDanach, avatar))
pruefe('zeitFehler: abgelaufen, aber nicht streng (Deploy): still', zeitFehler(plan({ time: '11:00', timeEstimated: true }), tagDanach, avatar, false).length === 0)
pruefe('Frist: lokal streng', fristStrengIn({}) === true)
pruefe('Frist: PR-CI streng', fristStrengIn({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' }) === true)
for (const ereignis of ['push', 'schedule', 'workflow_dispatch', undefined]) pruefe(`Frist: CI-Ereignis ${ereignis} warnt nur`, fristStrengIn({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: ereignis }) === false)
pruefe('Ausnahmen haben Beleg und ISO-Frist', Object.values(FESTGELEGTE_ZEITEN).every((a) => a.beleg.length > 10 && /^\d{4}-\d{2}-\d{2}$/.test(a.bis)))

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
  `    time: "${zeit}"`,
  `    timeSighting: { notSeen: "${von}", seen: "16:32", date: "${datum}", source: Daniel }`,
]
const gutLauf = validiere(sichtung('16:18'))
pruefe('validate: gültiges Fenster läuft durch', gutLauf.code === 0, gutLauf)
const weitLauf = validiere([...sichtung('15:00'), '    timeEstimated: true'])
pruefe('validate: weites Fenster mit ≈ läuft durch', weitLauf.code === 0, weitLauf)
const schlecht = validiere(sichtung('15:00'))
pruefe('validate: weites Fenster ohne ≈ bricht ab und nennt den Eintrag', schlecht.code === 1 && /"mitte": timeSighting: Fenster 15:00–16:32 verlangt timeEstimated: true/.test(schlecht.aus), schlecht)
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
