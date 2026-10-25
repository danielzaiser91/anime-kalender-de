/**
 * Zusicherungen zum TMDB-Genre: Eine Zuordnung ohne Genre Animation ist eine Realserie/ein Realfilm gleichen Namens (Kakegurui, 21.10.2026).
 * Prüft die Funktionen (`lib/tmdb-genre.ts`, `lib/tmdb-titel-treffer.ts`, `lib/tmdb-genre-lauf.ts`) und den Bestand `data/tmdb-titles.json`.
 * Aufruf: `npm run check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import yaml from 'js-yaml'
import { keineAnimation, ohneAnimation, genreUngemessen } from './lib/tmdb-genre.ts'
import { genreNachtragen } from './lib/tmdb-genre-lauf.ts'
import { faelligeTitel } from './lib/tmdb-faellig.ts'
import { waehleBesten, type SearchHit } from './lib/tmdb-titel-treffer.ts'
import { lookup } from './lib/tmdb-titel-lookup.ts'
import { uebernimmVonHand } from './lib/tmdb-von-hand.ts'
import type { Title } from '../shared/types.ts'
import type { TmdbTitle } from './fetch-tmdb-titles.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nTMDB-Genre: keineAnimation')
pruefe('nur Drama: keine Animation', keineAnimation([18]) === true)
pruefe('Animation neben anderen: gilt', keineAnimation([35, 16, 18]) === false)
pruefe('nur Animation: gilt', keineAnimation([16]) === false)
pruefe('leere Liste: nicht widerlegt', keineAnimation([]) === false)
pruefe('keine Angabe: nicht widerlegt', keineAnimation(undefined) === false)

console.log('\nTMDB-Genre: Titelsuche wählt den Anime, nicht die Realserie')
const treffer = (id: number, jahr: number, genre_ids: number[] | undefined, vote_count: number): SearchHit => ({ id, name: 'Kakegurui', original_name: 'Kakegurui', first_air_date: `${jahr}-07-01`, genre_ids, vote_count })
const real = treffer(76409, 2018, [18, 9648], 900)
const anime = treffer(70881, 2017, [16, 18], 200)
const andere = treffer(5, 2017, [16], 10)
pruefe('Anime in der Mitte gewinnt gegen bekanntere Realserie davor', waehleBesten(undefined, 'Kakegurui', [real, anime, { ...andere, name: 'Andere Welt', original_name: 'Andere Welt' }], 2017)?.hit.id === 70881)
pruefe('nur Realserie: kein Treffer', waehleBesten(undefined, 'Kakegurui', [real], 2017) === undefined)
pruefe('Treffer ohne Genreangabe: gilt (nicht widerlegt)', waehleBesten(undefined, 'Kakegurui', [treffer(7, 2017, undefined, 5)], 2017)?.hit.id === 7)
pruefe('Treffer mit leerer Genreliste: gilt', waehleBesten(undefined, 'Kakegurui', [treffer(8, 2017, [], 5)], 2017)?.hit.id === 8)
pruefe('bisheriger Bester bleibt, wenn der neue Treffer Realserie ist', waehleBesten({ hit: anime, score: 1, gewicht: 0 }, 'Kakegurui', [real], 2017)?.hit.id === 70881)
pruefe('Jahr um zwei daneben: kein Treffer', waehleBesten(undefined, 'Kakegurui', [treffer(9, 2019, [16], 5)], 2017) === undefined)
pruefe('Jahr um eins daneben: Treffer', waehleBesten(undefined, 'Kakegurui', [treffer(9, 2018, [16], 5)], 2017)?.hit.id === 9)

console.log('\nTMDB-Genre: Auswahl unter Treffern (unverändert aus der Titelsuche)')
const mit = (id: number, name: string, vote_count: number, jahr = 2017): SearchHit => ({ id, name, original_name: name, first_air_date: `${jahr}-01-01`, genre_ids: [16], vote_count })
pruefe('gleicher Name: der bekanntere gewinnt, vorn wie hinten', waehleBesten(undefined, 'Mirai Nikki Redial', [mit(1, 'Mirai Nikki Redial', 5), mit(2, 'Mirai Nikki Redial', 50)], 2017)?.hit.id === 2 && waehleBesten(undefined, 'Mirai Nikki Redial', [mit(2, 'Mirai Nikki Redial', 50), mit(1, 'Mirai Nikki Redial', 5)], 2017)?.hit.id === 2)
pruefe('der bessere Name schlägt den bekannteren, vorn wie hinten', waehleBesten(undefined, 'Mirai Nikki Redial', [mit(3, 'Mirai Nikki Redial Extra', 900), mit(4, 'Mirai Nikki Redial', 1)], 2017)?.hit.id === 4 && waehleBesten(undefined, 'Mirai Nikki Redial', [mit(4, 'Mirai Nikki Redial', 1), mit(3, 'Mirai Nikki Redial Extra', 900)], 2017)?.hit.id === 4)
pruefe('Name unter 0,75 Ähnlichkeit: kein Treffer', waehleBesten(undefined, 'Mirai Nikki Redial', [mit(5, 'Mirai Nikki', 9)], 2017) === undefined)
pruefe('nur die ersten fünf Treffer zählen', waehleBesten(undefined, 'Kakegurui', [1, 2, 3, 4, 5].map((i) => mit(i, 'Andere Welt', 1)).concat(mit(6, 'Kakegurui', 1)), 2017) === undefined)
pruefe('der fünfte Treffer zählt noch', waehleBesten(undefined, 'Kakegurui', [1, 2, 3, 4].map((i) => mit(i, 'Andere Welt', 1)).concat(mit(6, 'Kakegurui', 1)), 2017)?.hit.id === 6)
pruefe('Treffer ohne Datum gilt trotz Jahr', waehleBesten(undefined, 'Kakegurui', [{ ...mit(7, 'Kakegurui', 1), first_air_date: undefined }], 2017)?.hit.id === 7)
pruefe('ohne eigenes Jahr gilt jedes Datum', waehleBesten(undefined, 'Kakegurui', [mit(8, 'Kakegurui', 1, 1999)], undefined)?.hit.id === 8)
pruefe('Kinofilm: release_date zählt wie first_air_date', waehleBesten(undefined, 'Kakegurui', [{ id: 9, title: 'Kakegurui', release_date: '2030-01-01', genre_ids: [16] }], 2017) === undefined)
pruefe('Name nur im Originaltitel: gilt', waehleBesten(undefined, 'Kakegurui', [{ id: 10, original_title: 'Kakegurui', genre_ids: [16] }], undefined)?.hit.id === 10)
pruefe('Name nur im deutschen Namen (Original anders): gilt', waehleBesten(undefined, 'Kakegurui', [{ id: 11, name: 'Kakegurui', original_name: 'Anderes Werk', genre_ids: [16] }], undefined)?.hit.id === 11)
pruefe('Name nur im Filmtitel (Originaltitel anders): gilt', waehleBesten(undefined, 'Kakegurui', [{ id: 12, title: 'Kakegurui', original_title: 'Anderes Werk', genre_ids: [16] }], undefined)?.hit.id === 12)
pruefe('Jahr um zwei zu früh: kein Treffer', waehleBesten(undefined, 'Kakegurui', [mit(13, 'Kakegurui', 1, 2015)], 2017) === undefined)
pruefe('beide Daten: first_air_date zählt vor release_date', waehleBesten(undefined, 'Kakegurui', [{ ...mit(14, 'Kakegurui', 1), release_date: '2030-01-01' }], 2017)?.hit.id === 14)
pruefe('Beliebtheit zählt zur Stimmenzahl', waehleBesten(undefined, 'Mirai Nikki Redial', [{ ...mit(15, 'Mirai Nikki Redial', 0), popularity: 100 }, mit(16, 'Mirai Nikki Redial', 5)], 2017)?.hit.id === 15)
pruefe('gleicher Name, gleiche Stimmen: der erste bleibt', waehleBesten(undefined, 'Kakegurui', [mit(17, 'Kakegurui', 7), mit(18, 'Kakegurui', 7)], 2017)?.hit.id === 17)
pruefe('Ähnlichkeit genau 0,75 gilt', waehleBesten(undefined, 'Mirai Nikki Redial', [mit(19, 'Mirai Nikki Redial Extra', 1)], 2017)?.hit.id === 19)
pruefe('Ähnlichkeit 5/7 (unter 0,75) gilt nicht', waehleBesten(undefined, 'alpha bravo charlie delta echo', [mit(20, 'alpha bravo charlie delta echo foxtrot golf', 1)], 2017) === undefined)

console.log('\nTMDB-Genre: Zuordnungen ohne Animation')
const cache = {
  '1': { tmdbId: 10, kind: 'tv', genreIds: [18] },
  '2': { tmdbId: 11, kind: 'tv', genreIds: [16] },
  '3': { tmdbId: 12, kind: 'tv' },
  '4': { tmdbId: 13, kind: 'tv', genreIds: [35] },
  '5': { kind: 'tv', genreIds: [18] },
  '7': { kind: 'tv' },
  '6': { tmdbId: 14, kind: 'movie', genreIds: [] },
}
pruefe('widerlegt sind 1 und 4 (4 ist von Hand und bleibt aus)', JSON.stringify(ohneAnimation(cache, new Set([4]))) === '[1]', ohneAnimation(cache, new Set([4])))
pruefe('ohne Hand: 1 und 4', JSON.stringify(ohneAnimation(cache, new Set())) === '[1,4]')
pruefe('ungemessen ist nur 3 (5 und 7 haben keine Zuordnung, 6 hat eine leere Liste)', JSON.stringify(genreUngemessen(cache)) === '[3]', genreUngemessen(cache))

console.log('\nTMDB-Genre: Nachtragen und Entfernen (Lauf)')
async function lauf(): Promise<void> {
  const c: Record<string, { tmdbId?: number; kind?: string; genreIds?: number[] }> = {
    '1': { tmdbId: 10, kind: 'tv' },
    '2': { tmdbId: 11, kind: 'tv' },
    '3': { tmdbId: 12, kind: 'movie' },
    '4': { tmdbId: 13, kind: 'tv' },
    '6': { tmdbId: 15 },
    '5': { tmdbId: 14, kind: 'tv', genreIds: [16] },
  }
  const poster: Record<string, object> = { '1': { p: 'a' }, '2': { p: 'b' }, '4': { p: 'd' } }
  const folgen: Record<string, object> = { '1': { tmdbId: 10 }, '3': { tmdbId: 12 } }
  const gefragt: string[] = []
  const antworten: Record<number, { genreIds: number[]; info?: string } | undefined> = { 10: { genreIds: [18], info: 'Realserie' }, 11: { genreIds: [16, 18] }, 12: undefined, 13: { genreIds: [35] }, 15: { genreIds: [18] } }
  const r = await genreNachtragen(c, new Set([4]), [poster, folgen], async (kind, id) => {
    gefragt.push(`${kind}/${id}`)
    return antworten[id]
  })
  pruefe('gefragt wird nur nach Zuordnungen ohne Genre', gefragt.join() === 'tv/10,tv/11,movie/12,tv/13,tv/15', gefragt)
  pruefe('gemessen 4, unbeantwortet 1', r.gemessen === 4 && r.unbeantwortet === 1, r)
  pruefe('die Auskunft zu 1 steht im Bericht', r.infos.join() === '1: Realserie,6: ?', r.infos)
  pruefe('entfernt werden 1 und 6 (Drama, nicht von Hand), nicht 4', JSON.stringify(r.entfernt) === '[1,6]', r.entfernt)
  pruefe('Eintrag 1 ist weg, 2 behält Genre, 4 (von Hand) bleibt mit Genre', !('1' in c) && c['2']?.genreIds?.join() === '16,18' && c['4']?.genreIds?.join() === '35')
  pruefe('abgeleitetes zu 1 ist weg, das zu 2 und 4 bleibt', !('1' in poster) && '2' in poster && '4' in poster && !('1' in folgen) && '3' in folgen)
  pruefe('unbeantwortet (Timeout, 404): Zuordnung bleibt, ohne Genre', c['3']?.tmdbId === 12 && c['3']?.genreIds === undefined)
}

console.log('\nTMDB-Genre: lookup (Aufrufer der Auswahl) schreibt Treffer und Genre')
async function lookupFaelle(): Promise<void> {
  const adressen: string[] = []
  const holen = (async (url: string) => {
    adressen.push(url)
    if (url.includes('/search/tv')) return { results: [real, anime, { ...andere, name: 'Andere Welt', original_name: 'Andere Welt' }] }
    if (url.includes('/tv/70881?')) return { name: 'Kakegurui', first_air_date: '2017-07-01', genres: [{ id: 16 }, { id: 18 }] }
    if (url.includes('/content_ratings')) return { results: [{ iso_3166_1: 'DE', rating: '16' }] }
    if (url.includes('/search/movie')) return { results: [{ id: 33, title: 'Filmname', original_title: 'Filmname', release_date: '2020-05-01', genre_ids: [16], vote_count: 9 }] }
    if (url.includes('/movie/33?')) return { title: 'Filmname', release_date: '2020-05-01' }
    if (url.includes('/release_dates')) return { results: [] }
    return { results: {} }
  }) as unknown as typeof import('./lib/util.ts').fetchJson
  const keinSchlaf = async (): Promise<void> => {}
  const serie = await lookup('k', { id: 1, titleEn: 'Kakegurui', jpYear: 2017, format: 'TV' } as Title, holen, keinSchlaf)
  pruefe('Serie: der Anime in der Mitte wird zugeordnet', serie.tmdbId === 70881 && serie.kind === 'tv', serie)
  pruefe('Serie: die Genres der Detailantwort stehen im Eintrag', serie.genreIds?.join() === '16,18', serie.genreIds)
  pruefe('Serie: Details werden beim Anime abgefragt, nicht bei der Realserie', adressen.some((a) => a.includes('/tv/70881?')) && !adressen.some((a) => a.includes('/tv/76409')), adressen)
  const film = await lookup('k', { id: 2, titleEn: 'Filmname', jpYear: 2020, format: 'MOVIE' } as Title, holen, keinSchlaf)
  pruefe('Film ohne Genreliste in der Detailantwort: leere Liste statt fehlend', film.tmdbId === 33 && film.kind === 'movie' && film.genreIds?.length === 0, film)
  const nichts = await lookup('k', { id: 3, titleEn: 'Kakegurui', jpYear: 2005, format: 'TV' } as Title, holen, keinSchlaf)
  pruefe('nur Treffer ohne passendes Jahr: Fehltreffer', nichts.miss === true && nichts.tmdbId === undefined, nichts)
  kreislaufGenreFehlt(serie)
}

console.log('\nTMDB-Genre: Zuordnung ohne genreIds ist fällig, auch frisch (Kakegurui Twin, 138183)')
const fern = '2999-12-31T00:00:00.000Z'
const opt = { handIds: new Set<number>([6]), nurOhneEintrag: false, force: false, grenze: '2000-01-01T00:00:00.000Z', grenzeFehlschlag: '2000-01-01T00:00:00.000Z' }
const faelligIds = (cache: Record<string, object>, o = opt): number[] => faelligeTitel([1, 2, 3, 4, 5, 6].map((id) => ({ id })), cache, o).map((t) => t.id)
const tv = (extra: object): object => ({ tmdbId: 138183, kind: 'tv', fetchedAt: fern, ...extra })
function kreislaufGenreFehlt(nachholung: TmdbTitle): void {
  const cache: Record<string, object> = { 1: tv({}), 2: tv({ genreIds: [16] }), 3: tv({ genreIds: [] }), 4: { kind: 'tv', fetchedAt: fern }, 5: tv({}), 6: tv({}) }
  pruefe('frischer Eintrag ohne genreIds ist fällig, mit Genre (auch leerer Liste) oder ohne Kennung nicht, von Hand nie', faelligIds(cache).join() === '1,5', faelligIds(cache))
  pruefe('Nachsuche-Lauf (nur ohne Eintrag) holt sie nicht', faelligIds(cache, { ...opt, nurOhneEintrag: true }).join() === '', faelligIds(cache, { ...opt, nurOhneEintrag: true }))
  cache[1] = { ...nachholung, fetchedAt: fern }
  pruefe('Kreislauf: nach dem Lauf (lookup trägt genreIds) ist der Titel nicht mehr fällig', faelligIds(cache).join() === '5', faelligIds(cache))
}
await lookupFaelle()

console.log('\nTMDB-Genre: Von-Hand-Kennung übernimmt keine Genres der alten Kennung')
const hCache: Record<string, TmdbTitle> = {
  '1': { tmdbId: 76409, kind: 'tv', genreIds: [18, 9648] },
  '2': { tmdbId: 5, kind: 'tv', genreIds: [16] },
  '3': { tmdbId: 6, kind: 'movie', genreIds: [16] },
  '5': { tmdbId: 9, kind: 'movie', genreIds: [16] },
}
const hZahl = uebernimmVonHand(hCache, [{ anilistId: 1, tmdbId: 72305 }, { anilistId: 2, tmdbId: 5 }, { anilistId: 3, tmdbId: 7, kind: 'tv' }, { anilistId: 4, tmdbId: 8 }, { anilistId: 5, tmdbId: 10 }, { anilistId: 6, tmdbId: 0 }], '2999-12-31T00:00:00Z')
pruefe('geändert werden 1, 3, 5 und der neue 4, nicht der gleiche 2', hZahl === 4, hZahl)
pruefe('Kennungswechsel: Genres der alten Kennung entfallen', hCache['1'].tmdbId === 72305 && hCache['1'].genreIds === undefined, hCache['1'])
pruefe('gleiche Kennung: Genres bleiben', hCache['2'].genreIds?.join() === '16')
pruefe('Art aus dem Eintrag, sonst die alte, sonst Serie', hCache['3'].kind === 'tv' && hCache['4']?.kind === 'tv' && hCache['5']?.kind === 'movie' && hCache['1']?.kind === 'tv')

console.log('\nTMDB-Genre: Prozess fetch-tmdb-genre.ts (Wegwerf-Wurzel, TMDB-Antwort aus Kulisse)')
function prozessFall(): void {
  const wurzel = mkdtempSync(join(tmpdir(), 'tmdb-genre-'))
  mkdirSync(join(wurzel, 'data'))
  const schreibe = (name: string, inhalt: unknown): void => writeFileSync(join(wurzel, 'data', name), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
  schreibe('tmdb-titles.json', { '1': { tmdbId: 10, kind: 'tv' }, '2': { tmdbId: 11, kind: 'tv' }, '3': { tmdbId: 10, kind: 'tv' } })
  schreibe('tmdb-von-hand.yaml', '- anilistId: 3\n')
  schreibe('tmdb-poster.json', { '1': { p: '/a.jpg' }, '2': { p: '/b.jpg' } })
  const kulisse = join(wurzel, 'kulisse.mjs')
  writeFileSync(kulisse, "globalThis.fetch = async (url) => new Response(JSON.stringify({ genres: [{ id: String(url).includes('/tv/10?') ? 18 : 16 }], name: 'X' }))\n")
  const starte = (schluessel: string | undefined) =>
    spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--import', pathToFileURL(kulisse).href, fileURLToPath(new URL('./fetch-tmdb-genre.ts', import.meta.url))], {
      cwd: wurzel,
      env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: schluessel },
      encoding: 'utf8',
      windowsHide: true,
    })
  const ohneSchluessel = starte(undefined)
  const vorher = readFileSync(join(wurzel, 'data', 'tmdb-titles.json'), 'utf8')
  pruefe('ohne Schlüssel: Exit 0 und der Bestand bleibt unberührt', ohneSchluessel.status === 0 && vorher.includes('"1"') && readFileSync(join(wurzel, 'data', 'tmdb-titles.json'), 'utf8') === vorher, ohneSchluessel.status)
  const r = starte('kulisse')
  const lies = (name: string): Record<string, { genreIds?: number[]; p?: string; tmdbId?: number }> => JSON.parse(readFileSync(join(wurzel, 'data', name), 'utf8'))
  const titel = lies('tmdb-titles.json')
  pruefe('Prozess endet mit 0', r.status === 0, [r.status, r.stderr.slice(0, 300)])
  pruefe('Drama-Zuordnung (Kennung 10) ist entfernt', !('1' in titel), titel)
  pruefe('Animation-Zuordnung bleibt und trägt ihr Genre', titel['2']?.genreIds?.join() === '16', titel)
  pruefe('von Hand gesetzte Drama-Zuordnung (Kennung 3) bleibt', titel['3']?.tmdbId === 10, titel)
  pruefe('abgeleitetes Plakat der entfernten Zuordnung ist weg, das andere bleibt', !('1' in lies('tmdb-poster.json')) && '2' in lies('tmdb-poster.json'))
  rmSync(wurzel, { recursive: true, force: true })
}
prozessFall()

console.log('\nTMDB-Genre: Prozess fetch-tmdb-titles.ts --nur-ohne-eintrag (lookup und Von-Hand-Pfad in main)')
const KULISSE_TITEL = `
const treffer = (id, jahr, genre) => ({ id, name: 'Kakegurui', original_name: 'Kakegurui', first_air_date: jahr + '-07-01', genre_ids: genre, vote_count: id === 76409 ? 900 : 200 })
globalThis.fetch = async (url) => {
  const u = String(url)
  if (u.includes('/search/tv')) return new Response(JSON.stringify({ results: [treffer(76409, 2018, [18]), treffer(70881, 2017, [16, 18])] }))
  if (u.includes('/tv/70881?')) return new Response(JSON.stringify({ name: 'Kakegurui', first_air_date: '2017-07-01', genres: [{ id: 16 }, { id: 18 }] }))
  if (u.includes('/content_ratings')) return new Response(JSON.stringify({ results: [] }))
  return new Response(JSON.stringify({ results: {} }))
}
`
function titelsucheProzess(args: string[]): { status: number | null; stderr: string; titel: Record<string, unknown>; fremdVorher: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'tmdb-titel-'))
  mkdirSync(join(wurzel, 'data'))
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  const t = (id: number, titleEn: string) => ({ id, titleEn, jpYear: 2017, format: 'TV' })
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify([t(1, 'Kakegurui'), t(2, 'Fremd'), t(3, 'Von Hand')]))
  const fremd = { fetchedAt: '1970-01-01T00:00:00.000Z', miss: true }
  writeFileSync(join(wurzel, 'data', 'tmdb-titles.json'), JSON.stringify({ '2': fremd, '3': { tmdbId: 76409, kind: 'tv', genreIds: [18] } }))
  writeFileSync(join(wurzel, 'data', 'tmdb-von-hand.yaml'), '- anilistId: 3\n  tmdbId: 72305\n  kind: tv\n')
  const kulisse = join(wurzel, 'kulisse.mjs')
  writeFileSync(kulisse, KULISSE_TITEL)
  const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--import', pathToFileURL(kulisse).href, fileURLToPath(new URL('./fetch-tmdb-titles.ts', import.meta.url)), ...args], {
    cwd: wurzel,
    env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: 'kulisse' },
    encoding: 'utf8',
    windowsHide: true,
  })
  const titel = JSON.parse(readFileSync(join(wurzel, 'data', 'tmdb-titles.json'), 'utf8')) as Record<string, unknown>
  rmSync(wurzel, { recursive: true, force: true })
  return { status: r.status, stderr: r.stderr, titel, fremdVorher: JSON.stringify(fremd) }
}
const gezielt = titelsucheProzess(['--nur-ohne-eintrag'])
const alleFaellig = titelsucheProzess([])
const eintrag = (r: { titel: Record<string, unknown> }, id: string) => r.titel[id] as { tmdbId?: number; genreIds?: number[] } | undefined
pruefe('Prozess endet mit 0', gezielt.status === 0, [gezielt.status, gezielt.stderr.slice(0, 300)])
pruefe('Titel ohne Eintrag: der Anime (nicht die bekanntere Realserie) mit seinen Genres', eintrag(gezielt, '1')?.tmdbId === 70881 && eintrag(gezielt, '1')?.genreIds?.join() === '16,18', gezielt.titel['1'])
pruefe('Von-Hand-Kennung gewinnt und verwirft die Genres der Realserie', eintrag(gezielt, '3')?.tmdbId === 72305 && eintrag(gezielt, '3')?.genreIds === undefined, gezielt.titel['3'])
pruefe('fremder, fälliger Eintrag bleibt byte-gleich', JSON.stringify(gezielt.titel['2']) === gezielt.fremdVorher, gezielt.titel['2'])
pruefe('ohne die Einschränkung wird derselbe fremde Eintrag aufgefrischt (Gegenprobe)', JSON.stringify(alleFaellig.titel['2']) !== alleFaellig.fremdVorher, alleFaellig.titel['2'])

console.log('\nTMDB-Genre: package.json data:tmdb-genre ruft beide Glieder in dieser Reihenfolge')
const skripte = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts
pruefe(
  'erst Genre-Lauf, dann Nachsuche nur ohne Eintrag',
  JSON.stringify(skripte['data:tmdb-genre']?.split(' && ')) === JSON.stringify(['tsx pipeline/fetch-tmdb-genre.ts', 'tsx pipeline/fetch-tmdb-titles.ts --nur-ohne-eintrag']),
  skripte['data:tmdb-genre'],
)

console.log('\nTMDB-Genre: Bestand data/tmdb-titles.json')
function bestand(): void {
  const titel = JSON.parse(readFileSync('data/tmdb-titles.json', 'utf8')) as Record<string, { tmdbId?: number; kind?: string; genreIds?: number[] }>
  const hand = (yaml.load(readFileSync('data/tmdb-von-hand.yaml', 'utf8')) as { anilistId: number }[] | null) ?? []
  const falsch = ohneAnimation(titel, new Set(hand.map((e) => e.anilistId)))
  pruefe('keine Zuordnung mit bekanntem Genre ohne Animation', falsch.length === 0, falsch)
  const kakegurui = Object.entries(titel).filter(([, e]) => e.tmdbId === 76409).map(([id]) => id)
  pruefe('Kakegurui-Realserie (TMDB 76409) ist keinem Titel zugeordnet', kakegurui.length === 0, kakegurui)
  console.log(`  Genre ungemessen: ${genreUngemessen(titel).length} von ${Object.values(titel).filter((e) => e.tmdbId).length} Zuordnungen (der Lauf data:tmdb-genre trägt sie nach)`)
}

await lauf()
bestand()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Genre: alle Zusicherungen grün.')
