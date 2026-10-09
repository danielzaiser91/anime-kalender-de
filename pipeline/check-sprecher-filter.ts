/**
 * Zusicherungen zum Sprecher-Filter der Datenbank (Daniel, 09.10.2026): „mit"-Sprecher ODER, „ohne"-Sprecher UND,
 * Sprecher-Filter UND alle anderen Filter; Zustand in der Adresse; nur Namen aus dem Index. Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import { EMPTY_FILTERS, activeFilterCount, filterTitles, toggleFilter, type FilterState } from '../web/src/lib/filters.ts'
import { baueAuswahl, kurzeTitelzeile, passtSprecher, sprecherVorschlaege, type SprecherEintrag } from '../web/src/lib/sprecher-auswahl.ts'
import { buildHash, parseHash } from '../web/src/lib/router.ts'
import { kalenderBasis } from '../web/src/lib/kalender-filter.ts'
import type { Title } from '../shared/types.ts'
import type { Dataset } from '../web/src/lib/data.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nSprecher-Filter: Verknüpfung')
const ids: Record<string, number[]> = { Anna: [1, 2, 3], Ben: [2, 4], Clara: [3, 4, 5] }
const von = (n: string) => ids[n]
const sichtbar = (a: ReturnType<typeof baueAuswahl>) => [1, 2, 3, 4, 5, 6].filter((id) => (a ? passtSprecher(id, a) : true))
pruefe('ohne Sprecher gibt es keine Einschränkung', baueAuswahl([], [], von) === undefined)
pruefe('„mit" ist ODER: Anna oder Ben', sichtbar(baueAuswahl(['Anna', 'Ben'], [], von)).join() === '1,2,3,4')
pruefe('„ohne" ist UND: weder Anna noch Ben', sichtbar(baueAuswahl([], ['Anna', 'Ben'], von)).join() === '5,6')
pruefe('beides zusammen: (Anna ODER Clara), aber ohne Ben', sichtbar(baueAuswahl(['Anna', 'Clara'], ['Ben'], von)).join() === '1,3,5')
pruefe('ein noch nicht geladener Name zeigt nichts statt alles', sichtbar(baueAuswahl(['Anna'], ['Fehlt'], (n) => (n === 'Fehlt' ? undefined : von(n)))).length === 0)
pruefe('ein Name ohne Titel findet als „mit" nichts, schließt als „ohne" nichts aus',
  sichtbar(baueAuswahl(['Niemand'], [], () => [])).length === 0 && sichtbar(baueAuswahl([], ['Niemand'], () => [])).length === 6)

console.log('\nSprecher-Filter: UND mit allen anderen Filtern')
const titel = (id: number, genres: string[]) => ({ id, genres, keywords: [], streams: [], dubConfidence: 'high', titleDe: `T${id}` }) as unknown as Title
const alle = [titel(1, ['Action']), titel(2, ['Comedy']), titel(3, ['Action'])]
const data = { releasesByTitle: new Map(), titleById: new Map(), releases: [], events: [] } as unknown as Dataset
const f: FilterState = { ...EMPTY_FILTERS, genres: ['Action'] }
const gefunden = filterTitles(alle, data, f, '2026-10-09', new Set(), undefined, undefined, baueAuswahl(['Anna'], [], von)).map((t) => t.id)
pruefe('Sprecher Anna (1, 2, 3) und Genre Action (1, 3) ergibt 1, 3', gefunden.join() === '1,3', gefunden)
const ohneSprecher = filterTitles(alle, data, f, '2026-10-09', new Set()).map((t) => t.id)
pruefe('ohne Sprecher-Auswahl bleibt der Filter unverändert', ohneSprecher.join() === '1,3', ohneSprecher)

console.log('\nSprecher-Filter: Zähler und Adresse')
const mitZwei = toggleFilter(toggleFilter(EMPTY_FILTERS, 'sprecher', 'Anna Beispiel', 'include'), 'sprecher', 'Ben Muster', 'exclude')
pruefe('der Filter-Zähler zählt mit und ohne', activeFilterCount(mitZwei) === 2, activeFilterCount(mitZwei))
pruefe('Umschalten räumt die andere Seite auf', toggleFilter(mitZwei, 'sprecher', 'Anna Beispiel', 'exclude').sprecher.length === 0)
const hash = buildHash({ view: 'datenbank', date: '2026-10-09', filters: mitZwei })
pruefe('Adresse: mit = sp, ohne = xsp', /sp=Anna(\+|%20)Beispiel/.test(hash) && /xsp=Ben(\+|%20)Muster/.test(hash), hash)
const zurueck = parseHash(hash).filters
pruefe('Adresse: Hin und zurück gibt dieselben Sprecher', zurueck.sprecher.join() === 'Anna Beispiel' && zurueck.excluded.sprecher.join() === 'Ben Muster', zurueck)
pruefe('Kalender: Woche und Monat schreiben und teilen keine Sprecher', !/sp=/.test(buildHash({ view: 'woche', date: '2026-10-09', filters: mitZwei })) && kalenderBasis(mitZwei).sprecher.length === 0)

console.log('\nSprecher-Filter: Vorschläge')
const index: SprecherEintrag[] = [['Annemarie Test', 3, 'a'], ['Marc Jacobs', 5, 'm'], ['Marie Ähnlich', 2, 'm'], ['Zoë Müller', 1, 'z']]
const v = (q: string, g: string[] = []) => sprecherVorschlaege(index, q, new Set(g), 8).treffer.map((e) => e[0])
pruefe('Wortanfang vor Treffer mitten im Wort', v('mar').join() === 'Marc Jacobs,Marie Ähnlich,Annemarie Test', v('mar'))
pruefe('Umlaute und Akzente werden abgelegt', v('zoe muller').join() === 'Zoë Müller' && v('ahnlich').join() === 'Marie Ähnlich')
pruefe('Gewählte werden nicht noch einmal vorgeschlagen', v('mar', ['Marc Jacobs']).indexOf('Marc Jacobs') < 0)
pruefe('nur eingetragene Namen: Unbekanntes bringt nichts', v('xyz').length === 0)
pruefe('Obergrenze meldet den Rest', sprecherVorschlaege(index, 'a', new Set(), 2).mehr === 1)
pruefe('Titelzeile: drei, Rest als Zahl', kurzeTitelzeile(['A', 'B', 'C', 'D', 'E']) === 'A, B, C … + 2' && kurzeTitelzeile(['A', 'B']) === 'A, B')

console.log('\nSprecher-Filter: Bau und Oberfläche')
const quelle = readFileSync('web/src/components/SprecherFilter.tsx', 'utf8')
pruefe('Index und Gruppen kommen aus eigenen Dateien, nicht aus titles.json', !/titles\.json/.test(readFileSync('web/src/lib/sprecher.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')))
pruefe('die Eingabe geht nie in eine Adresse (nur feste Dateien)', !/fetch\(|loadJson/.test(quelle))
pruefe('der Aufklapper wählt nicht aus (eigener Knopf neben der Option)', /aria-expanded=\{p\.aufgeklappt\}/.test(quelle) && /onClick=\{p\.auf\}/.test(quelle) && /onClick=\{p\.waehlen\}/.test(quelle))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nSprecher-Filter: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
