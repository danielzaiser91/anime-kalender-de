/**
 * Bestandsteil von `check-tmdb-hauptserie.ts`: die TMDB-Dateien unter `data/` (vom Sammler geschrieben) halten die Zusicherungen vom 12.10.2026.
 * Liest die echten Dateien (oder die Kulisse unter `AK_ROOT`), deshalb in `check:bestand`; `check-tmdb-hauptserie.ts` fährt diese Prüfung gegen eigene Kulissen.
 */
import { type TmdbEintrag } from './lib/tmdb-hauptserie.ts'
import { readJson } from './lib/util.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nTMDB-Hauptserie: der Bestand (data/tmdb-titles.json)')
const bestand = readJson<Record<string, TmdbEintrag>>('data/tmdb-titles.json', {})
for (const id of [10010005, 10013612, 10014281]) pruefe(`aniSearch-Special ${id} trägt keine TMDB-Kennung`, !bestand[id]?.tmdbId, bestand[id])

console.log('\nTMDB-Hauptserie: Banner und Folgen hängen an der Kennung (12.10.2026: 45 gestrichene Kennungen führten sie weiter)')
const banner = readJson<Record<string, unknown>>('data/tmdb-banner.json', {})
const folgen = readJson<Record<string, { tmdbId?: number }>>('data/tmdb-folgen.json', {})
/* Ein Titel mit Staffel-0-Zuordnung (`tmdb-staffel0.json`) trägt keine Serienkennung, aber das Standbild seiner Folge. */
const staffel0 = readJson<Record<string, unknown>>('data/tmdb-staffel0.json', {})
const bannerOhneKennung = Object.keys(banner).filter((id) => !bestand[id]?.tmdbId && !(id in staffel0))
const folgenAndere = Object.keys(folgen).filter((id) => folgen[id]!.tmdbId !== bestand[id]?.tmdbId)
pruefe('kein Hintergrundbild (tmdb-banner.json) ohne Kennung in tmdb-titles.json oder Zuordnung in tmdb-staffel0.json', bannerOhneKennung.length === 0, bannerOhneKennung)
pruefe('keine Folgenliste (tmdb-folgen.json) einer anderen Kennung als in tmdb-titles.json', folgenAndere.length === 0, folgenAndere)

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('\nTMDB-Hauptserie (Bestand): alle Zusicherungen halten.')
console.log('VERSTÖSSE: 0')
