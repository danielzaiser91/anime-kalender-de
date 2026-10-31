/**
 * Spirou (ADN 729): 25 Folgen am 2021-06-16, Folge 1 am 2025-05-05 neu eingestellt. Der Bau nahm "erste Nummer" als
 * Beginn und "letzte Nummer" als Ende (2025-05-05 bis 2021-06-16) und machte den Bestandsbau rot. Jetzt zählt der Termin.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release } from '../shared/types.ts'
import type { AdnShow } from './lib/adn.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'adn-spanne-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const folge = (nr: number, date: string, time = '10:00') => ({
  date,
  time,
  episode: nr,
  season: '1',
  seasonReference: 'spirou_tv',
  order: nr,
  url: `https://animationdigitalnetwork.com/de/video/729-spirou/${15155 + nr}-folge-${nr}`,
})

try {
  const { terminSpanne } = await import('./lib/adn-spanne.ts')
  const { ergaenzeAdnTitel } = await import('./bau/07-adn.ts')

  console.log('\nterminSpanne')
  const alt = [folge(1, '2025-05-05', '09:00'), ...Array.from({ length: 24 }, (_, i) => folge(i + 2, '2021-06-16'))]
  const s = terminSpanne(alt)
  pruefe('Spirou-Muster: früheste Folge ist Nr. 2, späteste Nr. 1', s.fruehste.episode === 2 && s.spaetste.episode === 1 && s.nachNummerVerdreht, [s.fruehste.episode, s.spaetste.episode])
  const gestaffelt = [folge(1, '2025-05-05'), folge(2, '2025-05-12'), folge(3, '2025-05-19')]
  const g = terminSpanne(gestaffelt)
  pruefe('echte spätere Folgen: Spanne wie nach Nummer, nicht verdreht', g.fruehste.episode === 1 && g.spaetste.episode === 3 && !g.nachNummerVerdreht)
  const gleicherTag = terminSpanne([folge(1, '2025-05-05', '09:00'), folge(2, '2025-05-05', '08:00')])
  pruefe('gleicher Tag: Uhrzeit entscheidet', gleicherTag.fruehste.episode === 2 && gleicherTag.spaetste.episode === 1)
  pruefe('eine Folge: beide gleich, nicht verdreht', terminSpanne([folge(1, '2025-05-05')]).nachNummerVerdreht === false)

  console.log('\nBau')
  const show = (episodes: ReturnType<typeof folge>[]): AdnShow => ({
    showId: 729,
    title: 'Spirou',
    originalTitle: 'Spirou',
    url: 'https://animationdigitalnetwork.com/de/video/729',
    fromCatalog: true,
    batch: false,
    episodes,
  })
  const baueMitErgebnis = (episodes: ReturnType<typeof folge>[]) => {
    const datei = (shows: AdnShow[]) => JSON.stringify({ scrapedAt: '2026-10-31', window: { from: '', to: '' }, shows })
    writeFileSync(join(wurzel, 'data', 'adn.json'), datei([]))
    writeFileSync(join(wurzel, 'data', 'adn-catalog.json'), datei([show(episodes)]))
    const cartoon = { id: -900729, tmdbId: 900729, titleEn: 'Spirou', titleDe: 'Spirou', genres: ['Animation'], anbieterDe: [], land: ['FR'], adnId: 729, stand: 3, geholtAm: '2026-10-31' }
    writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify({ '-900729': cartoon }))
    const releases: Release[] = []
    const ergebnis = ergaenzeAdnTitel({ titles: new Map(), releases, titleByName: new Map(), seenSlugs: new Set() })
    return { release: releases.find((r) => r.platform === 'adn'), verweise: ergebnis.adnVerweiseErgaenzt }
  }
  const baue = (episodes: ReturnType<typeof folge>[]): Release | undefined => baueMitErgebnis(episodes).release
  const r = baue(alt)
  pruefe('Spirou: Beginn 2021-06-16, Ende 2025-05-05, nie Ende vor Beginn', r?.schedule?.firstEpisodeDate === '2021-06-16' && r.schedule.lastEpisodeDate === '2025-05-05', r?.schedule)
  pruefe('Spirou: Uhrzeit der frühesten Folge, 25 Folgen', r?.schedule?.time === '10:00' && r.schedule.episodeCount === 25, r?.schedule)
  pruefe('Spirou: Jahr aus dem Beginn (2021), nicht aus dem Ende (2025)', r?.year === 2021, r?.year)
  pruefe('Spirou: Adresse bleibt Folge 1', r?.platformUrl === alt[0].url, r?.platformUrl)
  const n = baue(gestaffelt)
  pruefe('spätere Staffel: Beginn 2025-05-05, Ende 2025-05-19 wie bisher', n?.schedule?.firstEpisodeDate === '2025-05-05' && n.schedule.lastEpisodeDate === '2025-05-19', n?.schedule)
  console.log('\nADN-Verweis (Beginn gegen heute)')
  const ausgelaufen = [folge(1, '2021-06-16'), folge(2, '2999-12-31')]
  pruefe('Beginn vergangen, Ende in der Zukunft: Verweis ergänzt (zählt den Beginn, nicht das Ende)', baueMitErgebnis(ausgelaufen).verweise === 1, baueMitErgebnis(ausgelaufen).verweise)
  const kommend = [folge(1, '2999-12-30'), folge(2, '2999-12-31')]
  pruefe('Beginn in der Zukunft: kein Verweis', baueMitErgebnis(kommend).verweise === 0, baueMitErgebnis(kommend).verweise)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nADN-Spanne: alle Zusicherungen erfüllt')
