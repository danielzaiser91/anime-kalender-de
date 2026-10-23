/** Zusicherung: Der Regeltermin aus einer Sichtung (schedule.time) gilt an allen Folgen, ohne ≈ bei Fenster unter einer Stunde; eine Abweichung je Folge schlägt ihn (18.10.2026, F39, Tank Chair). */
import type { Release } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { pruefeErgebnis } from './lib/pruefung.ts'
import { sichtungsZeilen } from './lib/sichtungsfenster.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const sichtung = { notSeen: '16:18', seen: '16:32', date: '2026-10-18', source: 'Daniel' }
const serie = (extra: Partial<Release['schedule']>, slug = 'kulisse'): Release =>
  ({
    slug,
    titleId: 900001,
    name: 'Kulisse',
    platform: 'primevideo',
    releaseType: 'weekly',
    sources: ['https://example.org/'],
    schedule: { firstEpisodeDate: '2026-10-04', episodeCount: 5, time: '16:30', timeSighting: sichtung, ...extra },
  }) as Release

const alle = expandEvents(serie({}))
pruefe('fünf Folgen', alle.length === 5, alle.length)
pruefe('Fenster unter 1 h: alle Folgen (auch vergangene) 16:30 ohne ≈', alle.every((e) => e.time === '16:30' && e.timeEstimated === undefined), alle)

const weit = expandEvents(serie({ timeSighting: { ...sichtung, notSeen: '15:30' }, timeEstimated: true }))
pruefe('Fenster ab 1 h: Regeltermin mit ≈ an allen Folgen', weit.every((e) => e.time === '16:30' && e.timeEstimated === true), weit)

const abweichung = expandEvents(serie({ zeiten: { 2: '17:00' } }))
pruefe('Abweichung schlägt den Regeltermin nur an ihrer Folge', abweichung.map((e) => e.time).join() === '16:30,17:00,16:30,16:30,16:30', abweichung.map((e) => e.time))

/* Bau-Ende: pruefeErgebnis reicht die Ergebniszeile fürs Bau-Log (CI „PR-Datenbau“) durch. */
const ohne = { timeSighting: undefined, time: undefined }
const drei = [serie(ohne, 'a'), serie({}, 'mitte'), serie(ohne, 'c')]
const zeile = '1 Regeltermin aus Sichtung: mitte 16:18–16:32 → 16:30'
const ergebnis = pruefeErgebnis(drei, drei.flatMap(expandEvents), new Map(), '2026-10-18')
pruefe('Ergebniszeile nennt Release, Fenster und Zeit', sichtungsZeilen(drei).join() === zeile, sichtungsZeilen(drei))
pruefe('pruefeErgebnis reicht die Zeile als Warnung durch', ergebnis.warnungen.includes(zeile), ergebnis.warnungen)
pruefe('ohne Sichtung keine Zeile', sichtungsZeilen([drei[0]!]).length === 0)
const weitZeile = sichtungsZeilen([serie({ timeSighting: { ...sichtung, notSeen: '15:30' }, timeEstimated: true })])
pruefe('Zeile zeigt ≈ bei weitem Fenster', weitZeile.join() === '1 Regeltermin aus Sichtung: kulisse 15:30–16:32 → ≈16:30', weitZeile)
const widerlegt = { ...serie({}), widerlegt: { am: '2026-10-01', grund: 'Kulisse', gemeldet: true } } as Release
pruefe('widerlegtes Release steht nicht in der Zeile', sichtungsZeilen([widerlegt]).length === 0)

if (fehler) process.exit(1)
console.log('check-sichtung-folge: alle Zusicherungen erfüllt')
