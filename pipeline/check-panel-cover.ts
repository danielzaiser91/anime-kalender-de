/**
 * Zusicherung (04.11.2026): Das Detail-Panel zeigt als Cover nur das eigene Bild des Titels, wie Kachel, Titelseite und Vorschaubild. Hat der Titel keines,
 * leiht es sich nicht das Cover eines anderen Reihenteils (das Plakat einer anderen Staffel belegt nichts). Gerendert wird das echte `DetailPanel`
 * mit einer Reihe aus zwei Teilen. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, MiniKnoten } from '../tools/mini-dom.ts'

const speicher = new Map<string, string>()
const ort = { hash: '', pathname: '/', search: '', href: 'http://x/', origin: 'http://x' }
class Beobachter {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const lager = { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, w: string) => void speicher.set(k, w), removeItem: (k: string) => void speicher.delete(k) }
Object.assign(globalThis, { IntersectionObserver: Beobachter, history: { replaceState() {}, pushState() {}, state: null }, location: ort, localStorage: lager, sessionStorage: lager })
Object.assign(globalThis, { fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }) })
/* Reihen-Karten fragen den Beobachter mit Vorfahr und Rahmenfenster ab; die Attrappe kennt beides nicht. */
Object.assign(MiniKnoten.prototype, { closest: () => null, querySelector: () => null })
Object.assign(globalThis, { cancelAnimationFrame() {} })
ignoriereCss()
const { DetailPanel } = await import('../web/src/components/DetailPanel.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const COVER_A = 'https://cover.anime-kalender.de/anisearch/111.webp'
const COVER_B = 'https://cover.anime-kalender.de/anisearch/222.webp'
const teil = (id: number, coverImage?: string): Title =>
  ({ id, slug: `teil-${id}`, format: 'TV', jpYear: 2020, titleEn: `Teil ${id}`, genres: [], keywords: [], streams: [], franchiseId: 900_001, coverImage }) as unknown as Title

const uhr = attrappeUhr()
const dom = installiereMiniDom(
  { ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), location: ort, scrollTo() {}, innerWidth: 400, getComputedStyle: () => ({}) } as never,
  () => ({}),
)
Object.assign(document, { querySelector: () => null, querySelectorAll: () => [], title: 'Start' })
const wurzel = createRoot(dom.wurzel as unknown as Element)

async function rendere(offen: Title, titel: Title[]): Promise<MiniKnoten> {
  const data = { titles: titel, titleById: new Map(titel.map((t) => [t.id, t])), releases: [], releaseBySlug: new Map(), events: [], eventsByDate: new Map(), releasesByTitle: new Map(), meta: {} }
  const e = { data, titleId: offen.id, favorites: new Set<number>(), hidden: new Set(), onToggleFavorite() {}, onToggleHidden() {}, onClose() {}, onFilterBy() {}, onOpenTitle() {} }
  await act(async () => wurzel.render(h(DetailPanel as never, e as never)))
  await act(async () => void (await new Promise((fertig) => setTimeout(fertig, 5))))
  return dom.wurzel
}
const poster = (w: MiniKnoten): string[] => w.finde((k) => k.tagName === 'IMG' && k.getAttribute('data-poster') !== null).map((k) => k.getAttribute('src') ?? '')

const ohne = teil(900_002)
const mitCover = teil(900_001, COVER_A)
console.log('\nTitel ohne Cover, anderer Reihenteil mit Cover')
{
  const w = await rendere(ohne, [mitCover, ohne])
  pruefe('kein Poster im Kopf (kein geliehenes Cover)', poster(w).length === 0, poster(w))
  pruefe('das Cover des anderen Teils steht nirgends als Bild', !w.finde((k) => k.tagName === 'IMG' && (k.getAttribute('src') ?? '').includes('111.webp')).some((k) => k.getAttribute('data-poster') !== null))
}
console.log('\nTitel mit eigenem Cover')
{
  const eigen = teil(900_002, COVER_B)
  const w = await rendere(eigen, [mitCover, eigen])
  pruefe('das Poster zeigt das eigene Cover, nicht das des Nachbarteils', poster(w).length === 1 && poster(w)[0].includes('222.webp'), poster(w))
}

await act(async () => wurzel.unmount())
dom.entferne()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('check-panel-cover: ok (kein geliehenes Cover, eigenes Cover bleibt)')
