/**
 * Verdrahtung und Reihenfolge der Geschwister-Probe im echten Ablauf von `fetch-rohfolgen.ts` — dieselbe Kulisse wie
 * `check-rohfolgen-ablauf.ts` (`AK_ROOT`, Attrappe `tools/rohfolgen-ablauf-mock.mjs`). Eine Reihe mit drei
 * Staffeln, in der nur Staffel 2 die Folgentitel hat, die die Seite zeigt; dazu ein Titel nur mit TMDB-Anker und
 * eine Reihe mit Kopf für Meldungen ab Staffel 2. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/rohfolgen-ablauf-mock.mjs')).href

const seite = (k: string) => `https://www.amazon.de/gp/video/detail/KULISSE${k}`
/** Folgentitel von Staffel 2 (Titel 10); Staffel 3 (11) führt andere, Titel 12 hat gar keine. */
const S2 = ['Kulissenwald am Morgen', 'Kulissenbrücke im Regen', 'Kulissenturm bei Nacht']
const TMDB = ['Leinwandsee im Nebel', 'Leinwandberg im Schnee', 'Leinwandtal im Sturm']
const KOPF = ['Bühnenhaus am Abend', 'Bühnenhof im Licht', 'Bühnendach im Wind']
const S3 = ['Kulissenhafen im Sturm', 'Kulissenmarkt am Mittag', 'Kulissengarten im Herbst']
const FALSCH = ['Falschstaffel am Fluss', 'Falschstaffel im Moor']
/** Reihe 60: drei Staffeln zu je drei Folgen (2010, 2012, 2014) und eine mit fünf (2012), alle nur bei TMDB des Kopfs. */
const R1 = ['Reihenstart am Hafen', 'Reihenstart im Tal', 'Reihenstart auf dem Berg']
const R2 = ['Reihenmitte am Hafen', 'Reihenmitte im Tal', 'Reihenmitte auf dem Berg']
const R3 = ['Reihenende am Hafen', 'Reihenende im Tal', 'Reihenende auf dem Berg']
const R5 = ['Laufzeitprobe eins', 'Laufzeitprobe zwei', 'Laufzeitprobe drei', 'Laufzeitprobe vier']
const R4 = ['Sonderstaffel eins', 'Sonderstaffel zwei', 'Sonderstaffel drei', 'Sonderstaffel vier', 'Sonderstaffel fuenf']

let id = 0
function gruppe(url: string, titelId: number, sprachen: string[][], folgen = S2, staffel: number | null = null) {
  return folgen.map((titel, i) => ({
    id: ++id,
    url,
    asin: null,
    gti: null,
    nummer: i + 1,
    titel,
    erschienen: null,
    dauer_sek: null,
    sprachen: JSON.stringify(sprachen[i % sprachen.length]),
    untertitel: null,
    staffel_text: null,
    staffel_nr: staffel,
    gemeldet_am: '2026-10-16T10:00:00Z',
    titel_id: titelId,
    plattform: 'primevideo',
  }))
}

/** Verschiedene Tonspuren je Folge: der Beleg ohne Folgennummer trägt nicht. */
const GEMISCHT = [['Deutsch'], ['Deutsch', 'Japanisch']]
const rohfolgen = [
  ...gruppe(seite('A'), 11, GEMISCHT),
  /* Gleiche Tonspuren und Kennung: der Beleg ohne Folgennummer trägt, die Probe überstimmt ihn nicht. */
  ...gruppe(seite('B'), 11, [['Deutsch']]),
  /* Titel 12 ohne jeden Anker: die Probe darf trotzdem ran. */
  ...gruppe(seite('C'), 12, GEMISCHT),
  /* Titel 20 hat nur TMDB-Folgentitel: die zählen als Anker. */
  ...gruppe(seite('D'), 20, GEMISCHT, TMDB),
  /* Prime meldet Staffel 2: der Reihenkopf 30 ist kein Kandidat der Probe, auch wenn seine Folgen passen. */
  ...gruppe(seite('E'), 31, GEMISCHT, KOPF, 2),
  /* Dieselbe Meldung mit den Folgen von Staffel 3 (32): Geschwister außer dem Kopf bleiben Kandidaten. */
  ...gruppe(seite('F'), 31, GEMISCHT, S3, 2),
  /* Titel 40 hat zwei TMDB-Staffeln; die Seite zeigt die Folgen der falschen (Staffel 2): Anker ist nur Staffel 1. */
  ...gruppe(seite('G'), 40, GEMISCHT, [...FALSCH, 'Kulissenfremd am Ende']),
  /* Zwei Zeilen ohne Titel am selben Tag: das Datum belegt keine von beiden. */
  ...gruppe(seite('H'), 50, GEMISCHT, ['', '']).map((z) => ({ ...z, titel: null, erschienen: '2020-01-01' })),
  /* Titel 61 (Staffel 2) hat keinen eigenen TMDB-Eintrag: der Kopf 60 liefert die mittlere seiner drei gleich langen Staffeln. */
  ...gruppe(seite('J'), 61, GEMISCHT, R2),
  /* Titel 63 (2030) passt nach Folgenzahl zur Staffel von 2012: das Jahr schließt sie aus. */
  ...gruppe(seite('K'), 63, GEMISCHT, R4),
  /* Nachbarjahr (2013 gegen 2012, einzige Staffel mit fünf Folgen): kein Anker, wie Attack on Titan 3 gegen Staffel 2. */
  ...gruppe(seite('L'), 64, GEMISCHT, R4),
  /* Laufzeit je Folge: 32 min gegen 24 (genau 8 Abstand) trägt, 33 (9) und 1 (Ableger wie Akame ga Kill! Theater) nicht. */
  ...gruppe(seite('N'), 66, GEMISCHT, R5),
  ...gruppe(seite('O'), 67, GEMISCHT, R5),
  ...gruppe(seite('P'), 68, GEMISCHT, R5),
]

const titles = [
  ...[10, 11, 12].map((t) => ({ id: t, titleDe: `Kulissenreihe ${t}`, franchiseId: 50, episodes: 3 })),
  { id: 20, titleDe: 'Kulissen-TMDB', episodes: 3, jpYear: 2019 },
  { id: 30, titleDe: 'Kulissenkopf', franchiseId: 70, episodes: 3, jpYear: 2010 },
  { id: 31, titleDe: 'Kulissenkopf Zwei', franchiseId: 70, episodes: 3, jpYear: 2012 },
  { id: 32, titleDe: 'Kulissenkopf Drei', franchiseId: 70, episodes: 3, jpYear: 2014 },
  { id: 40, titleDe: 'Kulissen-Zweistaffel', episodes: 3, jpYear: 2019 },
  { id: 50, titleDe: 'Kulissen-Datum', episodes: 3, jpYear: 2020 },
  { id: 60, titleDe: 'Kulissen-Reihe', franchiseId: 60, episodes: 3, jpYear: 2010 },
  { id: 61, titleDe: 'Kulissen-Reihe Zwei', franchiseId: 60, episodes: 3, jpYear: 2012 },
  { id: 62, titleDe: 'Kulissen-Reihe Drei', franchiseId: 60, episodes: 3, jpYear: 2014 },
  { id: 63, titleDe: 'Kulissen-Reihe Sonder', franchiseId: 60, episodes: 5, jpYear: 2030 },
  { id: 64, titleDe: 'Kulissen-Reihe Sonder Zwei', franchiseId: 60, episodes: 5, jpYear: 2013 },
  { id: 66, titleDe: 'Kulissen-Laufzeit 32', franchiseId: 60, episodes: 4, jpYear: 2020, runtimeMin: 32 },
  { id: 67, titleDe: 'Kulissen-Laufzeit 33', franchiseId: 60, episodes: 4, jpYear: 2020, runtimeMin: 33 },
  { id: 68, titleDe: 'Kulissen-Laufzeit 1', franchiseId: 60, episodes: 4, jpYear: 2020, runtimeMin: 1 },
]
const asKennung = { 10: { anisearchId: 9010 }, 11: { anisearchId: 9011 }, 30: { anisearchId: 9030 }, 32: { anisearchId: 9032 } }
const tmdb = (titel: string[], s: number, datum: (i: number) => string | null = () => null) =>
  titel.map((t, i) => ({ s, e: i + 1, titel: t, datum: datum(i), minuten: 24 }))
const tmdbFolgen = {
  20: { tmdbId: 1, folgen: tmdb(TMDB, 1, () => '2019-03-01') },
  40: { tmdbId: 2, folgen: [...tmdb(KOPF, 1, () => '2019-03-01'), ...tmdb(FALSCH, 2)] },
  50: { tmdbId: 3, folgen: tmdb(S3, 1, (i) => `2020-01-0${i + 1}`) },
  60: {
    tmdbId: 4,
    folgen: [...tmdb(R1, 1, () => '2010-05-01'), ...tmdb(R2, 2, () => '2012-05-01'), ...tmdb(R3, 3, () => '2014-05-01'), ...tmdb(R4, 4, () => '2012-06-01'), ...tmdb(R5, 5, () => '2020-05-01').map((f, i) => ({ ...f, minuten: [60, 24, 24, 1][i] }))],
  },
}
const asFolgen = {
  9030: { folgen: KOPF.map((de, i) => ({ nr: i + 1, de })) },
  9032: { folgen: S3.map((de, i) => ({ nr: i + 1, de })) },
  9010: { folgen: S2.map((de, i) => ({ nr: i + 1, de })) },
  9011: { folgen: ['Ganz anders eins', 'Ganz anders zwei', 'Ganz anders drei'].map((de, i) => ({ nr: i + 1, de })) },
}

const kulisse = mkdtempSync(join(tmpdir(), 'zuordner-ablauf-'))
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), JSON.stringify(inhalt))
}
schreibe('rohfolgen.json', rohfolgen)
schreibe('public/data/titles.json', titles)
schreibe('data/anisearch.json', asKennung)
schreibe('data/anisearch-folgen.json', asFolgen)
schreibe('data/tmdb-folgen.json', tmdbFolgen)
mkdirSync(join(kulisse, 'data'), { recursive: true })
writeFileSync(join(kulisse, 'data/dub-confirmed.yaml'), '[]\n')
mkdirSync(join(kulisse, 'public/data'), { recursive: true })
writeFileSync(join(kulisse, 'public/data/cartoons.json'), '[]')
writeFileSync(join(kulisse, 'public/data/ohne-synchro.json'), '[]')

const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-rohfolgen.ts')], {
  cwd: wurzel,
  encoding: 'utf8',
  env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: 'test' },
})
const fehler: string[] = []
try {
  if (lauf.status !== 0) fehler.push(`Lauf endete mit ${lauf.status}: ${lauf.stderr.slice(-300)}`)
  const zugeordnet = JSON.parse(readFileSync(join(kulisse, 'data/prime-zugeordnet.json'), 'utf8')) as Record<
    string,
    { titleId: number; folgen: { unsere: number | null }[] }
  >
  const a = zugeordnet[seite('A')]
  const folgenA = JSON.stringify(a?.folgen.map((f) => f.unsere))
  if (a?.titleId !== 10 || folgenA !== '[1,2,3]') fehler.push(`Probe: gemeldet 11, erwartet 10 mit [1,2,3], ist ${a?.titleId} ${folgenA}`)
  const b = zugeordnet[seite('B')]
  if (b?.titleId !== 11 || JSON.stringify(b.folgen.map((f) => f.unsere)) !== '[null]') fehler.push(`Kennung schlägt Probe: ist ${JSON.stringify(b)}`)
  if (zugeordnet[seite('C')]?.titleId !== 10) fehler.push(`ohne Anker greift die Probe nicht: ist ${zugeordnet[seite('C')]?.titleId}`)
  const folgenD = JSON.stringify(zugeordnet[seite('D')]?.folgen.map((f) => f.unsere))
  if (folgenD !== '[1,2,3]') fehler.push(`TMDB-Anker: erwartet [1,2,3], ist ${folgenD}`)
  if (zugeordnet[seite('E')]) fehler.push(`Staffel 2 landet auf dem Reihenkopf: ${JSON.stringify(zugeordnet[seite('E')])}`)
  if (zugeordnet[seite('F')]?.titleId !== 32) fehler.push(`Staffel 2: Geschwister außer dem Kopf, erwartet 32, ist ${zugeordnet[seite('F')]?.titleId}`)
  if (zugeordnet[seite('G')]) fehler.push(`falsche TMDB-Staffel als Anker: ${JSON.stringify(zugeordnet[seite('G')])}`)
  const folgenJ = JSON.stringify(zugeordnet[seite('J')]?.folgen.map((f) => f.unsere))
  if (zugeordnet[seite('J')]?.titleId !== 61 || folgenJ !== '[1,2,3]') fehler.push(`TMDB des Reihenkopfs: erwartet 61 mit [1,2,3], ist ${zugeordnet[seite('J')]?.titleId} ${folgenJ}`)
  if (zugeordnet[seite('N')]?.titleId !== 66) fehler.push(`Laufzeit genau auf der Schwelle (8 min): erwartet 66, ist ${zugeordnet[seite('N')]?.titleId}`)
  if (zugeordnet[seite('O')]?.titleId === 67) fehler.push(`Laufzeit 9 min daneben als Anker: ${JSON.stringify(zugeordnet[seite('O')])}`)
  if (zugeordnet[seite('P')]?.titleId === 68) fehler.push(`Ableger mit 1 min je Folge als Anker: ${JSON.stringify(zugeordnet[seite('P')])}`)
  if (zugeordnet[seite('L')]?.titleId === 64) fehler.push(`Nachbarjahr als Anker: ${JSON.stringify(zugeordnet[seite('L')])}`)
  if (zugeordnet[seite('K')]?.titleId === 63) fehler.push(`Staffel von 2012 für einen Titel von 2030: ${JSON.stringify(zugeordnet[seite('K')])}`)
  if (zugeordnet[seite('H')]) fehler.push(`geteiltes Datum ohne Titel belegt Folgen: ${JSON.stringify(zugeordnet[seite('H')])}`)
} catch (e) {
  fehler.push(`Ergebnis nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-zuordner-ablauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-zuordner-ablauf: Probe hängt die Seite an die Staffel, deren Folgen sie zeigt; Kennung schlägt Probe; ohne Anker greift sie; TMDB ist Anker; Staffel 2 nie auf den Reihenkopf; falsche TMDB-Staffel und geteiltes Datum belegen nichts; der Reihenkopf liefert TMDB für Staffeln ohne eigenen Eintrag, nur im gleichen Jahr und bei passender Laufzeit.')
