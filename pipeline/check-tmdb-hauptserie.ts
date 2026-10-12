/**
 * Zusicherungen zu `lib/tmdb-hauptserie.ts`: ein Special/OVA/ONA bekommt keine TMDB-Hauptserie als eigene Kennung (Befund 12.10.2026).
 * Aufruf: `npm run check:logic`.
 */
import { findeGeteilteHauptserien, streicheZuordnungen, type TitelKurz, type TmdbEintrag } from './lib/tmdb-hauptserie.ts'
import { readJson } from './lib/util.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const tv = (id: number, titleEn: string, episodes = 12): TitelKurz => ({ id, format: 'TV', episodes, titleEn, titleRomaji: titleEn })
const kurz = (id: number, format: string, titleEn: string, episodes = 1): TitelKurz => ({ id, format, episodes, titleEn, titleRomaji: titleEn })
const serie = (tmdbId: number, nameDe: string): TmdbEintrag => ({ tmdbId, kind: 'tv', nameDe })
type Folgen = Record<string, { folgen?: { s: number }[] }>
const suche = (titles: TitelKurz[], cache: Record<string, TmdbEintrag>, vonHand: number[] = [], tmdbFolgen: Folgen = {}) =>
  findeGeteilteHauptserien({ titles, cache, tmdbFolgen, vonHand: new Set(vonHand) })

console.log('\nTMDB-Hauptserie: der Befund vom 12.10.2026')
const ubw = serie(61415, 'Fate/stay night: Unlimited Blade Works')
const prolog = suche(
  [tv(19603, 'Fate/stay night: Unlimited Blade Works'), kurz(10010005, 'SPECIAL', 'Fate/Stay Night: Unlimited Blade Works - Prologue')],
  { 19603: ubw, 10010005: ubw },
)
pruefe('aniSearch-Special am TV-Titel derselben Serie: gestrichen', JSON.stringify(prolog) === '[10010005]', prolog)
pruefe('der TV-Titel selbst behält die Kennung', !prolog.includes(19603))
const cache: Record<string, object> = { 10010005: { ...ubw, overviewDe: 'x', offers: [] } }
streicheZuordnungen(cache, [10010005], '2026-10-12T00:00:00.000Z')
pruefe(
  'gestrichen heißt Fehlschlag mit Wiedervorlage, ohne Handlung und Anbieter',
  JSON.stringify(cache[10010005]) === '{"miss":true,"fetchedAt":"2026-10-12T00:00:00.000Z"}',
  cache[10010005],
)

console.log('\nTMDB-Hauptserie: was bleiben muss')
const show = { 1: serie(5, 'Show'), 9: serie(5, 'Show') }
pruefe('zwei TV-Staffeln an einer Serie bleiben', suche([tv(1, 'Show'), tv(2, 'Show 2')], { 1: serie(5, 'Show'), 2: serie(5, 'Show') }).length === 0)
pruefe('Special mit eigener Kennung (kein TV-Titel an ihr) bleibt', suche([tv(1, 'Show'), kurz(9, 'OVA', 'Show OVA')], { 1: serie(5, 'Show'), 9: serie(6, 'Show OVA') }).length === 0)
pruefe('Special, dessen Name dem TMDB-Namen gleicht, bleibt', suche([tv(1, 'Show'), kurz(9, 'SPECIAL', 'Show')], show).length === 0)
pruefe('Special mit der Folgenzahl einer TMDB-Staffel bleibt', suche([tv(1, 'Show'), kurz(9, 'OVA', 'Anders', 2)], show, [], { 9: { folgen: [{ s: 1 }, { s: 1 }] } }).length === 0)
pruefe('Handbeleg (tmdb-von-hand.yaml) bleibt', suche([tv(1, 'Show'), kurz(9, 'SPECIAL', 'Anders')], show, [9]).length === 0)
pruefe('Film-Kennung bleibt (Movie sucht nur unter /movie)', suche([tv(1, 'Show'), kurz(9, 'MOVIE', 'Anders')], { 1: serie(5, 'Show'), 9: { tmdbId: 5, kind: 'movie', nameDe: 'Show' } }).length === 0)
pruefe('echte TV-Serie ohne Geschwister bleibt', suche([tv(1, 'Show')], { 1: serie(5, 'Show') }).length === 0)
pruefe('Gegenprobe: dasselbe Special mit fremdem Namen und fremder Folgenzahl fällt', suche([tv(1, 'Show'), kurz(9, 'SPECIAL', 'Anders')], show).length === 1)

console.log('\nTMDB-Hauptserie: der Bestand (data/tmdb-titles.json)')
const bestand = readJson<Record<string, TmdbEintrag>>('data/tmdb-titles.json', {})
for (const id of [10010005, 10013612, 10014281]) pruefe(`aniSearch-Special ${id} trägt keine TMDB-Kennung`, !bestand[id]?.tmdbId, bestand[id])

console.log('\nTMDB-Hauptserie: Banner und Folgen hängen an der Kennung (12.10.2026: 45 gestrichene Kennungen führten sie weiter)')
const banner = readJson<Record<string, unknown>>('data/tmdb-banner.json', {})
const folgen = readJson<Record<string, { tmdbId?: number }>>('data/tmdb-folgen.json', {})
const bannerOhneKennung = Object.keys(banner).filter((id) => !bestand[id]?.tmdbId)
const folgenAndere = Object.keys(folgen).filter((id) => folgen[id]!.tmdbId !== bestand[id]?.tmdbId)
pruefe('kein Hintergrundbild (tmdb-banner.json) ohne Kennung in tmdb-titles.json', bannerOhneKennung.length === 0, bannerOhneKennung)
pruefe('keine Folgenliste (tmdb-folgen.json) einer anderen Kennung als in tmdb-titles.json', folgenAndere.length === 0, folgenAndere)

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Hauptserie: alle Zusicherungen halten.')
