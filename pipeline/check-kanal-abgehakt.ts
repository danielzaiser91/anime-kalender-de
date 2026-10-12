/**
 * Zusicherung: Eine Kanal-Meldung ohne Urteil wird abgehakt und taucht nicht zusätzlich als
 * „bleibt liegen“ in der Liste auf (Prüfer-Befund PR 766, 11.10.2026). Der Lauf liest dazu eine
 * erfundene Meldung gegen eine Attrappe des Bestands (`tools/kanal-abgehakt-mock.mjs`, liest nichts aus `public/data`), geschrieben wird nichts (`--trocken`).
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/kanal-abgehakt-mock.mjs')).href

const lauf = spawnSync(
  process.execPath,
  [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts'), '--trocken'],
  { cwd: wurzel, encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: 'test' } },
)
const text = `${lauf.stdout}\n${lauf.stderr}`
const fehler: string[] = []
if (lauf.status !== 0) fehler.push(`Lauf endete mit ${lauf.status}`)
if (!text.includes('1 Meldungen waeren abgehakt')) fehler.push('Die Kanal-Meldung wurde nicht abgehakt')
if (text.includes('bleibt liegen')) fehler.push('Die abgehakte Meldung steht fälschlich als „bleibt liegen“')
if (fehler.length) {
  console.error(`check-kanal-abgehakt: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-kanal-abgehakt: Kanal-Meldung abgehakt, nicht als liegengeblieben gelistet.')
