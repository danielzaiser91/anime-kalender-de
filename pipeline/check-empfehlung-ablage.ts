/**
 * Lässt die echte Komponente `Ablage.tsx` laufen (Mini-DOM): „Gesehene“ und „Verworfene“ sind getrennte Listen, jede klappt für sich
 * auf und zu, „Zurückholen“ ruft nur die Funktion der eigenen Liste. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Kandidat } from '../shared/empfehlung-pool.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { Ablage } = await import('../web/src/components/empfehlung/Ablage.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, n: string): Kandidat => ({ id, n, f: 'TV', y: 2020, e: 12, g: [], k: [], fsk: 12, v: 70, p: [['netflix']], duell: true })
const gesehen = [titel(900801, 'Gesehen Eins'), titel(900802, 'Gesehen Zwei')]
const verworfen = [titel(900803, 'Verworfen Eins')]

const dom = installiereMiniDom({ ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
const geholt: string[] = []
const wurzel = createRoot(dom.wurzel as unknown as Element)
await act(async () => {
  wurzel.render(h(Ablage, { gesehen, verworfen, gesehenHolen: (id: number) => void geholt.push(`g${id}`), verworfenHolen: (id: number) => void geholt.push(`v${id}`) }, h('button', { type: 'button' }, 'Von vorn')))
})
const knopf = (text: string): MiniKnoten => dom.wurzel.finde((k) => k.tagName === 'BUTTON' && k.textContent === text)[0]!
const text = (): string => dom.wurzel.textContent ?? ''
const klick = (k: MiniKnoten) => act(async () => klicke(dom.wurzel, k))

pruefe('Zu: Knöpfe mit Zahl, keine Titel', !!knopf('Gesehene (2)') && !!knopf('Verworfene (1)') && !/Eins|Zwei/.test(text()), text())
const zeile = knopf('Von vorn').parentNode as MiniKnoten
const rechts = zeile.finde((k) => (k.getAttribute('class') ?? '').includes('ml-auto'))[0]
pruefe('„Von vorn“ links, „Gesehene“ und „Verworfene“ rechts, alle in einer Zeile', !!rechts && rechts.parentNode === zeile && (zeile.textContent ?? '').startsWith('Von vorn') && (rechts.textContent ?? '') === 'Gesehene (2)Verworfene (1)', zeile.textContent)
await klick(knopf('Gesehene (2)'))
pruefe('Gesehene auf: beide Gesehenen, kein Verworfener', text().includes('Gesehen Eins') && text().includes('Gesehen Zwei') && !text().includes('Verworfen Eins'), text())
await klick(knopf('Verworfene (1)'))
pruefe('Verworfene zusätzlich auf: beide Listen offen', text().includes('Gesehen Zwei') && text().includes('Verworfen Eins'), text())
await klick(knopf('Gesehene (2)'))
pruefe('Gesehene zu: nur Verworfene bleibt', !text().includes('Gesehen Eins') && text().includes('Verworfen Eins'), text())
await klick(knopf('Gesehene (2)'))
const zurueck = dom.wurzel.finde((k) => k.tagName === 'BUTTON' && k.textContent === 'Zurückholen')
pruefe('Drei Zurückholen-Knöpfe (zwei + einer)', zurueck.length === 3, zurueck.length)
await klick(zurueck[1])
await klick(zurueck[2])
pruefe('Jeder Knopf ruft nur die Funktion seiner Liste, mit der eigenen Kennung', JSON.stringify(geholt) === JSON.stringify(['g900802', 'v900803']), geholt)

geholt.length = 0
const alleKnoepfe = dom.wurzel.finde((k) => k.tagName === 'BUTTON' && k.textContent === 'Alle zurückholen')
pruefe('„Alle zurückholen“ nur bei der Liste mit zwei Titeln (Verworfene hat einen)', alleKnoepfe.length === 1, alleKnoepfe.length)
await klick(alleKnoepfe[0])
pruefe('„Alle zurückholen“ holt genau die Gesehenen, nicht die Verworfenen', JSON.stringify(geholt) === JSON.stringify(['g900801', 'g900802']), geholt)

await act(async () => wurzel.unmount())
dom.entferne()
if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nEmpfehlung (Ablage): Gesehene und Verworfene getrennt, einzeln auf- und zuklappbar, Zurückholen je Liste in Ordnung')
