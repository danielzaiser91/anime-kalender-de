/**
 * Test für `tools/bau-vergleich-ablage.mjs`: Jede Einstellung, die das Ergebnis eines Baus ändert, steht im Namen seiner Ablage —
 * sonst läuft ein Vergleich gegen eine Basis, die mit anderer Einstellung gebaut wurde. Dazu die Optionen und der Hinweis,
 * dass ohne Katalog-Datei der Katalogpfad nicht mitläuft.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { BAU_UMGEBUNG, ablageName, einstellungsZeilen, hauptordnerAus, liesOptionen, umgebungsMarke } from './bau-vergleich-ablage.mjs'

const ordner = mkdtempSync(path.join(tmpdir(), 'bau-vergleich-ablage-'))
try {
  const sha = 'a'.repeat(40)
  const basis = 'b'.repeat(40)
  const katalogA = path.join(ordner, 'a.json')
  const katalogB = path.join(ordner, 'b.json')
  writeFileSync(katalogA, '{"x":1}')
  writeFileSync(katalogB, '{"x":2}')

  // Ohne gesetzte Variable bleibt der Name wie vor der Änderung (vorhandene Ablagen gelten weiter).
  assert.equal(ablageName(sha, basis, undefined, {}), `${'a'.repeat(12)}-auf-${'b'.repeat(12)}-delta`)
  assert.equal(ablageName(basis, basis, undefined, {}), `${'b'.repeat(12)}-auf-${'b'.repeat(12)}`)

  // Jede Umgebungsvariable des Baus ändert den Namen, verschiedene Werte verschiedene Namen.
  const ohne = ablageName(sha, basis, undefined, {})
  // Ein Bau mit zurückgestellten Titeln (Quarantäne) ist ein anderer Bau.
  assert.notEqual(ablageName(sha, basis, undefined, { BAU_QUARANTAENE: '/x/q.json' }), ohne)
  for (const name of BAU_UMGEBUNG) {
    const eins = ablageName(sha, basis, undefined, { [name]: 'eins' })
    const zwei = ablageName(sha, basis, undefined, { [name]: 'zwei' })
    assert.notEqual(eins, ohne, `${name} fehlt im Namen der Ablage`)
    assert.notEqual(eins, zwei, `${name}: zwei Werte, eine Ablage`)
  }
  assert.match(umgebungsMarke({ REIHEN_QUELLE: 'anilist' }), /^-reihen_quelle-anilist$/)
  // Fremde Variablen gehören nicht in den Namen.
  assert.equal(ablageName(sha, basis, undefined, { PATH: '/x', LAUF_TOKEN: 'geheim' }), ohne)
  // Lange Werte (Adressen) werden kurz und bleiben unterscheidbar.
  const lang = (s) => umgebungsMarke({ SITE_URL: `https://beispiel.example/${s}/` })
  assert.ok(lang('eins').length < 40 && lang('eins') !== lang('zwei'))

  // Die Katalog-Datei zählt mit ihrem Inhalt, auch bei gleicher Größe.
  assert.equal(readFileSync(katalogA).length, readFileSync(katalogB).length)
  assert.notEqual(ablageName(sha, basis, katalogA, {}), ablageName(sha, basis, katalogB, {}))
  assert.notEqual(ablageName(sha, basis, katalogA, {}), ohne)
  assert.equal(ablageName(sha, basis, katalogA, {}), ablageName(sha, basis, katalogA, {}))

  // Optionen: `--katalog=Pfad`, `--katalog` (Hauptordner), Umgebungsvariable; Positionen bleiben übrig.
  assert.deepEqual(liesOptionen(['x', `--katalog=${katalogA}`, 'y'], {}, ordner), { positionen: ['x', 'y'], katalog: katalogA })
  assert.equal(liesOptionen([], { BAU_VERGLEICH_KATALOG: katalogB }, ordner).katalog, katalogB)
  assert.equal(liesOptionen([], {}, ordner).katalog, undefined)
  assert.throws(() => liesOptionen(['--katalog'], {}, ordner), /Katalog-Datei fehlt/)
  assert.throws(() => liesOptionen(['--katalog=nirgends.json'], {}, ordner), /fehlt/)

  // Hauptordner: im Worktree zeigt `--git-common-dir` absolut auf `<Hauptordner>/.git`, im Hauptordner relativ auf `.git`.
  const haupt = path.join(ordner, 'haupt')
  assert.equal(hauptordnerAus(`${haupt.replaceAll('\\', '/')}/.git`, path.join(ordner, 'worktree')), haupt)
  assert.equal(hauptordnerAus('.git', haupt), haupt)
  // Der echte Aufruf liefert in jedem Checkout einen Ordner mit `.git` (Hauptordner oder Worktree).
  const echt = execFileSync('git', ['-C', import.meta.dirname, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim()
  assert.ok(existsSync(path.join(hauptordnerAus(echt, import.meta.dirname), '.git')))

  // Ohne Katalog steht der Hinweis im Ergebnis, mit Katalog nicht.
  assert.ok(einstellungsZeilen(undefined, {}).some((z) => z.startsWith('HINWEIS')))
  assert.ok(!einstellungsZeilen(katalogA, {}).some((z) => z.startsWith('HINWEIS')))
  assert.ok(einstellungsZeilen(katalogA, { REIHEN_QUELLE: 'anilist' }).some((z) => z.includes('REIHEN_QUELLE=anilist')))

  // `bau-vergleich.mjs` benennt die Ablage nur über das Modul (kein zweiter Namensweg).
  const werkzeug = readFileSync(new URL('./bau-vergleich.mjs', import.meta.url), 'utf8')
  assert.match(werkzeug, /ablageName\(sha, basisSha, KATALOG_CACHE, process\.env\)/)
  assert.ok(!werkzeug.includes('KATALOG_MARKE'))
  assert.match(werkzeug, /hauptordnerAus\(git\('rev-parse', '--git-common-dir'\), WURZEL\)/)
  console.log('bau-vergleich-ablage.test: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
