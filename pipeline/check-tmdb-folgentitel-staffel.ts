/**
 * Zusicherungen zu `bau/folgentitel-tmdb-staffel.ts`: Container-Staffeln („… Staffel N", Miraculous) nehmen die
 * TMDB-Staffel N der Franchise-Kennung, nach Name und Folgenzahl, nicht nach Jahr.
 * Aufruf: `npm run check:logic`.
 */
import type { Title } from '../shared/types.ts'
import type { TmdbEintrag, TmdbFolge } from './bau/folgentitel-tmdb.ts'
import { tmdbStaffelFolgentitel } from './bau/folgentitel-tmdb-staffel.ts'
import { mitFremdTiteln, type TitelQuellen } from './bau/folgentitel-stufen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const NAME = 'Beispiel - Geschichten von Heldin und Kater'
const staffel = (s: number, n: number, jahr: number): TmdbFolge[] =>
  Array.from({ length: n }, (_, i) => ({ s, e: i + 1, titel: `S${s}E${i + 1}`, en: `English ${s}-${i + 1}`, datum: `${jahr}-0${1 + (i % 9)}-15` }))
// Staffel 2 hat 25 Folgen, 2017 bei TMDB; Staffel 3 und 4 haben 26 (2019, 2021), Staffel 5 ebenfalls 26 (2022).
const eintrag = (extra: Partial<TmdbEintrag> = {}): TmdbEintrag => ({
  nameDe: NAME,
  folgen: [...staffel(0, 2, 2016), ...staffel(1, 26, 2015), ...staffel(2, 25, 2017), ...staffel(3, 26, 2019), ...staffel(4, 26, 2021), ...staffel(5, 26, 2022)],
  ...extra,
})
const titel = (n: number, folgen: number, extra: object = {}) =>
  ({ id: 900010 + n, franchiseId: 900001, format: 'TV', episodes: folgen, jpYear: 2018, titleDe: `Beispiel: Geschichten von Heldin und Kater Staffel ${n}`, streams: [], ...extra }) as unknown as Title
const bis = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
const aus = (n: number, folgen: number, e = eintrag(), extra: object = {}) => tmdbStaffelFolgentitel(titel(n, folgen, extra), e, bis(folgen))

console.log('\nTMDB-Folgentitel Container-Staffeln: Zuordnung')
pruefe('Staffel 2 (25 Folgen) nimmt TMDB-Staffel 2, auch bei abweichendem Jahr (2018 gegen 2017)', aus(2, 25)?.size === 25 && aus(2, 25)?.get(1) === 'S2E1' && aus(2, 25)?.get(25) === 'S2E25')
pruefe('Staffel 4 nimmt TMDB-Staffel 4 (2021), nicht die Jahres-Nachbarin 5 (2022)', aus(4, 26, eintrag(), { jpYear: 2022 })?.get(1) === 'S4E1')
pruefe('Staffel 3 nimmt TMDB-Staffel 3', aus(3, 26)?.get(26) === 'S3E26')
pruefe('Staffel 1 und ein Titel ohne Staffelzusatz gelten hier nicht', aus(1, 26) === undefined && tmdbStaffelFolgentitel(titel(2, 25, { titleDe: 'Beispiel: Geschichten von Heldin und Kater' }), eintrag(), bis(25)) === undefined)
pruefe('Staffelzahl mitten im Namen zählt nicht', tmdbStaffelFolgentitel(titel(2, 25, { titleDe: 'Beispiel: Geschichten von Heldin und Kater Staffel 2 Special' }), eintrag(), bis(25)) === undefined)

console.log('\nTMDB-Folgentitel Container-Staffeln: Sperren')
pruefe('falsche Folgenzahl (24 statt 25) gibt nichts', aus(2, 24) === undefined)
pruefe('eine Folge mehr (26 statt 25) gibt nichts', aus(2, 26) === undefined)
pruefe('Staffel 6 fehlt bei TMDB: nichts', aus(6, 26) === undefined)
pruefe('anderer TMDB-Name gibt nichts', aus(2, 25, eintrag({ nameDe: 'Ganz Anderes Werk' })) === undefined)
pruefe('ohne TMDB-Namen gibt nichts', aus(2, 25, eintrag({ nameDe: undefined })) === undefined)
pruefe('ohne Franchise-Eintrag und ohne Folgen nichts', tmdbStaffelFolgentitel(titel(2, 25), undefined, bis(25)) === undefined && aus(2, 25, { nameDe: NAME }) === undefined)
pruefe('Film gilt nicht, ONA gilt', aus(2, 25, eintrag(), { format: 'MOVIE' }) === undefined && aus(2, 25, eintrag(), { format: 'ONA' })?.size === 25)
pruefe('Staffel mit weniger als sechs Folgen gilt nicht', tmdbStaffelFolgentitel(titel(2, 5), { nameDe: NAME, folgen: staffel(2, 5, 2017) }, bis(5)) === undefined)
pruefe('Lücke in den TMDB-Folgennummern gibt nichts', aus(2, 25, eintrag({ folgen: staffel(2, 26, 2017).filter((f) => f.e !== 7) })) === undefined)
pruefe('englischer Rückfall und Platzhalter fehlen, Rest steht an der richtigen Nummer', (() => {
  const e = eintrag({ folgen: staffel(2, 25, 2017).map((f) => (f.e === 3 ? { ...f, titel: 'English 2-3' } : f.e === 4 ? { ...f, titel: 'Folge 4' } : f)) })
  const a = aus(2, 25, e)
  return a?.size === 23 && !a.has(3) && !a.has(4) && a.get(5) === 'S2E5'
})())
pruefe('nur Nummern, die wir führen, bekommen Titel', tmdbStaffelFolgentitel(titel(2, 25), eintrag(), [1, 2])?.size === 2)

console.log('\nTMDB-Folgentitel Container-Staffeln: im Bau (mitFremdTiteln)')
const quellen = (fe: TmdbEintrag | undefined, eigen?: TmdbEintrag): TitelQuellen => ({
  crSerien: new Map(),
  tmdbFolgen: { ...(fe ? { 900001: fe } : {}), ...(eigen ? { 900012: eigen } : {}) },
  tmdbNamen: { 900012: { nameDe: undefined } },
  kitsu: {},
  rtlplus: {},
  hand: {},
})
const leer = bis(25).map((nr) => ({ nr }))
const imBau = mitFremdTiteln(titel(2, 25), leer, quellen(eintrag()))
pruefe('Liste ohne Titel wird aus der Franchise-Kennung gefüllt, Folge 1 trägt den Titel der Staffel 2', imBau?.length === 25 && imBau[0].de === 'S2E1' && imBau[24].de === 'S2E25', imBau?.[0])
pruefe('ohne Franchise-Eintrag bleibt die Liste leer', mitFremdTiteln(titel(2, 25), leer, quellen(undefined))?.every((f) => !f.de) === true)
pruefe('ein vorhandener Titel bleibt', mitFremdTiteln(titel(2, 25), leer.map((f) => (f.nr === 1 ? { ...f, de: 'aus aniSearch' } : f)), quellen(eintrag()))?.[0].de === 'aus aniSearch')
const teilliste = mitFremdTiteln(titel(2, 25), leer.map((f) => (f.nr === 5 ? { ...f, de: 'Teilliste aus aniSearch' } : f)), quellen(eintrag()))
pruefe('eine Teilliste (ein Titel vorhanden) wird nicht aus der Franchise-Staffel gefüllt', teilliste?.[0].de === undefined && teilliste?.[4].de === 'Teilliste aus aniSearch', teilliste?.[0])
const andereFranchise = mitFremdTiteln(titel(2, 25, { franchiseId: 900099 }), leer, quellen(eintrag()))
pruefe('Eintrag einer fremden Franchise-Kennung wird nicht benutzt', andereFranchise?.every((f) => !f.de) === true)
const eigenEintrag = mitFremdTiteln(titel(2, 25), leer, quellen(eintrag(), { nameDe: NAME, folgen: staffel(1, 25, 2018) }))
pruefe('ein eigener TMDB-Eintrag des Titels hat Vorrang vor der Franchise-Staffel', eigenEintrag?.[0].de === 'S1E1' && eigenEintrag[24].de === 'S1E25', eigenEintrag?.[0])

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Folgentitel Container-Staffeln: alle Zusicherungen erfüllt (22 Fälle).')
