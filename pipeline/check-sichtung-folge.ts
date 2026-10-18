/** Zusicherung: Eine Uhrzeit aus Sichtungsfenster gilt nur für den gesichteten Tag, die übrigen Folgen bleiben ohne Uhrzeit (18.10.2026, Tank Chair). */
import type { Release } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { pruefeErgebnis } from './lib/pruefung.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const sichtung = { notSeen: '16:18', seen: '16:32', date: '2026-10-18', source: 'Daniel' }
const serie = (extra: Partial<Release['schedule']>): Release =>
  ({
    slug: 'kulisse',
    titleId: 900001,
    name: 'Kulisse',
    platform: 'primevideo',
    releaseType: 'weekly',
    sources: ['https://example.org/'],
    schedule: { firstEpisodeDate: '2026-10-04', episodeCount: 5, time: '16:30', timeEstimated: true, ...extra },
  }) as Release

const mit = expandEvents(serie({ timeSighting: sichtung }))
pruefe('fünf Folgen', mit.length === 5, mit.length)
pruefe('Folge 3 (18.10.) trägt 16:30 ≈', mit[2]?.date === '2026-10-18' && mit[2]?.time === '16:30' && mit[2]?.timeEstimated === true, mit[2])
pruefe('Folge 1 davor ohne Uhrzeit', mit[0]?.time === undefined && mit[0]?.timeEstimated === undefined, mit[0])
pruefe('Folge 2 davor ohne Uhrzeit', mit[1]?.time === undefined && mit[1]?.timeEstimated === undefined, mit[1])
pruefe('Folge 4 danach ohne Uhrzeit', mit[3]?.time === undefined && mit[3]?.timeEstimated === undefined, mit[3])
pruefe('Folge 5 danach ohne Uhrzeit', mit[4]?.time === undefined && mit[4]?.timeEstimated === undefined, mit[4])
pruefe('nur ein Termin mit Uhrzeit', mit.filter((e) => e.time).length === 1)

const ohne = expandEvents(serie({}))
pruefe('ohne timeSighting bleibt die Uhrzeit bei allen Folgen (Bestand)', ohne.every((e) => e.time === '16:30' && e.timeEstimated === true), ohne)

const stuecke = expandEvents(serie({ timeSighting: { ...sichtung, date: '2026-10-11' } }))
pruefe('Sichtungstag wandert mit: nur 11.10. trägt die Uhrzeit', stuecke.filter((e) => e.time).map((e) => e.date).join() === '2026-10-11', stuecke)

/* Bau-Ende: eine Sichtung ohne Termin mit Uhrzeit ist ein Fehler (drei Releases, der mittlere ohne Folgenzahl wie Tank Chair vor der Anreicherung). */
const sichtungsFehlerImBau = (rs: Release[]): string[] =>
  pruefeErgebnis(rs, rs.flatMap(expandEvents), new Map(), '2026-10-18').fehler.filter((f) => /timeSighting/.test(f))
const eigen = (slug: string, extra: Partial<Release['schedule']>): Release => ({ ...serie(extra), slug })
const ohneZahl = eigen('mitte', { episodeCount: undefined, timeSighting: sichtung })
pruefe('Bau-Ende: Sichtungstag ohne Termin wird gemeldet', sichtungsFehlerImBau([eigen('a', {}), ohneZahl, eigen('c', {})]).join() === '"mitte": timeSighting.date 2026-10-18 ergibt keinen Termin mit Uhrzeit (Folgenzahl oder Datum prüfen)', sichtungsFehlerImBau([ohneZahl]))
pruefe('Bau-Ende: mit Folgenzahl still', sichtungsFehlerImBau([eigen('a', {}), eigen('mitte', { timeSighting: sichtung }), eigen('c', {})]).length === 0)
pruefe('Bau-Ende: widerlegtes Release wird nicht gemeldet', sichtungsFehlerImBau([{ ...ohneZahl, widerlegt: { am: '2026-10-01', grund: 'Kulisse', gemeldet: true } }]).length === 0)
pruefe('Bau-Ende: Termin eines anderen Releases am Sichtungstag zählt nicht', sichtungsFehlerImBau([ohneZahl, eigen('fremd', {})]).length === 1)
pruefe('Bau-Ende: Termin am Sichtungstag ohne Uhrzeit wird gemeldet', sichtungsFehlerImBau([eigen('mitte', { time: undefined, timeSighting: sichtung })]).length === 1)
const netflix = { ...eigen('nf', { episodeCount: 1, timeSighting: sichtung }), platform: 'netflix', netflixOriginal: true } as Release
pruefe('Bau-Ende: Uhrzeit eines anderen Tags (Netflix-Schätzung) deckt die Sichtung nicht', sichtungsFehlerImBau([netflix]).length === 1)

if (fehler) process.exit(1)
console.log('check-sichtung-folge: alle Zusicherungen erfüllt')
