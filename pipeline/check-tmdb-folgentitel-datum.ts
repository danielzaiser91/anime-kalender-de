/**
 * Zusicherungen zu `bau/folgentitel-tmdb-datum.ts`: Ein TMDB-Titel gilt über Sendetag und englischen Titel, auch wenn die Serie bei TMDB anders heißt
 * und anders in Staffeln liegt. Die Fixtures sind echte Zeilen: TMDB 60572 „Pokémon“ Staffel 25 (Abruf 06.10.2026) und aniSearch 14596 „Pokémon Reisen“.
 * Aufruf: `npm run check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { type TmdbFolge } from './bau/folgentitel-tmdb.ts'
import { tmdbTitelNachDatum } from './bau/folgentitel-tmdb-datum.ts'
import { mitFremdTiteln, type TitelQuellen } from './bau/folgentitel-stufen.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const tm = (s: number, e: number, en: string, titel: string, datum: string): TmdbFolge => ({ s, e, en, titel, datum })
const tmdb: TmdbFolge[] = [
  tm(25, 1, 'The Spectral Express!', 'Der Geister-Express!', '2021-12-17'),
  tm(25, 13, 'The Future Is Now, Thanks to Strategy!', 'Die richtige Strategie katapultiert uns in die Zukunft!', '2022-04-01'),
  tm(25, 14, 'Taking Two for the Team!', 'Zwei Pokémon, ein Team!', '2022-04-01'),
  tm(25, 29, 'Koharu and Eievui - The Miracle of Evolution', 'Folge 29', '2022-07-29'),
  tm(0, 1, 'Special Zero', 'Ein Special', '2022-01-01'),
]
const af = (nr: number, en: string, datum: string, de?: string) => ({ nr, en, datum, ...(de ? { de } : {}) })
const as = [
  af(91, 'The Spectral Express!', '2021-12-17'),
  af(103, 'The Future Is Now, Thanks to Strategy!', '2022-04-01'),
  af(104, 'Taking Two for the Team!', '2022-04-01'),
  af(119, 'Koharu and Eievui: The Tracks of Evolution', '2022-07-29'),
]
const aus = tmdbTitelNachDatum(as, { folgen: tmdb })

console.log('\nTMDB-Folgentitel über Sendetag und englischen Titel')
pruefe('Folge 91: Sendetag und englischer Titel gleich gibt den deutschen Titel', aus?.get(91) === 'Der Geister-Express!', aus && [...aus])
pruefe('zwei Folgen am selben Tag (103, 104): der englische Titel trennt sie', aus?.get(103) === 'Die richtige Strategie katapultiert uns in die Zukunft!' && aus?.get(104) === 'Zwei Pokémon, ein Team!')
pruefe('TMDB-Platzhalter „Folge 29“ gibt nichts (119)', !aus?.has(119))
pruefe('eine Folge mit deutschem Titel bleibt unberührt', tmdbTitelNachDatum([af(91, 'The Spectral Express!', '2021-12-17', 'Vorhanden')], { folgen: tmdb }) === undefined)
pruefe('gleicher englischer Titel, anderer Sendetag: nichts', tmdbTitelNachDatum([af(91, 'The Spectral Express!', '2021-12-18')], { folgen: tmdb }) === undefined)
pruefe('gleicher Sendetag, anderer englischer Titel: nichts', tmdbTitelNachDatum([af(91, 'Another Express!', '2021-12-17')], { folgen: tmdb }) === undefined)
pruefe('ohne Sendetag oder ohne englischen Titel: nichts', tmdbTitelNachDatum([{ nr: 91, en: 'The Spectral Express!' }, { nr: 92, datum: '2021-12-17' }], { folgen: tmdb }) === undefined)
pruefe('zwei TMDB-Folgen mit gleichem Tag und Titel sind nicht eindeutig: nichts', tmdbTitelNachDatum(as.slice(0, 1), { folgen: [...tmdb, tm(26, 1, 'The Spectral Express!', 'Anderer Titel!', '2021-12-17')] }) === undefined)
pruefe('Staffel 0 (Specials) zählt nicht', tmdbTitelNachDatum([af(1, 'Special Zero', '2022-01-01')], { folgen: tmdb }) === undefined)
pruefe('ohne TMDB-Eintrag oder ohne Liste: nichts', tmdbTitelNachDatum(as, undefined) === undefined && tmdbTitelNachDatum(undefined, { folgen: tmdb }) === undefined)
pruefe('englischer Titel ohne Satzzeichen und Großschreibung gleich (Apostroph)', tmdbTitelNachDatum([af(1, 'THE SPECTRAL EXPRESS', '2021-12-17')], { folgen: tmdb })?.get(1) === 'Der Geister-Express!')
pruefe('deutscher Titel gleich dem englischen (nicht übersetzt): nichts', tmdbTitelNachDatum(as.slice(0, 1), { folgen: [tm(25, 1, 'The Spectral Express!', 'The Spectral Express!', '2021-12-17')] }) === undefined)

console.log('\nTMDB-Folgentitel über Sendetag: im Bau (mitFremdTiteln)')
const serie = { id: 900002, format: 'TV', jpYear: 2019, episodes: 136, streams: [], titleRomaji: 'Pocket Monsters (2019)', titleDe: 'Pokémon Reisen: Die Serie' } as unknown as Title
const quellen = (eintrag: { folgen: TmdbFolge[] } | undefined): TitelQuellen => ({
  crSerien: new Map(),
  tmdbFolgen: eintrag ? { 900002: eintrag } : {},
  tmdbNamen: { 900002: { nameDe: 'Pokémon' } },
  kitsu: {},
  rtlplus: {},
  hand: {},
})
const imBau = mitFremdTiteln(serie, as, quellen({ folgen: tmdb }))
pruefe('Bau: Titel 91, 103 und 104 kommen an, 119 (Platzhalter) bleibt leer', imBau?.find((f) => f.nr === 91)?.de === 'Der Geister-Express!' && imBau?.find((f) => f.nr === 104)?.de === 'Zwei Pokémon, ein Team!' && !imBau?.find((f) => f.nr === 119)?.de, imBau)
pruefe('Bau: ohne TMDB-Eintrag bleibt alles leer (Kontrolle)', mitFremdTiteln(serie, as, quellen(undefined))?.every((f) => !f.de) === true)
pruefe('Bau: ein vorhandener aniSearch-Titel bleibt', mitFremdTiteln(serie, [af(91, 'The Spectral Express!', '2021-12-17', 'Aus aniSearch'), ...as.slice(1)], quellen({ folgen: tmdb }))?.[0].de === 'Aus aniSearch')

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nTMDB-Folgentitel über Sendetag: alle Zusicherungen erfüllt (${faelle} Fälle).`)
