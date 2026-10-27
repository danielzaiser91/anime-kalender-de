/**
 * Zusicherungen zum Burger-Menü im Kopf: Der Knopf trägt Name, `aria-haspopup`, 44 px und meldet Zustand und Ziel
 * (`mitZustand` in `Schwebe`); die Zeilen des Menüs führen nach Kalender-Abo, Newsletter und Einstellungen und schließen
 * das Menü (`data-schliesst`). Gerendert wird die echte Komponente auf dem Mini-DOM aus `tools/mini-dom.ts`.
 * Aufruf: `npm run check:logic`.
 */
import { act, createElement as h, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
/* Beim Laden lesen newsletterSync und pwa schon Speicher und Navigator. */
const g = globalThis as Record<string, unknown>
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
g.window = { navigator: { userAgent: '' }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} }
const { mitZustand } = await import('../web/src/components/kalender/Schwebe.tsx')
const { AboInhalt, AboMenue } = await import('../web/src/components/kalender/AboMenue.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const knopf = h('button', null, 'x')
const eigenschaften = (e: unknown) => (e as ReactElement<Record<string, unknown>>).props
const zu = eigenschaften(mitZustand(knopf, true, false, 'k1'))
const auf = eigenschaften(mitZustand(knopf, true, true, 'k1'))
const tooltip = eigenschaften(mitZustand(knopf, false, true, 'k1'))
pruefe('Klick-Auslöser zu: aria-expanded=false, kein aria-controls', zu['aria-expanded'] === false && zu['aria-controls'] === undefined, zu)
pruefe('Klick-Auslöser offen: aria-expanded=true und aria-controls=Kartenkennung', auf['aria-expanded'] === true && auf['aria-controls'] === 'k1', auf)
pruefe('Zeige-Schwebe (Tooltip) bekommt kein aria-expanded', tooltip['aria-expanded'] === undefined, tooltip)

const dom = installiereMiniDom({ ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
const wurzel = createRoot(dom.wurzel as unknown as Element)
const ziele: string[] = []
const einstellungen = () => void ziele.push('EINSTELLUNGEN')

await act(async () => wurzel.render(h(AboMenue, { onView: (v) => void ziele.push(v), favorites: new Set<number>(), einstellungen })))
const burger = dom.wurzel.finde((k: MiniKnoten) => k.tagName === 'BUTTON' && (k.getAttribute('aria-label') ?? '').startsWith('Menü'))[0]
pruefe('Burger-Knopf: genau einer, Name „Menü …“', burger !== undefined && burger.getAttribute('aria-label')?.includes('Einstellungen') === true, burger?.getAttribute('aria-label'))
pruefe('Burger-Knopf: aria-haspopup=dialog, aria-expanded=false', burger?.getAttribute('aria-haspopup') === 'dialog' && burger?.getAttribute('aria-expanded') === 'false')
pruefe('Burger-Knopf: 44 px (size-11)', (burger?.getAttribute('class') ?? '').split(' ').includes('size-11'), burger?.getAttribute('class'))
pruefe('Burger-Knopf trägt kein Glocken-Zeichen mehr (drei Striche)', (burger?.finde((k: MiniKnoten) => k.tagName === 'PATH').map((p) => p.getAttribute('d')) ?? []).join() === 'M4 7h16M4 12h16M4 17h16')

await act(async () => wurzel.render(h(AboInhalt, { onView: (v) => void ziele.push(v), favorites: new Set<number>(), einstellungen, verbindung: { verbunden: false, mail: '' } as never, installation: { canPrompt: false } as never })))
const zeilen = dom.wurzel.finde((k: MiniKnoten) => k.tagName === 'BUTTON' && k.getAttribute('data-schliesst') !== null)
for (const z of zeilen) await act(async () => klicke(dom.wurzel, z))
pruefe('Menü: drei schließende Zeilen führen nach abo, newsletter, Einstellungen', zeilen.length === 3 && JSON.stringify(ziele) === '["abo","newsletter","EINSTELLUNGEN"]', { zeilen: zeilen.length, ziele })
pruefe('Menü: Zeile „Einstellungen“ trägt den Text', zeilen[2]?.textContent === 'Einstellungen', zeilen[2]?.textContent)

await act(async () => wurzel.unmount())
dom.entferne()
console.log(`kopf-menue: ${verletzt === 0 ? 'alle Zusicherungen erfüllt' : `${verletzt} verletzt`}`)
process.exit(verletzt === 0 ? 0 : 1)
