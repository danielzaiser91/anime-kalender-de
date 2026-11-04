/**
 * Meldungen mit Termin für Cartoons (TMDB, negative Kennung): Bass X Machina (Netflix, 03.11.2026) stand seit 12.09. in `cartoons.json`,
 * Anime2You meldete den Tag am 21.08. — `releasesAus` kannte nur Anime-Titel und verwarf die Meldung still. Die Meldungen und
 * Cartoon-Einträge unten sind die wörtlichen aus `data/proposals/anime2you.json` bzw. `data/cartoons.json` (Stand 04.11.2026).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release } from '../shared/types.ts'
import type { CartoonEintrag } from './lib/cartoons.ts'
import type { Vorschlag } from './lib/meldungen.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'meldung-cartoon-'))
process.env.AK_ROOT = wurzel
/* Erst nach dem Setzen von AK_ROOT laden: Statische Importe liefen davor, und der Bau schriebe ins Repo. */
const { alsTitel } = await import('./lib/cartoons.ts')
const { cartoonsOhneAnimeNamen } = await import('./lib/aussagen-abgleich.ts')
const { einzelOhneRelease } = await import('./lib/sammel-unzugeordnet.ts')
const { leereVerluste, releasesAus, zeitplanAusVorschlag } = await import('./lib/meldungen.ts')

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const BASS_CARTOON: CartoonEintrag = { id: -314271, tmdbId: 314271, titleEn: 'Bass X Machina', jahr: 2026, start: '2026-11-03', episodes: 6, genres: ['Animation'], anbieterDe: [], netzwerk: 'Netflix', land: ['US'], geholtAm: '2026-11-03' }
const LEGO_CARTOON: CartoonEintrag = { id: -318918, tmdbId: 318918, titleDe: 'LEGO One Piece', titleEn: 'LEGO ONE PIECE', jahr: 2026, start: '2026-09-29', episodes: 2, genres: ['Animation'], anbieterDe: ['Netflix', 'Netflix Standard with Ads'], netzwerk: 'Netflix', land: ['US'], geholtAm: '2026-11-03' }
const DREAMLAND_CARTOON: CartoonEintrag = { id: -204084, tmdbId: 204084, titleEn: 'Dreamland', jahr: 2026, start: '2026-10-17', episodes: 10, genres: ['Animation'], anbieterDe: ['Crunchyroll', 'Animation Digital Network'], netzwerk: 'Crunchyroll', land: ['FR'], geholtAm: '2026-10-31' }

const BASS_MELDUNG: Vorschlag = {
  articleTitle: 'Netflix kündigt neuen Original-Anime »Bass X Machina« an + Teaser',
  articleUrl: 'https://www.anime2you.de/news/1043257/netflix-bass-x-machina-angekuendigt/',
  publishedAt: '2026-08-21',
  category: 'streaming',
  platforms: ['netflix'],
  dates: [{ iso: '2026-11-03', context: 'emiere im November 2026 »Bass X Machina« erscheint voraussichtlich am 3. November 2026 unter anderem in der englischen Originalfassung mit d' }, { month: '2026-11', context: 'veröffentlichen wird. Einen ersten Teaser findet ihr unten. Premiere im November 2026 »Bass X Machina« erscheint voraussichtlich am 3. Nove' }],
  dub: 'unklar',
  alreadyCurated: false,
}
const LEGO_MELDUNG: Vorschlag = {
  articleTitle: 'Neuer Netflix-Trailer zur »LEGO One Piece«-Miniserie',
  articleUrl: 'https://www.anime2you.de/news/1043281/netflix-lego-one-piece-neuer-trailer/',
  publishedAt: '2026-08-21',
  category: 'streaming',
  platforms: ['netflix'],
  dates: [{ iso: '2026-09-29', context: 'ion-Umsetzung von »One Piece« und erscheint nach aktueller Planung am 29. September 2026 unter anderem auf Deutsch und Japanisch […] Der B' }, { month: '2026-09', context: 'röffentlicht. Das Video könnt ihr euch weiter unten ansehen. Premiere im September 2026 Die zweiteilige Animationsserie »LEGO One Piece« bas' }],
  dub: 'ja',
  alreadyCurated: false,
}
const DREAMLAND_MELDUNG: Vorschlag = { ...LEGO_MELDUNG, articleTitle: 'Termin der Fantasy-Serie »Dreamland« auf ADN und Crunchyroll + Trailer', articleUrl: 'https://www.anime2you.de/news/test-dreamland/', platforms: ['crunchyroll', 'adn'], dates: [{ iso: '2026-10-17', context: 'Dreamland startet am 17. Oktober 2026 auf Deutsch' }], dub: 'ja' }

const cartoons = [BASS_CARTOON, LEGO_CARTOON, DREAMLAND_CARTOON].map(alsTitel)
const anime = (id: number, name: string) => ({ id, franchiseId: id, titleEn: name, titleDe: name, format: 'TV', jpYear: 2026 }) as never
const ausMeldung = (v: Vorschlag, titel: never[], c = cartoons, vorhanden: Release[] = []) => {
  const verluste = leereVerluste()
  return { neu: releasesAus([v], titel, vorhanden, '2026-11-04', [], [], c, verluste), verluste }
}

function releaseFaelle(): void {
  const vorher = ausMeldung(BASS_MELDUNG, [], [])
  pruefe('vorher (ohne Cartoons): Bass bekommt keinen Release und steht unter „ohne Titel“', vorher.neu.length === 0 && vorher.verluste.ohneTitel.length === 1, vorher.neu.length)
  const bass = ausMeldung(BASS_MELDUNG, [anime(900001, 'Irgendein Anime'), anime(900002, 'Machina')])
  const r = bass.neu[0]
  pruefe('Bass: ein Release auf der Cartoon-Kennung, Netflix, 03.11.', bass.neu.length === 1 && r?.titleId === -314271 && r.platform === 'netflix' && r.schedule.firstEpisodeDate === '2026-11-03', bass.neu)
  pruefe('Bass: Slug ohne doppelten Strich', r?.slug === 'auto-c314271-netflix', r?.slug)
  pruefe('Bass: Sprache bleibt offen (Meldung sagt „unklar“)', r?.sprache === 'offen', r?.sprache)
  pruefe('Bass: kein erfundener Wochentakt, keine erfundene Folgenzahl (Netflix-Cartoon)', r?.releaseType === 'batch' && r.schedule.episodeCount === undefined, r)
  const lego = ausMeldung(LEGO_MELDUNG, [])
  pruefe('LEGO One Piece (Netflix, nie im Kalender): Release am 29.09.', lego.neu.length === 1 && lego.neu[0]!.titleId === -318918 && lego.neu[0]!.schedule.firstEpisodeDate === '2026-09-29', lego.neu)
  const traum = ausMeldung(DREAMLAND_MELDUNG, [])
  pruefe('Dreamland (Crunchyroll): Wochentakt bleibt wie beim Anime', traum.neu[0]?.releaseType === 'weekly', traum.neu[0]?.releaseType)
}

function vorrangFaelle(): void {
  const animeGleich = [anime(900003, 'Bass X Machina')]
  const g = ausMeldung(BASS_MELDUNG, animeGleich)
  pruefe('ein Anime gleichen Namens gewinnt gegen den Cartoon', g.neu.length === 1 && g.neu[0]!.titleId === 900003, g.neu)
  const teil = ausMeldung({ ...BASS_MELDUNG, articleTitle: 'Netflix kündigt »Bass X« an' }, [])
  pruefe('kein Präfix-Treffer auf einen Cartoon („Bass X“) — Verlust „ohne Titel“ gezählt', teil.neu.length === 0 && teil.verluste.ohneTitel.length === 1, teil.verluste)
  const schon = { slug: 'x', titleId: -314271, name: 'Bass X Machina', platform: 'netflix', releaseType: 'batch', schedule: { firstEpisodeDate: '2026-11-03' }, sources: [] } as never
  const abgedeckt: Vorschlag[] = []
  const nochmal = releasesAus([BASS_MELDUNG], [], [schon], '2026-11-04', [], abgedeckt, cartoons)
  pruefe('ein Handeintrag desselben Titels beim Anbieter verdrängt den Bot-Termin (abgedeckt)', nochmal.length === 0 && abgedeckt.length === 1, [nochmal.length, abgedeckt.length])
}

function verlustFaelle(): void {
  const erste = ausMeldung({ ...BASS_MELDUNG, articleTitle: 'Netflix: »Bass X Machina« – Staffel 1' }, [])
  pruefe('Staffel 1 eines Cartoons wird über die Cartoon-Liste gefunden', erste.neu.length === 1 && erste.neu[0]!.titleId === -314271, erste)
  const staffel = ausMeldung({ ...BASS_MELDUNG, articleTitle: 'Netflix: »Bass X Machina« – Staffel 2' }, [])
  pruefe('Verlust „Teil unklar“: Staffel 2 eines Cartoons mit einer Staffel', staffel.neu.length === 0 && staffel.verluste.ohneTeil.length === 1, staffel.verluste)
  const keiner = ausMeldung({ ...BASS_MELDUNG, platforms: [], category: 'streaming' }, [])
  pruefe('Verlust „kein Anbieter“: Titel und Tag da, Anbieter fehlt', keiner.neu.length === 0 && keiner.verluste.ohneAnbieter.length === 1, keiner.verluste)
  const ohneTag = ausMeldung({ ...BASS_MELDUNG, dates: [{ month: '2026-11', context: 'im November' }] }, [])
  pruefe('Gegenfall: ohne Tag ist es kein Verlust (kein Termin)', ohneTag.neu.length === 0 && ohneTag.verluste.ohneTitel.length === 0, ohneTag.verluste)
}

function listenFaelle(): void {
  const v = leereVerluste()
  const einzel = { ...LEGO_MELDUNG, articleTitle: 'Neuer Trailer zu »Gibt es nicht«', articleUrl: 'https://www.anime2you.de/news/1/' }
  const tv = { ...einzel, articleUrl: 'https://www.anime2you.de/news/2/', category: 'allgemein' }
  const disc = { ...einzel, articleUrl: 'https://www.anime2you.de/news/3/', category: 'disc' }
  const omu = { ...einzel, articleUrl: 'https://www.anime2you.de/news/4/', dub: 'unklar', dates: [{ iso: '2026-09-29', context: 'nur im Original mit Untertiteln' }] }
  const sammel = { ...einzel, articleUrl: 'https://www.anime2you.de/news/5/' }
  v.ohneTitel.push(einzel, tv, disc, omu, sammel)
  v.ohneTeil.push({ ...einzel, articleUrl: 'https://www.anime2you.de/news/6/' })
  v.ohneAnbieter.push({ ...einzel, articleUrl: 'https://www.anime2you.de/news/7/' })
  const liste = einzelOhneRelease(v, [sammel]).map((e) => e.artikel.split('/').at(-2))
  pruefe('Liste: Streaming mit deutschem Ton aus allen drei Verlustgründen, ohne TV, Disc, OmU und Sammelartikel', JSON.stringify(liste) === JSON.stringify(['1', '6', '7']), liste)
}

function cartoonKatalogFaelle(): void {
  const titel = (id: number, name: string) => ({ id, titleEn: name })
  const aus = cartoonsOhneAnimeNamen([titel(-1, 'Bass X Machina'), titel(-2, 'Doppelt: Der Film'), titel(-3, 'Noch ein Cartoon')] as never, [titel(5, 'Doppelt: der Film')] as never)
  pruefe('Katalog: Cartoon mit Anime-Namen bleibt draußen (Schreibweise egal), die übrigen kommen', aus.map((t) => t.id).join() === '-1,-3', aus)
  const netflix = zeitplanAusVorschlag({ articleTitle: 'X' }, 'batch', '2026-11-03', { id: -5, jpYear: 2026 }, 'netflix')
  const anime = zeitplanAusVorschlag({ articleTitle: 'X' }, 'batch', '2026-11-03', { id: 5, jpYear: 2026 }, 'netflix')
  pruefe('Wochentakt: Netflix-Cartoon (id < 0) batch, Netflix-Anime weiter weekly', netflix.releaseType === 'batch' && anime.releaseType === 'weekly', [netflix.releaseType, anime.releaseType])
}

async function katalogFall(): Promise<void> {
  // Namensabgleich der Aussagen (Vorschlagslauf): Bass stand 22.10.2026 auf „offen: kein Titel mit diesem Namen“.
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify({ a: { id: 900010, titleEn: 'Irgendein Anime', format: 'TV' } }))
  writeFileSync(join(wurzel, 'public', 'data', 'cartoons.json'), JSON.stringify(cartoons))
  const { katalogLaden } = await import('./lib/aussagen-abgleich.ts')
  const { ordneZu } = await import('./lib/aussagen-zuordnung.ts')
  const aussage = { titel: 'Bass X Machina', art: 'start', plattformen: ['netflix'], datum: '2026-11-03' } as never
  const { zuordnung, offen } = ordneZu(aussage, katalogLaden().katalog)
  pruefe('Aussagen-Katalog: „Bass X Machina“ wird dem Cartoon zugeordnet, nicht „kein Titel“', zuordnung?.anilistId === -314271 && !offen, { zuordnung, offen })
}

async function bauFall(): Promise<void> {
  // Verdrahtung im Bau: der Fall von 22.08.2026 durch `ergaenzeTermineAusNewsUndTv`, nicht nur durch `releasesAus`.
  mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]')
  const unbekannt = { ...LEGO_MELDUNG, articleTitle: '»Unbekannt« startet bei Netflix', articleUrl: 'https://www.anime2you.de/news/9/' }
  const teilUnklar = { ...LEGO_MELDUNG, articleTitle: '»Bass X Machina« – Staffel 2 auf Netflix', articleUrl: 'https://www.anime2you.de/news/10/' }
  const ohneAnbieter = { ...LEGO_MELDUNG, articleUrl: 'https://www.anime2you.de/news/11/', platforms: [] }
  writeFileSync(join(wurzel, 'data', 'proposals', 'anime2you.json'), JSON.stringify({ proposals: [BASS_MELDUNG, LEGO_MELDUNG, unbekannt, teilUnklar, ohneAnbieter] }))
  writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify({ '-314271': BASS_CARTOON, '-318918': LEGO_CARTOON }))
  const { ergaenzeTermineAusNewsUndTv } = await import('./bau/08-news-tv.ts')
  const releases: Release[] = []
  const zeilen: string[] = []
  const alt = console.log
  console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
  try {
    ergaenzeTermineAusNewsUndTv({ titles: new Map(), releases } as never)
  } finally {
    console.log = alt
  }
  const ids = releases.map((r) => r.titleId).sort((a, b) => a - b)
  pruefe('Bau: Bass und LEGO One Piece bekommen einen Release', ids.join() === '-318918,-314271', ids)
  const datei = JSON.parse(readFileSync(join(wurzel, 'data', 'proposals', 'nicht-zugeordnet.json'), 'utf8')) as { eintraege: { titel: string; quelle: string }[] }
  const titel = datei.eintraege.map((e) => `${e.titel}/${e.quelle}`).sort()
  pruefe('Bau: die drei Verluste stehen als Einzelartikel auf der Liste, die beiden Cartoon-Termine nicht', JSON.stringify(titel) === JSON.stringify(['Bass X Machina/Einzelartikel', 'LEGO One Piece/Einzelartikel', 'Unbekannt/Einzelartikel']), titel)
  pruefe('Bau: Verluste stehen im Log, nach Grund gezählt', zeilen.some((z) => z.includes('Meldungen mit Termin ohne Release: 1 ohne Titel, 1 mit unklarem Teil, 1 ohne Anbieter')), zeilen.filter((z) => z.includes('ohne Release')))
}

try {
  releaseFaelle()
  vorrangFaelle()
  verlustFaelle()
  listenFaelle()
  cartoonKatalogFaelle()
  await katalogFall()
  await bauFall()
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log(`Meldung-Cartoon: ${fehler ? 'FEHLER' : 'alle Zusicherungen erfüllt'}`)
if (fehler) process.exit(1)
