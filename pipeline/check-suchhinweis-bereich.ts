/**
 * Gesamtweg des Suchhinweises: die echte `DatenbankBereich` (mit `DatabaseView`, Hook, `SuchHinweis`) wird gerendert, die Titeldateien kommen
 * über ein Attrappe-`fetch`, ein Klick auf den Knopf muss bei `navigate` der Seite ankommen (`onHinweisLoesen={loeseHinweis(p)}`).
 * Fehlt die Verdrahtung oder ist sie falsch, bleibt der Klick wirkungslos bzw. die Adresse falsch. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke } from '../tools/mini-dom.ts'
import { EMPTY_FILTERS } from '../web/src/lib/filters.ts'
import type { Dataset } from '../web/src/lib/data.ts'
ignoriereCss()
const { DatenbankBereich } = await import('../web/src/components/DatenbankBereich.tsx')

const titel = (id: number, name: string, ohneSynchro: boolean): Title =>
  ({ id, franchiseId: 200 + id, titleDe: name, titleEn: name, jpYear: 2000 + id, format: 'TV', genres: [], keywords: [], streams: [], dubConfidence: 'high', ohneSynchro }) as unknown as Title

const ippo = titel(6, 'Hajime no Ippo', true)
const dateien: Record<string, unknown> = {
  'titles.json': [titel(1, 'Attack on Titan', false)],
  'ohne-synchro-namen.json': [ippo],
  'synonyme.json': {},
}
/* Schlüssel = Dateiname, egal unter welcher Basisadresse die Seite die Datei abruft. */
const attrappeFetch = async (adresse: string) => {
  const name = String(adresse).split('?')[0].split('/').pop() ?? ''
  const inhalt = dateien[name]
  return { ok: inhalt !== undefined, status: inhalt === undefined ? 404 : 200, json: async () => inhalt }
}
Object.assign(globalThis, { fetch: attrappeFetch })

const uhr = attrappeUhr()
const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
const warte = (ms: number) => uhr.schiebe(ms, (f) => act(async () => f()))

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const jahr2003 = { ...EMPTY_FILTERS, years: [2003], search: 'Hajime no Ippo' }
const data = { titles: [titel(1, 'Attack on Titan', false)], titleById: new Map(), releasesByTitle: new Map(), releases: [], events: [], eventsByDate: new Map(), releaseBySlug: new Map(), meta: {} } as unknown as Dataset
const aufrufe: unknown[] = []
const stumm = () => {}
const props = {
  data,
  route: { view: 'datenbank', date: '2999-12-31', filters: jahr2003 },
  navigate: (n: unknown) => void aufrufe.push(n),
  setFilters: stumm,
  geladen: true,
  titles: { liste: [] as Title[], fundstellen: new Map() },
  quelle: [] as Title[],
  grouped: false,
  onGroupedChange: stumm,
  ohneSynchro: false,
  onOhneSynchroChange: (an: boolean) => void aufrufe.push(['ohne', an]),
  laedt: false,
  favorites: new Set<number>(),
  hidden: new Set<number>(),
  onToggleFavorite: stumm,
  onToggleHidden: stumm,
  onSortChange: stumm,
  filters: jahr2003,
  onFiltersChange: stumm,
}

console.log('\nSuchhinweis: Gesamtweg in der echten Datenbank')
{
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => wurzel.render(h(DatenbankBereich, props as unknown as Parameters<typeof DatenbankBereich>[0])))
  await warte(600)
  await act(async () => {})
  /* Die Rechnung gibt den Faden mit einem echten setTimeout(0) frei (use-zeitscheibe); ein paar kurze Züge lassen sie fertig werden. */
  for (let i = 0; i < 5; i++) await act(async () => void (await new Promise((fertig) => setTimeout(fertig, 5))))
  await act(async () => {})
  const fund = dom.wurzel.finde((k) => k.getAttribute('data-suchhinweis') !== null)[0]
  pruefe('der Hinweis steht in der Datenbank, mit dem blockierenden Filter', !!fund && fund.textContent.includes('durch: Jahr 2003'), fund?.textContent)
  const taste = fund?.finde((k) => k.tagName === 'BUTTON')[0]
  if (taste) klicke(dom.wurzel, taste)
  const erwartet = [{ filters: { ...EMPTY_FILTERS, years: [], search: 'Hajime no Ippo' }, ohne: true }]
  pruefe('der Klick löst Filter und Schalter in einem Adresswechsel der Seite', JSON.stringify(aufrufe) === JSON.stringify(erwartet), aufrufe)
  await act(async () => wurzel.unmount())
}

dom.entferne()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-suchhinweis-bereich: ok (Hinweis in DatenbankBereich, Klick bis navigate)')
