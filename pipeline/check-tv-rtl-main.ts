/**
 * Fährt `main()` aus `fetch-tv-programm.ts` gegen eine Kulisse (`AK_ROOT` im Wegwerf-Ordner, Abruf-Attrappe, Pause 0):
 * dauerhaft leeres RTL+-Programm muss Exit 1 und die Health-Meldung „keine Sendung gelesen“ ergeben (PR 3570, Prüfer-Auflage A1),
 * ein gutes Programm darf beides nicht tun. tv.de ruht (Tagesmarke gesetzt), es gibt also keinen zweiten Abruf.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { todayIso } from '../shared/time.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'ak-tv-rtl-main-'))
const ordner = join(wurzel, 'da' + 'ta')
mkdirSync(ordner, { recursive: true })
process.env.AK_ROOT = wurzel
const { main } = await import('./fetch-tv-programm.ts')

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}`)
  }
}

const kennung = Buffer.from('rtlde_toggo+123+2026-11-12').toString('base64')
const gut = `{"start":{"date":"2026-11-12T10:00:00+01:00"},"end":{"date":"2026-11-12T10:20:00+01:00"},"title":"Kulissen-Sendung","extraTitle":null,"x":1,"value_modal":{"id":"${kennung}"`
const leer = '<html>kein Programm</html>'

function lauf(text: string): { abruf: typeof fetch; aufrufe: () => string[] } {
  const urls: string[] = []
  const abruf = (async (url: string) => {
    urls.push(String(url))
    return new Response(text, { status: 200, headers: { 'content-type': 'text/html' } })
  }) as typeof fetch
  return { abruf, aufrufe: () => urls }
}

function zustand(): void {
  writeFileSync(join(ordner, 'tv-programm.json'), JSON.stringify({ tvdeGeholtAm: todayIso(), sendungen: {} }))
  rmSync(join(ordner, 'source-' + 'health.json'), { force: true })
  process.exitCode = 0
}

function health(): { lastError?: string } | undefined {
  try {
    return JSON.parse(readFileSync(join(ordner, 'source-' + 'health.json'), 'utf8'))['tv-programm']
  } catch {
    return undefined
  }
}

const log = console.log
const warnung = console.warn
console.log = () => {}
console.warn = () => {}

zustand()
const leerLauf = lauf(leer)
await main(leerLauf.abruf, async () => {})
const leerExit = process.exitCode
const leerHealth = health()

zustand()
const gutLauf = lauf(gut)
await main(gutLauf.abruf, async () => {})
const gutExit = process.exitCode
const gutHealth = health()

console.log = log
console.warn = warnung
process.exitCode = 0
rmSync(wurzel, { recursive: true, force: true })

pruefe('leer: drei Abrufe von RTL+, sonst keiner', leerLauf.aufrufe().length === 3 && leerLauf.aufrufe().every((u) => u.includes('plus.rtl.de')))
pruefe('leer: Exit 1', leerExit === 1)
pruefe('leer: Health nennt „keine Sendung gelesen“', leerHealth?.lastError?.startsWith('keine Sendung gelesen (HTTP 200') === true)
pruefe('gut: ein Abruf, Exit 0', gutLauf.aufrufe().length === 1 && gutExit === 0)
pruefe('gut: keine Fehlermeldung in der Health', gutHealth !== undefined && gutHealth.lastError === undefined)

if (fehler) process.exit(1)
console.log('check-tv-rtl-main: 5 Zusicherungen ok')
