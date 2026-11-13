/**
 * Wächter (13.11.2026, Yaiba): Die Titelseite trägt das Release nach Rang — Stream > TV > Kino > Disc —, nicht das
 * erste mit künftigem Startdatum. Fester Fall: laufende Serie (Joyn, ProSieben Maxx seit 05.11.) + künftige Disc
 * (Vol. 1, 04.12.) → Joyn gewinnt; og:title nennt den Anime, nicht „Vol. 1“. Läuft in `check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { head } from './lib/termin-seite.ts'
import { hauptRelease, naechsterTermin } from './lib/haupt-release.ts'
import type { Umfeld } from './lib/titel-umfeld.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const HEUTE = '2026-11-13'

function weekly(slug: string, platform: string, start: string): Release {
  return {
    slug,
    titleId: 177476,
    name: 'YAIBA: Samurai Legend',
    platform,
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: start, estimated: false, episodeCount: 26 },
    sources: [],
  } as unknown as Release
}
const disc = {
  slug: 'yaiba-vol-1',
  titleId: 177476,
  name: 'Yaiba: Samurai Legend – Vol. 1',
  platform: 'disc',
  releaseType: 'disc',
  schedule: { firstEpisodeDate: '2026-12-04', estimated: false, episodeCount: 1 },
  sources: [],
} as unknown as Release
const joyn = weekly('yaiba-joyn', 'joyn', '2026-11-05')
const tv = { ...weekly('yaiba-tv', 'tv', '2026-11-05'), sender: 'prosieben-maxx' } as Release

pruefe('Yaiba: laufender Stream schlägt künftige Disc', hauptRelease([disc, tv, joyn], HEUTE)?.slug === 'yaiba-joyn', hauptRelease([disc, tv, joyn], HEUTE)?.slug)
pruefe('Yaiba: ohne Stream gewinnt TV vor Disc', hauptRelease([disc, tv], HEUTE)?.slug === 'yaiba-tv')
pruefe('Gegenprobe: bisherige Regel wählte die Disc (rot vorher)', naechsterTermin([disc, tv, joyn], HEUTE)?.slug === 'yaiba-vol-1')
pruefe('Ohne künftigen Termin: letzter, wie bisher', hauptRelease([joyn, { ...tv, schedule: { ...tv.schedule, firstEpisodeDate: '2026-11-06', lastEpisodeDate: '2026-11-07' } } as Release], '2027-06-01')?.slug === 'yaiba-tv')
pruefe('Gleicher Rang: früherer kommender Termin', hauptRelease([weekly('spaet', 'netflix', '2026-12-20'), weekly('frueh', 'crunchyroll', '2026-12-01')], HEUTE)?.slug === 'frueh')

const titel = { id: 177476, slug: 'yaiba-177476', titleDe: 'Yaiba: Samurai Legend', titleRomaji: 'Yaiba', genres: [], streams: [] } as unknown as Title
const umfeld = { krumenHtml: '', krumenJsonLd: '', aehnlichHtml: '' } as unknown as Umfeld
const kopf = head(joyn, titel, HEUTE, 177476, 'yaiba-177476', umfeld, true)
const ogTitel = /property="og:title" content="([^"]*)"/.exec(kopf)?.[1] ?? ''
pruefe('og:title nennt den Anime', ogTitel.startsWith('Yaiba: Samurai Legend'), ogTitel)
pruefe('og:title ohne „Vol.“ bei mehreren Releases', !ogTitel.includes('Vol.'), ogTitel)
const kopfDisc = head(disc, titel, HEUTE, 177476, 'yaiba-177476', umfeld, true)
pruefe('Auch mit Disc als Haupt: og:title ohne „Vol.“', !(/property="og:title" content="([^"]*)"/.exec(kopfDisc)?.[1] ?? '').includes('Vol.'))

if (fehler) process.exit(1)
console.log('check-haupt-release: Hauptrelease nach Rang, og:title nennt den Titel — alle Fälle ok')
