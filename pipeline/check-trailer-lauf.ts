/**
 * Prüft den Trailerlauf: Wahl der Titel (30 Tage, Riegel, Reihenfolge), Zwischenspeichern und die Verdrahtung in
 * `main()` gegen ein Wegwerf-Verzeichnis (`AK_ROOT`) mit gefälschtem `fetch` — kein Abruf nach außen.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { todayIso } from '../shared/time.ts'
import { RIEGEL_JE_LAUF, SPEICHERN_ALLE, WIEDERVORLAGE_TAGE, arbeiteInStuecken, lageVon, waehleDran } from './lib/trailer-lauf.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2027-03-15'
const t = (...ids: number[]): { id: number }[] => ids.map((id) => ({ id }))
const ids = (liste: { id: number }[]): string => liste.map((x) => x.id).join(',')

console.log('Konstanten')
pruefe('Riegel 500 je Lauf', RIEGEL_JE_LAUF === 500, RIEGEL_JE_LAUF)
pruefe('Wiedervorlage 30 Tage', WIEDERVORLAGE_TAGE === 30, WIEDERVORLAGE_TAGE)
pruefe('Speichern alle 100 Titel', SPEICHERN_ALLE === 100, SPEICHERN_ALLE)

console.log('Wahl der Titel')
const alle = ids(waehleDran(t(1, 2, 3), {}, HEUTE, 500, 0))
pruefe('ohne Stempel kommen alle dran, in Reihenfolge', alle === '1,2,3', alle)
const neunundzwanzig = ids(waehleDran(t(1), { '1': '2027-02-14' }, HEUTE, 500, 0))
pruefe('Stempel von 29 Tagen schließt aus', neunundzwanzig === '', neunundzwanzig)
const dreissig = ids(waehleDran(t(1), { '1': '2027-02-13' }, HEUTE, 500, 0))
pruefe('Stempel von genau 30 Tagen ist fällig', dreissig === '1', dreissig)
const einunddreissig = ids(waehleDran(t(1), { '1': '2027-02-12' }, HEUTE, 500, 0))
pruefe('Stempel von 31 Tagen ist fällig', einunddreissig === '1', einunddreissig)
const heuteGestempelt = ids(waehleDran(t(1), { '1': HEUTE }, HEUTE, 500, 0))
pruefe('Stempel von heute schließt aus', heuteGestempelt === '', heuteGestempelt)
const kaputt = ids(waehleDran(t(1), { '1': 'gestern' }, HEUTE, 500, 0))
pruefe('unlesbarer Stempel gilt als nie gesucht', kaputt === '1', kaputt)
const reihenfolge = ids(waehleDran(t(1, 2, 3, 4), { '1': '2026-08-01', '2': '2026-07-01', '4': '2026-06-01' }, HEUTE, 500, 0))
pruefe('nie Gesuchte zuerst, dann der älteste Stempel', reihenfolge === '3,4,2,1', reihenfolge)
const riegel = ids(waehleDran(t(1, 2, 3, 4), { '4': '2026-01-01' }, HEUTE, 2, 0))
pruefe('Riegel schneidet nach der Ordnung ab', riegel === '1,2', riegel)
const grenzeKleiner = ids(waehleDran(t(1, 2, 3), {}, HEUTE, 5, 1))
pruefe('--limit 1 unter dem Riegel gilt', grenzeKleiner === '1', grenzeKleiner)
const grenzeGroesser = ids(waehleDran(t(1, 2, 3), {}, HEUTE, 2, 9))
pruefe('--limit über dem Riegel hebt ihn nicht an', grenzeGroesser === '1,2', grenzeGroesser)
const eins = ids(waehleDran(t(1, 2), {}, HEUTE, 1, 0))
pruefe('Riegel 1 liefert genau einen', eins === '1', eins)

console.log('Zwischenspeichern')
const staende: number[] = []
let erledigt = 0
await arbeiteInStuecken(
  [1, 2, 3, 4, 5],
  async () => void erledigt++,
  () => staende.push(erledigt),
  2,
)
pruefe('speichert nach 2, 4 und am Ende', JSON.stringify(staende) === '[2,4,5]', staende)
const leer: number[] = []
await arbeiteInStuecken([], async () => {}, () => leer.push(1), 2)
pruefe('leere Liste speichert einmal', leer.length === 1, leer)
const gen: number[] = []
await arbeiteInStuecken([1, 2], async () => {}, () => gen.push(1), 2)
pruefe('genau ein voller Block speichert nach dem Block und am Ende', gen.length === 2, gen)

console.log('main() gegen Wegwerf-Verzeichnis')
const wurzel = mkdtempSync(join(tmpdir(), 'trailer-lauf-'))
process.env.AK_ROOT = wurzel
process.env.YOUTUBE_API_KEY = 'yt'
process.env.TMDB_API_KEY = 'tm'
const { main } = await import('./fetch-trailer.ts')

const schreibe = (pfad: string, inhalt: unknown): void => {
  mkdirSync(dirname(join(wurzel, pfad)), { recursive: true })
  writeFileSync(join(wurzel, pfad), JSON.stringify(inhalt))
}
const lies = <T>(pfad: string): T => JSON.parse(readFileSync(join(wurzel, pfad), 'utf8')) as T
const titel = [901001, 901002, 901003, 901004, 901005].map((id) => ({ id, format: 'TV', jpYear: 2005, titleEn: `Serie ${id}` }))
function stelleAus(): void {
  for (const f of [join('data', 'trailer.json'), join('data', 'trailer-versuche.json')]) rmSync(join(wurzel, f), { force: true })
  schreibe('public/data/titles.json', titel)
  schreibe('public/data/empfehlung.json', { einstiege: titel.map((x) => ({ id: x.id })) })
  /* 901005 hat keine TMDB-Zuordnung: nichts zu fragen, aber trotzdem gesucht. */
  const tmdb: Record<string, unknown> = {}
  for (const x of titel.slice(0, 4)) tmdb[String(x.id)] = { tmdbId: x.id - 901000, kind: 'tv' }
  schreibe(join('data', 'tmdb-titles.json'), tmdb)
}

const tmdbAbrufe: string[] = []
/** Art und Kennung jedes TMDB-Abrufs, z. B. `tv:12`. */
const arten: string[] = []
let haengeBei = ''
const fehlerBei = new Set<string>()
const netzfehlerBei = new Set<string>()
const nichtGefuehrtBei = new Set<string>()
let kinocheckFehler = false
let leerAlle = false
let kanalVideos: { id: string; titel: string }[] = []

/** Rennt gegen eine Wartezeit: ein hängender Lauf (Frist-Abbruch) endet nie, `true` heißt „kam nicht zu Ende“. */
async function bisAbbruch(lauf: Promise<void>): Promise<boolean> {
  const fertig = lauf.then(() => false)
  const frist = new Promise<boolean>((ok) => setTimeout(() => ok(true), 2500))
  return Promise.race([fertig, frist])
}

globalThis.fetch = (async (eingabe: string | URL | Request): Promise<Response> => {
  const url = String(eingabe)
  const antwort = (daten: unknown, status = 200): Response => new Response(JSON.stringify(daten), { status })
  if (url.includes('/youtube/v3/videos')) {
    const gefragt = (/[?&]id=([^&]+)/.exec(url)?.[1] ?? '').split(',')
    return antwort({ items: gefragt.map((id) => ({ id })) })
  }
  if (url.includes('/youtube/v3/playlistItems')) {
    if (!url.includes('UUDzr05xghFB7lhSJqUVPPlg')) return antwort({ items: [] })
    const items = kanalVideos.map((v) => ({ snippet: { title: v.titel, publishedAt: '2005-06-01T00:00:00Z', resourceId: { videoId: v.id } } }))
    return antwort({ items })
  }
  if (url.includes('api.kinocheck.de')) return kinocheckFehler ? antwort({}, 500) : antwort({ message: 'not found' }, 404)
  const treffer = /\/(tv|movie)\/(\d+)\/videos/.exec(url)
  if (!treffer) throw new Error(`unerwartete Adresse ${url}`)
  const tv = treffer[2]!
  tmdbAbrufe.push(tv)
  arten.push(`${treffer[1]}:${tv}`)
  if (tv === haengeBei) return new Promise<Response>(() => {})
  if (netzfehlerBei.has(tv)) throw new Error('Netz weg')
  if (fehlerBei.has(tv)) return antwort({}, 500)
  if (nichtGefuehrtBei.has(tv)) return antwort({ status_message: 'not found' }, 404)
  /* 3 hat keinen Trailer, 4 einen deutschen, die anderen einen japanischen. */
  if (leerAlle || tv === '3') return antwort({ results: [] })
  if (tv === '4') return antwort({ results: [{ key: 'yt4de', name: 'Trailer', site: 'YouTube', type: 'Trailer', iso_639_1: 'de' }] })
  return antwort({ results: [{ key: `yt${tv}`, name: 'PV', site: 'YouTube', type: 'Trailer', iso_639_1: 'ja' }] })
}) as typeof fetch

stelleAus()
haengeBei = '3'
const abgebrochen = await bisAbbruch(main({ riegel: 3, speichernAlle: 2 }))
pruefe('Lauf bleibt bei Titel 3 hängen (Frist-Abbruch)', abgebrochen)
pruefe('Riegel 3 fragt höchstens drei Titel', tmdbAbrufe.join(',') === '1,2,3', tmdbAbrufe)
const nachAbbruch = lies<Record<string, unknown>>(join('data', 'trailer-versuche.json'))
pruefe('nach dem Abbruch stehen die ersten zwei Stempel auf Platte', Object.keys(nachAbbruch).join(',') === '901001,901002', nachAbbruch)
pruefe('Stempel ist das heutige Datum', nachAbbruch['901001'] === todayIso(), nachAbbruch['901001'])
pruefe('die zwei Funde stehen in trailer.json', Object.keys(lies<object>(join('data', 'trailer.json'))).join(',') === '901001,901002')

tmdbAbrufe.length = 0
haengeBei = ''
await main({ riegel: 3, speichernAlle: 2 })
pruefe('zweiter Lauf: Gestempelte bleiben draußen, nie Gesuchte kommen dran', tmdbAbrufe.join(',') === '3,4', tmdbAbrufe)
const nach2 = lies<Record<string, string>>(join('data', 'trailer-versuche.json'))
pruefe('Titel ohne Zuordnung trägt auch einen Stempel, deutscher Fund (904) keinen', Object.keys(nach2).sort().join(',') === '901001,901002,901003,901005', nach2)
pruefe('Titel ohne Fund trägt einen Stempel und keinen Trailer', nach2['901003'] === todayIso() && !('901003' in lies<object>(join('data', 'trailer.json'))))

tmdbAbrufe.length = 0
await main({ riegel: 3, speichernAlle: 2 })
pruefe('dritter Lauf am selben Tag fragt nichts mehr', tmdbAbrufe.length === 0, tmdbAbrufe)

console.log('Nichtauskunft stempelt nicht')
stelleAus()
tmdbAbrufe.length = 0
delete process.env.TMDB_API_KEY
await main({ riegel: 5 })
const ohneSchluessel = existsSync(join(wurzel, join('data', 'trailer-versuche.json'))) ? lies<object>(join('data', 'trailer-versuche.json')) : {}
pruefe('ohne TMDB-Schlüssel kein Stempel und kein Abruf', Object.keys(ohneSchluessel).length === 0 && tmdbAbrufe.length === 0, ohneSchluessel)

stelleAus()
process.env.TMDB_API_KEY = 'tm'
delete process.env.YOUTUBE_API_KEY
await main({ riegel: 5 })
const ohneYoutube = existsSync(join(wurzel, join('data', 'trailer-versuche.json'))) ? lies<object>(join('data', 'trailer-versuche.json')) : {}
pruefe('ohne YouTube-Schlüssel kein Stempel', Object.keys(ohneYoutube).length === 0, ohneYoutube)

console.log('Riegel und Zwischenspeichern ohne Probe-Werte')
process.env.YOUTUBE_API_KEY = 'yt'
stelleAus()
tmdbAbrufe.length = 0
await main({ riegel: 2 })
pruefe('Probe-Riegel 2 fragt genau zwei Titel', tmdbAbrufe.join(',') === '1,2', tmdbAbrufe)

/* 700 Titel; nur der 101. hat eine TMDB-Zuordnung (und damit einen Abruf), alle anderen kosten nichts. */
const viele = Array.from({ length: 700 }, (_, i) => ({ id: 902001 + i, format: 'TV', jpYear: 2005, titleEn: `Reihe ${i}` }))
rmSync(join(wurzel, 'data', 'trailer.json'), { force: true })
rmSync(join(wurzel, 'data', 'trailer-versuche.json'), { force: true })
schreibe('public/data/titles.json', viele)
schreibe('public/data/empfehlung.json', { einstiege: viele.map((x) => ({ id: x.id })) })
schreibe(join('data', 'tmdb-titles.json'), { '902101': { tmdbId: 3, kind: 'tv' } })
tmdbAbrufe.length = 0
haengeBei = '3'
await bisAbbruch(main())
const vorAbbruch = lies<Record<string, string>>(join('data', 'trailer-versuche.json'))
pruefe('Standard: nach 100 Titeln ist gespeichert, der Abbruch beim 101. verliert sie nicht', Object.keys(vorAbbruch).length === 100, Object.keys(vorAbbruch).length)
haengeBei = ''
await main()
const nachStandard = lies<Record<string, string>>(join('data', 'trailer-versuche.json'))
pruefe('Standard-Riegel 500: der zweite Lauf stempelt genau 500 weitere', Object.keys(nachStandard).length === 600, Object.keys(nachStandard).length)

console.log('Auskunft, Art, Kanalfilter und Gesundheitsmeldung')
interface Probe {
  id: number
  format: string
  jpYear: number
  titleEn: string
}
const probe = (id: number, format: string, jpYear = 2005, titleEn = `Probe ${id}`): Probe => ({ id, format, jpYear, titleEn })
function richteEin(liste: Probe[], tmdbMap: Record<string, unknown>): void {
  for (const f of [join('data', 'trailer.json'), join('data', 'trailer-versuche.json'), join('data', 'cache', 'kinocheck-kanal.json')]) {
    rmSync(join(wurzel, f), { force: true })
  }
  schreibe('public/data/titles.json', liste)
  schreibe('public/data/empfehlung.json', { einstiege: liste.map((x) => ({ id: x.id })) })
  schreibe(join('data', 'tmdb-titles.json'), tmdbMap)
  tmdbAbrufe.length = 0
  arten.length = 0
}
const stempel = (): string => Object.keys(lies<Record<string, string>>(join('data', 'trailer-versuche.json'))).join(',')
const meldung = (): string | undefined => lies<Record<string, { lastError?: string }>>(join('data', 'source-health.json'))['trailer']?.lastError

/* A1: Art je Eintrag — ohne oder mit unbekanntem kind entscheidet das Format; ein gültiges kind gilt. */
richteEin(
  [probe(905001, 'TV'), probe(905002, 'MOVIE'), probe(905003, 'TV'), probe(905004, 'MOVIE'), probe(905005, 'TV')],
  { '905001': { tmdbId: 51 }, '905002': { tmdbId: 52 }, '905003': { tmdbId: 53, kind: 'foo' }, '905004': { tmdbId: 54, kind: 'tv' }, '905005': { tmdbId: 55, kind: 'movie' } },
)
await main({ riegel: 9 })
pruefe('Art: ohne kind Serie -> tv, Film -> movie; unbekannt -> Format; gültiges kind gilt', arten.join(',') === 'tv:51,movie:52,tv:53,tv:54,movie:55', arten)

/* A2: der Kanalindex gilt nur für Filme. */
richteEin(
  [probe(909001, 'MOVIE', 2005, 'Film Alpha'), probe(909002, 'TV', 2005, 'Serie Beta')],
  { '909001': { tmdbId: 41, kind: 'movie' }, '909002': { tmdbId: 42, kind: 'tv' } },
)
kanalVideos = [
  { id: 'vidA', titel: 'Film Alpha Trailer German Deutsch (2005)' },
  { id: 'vidB', titel: 'Serie Beta Trailer German Deutsch (2005)' },
]
await main({ riegel: 9 })
kanalVideos = []
const kanalErgebnis = lies<Record<string, { video: string; herkunft: string }>>(join('data', 'trailer.json'))
pruefe('Kanalindex: der Film bekommt den Kanal-Trailer', kanalErgebnis['909001']?.video === 'vidA' && kanalErgebnis['909001']?.herkunft === 'kanal', kanalErgebnis['909001'])
pruefe('Kanalindex: die Serie mit gleichem Namen bekommt ihn nicht, TMDB antwortet', kanalErgebnis['909002']?.herkunft === 'tmdb', kanalErgebnis['909002'])
pruefe('Kanalindex: für den Film kein TMDB-Abruf nötig', tmdbAbrufe.join(',') === '42', tmdbAbrufe)

/* A6: ein gescheiterter Abruf stempelt nicht, der nächste Lauf fragt wieder. */
const drei = [probe(907001, 'TV'), probe(907002, 'TV'), probe(907003, 'TV'), probe(907004, 'TV')]
const dreiTmdb = { '907001': { tmdbId: 21, kind: 'tv' }, '907002': { tmdbId: 22, kind: 'tv' }, '907003': { tmdbId: 23, kind: 'tv' }, '907004': { tmdbId: 24, kind: 'tv' } }
richteEin(drei, dreiTmdb)
fehlerBei.add('22')
netzfehlerBei.add('23')
nichtGefuehrtBei.add('24')
await main({ riegel: 9 })
pruefe('HTTP-Fehler und Netzfehler stempeln nicht, Fund und 404 (nicht geführt) schon', stempel() === '907001,907004', stempel())
pruefe('der Lauf überlebt den Netzfehler und fragt alle vier', tmdbAbrufe.join(',') === '21,22,23,24', tmdbAbrufe)
pruefe('ein Fund unter den Ausfällen ist keine Fehlermeldung', meldung() === undefined, meldung())
fehlerBei.clear()
netzfehlerBei.clear()
nichtGefuehrtBei.clear()
tmdbAbrufe.length = 0
await main({ riegel: 9 })
pruefe('nächster Lauf fragt genau die Gescheiterten wieder', tmdbAbrufe.join(',') === '22,23', tmdbAbrufe)
pruefe('danach sind alle gestempelt', stempel() === '907001,907002,907003,907004', stempel())

/* A6 für KinoCheck (ab 2012): Fehler dort stempelt auch dann nicht, wenn TMDB einen Fremdsprach-Fund liefert. */
richteEin([probe(908001, 'TV', 2020)], { '908001': { tmdbId: 31, kind: 'tv' } })
kinocheckFehler = true
await main({ riegel: 9 })
pruefe('KinoCheck-Fehler: kein Stempel', stempel() === '', stempel())
kinocheckFehler = false
tmdbAbrufe.length = 0
await main({ riegel: 9 })
pruefe('KinoCheck wieder erreichbar: Titel wird erneut gefragt und gestempelt', tmdbAbrufe.join(',') === '31' && stempel() === '908001', [tmdbAbrufe, stempel()])

/* A4: Gesundheitsmeldung. */
richteEin(drei, dreiTmdb)
leerAlle = true
await main({ riegel: 9 })
pruefe('0 Funde bei vier Antworten melden einen Fehler', /^0 Funde bei 4 Antworten/.test(meldung() ?? ''), meldung())
await main({ riegel: 9 })
pruefe('0 Abfragen (alles gestempelt) ist kein Fehler', meldung() === undefined, meldung())
leerAlle = false
richteEin(drei, dreiTmdb)
for (const k of ['21', '22', '23', '24']) fehlerBei.add(k)
await main({ riegel: 9 })
pruefe('lauter Ausfälle melden einen Fehler', /^alle 4 Abrufe/.test(meldung() ?? ''), meldung())
fehlerBei.clear()

console.log('Gesundheitsregel')
const lage = (f: number, a: number, x: number): string | undefined => lageVon(f, a, x).fehler
pruefe('0 Funde bei 1 Antwort ist ein Fehler', lage(0, 1, 0) !== undefined)
pruefe('1 Fund bei 5 Antworten ist keiner', lage(1, 5, 0) === undefined)
pruefe('0 Antworten, 0 Ausfälle ist keiner', lage(0, 0, 0) === undefined)
pruefe('0 Antworten, 1 Ausfall ist ein Fehler', lage(0, 0, 1) !== undefined)
pruefe('0 Funde, 1 Antwort, 3 Ausfälle ist ein Fehler', lage(0, 1, 3) !== undefined)
pruefe('Funde bei Ausfällen sind keiner', lage(2, 3, 5) === undefined)

rmSync(wurzel, { recursive: true, force: true })
if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('Trailer-Lauf: alle Fälle grün')
