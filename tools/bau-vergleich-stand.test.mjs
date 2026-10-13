/**
 * Test für `tools/bau-vergleich-stand.mjs` in einem Wegwerf-Repo: Schreibt nur eine Seite eine Datei, bekommt die andere
 * den Stand der Basis (`git show`), und die Ausgabe nennt Felder statt Textzeilen. Gegenprobe: ohne diesen Stand
 * (leerer Text) stünden nur Textzeilen da.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beschreibeDatei, liesSeite } from './bau-vergleich-stand.mjs'
import { beschreibeUnterschied } from './vergleich-unterschied.mjs'

const wurzel = mkdtempSync(path.join(tmpdir(), 'bau-vergleich-stand-'))
const git = (...args) =>
  execFileSync('git', ['-C', wurzel, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' }).trim()
const schreibe = (ordner, datei, inhalt) => {
  mkdirSync(path.dirname(path.join(ordner, datei)), { recursive: true })
  writeFileSync(path.join(ordner, datei), inhalt)
}
const glatt = (s) => s.replaceAll('<jetzt>', '<zeit>')

const alt = [{ id: 1, text: 'A' }, { id: 2, text: 'B' }]
const neu = [...alt, { id: 3, text: 'C' }]

try {
  git('init', '-q', '-b', 'main')
  schreibe(wurzel, 'public/data/patchnotes.json', JSON.stringify(alt))
  schreibe(wurzel, 'public/data/zeit.json', '["<jetzt>"]')
  git('add', '-A')
  git('commit', '-q', '-m', 'basis')
  const basis = git('rev-parse', 'HEAD')

  const leer = mkdtempSync(path.join(tmpdir(), 'bau-vergleich-stand-seite-a-'))
  const mit = mkdtempSync(path.join(tmpdir(), 'bau-vergleich-stand-seite-b-'))
  const kontext = { git, basis, glatt, eigene: new Set(['data/eigen.json']) }
  try {
    schreibe(mit, 'public/data/patchnotes.json', JSON.stringify(neu))

    // Nur der Kandidat schreibt die Datei: Feldvergleich gegen den Stand der Basis.
    const zeilen = beschreibeDatei(kontext, leer, mit, 'public/data/patchnotes.json')
    assert.deepEqual(zeilen, ['    1× [] (hinzugekommen)  (z. B. Kennung 3)'])
    // Gegenprobe: ohne Stand der Basis (leerer Text) bliebe es bei Textzeilen.
    const ohne = beschreibeUnterschied('public/data/patchnotes.json', '', JSON.stringify(neu))
    assert.ok(ohne.every((z) => z.startsWith('    + ')), 'ohne Basisstand nur Textzeilen')

    // Nur die Basis schreibt die Datei: dieselbe Auskunft, andersherum.
    assert.deepEqual(beschreibeDatei(kontext, mit, leer, 'public/data/patchnotes.json'), ['    1× [] (entfallen)  (z. B. Kennung 3)'])

    // Die Glättung gilt auch für den Stand der Basis.
    assert.equal(liesSeite(kontext, leer, 'public/data/zeit.json', false), '["<zeit>"]')

    // Eine Datei, die es in der Basis nicht gibt, bleibt ein leerer Text (kein Absturz).
    assert.equal(liesSeite(kontext, leer, 'public/data/neu.json', false), '')

    // Handdatei, die der Kandidat selbst ändert: sein Stand ist nicht der der Basis, also kein Basisstand für ihn.
    schreibe(wurzel, 'data/eigen.json', '{"a":1}')
    git('add', '-A')
    git('commit', '-q', '-m', 'mit eigener Datei')
    const kontext2 = { ...kontext, basis: git('rev-parse', 'HEAD') }
    assert.equal(liesSeite(kontext2, leer, 'data/eigen.json', true), '')
    assert.equal(liesSeite(kontext2, leer, 'data/eigen.json', false), '{"a":1}', 'die Basisseite bekommt ihren Stand')
  } finally {
    rmSync(leer, { recursive: true, force: true })
    rmSync(mit, { recursive: true, force: true })
  }
  console.log('bau-vergleich-stand: ok')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
