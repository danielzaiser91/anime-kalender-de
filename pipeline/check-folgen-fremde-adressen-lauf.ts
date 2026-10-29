/**
 * Der echte Lauf von `fetch-folgen-zuordnung.ts` (`--aus`, ohne Worker) gegen eine Kulisse in `os.tmpdir()` (`AK_ROOT`, cwd):
 * Die Folge an der Cartoon-Adresse bekommt keinen Titel, die an der eigenen Adresse schon, und eine frühere Zuordnung auf einen
 * Titel außerhalb von `titles.json` entfällt. Fängt, wenn der Lauf die Sperre nicht aufruft oder ihre Quellen leer ankommen.
 * Erfundene Kennungen ab 900000 und eine erfundene Adresse: Grün beweist, dass die Kulisse gelesen wird.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const EIGEN = 'https://www.amazon.de/gp/video/detail/B0KULISSE1'
const FREMD = 'https://www.disneyplus.com/browse/entity-00000000-kulisse-fremd'

const beobachtung = (id: number, url: string, asin: string) => ({
  id,
  plattform: 'primevideo',
  url,
  asin,
  gti: null,
  nummer: id,
  titel: `Kulissenfolge ${id}`,
  erschienen: null,
  titel_id: null,
  gemeldet_am: '2026-10-16T10:00:00Z',
})

const kulisse = mkdtempSync(join(tmpdir(), 'ffa-lauf-'))
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
}
schreibe('public/data/titles.json', [
  { id: 900001, titleDe: 'Kulissenserie Eins', episodes: 12, streams: [{ platform: 'primevideo', url: EIGEN }], watchLinks: [] },
])
schreibe('public/data/cartoons.json', [{ id: -900100, titleDe: 'Kulissencartoon', streams: [{ platform: 'disneyplus', url: FREMD }] }])
schreibe('public/data/ohne-synchro.json', [])
schreibe('data/dub-confirmed.yaml', '[]\n')
schreibe('data/folgen-zuordnung.json', {
  'primevideo:ALTFREMD01': { titel: 900009, folge: 3, grund: 'titel', gesehen: '2026-09-01' },
})
schreibe('beobachtungen.json', [
  { results: [beobachtung(1, EIGEN, 'KULISSE001'), beobachtung(2, FREMD, 'KULISSE002'), beobachtung(3, FREMD, 'KULISSE003')] },
])

const lauf = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/fetch-folgen-zuordnung.ts'), '--aus', join(kulisse, 'beobachtungen.json')], {
  cwd: kulisse,
  env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: '' },
  encoding: 'utf8',
  windowsHide: true,
  timeout: 120000,
})
const ausgabe = `${lauf.stdout}${lauf.stderr}`
let ergebnis: Record<string, { titel?: number; grund: string }> = {}
try {
  ergebnis = JSON.parse(readFileSync(join(kulisse, 'data/folgen-zuordnung.json'), 'utf8'))
} catch {
  /* bleibt leer, die Zusicherung „Lauf endete“ meldet es */
}
rmSync(kulisse, { recursive: true, force: true })

const fehler: string[] = []
const pruefe = (name: string, ok: boolean) => {
  if (!ok) fehler.push(name)
}
pruefe('Lauf endete mit Exit 0', lauf.status === 0)
pruefe('Folge an der eigenen Adresse ordnet dem Titel zu', ergebnis['primevideo:KULISSE001']?.titel === 900001)
pruefe('Folge an der Cartoon-Adresse bleibt ohne Titel', ergebnis['primevideo:KULISSE002']?.titel === undefined && ergebnis['primevideo:KULISSE002']?.grund === 'ohne-kandidat')
pruefe('zweite Folge an der Cartoon-Adresse ebenso', ergebnis['primevideo:KULISSE003']?.titel === undefined && ergebnis['primevideo:KULISSE003']?.grund === 'ohne-kandidat')
pruefe('frühere Zuordnung auf Titel außerhalb von titles.json entfällt', ergebnis['primevideo:ALTFREMD01']?.titel === undefined)
pruefe('Lauf meldet die Zählung', ausgabe.includes('2 Beobachtungen und 2 Folgen ohne Zuordnung, 1 frühere Zuordnungen'))
if (fehler.length) {
  console.error(`check-folgen-fremde-adressen-lauf: ${fehler.join('; ')}\n${ausgabe.slice(-1500)}`)
  process.exit(1)
}
console.log('check-folgen-fremde-adressen-lauf: 6 Zusicherungen grün, der Lauf sperrt Folgen an fremden Adressen und entfernt veraltete Zuordnungen.')
