/**
 * Zusicherung: Eine einzelne Crunchyroll-Kachel „(Deutsch)“ mit der letzten Folge der Staffel ist ein Komplettabwurf
 * (Snowball Earth, 12.10.2026), kein Wochentakt mit zwölf zurückgerechneten Terminen. Gegenfälle: laufende Serien,
 * geratene Folgenzahl, Doppelfolge. Aufruf: `npm run check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { KATALOG_MIN_FOLGEN } from '../shared/katalog-release.ts'
import { ergaenzeCrSimuldubs } from './bau/06-cr-simuldubs.ts'
import { istKomplettabwurf, wandleKomplettabwuerfeUm } from './bau/10-komplettabwurf.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = { id: 196144, titleEn: 'SNOWBALL EARTH', episodes: 13, jpYear: 2026, format: 'TV', streams: [] } as unknown as Title

/** Baut den Release, wie die Phase 06 ihn aus einem Kalender-Slot baut: `beobachtet` = gesehene Folgen mit Tag. */
function bauRelease(beobachtet: { episode: number; date: string }[], episodes = 13): Release[] {
  const slot = {
    time: '17:30',
    weekday: 0,
    dates: beobachtet.map((b) => b.date),
    rawTitle: 'SNOWBALL EARTH Season 1 (Deutsch)',
    seriesId: 'GT00371869',
    seriesUrl: 'https://www.crunchyroll.com/de/series/GT00371869/snowball-earth',
    observations: beobachtet,
    earliest: beobachtet[0],
    weeklyConfirmed: false,
  }
  const releases: Release[] = []
  ergaenzeCrSimuldubs({
    crunchyroll: { german: { 'snowball earth s1': slot } },
    usedCrKeys: new Set<string>(),
    titleForCalendarName: () => ({ ...titel, episodes, streams: [] }) as Title,
    titleFromSeries: () => undefined,
    titelAusKatalog: () => undefined,
    seenSlugs: new Set<string>(),
    releases,
    anisearchEpisodes: () => undefined,
    crKalenderBis: undefined,
    unverified: [],
  } as unknown as Parameters<typeof ergaenzeCrSimuldubs>[0])
  wandleKomplettabwuerfeUm(releases)
  return releases
}

function fall(): void {
  console.log('\nKomplettabwurf (Phase 06):')
  const [snow] = bauRelease([{ episode: 13, date: '2026-10-12' }])
  pruefe('Folge 13/13 als einzige Kachel: Batch am Tag der Kachel', snow?.releaseType === 'batch' && snow.schedule.firstEpisodeDate === '2026-10-12', snow)
  pruefe('… mit belegter Folgenzahl und Uhrzeit, ohne Schätzung', snow?.schedule.episodeCount === 13 && snow.schedule.time === '17:30' && !snow.schedule.estimated, snow?.schedule)
  const termine = snow ? expandEvents(snow) : []
  pruefe('… genau ein Termin ohne Folgennummer (keine zwölf zurückgerechneten)', termine.length === 1 && termine[0]!.episode === undefined, termine.length)
}

function gegenfaelle(): void {
  console.log('\nGegenfälle (bleiben Wochentakt):')
  const wochen = (r: Release[]) => r[0]?.releaseType === 'weekly'
  pruefe('Folge 1 als einzige Kachel (Serie startet)', wochen(bauRelease([{ episode: 1, date: '2026-10-12' }])))
  pruefe('Folge 12/13 als einzige Kachel (nicht die letzte)', wochen(bauRelease([{ episode: 12, date: '2026-10-12' }])))
  pruefe(
    'Folge 12 und 13 an zwei Wochen gesehen (Wochentakt belegt)',
    wochen(bauRelease([{ episode: 12, date: '2026-10-05' }, { episode: 13, date: '2026-10-12' }])),
  )
  const geraten = bauRelease([{ episode: 13, date: '2026-10-12' }], 0)
  pruefe('Folgenzahl nur geraten (AniList kennt keine): nie ein Komplettabwurf', geraten[0]?.releaseType === 'weekly', geraten[0]?.schedule)
  const doppel = { releaseType: 'weekly', platform: 'crunchyroll', schedule: { estimated: true, episodeCount: 2, observed: { 2: '2026-10-12' } } } as unknown as Release
  pruefe(`unter ${KATALOG_MIN_FOLGEN} Folgen: Doppelfolge, kein Katalog-Release`, !istKomplettabwurf(doppel))
  const andere = { ...doppel, platform: 'netflix', schedule: { estimated: true, episodeCount: 13, observed: { 13: '2026-10-12' } } } as unknown as Release
  pruefe('nur Crunchyroll', !istKomplettabwurf(andere))
  const alleTage = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, '2026-07-15']))
  const katalogNachgetragen = { ...doppel, schedule: { estimated: true, episodeCount: 12, observed: alleTage } } as unknown as Release
  pruefe('zwölf belegte Folgentage (der Katalog trug sie nach, The Beginning After the End): bleibt ein Wochen-Release', !istKomplettabwurf(katalogNachgetragen))
  const belegt = { ...andere, platform: 'crunchyroll', schedule: { episodeCount: 13, observed: { 13: '2026-10-12' } } } as unknown as Release
  pruefe('ein belegter (nicht zurückgerechneter) Start bleibt unangetastet', !istKomplettabwurf(belegt))
}

fall()
gegenfaelle()
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
