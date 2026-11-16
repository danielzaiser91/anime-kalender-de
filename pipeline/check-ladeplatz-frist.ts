/**
 * `Ladeplatz.tsx` läuft wirklich (react-dom/client auf dem Mini-DOM, Attrappe-Uhr): Der Platzhalter steht, solange geladen wird,
 * und verschwindet spätestens nach der Frist (8 s), damit der Fuß nicht dauerhaft unsichtbar bleibt; Abbauen räumt den Zeitgeber ab.
 * Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { attrappeUhr, ignoriereCss, installiereMiniDom, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { Ladeplatz } = await import('../web/src/components/Ladeplatz.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const platz = (w: MiniKnoten) => w.finde((k) => k.getAttribute('data-ladeplatz') !== null).length

const uhr = attrappeUhr()
const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
const wurzel = createRoot(dom.wurzel as unknown as Element)
await act(async () => wurzel.render(h(Ladeplatz)))
const schiebe = (ms: number) => uhr.schiebe(ms, (f) => act(async () => f()))

pruefe('Start: Platzhalter steht', platz(dom.wurzel) === 1, platz(dom.wurzel))
await schiebe(7999)
pruefe('7999 ms: Platzhalter steht noch', platz(dom.wurzel) === 1, platz(dom.wurzel))
await schiebe(1)
pruefe('8000 ms: Platzhalter weg, der Fuß ist wieder sichtbar', platz(dom.wurzel) === 0, platz(dom.wurzel))
await act(async () => wurzel.unmount())
pruefe('Abbauen: kein Zeitgeber übrig', uhr.offen() === 0, uhr.offen())
dom.entferne()

const wurzel2Uhr = attrappeUhr()
const dom2 = installiereMiniDom({ ...wurzel2Uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
const w2 = createRoot(dom2.wurzel as unknown as Element)
await act(async () => w2.render(h(Ladeplatz)))
await act(async () => w2.unmount())
pruefe('Abbau vor Ablauf: Zeitgeber abgeräumt', wurzel2Uhr.offen() === 0, wurzel2Uhr.offen())
dom2.entferne()

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nLadeplatz-Frist: Platzhalter steht bis 8 s, danach weg, Zeitgeber geräumt')
