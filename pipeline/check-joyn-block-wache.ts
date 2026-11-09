/**
 * Test der Wache `lib/joyn-block-wache.ts`: Ein automatischer, geschätzter Joyn-Block-Termin neben Joyn-Fenstern des Titels wird gemeldet.
 * Anlass Yaiba (09.11.2026): `auto-177476-joyn` (batch, 08.11., estimated) bei Fenstern ab 05.11. 18:50. Gegenfälle: Handtermin, Wochentakt,
 * Titel ohne Fenster, anderer Anbieter, belegtes Datum, fehlender Titel.
 * Aufruf: npx tsx pipeline/check-joyn-block-wache.ts
 */
import type { Release, Title } from '../shared/types.ts'
import { joynBlockTrotzFenster } from './lib/joyn-block-wache.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const release = (slug: string, titleId: number, aenderung: Record<string, unknown> = {}): Release =>
  ({
    slug,
    titleId,
    platform: 'joyn',
    releaseType: 'batch',
    automatisch: true,
    schedule: { firstEpisodeDate: '2026-11-08', estimated: true },
    ...aenderung,
  }) as unknown as Release
const titel = (id: number, platform: string, fenster: unknown[]): Title => ({ id, streams: [{ platform, fenster }] }) as unknown as Title
const FENSTER = [{ nr: 1, ab: '2026-11-05T18:50', ende: '2026-12-04T23:59' }]
const namen = (r: Release[], t: Title[]): string => joynBlockTrotzFenster(r, t).map((x) => x.slug).join()

const T = [titel(7, 'joyn', FENSTER), titel(8, 'joyn', []), titel(9, 'joyn', FENSTER)]
pruefe('Yaiba-Form: gemeldet', namen([release('auto-7-joyn', 7)], T) === 'auto-7-joyn')
pruefe('Titel ohne Fenster (neben Titeln mit Fenster): nicht gemeldet', namen([release('auto-8-joyn', 8)], T) === '')
pruefe('Handtermin (nicht automatisch): nicht gemeldet', namen([release('hand', 7, { automatisch: undefined })], T) === '')
pruefe('Wochentakt: nicht gemeldet', namen([release('w', 7, { releaseType: 'weekly' })], T) === '')
pruefe('belegtes Datum (nicht geschätzt): nicht gemeldet', namen([release('b', 7, { schedule: { firstEpisodeDate: '2026-11-08' } })], T) === '')
pruefe('anderer Anbieter: nicht gemeldet', namen([release('p', 7, { platform: 'primevideo' })], T) === '')
pruefe('Fenster nur bei anderem Anbieter: nicht gemeldet', namen([release('j', 7)], [titel(7, 'primevideo', FENSTER)]) === '')
pruefe('Titel fehlt: nicht gemeldet', namen([release('x', 99)], T) === '')
pruefe('zwei Titel mit Fenster, ein Block bei Titel 9 und einer bei 8: genau 9', namen([release('a', 9), release('h', 8)], T) === 'a')

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
