/**
 * Laufzeitprobe zu tools/pr-vorpruefung.mjs: `main()` meldet eine unsortierte Prüfliste (Verdrahtung von listenRot)
 * und Tests mit echter Uhr über der Grenze von tools/uhr-in-tests-grenzen.json (Verdrahtung von uhrRot).
 * Baut in einem Wegwerf-Ordner unter os.tmpdir() ein Repo mit „origin“ und startet die Vorprüfung als eigenen Prozess.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SKRIPT = resolve(import.meta.dirname, 'pr-vorpruefung.mjs')
const UHR = resolve(import.meta.dirname, 'uhr-in-tests.mjs')
const MODULE = resolve(import.meta.dirname, '../node_modules')
const wurzel = mkdtempSync(join(tmpdir(), 'vorpruefung-lauf-'))
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, stdio: 'ignore' })
const SORTIERT = '# k\npipeline/check-a-b.ts\npipeline/check-a.ts\n'

/** Klon mit einem Zweigcommit (Prüfliste `liste`, Testdatei `testText`); `erlaubt` ist die Uhr-Grenze der Basis. */
function lauf(name, liste, testText = 'export const x = 1\n', erlaubt = 0, opt = {}) {
  const bare = join(wurzel, `${name}.git`)
  const arbeit = join(wurzel, name)
  mkdirSync(arbeit, { recursive: true })
  git(arbeit, 'init', '-q', '-b', 'main')
  mkdirSync(join(arbeit, 'tools'))
  writeFileSync(join(arbeit, 'tools/umfang-pruefen.mjs'), "console.log('Umfang in Ordnung.')\n")
  copyFileSync(UHR, join(arbeit, 'tools/uhr-in-tests.mjs'))
  writeFileSync(join(arbeit, 'tools/uhr-in-tests-grenzen.json'), JSON.stringify({ erlaubt }))
  writeFileSync(join(arbeit, 'README.md'), 'k\na b\n')
  writeFileSync(join(arbeit, '.gitignore'), 'node_modules\n')
  symlinkSync(MODULE, join(arbeit, 'node_modules'), 'junction')
  git(arbeit, 'add', '.')
  git(arbeit, 'commit', '-q', '-m', 'basis')
  git(wurzel, 'clone', '-q', '--bare', arbeit, bare)
  git(arbeit, 'remote', 'add', 'origin', bare)
  git(arbeit, 'fetch', '-q', 'origin')
  git(arbeit, 'checkout', '-q', '-b', 'speed/x')
  writeFileSync(join(arbeit, 'tools/check-logic-liste.txt'), liste)
  writeFileSync(join(arbeit, 'tools/zeit.test.mjs'), testText)
  if (opt.readme) writeFileSync(join(arbeit, 'README.md'), opt.readme)
  git(arbeit, 'add', '.')
  git(arbeit, 'commit', '-q', '-m', 'liste')
  const text = `tools/check-logic-liste.txt und tools/zeit.test.mjs neu (Prüfung der Liste).
Patch Notes: keine – Technik${opt.zusatz ?? ''}`
  const r = spawnSync(process.execPath, [SKRIPT, '--titel', opt.titel ?? 't', '--text', text], { cwd: arbeit, encoding: 'utf8' })
  return { status: r.status, text: `${r.stdout}\n${r.stderr}` }
}

try {
  const rot = lauf('rot', '# k\npipeline/check-a.ts\npipeline/check-a-b.ts\n')
  assert.equal(rot.status, 1, 'unsortierte Liste macht die Vorprüfung rot')
  assert.match(rot.text, /Vorprüfung: tools\/check-logic-liste\.txt muss alphabetisch sortiert sein/, 'Meldung nennt die Liste')
  const gruen = lauf('gruen', SORTIERT)
  assert.equal(gruen.status, 0, `sortierte Liste bleibt grün: ${gruen.text}`)
  const jetzt = 'export const t = Date.now()\n'
  const uhr = lauf('uhr', SORTIERT, jetzt)
  assert.equal(uhr.status, 1, 'Date.now() über der Grenze macht die Vorprüfung rot')
  assert.match(uhr.text, /Uhr in Tests/, 'Meldung nennt die Uhr-Prüfung')
  assert.match(uhr.text, /1 statt höchstens 0/, 'Meldung nennt die Zählung des Wächters')
  assert.match(uhr.text, /Dateien dieses PR: tools\/zeit\.test\.mjs:1\b/, 'Meldung nennt die Datei und Zeile')
  const grenze = lauf('grenze', SORTIERT, jetzt, 1)
  assert.equal(grenze.status, 0, `Date.now() genau an der Grenze bleibt grün: ${grenze.text}`)
  const verschluckt = lauf('leer', SORTIERT, undefined, 0, { readme: 'k\nab\n', zusatz: ' README.md' })
  assert.equal(verschluckt.status, 1, 'verschluckter Leerraum in einer Nachbarzeile macht die Vorprüfung rot')
  assert.match(verschluckt.text, /Leerraum-Änderung README\.md:2 /, 'Meldung nennt Datei und Zeile')
  const absicht = lauf('absicht', SORTIERT, undefined, 0, { readme: 'k\nab\n', zusatz: ' README.md\nLeerraum: absichtlich – Probe' })
  assert.equal(absicht.status, 0, `Zeile „Leerraum: absichtlich“ lässt den Diff durch: ${absicht.text}`)
  const datenTitel = lauf('daten', SORTIERT, undefined, 0, { titel: 'fix(prime): fünf Fremdzuordnungen sperren' })
  assert.equal(datenTitel.status, 1, 'Daten-Titel mit „keine“ ohne gemessene Wirkung macht die Vorprüfung rot')
  assert.match(datenTitel.text, /gemessene Wirkung/, 'Meldung nennt die Titelregel')
  console.log('pr-vorpruefung-lauf.test: ok (unsortiert rot, sortiert grün, Uhr über Grenze rot, an Grenze grün, Leerraum rot, Ausweg grün, Daten-Titel rot)')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
