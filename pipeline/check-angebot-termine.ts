/**
 * Zusicherung: ein „Im Angebot seit“-Termin behauptet in Kalenderdatei und Newsletter nie „erschienen am“ (CLAUDE.md), und jedes späte Angebots-Release
 * bekommt seinen Termin (Daniels Entscheidung vom 27.08.2026, die der Bau bis 13.10.2026 nie umsetzte).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-angebot-termine.ts`
 */
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { fuegeTermineEin, kernMitTerminTiteln } from './bau/13-7-angebot-termine.ts'
import { digestMail } from '../worker/src/templates.ts'
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
  pruefe('Titel der Kalenderdatei sagt „neu bei <Anbieter>“', titel === 'Fairy Tail (neu bei Crunchyroll)', titel)
  pruefe('Beschreibung nennt den Unterschied zum Erscheinungstag', text.includes(IM_ANGEBOT_HINWEIS), text)
  pruefe('weder Titel noch Beschreibung behaupten „erschienen am“', !/erschienen am|Start:/i.test(`${titel}\n${text.replace(IM_ANGEBOT_HINWEIS, '')}`), text)
  const [premiere] = expandEvents(katalog({ dateMeaning: undefined }))
  pruefe('ein Termin ohne Katalogdatum bleibt unverändert', eventSummary(premiere!) === 'Fairy Tail' && !eventDescription(premiere!, {}).includes(IM_ANGEBOT_HINWEIS))
  const ics = buildIcs([ev!]).split('\r\n ').join('')
  pruefe('die .ics-Datei trägt Titel und Hinweis', ics.includes('SUMMARY:Fairy Tail (neu bei Crunchyroll)') && ics.includes('Im Angebot seit diesem Tag'), ics)
}

console.log('\nNeu bei <Anbieter> (Kalenderdatei und Newsletter folgen dem Anbieter des Termins):')
{
  const [adn] = expandEvents(katalog({ platform: 'adn' }))
  pruefe('Kalenderdatei: ADN-Termin heißt „neu bei ADN“', eventSummary(adn!) === 'Fairy Tail (neu bei ADN)', eventSummary(adn!))
  const [tv] = expandEvents(katalog({ platform: 'tv', sender: 'RTL Zwei' } as Partial<Release>))
  pruefe('Kalenderdatei: bei TV der Sender', eventSummary(tv!) === 'Fairy Tail (neu bei RTL Zwei)', eventSummary(tv!))
}

/** HTML der Mail für einen Termin; `link` setzt den Direktlink zum Anbieter (sonst steht der Name als Text). */
function mailHtml(ev: ReleaseEvent, link?: string): string {
  const links = link ? new Map([[ev.releaseSlug, { platformUrl: link }]]) : undefined
  return digestMail([ev], 'daily', 'https://anime-kalender.de/', 'https://x/u', { links }).html
}

console.log('\nNeu bei <Anbieter> (Newsletter: Marke und Link sind eins, kein zweites „ansehen“):')
{
  const [adn] = expandEvents(katalog({ platform: 'adn' }))
  // Nur die TV-Premiere läuft durch dieselbe Zeile wie Streaming-Termine (TV-Wiederholungen stehen in einer eigenen Liste).
  const [tv] = expandEvents(katalog({ platform: 'tv', sender: 'RTL Zwei' } as Partial<Release>)).map((e) => ({ ...e, tvPremiere: true }))
  const [ohne] = expandEvents(katalog({ platform: 'adn', dateMeaning: undefined }))
  const ohneLink = mailHtml(adn!)
  pruefe('ohne Link: „Neu bei ADN“ als Text, einmal', ohneLink.split('Neu bei ADN').length === 2 && !/im Angebot|neu bei/.test(ohneLink), ohneLink.match(/.{40}Neu bei.{20}/)?.[0])
  const mitLink = mailHtml(adn!, 'https://adn.example/x')
  pruefe('mit Link: die Marke ist der Link „Neu bei ADN ›“', mitLink.includes('>Neu bei ADN &rsaquo;</a>'), mitLink.match(/.{60}Neu bei.{30}/)?.[0])
  pruefe('mit Link: kein zweites „ADN ansehen“ daneben', !mitLink.includes('ansehen'), mitLink.match(/.{40}ansehen.{20}/)?.[0])
  pruefe('Crunchyroll: die Marke folgt dem Anbieter', mailHtml(expandEvents(katalog())[0]!).includes('Neu bei Crunchyroll'))
  const tvHtml = mailHtml(tv!, 'https://tv.example/x')
  pruefe('TV: die Marke trägt den Sender', tvHtml.includes('>Neu bei RTL Zwei &rsaquo;</a>'), tvHtml.match(/.{40}Neu bei.{30}/)?.[0])
  pruefe('ohne Katalogdatum bleibt es bei „ADN ansehen ›“', mailHtml(ohne!, 'https://adn.example/x').includes('>ADN ansehen &rsaquo;</a>') && !mailHtml(ohne!).includes('Neu bei ADN'))
}

console.log('\nIm Angebot seit (Bau: Termine nachtragen):')
{
  const vorhanden = { id: 'a@2026-05-01', releaseSlug: 'a', titleId: 9, date: '2026-05-01', releaseType: 'weekly', platform: 'netflix', name: 'A' } as ReleaseEvent
  const fruehes = katalog({ slug: 'motn-2-crunchyroll', titleId: 2, schedule: { firstEpisodeDate: '2026-01-08', episodeCount: 1, lastEpisodeDate: '2026-01-08' } })
  const spaetes = katalog({ slug: 'anisearch-3-primevideo', titleId: 3, platform: 'primevideo', schedule: { firstEpisodeDate: '2026-07-04', episodeCount: 12, lastEpisodeDate: '2026-07-04' } })
  const events = [vorhanden]
  const neu = fuegeTermineEin(events, [spaetes, fruehes])
  pruefe('jedes späte Angebots-Release bekommt genau einen Termin', neu.length === 2 && neu.every((e) => e.imAngebot === true), neu)
  pruefe('die Termine stehen in der Reihenfolge des Tages (vor und nach dem vorhandenen)', events.map((e) => e.releaseSlug).join() === 'motn-2-crunchyroll,a,anisearch-3-primevideo', events.map((e) => e.releaseSlug))
  pruefe('Termintag ist der Katalogtag, die Folgenzahl die des Titels', events[2]?.date === '2026-07-04' && events[2]?.episodeCount === 12, events[2])
  pruefe('ohne neue Releases bleibt die Liste, wie sie war', fuegeTermineEin(events, []).length === 0 && events.length === 3)

  const titel = (id: number) => ({ id, titleEn: `T${id}` }) as unknown as Title
  const kern = [titel(9), titel(2)]
  const neuerKern = kernMitTerminTiteln(kern, [titel(2), titel(3), titel(4), titel(9)], neu)
  pruefe('der Kern bekommt nur den Titel mit neuem Termin, der fehlte', neuerKern.map((t) => t.id).join() === '9,2,3', neuerKern.map((t) => t.id))
  pruefe('was im Kern stand, bleibt dasselbe Objekt', neuerKern[0] === kern[0] && neuerKern[1] === kern[1])
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nIm Angebot seit: alle Zusicherungen erfüllt.')
