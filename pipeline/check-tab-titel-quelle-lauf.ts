/**
 * Verdrahtung (03.11.2026): Der echte Hook `useStartdaten` (react-dom auf dem Mini-DOM aus `tools/mini-dom.ts`, Abruf über eine
 * Attrappe von `fetch`) meldet dem Router die Namensquelle an. Danach setzt `navigate` beim Öffnen eines Titels den Tab auf dessen
 * Namen; ohne Anmeldung bliebe er beim Grundtitel. Die Regeln von `titelNachEintrag` selbst prüft `check-titel-vor-eintrag.ts`.
 * Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { EMPTY_FILTERS } from '../web/src/lib/filters.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom } from '../tools/mini-dom.ts'
import { GRUNDTITEL } from '../web/src/components/detail/titelwechsel.ts'
ignoriereCss()
const { useStartdaten } = await import('../web/src/lib/start-daten.ts')
const { schreiber } = await import('../web/src/lib/router.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-11-04'
const ID = 900001
const titel = { id: ID, titleRomaji: 'Probetitel Rayearth', titleDe: 'Probetitel Rayearth', format: 'TV', genres: [], streams: [] }
const dateien: Record<string, unknown> = {
  'woche-kacheln.json': { titles: [titel], releases: [], events: [], von: '2026-11-02', bis: '2026-11-08' },
  'meta.json': { genres: [], keywords: [] },
}
Object.assign(globalThis, {
  fetch: async (adresse: string) => {
    const name = String(adresse).split('/').pop()!.split('?')[0]!
    const inhalt = dateien[name]
    return { ok: inhalt !== undefined, status: inhalt === undefined ? 404 : 200, json: async () => inhalt }
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
})

const route = { view: 'woche', date: HEUTE, title: undefined, filters: { ...EMPTY_FILTERS } } as never
const umg = { ort: { pathname: '/', search: '', hash: '#/woche' }, verlauf: { state: null, replaceState() {}, pushState() {}, back() {} }, base: '' }

const uhr = attrappeUhr()
const dom = installiereMiniDom({ ...uhr, setInterval: () => 0, clearInterval() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } as never, () => ({}))
const doc = (globalThis as unknown as { document: { title: string } }).document
doc.title = GRUNDTITEL
let geladen = false
function Probe() {
  geladen = useStartdaten(route, HEUTE).data !== undefined
  return null
}
const wurzel = createRoot(dom.wurzel as unknown as Element)
await act(async () => {
  wurzel.render(h(Probe))
})
await act(async () => {
  await new Promise((r) => setTimeout(r, 20))
})

console.log('\nuseStartdaten meldet die Namensquelle an:')
pruefe('der Hook hat die Wochen-Daten geladen (Kulisse trägt)', geladen)
schreiber(route, () => undefined, () => umg).navigate({ title: ID })
pruefe('navigate setzt den Tab auf den Namen des Titels', doc.title.includes('Probetitel Rayearth'), doc.title)

await act(async () => {
  wurzel.unmount()
})
doc.title = GRUNDTITEL
schreiber(route, () => undefined, () => umg).navigate({ title: ID })
pruefe('nach dem Abbau des Hooks bleibt der Tab beim Grundtitel (Quelle abgemeldet)', doc.title === GRUNDTITEL, doc.title)

dom.entferne()
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nTab-Titel-Quelle: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
