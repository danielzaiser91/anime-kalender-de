/**
 * Bestandsprüfung (`public/data`): Titel ohne TMDB-Kennung fragt JustWatch über den Namen (`lib/jw-namenssuche.ts`, Tageslauf `data:justwatch-frisch --namen N`).
 * Gemeldet wird, wie viele es sind, wie viele nie gefragt wurden, wie viele ihren Befund verloren haben (älter als 28 Tage, der Bau liest ihn nicht mehr)
 * und ob die Läufe der letzten 21 Tage für alle reichen. Nur Warnung (Exit 0): neue aniSearch-Titel kommen täglich ohne TMDB-Kennung hinzu.
 * Test der Rechenregeln und der Verdrahtung in `package.json`: `check-jw-namenssuche.ts`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import { ROOT, readJson } from './lib/util.ts'
import { namenProLauf, namensLage } from './lib/jw-namenssuche.ts'

const BEFUND_MAX_TAGE = 28
const titles = [...readJson<Title[]>('public/data/titles.json', []), ...readJson<Title[]>('public/data/cartoons.json', [])]
const tmdb = readJson<Record<string, { tmdbId?: number }>>('data/tmdb-titles.json', {})
const bestand = readJson<Record<string, { geprueftAm: string }>>('data/justwatch-audio.json', {})
const skripte = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>
const proLauf = namenProLauf(skripte['data:justwatch-frisch'])
const grenze = new Date(Date.now() - BEFUND_MAX_TAGE * 86_400_000).toISOString().slice(0, 10)
const l = namensLage(titles, bestand, (t) => (t as Title & { tmdbId?: number }).tmdbId ?? tmdb[String(t.id)]?.tmdbId, grenze, proLauf)

console.log(
  `JustWatch ohne TMDB-Kennung: ${l.ohneTmdb} Titel, nie gefragt ${l.nieGefragt}, Befund verfallen ${l.verfallen}; Tageslauf fragt ${proLauf} je Lauf (${l.kapazitaet} in 21 Tagen).`,
)
if (l.verfallen)
  console.log(`  ⚠ WARNUNG JustWatch ohne TMDB-Kennung: ${l.verfallen} Titel mit abgelaufenem Befund (älter als ${BEFUND_MAX_TAGE} Tage) — die Namenssuche kommt nicht hinterher (data:justwatch-frisch --namen)`)
if (l.kapazitaet < l.ohneTmdb)
  console.log(`  ⚠ WARNUNG JustWatch ohne TMDB-Kennung: ${l.ohneTmdb} Titel, aber nur ${l.kapazitaet} Abfragen in 21 Tagen — --namen in data:justwatch-frisch erhöhen`)
console.log('VERSTÖSSE: 0')
