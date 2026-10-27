/**
 * Lässt die echte Komponente `Fortsetzen.tsx` laufen (Mini-DOM): der Startbildschirm mit Vorgeschichte zeigt die Vorschau, „Fortfahren“
 * und „Vorschläge verwerfen und von vorn“; jeder Knopf ruft nur seine Funktion. Das Verhältnis 70 zu 30 misst `check:ansichten`.
 * Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Kandidat } from '../shared/empfehlung-pool.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { Fortsetzen } = await import('../web/src/components/empfehlung/Fortsetzen.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const klassen = (k: MiniKnoten): string => k.getAttribute('class') ?? ''
const titel = (id: number, n: string): Kandidat => ({ id, n, f: 'TV', y: 2020, e: 12, g: [], k: [], fsk: 12, v: 70, p: [['netflix']], duell: true })
const vorschau = ['Eins', 'Zwei', 'Drei', 'Vier', 'Fuenf'].map((n, i) => titel(900901 + i, `Titel ${n}`))

async function aufbau(offenesDuell: boolean) {
  const dom = installiereMiniDom({ ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
  const aufrufe: string[] = []
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => wurzel.render(h(Fortsetzen, { vorschau, mosaik: vorschau.map((k) => k.id), offenesDuell, fortfahren: () => void aufrufe.push('fortfahren'), neu: () => void aufrufe.push('neu') })))
  const knopf = (text: string): MiniKnoten => dom.wurzel.finde((k) => k.tagName === 'BUTTON' && k.textContent === text)[0]!
  return { dom, aufrufe, knopf, klick: (k: MiniKnoten) => act(async () => klicke(dom.wurzel, k)), abbau: async () => { await act(async () => wurzel.unmount()); dom.entferne() } }
}

console.log('Fortsetzen.tsx: Startbildschirm mit Vorgeschichte')
{
  const t = await aufbau(false)
  const text = t.dom.wurzel.textContent ?? ''
  pruefe('Alle fünf Titel der Vorschau stehen da', vorschau.every((k) => text.includes(k.n)), text)
  pruefe('Überschrift der Vorschläge, nicht des offenen Duells', text.includes('Deine Vorschläge warten') && !text.includes('noch offen'), text)
  const teile = t.dom.wurzel.finde((k) => k.getAttribute('data-teil') !== null)
  pruefe('Zwei Teile: Fortfahren (7) und Neu (3)', JSON.stringify(teile.map((k) => k.getAttribute('data-teil'))) === '["fortfahren","neu"]' && (teile[0].getAttribute('class') ?? '').includes('*0.7)') && (teile[1].getAttribute('class') ?? '').includes('*0.3)'))
  pruefe('„Fortfahren“ liegt im großen Teil, „verwerfen“ im kleinen', teile[0].finde((k) => k.tagName === 'BUTTON' && k.textContent === 'Fortfahren').length === 1 && teile[1].finde((k) => k.tagName === 'BUTTON' && k.textContent === 'Vorschläge verwerfen und von vorn').length === 1, teile.map((k) => k.textContent))
  pruefe('Teile sind durchsichtig: keine graue Fläche, kein Rahmen', teile.every((k) => !/(^|\s)(bg-|border)/.test(klassen(k))), teile.map(klassen))
  pruefe('Dahinter der Hintergrund der Startseite (Schleier)', t.dom.wurzel.finde((k) => klassen(k).includes('empf-schleier')).length === 1)
  await t.klick(t.knopf('Fortfahren'))
  pruefe('Fortfahren ruft nur fortfahren', JSON.stringify(t.aufrufe) === '["fortfahren"]', t.aufrufe)
  await t.klick(t.knopf('Vorschläge verwerfen und von vorn'))
  pruefe('Verwerfen ruft nur neu', JSON.stringify(t.aufrufe) === '["fortfahren","neu"]', t.aufrufe)
  pruefe('Der Hinweis nennt, dass Gesehene und Verworfene bleiben', text.includes('Gesehene und Verworfene bleiben gespeichert'))
  await t.abbau()
}
{
  const t = await aufbau(true)
  pruefe('Offenes Duell: Überschrift nennt es', (t.dom.wurzel.textContent ?? '').includes('Das Duell ist noch offen'))
  await t.abbau()
}

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nEmpfehlung (Fortsetzen): Vorschau, Fortfahren und Verwerfen mit 70 zu 30 getrennt in Ordnung')
