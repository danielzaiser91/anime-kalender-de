/**
 * Zusicherungen für Bewertung, Schlagworte und Banner nach dem Wechsel von AniList (Daniel, 11.10.2026):
 *
 * - Bewertung: keine AniList-Bewertung mehr im Datensatz. Jeder Wert (außer TMDB bei Cartoons) ist der Klarwert der aniSearch-Seite des Titels.
 * - Schlagworte: keins außerhalb der festen Liste (`shared/schlagworte.ts`).
 * - Banner: nur das TMDB-Bild aus `data/tmdb-banner.json` oder, wo TMDB keins hat, das markierte Übergangs-Banner von AniList.
 *
 * Aufruf: `npx tsx pipeline/check-anilist-produkt.ts` (Einheiten, `check:logic`) und `… --bestand` (gebauter Datensatz, `check:anilist-bestand`)
 */
import { readJson } from './lib/util.ts'
import { ladeBewertungen, parseKlarwert, parseSchlagworte } from './lib/anisearch-bewertung.ts'
import { BANNER_DATEI, bannerAdresse, waehleBanner, type TmdbBanner } from './lib/tmdb-banner.ts'
import { SCHLAGWORT_LISTE, SCHLAGWORT_MAX } from '../shared/schlagworte.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) {
    console.log(`  ✓ ${name}`)
    return
  }
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

function einheiten(): void {
  pruefe('Klarwert wird gelesen', parseKlarwert('<td>Klarwert<b>4.00 = 80%</b></td>') === 80)
  pruefe('Klarwert 0 % heißt keine Bewertung', parseKlarwert('<td>Klarwert<b>0.00 = 0%</b></td>') === undefined)
  const seite = (kennungen: string[]): string =>
    `<section id="genres-tags">${kennungen.map((k) => `<li><a href="anime/genre/tag/${k}" class="gt showpop">x</a></li>`).join('')}</section><section id="x"><a href="anime/genre/tag/school">`
  pruefe('Schlagworte: Liste durchlassen, Rest weglassen', parseSchlagworte(seite(['present', 'tragedy', 'school'])).join() === 'Gegenwart,Schule')
  pruefe('Schlagworte: nur der Abschnitt der Seite zählt', !parseSchlagworte(seite(['tragedy'])).includes('Schule'))
  pruefe('Schlagworte: höchstens SCHLAGWORT_MAX', parseSchlagworte(seite(Object.keys(SCHLAGWORT_LISTE))).length === SCHLAGWORT_MAX)
  const bild = (breite: number, hoehe: number, sprache: string | null) => ({ file_path: `/${breite}x${hoehe}${sprache}.jpg`, width: breite, height: hoehe, iso_639_1: sprache })
  pruefe('Banner: ohne Schrift vor Sprache, Querformat ab 1280 px', waehleBanner([bild(1920, 1080, 'ja'), bild(1280, 720, null), bild(2000, 3000, null)])?.file_path === '/1280x720null.jpg')
  pruefe('Banner: zu schmal oder Hochformat gibt keins', waehleBanner([bild(1000, 562, null), bild(1000, 1500, null)]) === undefined)
}

const host = (u: string): string => {
  try {
    return new URL(u).host
  } catch {
    return ''
  }
}

function pruefeTitel(datei: string, titel: Title[], banner: TmdbBanner): void {
  const bewertungen = ladeBewertungen()
  const erlaubt = new Set(Object.values(SCHLAGWORT_LISTE))
  const schlecht = { score: [] as number[], schlagwort: [] as string[], banner: [] as number[] }
  for (const t of titel) {
    if (t.score !== undefined && t.scoreQuelle !== 'tmdb') {
      const klar = t.anisearchId === undefined ? undefined : bewertungen.get(t.anisearchId)?.klarwert
      if (klar !== t.score) schlecht.score.push(t.id)
    }
    for (const k of t.keywords ?? []) if (!erlaubt.has(k)) schlecht.schlagwort.push(`${t.id}:${k}`)
    if (!t.bannerImage) continue
    const tmdb = banner[String(t.id)]?.p
    const ok = host(t.bannerImage) === 'image.tmdb.org' ? tmdb && t.bannerImage === bannerAdresse(tmdb) : host(t.bannerImage) === 's4.anilist.co' && !tmdb
    if (!ok) schlecht.banner.push(t.id)
  }
  pruefe(`${datei}: jede Bewertung ist der aniSearch-Klarwert (keine von AniList)`, schlecht.score.length === 0, schlecht.score.slice(0, 5))
  pruefe(`${datei}: kein Schlagwort außerhalb der Liste`, schlecht.schlagwort.length === 0, schlecht.schlagwort.slice(0, 5))
  pruefe(`${datei}: Banner nur von TMDB oder als Übergang, wo TMDB keins hat`, schlecht.banner.length === 0, schlecht.banner.slice(0, 5))
}

function bestand(): void {
  const banner = readJson<TmdbBanner>(BANNER_DATEI, {})
  for (const datei of ['titles', 'titles-core', 'ohne-synchro']) pruefeTitel(datei, readJson<Title[]>(`public/data/${datei}.json`, []), banner)
  pruefeTitel('woche', readJson<{ titles?: Title[] }>('public/data/woche.json', {}).titles ?? [], banner)
}

/* Der Bestand ist der gebaute (`check:bestand`, direkt nach dem Bau); ohne `--bestand` laufen nur die Einheiten (`check:logic`, vor dem Bau). */
if (process.argv.includes('--bestand')) bestand()
else einheiten()
if (fehler > 0) {
  console.error(`${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('Bewertung, Schlagworte und Banner stimmen.')
