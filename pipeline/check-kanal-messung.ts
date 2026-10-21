/**
 * Zusicherung: Eine Kanal-Messung mit Nein löst das alte Kanal-Ja ab, und weitere Meldungen ohne neue Aussage
 * schreiben keinen weiteren Block (Prüfer-Befund PR 1003, 12.10.2026). Läuft `pipeline/fetch-pruefungen.ts` ohne `--trocken`
 * gegen eine Attrappe (`tools/kanal-messung-mock.mjs`): Geschrieben wird nur in eine Wegwerfdatei im Temp-Ordner.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import yaml from 'js-yaml'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/kanal-messung-mock.mjs')).href

const ALTES_JA = `- anilistId: 1
  platform: primevideo
  url: https://www.amazon.de/dp/B0TESTKAN1
  dub: true
  checkedAt: '2026-10-01'
  note: "Kanal-Titel"
`
type Meldung = { befund: 'dub' | 'kein_dub'; gemeldet_am: string }
const nein = (tag: string): Meldung => ({ befund: 'kein_dub', gemeldet_am: `2026-10-${tag}T10:00:00Z` })
const ja = (tag: string): Meldung => ({ befund: 'dub', gemeldet_am: `2026-10-${tag}T10:00:00Z` })

function lauf(datei: string, merkliste: string, meldungen: Meldung[], fehler: string[]): void {
  const r = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], {
    cwd: wurzel,
    encoding: 'utf8',
    env: { ...process.env, LAUF_TOKEN: 'test', KANAL_MOCK_YAML: datei, KANAL_MOCK_MERKLISTE: merkliste, KANAL_MOCK_MELDUNGEN: JSON.stringify(meldungen) },
  })
  if (r.status !== 0) fehler.push(`Lauf endete mit ${r.status}: ${r.stderr.slice(-300)}`)
}

/** Neue Blöcke gegenüber dem Anfangsstand, je mit ihrer Messung. */
const messungen = (datei: string): string[] =>
  (yaml.load(readFileSync(datei, 'utf8')) as { kanalMessung?: string }[]).slice(1).map((b) => b.kanalMessung ?? '?')

/** Der echte Schreibweg merkt sich die Kanal-Seite des alten Ja (Issue #1601), nach mehreren Läufen und Blöcken genau einmal. */
function pruefeMerkliste(datei: string, name: string, fehler: string[]): void {
  const eintraege = existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as { anilistId: number }[]) : []
  if (eintraege.length !== 1 || eintraege[0]!.anilistId !== 1) fehler.push(`${name}: Merkliste hält ${JSON.stringify(eintraege)}, erwartet genau Titel 1`)
}

function pruefeFolge(ordner: string, name: string, laeufe: Meldung[][], erwartet: string[], fehler: string[]): void {
  const datei = join(ordner, `${name}.yaml`)
  writeFileSync(datei, ALTES_JA)
  const merkliste = join(ordner, `${name}.kanal-seiten.json`)
  for (const meldungen of laeufe) lauf(datei, merkliste, meldungen, fehler)
  pruefeMerkliste(merkliste, name, fehler)
  const ist = messungen(datei).join(',')
  if (ist !== erwartet.join(',')) fehler.push(`${name}: Blöcke "${ist}", erwartet "${erwartet.join(',')}"`)
}

const ordner = mkdtempSync(join(tmpdir(), 'kanal-messung-'))
const fehler: string[] = []
try {
  pruefeFolge(ordner, 'nein-nein-getrennt', [[nein('12')], [nein('13')]], ['nein'], fehler)
  pruefeFolge(ordner, 'nein-nein-ein-lauf', [[nein('12'), nein('13')]], ['nein'], fehler)
  pruefeFolge(ordner, 'nein-dann-ja', [[nein('12')], [nein('13')], [ja('14')]], ['nein', 'ja'], fehler)
  pruefeFolge(ordner, 'ja-dann-nein', [[ja('12')], [nein('13')]], ['ja', 'nein'], fehler)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`check-kanal-messung: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-kanal-messung: Nein löst das Ja ab, eine zweite Nein-Meldung schreibt nichts, ein neues Ja wird geschrieben.')
