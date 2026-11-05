/**
 * Zusicherungen zum Auge an „Im Fernsehen" / „Im Handel" (05.11.2026): Welche Tage den Kopf behalten und was ein Tipp schaltet.
 * Erfundene Daten.
 */
import type { ReleaseEvent } from '../shared/types.ts'
import { bereicheJeTag } from '../web/src/components/WeekView.tsx'
import { schnellSetzen, schnellZustand } from '../web/src/lib/schnellfilter.ts'
import { EMPTY_FILTERS } from '../web/src/lib/filters.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}`)
  }
}

function termin(date: string, extra: Partial<ReleaseEvent>): ReleaseEvent {
  return { id: `${date}${JSON.stringify(extra)}`, date, titleId: 900001, ...extra } as ReleaseEvent
}

const MONTAG = '2026-11-02'
const roh = bereicheJeTag(
  [
    termin('2026-11-03', { platform: 'tv' }),
    termin('2026-11-04', { platform: 'crunchyroll', releaseType: 'disc' }),
    termin('2026-11-05', { platform: 'netflix' }),
    termin('2026-11-08', { platform: 'tv' }),
    termin('2026-11-09', { platform: 'tv' }),
    termin('2026-11-01', { platform: 'tv' }),
  ],
  MONTAG,
)
pruefe('TV-Tag hat TV, kein Disc', roh.get('2026-11-03')?.tv === true && roh.get('2026-11-03')?.disc === false)
pruefe('Disc-Tag hat Disc, kein TV', roh.get('2026-11-04')?.disc === true && roh.get('2026-11-04')?.tv === false)
pruefe('Streaming-Tag hat keinen Bereich', roh.get('2026-11-05')?.tv === false && roh.get('2026-11-05')?.disc === false)
pruefe('Sonntag (letzter Tag) zählt', roh.get('2026-11-08')?.tv === true)
pruefe('Tag vor und nach der Woche zählt nicht', !roh.has('2026-11-01') && !roh.has('2026-11-09'))

/* Auge zu = ausgeblendet (`nein`), nächster Tipp = wieder an; für Disc im Filter, für TV im Schalter der Ansicht. */
const zu = schnellSetzen(EMPTY_FILTERS, 'disc', 'nein', true)
pruefe('Disc-Auge zu: Filter blendet Disc aus', schnellZustand(zu.filters, 'disc') === 'nein')
pruefe('Disc-Auge wieder offen', schnellZustand(schnellSetzen(zu.filters, 'disc', 'nein', true).filters, 'disc') === undefined)
const tvZu = schnellSetzen(EMPTY_FILTERS, 'tv', 'nein', true)
pruefe('TV-Auge zu: Schalter aus', tvZu.tvAn === false)
pruefe('TV-Auge wieder offen: Schalter an', schnellSetzen(tvZu.filters, 'tv', 'nein', false).tvAn === true)

if (fehler) process.exit(1)
console.log('Bereich-Auge: 9 Zusicherungen halten.')
