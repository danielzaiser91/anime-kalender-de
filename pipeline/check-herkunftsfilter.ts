/**
 * Zusicherungen zum Herkunftsfilter (Mockup B, 11.10.2026): Herkunft je Titel, „nur diese" / „ausblenden",
 * Zähler, Adresse (Datenbank) und Eigenständigkeit im Kalender. Aufruf: `npm run check:logic`.
 */
import { EMPTY_FILTERS, filterTitles, releaseMatches, toggleFilter, type FilterState } from '../web/src/lib/filters.ts'
import { herkunftVon, zaehleHerkunft } from '../web/src/lib/herkunft.ts'
import { herkunftListe } from '../web/src/components/filter/herkunft-gruppe.tsx'
import { buildHash, parseHash } from '../web/src/lib/router.ts'
import { kalenderBasis } from '../web/src/lib/kalender-filter.ts'
import type { Release, Title } from '../shared/types.ts'
import type { Dataset } from '../web/src/lib/data.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** `id` ist unsere eigene Kennung, `al` die AniList-Kennung (so liefert sie `dist/data/`; Cartoons haben keine). */
const titel = (id: number, land?: string, al?: number) => ({ id, al, land, genres: [], keywords: [], streams: [], dubConfidence: 'high', titleDe: `T${id}` }) as unknown as Title

console.log('\nHerkunftsfilter: Herkunft je Titel')
pruefe('ohne Land und mit AniList-Kennung ist Japan', herkunftVon(titel(1)) === 'JP')
pruefe('KR, CN, TW bleiben, was sie sind', ['KR', 'CN', 'TW'].every((l) => herkunftVon(titel(1, l)) === l))
pruefe('jedes andere Land ist „USA & Co."', ['US', 'CA', 'GB', 'DE'].every((l) => herkunftVon(titel(-5, l)) === 'US'))
pruefe('ohne Land bei aniSearch-Kennung oder Cartoon ist unbekannt, nicht Japan', herkunftVon(titel(17975, undefined, 10_000_007)) === 'XX' && herkunftVon(titel(-99)) === 'XX')
pruefe('maßgeblich ist die AniList-Kennung, nicht unsere eigene', herkunftVon(titel(10_000_007, undefined, 1)) === 'JP')
pruefe('ein Cartoon mit Land JP zählt als Japan', herkunftVon(titel(-3, 'JP')) === 'JP')

console.log('\nHerkunftsfilter: Zähler und Liste')
const alle = [titel(1), titel(2), titel(3, 'KR'), titel(4, 'KR'), titel(5, 'CN'), titel(-6, 'US'), titel(7, undefined, 10_000_001)]
const z = zaehleHerkunft(alle)
pruefe('Zähler je Herkunft', z.get('JP') === 2 && z.get('KR') === 2 && z.get('CN') === 1 && z.get('US') === 1 && z.get('XX') === 1 && !z.has('TW'), [...z])
pruefe('Liste: nach Zahl absteigend, ohne leere Herkunft', herkunftListe(z, EMPTY_FILTERS).slice(0, 2).join() === 'JP,KR' && !herkunftListe(z, EMPTY_FILTERS).includes('TW'))
pruefe('Liste: eine gewählte Herkunft ohne Titel bleibt stehen', herkunftListe(z, { ...EMPTY_FILTERS, land: ['TW'] }).includes('TW'))
pruefe('Liste: mit nur einer Herkunft entfällt die Gruppe', herkunftListe(zaehleHerkunft([titel(1), titel(2)]), EMPTY_FILTERS).length === 0)

console.log('\nHerkunftsfilter: Datenbank')
const data = { releasesByTitle: new Map(), titleById: new Map(), releases: [], events: [] } as unknown as Dataset
const ids = (f: FilterState) => filterTitles(alle, data, f, '2026-10-11', new Set()).map((t) => t.id).join()
pruefe('nur Korea', ids({ ...EMPTY_FILTERS, land: ['KR'] }) === '3,4')
pruefe('Korea und China (ODER)', ids({ ...EMPTY_FILTERS, land: ['KR', 'CN'] }) === '3,4,5')
pruefe('Japan ausblenden', ids(toggleFilter(EMPTY_FILTERS, 'land', 'JP', 'exclude')) === '3,4,5,-6,7')
pruefe('Unbekannt ausblenden', ids(toggleFilter(EMPTY_FILTERS, 'land', 'XX', 'exclude')) === '1,2,3,4,5,-6')
pruefe('Umschalten räumt die andere Seite auf', toggleFilter(toggleFilter(EMPTY_FILTERS, 'land', 'KR', 'include'), 'land', 'KR', 'exclude').land.length === 0)

console.log('\nHerkunftsfilter: Adresse und Kalender')
const gewaehlt = toggleFilter(toggleFilter(EMPTY_FILTERS, 'land', 'KR', 'include'), 'land', 'JP', 'exclude')
const hash = buildHash({ view: 'datenbank', date: '2026-10-11', filters: gewaehlt })
pruefe('Adresse: her=KR, xher=JP', /(^|[?&])her=KR(&|$)/.test(hash) && /xher=JP/.test(hash), hash)
const zurueck = parseHash(hash).filters
pruefe('Adresse: Hin und zurück', zurueck.land.join() === 'KR' && zurueck.excluded.land.join() === 'JP', zurueck)
pruefe('Adresse: unbekannte Kürzel fallen weg', parseHash('#/datenbank?her=KR,ZZ').filters.land.join() === 'KR')
pruefe('Kalender: Woche und Monat schreiben und teilen keine Herkunft', !/her=/.test(buildHash({ view: 'woche', date: '2026-10-11', filters: gewaehlt })) && kalenderBasis(gewaehlt).land.length === 0)
const termin = { platform: 'netflix', releaseType: 'weekly', year: 2026, schedule: {} } as unknown as Release
pruefe('Kalender-Termin: Filter gilt für den Titel des Termins', releaseMatches(termin, titel(3, 'KR'), { ...EMPTY_FILTERS, land: ['KR'] }, '2026-10-11') && !releaseMatches(termin, titel(1), { ...EMPTY_FILTERS, land: ['KR'] }, '2026-10-11'))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nHerkunftsfilter: alle Zusicherungen erfüllt.')
