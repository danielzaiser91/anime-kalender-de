/**
 * Prozess-Test des Git-Anschlusses (`pr-nachrechnen-leser-git.mjs`) mit echtem git in einem Wegwerf-Repo unter os.tmpdir():
 * Remote mit `refs/pull/7/head`, Arbeitsrepo mit main. Das Fake-git der Regel-Tests (`pr-nachrechnen-leser.test.mjs`) kennt die
 * Eigenheiten von `cat-file --batch` (Bytes, Eingabe als Puffer) nicht; die Probe am echten git deckte „Unknown encoding: buffer“ auf.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gitAufruf, gitLeser } from './pr-nachrechnen-leser-git.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const F = 'data/crunchyroll-woche.json'
const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachrechnen-leser-git-'))
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const schreibe = (repo, datei, text) => {
  fs.mkdirSync(path.dirname(path.join(repo, datei)), { recursive: true })
  fs.writeFileSync(path.join(repo, datei), text)
}
const vorher = process.cwd()
try {
  const remote = path.join(wurzel, 'remote.git')
  const arbeit = path.join(wurzel, 'arbeit')
  git(wurzel, 'init', '-q', '--bare', remote)
  git(wurzel, 'init', '-q', '-b', 'main', arbeit)
  git(arbeit, 'remote', 'add', 'origin', remote)
  schreibe(arbeit, 'pipeline/bau/cr.ts', `import { x } from '../lib/helfer'\nconst d = '${F}' // Größe ä\n`)
  schreibe(arbeit, 'pipeline/lib/helfer.ts', 'export const x = 1\n')
  schreibe(arbeit, '.github/workflows/bestand.yml', 'steps:\n  - run: node tools/anderes.mjs\n')
  schreibe(arbeit, 'tools/anderes.mjs', 'const a = 1\n')
  schreibe(arbeit, 'package.json', JSON.stringify({ scripts: { a: 'x' } }))
  git(arbeit, 'add', '-A')
  git(arbeit, 'commit', '-q', '-m', 'main')
  git(arbeit, 'push', '-q', 'origin', 'main')
  const main = git(arbeit, 'rev-parse', 'main')
  // PR-Stand: Workflow geändert, Skript geändert, dazu ein neues Skript im Kopf
  git(arbeit, 'checkout', '-q', '-b', 'pr')
  schreibe(arbeit, '.github/workflows/bestand.yml', 'steps:\n  - run: node tools/anderes.mjs\n  - run: node tools/neu.mjs\n')
  schreibe(arbeit, 'tools/neu.mjs', 'const b = 2\n')
  git(arbeit, 'add', '-A')
  git(arbeit, 'commit', '-q', '-m', 'pr')
  git(arbeit, 'push', '-q', 'origin', 'pr:refs/pull/7/head')
  const kopf = git(arbeit, 'rev-parse', 'pr')
  const refs = { nummer: 7, kopf, main }
  process.chdir(arbeit)
  const leser = gitLeser(gitAufruf)
  pruefe('echtes git: Workflow- und Skript-PR ohne Leser -> null', leser([F], ['.github/workflows/bestand.yml', 'tools/neu.mjs'], refs) === null, leser([F], ['.github/workflows/bestand.yml', 'tools/neu.mjs'], refs))
  pruefe('echtes git: PR an der Hilfsdatei des Lesers -> Rückrichtung', /pipeline\/lib\/helfer\.ts wird von Code genutzt/.test(leser([F], ['pipeline/lib/helfer.ts'], refs)))
  pruefe('echtes git: PR am Leser selbst -> Grund (Mehrbyte-Zeichen im Kommentar stören nicht)', leser([F], ['pipeline/bau/cr.ts'], refs) !== null)
  pruefe('echtes git: PR ändert Handbelege, Leser der bewegten Datei vorhanden -> Grund', /^der PR ändert data\/dub-confirmed\.yaml/.test(leser([F], ['tools/neu.mjs', 'data/dub-confirmed.yaml'], refs)))
  pruefe('echtes git: package.json im Kopf unverändert -> kein Skript geändert, null', leser([F], ['package.json', 'tools/neu.mjs'], refs) === null)
  const kaputt = gitLeser(gitAufruf)([F], ['tools/neu.mjs'], { ...refs, nummer: 99 })
  pruefe('echtes git: Kopf nicht abrufbar (kein refs/pull/99/head) -> nicht ermittelbar', /^Leser nicht ermittelbar \(/.test(kaputt), kaputt)
} finally {
  process.chdir(vorher)
  fs.rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-leser-git.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-leser-git.test: grün')
