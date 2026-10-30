/**
 * Zusicherung zur Verdrahtung von Phase 06 (`ergaenzeCrReleases`, von `build.ts` aufgerufen): Ein automatisch ergänzter
 * Crunchyroll-Release trägt die Vermerke aus `data/termine-verpasst.json` (Re:ZERO Staffel 4, 16.10.2026). Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import type { Release, Title } from '../shared/types.ts'
import { addDays } from '../shared/time.ts'
import { ergaenzeCrReleases } from './bau/06-cr-release-vermerke.ts'
import { verpassteTermine } from './bau/grundlagen.ts'

const vermerk = verpassteTermine.find((v) => v.slug.startsWith('cr-') && v.episode != null)
if (!vermerk) {
  console.error('check-verpasst-verdrahtung: kein Vermerk eines cr-Slugs in data/termine-verpasst.json — Prüfung braucht einen')
  process.exit(1)
}
const erwartet = vermerk.erwartetAm.slice(0, 10)
const beobachtet = [-14, -7].map((tage, i) => ({ episode: (vermerk.episode as number) - 2 + i, date: addDays(erwartet, tage) }))
const slot = {
  time: '17:30',
  weekday: 0,
  dates: beobachtet.map((b) => b.date),
  rawTitle: 'X (Deutsch)',
  seriesId: vermerk.slug.slice(3),
  seriesUrl: `https://www.crunchyroll.com/de/series/${vermerk.slug.slice(3)}/x`,
  observations: beobachtet,
  earliest: beobachtet[0],
  weeklyConfirmed: false,
}
const titel = { id: 1, titleEn: 'X', episodes: 25, jpYear: Number(erwartet.slice(0, 4)), format: 'TV', streams: [] } as unknown as Title
const releases: Release[] = []
ergaenzeCrReleases({
  crunchyroll: { german: { x: slot } },
  usedCrKeys: new Set<string>(),
  titleForCalendarName: () => titel,
  titleFromSeries: () => undefined,
  titelAusKatalog: () => undefined,
  seenSlugs: new Set<string>(),
  releases,
  anisearchEpisodes: () => undefined,
  crKalenderBis: undefined,
  unverified: [],
} as unknown as Parameters<typeof ergaenzeCrReleases>[0])

const r = releases.find((x) => x.slug === vermerk.slug)
if (!r?.schedule.verpasst?.[vermerk.episode as number]) {
  console.error(`check-verpasst-verdrahtung: Release ${vermerk.slug} trägt den Vermerk zu Folge ${vermerk.episode} nicht`, JSON.stringify(r?.schedule))
  process.exit(1)
}
/* Der Aufruf in der Phasenfolge selbst: eine Phase, die dort fehlt oder abgeschaltet ist, fängt sonst nur der Bau-Vergleich. */
const bau = readFileSync(new URL('./bau/phasenfolge.ts', import.meta.url), 'utf8')
if (!/^ {2}ergaenzeCrReleases\(\{ \.\.\.cr, /m.test(bau)) {
  console.error('check-verpasst-verdrahtung: phasenfolge.ts ruft ergaenzeCrReleases nicht unbedingt auf')
  process.exit(1)
}
console.log('check-verpasst-verdrahtung: alles grün')
