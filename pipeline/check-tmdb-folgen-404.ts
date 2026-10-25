/**
 * Zusicherungen zu `lib/tmdb-folgen-404.ts` und zur Auswahl mit Vermerk: nur 404 auf den Serien-Abruf ist eine Auskunft (500 nach
 * Wiederholungen, 429, Netzfehler, 404 auf Staffeln nicht); der Vermerk hält 29 Tage zurück und gibt am 30. Tag frei; andere TMDB-Kennung zählt nicht.
 * Aufruf: `npm run check:logic`.
 */
import { istSerie404, vermerkGilt } from './lib/tmdb-folgen-404.ts'
import { waehleAbrufe } from './lib/tmdb-folgen-luecke.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const url = (pfad: string): string => `https://api.themoviedb.org/3${pfad}api_key=x&language=de-DE`
const fehler = (text: string): Error => new Error(text)

console.log('\nTMDB 404: Welche Fehler eine Auskunft sind')
pruefe('404 auf den Serien-Abruf', istSerie404(fehler(`404 Not Found: ${url('/tv/326788?')}`), 326788))
pruefe('404 ohne Statustext', istSerie404(fehler(`404 : ${url('/tv/326788?')}`), 326788))
pruefe('500 nach Wiederholungen', !istSerie404(fehler(`500 nach 5 Versuchen: ${url('/tv/326788?')}`), 326788))
pruefe('403', !istSerie404(fehler(`403 Forbidden: ${url('/tv/326788?')}`), 326788))
pruefe('429 nach Wiederholungen', !istSerie404(fehler(`429 nach 5 Versuchen: ${url('/tv/326788?')}`), 326788))
pruefe('Netzfehler', !istSerie404(fehler('fetch failed'), 326788))
pruefe('404 auf eine Staffel', !istSerie404(fehler(`404 Not Found: ${url('/tv/326788/season/1?')}`), 326788))
pruefe('404 einer anderen Serie', !istSerie404(fehler(`404 Not Found: ${url('/tv/333069?')}`), 326788))
pruefe('404 mit längerer Kennung gleichen Anfangs', !istSerie404(fehler(`404 Not Found: ${url('/tv/3267881?')}`), 326788))

console.log('\nTMDB 404: Altersgrenze')
const v = { tmdbId: 5, geprueft: '2026-09-24' }
pruefe('29 Tage: gilt', vermerkGilt(v, 5, '2026-10-23', 30))
pruefe('30 Tage: frei', !vermerkGilt(v, 5, '2026-10-24', 30))
pruefe('31 Tage: frei', !vermerkGilt(v, 5, '2026-10-25', 30))
pruefe('Grenze folgt dem Aufruf (--alter 10, 9 Tage)', vermerkGilt(v, 5, '2026-10-03', 10) && !vermerkGilt(v, 5, '2026-10-04', 10))
pruefe('andere TMDB-Kennung: gilt nicht', !vermerkGilt(v, 6, '2026-09-25', 30))
pruefe('ohne Kennung im Titel: gilt nicht', !vermerkGilt(v, undefined, '2026-09-25', 30))
pruefe('ohne Vermerk: gilt nicht', !vermerkGilt(undefined, 5, '2026-09-25', 30))

console.log('\nTMDB 404: Auswahl')
const kand = (id: string, tmdbId: number): { id: string; t: { streams: unknown[]; episodes: number }; tmdb: { tmdbId: number } } => ({ id, t: { streams: [{}], episodes: 12 }, tmdb: { tmdbId } })
const alle = [kand('a', 1), kand('b', 2), kand('c', 3)]
const wahl = (heute: string, nurLuecke: boolean, fehlt?: Record<string, { tmdbId: number; geprueft: string }>): string =>
  waehleAbrufe({ alle, bestand: {}, heute, alterTage: 30, limit: 10, nurLuecke, luecke: () => 1, fehlt }).map((x) => x.id).join(',')
const fehlt = { b: { tmdbId: 2, geprueft: '2026-09-24' } }
pruefe('regulär: Vermerk am 29. Tag hält b zurück', wahl('2026-10-23', false, fehlt) === 'a,c', wahl('2026-10-23', false, fehlt))
pruefe('Lückenlauf: Vermerk am 29. Tag hält b zurück', wahl('2026-10-23', true, fehlt) === 'a,c')
pruefe('am 30. Tag ist b wieder dran', wahl('2026-10-24', false, fehlt) === 'a,b,c')
pruefe('Vermerk einer anderen Kennung hält nicht zurück', wahl('2026-10-23', false, { b: { tmdbId: 9, geprueft: '2026-09-24' } }) === 'a,b,c')
pruefe('Vermerk eines anderen Titels hält b nicht zurück', wahl('2026-10-23', false, { a: { tmdbId: 1, geprueft: '2026-09-24' } }) === 'b,c')
pruefe('ohne Vermerke unverändert', wahl('2026-10-23', false) === 'a,b,c')

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB 404: alle Zusicherungen halten.')
