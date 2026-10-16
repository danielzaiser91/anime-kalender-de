/**
 * Verdrahtung und Reihenfolge der Geschwister-Probe im echten Ablauf von `fetch-rohfolgen.ts` — dieselbe Kulisse wie
 * `check-rohfolgen-ablauf.ts` (`AK_ROOT`, Attrappe `tools/rohfolgen-ablauf-mock.mjs`). Eine Reihe mit drei
 * Staffeln; nur Staffel 2 hat die Folgentitel, die die Seite zeigt. Läuft in `check:logic`.
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

let id = 0
function gruppe(url: string, titelId: number, sprachen: string[][]) {
  return S2.map((titel, i) => ({
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
    staffel_nr: null,
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
]

const titles = [10, 11, 12].map((t) => ({ id: t, titleDe: `Kulissenreihe ${t}`, franchiseId: 50, episodes: 3 }))
const asKennung = { 10: { anisearchId: 9010 }, 11: { anisearchId: 9011 } }
const asFolgen = {
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
mkdirSync(join(kulisse, 'data'), { recursive: true })
writeFileSync(join(kulisse, 'data/dub-confirmed.yaml'), '[]\n')

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
} catch (e) {
  fehler.push(`Ergebnis nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-zuordner-ablauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-zuordner-ablauf: Probe hängt die Seite an die Staffel, deren Folgen sie zeigt; Kennung schlägt Probe; ohne Anker greift sie.')
