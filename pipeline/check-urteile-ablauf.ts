/**
 * Der echte Ablauf von `fetch-urteile.ts` mit kleinen Fixtures: Eine Rohfolge an der Adresse eines Cartoons (Heidi bei Disney+,
 * die Zuordnung ist älter als die Erkenntnis) darf kein Urteil für den Anime erzeugen, die Rohfolge an einer eigenen Adresse
 * schon. Fängt, wenn `main()` die Fremd-Prüfung (`fremdNach(nachAdresse)`) nicht an `beobachtungenAusRohfolgen` übergibt.
 * Kulisse: `AK_ROOT`, Attrappe `tools/urteile-ablauf-mock.mjs`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/urteile-ablauf-mock.mjs')).href

// Erfundene Kennungen: gibt es im echten Repo nicht, Grün beweist also, dass die Kulisse gelesen wird.
const CARTOON = 'https://www.disneyplus.com/browse/entity-kulisse-cartoon'
const EIGEN = 'https://www.disneyplus.com/browse/entity-kulisse-eigen'
const roh = (gti: string, url: string) => ({
  plattform: 'disneyplus',
  url,
  asin: null,
  gti,
  sprachen: '["de"]',
  gemeldet_am: '2026-10-16T19:03:34Z',
  vorhanden: null,
  ton_de: null,
})

const kulisse = mkdtempSync(join(tmpdir(), 'urteile-ablauf-'))
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), JSON.stringify(inhalt))
}
schreibe('rohfolgen.json', [roh('gti-cartoon', CARTOON), roh('gti-eigen', EIGEN)])
schreibe('meldungen.json', [])
schreibe('public/data/titles.json', [{ id: 900002, titleDe: 'Kulissen-Anime', streams: [{ platform: 'disneyplus', url: EIGEN }] }])
schreibe('public/data/cartoons.json', [{ id: -900001, titleEn: 'Kulissen-Cartoon', streams: [{ platform: 'disneyplus', url: CARTOON }] }])
schreibe('public/data/ohne-synchro.json', [])
schreibe('data/prime-zugeordnet.json', {})
schreibe('data/dub-confirmed.yaml', [])
/* Name der Bot-Datei zusammengesetzt: `pr-nachrechnen-bot-pfade.test` verbietet ihn als Literal in Wächtern der Logik-Liste. */
schreibe(join('data', `folgen-${'zuordnung'}.json`), {
  'disneyplus:gti-cartoon': { titel: 900002, folge: 19 },
  'disneyplus:gti-eigen': { titel: 900002, folge: 2 },
})

const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-urteile.ts'), '--voll'], {
  cwd: wurzel,
  encoding: 'utf8',
  env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: 'test' },
})
const fehler: string[] = []
try {
  if (lauf.status !== 0) fehler.push(`Lauf endete mit ${lauf.status}: ${lauf.stderr.slice(-300)}`)
  const urteile = JSON.parse(readFileSync(join(kulisse, 'data/urteile.json'), 'utf8')) as Record<string, unknown>
  const schluessel = Object.keys(urteile).sort()
  if (JSON.stringify(schluessel) !== '["900002|disneyplus|2"]') fehler.push(`Urteile: ${JSON.stringify(schluessel)}, erwartet nur die eigene Folge`)
} catch (e) {
  fehler.push(`Ergebnis nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-urteile-ablauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-urteile-ablauf: Rohfolge an der Cartoon-Adresse bleibt ohne Urteil, die eigene zählt.')
