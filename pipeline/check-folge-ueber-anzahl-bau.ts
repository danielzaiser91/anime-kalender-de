/**
 * Zusicherung: **Die Bauphase 9 ruft `hebeFolgenzahlAufBeobachtung()` wirklich auf** (16.10.2026, Prüfer:
 * ein toter Aufruf `0 && …` blieb in `check:logic` grün). Fährt `pruefeSynchroJePlattform()` mit einem
 * erfundenen Release ohne Netz; läuft in `check:logic`, also in vor-commit und PR-CI.
 */
import fs, { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { resolve } from 'node:path'
import type { Release } from '../shared/types.ts'
import { pruefeSynchroJePlattform } from './bau/09-synchro.ts'
import { PRUEFLISTE } from './bau/09-7-cr-teilseiten.ts'
import { PRIME_PRUEFLISTE } from './bau/09-7-prime-teilseiten.ts'
import { ROOT } from './lib/util.ts'

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

/* Die Phase liest den vorigen Bestand (`public/data/titles.json`), den `check:logic` nicht lesen darf: leer unterschieben. */
const leserOriginal = fs.readFileSync
fs.readFileSync = ((pfad: unknown, ...rest: unknown[]) =>
  /public[\\/]data[\\/]/.test(String(pfad)) ? '[]' : Reflect.apply(leserOriginal, fs, [pfad, ...rest])) as typeof fs.readFileSync
syncBuiltinESMExports()

/* Die Phase schreibt die Teilseiten-Prüflisten unter `data/`; der Lauf stellt sie danach wieder her. */
const prueflisten = [PRUEFLISTE, PRIME_PRUEFLISTE].map((pfad) => resolve(ROOT, pfad))
const gesichert = prueflisten.map((pfad) => (existsSync(pfad) ? readFileSync(pfad) : undefined))

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
  })
} finally {
  prueflisten.forEach((pfad, i) => (gesichert[i] ? writeFileSync(pfad, gesichert[i]) : rmSync(pfad, { force: true })))
}

if (release.schedule.episodeCount !== 3 || release.schedule.episodeCountAssumed !== true) {
  console.error('FEHLER: Bauphase 9 hebt die Folgenzahl nicht auf die Beobachtung an', JSON.stringify(release.schedule))
  process.exit(1)
}
console.log('check-folge-ueber-anzahl-bau: ok')
