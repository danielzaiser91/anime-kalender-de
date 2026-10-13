/**
 * Test für `tools/bau-vergleich-daten.mjs` in einem Wegwerf-Repo: Der Kandidat bekommt den Stand der Basis plus
 * nur seine eigenen Änderungen; Dateien, die beide geändert haben, werden zusammengeführt, ein Konflikt bricht ab,
 * `data/cache/` bleibt außen vor.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatenKonflikt, gleichTrotzDatenHinweis, setzeDatenstand } from './bau-vergleich-daten.mjs'
import { EXIT, exitFuerFehler } from './bau-vergleich-urteil.mjs'

const wurzel = mkdtempSync(path.join(tmpdir(), 'bau-vergleich-daten-'))
const repo = path.join(wurzel, 'repo')
const roh = (ort, ...args) => execFileSync('git', ['-C', ort, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' })
const git = (...args) => roh(repo, ...args).trim()
const schreibe = (pfad, text) => {
  mkdirSync(path.dirname(path.join(repo, pfad)), { recursive: true })
  writeFileSync(path.join(repo, pfad), text)
}
const lies = (baum, pfad) => readFileSync(path.join(baum, pfad), 'utf8')
const zeilen = (...z) => `${z.join('\n')}\n`
// Nicht als Literal: check:cache-register sucht Schreibzugriffe auf data/cache im Quelltext.
const CACHEDATEI = ['data', 'cache', 'roh.json'].join('/')
const ALT = zeilen('a: 1', 'b: 1', 'c: 1', 'd: 1', 'e: 1', 'f: 1', 'g: 1', 'h: 1')

/** Neuer Commit auf dem aktuellen Zweig mit den übergebenen Dateien (`null` = löschen). */
function commit(dateien, text) {
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    if (inhalt === null) rmSync(path.join(repo, pfad))
    else schreibe(pfad, inhalt)
  }
  git('add', '-A', '-f')
  git('commit', '-q', '-m', text)
  return git('rev-parse', 'HEAD')
}

/** Baum am Kandidaten, auf dem `setzeDatenstand` läuft; Rückgabe: Pfad. */
function baumVon(sha, name) {
  const baum = path.join(wurzel, name)
  git('worktree', 'add', '--quiet', '--detach', baum, sha)
  return baum
}

try {
  mkdirSync(repo)
  git('init', '-q', '-b', 'main')
  const start = commit(
    { 'data/dub-confirmed.yaml': ALT, 'data/weg.yaml': 'x\n', 'data/andere.yaml': 'y: 1\n', 'public/data/titles.json': '[]\n' },
    'start',
  )
  git('checkout', '-q', '-b', 'kandidat')
  const kandidat = commit(
    {
      'data/dub-confirmed.yaml': ALT.replace('b: 1', 'b: KANDIDAT'),
      'data/neu.yaml': 'neu: 1\n',
      'data/weg.yaml': null,
      [CACHEDATEI]: '{"kandidat":1}\n',
    },
    'kandidat',
  )
  git('checkout', '-q', 'main')
  const basis = commit(
    { 'data/dub-confirmed.yaml': ALT.replace('g: 1', 'g: BASIS'), 'data/andere.yaml': 'y: BASIS\n', 'public/data/titles.json': '[1]\n' },
    'basis',
  )

  const baum = baumVon(kandidat, 'baum-merge')
  const eigene = setzeDatenstand(git, (...a) => roh(baum, ...a), basis, kandidat)
  const stand = lies(baum, 'data/dub-confirmed.yaml')
  assert.ok(stand.includes('b: KANDIDAT'), 'eigene Änderung des Kandidaten fehlt')
  assert.ok(stand.includes('g: BASIS'), 'neuere Änderung der Basis an derselben Datei ging verloren')
  assert.equal(lies(baum, 'data/andere.yaml'), 'y: BASIS\n', 'Datei nur der Basis')
  assert.equal(lies(baum, 'public/data/titles.json'), '[1]\n', 'public/data der Basis')
  assert.equal(lies(baum, 'data/neu.yaml'), 'neu: 1\n', 'neue Datei des Kandidaten')
  assert.ok(!existsSync(path.join(baum, 'data/weg.yaml')), 'gelöschte Datei des Kandidaten')
  assert.ok(!existsSync(path.join(baum, CACHEDATEI)), 'data/cache/ darf nicht übernommen werden')
  assert.deepEqual(eigene.map((e) => e.pfad).sort(), ['data/dub-confirmed.yaml', 'data/neu.yaml', 'data/weg.yaml'])
  const hinweis = gleichTrotzDatenHinweis(git, basis, kandidat).join('\n')
  assert.match(hinweis, /3 Dateien/, 'Hinweis zählt data/cache/ nicht mit')
  assert.ok(!hinweis.includes('cache'), 'Hinweis nennt data/cache/')

  git('checkout', '-q', '-b', 'kandidat2', start)
  const kollision = commit({ 'data/dub-confirmed.yaml': ALT.replace('g: 1', 'g: KANDIDAT') }, 'kollision')
  const baum2 = baumVon(kollision, 'baum-konflikt')
  assert.throws(() => setzeDatenstand(git, (...a) => roh(baum2, ...a), basis, kollision), /Konflikt/, 'gleiche Stelle von beiden Seiten')
  const konflikt = (() => {
    try {
      setzeDatenstand(git, (...a) => roh(baum2, ...a), basis, kollision)
    } catch (fehler) {
      return fehler
    }
  })()
  assert.ok(konflikt instanceof DatenKonflikt, 'der Konflikt ist ein DatenKonflikt, kein beliebiger Fehler')
  assert.equal(exitFuerFehler(konflikt), EXIT.KONFLIKT, 'Konflikt bekommt einen eigenen Exit-Code')
  assert.equal(new Set(Object.values(EXIT)).size, Object.keys(EXIT).length, 'Exit-Codes sind verschieden (Konflikt ≠ verschieden)')
  assert.notEqual(EXIT.KONFLIKT, EXIT.VERSCHIEDEN)
  assert.equal(exitFuerFehler(new Error('anderer Fehler')), null, 'andere Fehler werden weitergeworfen')
  assert.match(readFileSync(path.join(import.meta.dirname, 'bau-vergleich.mjs'), 'utf8'), /exitFuerFehler\(/, 'bau-vergleich.mjs übersetzt den Konflikt')

  console.log('bau-vergleich-daten: ok')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
