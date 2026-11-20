/**
 * Zusicherung (20.11.2026, Daniel zu Pokémon Horizonte: „wir sollten es von pokemon trennen und als eigene serie führen“): Der Kopf des echten
 * `DetailPanel` nennt bei einem eigenen Werk der Reihe dessen eigenen Namen („Pokémon Horizonte“) ohne Unterzeile „Horizonte“; die Hauptserie
 * heißt weiter wie die Reihe. Dazu `kopfNameVon()` für jede Kennung der Handlisten eigener Werke. Läuft in `check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { FranchiseMember, Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, MiniKnoten } from '../tools/mini-dom.ts'
import { ladeAlleEigenenWerke, markiereEigeneWerke } from './bau/cartoon-reihen.ts'

const REIHE = 900_700
const glied = (id: number, name: string, jahr: number, eigenesWerk?: true): FranchiseMember => ({ id, name, format: 'TV', jpYear: jahr, ...(eigenesWerk && { eigenesWerk }) }) as FranchiseMember
const MITGLIEDER = [glied(900_701, 'Pokémon', 1997), glied(900_702, 'Pokémon Reisen', 2019), glied(900_703, 'Pokémon Horizonte', 2023, true)]

const speicher = new Map<string, string>()
const ort = { hash: '', pathname: '/', search: '', href: 'http://x/', origin: 'http://x' }
class Beobachter {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const lager = { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, w: string) => void speicher.set(k, w), removeItem: (k: string) => void speicher.delete(k) }
Object.assign(globalThis, { IntersectionObserver: Beobachter, history: { replaceState() {}, pushState() {}, state: null }, location: ort, localStorage: lager, sessionStorage: lager })
Object.assign(globalThis, {
  fetch: async (adresse: unknown) =>
    String(adresse).includes('franchises.json') ? { ok: true, status: 200, json: async () => ({ [REIHE]: MITGLIEDER }) } : { ok: false, status: 404, json: async () => ({}) },
})
Object.assign(MiniKnoten.prototype, { closest: () => null, querySelector: () => null })
Object.assign(globalThis, { cancelAnimationFrame() {} })
ignoriereCss()
const { DetailPanel } = await import('../web/src/components/DetailPanel.tsx')
const { kopfNameVon } = await import('../web/src/components/detail/reihen-namen.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (m: FranchiseMember): Title =>
  ({ id: m.id, slug: `t-${m.id}`, format: 'TV', jpYear: m.jpYear, titleDe: m.name, titleEn: m.name, genres: [], keywords: [], streams: [], franchiseId: REIHE }) as unknown as Title
const TITEL = MITGLIEDER.map(titel)

const dom = installiereMiniDom(
  { ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), location: ort, scrollTo() {}, innerWidth: 400, getComputedStyle: () => ({}) } as never,
  () => ({}),
)
Object.assign(document, { querySelector: () => null, querySelectorAll: () => [], title: 'Start' })
const wurzel = createRoot(dom.wurzel as unknown as Element)

/** Rendert das Panel für `id` und liefert den Text der Kopfzeile (h2) und der Unterzeile darunter. */
async function kopf(id: number): Promise<{ name: string; unter: string[] }> {
  const data = { titles: TITEL, titleById: new Map(TITEL.map((t) => [t.id, t])), releases: [], releaseBySlug: new Map(), events: [], eventsByDate: new Map(), releasesByTitle: new Map(), meta: {} }
  const e = { data, titleId: id, favorites: new Set<number>(), hidden: new Set(), onToggleFavorite() {}, onToggleHidden() {}, onClose() {}, onFilterBy() {}, onOpenTitle() {} }
  await act(async () => wurzel.render(h(DetailPanel as never, e as never)))
  await act(async () => void (await new Promise((fertig) => setTimeout(fertig, 5))))
  const h2 = dom.wurzel.finde((k) => k.tagName === 'H2')[0]
  const unter = dom.wurzel.finde((k) => k.tagName === 'P').map((k) => (k.textContent ?? '').trim())
  return { name: (h2?.textContent ?? '').trim(), unter }
}

const horizonte = await kopf(900_703)
pruefe('eigenes Werk: Kopf „Pokémon Horizonte“', horizonte.name === 'Pokémon Horizonte', horizonte.name)
pruefe('eigenes Werk: keine Unterzeile „Horizonte“', !horizonte.unter.some((z) => z.startsWith('Horizonte')), horizonte.unter)
const reisen = await kopf(900_702)
pruefe('Gegenfall Hauptserie: Kopf „Pokémon“, Unterzeile „Reisen“', reisen.name === 'Pokémon' && reisen.unter.some((z) => z.startsWith('Reisen')), reisen)

/* Klasse: jede Kennung der Handlisten eigener Werke heißt im Kopf wie sie selbst, auch wenn nur das Reihenglied die Marke trägt. */
const eintraege = ladeAlleEigenenWerke()
const ids = [...new Set(eintraege.flatMap((e) => e.ids))]
const reihen = markiereEigeneWerke({ 1: [glied(1, 'Reihe', 1990), ...ids.map((id) => glied(id, `Werk ${id}`, 2000))] }, eintraege)[1]!
const falsch = ids.filter((id) => kopfNameVon({ id, titleDe: `Werk ${id}` } as Title, reihen, 'Reihe') !== `Werk ${id}`)
pruefe(`alle ${ids.length} eigenen Werke der Handlisten heißen im Kopf wie sie selbst`, ids.length >= 20 && falsch.length === 0, falsch)
pruefe('Hauptteil heißt wie die Reihe', kopfNameVon({ id: 1, titleDe: 'Reihe 1' } as Title, reihen, 'Reihe') === 'Reihe')
pruefe('Marke am Titel allein genügt', kopfNameVon({ id: 5, titleDe: 'X', eigenesWerk: true } as Title, [], 'Reihe') === 'X')
pruefe('ohne Titel der Reihenname', kopfNameVon(undefined, reihen, 'Reihe') === 'Reihe')

await act(async () => wurzel.unmount())
dom.entferne()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('check-panel-eigenes-werk: ok (Kopf eigenes Werk, Hauptserie, Handlisten)')
