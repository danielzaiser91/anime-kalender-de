/**
 * Zusicherung: ein „Im Angebot seit“-Termin behauptet in Kalenderdatei und Newsletter nie „erschienen am“ (CLAUDE.md), und jedes späte Angebots-Release
 * bekommt seinen Termin (Daniels Entscheidung vom 27.08.2026, die der Bau bis 13.10.2026 nie umsetzte).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-angebot-termine.ts`
 */
import type { Release } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { IM_ANGEBOT_HINWEIS, buildIcs, eventDescription, eventSummary } from '../shared/ics.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const katalog = (o: Partial<Release> = {}): Release =>
  ({
    slug: 'motn-1-crunchyroll',
    titleId: 1,
    name: 'Fairy Tail',
    platform: 'crunchyroll',
    releaseType: 'batch',
    dateMeaning: 'available-from',
    schedule: { firstEpisodeDate: '2026-03-31', episodeCount: 175, lastEpisodeDate: '2026-03-31' },
    sources: ['https://www.movieofthenight.com/about/api'],
    ...o,
  }) as Release

console.log('\nIm Angebot seit (Termin):')
{
  const [ev] = expandEvents(katalog())
  pruefe('Katalogdatum: der Termin trägt „imAngebot“', ev?.imAngebot === true, ev)
  const [normal] = expandEvents(katalog({ dateMeaning: undefined }))
  pruefe('ohne dateMeaning (Premiere): keine Marke', normal?.imAngebot === undefined, normal)
}
{
  const [ev] = expandEvents(katalog())
  const titel = eventSummary(ev!)
  const text = eventDescription(ev!, {})
  pruefe('Titel der Kalenderdatei sagt „im Angebot“', titel === 'Fairy Tail (im Angebot)', titel)
  pruefe('Beschreibung nennt den Unterschied zum Erscheinungstag', text.includes(IM_ANGEBOT_HINWEIS), text)
  pruefe('weder Titel noch Beschreibung behaupten „erschienen am“', !/erschienen am|Start:/i.test(`${titel}\n${text.replace(IM_ANGEBOT_HINWEIS, '')}`), text)
  const [premiere] = expandEvents(katalog({ dateMeaning: undefined }))
  pruefe('ein Termin ohne Katalogdatum bleibt unverändert', eventSummary(premiere!) === 'Fairy Tail' && !eventDescription(premiere!, {}).includes(IM_ANGEBOT_HINWEIS))
  const ics = buildIcs([ev!]).split('\r\n ').join('')
  pruefe('die .ics-Datei trägt Titel und Hinweis', ics.includes('SUMMARY:Fairy Tail (im Angebot)') && ics.includes('Im Angebot seit diesem Tag'), ics)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nIm Angebot seit: alle Zusicherungen erfüllt.')
