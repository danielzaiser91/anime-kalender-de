/**
 * Prüft den Trailerlauf: Wahl der Titel (30 Tage, Riegel, Reihenfolge), Zwischenspeichern und die Verdrahtung in
 * `main()` gegen ein Wegwerf-Verzeichnis (`AK_ROOT`) mit gefälschtem `fetch` — kein Abruf nach außen.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { todayIso } from '../shared/time.ts'
import { RIEGEL_JE_LAUF, SPEICHERN_ALLE, WIEDERVORLAGE_TAGE, arbeiteInStuecken, waehleDran } from './lib/trailer-lauf.ts'

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
let werfeBei = ''
globalThis.fetch = (async (eingabe: string | URL | Request): Promise<Response> => {
  const url = String(eingabe)
  const antwort = (daten: unknown): Response => new Response(JSON.stringify(daten), { status: 200 })
  if (url.includes('/youtube/v3/videos')) {
    const gefragt = (/[?&]id=([^&]+)/.exec(url)?.[1] ?? '').split(',')
    return antwort({ items: gefragt.map((id) => ({ id })) })
  }
  if (url.includes('/youtube/v3/playlistItems')) return antwort({ items: [] })
  const tv = /\/tv\/(\d+)\/videos/.exec(url)?.[1]
  if (!tv) throw new Error(`unerwartete Adresse ${url}`)
  tmdbAbrufe.push(tv)
  if (tv === werfeBei) throw new Error('Abbruch mitten im Lauf')
  /* 903 hat keinen Trailer, die anderen einen japanischen. */
  if (tv === '3') return antwort({ results: [] })
  if (tv === '4') return antwort({ results: [{ key: 'yt4de', name: 'Trailer', site: 'YouTube', type: 'Trailer', iso_639_1: 'de' }] })
  return antwort({ results: [{ key: `yt${tv}`, name: 'PV', site: 'YouTube', type: 'Trailer', iso_639_1: 'ja' }] })
}) as typeof fetch

stelleAus()
werfeBei = '3'
let abgebrochen = false
await main({ riegel: 3, speichernAlle: 2 }).catch(() => void (abgebrochen = true))
pruefe('Abbruch bei Titel 3 kommt durch', abgebrochen)
pruefe('Riegel 3 fragt höchstens drei Titel', tmdbAbrufe.join(',') === '1,2,3', tmdbAbrufe)
const nachAbbruch = lies<Record<string, unknown>>(join('data', 'trailer-versuche.json'))
pruefe('nach dem Abbruch stehen die ersten zwei Stempel auf Platte', Object.keys(nachAbbruch).join(',') === '901001,901002', nachAbbruch)
pruefe('Stempel ist das heutige Datum', nachAbbruch['901001'] === todayIso(), nachAbbruch['901001'])
pruefe('die zwei Funde stehen in trailer.json', Object.keys(lies<object>(join('data', 'trailer.json'))).join(',') === '901001,901002')

tmdbAbrufe.length = 0
werfeBei = ''
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
werfeBei = '3'
await main().catch(() => void 0)
const vorAbbruch = lies<Record<string, string>>(join('data', 'trailer-versuche.json'))
pruefe('Standard: nach 100 Titeln ist gespeichert, der Abbruch beim 101. verliert sie nicht', Object.keys(vorAbbruch).length === 100, Object.keys(vorAbbruch).length)
werfeBei = ''
await main()
const nachStandard = lies<Record<string, string>>(join('data', 'trailer-versuche.json'))
pruefe('Standard-Riegel 500: der zweite Lauf stempelt genau 500 weitere', Object.keys(nachStandard).length === 600, Object.keys(nachStandard).length)

rmSync(wurzel, { recursive: true, force: true })
if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('Trailer-Lauf: alle Fälle grün')
