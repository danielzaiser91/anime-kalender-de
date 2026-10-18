/** Zusicherung: Eine Uhrzeit aus Sichtungsfenster gilt nur am Sichtungstag, als timeEstimated, und erreicht keinen anderen Leser (18.10.2026, Tank Chair). */
import type { Release, Title } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { baueNews } from './lib/news.ts'
import { pruefeErgebnis } from './lib/pruefung.ts'
import { sichtungsZeilen } from './lib/sichtungsfenster.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const sichtung = { time: '16:30', notSeen: '16:18', seen: '16:32', date: '2026-10-18', source: 'Daniel' }
const serie = (extra: Partial<Release['schedule']>): Release =>
  ({
    slug: 'kulisse',
    titleId: 900001,
    name: 'Kulisse',
    platform: 'primevideo',
    releaseType: 'weekly',
    sources: ['https://example.org/'],
    schedule: { firstEpisodeDate: '2026-10-04', episodeCount: 5, ...extra },
  }) as Release
const keineZeit = (e: { time?: string; timeEstimated?: boolean } | undefined): boolean => e !== undefined && e.time === undefined && e.timeEstimated === undefined

const mit = expandEvents(serie({ timeSighting: sichtung }))
pruefe('fünf Folgen', mit.length === 5, mit.length)
pruefe('Folge 3 (18.10.) trägt 16:30 ≈', mit[2]?.date === '2026-10-18' && mit[2]?.time === '16:30' && mit[2]?.timeEstimated === true, mit[2])
for (const i of [0, 1, 3, 4]) pruefe(`Folge ${i + 1} ohne Uhrzeit`, keineZeit(mit[i]), mit[i])
pruefe('nur ein Termin mit Uhrzeit', mit.filter((e) => e.time).length === 1)

const ohne = expandEvents(serie({ time: '16:30', timeEstimated: true }))
pruefe('ohne timeSighting bleibt die festgelegte Zeit bei allen Folgen (Bestand)', ohne.every((e) => e.time === '16:30' && e.timeEstimated === true), ohne)
const gemessen = expandEvents(serie({ time: '17:00', timeSighting: sichtung }))
pruefe('eine gemessene Zeit am Sichtungstag bleibt', gemessen[2]?.time === '17:00' && gemessen[2]?.timeEstimated === undefined, gemessen[2])
const anderer = expandEvents(serie({ timeSighting: { ...sichtung, date: '2026-10-11' } }))
pruefe('Sichtungstag wandert mit: nur 11.10. trägt die Uhrzeit', anderer.filter((e) => e.time).map((e) => e.date).join() === '2026-10-11', anderer)

/* Bau-Ende: eine Sichtung ohne Termin mit Uhrzeit ist ein Fehler (drei Releases, der mittlere ohne Folgenzahl wie Tank Chair vor der Anreicherung). */
const imBau = (rs: Release[]) => pruefeErgebnis(rs, rs.flatMap(expandEvents), new Map(), '2026-10-18')
const sichtungsFehlerImBau = (rs: Release[]): string[] => imBau(rs).fehler.filter((f) => /timeSighting/.test(f))
const eigen = (slug: string, extra: Partial<Release['schedule']>): Release => ({ ...serie(extra), slug })
const ohneZahl = eigen('mitte', { episodeCount: undefined, timeSighting: sichtung })
pruefe('Bau-Ende: Sichtungstag ohne Termin wird gemeldet', sichtungsFehlerImBau([eigen('a', {}), ohneZahl, eigen('c', {})]).join() === '"mitte": timeSighting.date 2026-10-18 ergibt keinen Termin mit Uhrzeit (Folgenzahl oder Datum prüfen)', sichtungsFehlerImBau([ohneZahl]))
pruefe('Bau-Ende: mit Folgenzahl still', sichtungsFehlerImBau([eigen('a', {}), eigen('mitte', { timeSighting: sichtung }), eigen('c', {})]).length === 0)
pruefe('Bau-Ende: widerlegtes Release wird nicht gemeldet', sichtungsFehlerImBau([{ ...ohneZahl, widerlegt: { am: '2026-10-01', grund: 'Kulisse', gemeldet: true } }]).length === 0)
pruefe('Bau-Ende: Termin eines anderen Releases am Sichtungstag zählt nicht', sichtungsFehlerImBau([ohneZahl, eigen('fremd', {})]).length === 1)
const netflix = { ...eigen('nf', { episodeCount: 1, timeSighting: sichtung }), platform: 'netflix', netflixOriginal: true } as Release
pruefe('Bau-Ende: Uhrzeit eines anderen Tags (Netflix-Schätzung) deckt die Sichtung nicht', sichtungsFehlerImBau([netflix]).length === 1)

/* Ergebniszeile fürs Bau-Log (CI „PR-Datenbau“): sie steht in den Warnungen von pruefeErgebnis. */
const drei = [eigen('a', {}), eigen('mitte', { timeSighting: sichtung }), eigen('c', {})]
const zeile = 'Uhrzeit aus Sichtung: mitte 2026-10-18 ≈16:30'
pruefe('Ergebniszeile nennt Release, Tag und Zeit', sichtungsZeilen(drei, drei.flatMap(expandEvents)).join() === `1 ${zeile}`, sichtungsZeilen(drei, drei.flatMap(expandEvents)))
pruefe('pruefeErgebnis reicht die Zeile als Warnung durch', imBau(drei).warnungen.includes(`1 ${zeile}`), imBau(drei).warnungen)
pruefe('ohne Sichtung keine Zeile', sichtungsZeilen([eigen('a', {})], expandEvents(eigen('a', {}))).length === 0)

/* Nachträge (news.ts) lesen schedule.time: die Sichtungszeit erscheint dort nicht. */
const t1 = { id: 1, franchiseId: 1, slug: 't-1', titleEn: 'T1', streams: [] } as unknown as Title
const nachtrag = { kurz: 'Erster Satz.', abschnitte: [{ art: 'grund', text: 'Rest.' }] }
const relNews = { ...serie({ episodeCount: 1, firstEpisodeDate: '2026-10-04', timeSighting: { ...sichtung, date: '2026-10-04' } }), titleId: 1, nachtrag } as Release
const meldung = baueNews([t1], [relNews], [], [], { zuerst: {} }).flatMap((e) => e.meldungen).find((m) => m.art === 'nachgetragen')
pruefe('News: Nachtrag zu einem Release mit Sichtung zeigt keine Uhrzeit', meldung !== undefined && meldung.zeit === undefined, meldung)

if (fehler) process.exit(1)
console.log('check-sichtung-folge: alle Zusicherungen erfüllt')
