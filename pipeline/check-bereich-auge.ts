/**
 * Zusicherungen zum Auge an „Im Fernsehen" / „Im Handel" (05.11.2026): Was ein Tipp aufs Auge schaltet.
 * Erfundene Daten.
 */
import { schnellSetzen, schnellZustand } from '../web/src/lib/schnellfilter.ts'
import { EMPTY_FILTERS } from '../web/src/lib/filters.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}`)
  }
}

/* Auge zu = ausgeblendet (`nein`), nächster Tipp = wieder an; für Disc im Filter, für TV im Schalter der Ansicht. */
const zu = schnellSetzen(EMPTY_FILTERS, 'disc', 'nein', true)
pruefe('Disc-Auge zu: Filter blendet Disc aus', schnellZustand(zu.filters, 'disc') === 'nein')
pruefe('Disc-Auge wieder offen', schnellZustand(schnellSetzen(zu.filters, 'disc', 'nein', true).filters, 'disc') === undefined)
const tvZu = schnellSetzen(EMPTY_FILTERS, 'tv', 'nein', true)
pruefe('TV-Auge zu: Schalter aus', tvZu.tvAn === false)
pruefe('TV-Auge wieder offen: Schalter an', schnellSetzen(tvZu.filters, 'tv', 'nein', false).tvAn === true)

if (fehler) process.exit(1)
console.log('Bereich-Auge: 4 Zusicherungen halten.')
