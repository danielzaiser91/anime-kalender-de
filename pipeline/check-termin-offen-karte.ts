/**
 * Zusicherung (30.10.2026, F77): Ist die Synchro angekündigt und der deutsche Termin offen, trägt eine eigene Karte „Termin offen“
 * den Anbieter, „Stand <Datum> · Quelle“ und den Knopf „Bescheid bei Termin“. Der Anbieter steht nur dort (nicht mehr als Nebenzeile
 * des Kastens und nicht unter „Weitere Anbieter“); der Knopf schaltet dieselbe Merkung wie das ☆ im Kopf (`onToggleFavorite`).
 * Gerendert wird das echte `DetailPanel` (echter Übersetzer, echte Antwortrechnung) samt Klick bis zur Seite. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'

/* Browser-Umgebung des Panels: Speicher (Newsletter-Zustand), Beobachter, Adresse; alles Attrappen ohne Wirkung. */
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
ignoriereCss()
const { DetailPanel } = await import('../web/src/components/DetailPanel.tsx')
const { setSyncToken, clearSyncToken, setSyncMail } = await import('../web/src/lib/newsletterSync.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* The Vermilion Mask, wörtlich aus dem Datenstand vom 30.10.2026 (Anbieter-Adresse, Ankündigung, beide Quellen). */
const LINEUP = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-anime-lineup-herbst-2026'
const SYNCHROS = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-deutsche-synchros-herbst-2026'
const SERIE = 'https://www.crunchyroll.com/de/watch/GE00384363JAJP'
const vermilion = {
  id: 195571,
  slug: 'the-vermilion-mask-195571',
  format: 'TV',
  jpYear: 2026,
  titleEn: 'The Vermilion Mask',
  genres: [],
  keywords: [],
  streams: [{ platform: 'crunchyroll', url: SERIE, kind: 'stream', zugang: 'abo' }],
  ankuendigung: { platform: 'crunchyroll', omuAb: '2026-10-10', synchro: 'angekuendigt', quellen: [LINEUP, SYNCHROS], stand: '2026-09-15' },
} as unknown as Title

const uhr = attrappeUhr()
const dom = installiereMiniDom(
  { ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), location: ort, scrollTo() {}, innerWidth: 400, getComputedStyle: () => ({}) } as never,
  () => ({}),
)
Object.assign(document, { querySelector: () => null, querySelectorAll: () => [], title: 'Start' })
const gemerkt: number[] = []

const wurzel = createRoot(dom.wurzel as unknown as Element)
async function rendere(title: Title, favorites = new Set<number>(), verbunden = false): Promise<MiniKnoten> {
  if (verbunden) setSyncToken('t')
  else clearSyncToken()
  setSyncMail('a@b.de')
  const data = { titles: [title], titleById: new Map([[title.id, title]]), releases: [], releaseBySlug: new Map(), events: [], eventsByDate: new Map(), releasesByTitle: new Map(), meta: {} }
  const e = { data, titleId: title.id, favorites, hidden: new Set(), onToggleFavorite: (id: number) => void gemerkt.push(id), onToggleHidden() {}, onClose() {}, onFilterBy() {}, onOpenTitle() {} }
  await act(async () => wurzel.render(h(DetailPanel as never, e as never)))
  /* Die Abrufe des Panels (Disc-Ausgaben, Folgenverzeichnis) laufen ins Leere und setzen Zustand: erst nach ihnen lesen. */
  await act(async () => void (await new Promise((fertig) => setTimeout(fertig, 5))))
  return dom.wurzel
}
const zaehle = (text: string, wort: string): number => text.split(wort).length - 1
const knopf = (w: MiniKnoten): MiniKnoten | undefined => w.finde((k) => k.tagName === 'BUTTON' && k.textContent.includes('Bescheid bei Termin'))[0]
const karteIn = (w: MiniKnoten): MiniKnoten | undefined => w.finde((k) => k.tagName === 'SECTION' && k.getAttribute('aria-label') === 'Termin offen')[0]

console.log('\nVermilion Mask: Synchro angekündigt, Termin offen')
{
  const w = await rendere(vermilion)
  const text = w.textContent
  const karte = karteIn(w)
  pruefe('die Karte „Termin offen“ steht da', !!karte, text)
  pruefe('der Kasten trägt die Überschrift „Deutsche Synchro angekündigt“', text.includes('Deutsche Synchro angekündigt'))
  pruefe('Stand und Quelle in der Karte', !!karte && karte.textContent.includes('Stand 15.09.2026') && karte.textContent.includes('Quelle'), karte?.textContent)
  const quelle = karte?.finde((k) => k.tagName === 'A' && k.textContent.startsWith('Quelle'))[0]
  pruefe('die Quelle ist der Synchro-Artikel', quelle?.getAttribute('href') === SYNCHROS, quelle?.getAttribute('href'))
  pruefe('der Start mit Untertiteln steht in der Karte', !!karte && karte.textContent.includes('Mit Untertiteln seit 10.10.2026.'), karte?.textContent)
  pruefe('Crunchyroll steht genau einmal da (nicht mehr unter „Weitere Anbieter“, nicht in der Nebenzeile)', zaehle(text, 'Crunchyroll') === 1, text)
  pruefe('der Anbieter in der Karte ist der Link zur Serie', w.finde((k) => k.tagName === 'A' && k.getAttribute('href') === SERIE && k.textContent === 'Crunchyroll').length === 1)
  pruefe('keine Überschrift „Weitere Anbieter“ mehr', !text.includes('Weitere Anbieter'), text)
  pruefe('„Synchro-Termin offen“ steht nicht noch einmal als Nebenzeile', !text.includes('Synchro-Termin offen'), text)
  pruefe('der Knopf heißt „Bescheid bei Termin“', knopf(w)?.textContent.includes('Bescheid bei Termin') === true, knopf(w)?.textContent)
  pruefe('der Knopf ist noch nicht gedrückt', knopf(w)?.getAttribute('aria-pressed') === 'false')
  const kasten = w.finde((k) => k.tagName === 'SECTION' && k.getAttribute('aria-label') === null)[0]
  pruefe('der Kasten behält nur die Überschrift: keine Mindesthöhe', !!kasten && !(kasten.getAttribute('class') ?? '').includes('min-h-[11rem]'), kasten?.getAttribute('class'))
  pruefe('Tippziele ≥ 44 px: Knopf und Quelle haben min-h-11', (knopf(w)?.getAttribute('class') ?? '').includes('min-h-11') && (quelle?.getAttribute('class') ?? '').includes('min-h-11'))
  const taste = knopf(w)
  if (taste) klicke(dom.wurzel, taste)
  pruefe('der Klick kommt bei der Seite an und merkt den Titel (wie das ☆ im Kopf)', JSON.stringify(gemerkt) === '[195571]', gemerkt)
  const stern = w.finde((k) => k.tagName === 'BUTTON' && k.textContent === 'Merken')[0]
  if (stern) klicke(dom.wurzel, stern)
  pruefe('das ☆ im Kopf ruft denselben Handler mit derselben Kennung', JSON.stringify(gemerkt) === '[195571,195571]', gemerkt)
}

console.log('\nStart mit Untertiteln liegt noch in der Zukunft')
{
  const spaeter = { ...vermilion, ankuendigung: { ...vermilion.ankuendigung!, omuAb: '2999-01-01' } } as Title
  const w = await rendere(spaeter)
  pruefe('„Mit Untertiteln ab 01.01.2999.“', w.textContent.includes('Mit Untertiteln ab 01.01.2999.'), w.textContent)
}

console.log('\nNennt keine Quelle die Synchro, gilt die erste')
{
  const nurLineup = { ...vermilion, ankuendigung: { ...vermilion.ankuendigung!, quellen: [LINEUP] } } as Title
  const w = await rendere(nurLineup)
  const quelle = w.finde((k) => k.tagName === 'A' && k.textContent.startsWith('Quelle'))[0]
  pruefe('die Quelle ist die erste (Lineup-Artikel)', quelle?.getAttribute('href') === LINEUP, quelle?.getAttribute('href'))
}

console.log('\nVermilion Mask: schon gemerkt')
for (const [verbunden, hinweis] of [[true, 'Wir schreiben dir, sobald es einen Termin gibt.'], [false, 'Melde dich noch beim Newsletter an, dann sagen wir Bescheid.']] as const) {
  const w = await rendere(vermilion, new Set([195571]), verbunden)
  const karte = karteIn(w)
  const taste = karte?.finde((k) => k.tagName === 'BUTTON')[0]
  pruefe(`gemerkt${verbunden ? ' (Newsletter verbunden)' : ' (nicht verbunden)'}: Knopf gedrückt, Hinweis „${hinweis}“`, taste?.getAttribute('aria-pressed') === 'true' && taste.textContent.includes('Gemerkt') && karte?.textContent.includes(hinweis) === true, karte?.textContent)
}

console.log('\nOhne Karte bleibt der Kasten, wie er war')
{
  const angekuendigt = vermilion.ankuendigung!
  /* Mit deutscher Tonspur beim Anbieter ist die Antwort nicht mehr „ohne“: der Kasten rechnet Termin und Folgen, die Karte entfällt. */
  const mitSynchro = { ...vermilion, dub: true, streams: [{ ...vermilion.streams[0], dub: true }] } as unknown as Title
  const faelle: [string, Title, boolean][] = [
    ['Ankündigung ohne Synchro („offen“): Nebenzeile und Anbieter-Pille bleiben', { ...vermilion, ankuendigung: { ...angekuendigt, synchro: 'offen' } } as Title, true],
    ['Synchro schon belegt (andere Antwort als „ohne“): keine Karte', mitSynchro, false],
    ['westlicher Titel: keine Karte', { ...vermilion, westlich: true } as Title, false],
  ]
  for (const [name, title, ohneAntwort] of faelle) {
    const w = await rendere(title)
    pruefe(`${name}`, !karteIn(w) && !w.textContent.includes('Bescheid bei Termin'), w.textContent)
    if (ohneAntwort) {
      pruefe('… die Pille des Anbieters steht weiter da (Link zur Serie)', w.finde((k) => k.tagName === 'A' && k.getAttribute('href') === SERIE).length === 1)
      pruefe('… die Nebenzeile nennt „Synchro offen“', w.textContent.includes('Synchro offen'), w.textContent)
    }
  }
}

await act(async () => wurzel.unmount())
dom.entferne()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-termin-offen-karte: ok (Karte, Anbieter einmal, Knopf bis onToggleFavorite im DetailPanel, Gegenfälle ohne Karte)')
