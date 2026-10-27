/**
 * Lässt die echten Komponenten `Leinwand.tsx` und `Kopfzeile.tsx` laufen (Mini-DOM): Detailansicht mit ganzer Handlung als letztem Block,
 * Kopf ohne Zeiger, in der Kopfzeile nur der Knopf „Zurück zu den Vorschlägen“ statt eines Links. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Kandidat } from '../shared/empfehlung-pool.ts'
import type { Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { Handlung, Leinwand } =await import('../web/src/components/empfehlung/Leinwand.tsx')
const { Kopfzeile } = await import('../web/src/components/empfehlung/Kopfzeile.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ID = 900901
const kandidat: Kandidat = { id: ID, n: 'Testserie', f: 'TV', y: 2020, e: 12, g: [], k: [], fsk: 12, v: 70, p: [['netflix']], duell: true }
const handlung = `${'Ein langer Satz über die Handlung. '.repeat(40)}Schlusssatz.`

const fenster = { ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }
const klassen = (k: MiniKnoten) => k.getAttribute('class') ?? ''

console.log('Leinwand: Detailansicht')
{
  const dom = installiereMiniDom(fenster, () => ({}))
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  const titel = { id: ID, coverImage: 'https://image.tmdb.org/t/p/w500/x.jpg' } as unknown as Title
  await act(async () => {
    wurzel.render(h(Leinwand, { k: kandidat, titel, genres: ['Action'], eigene: new Set<string>(), istFavorit: false, aktionen: { favorit() {}, nein() {}, gesehen() {}, zurueck() {} } }))
  })
  const ueberschriften = dom.wurzel.finde((k) => k.tagName === 'H3').map((k) => k.textContent)
  pruefe('Handlung ist der letzte Block', ueberschriften.at(-1) === 'Worum es geht' && ueberschriften.length === 4, ueberschriften)
  const kopf = dom.wurzel.finde((k) => klassen(k).includes('empf-leinwand'))[0]!
  pruefe('Kopf zeigt keinen Zeiger (nichts darin ist klickbar)', ![kopf, ...kopf.finde(() => true)].some((k) => /cursor-pointer/.test(klassen(k)) || k.tagName === 'A' || k.tagName === 'BUTTON'), klassen(kopf))
  const cover = kopf.finde((k) => k.tagName === 'IMG' && klassen(k).includes('aspect-[2/3]'))[0]
  pruefe('Cover doppelt so groß: 176 px am Handy, 280 px am Rechner', !!cover && klassen(cover).includes('w-[176px]') && klassen(cover).includes('min-[900px]:w-[280px]'), cover && klassen(cover))
  await act(async () => klicke(dom.wurzel, kopf))
  await act(async () => wurzel.unmount())
  dom.entferne()
}

console.log('Handlung: ganzer Text')
{
  const dom = installiereMiniDom(fenster, () => ({}))
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => wurzel.render(h(Handlung, { text: handlung, kopf: '' })))
  const text = dom.wurzel.textContent ?? ''
  pruefe('Handlung steht in voller Länge da, ohne Kürzung', text.includes(handlung) && !text.includes('…'), text.length)
  await act(async () => wurzel.unmount())
  dom.entferne()
}

console.log('Kopfzeile: nur der Zurück-Knopf')
{
  const aufbau = async (phase: 'start' | 'duell' | 'ergebnis' | 'leinwand') => {
    const dom = installiereMiniDom(fenster, () => ({}))
    const wurzel = createRoot(dom.wurzel as unknown as Element)
    let zurueck = 0
    await act(async () => wurzel.render(h(Kopfzeile, { phase, anbieter: 0, blattOffen: false, vorschlaege: () => void zurueck++, blatt() {} })))
    return { dom, zurueck: () => zurueck, abbau: async () => { await act(async () => wurzel.unmount()); dom.entferne() } }
  }
  const knoepfe = (w: MiniKnoten) => w.finde((k) => k.tagName === 'BUTTON').map((k) => k.textContent)
  const l = await aufbau('leinwand')
  pruefe('Leinwand: kein Link, der Kopf bleibt Text', l.dom.wurzel.finde((k) => k.tagName === 'A').length === 0 && (l.dom.wurzel.textContent ?? '').includes('Entdecken'))
  const zu = l.dom.wurzel.finde((k) => k.tagName === 'BUTTON' && k.textContent === 'Zurück zu den Vorschlägen')[0]
  pruefe('Leinwand: Knopf „Zurück zu den Vorschlägen“ da', !!zu, knoepfe(l.dom.wurzel))
  if (zu) await act(async () => klicke(l.dom.wurzel, zu))
  pruefe('Der Knopf ruft genau einmal zurück', l.zurueck() === 1, l.zurueck())
  await l.abbau()
  for (const phase of ['start', 'duell', 'ergebnis'] as const) {
    const a = await aufbau(phase)
    const link = a.dom.wurzel.finde((k) => k.tagName === 'A')[0]
    pruefe(`${phase}: links der Link „Entdecken“ zum Kalender, kein Zurück-Knopf, kein „Von vorn“`, link?.textContent === 'Entdecken' && link.getAttribute('href') === '#/woche' && !knoepfe(a.dom.wurzel).some((t) => /Zurück zu den|Von vorn/.test(t ?? '')), knoepfe(a.dom.wurzel))
    await a.abbau()
  }
}

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nEmpfehlung (Detail): Handlung ganz und zuletzt, Kopf ohne Zeiger, nur der Zurück-Knopf in Ordnung')
