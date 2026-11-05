/**
 * Zusicherung (03.11.2026): Ein Titel ohne Eintrag in den Daten (nicht in `titles-core`) kommt erst durch `ladeTitelBestand` in
 * dieselbe `titleById`-Map. Der echte Hook `usePanelTitel` (react-dom auf dem Mini-DOM) liefert ihn danach, obwohl `data` dieselbe
 * Instanz bleibt; vorher blieb das Panel leer und PR-Aussehen rot. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { installiereMiniDom, attrappeUhr, ignoriereCss } from '../tools/mini-dom.ts'
ignoriereCss()
const { usePanelTitel } = await import('../web/src/components/detail/titelwechsel.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ID = 900002
const titelById = new Map<number, unknown>()
const data = { titleById: titelById, releasesByTitle: new Map() } as never
let gesehen: { title?: { id: number }; mitTermin: boolean } = { mitTermin: false }
function Probe() {
  gesehen = usePanelTitel(data, ID) as never
  return null
}

const uhr = attrappeUhr()
const dom = installiereMiniDom({ ...uhr, setInterval: () => 0, clearInterval() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } as never, () => ({}))
const wurzel = createRoot(dom.wurzel as unknown as Element)
await act(async () => {
  wurzel.render(h(Probe))
})
console.log('\nusePanelTitel:')
pruefe('Titel ohne Eintrag in den Daten: kein Titel', gesehen.title === undefined)
titelById.set(ID, { id: ID, titleRomaji: 'Probetitel Nachgeladen', format: 'TV', genres: [], streams: [] })
await act(async () => {
  wurzel.render(h(Probe))
})
pruefe('nach dem Nachladen in dieselbe Map (gleiches data) liefert der Hook den Titel', gesehen.title?.id === ID, gesehen)
await act(async () => {
  wurzel.unmount()
})
dom.entferne()
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nPanel-Titel nachgeladen: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
