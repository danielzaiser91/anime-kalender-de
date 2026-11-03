/**
 * Staffel-Riegel am Zuordner (03.11.2026, Z wie Zorro): eine Meldung „Staffel ab 2" auf den Reihenkopf wird verworfen, außer
 * die Seite ist die zweite Hälfte eines längeren Einzeltitels (alle eindeutigen Folgentreffer jenseits der Seitenlänge).
 * Reine Fälle gegen `staffelSeiteVerwerfen` und der ganze Ablauf von `fetch-rohfolgen.ts` gegen eine Kulisse (`AK_ROOT`).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { staffelSeiteVerwerfen } from './lib/staffel-riegel.ts'
import { folgenKern, type AnbieterFolge, type TmdbFolge } from '../shared/folgen-zuordnung.ts'

let faelle = 0
const fehler: string[] = []
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (!ok) fehler.push(`${name}${ist === undefined ? '' : ` ${JSON.stringify(ist)}`}`)
}

const anker = (namen: string[], ab = 1): { folgen: TmdbFolge[] } => ({
  folgen: namen.map((titel, i) => ({ s: 1, e: ab + i, titel, datum: null, minuten: null })),
})
const seite = (namen: string[]): AnbieterFolge[] => namen.map((titel, i) => ({ nummer: i + 1, titel, datum: null, minuten: null }))

// Zorro-Form: 8 Folgen, Seite mit den Folgen 5-8.
const alle = ['Alpha Adler', 'Beta Biene', 'Gamma Gans', 'Delta Dachs', 'Epsilon Eule', 'Zeta Zebra', 'Eta Echse', 'Theta Tiger']
const zweite = alle.slice(4)
const basis = { gemeldeteStaffel: 2, istReihenkopf: true, titelFolgen: 8, anbieter: seite(zweite), ankerListen: [anker(alle)] }

pruefe('zweite Hälfte eines Einzeltitels bleibt', staffelSeiteVerwerfen(basis) === false)
pruefe('Seite mit den ersten Folgen (Staffel 2 = Neuanfang) wird verworfen', staffelSeiteVerwerfen({ ...basis, anbieter: seite(alle.slice(0, 4)) }) === true)
pruefe('ein Treffer diesseits der Seitengrenze genügt zum Verwerfen', staffelSeiteVerwerfen({ ...basis, anbieter: seite(['Delta Dachs', ...zweite]) }) === true)
pruefe('Treffer genau auf der Seitengrenze (Folge 4 bei vier Seitenfolgen): verworfen', staffelSeiteVerwerfen({ ...basis, anbieter: seite(alle.slice(3, 7)) }) === true)
pruefe('Treffer eine Folge hinter der Seitengrenze (5-8): bleibt', staffelSeiteVerwerfen({ ...basis, anbieter: seite(alle.slice(4, 8)) }) === false)
pruefe('Titel nicht länger als die Seite: verworfen', staffelSeiteVerwerfen({ ...basis, titelFolgen: 4, anbieter: seite(alle.slice(4)) }) === true)
pruefe('Titel genau so lang wie die Seite: verworfen', staffelSeiteVerwerfen({ ...basis, titelFolgen: 4 }) === true)
pruefe('Titel eine Folge länger als die Seite, Treffer jenseits: bleibt', staffelSeiteVerwerfen({ ...basis, titelFolgen: 5, anbieter: seite(['Delta Dachs']) , ankerListen: [anker(alle.slice(0, 5))] }) === false)
pruefe('Folgenzahl unbekannt: verworfen', staffelSeiteVerwerfen({ ...basis, titelFolgen: undefined }) === true)
pruefe('keine Treffer: verworfen', staffelSeiteVerwerfen({ ...basis, anbieter: seite(['Unbekannt Eins', 'Unbekannt Zwei']) }) === true)
pruefe('keine Anker: verworfen', staffelSeiteVerwerfen({ ...basis, ankerListen: [] }) === true)
pruefe('zweiter Anker rettet nicht, wenn er diesseits trifft', staffelSeiteVerwerfen({ ...basis, ankerListen: [anker(alle), anker(['Epsilon Eule', 'Zeta Zebra', 'Eta Echse', 'Theta Tiger'])] }) === true)
// Rotpfad: ohne Regel nie verworfen.
pruefe('Staffel 1 wird nie verworfen', staffelSeiteVerwerfen({ ...basis, gemeldeteStaffel: 1, anbieter: seite(alle.slice(0, 4)) }) === false)
pruefe('ohne Staffelangabe wird nie verworfen', staffelSeiteVerwerfen({ ...basis, gemeldeteStaffel: null, anbieter: seite(alle.slice(0, 4)) }) === false)
pruefe('Nicht-Reihenkopf wird nie verworfen', staffelSeiteVerwerfen({ ...basis, istReihenkopf: false, anbieter: seite(alle.slice(0, 4)) }) === false)
// Positionsraten zählt nicht: gleiche Anzahl, aber keine Titel- oder Datumstreffer.
pruefe('Titel ohne Treffer, nur Position: verworfen', staffelSeiteVerwerfen({ ...basis, anbieter: seite(['Neu Eins', 'Neu Zwei', 'Neu Drei', 'Neu Vier']), ankerListen: [anker(['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8'].map((x) => `Anders ${x}`))] }) === true)
// Jedes Alt-Schreibweise-Paar trifft über denselben Kern (aniSearch „Kuß", Prime „Kuss").
pruefe('Kuß = Kuss', folgenKern('Der Kuß') === folgenKern('Der Kuss'))
pruefe('Kuß ≠ Kus', folgenKern('Der Kuß') !== folgenKern('Der Kus'))
pruefe('Mißverständnis = Missverständnis', folgenKern('Mißverständnis') === folgenKern('Missverständnis'))

/* Ganzer Ablauf: zweite Hälfte (Titel 900101) bleibt, Neuanfang (Titel 900102) fällt weg. */
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/rohfolgen-ablauf-mock.mjs')).href
const A = 'https://www.amazon.de/gp/video/detail/B0RIEGEL01'
const B = 'https://www.amazon.de/gp/video/detail/B0RIEGEL02'
const zeile = (id: number, url: string, nummer: number, titel: string, titelId: number) => ({
  id,
  url,
  asin: null,
  gti: null,
  nummer,
  titel,
  erschienen: null,
  dauer_sek: null,
  sprachen: JSON.stringify(['Deutsch']),
  untertitel: null,
  staffel_text: 'Staffel 2',
  staffel_nr: 2,
  gemeldet_am: '2026-11-03T10:00:00Z',
  titel_id: titelId,
  plattform: 'primevideo',
})
const asFolgen = (namen: string[]) => ({ folgen: namen.map((de, i) => ({ nr: i + 1, de })) })
const kulisse = mkdtempSync(join(tmpdir(), 'staffel-riegel-'))
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), JSON.stringify(inhalt))
}
try {
  schreibe('rohfolgen.json', [
    ...zweite.map((t, i) => zeile(i + 1, A, i + 1, t, 900101)),
    ...alle.slice(0, 4).map((t, i) => zeile(i + 11, B, i + 1, t, 900102)),
  ])
  const titel = (id: number, n: number, url: string) => ({ id, titleDe: `Riegel ${id}`, episodes: n, streams: [{ platform: 'primevideo', url }] })
  schreibe('public/data/titles.json', [titel(900101, 8, A), titel(900102, 4, B)])
  mkdirSync(join(kulisse, 'data'), { recursive: true })
  writeFileSync(join(kulisse, 'data/dub-confirmed.yaml'), '[]\n')
  schreibe('public/data/cartoons.json', [])
  schreibe('public/data/ohne-synchro.json', [])
  schreibe('data/anisearch.json', { 900101: { anisearchId: 51 }, 900102: { anisearchId: 52 } })
  schreibe('data/anisearch-folgen.json', { 51: asFolgen(alle), 52: asFolgen(alle.slice(0, 4)) })
  const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-rohfolgen.ts')], {
    cwd: wurzel,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: 'test' },
  })
  pruefe('Lauf endete mit 0', lauf.status === 0, lauf.stderr.slice(-300))
  const z = JSON.parse(readFileSync(join(kulisse, 'data/prime-zugeordnet.json'), 'utf8')) as Record<string, { titleId: number; folgen: { unsere: number | null }[] }>
  const unsere = Object.values(z).find((x) => x.titleId === 900101)?.folgen.map((f) => f.unsere)
  pruefe('zweite Hälfte: Folgen 5-8 zugeordnet', JSON.stringify(unsere) === '[5,6,7,8]', unsere)
  pruefe('Neuanfang auf dem Reihenkopf bleibt verworfen', !Object.values(z).some((x) => x.titleId === 900102), Object.keys(z))
  pruefe('Lauf-Log nennt die behaltene Seite', lauf.stdout.includes(`Staffel 2 behalten`) && lauf.stdout.includes('1 übersprungen'), lauf.stdout.slice(-400))
} catch (e) {
  fehler.push(`Ablauf nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-staffel-riegel: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log(`check-staffel-riegel: ${faelle} Fälle: zweite Hälfte bleibt, Neuanfang und Staffel-Misch bleiben verworfen, ß = ss.`)
