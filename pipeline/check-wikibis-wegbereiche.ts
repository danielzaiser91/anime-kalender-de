/**
 * Weg-Bereiche unter `wikiBis` gehen nicht verloren, wenn die Wikipedia-Liste kein deutsches Sendedatum trägt
 * (Gachiakuta 178025: 24 Folgen, alle Bereiche weg, `de: []`). Fälle: Gachiakuta wörtlich (Crunchyroll 1–24,
 * Disney+ 1–12), Liste mit Datum behält Vorrang (One-Piece-Art), Datum in der Zukunft, Weg ohne Bereiche.
 * Aufruf: `npm run check:logic`.
 */
import type { StreamLink, Title } from '../shared/types.ts'
import { deutscheFolgen } from './bau/folgen-dateien.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${ist === undefined ? '' : ` — gefunden: ${JSON.stringify(ist)}`}`)
}

const text = (b: [number, number][]) => b.map(([a, c]) => `${a}-${c}`).join(',')
const titel = (streams: StreamLink[]) => ({ id: 900001, jpYear: 2026, streams }) as unknown as Title
const cr: StreamLink = { platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/GP5HJ84P7/gachiakuta', zugang: 'abo', dub: true, dubRanges: [{ from: 1, to: 24, dub: true }] }
const disney: StreamLink = { platform: 'disneyplus', url: 'https://www.disneyplus.com/browse/entity-x', zugang: 'abo', dub: true, dubRanges: [{ from: 1, to: 12, dub: true }] }
const ohneBereiche: StreamLink = { platform: 'rtlplus', url: 'https://plus.rtl.de/x', zugang: 'abo', dub: true }
const liste = (bis: number, ead?: Record<number, string>) => Array.from({ length: bis }, (_, i) => ({ nr: i + 1, ...(ead?.[i + 1] ? { ead: ead[i + 1] } : {}) }))
const heute = '2026-10-28'

console.log('wikiBis: Liste ohne deutsches Datum')
const g = deutscheFolgen(titel([cr, disney]), liste(24), heute, 24)
pruefe('Gachiakuta: Bereiche 1–24 bleiben', text(g) === '1-24', g)
const o = deutscheFolgen(titel([ohneBereiche]), liste(12), heute, 12)
pruefe('Weg ohne Bereiche deckt 1–12', text(o) === '1-12', o)

console.log('wikiBis: Liste mit deutschem Datum behält Vorrang')
const m = deutscheFolgen(titel([cr]), liste(24, { 1: '2026-09-01', 2: '2026-09-08' }), heute, 24)
pruefe('nur datierte Folgen 1–2 zählen unter wikiBis', text(m) === '1-2', m)
const z = deutscheFolgen(titel([cr]), liste(24, { 1: '2999-12-31' }), heute, 24)
pruefe('Datum in der Zukunft: keine Folge', text(z) === '', z)
const dar = deutscheFolgen(titel([cr]), liste(10, { 1: '2026-09-01' }), heute, 24)
pruefe('Liste bis 10 mit Datum: Wege füllen ab 11', text(dar) === '1-1,11-24', dar)

console.log(`check-wikibis-wegbereiche: ${fehler ? `${fehler} Fehler` : 'ok'}`)
process.exit(fehler ? 1 : 0)
