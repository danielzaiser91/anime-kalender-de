/**
 * Zusicherungen zu `bau/folgentitel-tmdb.ts`, Zweig ohne Folgenzahl (Shin-chan, Beyblade X): TMDB-Staffeln hintereinander
 * gelegt geben die durchgehende Nummerierung, aber nur, wenn alles zusammenpasst.
 * Aufruf: `npm run check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { tmdbFolgentitel, type TmdbFolge } from './bau/folgentitel-tmdb.ts'
import { mitFremdTiteln, type TitelQuellen } from './bau/folgentitel-stufen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Staffel `s` mit `n` Folgen, erster Sendetag `start`; deutsche Titel „S<s>E<e>", englische Vergleichstitel „Episode title". */
const staffel = (s: number, n: number, start: string): TmdbFolge[] =>
  Array.from({ length: n }, (_, i) => ({ s, e: i + 1, titel: `S${s}E${i + 1}`, en: `Episode title ${s}-${i + 1}`, datum: i === 0 ? start : `${start.slice(0, 4)}-12-31` }))
const serie = (extra: object = {}) => ({ id: 900001, format: 'TV', jpYear: 1992, streams: [], titleRomaji: 'Beispiel Langläufer', ...extra }) as unknown as Title
const bis = (n: number, ab = 1) => Array.from({ length: n }, (_, i) => i + ab)
const drei = [...staffel(1, 10, '1992-04-13'), ...staffel(2, 8, '1993-05-01'), ...staffel(3, 12, '1995-06-02')]
const ohneZahl = (folgen: TmdbFolge[], nummern: number[], titel = serie(), name = 'Beispiel Langläufer') => tmdbFolgentitel(titel, name, { folgen }, nummern)

console.log('\nTMDB-Folgentitel ohne Folgenzahl')
const aus = ohneZahl(drei, bis(30))
pruefe('drei Staffeln (10+8+12) = 30 Nummern: Nummer 1, 10, 11, 18, 19, 30 treffen Staffel und Folge', aus?.size === 30 && aus.get(1) === 'S1E1' && aus.get(10) === 'S1E10' && aus.get(11) === 'S2E1' && aus.get(18) === 'S2E8' && aus.get(19) === 'S3E1' && aus.get(30) === 'S3E12', aus && [...aus].slice(8, 12))
pruefe('Reihenfolge der Eingabe ist gleich (gemischt)', JSON.stringify([...(ohneZahl([...drei].reverse(), bis(30)) ?? [])].sort((a, b) => a[0] - b[0])) === JSON.stringify([...(aus ?? [])].sort((a, b) => a[0] - b[0])))
pruefe('eine Staffel (Beyblade X: 128) reicht', ohneZahl(staffel(1, 128, '1992-01-01'), bis(128))?.get(128) === 'S1E128')
pruefe('genau 6 Folgen gelten, 5 nicht', ohneZahl(staffel(1, 6, '1992-01-01'), bis(6))?.size === 6 && ohneZahl(staffel(1, 5, '1992-01-01'), bis(5)) === undefined)
pruefe('ONA gilt wie TV', ohneZahl(drei, bis(30), serie({ format: 'ONA' }))?.size === 30)
pruefe('Film und Special gelten nicht', ohneZahl(drei, bis(30), serie({ format: 'MOVIE' })) === undefined && ohneZahl(drei, bis(30), serie({ format: 'SPECIAL' })) === undefined)
pruefe('andere Serie bei TMDB gibt nichts', ohneZahl(drei, bis(30), serie(), 'Ganz Anderes Werk') === undefined)
pruefe('ohne Beginnjahr gibt nichts', ohneZahl(drei, bis(30), serie({ jpYear: undefined })) === undefined)

console.log('\nTMDB-Folgentitel ohne Folgenzahl: Nummern')
pruefe('eine Nummer zu wenig (29) gibt nichts', ohneZahl(drei, bis(29)) === undefined)
pruefe('eine Nummer zu viel (31) gibt nichts', ohneZahl(drei, bis(31)) === undefined)
pruefe('gleich viele Nummern, aber 2 bis 31, gibt nichts', ohneZahl(drei, bis(30, 2)) === undefined)
pruefe('Nummer 0 statt 30 gibt nichts', ohneZahl(drei, [0, ...bis(29)]) === undefined)
pruefe('doppelte Nummer statt der letzten gibt nichts', ohneZahl(drei, [...bis(29), 1]) === undefined)
pruefe('keine Nummern (aniSearch-Liste fehlt) gibt nichts', ohneZahl(drei, []) === undefined)

console.log('\nTMDB-Folgentitel ohne Folgenzahl: Staffelbau')
pruefe('Staffel 0 (Specials) zählt nicht mit und verschiebt nichts', ohneZahl([...staffel(0, 5, '1991-01-01'), ...drei], bis(30))?.get(11) === 'S2E1')
pruefe('Staffel 2 fehlt (1 und 3) gibt nichts', ohneZahl([...staffel(1, 10, '1992-04-13'), ...staffel(3, 12, '1995-06-02')], bis(22)) === undefined)
pruefe('Staffeln fangen bei 2 an gibt nichts', ohneZahl([...staffel(2, 10, '1992-04-13'), ...staffel(3, 12, '1995-06-02')], bis(22)) === undefined)
const mitLuecke = [...staffel(1, 10, '1992-04-13'), ...staffel(2, 8, '1993-05-01')].filter((f) => !(f.s === 1 && f.e === 4))
pruefe('Lücke in der Folgennummer einer Staffel gibt nichts', ohneZahl(mitLuecke, bis(17)) === undefined)
const doppelt = [...staffel(1, 10, '1992-04-13'), { ...staffel(1, 10, '1992-04-13')[3], titel: 'Zweimal' }]
pruefe('doppelte Folgennummer in einer Staffel gibt nichts', ohneZahl(doppelt, bis(11)) === undefined)

console.log('\nTMDB-Folgentitel ohne Folgenzahl: Zeit')
pruefe('Staffel 1 beginnt in einem anderen Jahr als unser Beginn gibt nichts', ohneZahl(drei, bis(30), serie({ jpYear: 1993 })) === undefined)
pruefe('Staffel 2 vor Staffel 1 gibt nichts', ohneZahl([...staffel(1, 10, '1993-04-13'), ...staffel(2, 8, '1992-05-01')], bis(18), serie({ jpYear: 1993 })) === undefined)
pruefe('Staffel 2 am selben ersten Tag wie Staffel 1 gibt nichts', ohneZahl([...staffel(1, 10, '1992-04-13'), ...staffel(2, 8, '1992-04-13')], bis(18)) === undefined)
pruefe('Staffel 2 am Tag danach gilt', ohneZahl([...staffel(1, 10, '1992-04-13'), ...staffel(2, 8, '1992-04-14')], bis(18))?.size === 18)
pruefe('Staffel ohne jedes Datum gibt nichts', ohneZahl([...staffel(1, 10, '1992-04-13'), ...staffel(2, 8, '1993-05-01').map((f) => ({ ...f, datum: null }))], bis(18)) === undefined)

console.log('\nTMDB-Folgentitel ohne Folgenzahl: nur deutsche Titel')
const gemischt = drei.map((f) => (f.s === 2 && f.e === 3 ? { ...f, titel: 'Episode title 2-3' } : f.s === 3 && f.e === 1 ? { ...f, titel: 'Folge 1' } : f))
const teil = ohneZahl(gemischt, bis(30))
pruefe('englischer Rückfall und Platzhalter fehlen, der Rest steht an der richtigen Nummer', teil?.size === 28 && !teil.has(13) && !teil.has(19) && teil.get(20) === 'S3E2', teil && [...teil].length)
pruefe('lauter englische Titel geben nichts', ohneZahl(drei.map((f) => ({ ...f, titel: f.en ?? null })), bis(30)) === undefined)

console.log('\nTMDB-Folgentitel: mit Folgenzahl unverändert')
pruefe('mit Folgenzahl 30 und drei Staffeln: keine Verkettung (alte Regel: eine Staffel muss passen)', ohneZahl(drei, bis(30), serie({ episodes: 30 })) === undefined)
pruefe('mit Folgenzahl 5 gibt nichts, auch bei 5 Folgen', ohneZahl(staffel(1, 5, '1992-01-01'), bis(5), serie({ episodes: 5 })) === undefined)
pruefe('mit Folgenzahl 10 gilt die eine passende Staffel', ohneZahl(drei, bis(10), serie({ episodes: 10 }))?.get(3) === 'S1E3')

console.log('\nTMDB-Folgentitel ohne Folgenzahl: im Bau (mitFremdTiteln)')
const quellen = (folgen: TmdbFolge[]): TitelQuellen => ({ crSerien: new Map(), tmdbFolgen: { 900001: { folgen } }, tmdbNamen: { 900001: { nameDe: 'Beispiel Langläufer' } }, kitsu: {} })
const leereListe = bis(30).map((nr) => ({ nr }))
const imBau = mitFremdTiteln(serie(), leereListe, quellen(drei))
pruefe('aniSearch-Liste ohne Titel wird über die absolute Nummer gefüllt', imBau?.length === 30 && imBau[10].de === 'S2E1' && imBau[29].de === 'S3E12', imBau?.[10])
pruefe('derselbe Titel mit unstimmiger Liste (29 Nummern) bleibt leer', mitFremdTiteln(serie(), leereListe.slice(0, 29), quellen(drei))?.every((f) => !f.de) === true)
pruefe('ein vorhandener Titel bleibt (Nummer 11)', mitFremdTiteln(serie(), leereListe.map((f) => (f.nr === 11 ? { ...f, de: 'Von aniSearch' } : f)), quellen(drei))?.[10].de === 'Von aniSearch')

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Folgentitel ohne Folgenzahl: alle Zusicherungen erfüllt (32 Fälle).')
