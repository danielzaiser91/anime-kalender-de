/**
 * Zusicherungen zu `schreibeCoverListe()` aus `pipeline/lib/cover-liste.ts` an einer Kulisse (`AK_ROOT`, nie der echte Bestand):
 * Zählung im Kopf (TMDB-Plakat, AniList-Cover, eigene aniSearch-Kopie, ohne Cover, ungesucht; doppelte Kennungen einmal), Zeilen
 * je Abschnitt nach Rang (unsicher, mehrere Kandidaten, kein Plakat, Rest in Eingabereihenfolge), Grund aus der Suche bzw. „frühere
 * Suche“ / „noch nicht gesucht“, `|` im Namen entschärft, aniSearch-Kennungen ohne AniList-Verweis. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const kulisse = mkdtempSync(join(tmpdir(), 'cover-liste-'))
process.env.AK_ROOT = kulisse
mkdirSync(join(kulisse, 'public/data'), { recursive: true })
mkdirSync(join(kulisse, 'daniel-zum-abarbeiten/listen'), { recursive: true })

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const anilist = (n: number) => `https://s4.anilist.co/cover/${n}.jpg`
try {
  const { schreibeCoverListe } = await import('./lib/cover-liste.ts')
  writeFileSync(
    join(kulisse, 'public/data/titles.json'),
    JSON.stringify([
      { id: 1, titleEn: 'Eins', coverImage: anilist(1) },
      { id: 2, titleRomaji: 'Ni|Zwei  Drei', jpYear: 2020, format: 'TV' },
      { id: 3, titleEn: 'San' },
      { id: 4 },
      { id: 5, coverImage: 'https://cover.anime-kalender.de/5.webp' },
      { id: 6, titleEn: 'Roku', coverImage: anilist(6) },
      { id: 7, coverImage: anilist(7) },
      { id: 8, coverImage: anilist(8) },
      { id: 10000001, titleEn: 'Zehn' },
    ]),
  )
  writeFileSync(join(kulisse, 'public/data/ohne-synchro.json'), JSON.stringify([{ id: 1, titleEn: 'Doppelt' }, { id: 9, coverImage: anilist(9) }]))

  schreibeCoverListe(
    { '1': { p: '/eins.jpg', w: 500, h: 750, l: 'ja' }, '3': null, '7': null },
    { '2': { grund: 'unsicher', kandidaten: ['tv/55'] }, '6': { grund: 'kein Plakat' }, '10000001': { grund: 'mehrere Kandidaten' } },
  )
  const md = readFileSync(join(kulisse, 'daniel-zum-abarbeiten/listen/cover-ohne-tmdb.md'), 'utf8')
  const zeilen = md.split('\n')
  pruefe(
    'Zählung',
    zeilen[2],
    'Erzeugt von `pipeline/fetch-tmdb-poster.ts` (Stand der Suche; 11 Titel gesamt): 1 Titel haben ein TMDB-Plakat, 2 behalten das AniList-Cover (TMDB ohne sicheren Treffer), 1 die eigene Kopie des aniSearch-Covers, 4 haben gar kein Cover, 2 AniList-Titel sind noch nicht bei TMDB gesucht.',
  )
  const abschnitt = (titel: string) => {
    const ab = zeilen.findIndex((z) => z.startsWith(`## ${titel}`))
    const rest = zeilen.slice(ab + 4)
    return [zeilen[ab], rest.slice(0, rest.indexOf(''))]
  }
  const S = 'https://www.themoviedb.org/search?query='
  pruefe('ohne jedes Cover', abschnitt('Ohne jedes Cover'), [
    '## Ohne jedes Cover (4)',
    [
      `| Ni/Zwei Drei | 2020 | TV | [2](https://anilist.co/anime/2) | unsicher | [Suche](${S}Ni%7CZwei%20%20Drei) [tv/55](https://www.themoviedb.org/tv/55) |`,
      `| Zehn | – | – | – | mehrere Kandidaten | [Suche](${S}Zehn) |`,
      `| San | – | – | [3](https://anilist.co/anime/3) | kein Treffer (frühere Suche) | [Suche](${S}San) |`,
      `| 4 | – | – | [4](https://anilist.co/anime/4) | noch nicht gesucht | [Suche](${S}) |`,
    ],
  ])
  pruefe('AniList-Cover bleibt', abschnitt('AniList-Cover bleibt'), [
    '## AniList-Cover bleibt (2)',
    [`| Roku | – | – | [6](https://anilist.co/anime/6) | kein Plakat | [Suche](${S}Roku) |`, `| 7 | – | – | [7](https://anilist.co/anime/7) | kein Treffer (frühere Suche) | [Suche](${S}) |`],
  ])
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler) {
  console.error(`check-cover-liste: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-cover-liste: alle Zusicherungen grün')
