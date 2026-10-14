/**
 * Eine Disc nimmt dem Titel das „Im Angebot seit“ nicht (13.10.2026, Fall Pokémon „Die Anfänge“): `13-3-angebot-seit.ts` und
 * `13-7-erstausgabe-angebot.ts` füllen nur Titel ohne Termin. Eine DVD-Box am 27.11.2026 sagt nichts darüber, seit wann Netflix
 * die Staffeln führt; jeder andere Termin (Streaming, TV, Kino) ersetzt das „Im Angebot seit“ weiterhin.
 */
import { ergaenzeErstausgabeAngebot } from './bau/13-7-erstausgabe-angebot.ts'
import { titelMitTermin } from './bau/titel-mit-termin.ts'
import type { Release, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const termin = (titleId: number, platform: string) => ({ slug: `${platform}-${titleId}`, titleId, platform }) as unknown as Release

const mit = titelMitTermin([termin(1, 'disc'), termin(2, 'netflix'), termin(3, 'tv'), termin(4, 'kino'), termin(4, 'disc')])
pruefe('Termine: ein Titel nur mit Disc zählt nicht als Titel mit Termin', !mit.has(1), [...mit])
pruefe('Termine: Streaming, TV und Kino zählen weiter', mit.has(2) && mit.has(3) && mit.has(4), [...mit])

const titel = (id: number) =>
  ({
    id,
    titleEn: `T${id}`,
    format: 'TV',
    episodes: 12,
    anisearchId: id + 100,
    streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true }],
    deErstausgabe: { von: '2026-07-04', publisher: 'Netflix, Inc.', synchro: true },
  }) as unknown as Title

const releases = [termin(1, 'disc'), termin(2, 'netflix')]
const neu = ergaenzeErstausgabeAngebot({ titles: [titel(1), titel(2)], releases })
pruefe('Erstausgabe: der Titel mit nur einer Disc bekommt sein „Im Angebot seit“', neu === 1 && releases.some((r) => r.titleId === 1 && r.dateMeaning === 'available-from'), releases.map((r) => r.slug))
pruefe('Erstausgabe: der Titel mit Streaming-Termin bekommt keines', !releases.some((r) => r.titleId === 2 && r.dateMeaning === 'available-from'))

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-angebot-seit-disc: alle Zusicherungen erfüllt.')
