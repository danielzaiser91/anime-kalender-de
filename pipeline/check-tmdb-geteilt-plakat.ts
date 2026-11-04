/**
 * Zusicherungen: Plakat und Banner eines geteilten TMDB-Films gehören keinem der Titel (`lib/tmdb-eindeutig.ts`, `ohneGeteilteFilme`).
 * Aufruf: `npm run check:logic`.
 */
import { mehrdeutigeFilmzuordnungen, merkeGeteilteFilme, ohneGeteilteFilme } from './lib/tmdb-eindeutig.ts'
import { coverNachRegel } from './lib/cover-quelle.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nTMDB-Plakat geteilter Filme')
const zuordnung = {
  '130622': { tmdbId: 904759, kind: 'movie' as const },
  '10019697': { tmdbId: 904759, kind: 'movie' as const },
  '5': { tmdbId: 77, kind: 'movie' as const },
}
const plakate = { '130622': { p: '/kitaro.jpg' }, '10019697': { p: '/kitaro.jpg' }, '5': { p: '/eigen.jpg' }, '6': null }

merkeGeteilteFilme(new Set())
pruefe('ohne geteilte Filme bleibt alles unverändert (dasselbe Objekt)', ohneGeteilteFilme(plakate, 'Plakate') === plakate)

merkeGeteilteFilme(mehrdeutigeFilmzuordnungen(zuordnung))
const rest = ohneGeteilteFilme(plakate, 'Plakate')
pruefe('beide Kitaro-Titel verlieren das Plakat', !('130622' in rest) && !('10019697' in rest), Object.keys(rest))
pruefe('ein Titel mit eigenem Film und der Eintrag ohne Plakat bleiben', rest['5']?.p === '/eigen.jpg' && '6' in rest, Object.keys(rest))
pruefe('die Eingabe wird nicht verändert', '130622' in plakate)
pruefe('Banner gleich behandelt', Object.keys(ohneGeteilteFilme({ '130622': { p: '/b.jpg' }, '5': { p: '/c.jpg' } }, 'Banner')).join() === '5')
pruefe(
  'Titel mit anderem Cover behält es (Rückfall AniList), sonst keins',
  coverNachRegel(130622, 'https://anilist/x.jpg', rest, {}) === 'https://anilist/x.jpg' && coverNachRegel(10019697, undefined, rest, {}) === undefined,
)

merkeGeteilteFilme(new Set())
if (verletzt) process.exit(1)
console.log('TMDB-Plakat geteilter Filme: 6 Zusicherungen ✓')
