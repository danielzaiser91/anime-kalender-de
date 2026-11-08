/**
 * `useAnsichtOben` (web/src/lib/ansicht-scroll.ts) auf dem Mini-DOM: Beim Wechsel der Ansicht genau ein Sprung nach oben,
 * nicht beim ersten Zeichnen und nicht bei gleichbleibender Ansicht. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { attrappeUhr, installiereMiniDom } from '../tools/mini-dom.ts'
import { useAnsichtOben } from '../web/src/lib/ansicht-scroll.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function Probe({ ansicht, zaehler }: { ansicht: string; zaehler: number }) {
  useAnsichtOben(ansicht)
  return h('div', null, String(zaehler))
}

const spruenge: unknown[] = []
const uhr = attrappeUhr()
const fenster = { ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), scrollTo: (o: unknown) => void spruenge.push(o) }
const dom = installiereMiniDom(fenster, () => ({}))
const wurzel = createRoot(dom.wurzel as unknown as Element)
const zeige = (ansicht: string, zaehler: number) => act(async () => wurzel.render(h(Probe, { ansicht, zaehler })))

await zeige('woche', 0)
pruefe('erstes Zeichnen springt nicht', spruenge.length === 0, spruenge)
await zeige('woche', 1)
pruefe('gleiche Ansicht, neu gezeichnet: kein Sprung', spruenge.length === 0, spruenge)
await zeige('monat', 2)
pruefe('Woche -> Monat: ein Sprung nach oben ohne Animation', spruenge.length === 1 && JSON.stringify(spruenge[0]) === '{"top":0,"behavior":"auto"}', spruenge)
await zeige('monat', 3)
pruefe('Monat bleibt Monat: kein weiterer Sprung', spruenge.length === 1, spruenge)
await zeige('woche', 4)
pruefe('Monat -> Woche: zweiter Sprung', spruenge.length === 2, spruenge)

await act(async () => wurzel.unmount())
dom.entferne()
if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nAnsichtswechsel (Scroll): erstes Zeichnen kein Sprung, Wechsel Woche/Monat je ein Sprung nach oben, sonst keiner')
