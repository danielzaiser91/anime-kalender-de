/**
 * Zusicherungen (03.11.2026): Beim Öffnen eines Titels trägt der neue Verlaufseintrag den Namen des Titels, nicht den Grundtitel
 * (Chrome schlug „rayearth“ nicht vor: die Zeile mit `t=` behielt den Grundtitel), und die Zeile darunter behält ihren Titel.
 * Der echte Schreibweg `schreiber(...).navigate` läuft mit einem Verlauf, der Chrome nachbildet: ein neuer Eintrag übernimmt den
 * Tab-Titel dieses Moments, ein späterer `document.title` gehört dem aktuellen Eintrag. Aufruf: `npm run check:logic`.
 */
import { EMPTY_FILTERS } from '../web/src/lib/filters.ts'
import { schreiber, setzeTabTitelQuelle, type AppRoute, type Umgebung } from '../web/src/lib/router.ts'
import { GRUNDTITEL, tabTitelFuerId } from '../web/src/components/detail/titelwechsel.ts'
import type { Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* Chrome-Modell: `eintraege` sind die Titel der Verlaufszeilen, der Tab-Titel schreibt in die aktuelle. */
function bauUmgebung(state: unknown = null, start = 'Liste'): { umg: Umgebung; eintraege: string[]; art: string[] } {
  const eintraege = [start]
  const art: string[] = []
  const neuerEintrag = (a: string) => void (art.push(a), eintraege.push(eintraege[eintraege.length - 1]!))
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      get title() {
        return eintraege[eintraege.length - 1]!
      },
      set title(t: string) {
        eintraege[eintraege.length - 1] = t
      },
    },
  })
  const ort = {
    pathname: '/',
    search: '',
    get hash() {
      return '#/woche'
    },
    set hash(_h: string) {
      neuerEintrag('hash')
    },
  }
  const verlauf = {
    state,
    replaceState: () => void art.push('ersetzt'),
    pushState: () => neuerEintrag('push'),
    back: () => void art.push('zurueck'),
  }
  return { umg: { ort, verlauf, base: '' }, eintraege, art }
}
const route = (titel?: number): AppRoute => ({ view: 'woche', date: '2026-11-03', title: titel, filters: { ...EMPTY_FILTERS } }) as AppRoute
const namen: Record<number, string> = { 16013: 'Magic Knight Rayearth: Stand der deutschen Synchro', 5: 'Zweiter Titel' }
const quelle = (id: number) => namen[id]
const navigate = (u: Umgebung, von: AppRoute) => schreiber(von, () => undefined, () => u).navigate

console.log('\nNeuer Verlaufseintrag trägt den Titelnamen:')
setzeTabTitelQuelle(quelle)
let u = bauUmgebung(null, GRUNDTITEL)
navigate(u.umg, route())({ title: 16013 })
pruefe('Panel öffnen: pushState-Zeile heißt wie der Titel, die Liste darunter behält den Grundtitel', u.art[0] === 'push' && JSON.stringify(u.eintraege) === JSON.stringify([GRUNDTITEL, namen[16013]]), [u.art, u.eintraege])

u = bauUmgebung({ panel: true }, namen[16013])
navigate(u.umg, route(16013))({ title: 5, disc: undefined })
pruefe('Titelwechsel im offenen Panel: Hash-Zeile heißt wie der neue Titel, die alte behält ihren', u.art[0] === 'hash' && JSON.stringify(u.eintraege) === JSON.stringify([namen[16013], namen[5]]), [u.art, u.eintraege])

u = bauUmgebung({ panel: true }, 'Tab bleibt')
navigate(u.umg, route(16013))({ title: undefined })
pruefe('Schließen: der Tab wird nicht angefasst', u.eintraege[0] === 'Tab bleibt' && u.art[0] === 'zurueck', [u.art, u.eintraege])

u = bauUmgebung(null, GRUNDTITEL)
navigate(u.umg, route())({ title: 999 })
pruefe('Titel ohne bekannten Namen: Tab unverändert', JSON.stringify(u.eintraege) === JSON.stringify([GRUNDTITEL, GRUNDTITEL]), u.eintraege)

u = bauUmgebung(null, 'Nur Ansicht')
navigate(u.umg, route(16013))({ view: 'datenbank' })
pruefe('Ansichtswechsel mit offenem Titel: Tab unverändert', u.eintraege[u.eintraege.length - 1] === 'Nur Ansicht', u.eintraege)

setzeTabTitelQuelle(undefined)
u = bauUmgebung(null, GRUNDTITEL)
navigate(u.umg, route())({ title: 16013 })
pruefe('ohne Quelle: Tab unverändert (kein Absturz)', u.eintraege[1] === GRUNDTITEL, u.eintraege)

console.log('\ntabTitelFuerId (auch Titel ohne Teilen-Seite):')
const katalog = { id: 16013, titleDe: 'Magic Knight Rayearth', ohneSynchro: true, streams: [] } as unknown as Title
const daten = { titleById: new Map([[16013, katalog]]), releasesByTitle: new Map() }
const ist = tabTitelFuerId(daten as never, 16013)
pruefe('Name steht im Tab-Titel', typeof ist === 'string' && ist.includes('Rayearth'), ist)
pruefe('unbekannte Kennung: nichts', tabTitelFuerId(daten as never, 7) === undefined)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nTitel nach Eintrag: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
