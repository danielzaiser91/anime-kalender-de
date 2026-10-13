/**
 * Test für `tools/bau-vergleich-abstand.mjs` in einem Wegwerf-Repo: keine Warnung, wenn die Basis Vorfahre des Kandidaten ist;
 * eine Warnung mit Zahl der fehlenden Commits und Merge-Basis, wenn der Kandidat hinter der Basis liegt oder auseinandergelaufen ist;
 * fremde Unterschiede (Dateien, die die Basis geändert hat) werden gezählt.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { abstandsWarnung, fremdeUnterschiede, messeAbstand, vonBasisGeaendert } from './bau-vergleich-abstand.mjs'

const wurzel = mkdtempSync(path.join(tmpdir(), 'bau-vergleich-abstand-'))
const git = (...args) =>
  execFileSync('git', ['-C', wurzel, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' }).trim()
function commit(datei, inhalt) {
  mkdirSync(path.dirname(path.join(wurzel, datei)), { recursive: true })
  writeFileSync(path.join(wurzel, datei), inhalt)
  git('add', '-A')
  git('commit', '-q', '-m', datei)
  return git('rev-parse', 'HEAD')
}

try {
  git('init', '-q', '-b', 'main')
  const start = commit('a.txt', '1\n')
  git('checkout', '-q', '-b', 'kandidat')
  const kandidat = commit('code.mjs', 'neu\n')
  git('checkout', '-q', 'main')

  // Basis ist Vorfahre des Kandidaten: nichts zu warnen.
  const gerade = messeAbstand(git, start, kandidat)
  assert.deepEqual([gerade.voraus, gerade.zurueck], [1, 0])
  assert.deepEqual(abstandsWarnung(gerade, start, kandidat), [])

  // main läuft weiter (Bestandsbau schreibt Synopsen): der Kandidat liegt dahinter und ist auseinandergelaufen.
  commit('public/data/synopses/1.json', '{}\n')
  const basis = commit('public/data/synopses/2.json', '{}\n')
  const hinten = messeAbstand(git, basis, kandidat)
  assert.deepEqual([hinten.voraus, hinten.zurueck, hinten.mergeBase], [1, 2, start])
  const warnung = abstandsWarnung(hinten, basis, kandidat).join('\n')
  assert.match(warnung, /^WARNUNG: Die Basis /)
  assert.match(warnung, /2 Commits der Basis fehlen/)
  assert.match(warnung, /auseinandergelaufen/)
  assert.ok(warnung.includes(`bau-vergleich.mjs ${start.slice(0, 12)} ${kandidat.slice(0, 12)}`), 'nennt den Vergleich gegen die Merge-Basis')

  // Kandidat nur zurück (Vorfahre der Basis): ebenfalls Warnung, ohne „eigene Commits“.
  const zurueck = messeAbstand(git, basis, start)
  assert.match(abstandsWarnung(zurueck, basis, start).join('\n'), /ist Vorfahre der Basis/)
  assert.ok(!abstandsWarnung(zurueck, basis, start).join(' ').includes('bau-vergleich.mjs'), 'kein sinnloser Vorschlag, wenn der Kandidat nichts mitbringt')

  // Fremde Unterschiede: nur Dateien, die die Basis seit der Merge-Basis geändert hat.
  const geaendert = vonBasisGeaendert(git, hinten, basis)
  assert.deepEqual(geaendert.sort(), ['public/data/synopses/1.json', 'public/data/synopses/2.json'])
  const zeile = fremdeUnterschiede(['public/data/synopses/1.json', 'public/data/titles.json'], geaendert)
  assert.match(zeile, /Davon 1 von 2 Dateien/)
  assert.equal(fremdeUnterschiede(['public/data/titles.json'], geaendert), null, 'eigene Unterschiede werden nicht als fremd gemeldet')

  console.log('bau-vergleich-abstand: ok')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
