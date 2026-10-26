/**
 * Zusicherung: **Die Bauphase 9 ruft `hebeFolgenzahlAufBeobachtung()` wirklich auf** (16.10.2026, Prüfer:
 * ein toter Aufruf `0 && …` blieb in `check:logic` grün). Fährt `pruefeSynchroJePlattform()` mit einem
 * erfundenen Release ohne Netz; läuft in `check:logic`, also in vor-commit und PR-CI.
 * Den vorigen Bestand und die Wurzel für die Prüflisten gibt der Test als Parameter vor: kein Lesen von
 * `public/data`, kein Schreiben nach `data/`.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release } from '../shared/types.ts'
import { pruefeSynchroJePlattform } from './bau/09-synchro.ts'
import { PRUEFLISTE } from './bau/09-7-cr-teilseiten.ts'
import { PRIME_PRUEFLISTE } from './bau/09-7-prime-teilseiten.ts'

const release = {
  slug: 'villainess',
  titleId: 188139,
  name: 'Though I Am an Inept Villainess',
  platform: 'crunchyroll',
  releaseType: 'weekly',
  sources: ['https://www.crunchyroll.com/de/simulcastcalendar'],
  schedule: {
    firstEpisodeDate: '2026-08-02',
    time: '17:45',
    episodeCount: 2,
    observed: { 1: '2026-08-02', 2: '2026-08-09', 3: '2026-08-16' },
  },
} as unknown as Release

const schreibWurzel = mkdtempSync(join(tmpdir(), 'folge-ueber-anzahl-'))
try {
  pruefeSynchroJePlattform({
    releases: [release],
    titles: new Map(),
    crBySeriesId: new Map(),
    tmdbMehrdeutig: new Set(),
    tmdbTitles: {},
    tvJeTmdb: new Set(),
    toteAdressen: new Set(),
    netflixOhneKennung: 0,
    anisearch: {},
    verweiseEntfernt: [],
    katalogEintraege: [],
    adnKatalog: { scrapedAt: '', shows: [] } as never,
    adnVerweiseErgaenzt: 0,
    vorherTitles: [],
    schreibWurzel,
  })
  const fehlt = [PRUEFLISTE, PRIME_PRUEFLISTE, 'data/adn-vde-historie.json'].filter((pfad) => !existsSync(join(schreibWurzel, pfad)))
  if (fehlt.length) {
    console.error('FEHLER: die Phase schreibt ihre Prüfliste nicht unter die übergebene Wurzel', fehlt)
    process.exit(1)
  }
} finally {
  rmSync(schreibWurzel, { recursive: true, force: true })
}

if (release.schedule.episodeCount !== 3 || release.schedule.episodeCountAssumed !== true) {
  console.error('FEHLER: Bauphase 9 hebt die Folgenzahl nicht auf die Beobachtung an', JSON.stringify(release.schedule))
  process.exit(1)
}
console.log('check-folge-ueber-anzahl-bau: ok')
