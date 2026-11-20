/**
 * Zusicherung (Daniel, 20.11.2026): Im Detail-Panel steht die Handlung über den Neuigkeiten, die Neuigkeiten über der Reihe.
 * Gerendert wird das echte `DetailPanel` (Mini-DOM, Handlung aus einer Synopsis-Attrappe, Reihe aus zwei Titeln einer Franchise);
 * die Reihenfolge wird an den Überschriften der Karten gelesen. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, type MiniKnoten } from '../tools/mini-dom.ts'

const speicher = new Map<string, string>()
const ort = { hash: '', pathname: '/', search: '', href: 'http://x/', origin: 'http://x' }
class Beobachter {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const lager = { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, w: string) => void speicher.set(k, w), removeItem: (k: string) => void speicher.delete(k) }
const HANDLUNGSTEXT = 'Ein Junge zieht aus, um der Beste zu werden.'
const ID = 900103
const NEWS = [{ am: '2026-11-01', titelId: ID, titel: 'Probe Eins', slug: `probe-${ID}`, meldungen: [{ art: 'neu', platform: 'netflix', anbieter: 'Netflix' }] }]
/** Handlung-Datei und News antworten; alles andere läuft ins Leere wie im Termin-Test. */
const antwort = (url: string) => {
  const rumpf = String(url).includes('synopses/') ? { [ID]: { de: HANDLUNGSTEXT } } : String(url).includes('news.json') ? NEWS : null
  return rumpf
    ? { ok: true, status: 200, json: async () => rumpf, text: async () => JSON.stringify(rumpf) }
    : { ok: false, status: 404, json: async () => ({}), text: async () => '' }
}
Object.assign(globalThis, { IntersectionObserver: Beobachter, history: { replaceState() {}, pushState() {}, state: null }, location: ort, localStorage: lager, sessionStorage: lager })
Object.assign(globalThis, { fetch: async (u: string) => antwort(u), cancelAnimationFrame() {}, requestAnimationFrame: () => 0 })
ignoriereCss()
const { DetailPanel } = await import('../web/src/components/DetailPanel.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const teil = (id: number, name: string): Title =>
  ({ id, slug: `probe-${id}`, format: 'TV', jpYear: 2020, titleDe: name, genres: [], keywords: [], franchiseId: ID, streams: [], watchLinks: [] }) as unknown as Title

const uhr = attrappeUhr()
const dom = installiereMiniDom(
  { ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), location: ort, scrollTo() {}, innerWidth: 400, getComputedStyle: () => ({}) } as never,
  () => ({}),
)
Object.assign(document, { querySelector: () => null, querySelectorAll: () => [], title: 'Start' })
/* Die Reihen-Spur fragt ihren Knoten nach `querySelector` und `closest`; das Mini-DOM kennt beides nicht (Layout ist hier ohne Belang). */
Object.assign(Object.getPrototypeOf(dom.wurzel), { querySelector: () => null, closest: () => null })
const wurzel = createRoot(dom.wurzel as unknown as Element)

async function rendere(titel: Title[]): Promise<MiniKnoten> {
  const data = { titles: titel, titleById: new Map(titel.map((t) => [t.id, t])), releases: [], releaseBySlug: new Map(), events: [], eventsByDate: new Map(), releasesByTitle: new Map(), meta: {} }
  const e = { data, titleId: titel[0].id, favorites: new Set<number>(), hidden: new Set(), onToggleFavorite() {}, onToggleHidden() {}, onClose() {}, onFilterBy() {}, onOpenTitle() {} }
  await act(async () => wurzel.render(h(DetailPanel as never, e as never)))
  await act(async () => void (await new Promise((fertig) => setTimeout(fertig, 5))))
  return dom.wurzel
}

/** Stelle der Karte im Text (nach Überschrift bzw. Inhalt), -1 wenn es sie nicht gibt. */
const stelle = (text: string, wort: string): number => text.indexOf(wort)

console.log('\nTitel mit Handlung und Reihe')
{
  const w = await rendere([teil(ID, 'Probe Eins'), teil(ID + 1, 'Probe Zwei')])
  const text = w.textContent
  const handlung = stelle(text, HANDLUNGSTEXT)
  const reihe = w.finde((k) => k.tagName === 'SECTION' && (k.getAttribute('aria-label') ?? '').includes('Reihe'))[0]
  const reiheStelle = reihe ? stelle(text, reihe.textContent.slice(0, 20)) : -1
  pruefe('die Handlung steht im Panel', handlung >= 0, text)
  pruefe('die Karte „Reihe“ steht im Panel', reiheStelle >= 0, text)
  const neu = stelle(text, 'Neuigkeiten')
  pruefe('die Karte „Neuigkeiten“ steht im Panel', neu >= 0, text)
  pruefe('Handlung steht vor den Neuigkeiten', handlung >= 0 && neu > handlung, { handlung, neu })
  pruefe('Neuigkeiten stehen vor der Reihe', neu >= 0 && reiheStelle > neu, { neu, reiheStelle })
}

console.log('\nTitel ohne Reihe (nur ein Teil)')
{
  const w = await rendere([teil(ID, 'Probe Eins')])
  const text = w.textContent
  pruefe('Handlung steht, keine Karte „Reihe“ als Rest', stelle(text, HANDLUNGSTEXT) >= 0 && w.finde((k) => k.tagName === 'SECTION' && (k.getAttribute('aria-label') ?? '').includes('Reihe')).length === 0, text)
}

console.log('\nTitel ohne Handlung')
{
  Object.assign(globalThis, { fetch: async () => antwort('x') })
  const w = await rendere([{ ...teil(ID + 5, 'Ohne Text'), franchiseId: ID + 5 } as Title, { ...teil(ID + 6, 'Ohne Text 2'), franchiseId: ID + 5 } as Title])
  const text = w.textContent
  pruefe('kein Handlungstext, kein Platzhalter-Rest „Handlung“ vor der Reihe', stelle(text, HANDLUNGSTEXT) < 0 && !w.finde((k) => k.tagName === 'SECTION' && (k.getAttribute('aria-label') ?? '') === 'Handlung').length, text)
  pruefe('die Reihe steht trotzdem da', w.finde((k) => k.tagName === 'SECTION' && (k.getAttribute('aria-label') ?? '').includes('Reihe')).length > 0, text)
}

await act(async () => wurzel.unmount())
dom.entferne()
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nPanel-Reihenfolge: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
