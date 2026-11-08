/**
 * Fälle für den Wächter `check-cr-kennung-maps.ts`: welche Formen er meldet (böse) und welche nicht (gut), dazu der
 * Verzeichnislauf in einem Wegwerf-Ordner (eine neue Map ohne Gruppierung wird gemeldet, eine Prüfdatei nicht).
 * Aufruf: `tsx pipeline/check-cr-kennung-maps-faelle.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findeKennungsMaps } from './lib/cr-kennung-map-wache.ts'
import { pruefeKennungsMaps } from './check-cr-kennung-maps.ts'

let verletzt = 0
let anzahl = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  anzahl++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const namen = (text: string): string => findeKennungsMaps(text).map((m) => m.name).join()

pruefe('böse: set mit s.seriesId', namen('const m = new Map()\nfor (const s of l) m.set(s.seriesId, s)') === 'm')
pruefe('böse: Konstruktor mit Paaren', namen('const m = new Map(l.map((s) => [s.seriesId, s]))') === 'm')
pruefe('böse: Konstruktor ohne Namen', namen('f(new Map(l.map((s) => [s.seriesId, s])))') === '(ohne Namen)')
pruefe('böse: Alias const id = s.seriesId', namen('const m = new Map()\nfor (const s of l) { const id = s.seriesId\n m.set(id, s) }') === 'm')
pruefe('böse: crunchyrollSeriesId(url) als Schlüssel', namen('const m = new Map()\nm.set(crunchyrollSeriesId(u), 1)') === 'm')
pruefe('böse: Parameter seriesId', namen('function f(seriesId: string) { const m = new Map()\n m.set(seriesId, 1) }') === 'm')
pruefe('böse: Großschreibung (SeriesId)', namen('const m = new Map()\nm.set(x.crSeriesId, 1)') === 'm')
pruefe('böse: Empfänger mit Punkt (this.jeSerie)', namen('class A { f() { this.jeSerie.set(s.seriesId, s) } }') === 'this.jeSerie')
pruefe('gut: Gruppierung über gruppiereJeKennung', namen('const g = gruppiereJeKennung(l, (s) => s.seriesId)') === '')
pruefe('gut: Map nach Titelkennung', namen('const m = new Map()\nm.set(t.id, t)') === '')
pruefe('gut: Konstruktor mit Titelpaaren', namen('const m = new Map(l.map((t) => [t.id, t]))') === '')
pruefe('gut: Alias auf etwas anderes', namen('const m = new Map()\nconst id = s.url\nm.set(id, s)') === '')
pruefe('gut: set mit nur einem Argument (Set)', namen('const z = new Set()\nz.set(s.seriesId)') === '')
pruefe('doppeltes Schreiben derselben Map: eine Meldung mit erster Zeile', JSON.stringify(findeKennungsMaps('const m = new Map()\nm.set(s.seriesId, 1)\nm.set(s.seriesId, 2)')) === '[{"name":"m","zeile":2}]')

const wurzel = mkdtempSync(join(tmpdir(), 'cr-kennung-maps-'))
try {
  mkdirSync(join(wurzel, 'pipeline', 'lib'), { recursive: true })
  mkdirSync(join(wurzel, 'shared'), { recursive: true })
  writeFileSync(join(wurzel, 'pipeline', 'lib', 'neu.ts'), 'export const m = new Map()\nm.set(s.seriesId, s)\n')
  writeFileSync(join(wurzel, 'pipeline', 'check-neu.ts'), 'export const p = new Map()\np.set(s.seriesId, s)\n')
  writeFileSync(join(wurzel, 'shared', 'neu2.ts'), 'export const q = new Map(l.map((s) => [s.seriesId, s]))\n')
  const lauf = pruefeKennungsMaps(wurzel)
  pruefe('Verzeichnislauf: gelesen werden pipeline/ ohne Prüfdatei und shared/', lauf.gelesen === 2, lauf.gelesen)
  pruefe('Verzeichnislauf: neue Map ohne Gruppierung unter pipeline/ wird gemeldet', lauf.fremde.some((f) => f.startsWith('pipeline/lib/neu.ts:2 ')), lauf.fremde)
  pruefe('Verzeichnislauf: neue Map unter shared/ wird gemeldet', lauf.fremde.some((f) => f.startsWith('shared/neu2.ts:1 ')), lauf.fremde)
  pruefe('Verzeichnislauf: Prüfdatei wird nicht gemeldet', !lauf.fremde.some((f) => f.includes('check-neu')), lauf.fremde)
  pruefe('Verzeichnislauf: Ausnahme ohne Fundstelle ist veraltet', lauf.veraltet.length > 0)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`FEHL check-cr-kennung-maps-faelle: ${verletzt} von ${anzahl} verletzt`)
  process.exit(1)
}
console.log(`check-cr-kennung-maps-faelle: ${anzahl} Prüfungen ok.`)
