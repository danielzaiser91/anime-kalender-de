/**
 * Film / Serie im Filterfenster (Daniel, 16.11.2026): zwei Chips ohne eigenes Feld, sie sind die Release-Art „Film“
 * (`releaseTypes: movie`) — „Film“ schließt sie ein, „Serie“ aus. Läuft die echte Komponente `FilterDetailsFeld` im Mini-DOM:
 * beide Chips da, „Film“ steht nicht zusätzlich unter Release-Art, Klick schreibt dieselbe Adresse wie früher (`rt=movie`,
 * `xrt=movie`), und alte Adressen zeigen denselben Zustand und dieselben Titel. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import type { DataMeta, Title } from '../shared/types.ts'
import type { Dataset } from '../web/src/lib/data.ts'
import { EMPTY_FILTERS, filterTitles, type FilterState } from '../web/src/lib/filters.ts'
import { buildHash, parseHash } from '../web/src/lib/router.ts'
import { ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const vorlauf = installiereMiniDom({ setTimeout, clearTimeout, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } as never, () => ({}))
const vorlaufDokument = (globalThis as unknown as { document: Record<string, unknown> }).document
vorlaufDokument.oninput = null
const { createRoot } = await import('react-dom/client')
vorlauf.entferne()
const { FilterDetailsFeld } = await import('../web/src/components/FilterDetails.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const meta = { genres: ['Action'], platforms: ['netflix'], keywords: [], years: [2024], providers: [] } as unknown as DataMeta

/** Rendert den Filter mit einem Zustand; `gesetzt` sammelt, was die Komponente über `onChange` zurückgibt. */
async function rendere(filters: FilterState) {
  const dom = installiereMiniDom({ setTimeout, clearTimeout, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } as never, () => ({}))
  const gesetzt: FilterState[] = []
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => {
    wurzel.render(h(FilterDetailsFeld, { meta, filters, onChange: (n: FilterState) => gesetzt.push(n), showConfidence: false }))
  })
  const knoepfe = () => dom.wurzel.finde((k) => k.tagName === 'BUTTON')
  const chip = (text: string): MiniKnoten | undefined => knoepfe().find((k) => k.textContent.trim() === text)
  return {
    dom,
    gesetzt,
    chip,
    knopf: (teil: string): MiniKnoten | undefined => knoepfe().find((k) => k.textContent.includes(teil)),
    anzahl: (text: string) => knoepfe().filter((k) => k.textContent.trim() === text).length,
    klick: (k: MiniKnoten) => act(async () => klicke(dom.wurzel, k)),
    /* Ein gewählter Chip trägt zusätzlich das Zustandswort („ja“) für Screenreader im Text. */
    gedrueckt: (text: string) => knoepfe().find((k) => k.textContent.trim().startsWith(text))?.getAttribute('aria-pressed'),
  }
}

console.log('\nFilm / Serie: Komponente')
const a = await rendere(EMPTY_FILTERS)
pruefe('beide Chips stehen da', !!a.chip('Film') && !!a.chip('Serie'))
pruefe('Normalzustand: keiner gewählt', a.gedrueckt('Film') === 'false' && a.gedrueckt('Serie') === 'false', [a.gedrueckt('Film'), a.gedrueckt('Serie')])
await a.klick(a.knopf('mehr Filter')!)
pruefe('hinter „mehr Filter“ steht „Film“ nicht noch einmal (Release-Art)', a.anzahl('Film') === 1, a.anzahl('Film'))
pruefe('Release-Art zeigt die übrigen Arten', !!a.knopf('Katalogtitel') && !!a.knopf('Disc'))
await a.klick(a.chip('Film')!)
pruefe('Klick auf „Film“ schließt movie ein', a.gesetzt.at(-1)?.releaseTypes.join() === 'movie' && a.gesetzt.at(-1)?.excluded.releaseTypes.length === 0, a.gesetzt.at(-1))
await a.klick(a.chip('Serie')!)
pruefe('Klick auf „Serie“ schließt movie aus', a.gesetzt.at(-1)?.excluded.releaseTypes.join() === 'movie' && a.gesetzt.at(-1)?.releaseTypes.length === 0, a.gesetzt.at(-1))
a.dom.entferne()

console.log('\nFilm / Serie: gespeicherter Zustand und alte Adressen')
const film = (await rendere(parseHash('#/datenbank?rt=movie').filters))
pruefe('rt=movie: „Film“ gewählt, „Serie“ nicht', film.gedrueckt('Film') === 'true' && film.gedrueckt('Serie') === 'false', [film.gedrueckt('Film'), film.gedrueckt('Serie')])
film.dom.entferne()
const serie = (await rendere(parseHash('#/datenbank?xrt=movie').filters))
pruefe('xrt=movie: „Serie“ gewählt, „Film“ nicht', serie.gedrueckt('Serie') === 'true' && serie.gedrueckt('Film') === 'false', [serie.gedrueckt('Film'), serie.gedrueckt('Serie')])
serie.dom.entferne()
pruefe('Adresse: „Film“ schreibt wie früher rt=movie', /(^|[?&])rt=movie(&|$)/.test(buildHash({ view: 'datenbank', date: '2026-10-11', filters: { ...EMPTY_FILTERS, releaseTypes: ['movie'] } })))
pruefe('Adresse: „Serie“ schreibt wie früher xrt=movie', /xrt=movie/.test(buildHash({ view: 'datenbank', date: '2026-10-11', filters: { ...EMPTY_FILTERS, excluded: { ...EMPTY_FILTERS.excluded, releaseTypes: ['movie'] } } })))

console.log('\nFilm / Serie: gleiche Titel wie die alte Release-Art')
const titel = (id: number, format: string) => ({ id, format, genres: [], keywords: [], streams: [], dubConfidence: 'high', titleDe: `T${id}` }) as unknown as Title
const alle = [titel(1, 'TV'), titel(2, 'MOVIE'), titel(3, 'OVA'), titel(4, 'MOVIE')]
const data = { releasesByTitle: new Map(), titleById: new Map(), releases: [], events: [] } as unknown as Dataset
const ids = (hash: string) => filterTitles(alle, data, parseHash(hash).filters, '2026-10-11', new Set()).map((t) => t.id).join()
pruefe('alter Link rt=movie zeigt die Filme', ids('#/datenbank?rt=movie') === '2,4', ids('#/datenbank?rt=movie'))
pruefe('alter Link xrt=movie zeigt alles außer Filmen', ids('#/datenbank?xrt=movie') === '1,3', ids('#/datenbank?xrt=movie'))

console.log('\nFilm / Serie: UND/ODER-Schalter der Release-Art zählt „Film“ nicht mit')
const nurFilm = await rendere({ ...EMPTY_FILTERS, releaseTypes: ['movie', 'weekly'] })
await nurFilm.klick(nurFilm.knopf('mehr Filter')!)
pruefe('Film + eine weitere Art: kein Schalter (nur eine Art in der Gruppe)', !nurFilm.knopf('egal'))
nurFilm.dom.entferne()
const zweiArten = await rendere({ ...EMPTY_FILTERS, releaseTypes: ['weekly', 'batch'] })
await zweiArten.klick(zweiArten.knopf('mehr Filter')!)
pruefe('zwei Arten ohne Film: Schalter da', !!zweiArten.knopf('egal'))
zweiArten.dom.entferne()

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nFilm / Serie: alle Zusicherungen halten')
