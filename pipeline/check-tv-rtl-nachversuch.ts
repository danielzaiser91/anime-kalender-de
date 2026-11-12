/**
 * Zusicherungen zum Nachversuch beim RTL+-Programm (12.11.2026, Lauf 43205272650: einmal 0 Sendungen).
 * Die Seitenform ist die des echten Lesers (`sendungenAusSeite`), Antworten sind Attrappen.
 */
import { rtlProgrammLesen } from './fetch-tv-programm.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}`)
  }
}

const kennung = Buffer.from('rtlde_toggo+123+2026-11-12').toString('base64')
const gut =
  `{"start":{"date":"2026-11-12T10:00:00+01:00"},"end":{"date":"2026-11-12T10:20:00+01:00"},"title":"Super Wings","extraTitle":null,"x":1,"value_modal":{"id":"${kennung}"`
const leer = '<html>kein Programm</html>'

function attrappe(antworten: { status: number; text: string }[]): { abruf: typeof fetch; aufrufe: () => number } {
  let n = 0
  const abruf = (async () => {
    const a = antworten[Math.min(n++, antworten.length - 1)]!
    return new Response(a.text, { status: a.status, headers: { 'content-type': 'text/html' } })
  }) as typeof fetch
  return { abruf, aufrufe: () => n }
}

let pausen = 0
const pause = async (): Promise<void> => {
  pausen++
}

const a = attrappe([{ status: 200, text: leer }, { status: 200, text: gut }])
const r1 = await rtlProgrammLesen(a.abruf, pause)
pruefe('leer, dann gut: eine Sendung, keine Warnung', r1.sendungen.length === 1 && r1.grund === undefined)
pruefe('leer, dann gut: zwei Abrufe, eine Pause', a.aufrufe() === 2 && pausen === 1)

pausen = 0
const b = attrappe([{ status: 200, text: gut }])
const r2 = await rtlProgrammLesen(b.abruf, pause)
pruefe('sofort gut: ein Abruf, keine Pause', r2.sendungen.length === 1 && b.aufrufe() === 1 && pausen === 0)

pausen = 0
const c = attrappe([{ status: 200, text: leer }])
const r3 = await rtlProgrammLesen(c.abruf, pause)
pruefe('dauerhaft leer: drei Abrufe, zwei Pausen', c.aufrufe() === 3 && pausen === 2)
pruefe(
  'dauerhaft leer: Grund nennt Status, Größe, Typ und Versuche',
  r3.sendungen.length === 0 && r3.grund === `keine Sendung gelesen (HTTP 200, ${leer.length} Zeichen, text/html) nach 3 Versuchen`,
)

const d = attrappe([{ status: 503, text: '' }, { status: 503, text: '' }, { status: 200, text: gut }])
const r4 = await rtlProgrammLesen(d.abruf, pause)
pruefe('zweimal 503, dann gut: dritter Versuch zählt', r4.sendungen.length === 1 && d.aufrufe() === 3)

const e = attrappe([{ status: 200, text: gut }, { status: 200, text: gut }])
const r5 = await rtlProgrammLesen(
  (async () => {
    throw new Error('ECONNRESET')
  }) as typeof fetch,
  pause,
)
pruefe('Netzfehler dreimal: Grund nennt die Meldung', r5.grund === 'ECONNRESET nach 3 Versuchen' && e.aufrufe() === 0)

const f = attrappe([{ status: 429, text: '' }])
const r6 = await rtlProgrammLesen(f.abruf, pause)
pruefe('dauerhaft 429: Grund HTTP 429', r6.grund === 'HTTP 429 nach 3 Versuchen' && f.aufrufe() === 3)

if (fehler) process.exit(1)
console.log('check-tv-rtl-nachversuch: 7 Zusicherungen ok')
