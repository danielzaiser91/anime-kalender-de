/**
 * Kalender-Filter: jedes Genre ist auffindbar (Daniel, 28.10.2026: „ecchi“ ließ sich nicht filtern, weil der Kalender nur
 * die zwölf häufigsten Genres des Zeitraums weitergab). Lässt die echte Komponente `FilterDetailsFeld` laufen
 * (Mini-DOM aus `tools/mini-dom.ts`): Genre auf Rang 13 und Genre ohne Termin im Zeitraum sind per Suche und über
 * „alle anzeigen“ da, ebenso ein Anbieter ohne Termin. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import type { DataMeta, ReleaseEvent, Title } from '../shared/types.ts'
import type { Dataset } from '../web/src/lib/data.ts'
import { EMPTY_FILTERS, type FilterState } from '../web/src/lib/filters.ts'
import { GENRE_VORSCHAU, genreAnzeige, nachZahlGeordnet } from '../web/src/lib/filter-liste.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
/* React entscheidet beim Laden, ob es `input`-Ereignisse gibt (canUseDOM, `oninput` im Dokument): das Mini-DOM steht darum vor dem Import. */
const vorlauf = installiereMiniDom({ setTimeout, clearTimeout, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } as never, () => ({}))
const vorlaufDokument = (globalThis as unknown as { document: Record<string, unknown> }).document
vorlaufDokument.oninput = null
const { createRoot } = await import('react-dom/client')
vorlauf.entferne()
const { FilterDetailsFeld } = await import('../web/src/components/FilterDetails.tsx')
const { FilterFeld } = await import('../web/src/components/kalender/FilterFeld.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nGenre-Liste des Kalender-Filters:')
/* 15 Genres: G01 hat die meisten Termine, G13 Rang 13, G14 und G15 keinen Termin im Zeitraum. */
const namen = Array.from({ length: 15 }, (_, i) => `Gx${String(i + 1).padStart(2, '0')}`)
const zahl = new Map<string, number>(namen.slice(0, 13).map((g, i) => [g, 100 - i]))
const geordnet = nachZahlGeordnet([...namen].reverse(), zahl)
pruefe('geordnet: häufigste zuerst, Genres ohne Termin am Ende, keines geht verloren', geordnet.slice(0, 13).join() === namen.slice(0, 13).join() && geordnet.length === 15, geordnet)
pruefe('Vorschau: genau die ersten zwölf, drei dahinter', genreAnzeige(geordnet, [], false, false).sichtbar.length === GENRE_VORSCHAU && genreAnzeige(geordnet, [], false, false).versteckt === 3)
pruefe('Vorschau: ein gewähltes Genre dahinter bleibt sichtbar', genreAnzeige(geordnet, ['Gx14'], false, false).sichtbar.includes('Gx14'))
pruefe('aufgeklappt oder mit Suche: alle 15', genreAnzeige(geordnet, [], true, false).sichtbar.length === 15 && genreAnzeige(geordnet, [], false, true).sichtbar.length === 15)
pruefe('… bei gleicher Zahl bleibt die Reihenfolge der Ausgangsliste (Genres ohne Termin)', geordnet.slice(13).join() === 'Gx15,Gx14', geordnet)
pruefe('… auch in anderer Ausgangsreihenfolge', nachZahlGeordnet(namen, zahl).slice(13).join() === 'Gx14,Gx15')

const meta = {
  genres: [...namen].reverse(),
  platforms: ['netflix', 'crunchyroll', 'primevideo'],
  keywords: [],
  years: [],
  providers: [],
} as unknown as DataMeta

type Wurzelbauer = () => ReturnType<typeof h>
const zeile = (k: MiniKnoten) => k.textContent

/** Rendert die Komponente im Mini-DOM und reicht die Hilfen für Chips, Knöpfe und Tippen. */
async function rendere(bau: Wurzelbauer) {
  const uhr = attrappeUhr()
  const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() }))
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => {
    wurzel.render(bau())
  })
  const chips = () => dom.wurzel.finde((k) => k.tagName === 'BUTTON').map(zeile)
  return {
    dom,
    hat: (g: string) => chips().some((c) => c.includes(g)),
    chips,
    text: () => dom.wurzel.textContent,
    knopf: (teil: string) => dom.wurzel.finde((k) => k.tagName === 'BUTTON' && zeile(k).includes(teil))[0],
    klick: (k: MiniKnoten) => act(async () => klicke(dom.wurzel, k)),
    tippe: (text: string) =>
      act(async () => {
        const feld = dom.wurzel.finde((k) => k.tagName === 'INPUT')[0]!
        Object.assign(feld, { value: text, type: 'search' })
        const e = { type: 'input', target: feld, bubbles: true, cancelable: true, defaultPrevented: false, timeStamp: 0, preventDefault() {}, stopPropagation() {} }
        for (const capture of [true, false]) (dom.wurzel.hoerer.get('input') ?? []).filter((x) => x.capture === capture).forEach((x) => x.f(e))
      }),
  }
}

async function pruefeAnsicht(wo: string, bau: Wurzelbauer, vorn: string, rang13: string, ohneTermin: string) {
  const a = await rendere(bau)
  pruefe(`${wo}: Rang 12 da, Rang 13 und Genre ohne Termin nicht`, a.hat(vorn) && !a.hat(rang13) && !a.hat(ohneTermin))
  pruefe(`${wo}: Anbieter ohne Termin im Zeitraum (Prime Video) bleibt auffindbar`, a.text().includes('Prime Video'))
  await a.tippe(ohneTermin)
  pruefe(`${wo}: während der Suche kein Knopf „alle anzeigen“`, !a.knopf('alle anzeigen'))
  pruefe(`${wo}: Suche findet das Genre ohne Termin`, a.hat(ohneTermin), a.chips())
  await a.tippe(rang13)
  pruefe(`${wo}: Suche findet das Genre auf Rang 13`, a.hat(rang13) && !a.hat(vorn), a.chips())
  await a.tippe('')
  pruefe(`${wo}: Suche geleert, wieder nur die Vorschau`, a.hat(vorn) && !a.hat(rang13))
  const mehr = a.knopf('alle anzeigen')
  pruefe(`${wo}: Knopf „alle anzeigen (15)“ steht da`, !!mehr)
  if (mehr) await a.klick(mehr)
  pruefe(`${wo}: aufgeklappt, Rang 13 und Genre ohne Termin da`, a.hat(rang13) && a.hat(ohneTermin))
  pruefe(`${wo}: aufgeklappt steht „weniger anzeigen“ da`, !!a.knopf('weniger anzeigen'))
  await a.tippe(rang13)
  pruefe(`${wo}: aufgeklappt und gesucht, kein Knopf`, !a.knopf('weniger anzeigen'))
  a.dom.entferne()
}

const platformZaehlung = new Map([['netflix' as const, 5], ['crunchyroll' as const, 3]])
const details = (filters: FilterState) => () =>
  h(FilterDetailsFeld, { meta, filters, onChange: () => undefined, showConfidence: false, platformZaehlung, genreListe: geordnet, genreZaehlung: zahl })
await pruefeAnsicht('Filter', details(EMPTY_FILTERS), 'Gx12', 'Gx13', 'Gx15')

/* Datenbank: ohne `genreListe` zeigt der Filter alle Genres und keinen Knopf. */
const datenbank = await rendere(() => h(FilterDetailsFeld, { meta, filters: EMPTY_FILTERS, onChange: () => undefined, showConfidence: false }))
pruefe('Datenbank: alle 15 Genres ohne Knopf', datenbank.hat('Gx01') && datenbank.hat('Gx13') && datenbank.hat('Gx15') && !datenbank.knopf('alle anzeigen'))
datenbank.dom.entferne()

/* Gewählte und ausgeschlossene Genres hinter der Vorschau bleiben stehen — sonst fände man sie nicht wieder. */
const gewaehlt = await rendere(details({ ...EMPTY_FILTERS, genres: ['Gx14'], excluded: { ...EMPTY_FILTERS.excluded, genres: ['Gx15'] } }))
pruefe('Filter: gewähltes (Gx14) und ausgeschlossenes (Gx15) Genre bleiben trotz Vorschau sichtbar', gewaehlt.hat('Gx14') && gewaehlt.hat('Gx15') && !gewaehlt.hat('Gx13'))
gewaehlt.dom.entferne()

/* Die echte Kalender-Komponente: Zahlen aus den Terminen des Zeitraums, Genre-Liste aus `meta.genres`. */
const titel = new Map<number, Title>()
const termine: ReleaseEvent[] = []
namen.slice(0, 13).forEach((g, i) => {
  titel.set(i + 1, { id: i + 1, genres: [g] } as unknown as Title)
  for (let n = 0; n < 20 - i; n++) termine.push({ id: `e${i}-${n}`, releaseSlug: `r${i}`, titleId: i + 1, date: '2999-01-01', platform: 'netflix' } as unknown as ReleaseEvent)
})
const daten = { meta, titleById: titel } as unknown as Dataset
const feldProps = { data: daten, filters: EMPTY_FILTERS, onChange: () => undefined, tvAn: true, setTvAn: () => undefined, favoriteCount: 0, zeitraum: termine, treffer: termine.length, zeitraumWort: 'Woche', schliessen: () => undefined }
await pruefeAnsicht('Kalender', () => h(FilterFeld, feldProps), 'Gx12', 'Gx13', 'Gx15')

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nKalender-Filter-Genres: Rang 13, Genre ohne Termin und Anbieter ohne Termin per Suche und „alle anzeigen“ auffindbar, gewählte bleiben sichtbar')
