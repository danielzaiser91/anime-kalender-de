/**
 * Lässt `useZurueckTaste` (Leinwand.tsx) zusammen mit dem echten `TrailerKino` (kino.tsx) laufen (react-dom/client auf dem Mini-DOM):
 * Leinwand + offenes Trailer-Kino — der erste Escape schließt nur das Kino, der zweite geht zurück. Ein roher `window`-Hörer in
 * `useZurueckTaste` ließe den ersten Escape beides tun (der Fehler des PR). Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { useZurueckTaste } = await import('../web/src/components/empfehlung/Leinwand.tsx')
const { TrailerKino } = await import('../web/src/components/detail/kino.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Hoerer = { f: (e: unknown) => void; capture: boolean }

/** `window` mit echten Hörern (das Mini-DOM lässt sie ins Leere laufen). */
function machFensterWach(fenster: Record<string, unknown>): Hoerer[] {
  const liste: Hoerer[] = []
  fenster.addEventListener = (_t: string, f: (e: unknown) => void, o?: boolean) => void liste.push({ f, capture: o === true })
  fenster.removeEventListener = (_t: string, f: (e: unknown) => void, o?: boolean) => {
    const i = liste.findIndex((x) => x.f === f && x.capture === (o === true))
    if (i >= 0) liste.splice(i, 1)
  }
  return liste
}

/** Eine Taste wie im Browser: Fangphase window, document, Blase document, window. */
function druecke(fenster: Hoerer[], dok: MiniKnoten, key: string): void {
  const e = { key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: { tagName: 'BODY' }, defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
  const win = (capture: boolean) => [...fenster].filter((x) => x.capture === capture).forEach((x) => x.f(e))
  const doc = (capture: boolean) => [...(dok.hoerer.get('keydown') ?? [])].filter((x) => x.capture === capture).forEach((x) => x.f(e))
  win(true)
  doc(true)
  doc(false)
  win(false)
}

function Seite({ zurueck }: { zurueck: () => void }) {
  useZurueckTaste(zurueck)
  return h(TrailerKino, { trailer: { video: 'abc', titel: 'T', sprache: 'de' }, titel: 'Probe' })
}

const uhr = attrappeUhr()
const matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
const dom = installiereMiniDom({ ...uhr, matchMedia }, () => ({}))
const fenster = machFensterWach((globalThis as unknown as { window: Record<string, unknown> }).window)
const dok = (globalThis as unknown as { document: MiniKnoten }).document
const wurzel = createRoot(dom.wurzel as unknown as Element)
let zurueck = 0
await act(async () => wurzel.render(h(Seite, { zurueck: () => void zurueck++ })))
const kino = () => dok.finde((k) => k.getAttribute('role') === 'dialog').length
const druck = (key: string) => act(async () => druecke(fenster, dok, key))

console.log('Leinwand + Trailer-Kino laufen wirklich')
await act(async () => klicke(dom.wurzel, dom.wurzel.finde((k) => k.tagName === 'BUTTON')[0]!))
pruefe('Kino ist offen', kino() === 1, kino())
await druck('Escape')
pruefe('erster Escape: Kino zu, Leinwand bleibt', kino() === 0 && zurueck === 0, { kino: kino(), zurueck })
await druck('Escape')
pruefe('zweiter Escape: zurück, genau einmal', zurueck === 1, zurueck)
await druck('Shift')
pruefe('andere Taste: nichts', zurueck === 1, zurueck)
await act(async () => wurzel.unmount())
await druck('Escape')
pruefe('nach dem Abbauen hört niemand mehr zu', zurueck === 1 && fenster.length === 0, { zurueck, hoerer: fenster.length })
dom.entferne()

console.log(`check-leinwand-escape: ${verletzt ? 'FEHLER' : 'ok'} (Leinwand + Kino, 5 Prüfungen)`)
process.exit(verletzt ? 1 : 0)
