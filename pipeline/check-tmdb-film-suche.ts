/**
 * Zusicherungen zur Film-Nachsuche der TMDB-Titelsuche (04.11.2026, Bright: Samurai Soul): AniList führt einen einzelnen Netflix-Film als ONA mit einer Folge,
 * TMDB als Film (839100, 2021-10-12). Die Serien-Suche fand ihn nie. `lookup` fragt nach einem Fehlschlag der Serien-Suche noch den Film ab,
 * aber nur für ONA, OVA und Special mit genau einer Folge.
 * Aufruf: `npm run check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { faelligeTitel } from './lib/tmdb-faellig.ts'
import { koennteFilmSein, lookup } from './lib/tmdb-titel-lookup.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* Echte Antworten (TMDB, 04.11.2026): Serien-Suche leer, Film-Suche ein Treffer mit Genre Animation, Aktion, Fantasy. */
const BRIGHT_FILM = { id: 839100, title: 'Bright: Samurai Soul', original_title: 'Bright: Samurai Soul', release_date: '2021-10-12', genre_ids: [16, 28, 14], vote_count: 300 }
const BRIGHT = { id: 135432, titleEn: 'Bright: Samurai Soul', titleRomaji: 'BRIGHT: Samurai Soul', jpYear: 2021, format: 'ONA', episodes: 1 } as Title

function kulisse(tvTreffer: object[], filmTreffer: object[], tvFehler = false): { holen: typeof import('./lib/util.ts').fetchJson; adressen: string[] } {
  const adressen: string[] = []
  const holen = (async (url: string) => {
    adressen.push(url)
    if (url.includes('/search/tv')) {
      if (tvFehler) throw new Error('503')
      return { results: tvTreffer }
    }
    if (url.includes('/search/movie')) return { results: filmTreffer }
    if (url.includes('/movie/839100?')) return { title: 'Bright: Samurai Soul', release_date: '2021-10-12', genres: [{ id: 16 }] }
    if (url.includes('/content_ratings')) return { results: [] }
    if (url.includes('/release_dates')) return { results: [{ iso_3166_1: 'DE', release_dates: [{ certification: '16', type: 4, release_date: '2021-10-12T00:00:00.000Z' }] }] }
    return { results: {} }
  }) as unknown as typeof import('./lib/util.ts').fetchJson
  return { holen, adressen }
}
const keinSchlaf = async (): Promise<void> => {}
const arten = (adressen: string[]): string => adressen.filter((a) => a.includes('/search/')).map((a) => (a.includes('/search/tv') ? 'tv' : 'movie')).join()

console.log('\nFilm-Nachsuche: Auslöser Bright: Samurai Soul')
{
  const { holen, adressen } = kulisse([], [BRIGHT_FILM])
  const r = await lookup('k', BRIGHT, holen, keinSchlaf)
  pruefe('ONA, eine Folge: Film 839100 als movie zugeordnet', r.tmdbId === 839100 && r.kind === 'movie' && r.miss === undefined, r)
  pruefe('Reihenfolge: erst alle Serien-Suchen, dann die Film-Suchen', arten(adressen) === 'tv,tv,movie,movie', arten(adressen))
  pruefe('Filmwege: Details und Freigaben kommen vom Film, nicht von einer Serie', adressen.some((a) => a.includes('/movie/839100?')) && adressen.some((a) => a.includes('/movie/839100/release_dates')) && !adressen.some((a) => a.includes('/tv/839100')), adressen)
  pruefe('Freigabe und Kinostart-Feld des Films gelesen', r.fsk === 16 && Array.isArray(r.kinoDe), r)
}

console.log('\nFilm-Nachsuche: wann nicht')
{
  const f = (extra: Partial<Title>): Title => ({ ...BRIGHT, ...extra }) as Title
  const frage = async (t: Title, tv: object[] = [], film: object[] = [BRIGHT_FILM], tvFehler = false): Promise<{ arten: string; r: Awaited<ReturnType<typeof lookup>> }> => {
    const { holen, adressen } = kulisse(tv, film, tvFehler)
    const r = await lookup('k', t, holen, keinSchlaf)
    return { arten: arten(adressen), r }
  }
  const zwei = await frage(f({ episodes: 2 }))
  pruefe('zwei Folgen: keine Film-Suche, Fehlschlag', zwei.arten === 'tv,tv' && zwei.r.miss === true, zwei)
  const ohneZahl = await frage(f({ episodes: undefined }))
  pruefe('Folgenzahl unbekannt: keine Film-Suche', ohneZahl.arten === 'tv,tv' && ohneZahl.r.miss === true, ohneZahl)
  const tvFormat = await frage(f({ format: 'TV' }))
  pruefe('Format TV mit einer Folge: keine Film-Suche', tvFormat.arten === 'tv,tv' && tvFormat.r.miss === true, tvFormat)
  const serieTrifft = await frage(f({ format: 'ONA' }), [{ id: 7, name: 'Bright: Samurai Soul', original_name: 'Bright: Samurai Soul', first_air_date: '2021-10-12', genre_ids: [16], vote_count: 5 }])
  pruefe('Serie trifft: die Serie gewinnt, kein Film gefragt', serieTrifft.r.tmdbId === 7 && serieTrifft.r.kind === 'tv' && serieTrifft.arten === 'tv,tv', serieTrifft)
  const film = await frage(f({ format: 'MOVIE' }))
  pruefe('Format MOVIE: wie bisher nur Film-Suche', film.arten === 'movie,movie' && film.r.tmdbId === 839100, film)
  const falschesJahr = await frage(f({ jpYear: 2015 }))
  pruefe('Film aus anderem Jahr: Fehlschlag trotz Nachsuche', falschesJahr.arten === 'tv,tv,movie,movie' && falschesJahr.r.miss === true, falschesJahr)
  const realfilm = await frage(f({}), [], [{ ...BRIGHT_FILM, genre_ids: [28, 14] }])
  pruefe('Realfilm gleichen Namens (ohne Animation): Fehlschlag', realfilm.r.miss === true, realfilm)
  const serienFehler = await frage(f({}), [], [BRIGHT_FILM], true)
  pruefe('Serien-Suche scheitert (503): der Film wird trotzdem gefunden', serienFehler.r.tmdbId === 839100 && serienFehler.r.kind === 'movie', serienFehler)
}

console.log('\nFilm-Nachsuche: koennteFilmSein')
const fall = (format: string, episodes: number | undefined): boolean => koennteFilmSein({ format, episodes } as Pick<Title, 'format' | 'episodes'>)
pruefe('ONA, OVA, SPECIAL mit einer Folge', fall('ONA', 1) && fall('OVA', 1) && fall('SPECIAL', 1))
pruefe('keine Folgenzahl, zwei, null Folgen', !fall('ONA', undefined) && !fall('ONA', 2) && !fall('OVA', 0))
pruefe('TV, TV_SHORT, MUSIC, MOVIE', !fall('TV', 1) && !fall('TV_SHORT', 1) && !fall('MUSIC', 1) && !fall('MOVIE', 1))

console.log('\nFilm-Nachsuche: Wiedervorlage des Fehlschlags (Bright steht seit 06.10.2026 als Fehlschlag im Bestand)')
{
  const opt = { handIds: new Set<number>(), nurOhneEintrag: false, force: false, grenze: '2000-01-01T00:00:00.000Z', grenzeFehlschlag: '2999-01-01T00:00:00.000Z' }
  const cache = { '135432': { miss: true as const, fetchedAt: '2026-10-06T12:16:28.303Z' } }
  pruefe('der Fehlschlag ist nach der Wartezeit wieder fällig', faelligeTitel([{ id: 135432 }, { id: 5 }], cache, opt).map((t) => t.id).join() === '5,135432', faelligeTitel([{ id: 135432 }, { id: 5 }], cache, opt).map((t) => t.id))
}

if (verletzt) {
  console.error(`\n${verletzt} von ${faelle} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nFilm-Nachsuche: ${faelle} Zusicherungen grün (ONA/OVA/Special mit einer Folge, Reihenfolge, Gegenfälle, Wiedervorlage).`)
