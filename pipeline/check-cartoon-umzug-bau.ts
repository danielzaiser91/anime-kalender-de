/**
 * Verdrahtung des bisherigen Umzugs im Bau (`bau/cartoon-zu-anime.ts` `ordneCartoonsZuAnime` → `findeZwillinge`, 4. Argument): Ein Cartoon, der
 * schon auf einen Anime umgezogen ist, zieht weiter dorthin, auch wenn die TMDB-Serie inzwischen zwei Staffel-Anime als Kandidaten hat.
 * Erfundener Fall (eigene Kennungen), Wegwerf-Ordner über `AK_ROOT`.
 * Aufruf: npx tsx pipeline/check-cartoon-umzug-bau.ts
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'cartoon-umzug-bau-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })

writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
const lies = <T>(pfad: string): T => JSON.parse(readFileSync(join(wurzel, pfad), 'utf8')) as T
const schreibe = (pfad: string, wert: unknown) => writeFileSync(join(wurzel, pfad), JSON.stringify(wert))

try {
  const { ordneCartoonsZuAnime } = await import('./bau/cartoon-zu-anime.ts')
  const cartoon = { id: -900001, slug: 'zz-insel', tmdbId: 900001, titleEn: 'Zz Insel Probe', jpYear: 2999, episodes: 24, streams: [] }
  const staffel = (id: number, titleEn: string) => ({ id, slug: `anime-${id}`, titleEn, jpYear: 2999, episodes: 12, streams: [] })
  schreibe('public/data/cartoons.json', [cartoon])
  schreibe('public/data/titles.json', [staffel(900100, 'Zz Insel Probe'), staffel(900101, 'Zz Insel Probe 2')])
  schreibe('data/tmdb-titles.json', { 900100: { tmdbId: 900001, kind: 'tv' }, 900101: { tmdbId: 900001, kind: 'tv' } })
  schreibe('data/cartoons.json', {})
  schreibe('data/cartoon-umzug.json', [[-900001, 900100]])
  const alt = { log: console.log, warn: console.warn }
  console.log = () => undefined
  console.warn = () => undefined
  try {
    ordneCartoonsZuAnime()
  } finally {
    console.log = alt.log
    console.warn = alt.warn
  }
  const uebrig = lies<{ id: number }[]>('public/data/cartoons.json')
  pruefe('Umzug bekannt, zwei Staffel-Kandidaten: Cartoon verlässt cartoons.json', uebrig.length === 0, uebrig)
  const umzug = lies<[number, number][]>('data/cartoon-umzug.json')
  pruefe('Umzug bleibt auf der ersten Staffel (kein zweiter Eintrag, kein Wechsel)', JSON.stringify(umzug) === '[[-900001,900100]]', umzug)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nCartoon-Umzug im Bau: alle Zusicherungen erfüllt')
