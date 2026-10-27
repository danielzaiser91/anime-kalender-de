/**
 * Prozess-Test von `pr-nachrechnen-vergleich-git.mjs` mit echtem git in einem Wegwerf-Repo unter os.tmpdir() (Remote + Arbeitsrepo):
 * Sprung über der 300-Dateien-Grenze der Compare-API, Umbenennung, Autoren, unbekannte Basis.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gitAufruf } from './pr-nachrechnen-leser-git.mjs'
import { vollerVergleich } from './pr-nachrechnen-vergleich-git.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachrechnen-vergleich-git-'))
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
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
  schreibe(arbeit, 'tools/alt.mjs', 'const a = 1\n')
  git(arbeit, 'add', '-A')
  git(arbeit, 'commit', '-q', '-m', 'basis')
  git(arbeit, 'push', '-q', 'origin', 'main')
  const basis = git(arbeit, 'rev-parse', 'main')
  // Sprung: 350 Datendateien eines Bots, dann Umbenennung eines Skripts von einem Menschen
  for (let i = 0; i < 350; i++) schreibe(arbeit, `public/data/d${i}.json`, `${i}\n`)
  git(arbeit, 'add', '-A')
  git(arbeit, '-c', 'user.name=github-actions[bot]', 'commit', '-q', '-m', 'daten', '--author=github-actions[bot] <b@b>')
  git(arbeit, 'mv', 'tools/alt.mjs', 'tools/neu.mjs')
  schreibe(arbeit, 'docs/Übersicht für Ä.md', 'x\n')
  git(arbeit, 'add', '-A')
  git(arbeit, 'commit', '-q', '-m', 'umbenannt', '--author=Mensch <m@m>')
  git(arbeit, 'push', '-q', 'origin', 'main')
  const main = git(arbeit, 'rev-parse', 'main')
  // frischer Klon kennt nur die Basis, wie der Checkout des Aufrufers
  const klon = path.join(wurzel, 'klon')
  git(wurzel, 'clone', '-q', '--no-checkout', remote, klon)
  git(klon, 'reset', '-q', '--soft', basis)
  process.chdir(klon)
  const r = vollerVergleich(gitAufruf)(basis, main)
  pruefe('echtes git: 350 Datendateien + Umbenennung = 353 Pfade (alter und neuer Name, Umlaute ungequotet)', r.dateien?.length === 353 && r.dateien.includes('docs/Übersicht für Ä.md') && r.dateien.includes('tools/alt.mjs') && r.dateien.includes('tools/neu.mjs'), r.fehler ?? r.dateien?.length)
  pruefe('echtes git: Autoren je Commit, neuester zuerst', r.commitsGesamt === 2 && r.autoren.join() === 'Mensch,github-actions[bot]', r)
  const kaputt = vollerVergleich(gitAufruf)('0'.repeat(40), main)
  pruefe('echtes git: unbekannte Basis -> fehler, keine Dateiliste', typeof kaputt.fehler === 'string' && kaputt.dateien === undefined, kaputt)
  const leer = vollerVergleich(gitAufruf)(main, main)
  pruefe('echtes git: Basis = main -> leere Listen, kein Fehler', leer.fehler === undefined && leer.dateien.length === 0 && leer.commitsGesamt === 0, leer)
} finally {
  process.chdir(vorher)
  fs.rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-vergleich-git.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-vergleich-git.test: grün')
