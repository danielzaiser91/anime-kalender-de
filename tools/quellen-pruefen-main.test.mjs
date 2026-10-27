/**
 * `quellen_pruefen_main` (tools/quellen-pruefen.sh) verschluckt keinen Fehler mehr per `|| true`:
 * Exit 1 der Prüfung auf main ist der Befund (Liste auf stdout), ein fehlender Arbeitsbaum oder Exit > 1 steht auf stderr.
 * Echtes git in Wegwerf-Repos unter os.tmpdir(); die Prüfung ist ein Wegwerf-Befehl (`QUELLEN_PRUEFBEFEHL`).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const skript = join(dirname(fileURLToPath(import.meta.url)), 'quellen-pruefen.sh').replace(/\\/g, '/')
const ordner = mkdtempSync(join(tmpdir(), 'quellen-pruefen-main-'))
const posix = (p) => p.replace(/\\/g, '/')

const git = (cwd, ...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', windowsHide: true })

/** Repo mit (mitMain) oder ohne `origin/main`; liefert den Arbeitsordner. */
function repo(name, mitMain) {
  const d = join(ordner, name)
  assert.equal(git(ordner, 'init', '-q', '-b', 'main', d).status, 0)
  assert.equal(git(d, 'commit', '-q', '--allow-empty', '-m', 'start').status, 0)
  if (mitMain) assert.equal(git(d, 'update-ref', 'refs/remotes/origin/main', 'HEAD').status, 0)
  return d
}

/** Ruft `quellen_pruefen_main` im Repo auf; `vorher` ist Shell-Text vor dem Aufruf (Attrappen). */
function main(cwd, befehl, vorher = '') {
  const r = spawnSync('bash', ['-c', `source "${skript}"\n${vorher}\nquellen_pruefen_main`], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, QUELLEN_PRUEFBEFEHL: befehl },
  })
  return { status: r.status, out: r.stdout, err: r.stderr }
}

try {
  const rot = 'echo "  - tools/a.ts"; exit 1'

  // Rote Prüfung auf main: Befund auf stdout, keine Fehlermeldung (Exit 1 ist erwartet).
  const a = main(repo('rot', true), rot)
  assert.equal(a.status, 0, a.err)
  assert.equal(a.out, '  - tools/a.ts\n', 'Befund von main steht auf stdout')
  assert.ok(!/konnte nicht laufen|Kein Arbeitsbaum/.test(a.err), `Exit 1 ist kein Fehler: ${a.err}`)

  // Grüne Prüfung auf main: nichts auf stdout.
  const b = main(repo('gruen', true), 'true')
  assert.equal(b.status, 0, b.err)
  assert.equal(b.out, '')
  assert.ok(!/konnte nicht laufen|Kein Arbeitsbaum/.test(b.err), b.err)

  // Kein origin/main: Arbeitsbaum fehlt, die Meldung steht auf stderr, Basis leer, kein Abbruch.
  const c = main(repo('ohne-main', false), rot)
  assert.equal(c.status, 0, c.err)
  assert.equal(c.out, '', 'ohne Arbeitsbaum läuft die Prüfung nirgends')
  assert.match(c.err, /Kein Arbeitsbaum für origin\/main; der Vergleich gilt ohne Basis\./)

  // Arbeitsbaum lässt sich nicht betreten (git meldet Erfolg, legt aber nichts an): Exit 2 sichtbar, Prüfung läuft nicht im falschen Ordner.
  const attrappe = 'git() {\n  if [ "$1" = worktree ] && [ "$2" = add ]; then return 0; fi\n  command git "$@"\n}'
  const d = main(repo('kein-ordner', true), rot, attrappe)
  assert.equal(d.status, 0, d.err)
  assert.equal(d.out, '', 'die Prüfung darf nicht im Arbeitsordner des Aufrufers laufen')
  assert.match(d.err, /Die Prüfung auf main konnte nicht laufen \(Exit 2\); der Vergleich gilt ohne Basis\./)

  console.log('quellen-pruefen-main: 4 Fälle grün (rot, grün, ohne main, Ordner fehlt).')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
