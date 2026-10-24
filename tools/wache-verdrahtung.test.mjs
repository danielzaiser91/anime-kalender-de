/**
 * Prüft, dass `check-logic-alle.mjs` und `tests-alle.mjs` den Git-Wächter (`tools/git-stand-wache.mjs`) wirklich einsetzen:
 * beide laufen in einem Temp-Git-Repo (Kopie der Läufer) mit einer Wegwerf-Prüfung, die eine getrackte bzw. eine neue Datei schreibt.
 * Aufruf: `node tools/wache-verdrahtung.test.mjs`
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const KOPIEN = ['check-logic-alle.mjs', 'tests-alle.mjs', 'arbeiterpool.mjs', 'git-stand-wache.mjs', 'sperre-umgebung.mjs', 'bau-umgebung.mjs', 'bestand-sperre.cjs', 'check-logic-vollstaendig.mjs', 'liste-pruefen.mjs', 'pr-basis.mjs']
const STILL = "console.log('still')\n"
const SCHREIBT_GETRACKT = "import { writeFileSync } from 'node:fs'\nwriteFileSync('x.txt', 'zwei\\n')\n"
const SCHREIBT_NEU = "import { writeFileSync } from 'node:fs'\nwriteFileSync('neu.txt', 'neu\\n')\n"

/** Temp-Repo mit Läufer-Kopien, `x.txt` und `<name>` als einziger Prüfung bzw. einzigem Test. */
function baueRepo(name, inhalt) {
  const ordner = mkdtempSync(join(tmpdir(), 'wache-verdrahtung-'))
  mkdirSync(join(ordner, 'tools'))
  for (const k of KOPIEN) copyFileSync(join(WURZEL, 'tools', k), join(ordner, 'tools', k))
  copyFileSync(join(WURZEL, 'package.json'), join(ordner, 'package.json'))
  symlinkSync(join(WURZEL, 'node_modules'), join(ordner, 'node_modules'), 'junction')
  writeFileSync(join(ordner, name), inhalt)
  writeFileSync(join(ordner, 'liste.txt'), `${name}\n`)
  writeFileSync(join(ordner, 'x.txt'), 'eins\n')
  writeFileSync(join(ordner, '.gitignore'), 'node_modules\n')
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: ordner, stdio: 'ignore' })
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'a')
  return ordner
}

const lauf = (ordner, args) => spawnSync(process.execPath, args, { cwd: ordner, encoding: 'utf8', env: process.env })
const zeigen = (r) => `${r.stdout}\n${r.stderr}`
const ordnerListe = []

function pruefeLaeufer(titel, skript, name, args) {
  const faelle = [
    ['schreibt nichts', STILL, 0, null],
    ['ändert eine getrackte Datei', SCHREIBT_GETRACKT, 1, /x\.txt/],
    ['legt eine neue Datei an', SCHREIBT_NEU, 1, /neu\.txt/],
  ]
  for (const [fall, inhalt, status, meldung] of faelle) {
    const ordner = baueRepo(name, inhalt)
    ordnerListe.push(ordner)
    const r = lauf(ordner, [join(ordner, 'tools', skript), ...args])
    assert.equal(r.status, status, `${titel}, Prüfung ${fall}: Exit ${r.status}\n${zeigen(r)}`)
    if (meldung) assert.match(r.stderr, meldung, `${titel}, Prüfung ${fall}: Meldung nennt die Datei`)
  }
  console.log(`  ✓ ${titel}: grün ohne Schreiben, rot bei getrackter und bei neuer Datei`)
}

try {
  pruefeLaeufer('check-logic-alle', 'check-logic-alle.mjs', 'schreibt.mjs', ['liste.txt', 'check:bestand-liste'])
  pruefeLaeufer('tests-alle', 'tests-alle.mjs', 'tools/schreibt.test.mjs', [])
  console.log('wache-verdrahtung.test: ok')
} finally {
  for (const o of ordnerListe) {
    try {
      unlinkSync(join(o, 'node_modules')) // fehlt der Link (baueRepo früh gescheitert), darf das den eigentlichen Fehler nicht verdecken
    } catch {}
    rmSync(o, { recursive: true, force: true })
  }
}
