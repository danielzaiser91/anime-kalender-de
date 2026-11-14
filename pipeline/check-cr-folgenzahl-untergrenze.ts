/**
 * Zusicherung: Die Untergrenze der Folgenzahl eines automatisch aufgenommenen Crunchyroll-Simuldubs ist die zuletzt
 * gesehene Folge, nicht eine mehr. Sonst wird aus einer fest genannten Staffellänge (aniSearch: 3) eine geratene (≈ 4)
 * mit einer erfundenen Folge. Aufruf: `npm run check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { ergaenzeCrSimuldubs } from './bau/06-cr-simuldubs.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Release aus einem Kalender-Slot ohne AniList-Folgenzahl; aniSearch nennt `anisearch`. */
function bau(beobachtet: { episode?: number; date: string }[], anisearch: { count: number; estimated: boolean } | undefined): Release['schedule'] | undefined {
  const slot = {
    time: '17:30',
    weekday: 0,
    dates: beobachtet.map((b) => b.date),
    rawTitle: 'Probe (Deutsch)',
    seriesId: 'GPROBE',
    seriesUrl: 'https://www.crunchyroll.com/de/series/GPROBE/probe',
    observations: beobachtet,
    earliest: beobachtet[0],
    weeklyConfirmed: false,
  }
  const releases: Release[] = []
  ergaenzeCrSimuldubs({
    crunchyroll: { german: { probe: slot } },
    usedCrKeys: new Set<string>(),
    titleForCalendarName: () => ({ id: 1, titleEn: 'Probe', jpYear: 2026, format: 'TV', streams: [] }) as unknown as Title,
    titleFromSeries: () => undefined,
    titelAusKatalog: () => undefined,
    seenSlugs: new Set<string>(),
    releases,
    anisearchEpisodes: () => anisearch,
    crKalenderBis: undefined,
    unverified: [],
  } as unknown as Parameters<typeof ergaenzeCrSimuldubs>[0])
  return releases[0]?.schedule
}

const drei = [{ episode: 1, date: '2026-10-05' }, { episode: 2, date: '2026-10-12' }, { episode: 3, date: '2026-10-19' }]
console.log('\nFolgenzahl eines Crunchyroll-Simuldubs ohne AniList-Zahl:')
const fest = bau(drei, { count: 3, estimated: false })
pruefe('aniSearch nennt 3, Folgen 1–3 gesehen: 3, nicht geraten', fest?.episodeCount === 3 && !fest.episodeCountAssumed, fest)
const ohne = bau(drei, undefined)
pruefe('ohne aniSearch: zwölf als übliche Länge, geraten', ohne?.episodeCount === 12 && ohne.episodeCountAssumed === true, ohne)
const mehr = bau(drei, { count: 2, estimated: false })
pruefe('aniSearch nennt 2, Folge 3 gesehen: mindestens 3, geraten', mehr?.episodeCount === 3 && mehr.episodeCountAssumed === true, mehr)

/* Ohne Folgennummer zählt die früheste gesehene Folge als 1: drei Tage belegen Folge 3. */
const ohneNummer = ['2026-10-05', '2026-10-12', '2026-10-19'].map((date) => ({ date }))
const ohneFest = bau(ohneNummer, { count: 3, estimated: false })
pruefe('ohne Folgennummer, drei Tage, aniSearch nennt 3: 3, nicht geraten', ohneFest?.episodeCount === 3 && !ohneFest.episodeCountAssumed, ohneFest)
const ohneKurz = bau(ohneNummer, { count: 2, estimated: false })
pruefe('ohne Folgennummer, drei Tage, aniSearch nennt 2: mindestens 3, geraten', ohneKurz?.episodeCount === 3 && ohneKurz.episodeCountAssumed === true, ohneKurz)

/* Fortsetzung ab Folge 13: die Untergrenze ist Folge 15, nicht drei Folgen. */
const ab13 = [13, 14, 15].map((episode, i) => ({ episode, date: ['2026-10-05', '2026-10-12', '2026-10-19'][i]! }))
const fortFest = bau(ab13, { count: 15, estimated: false })
pruefe('Folgen 13–15 gesehen, aniSearch nennt 15: 15, nicht geraten', fortFest?.episodeCount === 15 && !fortFest.episodeCountAssumed, fortFest)
const fortKurz = bau(ab13, { count: 14, estimated: false })
pruefe('Folgen 13–15 gesehen, aniSearch nennt 14: Zahl widerlegt, Durchzählung ab Folge 13 mit 3 Folgen', fortKurz?.firstEpisodeNumber === 13 && fortKurz.episodeCount === 3, fortKurz)

if (verletzt) {
  console.error(`${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
