/**
 * Wertungsfilter (Daniel, 16.11.2026): Mindestwertung (0–100, gezeigt als „7,0“) und das Kästchen „Titel ohne Wertung
 * ausschließen“. Die Regel `passtWertung` an ihren Grenzen, dasselbe Ergebnis in Datenbank (`filterTitles`) und Kalender
 * (`releaseMatches`), Adresse (`wm`, `wx`; alte Adressen ohne die Schlüssel gelten wie vorher), Filterzähler, Suchhinweis,
 * und die echten Komponenten im Mini-DOM: Gruppe „Wertung“ im Filterfenster und Eintrag in der Leiste der aktiven Filter.
 * Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import type { DataMeta, Release, Title } from '../shared/types.ts'
import type { Dataset } from '../web/src/lib/data.ts'
import { EMPTY_FILTERS, activeFilterCount, filterTitles, releaseMatches, type FilterState } from '../web/src/lib/filters.ts'
import { WERTUNG_STUFEN, passtWertung, wertungNurMitVollenDaten, wertungText } from '../web/src/lib/filter-wertung.ts'
import { buildHash, parseHash } from '../web/src/lib/router.ts'
import { namensIndex } from './bau/ohne-synchro-namen.ts'
import { kalenderFilter } from '../web/src/lib/kalender-filter.ts'
import { aktiveEinheiten } from '../web/src/lib/suchhinweis-filter.ts'
import { einheitName } from '../web/src/lib/suchhinweis-namen.ts'
import { ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const vorlauf = installiereMiniDom({ setTimeout, clearTimeout, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } as never, () => ({}))
const vorlaufDokument = (globalThis as unknown as { document: Record<string, unknown> }).document
vorlaufDokument.oninput = null
const { createRoot } = await import('react-dom/client')
vorlauf.entferne()
const { FilterDetailsFeld } = await import('../web/src/components/FilterDetails.tsx')
const { AktiveFilter } = await import('../web/src/components/kalender/AktiveFilter.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nWertungsfilter: Regel an den Grenzen')
pruefe('Schwellen stehen fest (Skala 0–100)', WERTUNG_STUFEN.join() === '60,70,75,80')
pruefe('Schreibweise wie das Panel: 85 → „8,5“, 70 → „7,0“', wertungText(85) === '8,5' && wertungText(70) === '7,0')
pruefe('genau der Schwellenwert zählt dazu', passtWertung(70, 70, false))
pruefe('einen darunter nicht', !passtWertung(69, 70, false))
pruefe('einen darüber ja', passtWertung(71, 70, false))
pruefe('ohne Schwelle passt jede Wertung', passtWertung(14, 0, false))
pruefe('ohne Wertung, Schwelle gewählt, Kästchen aus: bleibt sichtbar', passtWertung(undefined, 70, false))
pruefe('ohne Wertung, Schwelle gewählt, Kästchen an: fällt heraus', !passtWertung(undefined, 70, true))
pruefe('Kästchen allein: Titel ohne Wertung fallen heraus', !passtWertung(undefined, 0, true))
pruefe('Kästchen allein: Titel mit Wertung bleiben (auch eine niedrige)', passtWertung(14, 0, true))
pruefe('Normalzustand: ohne Wertung bleibt sichtbar', passtWertung(undefined, 0, false))

console.log('\nWertungsfilter: Datenbank und Kalender liefern dasselbe')
const titel = (id: number, score?: number) => ({ id, score, genres: [], keywords: [], streams: [], dubConfidence: 'high', titleDe: `T${id}` }) as unknown as Title
const alle = [titel(1, 85), titel(2, 70), titel(3, 69), titel(4), titel(5, 14)]
const data = { releasesByTitle: new Map(), titleById: new Map(), releases: [], events: [] } as unknown as Dataset
const ids = (f: FilterState) => filterTitles(alle, data, f, '2026-10-11', new Set()).map((t) => t.id).join()
const termin = { platform: 'netflix', releaseType: 'weekly', year: 2026, schedule: {} } as unknown as Release
const kalenderIds = (f: FilterState) => alle.filter((t) => releaseMatches(termin, t, f, '2026-10-11')).map((t) => t.id).join()
const faelle: [string, FilterState, string][] = [
  ['Normalzustand: alle', EMPTY_FILTERS, '1,2,3,4,5'],
  ['≥ 7,0: 85 und genau 70, dazu der Titel ohne Wertung', { ...EMPTY_FILTERS, minScore: 70 }, '1,2,4'],
  ['≥ 7,0 mit Kästchen: der Titel ohne Wertung fällt heraus', { ...EMPTY_FILTERS, minScore: 70, ohneWertungAus: true }, '1,2'],
  ['nur Kästchen: alle mit Wertung', { ...EMPTY_FILTERS, ohneWertungAus: true }, '1,2,3,5'],
]
for (const [name, f, soll] of faelle) {
  pruefe(`Datenbank: ${name}`, ids(f) === soll, ids(f))
  pruefe(`Kalender-Termin: ${name}`, kalenderIds(f) === soll, kalenderIds(f))
}
pruefe('Kalender-Termin ohne Titelangabe zählt als ohne Wertung', releaseMatches(termin, undefined, { ...EMPTY_FILTERS, ohneWertungAus: true }, '2026-10-11') === false && releaseMatches(termin, undefined, { ...EMPTY_FILTERS, minScore: 70 }, '2026-10-11'))
/* Die Kachel-Datei des Wochenstarts trägt `score` nicht: ohne gesetzten Wertungsfilter darf niemand es lesen (`tools/kachel-felder-messen.mjs`). */
const gelesen: string[] = []
const spaeher = new Proxy(titel(9, 50), { get: (z, k) => (gelesen.push(String(k)), Reflect.get(z, k)) })
releaseMatches(termin, spaeher, EMPTY_FILTERS, '2026-10-11')
filterTitles([spaeher], data, EMPTY_FILTERS, '2026-10-11', new Set())
pruefe('ohne Wertungsfilter wird `score` weder im Kalender noch in der Datenbank gelesen', !gelesen.includes('score'), gelesen)
releaseMatches(termin, spaeher, { ...EMPTY_FILTERS, minScore: 70 }, '2026-10-11')
pruefe('mit Wertungsfilter wird `score` gelesen (Kontrolle des Spähers)', gelesen.includes('score'), gelesen)
/* Suchhinweis: Die Kandidaten kommen aus dem Namensindex; er trägt `score`, sonst gälte jeder Name als „ohne Wertung“. */
const kandidaten = namensIndex([titel(21, 50), titel(22, 80), titel(23)]).map((z) => ({ ...z, streams: [], keywords: [] }))
const kandidatPasst = (id: number, f: FilterState) => filterTitles(kandidaten as unknown as Title[], data, f, '2026-10-11', new Set()).some((t) => t.id === id)
pruefe('Suchhinweis-Kandidat: reine Schwelle blendet den schwachen aus, den starken nicht', !kandidatPasst(21, { ...EMPTY_FILTERS, minScore: 70 }) && kandidatPasst(22, { ...EMPTY_FILTERS, minScore: 70 }))
pruefe('Suchhinweis-Kandidat: Kästchen blendet nur den ohne Wertung aus', kandidatPasst(21, { ...EMPTY_FILTERS, ohneWertungAus: true }) && kandidatPasst(22, { ...EMPTY_FILTERS, ohneWertungAus: true }) && !kandidatPasst(23, { ...EMPTY_FILTERS, ohneWertungAus: true }))
pruefe('Kalenderfilter übernimmt beide Felder aus dem eigenen Speicher', (() => {
  const k = kalenderFilter(EMPTY_FILTERS, { ...EMPTY_FILTERS, minScore: 75, ohneWertungAus: true })
  return k.minScore === 75 && k.ohneWertungAus === true
})())

console.log('\nWertungsfilter: Adresse, Zähler, Suchhinweis')
const gesetzt: FilterState = { ...EMPTY_FILTERS, minScore: 70, ohneWertungAus: true }
const hash = buildHash({ view: 'datenbank', date: '2026-10-11', filters: gesetzt })
pruefe('Adresse schreibt wm=70 und wx=1', /(^|[?&])wm=70(&|$)/.test(hash) && /(^|[?&])wx=1(&|$)/.test(hash), hash)
const zurueck = parseHash(hash).filters
pruefe('Adresse: Hin und zurück', zurueck.minScore === 70 && zurueck.ohneWertungAus === true, zurueck)
pruefe('Normalzustand schreibt nichts in die Adresse', !/wm=|wx=/.test(buildHash({ view: 'datenbank', date: '2026-10-11', filters: EMPTY_FILTERS })))
const alt = parseHash('#/datenbank?g=Action&rt=movie').filters
pruefe('alte Adresse ohne die neuen Schlüssel: Normalzustand', alt.minScore === 0 && alt.ohneWertungAus === false && alt.genres.join() === 'Action' && alt.releaseTypes.join() === 'movie', alt)
pruefe('ungültige Mindestwertung (abc, 0, -5, 101, 7.5) fällt weg', ['abc', '0', '-5', '101', '7.5'].every((w) => parseHash(`#/datenbank?wm=${w}`).filters.minScore === 0))
pruefe('Mindestwertung an den Rändern der Adresse: 1 und 100 gelten', parseHash('#/datenbank?wm=1').filters.minScore === 1 && parseHash('#/datenbank?wm=100').filters.minScore === 100)
pruefe('Adresse schreibt auch die kleinste Schwelle (1)', /(^|[?&])wm=1(&|$)/.test(buildHash({ view: 'datenbank', date: '2026-10-11', filters: { ...EMPTY_FILTERS, minScore: 1 } })))
pruefe('wx nur mit 1', parseHash('#/datenbank?wx=0').filters.ohneWertungAus === false && parseHash('#/datenbank?wx=true').filters.ohneWertungAus === false)
pruefe('Kalender: Woche schreibt und liest keine Wertung aus der Adresse', !/wm=|wx=/.test(buildHash({ view: 'woche', date: '2026-10-11', filters: gesetzt })) && parseHash('#/woche?wm=70&wx=1').filters.minScore === 0)
pruefe('Zähler: kleinste Schwelle (1) zählt, Normalzustand nicht, Belegstärke zählt 1', activeFilterCount({ ...EMPTY_FILTERS, minScore: 1 }) === 1 && activeFilterCount(EMPTY_FILTERS) === 0 && activeFilterCount({ ...EMPTY_FILTERS, minConfidence: 'high' }) === 1)
pruefe('Zähler: Schwelle zählt 1, Kästchen zählt 1, zusammen 2', activeFilterCount({ ...EMPTY_FILTERS, minScore: 70 }) === 1 && activeFilterCount({ ...EMPTY_FILTERS, ohneWertungAus: true }) === 1 && activeFilterCount(gesetzt) === 2)
pruefe('Zurücksetzen (EMPTY_FILTERS) setzt beide zurück', activeFilterCount({ ...EMPTY_FILTERS }) === 0)
pruefe('Suchhinweis: Normalzustand ohne Einheit, kleinste Schwelle (1) mit', aktiveEinheiten(EMPTY_FILTERS).length === 0 && aktiveEinheiten({ ...EMPTY_FILTERS, minScore: 1 }).length === 1)
const einheiten = aktiveEinheiten(gesetzt)
pruefe('Suchhinweis kennt beide Einheiten und entfernt sie einzeln', einheiten.map((e) => e.id).join() === 'wertung,ohneWertung' && einheiten[0]!.entferne(gesetzt).minScore === 0 && einheiten[1]!.entferne(gesetzt).ohneWertungAus === false)
pruefe('Suchhinweis-Namen', einheitName(einheiten[0]!, gesetzt, String) === 'Wertung ab 7,0' && einheitName(einheiten[1]!, gesetzt, String) === 'ohne Wertung ausgeblendet')

/* Kalender vor dem Nachladen: Die Kachel-Datei trägt kein `score`; Kästchen und Schwelle wirken erst mit den vollen Daten. */
const kachel = [titel(31), titel(32)]
const kalenderKachelIds = (f: FilterState, voll: boolean) => kachel.filter((t) => releaseMatches(termin, t, wertungNurMitVollenDaten(f, voll), '2026-10-11')).length
const kaestchen = { ...EMPTY_FILTERS, ohneWertungAus: true }
pruefe('Kästchen vor dem Nachladen: Kalender nicht leer', kalenderKachelIds(kaestchen, false) === 2, kalenderKachelIds(kaestchen, false))
pruefe('Schwelle vor dem Nachladen: Kalender nicht leer', kalenderKachelIds({ ...EMPTY_FILTERS, minScore: 70 }, false) === 2)
pruefe('Kästchen nach dem Nachladen: filtert wie bisher', kalenderKachelIds(kaestchen, true) === 0 && kalenderIds(kaestchen) === '1,2,3,5')
pruefe('ohne Wertungsfilter bleibt das Objekt dasselbe (kein neuer Filterzustand je Render)', wertungNurMitVollenDaten(EMPTY_FILTERS, false) === EMPTY_FILTERS)
pruefe('Vor dem Nachladen bleiben die übrigen Filter erhalten', wertungNurMitVollenDaten({ ...kaestchen, minScore: 70, kostenlosOnly: true }, false).kostenlosOnly === true)

console.log('\nWertungsfilter: Komponenten im Mini-DOM')
const meta = { genres: ['Action'], platforms: ['netflix'], keywords: [], years: [2024], providers: [] } as unknown as DataMeta
async function rendere(bau: () => ReturnType<typeof h>) {
  const dom = installiereMiniDom({ setTimeout, clearTimeout, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } as never, () => ({}))
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => {
    wurzel.render(bau())
  })
  const finde = (tag: string) => dom.wurzel.finde((k) => k.tagName === tag)
  return {
    dom,
    text: () => dom.wurzel.textContent,
    knopf: (teil: string): MiniKnoten | undefined => finde('BUTTON').find((k) => k.textContent.trim().startsWith(teil)),
    kaestchen: () => finde('INPUT').find((k) => (k as unknown as { type: string }).type === 'checkbox'),
    /** Ein Klick auf das Kästchen: der Browser kippt `checked` vor dem Ereignis, das Mini-DOM nicht. */
    haken: (k: MiniKnoten) => act(async () => {
      Object.assign(k, { checked: !(k as unknown as { checked?: boolean }).checked })
      klicke(dom.wurzel, k)
    }),
    klick: (k: MiniKnoten) => act(async () => klicke(dom.wurzel, k)),
  }
}
const aus: FilterState[] = []
const fenster = await rendere(() => h(FilterDetailsFeld, { meta, filters: EMPTY_FILTERS, onChange: (n: FilterState) => aus.push(n), showConfidence: false }))
pruefe('Gruppe „Wertung“ steht ohne „mehr Filter“ da', fenster.text().includes('Wertung') && !!fenster.knopf('alle') && !!fenster.knopf('≥ 6,0') && !!fenster.knopf('≥ 7,0') && !!fenster.knopf('≥ 7,5') && !!fenster.knopf('≥ 8,0'))
pruefe('Kästchen mit Beschriftung da', !!fenster.kaestchen() && fenster.text().includes('Titel ohne Wertung ausschließen'))
await fenster.klick(fenster.knopf('≥ 7,0')!)
pruefe('Klick auf „≥ 7,0“ setzt 70', aus.at(-1)?.minScore === 70, aus.at(-1)?.minScore)
await fenster.haken(fenster.kaestchen()!)
pruefe('Klick auf das Kästchen schließt Titel ohne Wertung aus', aus.at(-1)?.ohneWertungAus === true, aus.at(-1)?.ohneWertungAus)
fenster.dom.entferne()
const fenster2 = await rendere(() => h(FilterDetailsFeld, { meta, filters: EMPTY_FILTERS, onChange: () => undefined, showConfidence: false }))
const gewaehlt = await rendere(() => h(FilterDetailsFeld, { meta, filters: gesetzt, onChange: (n: FilterState) => aus.push(n), showConfidence: false }))
pruefe('Normalzustand: „alle“ ist markiert, keine Schwelle', fenster2.knopf('alle')?.getAttribute('aria-pressed') === 'true' && fenster2.knopf('≥ 7,0')?.getAttribute('aria-pressed') === 'false')
fenster2.dom.entferne()
pruefe('gewählte Schwelle ist markiert, „alle“ nicht', gewaehlt.knopf('≥ 7,0')?.getAttribute('aria-pressed') === 'true' && gewaehlt.knopf('alle')?.getAttribute('aria-pressed') === 'false')
pruefe('Kästchen ist angehakt', (gewaehlt.kaestchen() as unknown as { checked?: boolean } | undefined)?.checked === true)
await gewaehlt.klick(gewaehlt.knopf('alle')!)
pruefe('„alle“ nimmt die Schwelle zurück, das Kästchen bleibt', aus.at(-1)?.minScore === 0 && aus.at(-1)?.ohneWertungAus === true, aus.at(-1))
gewaehlt.dom.entferne()

const leer = await rendere(() => h(AktiveFilter, { filters: EMPTY_FILTERS, onChange: () => undefined }))
const klein = await rendere(() => h(AktiveFilter, { filters: { ...EMPTY_FILTERS, minScore: 1 }, onChange: () => undefined }))
pruefe('Leiste: Normalzustand ohne Wertungseintrag, kleinste Schwelle (1) mit „Wertung ab 0,1“', !leer.text().includes('Wertung') && klein.text().includes('Wertung ab 0,1'), [leer.text(), klein.text()])
leer.dom.entferne()
klein.dom.entferne()
const leiste = await rendere(() => h(AktiveFilter, { filters: gesetzt, onChange: (n: FilterState) => aus.push(n) }))
pruefe('aktive Filter zeigen beide Wertungseinträge', leiste.text().includes('Wertung ab 7,0') && leiste.text().includes('ohne Wertung ausgeblendet'), leiste.text())
await leiste.klick(leiste.knopf('Wertung ab 7,0')!)
pruefe('Entfernen des Schwelleneintrags lässt das Kästchen stehen', aus.at(-1)?.minScore === 0 && aus.at(-1)?.ohneWertungAus === true, aus.at(-1))
await leiste.klick(leiste.knopf('ohne Wertung ausgeblendet')!)
pruefe('Entfernen des Kästcheneintrags lässt die Schwelle stehen', aus.at(-1)?.ohneWertungAus === false && aus.at(-1)?.minScore === 70, aus.at(-1))
leiste.dom.entferne()

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nWertungsfilter: alle Zusicherungen halten')
