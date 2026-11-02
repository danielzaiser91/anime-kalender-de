// Fix-PR-Hinweis unter der Alarmzeile und Sperre im Fixer-Workflow (Anlass 02.11.2026: PR 2662 lag 11 h, dann kam das Doppel 2668).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { alarmZeilenMitFixPrs, fixPrKandidaten, fixPrZeile, fixPrZeilen, pruefZustand } from './fix-pr-hinweis.mjs'

const JETZT = Date.parse('2026-11-02T17:00:00Z')
// Formen wie `gh pr list --json …` sie liefert (CheckRun: laufend = conclusion "" + status IN_PROGRESS).
const lauf = { status: 'IN_PROGRESS', conclusion: '', name: 'Prüfer-Review' }
const gut = { status: 'COMPLETED', conclusion: 'SUCCESS', name: 'Kette – Logik' }
const schlecht = { status: 'COMPLETED', conclusion: 'FAILURE', name: 'Kette – Bau' }
const uebersprungen = { status: 'COMPLETED', conclusion: 'SKIPPED', name: 'x' }
const pr = (number, branch, login, createdAt, rollup = [], isDraft = false) => ({ number, headRefName: branch, createdAt, author: { login }, isDraft, statusCheckRollup: rollup })
const FIXER = 'app/claude'
const ROT_AB = '2026-11-02T01:00:00Z'

// Prüfzustand: jeder Wert einzeln, gemischt mit verschiedenen Zahlen.
assert.equal(pruefZustand([]), 'keine Prüfung gestartet')
assert.equal(pruefZustand(undefined), 'keine Prüfung gestartet')
assert.equal(pruefZustand([gut, gut, gut, schlecht, lauf, lauf]), '3 grün, 1 rot, 2 offen')
assert.equal(pruefZustand([uebersprungen]), '1 grün, 0 rot, 0 offen')
assert.equal(pruefZustand([{ conclusion: 'CANCELLED', status: 'COMPLETED' }, { conclusion: 'TIMED_OUT', status: 'COMPLETED' }]), '0 grün, 2 rot, 0 offen')
assert.equal(pruefZustand([{ state: 'SUCCESS' }, { state: 'FAILURE' }, { state: 'PENDING' }]), '1 grün, 1 rot, 1 offen', 'StatusContext trägt `state`')

// Kandidaten: nur Fixer, nur fix/, nur nach dem ersten roten Lauf (Grenze: gleich zählt nicht).
const rotMs = Date.parse(ROT_AB)
const alle = [
  pr(1, 'fix/a', FIXER, '2026-11-02T05:38:08Z'),
  pr(2, 'fix/b', 'danielzaiser91', '2026-11-02T05:38:08Z'),
  pr(3, 'feat/c', FIXER, '2026-11-02T05:38:08Z'),
  pr(4, 'fix/d', FIXER, '2026-11-01T23:00:00Z'),
  pr(5, 'fix/e', FIXER, ROT_AB),
  pr(6, 'fix/f', FIXER, '2026-11-02T01:00:01Z'),
  pr(7, 'daten/fix/g', FIXER, '2026-11-02T05:38:08Z'),
]
assert.deepEqual(fixPrKandidaten(alle, rotMs).map((p) => p.number), [1, 6])

// Zeile: Nummer, Alter, Prüfzustand; Entwurf gekennzeichnet.
assert.equal(
  fixPrZeile(pr(2662, 'fix/termin-wege-tote-adresse', FIXER, '2026-11-02T05:38:08Z', [gut, gut, lauf]), JETZT),
  '  Fix-PR #2662 (fix/termin-wege-tote-adresse) offen seit 11.4 h, Prüfung: 2 grün, 0 rot, 1 offen',
)
assert.match(fixPrZeile(pr(9, 'fix/x', FIXER, '2026-11-02T16:00:00Z', [], true), JETZT), /offen seit 1\.0 h, Entwurf, Prüfung: keine Prüfung gestartet$/)

// fixPrZeilen mit eingespritzter gh-Antwort.
const run = (conclusion, createdAt) => ({ status: 'completed', conclusion, createdAt, databaseId: 1 })
const LAEUFE = [run('success', '2026-11-01T20:00:00Z'), run('failure', ROT_AB), run('failure', '2026-11-02T03:00:00Z')]
const kulisse = (prs, laeufe = LAEUFE) => (...a) => {
  if (a[0] === 'run' && a[1] === 'list') return JSON.stringify(laeufe)
  if (a[0] === 'pr' && a[1] === 'list') {
    assert.ok(a.includes('--state') && a[a.indexOf('--state') + 1] === 'open', 'nur offene PRs')
    for (const feld of ['number', 'headRefName', 'createdAt', 'author', 'isDraft', 'statusCheckRollup']) assert.match(a[a.indexOf('--json') + 1], new RegExp(feld))
    return JSON.stringify(prs)
  }
  throw new Error(`gh? ${a.join(' ')}`)
}
assert.deepEqual(fixPrZeilen(kulisse(alle), 'o/r', JETZT), [
  '  Fix-PR #1 (fix/a) offen seit 11.4 h, Prüfung: keine Prüfung gestartet',
  '  Fix-PR #6 (fix/f) offen seit 16.0 h, Prüfung: keine Prüfung gestartet',
])
assert.deepEqual(fixPrZeilen(kulisse([]), 'o/r', JETZT), ['  Kein offener Fix-PR seit dem ersten roten Lauf.'])
// Der erste rote Lauf zählt, nicht der jüngste: PR zwischen erstem und zweitem rotem Lauf bleibt sichtbar.
assert.equal(fixPrZeilen(kulisse([pr(8, 'fix/z', FIXER, '2026-11-02T02:00:00Z')]), 'o/r', JETZT).length, 1)
assert.deepEqual(fixPrZeilen(kulisse(alle, [run('success', '2026-11-01T20:00:00Z')]), 'o/r', JETZT), [], 'ohne roten Lauf keine Zeilen')
const wirft = (...a) => {
  if (a[0] === 'pr') throw new Error('pr kaputt\nzweite')
  return kulisse([])(...a)
}
assert.deepEqual(fixPrZeilen(wirft, 'o/r', JETZT), ['  ALARM? Fix-PRs nicht lesbar: pr kaputt'])

// Zusammensetzung: Reihenfolge, einmal, nur ALARM-Zeilen, kein pr-Abruf ohne Bestandsbau-Alarm.
let prAbrufe = 0
const zaehlt = (...a) => {
  if (a[0] === 'pr') prAbrufe++
  return kulisse(alle)(...a)
}
const zeilen = ['ALARM Bestandsbau seit 20.0 h rot (x)', 'ALARM Bestandsbau seit 20.0 h rot mit 2 verschiedenen Fehlerschritten (y)', 'Deploy: kein Alarm', 'ALARM Deploy seit 7.0 h ohne Erfolg (z)']
const mit = alarmZeilenMitFixPrs(zeilen, zaehlt, 'o/r', JETZT)
assert.equal(prAbrufe, 1)
assert.deepEqual(mit.map((z) => z.slice(0, 23)), ['ALARM Bestandsbau seit ', '  Fix-PR #1 (fix/a) off', '  Fix-PR #6 (fix/f) off', 'ALARM Bestandsbau seit ', 'ALARM Deploy seit 7.0 h']) // Fix-PRs direkt unter der ersten Alarmzeile
prAbrufe = 0
assert.deepEqual(alarmZeilenMitFixPrs(['ALARM Deploy seit 7.0 h ohne Erfolg (z)', 'Bestandsbau: kein Alarm (x)'], zaehlt, 'o/r', JETZT), ['ALARM Deploy seit 7.0 h ohne Erfolg (z)'])
assert.equal(prAbrufe, 0, 'Deploy-Alarm allein ruft keine PRs ab')

// Verdrahtung: laeufe-aufraeumen als echter Prozess; gh ersetzt eine Kulisse (Läufe, dann PR-Liste).
const ALT = [run('success', '2026-10-18T01:00:00Z'), run('failure', '2026-10-18T02:00:00Z')]
const PRS = [pr(2662, 'fix/termin-wege-tote-adresse', FIXER, '2026-10-18T05:38:08Z', [gut, lauf]), pr(2663, 'fix/alt', FIXER, '2026-10-17T05:38:08Z')]
const stub = `data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=(c,a)=>JSON.stringify(a.includes("pr")?${JSON.stringify(PRS)}:${JSON.stringify(ALT)});syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})`
const ordner = mkdtempSync(join(tmpdir(), 'fix-pr-hinweis-'))
try {
  const gesundheit = join(ordner, 'g.json')
  writeFileSync(gesundheit, '{}')
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const r = spawnSync(process.execPath, ['--import', stub, aufraeumen, '--trocken', '--gesundheit', gesundheit], { encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: '' }, timeout: 120000 })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /^ALARM Bestandsbau seit [\d.]+ h rot[^\n]*\n  Fix-PR #2662 \(fix\/termin-wege-tote-adresse\) offen seit [\d.]+ h, Prüfung: 1 grün, 0 rot, 1 offen\n(?!  Fix-PR #2663)/m)

  // Workflow: Schritt „Gibt es den Fehler noch?“ aus der YAML, `gh` als Funktion mit echtem jq auf den Fixtures.
  const jq = spawnSync('jq', ['--version'], { encoding: 'utf8', timeout: 30000 })
  if (jq.status !== 0) console.log('fix-pr-sperre (Workflow) übersprungen: jq fehlt')
  else {
    const wf = parse(readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), '.github/workflows/claude-reparatur.yml'), 'utf8'))
    const schritt = wf.jobs.untersuchen.steps.find((s) => s.name === 'Gibt es den Fehler noch?')
    assert.ok(schritt, 'Schritt vorhanden')
    const gh = join(ordner, 'gh.sh')
    writeFileSync(gh, 'gh() {\n  local was="$1 $2" jqp=""\n  while [ $# -gt 0 ]; do [ "$1" = "--jq" ] && jqp="$2"; shift; done\n  echo "$was" >> "$GH_LOG"\n  if [ "$was" = "run list" ]; then cat "$ERFOLGE"; else cat "$PRLISTE"; fi | jq -r "$jqp"\n}\n')
    const fahrt = (prs, erfolge = []) => {
      const out = join(ordner, 'out.txt')
      const log = join(ordner, 'log.txt')
      writeFileSync(out, '')
      writeFileSync(log, '')
      writeFileSync(join(ordner, 'prs.json'), JSON.stringify(prs))
      writeFileSync(join(ordner, 'erfolge.json'), JSON.stringify(erfolge))
      const skript = schritt.run.replaceAll('${{ github.repository }}', 'o/r').replaceAll('${{ github.event.workflow_run.id }}', '100').replaceAll('${{ github.event.workflow_run.name }}', 'Bestand')
      const e = { ...process.env, GITHUB_OUTPUT: out, GH_LOG: log, PRLISTE: join(ordner, 'prs.json'), ERFOLGE: join(ordner, 'erfolge.json') }
      const p = spawnSync('bash', ['-c', `source ${JSON.stringify(gh.replaceAll('\\', '/'))}\n${skript}`], { encoding: 'utf8', env: e, timeout: 60000 })
      assert.equal(p.status, 0, p.stderr)
      return { weiter: readFileSync(out, 'utf8').trim(), log: readFileSync(log, 'utf8'), text: p.stdout }
    }
    const fix = [{ number: 2662, headRefName: 'fix/termin-wege-tote-adresse', author: { login: FIXER } }]
    assert.equal(fahrt(fix).weiter, 'weiter=nein', 'offener Fix-PR des Fixers: kein zweiter Lauf')
    assert.match(fahrt(fix).text, /#2662/)
    assert.equal(fahrt([{ number: 5, headRefName: 'feat/auftrag', author: { login: FIXER } }]).weiter, 'weiter=ja', 'Auftrags-PR des Claude-Bots sperrt nicht')
    assert.equal(fahrt([{ number: 6, headRefName: 'daten/fix/x', author: { login: FIXER } }]).weiter, 'weiter=ja', 'fix/ muss am Anfang stehen')
    assert.equal(fahrt([]).weiter, 'weiter=ja', 'ohne Fix-PR läuft der Fixer')
    const nachfolger = fahrt(fix, [{ databaseId: 101 }])
    assert.equal(nachfolger.weiter, 'weiter=nein', 'grüner Nachfolger: nichts zu untersuchen')
    assert.doesNotMatch(nachfolger.log, /pr list/, 'der erste Grund endet vor dem PR-Abruf')
    assert.match(fahrt(fix).log, /pr list/)
  }
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('fix-pr-hinweis: ok (Kandidaten, Prüfzustand, Zeilen, Lesefehler, Reihenfolge, aufraeumen als Prozess, Workflow-Sperre)')
