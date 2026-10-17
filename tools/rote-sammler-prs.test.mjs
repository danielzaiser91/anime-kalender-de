// Gegenprobe zu `tools/rote-sammler-prs.mjs` (17.10.2026): Auswahl, Alter, Text, und die Verdrahtung in `tools/laeufe-aufraeumen.mjs`.
// Das Werkzeug läuft ganz (ohne Netz: untergeschobenes fetch), `gh` ist eine Attrappe im PATH und prüft Befehl und Parameter.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abzuloesen, meldeRoteSammlerPrs, rotePrs, zeilen } from './rote-sammler-prs.mjs'

const JETZT = Date.parse('2026-10-17T12:00:00Z')
const vorStunden = (h) => new Date(JETZT - h * 3600_000).toISOString()
const liste = [
  { number: 1, title: 'chore(data): ohne Marke', body: '**A**', createdAt: vorStunden(1) },
  { number: 2, title: '[Prüfung rot] chore(data): Zwei', body: 'von **A** (Lauf 1)', createdAt: vorStunden(5) },
  { number: 3, title: '[Prüfung rot] chore(data): Drei', body: 'von **B** (Lauf 2)', createdAt: vorStunden(72) },
  { number: 4, title: 'x [Prüfung rot] mitten im Titel', body: '**A**', createdAt: vorStunden(1) },
  { number: 5, title: '[Prüfung rot] chore(data): Fünf', body: 'von **A** (Lauf 3)', createdAt: vorStunden(47) },
  { number: 6, title: '[Prüfung rot] chore(data): Sechs', body: 'von **AB** (Lauf 4)', createdAt: vorStunden(2) },
  { number: 7, title: '[Prüfung rot] ohne Text', createdAt: vorStunden(2) },
]

assert.deepEqual(rotePrs(liste).map((p) => p.number), [2, 3, 5, 6, 7], 'nur Titel, die mit der Marke beginnen')
assert.deepEqual(rotePrs(liste, 'A').map((p) => p.number), [2, 5], 'Workflow-Name ganz, nicht als Teilwort')
assert.deepEqual(abzuloesen(liste, 'A', 5), [2], 'der neue PR löst sich nicht selbst ab')
assert.deepEqual(abzuloesen(liste, 'A', '2'), [5], 'Nummer als Text gleich Nummer als Zahl')
assert.deepEqual(abzuloesen(liste, 'C', 9), [])
assert.deepEqual(zeilen([liste[0]], JETZT), [], 'nichts offen: keine Zeilen')
const z = zeilen(liste, JETZT)
assert.match(z[0], /^5 Sammler-PR/)
assert.ok(z.some((s) => /#2 {2}seit 5 h {2}\[Prüfung rot\] chore\(data\): Zwei/.test(s)), z.join('\n'))
assert.ok(z.some((s) => /#3 {2}seit 3 Tage /.test(s)), 'ab 48 Stunden in Tagen')
assert.ok(z.some((s) => /#5 {2}seit 47 h /.test(s)), 'unter 48 Stunden in Stunden')

assert.match(zeilen([{ number: 8, title: '[Prüfung rot] z', body: '', createdAt: vorStunden(71) }], JETZT)[1], /seit 2 Tage/, 'Tage werden abgerundet')
const ausgabe = []
meldeRoteSammlerPrs(() => liste, (t) => ausgabe.push(t), JETZT)
assert.match(ausgabe.join('\n'), /#3 {2}seit 3 Tage/)
const leer = []
meldeRoteSammlerPrs(() => [liste[0]], (t) => leer.push(t), JETZT)
assert.deepEqual(leer, ['Keine Sammler-PRs mit roter Datenprüfung offen.'])
const kaputt = []
meldeRoteSammlerPrs(() => { throw new Error('gh kaputt\nzweite Zeile') }, (t) => kaputt.push(t), JETZT)
assert.deepEqual(kaputt, ['Rote Sammler-PRs nicht lesbar: gh kaputt'], 'ein Abruffehler wirft nicht')

// Verdrahtung: Die Wachphase (laeufe-aufraeumen --trocken) nennt die roten PRs, obwohl alle Läufe grün sind.
const dir = mkdtempSync(join(tmpdir(), 'rote-prs-'))
try {
  const d = dir.replace(/\\/g, '/')
  const befehl = 'pr list --state open --limit 100 --json number,title,body,createdAt'
  writeFileSync(join(dir, 'liste.json'), JSON.stringify(liste))
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\ncase "$*" in "${befehl}") cat "${d}/liste.json" ;; *) echo "falsche Parameter: $*" >&2; exit 1 ;; esac\n`)
  chmodSync(join(dir, 'gh'), 0o755)
  writeFileSync(join(dir, 'gh.cmd'), `@echo off\r\nif "%*"=="${befehl}" (type "${join(dir, 'liste.json')}") else (echo falsche Parameter: %* 1>&2 & exit /b 1)\r\n`)
  const vorlauf = 'data:text/javascript,globalThis.fetch=async()=>new Response("[]",{status:200})'
  const werkzeug = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const r = spawnSync(process.execPath, ['--import', vorlauf, werkzeug, '--trocken'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}` },
  })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /5 Sammler-PR\(s\) mit roter Datenprüfung offen/)
  assert.match(r.stdout, /#3 {2}seit 3 Tage/)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log('rote-sammler-prs: ok')
