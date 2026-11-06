// Fix-PR-Hinweis unter der Alarmzeile und Sperre im Fixer-Workflow (Anlass 02.11.2026: PR 2662 lag 11 h, dann kam das Doppel 2668).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { alarmZeilenMitFixPrs, fixPrZeile, fixPrZeilen, KEIN_FIX_PR, pruefZustand } from './fix-pr-hinweis.mjs'
import { sperrendeFixPrs } from './fix-pr-sperre.mjs'

const JETZT = Date.parse('2026-11-02T17:00:00Z')
// Formen wie `gh pr list --json …` sie liefert (CheckRun: laufend = conclusion "" + status IN_PROGRESS).
const lauf = { status: 'IN_PROGRESS', conclusion: '', name: 'Prüfer-Review' }
const gut = { status: 'COMPLETED', conclusion: 'SUCCESS', name: 'Kette – Logik' }
const schlecht = { status: 'COMPLETED', conclusion: 'FAILURE', name: 'Kette – Bau' }
const uebersprungen = { status: 'COMPLETED', conclusion: 'SKIPPED', name: 'x' }
const pr = (number, branch, login, createdAt, rollup = [], isDraft = false) => ({ number, headRefName: branch, createdAt, author: { login }, isDraft, statusCheckRollup: rollup })
const FIXER = 'app/claude'
const ROT_AB = '2026-11-02T08:30:00Z'

// Prüfzustand: jeder Wert einzeln, gemischt mit verschiedenen Zahlen.
assert.equal(pruefZustand([]), 'keine Prüfung gestartet')
assert.equal(pruefZustand(undefined), 'keine Prüfung gestartet')
assert.equal(pruefZustand([gut, gut, gut, schlecht, lauf, lauf]), '3 grün, 1 rot, 2 offen')
assert.equal(pruefZustand([{ name: 'ohne Angaben' }, { state: 'EXPECTED' }]), '0 grün, 0 rot, 2 offen', 'ohne Ergebnis oder erwartet: offen')
assert.equal(pruefZustand([uebersprungen]), '1 grün, 0 rot, 0 offen')
assert.equal(pruefZustand([{ conclusion: 'CANCELLED', status: 'COMPLETED' }, { conclusion: 'TIMED_OUT', status: 'COMPLETED' }]), '0 grün, 2 rot, 0 offen')
assert.equal(pruefZustand([{ state: 'SUCCESS' }, { state: 'FAILURE' }, { state: 'PENDING' }]), '1 grün, 1 rot, 1 offen', 'StatusContext trägt `state`')

// Sperre und Anzeige: nur Fixer, fix/ und wache/ (A4), jünger als 6 h (A2, Grenze: genau 6 h zählt nicht), unabhängig vom ersten roten Lauf (A1).
const JETZT2 = Date.parse('2026-11-02T10:00:00Z')
const alle = [
  pr(1, 'fix/a', FIXER, '2026-11-02T05:38:08Z'), // vor dem ersten roten Lauf (08:30), 4.4 h alt: sperrt trotzdem
  pr(2, 'fix/b', 'danielzaiser91', '2026-11-02T05:38:08Z'),
  pr(3, 'feat/c', FIXER, '2026-11-02T05:38:08Z'),
  pr(4, 'fix/d', FIXER, '2026-10-30T10:00:00Z'), // 3 Tage alt: sperrt nicht
  pr(5, 'fix/e', FIXER, '2026-11-02T04:00:00Z'), // genau 6 h
  pr(6, 'fix/f', FIXER, '2026-11-02T04:00:01Z'), // 1 s unter 6 h
  pr(7, 'daten/fix/g', FIXER, '2026-11-02T05:38:08Z'),
  pr(8, 'wache/h', FIXER, '2026-11-02T08:00:00Z'),
  pr(9, 'wache/alt', FIXER, '2026-10-30T10:00:00Z'),
]
assert.deepEqual(sperrendeFixPrs(alle, JETZT2).map((p) => p.number), [1, 6, 8])
assert.deepEqual(sperrendeFixPrs([pr(1, 'fix/a', FIXER, '2026-11-02T04:00:00Z')], JETZT2 - 1).map((p) => p.number), [1], 'eine Millisekunde früher: noch jünger als 6 h')

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
assert.deepEqual(fixPrZeilen(kulisse(alle), 'o/r', JETZT2), [
  '  Fix-PR #1 (fix/a) offen seit 4.4 h, Prüfung: keine Prüfung gestartet',
  '  Fix-PR #6 (fix/f) offen seit 6.0 h, Prüfung: keine Prüfung gestartet',
  '  Fix-PR #8 (wache/h) offen seit 2.0 h, Prüfung: keine Prüfung gestartet',
])
assert.deepEqual(fixPrZeilen(kulisse([]), 'o/r', JETZT2), [KEIN_FIX_PR])
assert.deepEqual(fixPrZeilen(kulisse([pr(4, 'fix/d', FIXER, '2026-10-30T10:00:00Z')]), 'o/r', JETZT2), [KEIN_FIX_PR], 'ein 3 Tage alter PR wird weder gesperrt noch gezeigt')
assert.deepEqual(fixPrZeilen(kulisse(alle, [run('success', '2026-11-01T20:00:00Z')]), 'o/r', JETZT2), [], 'ohne roten Lauf keine Zeilen')
const wirft = (...a) => {
  if (a[0] === 'pr') throw new Error('pr kaputt\nzweite')
  return kulisse([])(...a)
}
assert.deepEqual(fixPrZeilen(wirft, 'o/r', JETZT2), ['  ALARM? Fix-PRs nicht lesbar: pr kaputt'])

// Zusammensetzung: Reihenfolge, einmal, nur ALARM-Zeilen, kein pr-Abruf ohne Bestandsbau-Alarm.
let prAbrufe = 0
const zaehlt = (...a) => {
  if (a[0] === 'pr') prAbrufe++
  return kulisse(alle)(...a)
}
const zeilen = ['ALARM Bestandsbau seit 20.0 h rot (x)', 'ALARM Bestandsbau seit 20.0 h rot mit 2 verschiedenen Fehlerschritten (y)', 'Deploy: kein Alarm', 'ALARM Deploy seit 7.0 h ohne Erfolg (z)']
const mit = alarmZeilenMitFixPrs(zeilen, zaehlt, 'o/r', JETZT2)
assert.equal(prAbrufe, 1)
assert.deepEqual(mit.map((z) => z.slice(0, 23)), ['ALARM Bestandsbau seit ', '  Fix-PR #1 (fix/a) off', '  Fix-PR #6 (fix/f) off', '  Fix-PR #8 (wache/h) o', 'ALARM Bestandsbau seit ', 'ALARM Deploy seit 7.0 h']) // Fix-PRs direkt unter der ersten Alarmzeile
// A3: Bestandsbau rot, aber noch kein Bestandsbau-Alarm: die Fix-PRs stehen trotzdem da (unter einer Kopfzeile).
prAbrufe = 0
const ohneAlarm = alarmZeilenMitFixPrs(['ALARM Deploy seit 7.0 h ohne Erfolg (z)', 'Bestandsbau: kein Alarm (x)'], zaehlt, 'o/r', JETZT2)
assert.equal(prAbrufe, 1, 'roter Bestandsbau ohne Alarm ruft die PRs ab')
assert.deepEqual(ohneAlarm.map((z) => z.slice(0, 23)), ['ALARM Deploy seit 7.0 h', 'Bestandsbau rot, noch u', '  Fix-PR #1 (fix/a) off', '  Fix-PR #6 (fix/f) off', '  Fix-PR #8 (wache/h) o'])
// Ohne Fix-PR bleibt es still (keine Kopfzeile, keine „Kein …“-Zeile); ohne roten Lauf auch ohne PR-Abruf.
const ohnePr = (...a) => kulisse([])(...a)
assert.deepEqual(alarmZeilenMitFixPrs(['Bestandsbau: kein Alarm (x)'], ohnePr, 'o/r', JETZT2), [])
prAbrufe = 0
const gruen = (...a) => {
  if (a[0] === 'pr') prAbrufe++
  return kulisse(alle, [run('success', '2026-11-01T20:00:00Z')])(...a)
}
assert.deepEqual(alarmZeilenMitFixPrs(['Bestandsbau: kein Alarm (x)'], gruen, 'o/r', JETZT2), [])
assert.equal(prAbrufe, 0, 'ohne roten Lauf kein PR-Abruf')

// Verdrahtung: laeufe-aufraeumen als echter Prozess; gh ersetzt eine Kulisse (Läufe, dann PR-Liste).
const ALT = [run('success', '2026-10-18T01:00:00Z'), run('failure', '2026-10-18T02:00:00Z')]
const PRS = [pr(2662, 'fix/termin-wege-tote-adresse', FIXER, '2026-10-18T05:38:08Z', [gut, lauf]), pr(2663, 'fix/alt', FIXER, '2026-10-17T05:38:08Z')]
const stub = `data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=(c,a)=>JSON.stringify(a.includes("pr")?${JSON.stringify(PRS)}:${JSON.stringify(ALT)});syncBuiltinESMExports();Date.now=()=>Date.parse("2026-10-18T10:00:00Z");globalThis.fetch=async()=>new Response("{}",{status:500})`
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
    // Beide Enden der Verdrahtung: der Schritt ruft die Sperr-Datei aus dem Sparse-Checkout davor.
    const schritte = wf.jobs.untersuchen.steps
    const holen = schritte.find((s) => s.uses?.startsWith('actions/checkout') && s.with?.path === '_sperre')
    assert.ok(holen && schritte.indexOf(holen) < schritte.indexOf(schritt), 'Sparse-Checkout vor dem Sperr-Schritt')
    assert.equal(holen.with['sparse-checkout'], 'tools/fix-pr-sperre.mjs')
    assert.match(schritt.run, /\| node _sperre\/tools\/fix-pr-sperre\.mjs\)/)
    const sperrDatei = fileURLToPath(new URL('./fix-pr-sperre.mjs', import.meta.url)).replaceAll('\\', '/')
    const gh = join(ordner, 'gh.sh')
    const ghFunktion = [
      'gh() {',
      '  local was="$1 $2" jqp="" autor=""',
      '  while [ $# -gt 0 ]',
      '  do',
      '    [ "$1" = "--jq" ] && jqp="$2"',
      '    [ "$1" = "--author" ] && autor="$2"',
      '    shift',
      '  done',
      '  echo "$was" >> "$GH_LOG"',
      '  if [ "$was" = "run list" ]',
      '  then',
      '    jq -r "$jqp" "$ERFOLGE"',
      '  else',
      `    jq --arg a "$autor" 'if $a == "" then . else map(select(.author.login == $a)) end' "$PRLISTE" | if [ -n "$jqp" ]; then jq -r "$jqp"; else cat; fi`,
      '  fi',
      '}',
      '',
    ]
    writeFileSync(gh, ghFunktion.join('\n'))
    const fahrt = (prs, erfolge = []) => {
      const out = join(ordner, 'out.txt')
      const log = join(ordner, 'log.txt')
      writeFileSync(out, '')
      writeFileSync(log, '')
      writeFileSync(join(ordner, 'prs.json'), JSON.stringify(prs))
      writeFileSync(join(ordner, 'erfolge.json'), JSON.stringify(erfolge))
      const skript = schritt.run.replaceAll('${{ github.repository }}', 'o/r').replaceAll('${{ github.event.workflow_run.id }}', '100').replaceAll('${{ github.event.workflow_run.name }}', 'Bestand').replace('node _sperre/tools/fix-pr-sperre.mjs', () => `"${process.execPath.replaceAll('\\', '/')}" "${sperrDatei}"`)
      const e = { ...process.env, SPERRE_JETZT_MS: String(JETZT2), GITHUB_OUTPUT: out, GH_LOG: log, PRLISTE: join(ordner, 'prs.json'), ERFOLGE: join(ordner, 'erfolge.json') }
      const p = spawnSync('bash', ['-c', `source ${JSON.stringify(gh.replaceAll('\\', '/'))}\n${skript}`], { encoding: 'utf8', env: e, timeout: 60000 })
      assert.equal(p.status, 0, p.stderr)
      return { weiter: readFileSync(out, 'utf8').trim(), log: readFileSync(log, 'utf8'), text: p.stdout }
    }
    const neu = '2026-11-02T08:00:00Z'
    const alt = '2026-10-30T10:00:00Z'
    const fix = [{ number: 2662, headRefName: 'fix/termin-wege-tote-adresse', createdAt: neu, author: { login: FIXER } }]
    assert.equal(fahrt(fix).weiter, 'weiter=nein', 'offener Fix-PR des Fixers: kein zweiter Lauf')
    assert.match(fahrt(fix).text, /#2662/)
    assert.equal(fahrt([{ number: 5, headRefName: 'feat/auftrag', createdAt: neu, author: { login: FIXER } }]).weiter, 'weiter=ja', 'Auftrags-PR des Claude-Bots sperrt nicht')
    assert.equal(fahrt([{ number: 6, headRefName: 'daten/fix/x', createdAt: neu, author: { login: FIXER } }]).weiter, 'weiter=ja', 'fix/ muss am Anfang stehen')
    assert.equal(fahrt([{ number: 7, headRefName: 'fix/mensch', createdAt: neu, author: { login: 'danielzaiser91' } }]).weiter, 'weiter=ja', 'fix/-PR eines Menschen sperrt nicht (gh filtert über --author)')
    assert.equal(fahrt([{ number: 8, headRefName: 'fix/alt', createdAt: alt, author: { login: FIXER } }]).weiter, 'weiter=ja', 'A2: 3 Tage alter fix/-PR sperrt nicht mehr')
    assert.equal(fahrt([{ number: 9, headRefName: 'wache/x', createdAt: neu, author: { login: FIXER } }]).weiter, 'weiter=nein', 'A4: frischer wache/-PR sperrt')
    assert.equal(fahrt([{ number: 10, headRefName: 'wache/alt', createdAt: alt, author: { login: FIXER } }]).weiter, 'weiter=ja', 'alter wache/-PR sperrt nicht')
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
