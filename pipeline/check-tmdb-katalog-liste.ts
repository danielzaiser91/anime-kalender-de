/**
 * Zusicherungen zu `lib/tmdb-katalog-liste.ts`: Stufenzählung und die Prüfliste der unsicheren TMDB-Treffer (Zählzeilen, Zeilenform, Ersatzwerte).
 * Läuft in `check:logic`.
 */
import type { KatalogTitel, Zuordnung } from './lib/tmdb-katalog.ts'
import { pruefliste, zaehleStufen } from './lib/tmdb-katalog-liste.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

pruefe('leere Zuordnung', zaehleStufen({}), { sicher: 0, unsicher: 0, kein: 0 })

const zuordnung: Record<string, Zuordnung> = {
  '1': { tmdbId: 11, art: 'tv', stufe: 'sicher', grund: 'Name und Jahr' },
  '2': { tmdbId: 22, art: 'movie', stufe: 'unsicher', grund: 'Jahr | weicht ab', kandidaten: ['tv/23', 'movie/24'] },
  '3': { stufe: 'kein', grund: 'kein Treffer' },
  '4': { tmdbId: 44, art: 'tv', stufe: 'sicher', grund: 'Hand', von: 'hand' },
  '5': { tmdbId: 55, art: 'tv', stufe: 'unsicher', grund: 'Genre fehlt', von: 'hand' },
  '6': { stufe: 'kein', grund: 'verworfen', von: 'hand' },
  '7': { stufe: 'kein', grund: 'verworfen', von: 'hand' },
  '8': { tmdbId: 88, art: 'tv', stufe: 'unsicher', grund: 'nur nativ' },
}
pruefe('Stufen gezählt', zaehleStufen(zuordnung), { sicher: 2, unsicher: 3, kein: 3 })

const titel = new Map<number, KatalogTitel>([
  [2, { id: 2, format: 'MOVIE', jahr: 2019, en: 'A | B', romaji: 'Ei Bi' }],
  [5, { id: 5, format: null, jahr: null, en: '', romaji: 'Romaji Name' }],
  [8, { id: 8, format: 'TV', jahr: 2001, native: 'ネイティブ' }],
])
const text = pruefliste(zuordnung, titel)
const zeilen = text.split('\n')

pruefe('Zählzeile gesamt', zeilen.find((z) => z.startsWith('Erzeugt von'))?.includes(': 2 sicher, 3 unsicher (diese Liste), 3 ohne Treffer.'), true)
pruefe('Zählzeile von Hand', zeilen.find((z) => z.startsWith('Davon von Hand'))?.includes(': 1 bestätigt, 2 verworfen, 1 offen'), true)
pruefe('nur unsichere Treffer als Tabellenzeile, Reihenfolge der Zuordnung', zeilen.filter((z) => z.startsWith('| ') && !z.startsWith('| Titel')), [
  '| A / B | 2019 | MOVIE | [2](https://anilist.co/anime/2) | [movie/22](https://www.themoviedb.org/movie/22) [tv/23](https://www.themoviedb.org/tv/23) [movie/24](https://www.themoviedb.org/movie/24) | Jahr / weicht ab |',
  '| Romaji Name | – | – | [5](https://anilist.co/anime/5) | [tv/55](https://www.themoviedb.org/tv/55) | Genre fehlt |',
  '| ネイティブ | 2001 | TV | [8](https://anilist.co/anime/8) | [tv/88](https://www.themoviedb.org/tv/88) | nur nativ |',
])
pruefe('Titel unbekannt: Kennung als Name, Striche', pruefliste({ '9': { tmdbId: 9, art: 'tv', stufe: 'unsicher', grund: 'g' } }, new Map()).split('\n').filter((z) => z.startsWith('| 9')), [
  '| 9 | – | – | [9](https://anilist.co/anime/9) | [tv/9](https://www.themoviedb.org/tv/9) | g |',
])
pruefe('endet mit Leerzeile', text.endsWith('|\n'), true)
const leer = pruefliste({}, new Map()).split('\n')
pruefe('leere Zuordnung: nur Kopf, keine Zeile', leer.slice(-3), ['| Titel | Jahr | Format | AniList | TMDB | Grund |', '|---|---|---|---|---|---|', ''])

if (fehler) process.exit(1)
console.log('check-tmdb-katalog-liste: ok')
