/**
 * Prozesstest zu `nacht-merger.mjs`: der Hauptblock (`process.exit(exitCode(ergebnis))`) mit einem Ersatz-`gh` im PATH.
 * Belegt, dass Stillstand (0 Merges, PR technisch unentschieden) den Prozess mit Exit 1 beendet, ein echter Konflikt nicht.
 * Die Attrappe gibt die Ausgaben wieder, die `gh` nach `--json`/`--jq` liefert (Lehre 71); Linux/macOS (Ersatz-`gh` ist ein Node-Skript).
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform === 'win32') {
  console.log('nacht-merger-prozess.test: übersprungen (Ersatz-gh braucht Unix-Shebang; läuft in CI unter Linux)')
  process.exit(0)
}

let fehler = 0
let anzahl = 0
function pruefe(name, ok, info = '') {
  anzahl++
  if (!ok) {
    fehler++
    console.error(`✗ ${name} ${info}`)
  }
}

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const KOPF = 'a'.repeat(40)
const PR = { number: 7, title: 'T', body: '', headRefOid: KOPF, headRefName: 'fix/x', isDraft: false, createdAt: '2026-11-01T08:00:00Z', reviewDecision: 'APPROVED', mergeStateStatus: 'UNKNOWN', changedFiles: 1 }
const CHECKS = [{ __typename: 'CheckRun', name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'SUCCESS' }]
const NACHTRAG = { login: 'danielzaiser91', assoc: 'OWNER', at: '2026-11-01T11:00:00Z', body: `## Nachtrag (Abnahme Dirigent) — Kopf ${KOPF.slice(0, 9)}\nAuflagen erfüllt` }

// Ersatz-gh: Antworten je Aufruf; MERGEABLE aus der Umgebung steuert, was `pr view --json number,state,mergeable,…` meldet.
const gh = `#!/usr/bin/env node
const a = process.argv.slice(2)
const j = a.join(' ')
const aus = (x) => { process.stdout.write(typeof x === 'string' ? x : JSON.stringify(x)); process.exit(0) }
if (a[0] === 'pr' && a[1] === 'list') aus([${JSON.stringify(PR)}])
if (a[0] === 'api' && j.includes('/pulls/7/files')) aus('web/src/a.tsx\\n')
if (a[0] === 'api' && j.includes('/issues/7/comments')) aus(${JSON.stringify(JSON.stringify(NACHTRAG))} + '\\n')
if (a[0] === 'pr' && a[1] === 'view' && j.includes('statusCheckRollup')) aus(${JSON.stringify(CHECKS)})
if (a[0] === 'pr' && a[1] === 'view' && j.includes('headRefOid') && !j.includes('mergeable')) aus('${KOPF}\\n')
if (a[0] === 'pr' && a[1] === 'view' && j.includes('mergeable')) aus({ number: 7, state: 'OPEN', mergeable: process.env.PR_MERGEABLE, headRefOid: '${KOPF}', headRefName: 'fix/x', comments: [], commits: [] })
if (a[0] === 'pr' && a[1] === 'view' && j.includes('mergeStateStatus')) aus('UNKNOWN\\n')
if (a[0] === 'run' && a[1] === 'list') aus('[]')
console.error('Ersatz-gh kennt den Aufruf nicht: ' + j)
process.exit(1)
`

const ordner = mkdtempSync(join(tmpdir(), 'nacht-merger-prozess-'))
writeFileSync(join(ordner, 'gh'), gh)
chmodSync(join(ordner, 'gh'), 0o755)
function fahre(mergeable) {
  const r = spawnSync(process.execPath, ['tools/nacht-merger.mjs', '--trocken'], {
    cwd: wurzel,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, PATH: `${ordner}:${process.env.PATH}`, GITHUB_REPOSITORY: 'o/r', GITHUB_STEP_SUMMARY: '', NACHT_MERGER_WARTE_MS: '20', PR_MERGEABLE: mergeable },
  })
  return { exit: r.status, aus: `${r.stdout}${r.stderr}` }
}

const stillstand = fahre('UNKNOWN')
pruefe('Prozess: nur UNKNOWN offen -> Warnzeile und Exit 1', stillstand.exit === 1 && stillstand.aus.includes('::warning::Nacht-Merger: 0 Merges, 1 PR technisch nicht entschieden (#7)'), `${stillstand.exit} ${stillstand.aus}`)
const konflikt = fahre('CONFLICTING')
pruefe('Prozess: nur Konflikt-PR offen -> keine Warnung, Exit 0', konflikt.exit === 0 && !konflikt.aus.includes('::warning::') && konflikt.aus.includes('Konflikt mit main'), `${konflikt.exit} ${konflikt.aus}`)
rmSync(ordner, { recursive: true, force: true })

if (fehler > 0) {
  console.error(`nacht-merger-prozess.test: ${fehler} von ${anzahl} Fällen rot`)
  process.exit(1)
}
console.log(`nacht-merger-prozess.test: ${anzahl} Fälle grün (Prozess-Exit bei Stillstand und bei Konflikt, Ersatz-gh im PATH)`)
