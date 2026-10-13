/**
 * Zusicherung: `katalog` (Katalog-Release, Daniel 13.10.2026) steht nur an Terminen, deren ganze Staffel an einem Tag erscheint.
 * Fall und Gegenfall: Batch mit Erscheinungsdatum, ganze Staffel an einem Wochen-Tag; nie „im Angebot seit“, ein Special,
 * eine Doppelfolge, geratene Folgenzahl, Finale-Tag, ausgebliebener Termin. Aufruf: `npm run check:logic`.
 */
import type { Release, ReleaseEvent } from '../shared/types.ts'
import { KATALOG_MIN_FOLGEN, schreibeKatalogRelease } from '../shared/katalog-release.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const rel = (slug: string, o: Partial<Release> = {}): Release =>
  ({ slug, titleId: 1, name: slug, platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-18', episodeCount: 14 }, ...o }) as unknown as Release
const ev = (slug: string, episode: number | undefined, o: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `${slug}@${episode ?? 'alle'}`, releaseSlug: slug, titleId: 1, name: 'X', date: '2026-10-18', releaseType: 'weekly', platform: 'crunchyroll', episode, episodeCount: 14, ...o }) as unknown as ReleaseEvent
const katalog = (events: ReleaseEvent[], releases: Release[]): boolean[] => {
  schreibeKatalogRelease(events, releases)
  return events.map((e) => !!e.katalog)
}

function katalogRelease(): void {
  console.log('\nKatalog-Release — die ganze Staffel an einem Tag:')
  const batch = (n: number | undefined, o: Partial<Release> = {}) =>
    katalog([ev('b', undefined, { releaseType: 'batch', episodeCount: n })], [rel('b', { releaseType: 'batch', ...o })])[0]
  pruefe('Batch mit 13 Folgen und Erscheinungsdatum', batch(13) === true)
  pruefe('Gegenfall: Batch ohne Folgenzahl ist nur ein Starttermin aus einer Meldung', batch(undefined) === false)
  pruefe('Gegenfall „im Angebot seit“ (Katalogzugang) ist keiner', batch(13, { dateMeaning: 'available-from' }) === false)
  pruefe('Gegenfall: ein einzelnes Special', batch(1) === false)
  pruefe(`Gegenfall: unter ${KATALOG_MIN_FOLGEN} Folgen`, batch(KATALOG_MIN_FOLGEN - 1) === false)
  const alle = Array.from({ length: 12 }, (_, i) => ev('w', i + 1, { episodeCount: 12 }))
  const am = katalog(alle, [rel('w', { schedule: { firstEpisodeDate: '2026-10-18', episodeCount: 12 } as Release['schedule'] })])
  pruefe('Wochen-Release mit allen 12 Folgen an einem Tag (The Beginning After the End)', am.every(Boolean))
  const teil = Array.from({ length: 4 }, (_, i) => ev('w', 10 + i, { episodeCount: 13 }))
  pruefe('gegenprobe: Folge 10–13 am selben Tag (Finale-Tag) ist keiner', katalog(teil, [rel('w', { schedule: { firstEpisodeDate: '2026-10-18', episodeCount: 13 } as Release['schedule'] })]).every((k) => !k))
  const geraten = Array.from({ length: 12 }, (_, i) => ev('w', i + 1, { episodeCount: 12 }))
  const geratenR = rel('w', { schedule: { firstEpisodeDate: '2026-10-18', episodeCount: 12, episodeCountAssumed: true } as Release['schedule'] })
  pruefe('gegenprobe: geratene Folgenzahl macht keinen Katalog-Release', katalog(geraten, [geratenR]).every((k) => !k))
  const verpasst = [ev('w', 1, { episodeCount: 3 }), ev('w', 2, { episodeCount: 3 }), ev('w', 3, { episodeCount: 3, verpasst: { erwartetAm: '2026-10-18' } })]
  pruefe('gegenprobe: ein ausgebliebener Termin im Paket', katalog(verpasst, [rel('w', { schedule: { firstEpisodeDate: '2026-10-18', episodeCount: 3 } as Release['schedule'] })]).every((k) => !k))
}

katalogRelease()
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
