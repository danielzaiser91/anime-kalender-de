/**
 * Laufzeitprobe zu tools/pr-vorpruefung.mjs: `main()` meldet eine unsortierte Prüfliste (Verdrahtung von listenRot).
 * Baut in einem Wegwerf-Ordner unter os.tmpdir() ein Repo mit „origin“ und startet die Vorprüfung als eigenen Prozess.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SKRIPT = resolve(import.meta.dirname, 'pr-vorpruefung.mjs')
const wurzel = mkdtempSync(join(tmpdir(), 'vorpruefung-lauf-'))
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, stdio: 'ignore' })

/** Klon mit einem Zweigcommit, der `tools/check-logic-liste.txt` mit diesem Inhalt anlegt; Ergebnis der Vorprüfung. */
function lauf(name, liste) {
  const bare = join(wurzel, `${name}.git`)
  const arbeit = join(wurzel, name)
  mkdirSync(arbeit, { recursive: true })
  git(arbeit, 'init', '-q', '-b', 'main')
  mkdirSync(join(arbeit, 'tools'))
  writeFileSync(join(arbeit, 'tools/umfang-pruefen.mjs'), "console.log('Umfang in Ordnung.')\n")
  writeFileSync(join(arbeit, 'README.md'), 'x\n')
  git(arbeit, 'add', '.')
  git(arbeit, 'commit', '-q', '-m', 'basis')
  git(wurzel, 'clone', '-q', '--bare', arbeit, bare)
  git(arbeit, 'remote', 'add', 'origin', bare)
  git(arbeit, 'fetch', '-q', 'origin')
  git(arbeit, 'checkout', '-q', '-b', 'speed/x')
  writeFileSync(join(arbeit, 'tools/check-logic-liste.txt'), liste)
  git(arbeit, 'add', '.')
  git(arbeit, 'commit', '-q', '-m', 'liste')
  const text = 'tools/check-logic-liste.txt neu (Prüfung der Liste). Patch Notes: keine – Technik'
  const r = spawnSync(process.execPath, [SKRIPT, '--titel', 't', '--text', text], { cwd: arbeit, encoding: 'utf8' })
  return { status: r.status, text: `${r.stdout}\n${r.stderr}` }
}

try {
  const rot = lauf('rot', '# k\npipeline/check-a.ts\npipeline/check-a-b.ts\n')
  assert.equal(rot.status, 1, 'unsortierte Liste macht die Vorprüfung rot')
  assert.match(rot.text, /Vorprüfung: tools\/check-logic-liste\.txt muss alphabetisch sortiert sein/, 'Meldung nennt die Liste')
  const gruen = lauf('gruen', '# k\npipeline/check-a-b.ts\npipeline/check-a.ts\n')
  assert.equal(gruen.status, 0, `sortierte Liste bleibt grün: ${gruen.text}`)
  console.log('pr-vorpruefung-lauf.test: ok (unsortiert rot, sortiert grün)')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
