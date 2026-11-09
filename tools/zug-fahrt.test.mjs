/**
 * Tests für tools/zug-fahrt.mjs gegen echtes git (Wegwerf-Repos unter os.tmpdir) mit einer gh-Attrappe, die jeden Schreibaufruf mitschreibt.
 * Erwartete Befehle, Zweignamen und Texte stehen fest hier, nicht aus dem Modul. Ratschen-Zeilen wörtlich wie in den roten Läufen vom 06.11.2026.
 * Kreislauf: start → Kette grün (Dry-Run) bzw. rot → Probe main allein → Schuldsuche, jeweils bis zum Log und zum PR-Kommentar.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { bauDeploy, bereiteFahrt, gitIn, main, start, urteil } from './zug-fahrt.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}
const wurzel = mkdtempSync(path.join(os.tmpdir(), 'zug-fahrt-test-'))
let zaehler = 0

/** Wegwerf-Welt: origin (bare) mit main, dazu ein Klon. Rückgabe: { git (im Klon), gitOrigin, schreibe }. */
function welt() {
  const ordner = path.join(wurzel, `w${++zaehler}`)
  mkdirSync(ordner)
  const origin = path.join(ordner, 'origin.git')
  const klon = path.join(ordner, 'klon')
  const g0 = gitIn(ordner)
  g0(['init', '-q', '--bare', '-b', 'main', origin])
  g0(['clone', '-q', origin, klon])
  const git = gitIn(klon)
  git(['symbolic-ref', 'HEAD', 'refs/heads/main'])
  git(['config', 'user.name', 'Test'])
  git(['config', 'user.email', 'test@example.invalid'])
  git(['config', 'commit.gpgsign', 'false'])
  const schreibe = (datei, inhalt, text) => {
    mkdirSync(path.dirname(path.join(klon, datei)), { recursive: true })
    writeFileSync(path.join(klon, datei), inhalt)
    git(['add', datei])
    git(['commit', '-q', '-m', text])
  }
  git(['config', 'core.autocrlf', 'false'])
  schreibe('start.txt', 'a\n', 'Anfang')
  schreibe('tools/umfang-grenzen.json', JSON.stringify({ ueberlaenge: { pipeline: { funktionen: 8986 } } }), 'Grenze am Basisstand')
  git(['push', '-q', 'origin', 'HEAD:refs/heads/main'])
  return { git, schreibe, gitOrigin: gitIn(origin), klon }
}

/** Zug mit zwei Unter-PRs (#101 web/src/x.ts, #102 .github/workflows/x.yml), main danach mit eigenem Commit weitergelaufen. */
function weltMitZug({ konflikt = false, mainWeiter = true } = {}) {
  const w = welt()
  w.git(['checkout', '-q', '-b', 'zug'])
  w.schreibe('web/src/x.ts', 'x\n', 'feat(a): erster Unter-PR (#101)')
  w.schreibe('.github/workflows/x.yml', 'x\n', 'ci(b): zweiter Unter-PR (#102)')
  w.git(['push', '-q', 'origin', 'zug'])
  w.git(['checkout', '-q', 'main'])
  if (mainWeiter) {
    w.schreibe('tools/umfang-grenzen.json', JSON.stringify({ ueberlaenge: { pipeline: { funktionen: 8964 } } }), 'chore(data): Bestand neu gebaut')
    if (konflikt) w.schreibe('web/src/x.ts', 'anders\n', 'fix: Konflikt mit Unter-PR (#9)')
    w.git(['push', '-q', 'origin', 'main'])
  }
  return w
}

/** gh-Attrappe: Lesen aus `zustand`, jeder Schreibaufruf landet in `schreib`; Unbekanntes wirft (kein stilles Durchlassen). */
function fakeGh(zustand = {}) {
  const schreib = []
  const gh = (args) => {
    const [a, b] = args
    const opt = (n) => args[args.indexOf(n) + 1]
    if (a === 'pr' && b === 'list') return JSON.stringify(zustand.prs?.[opt('--head')] && opt('--base') === 'main' ? [{ number: zustand.prs[opt('--head')] }] : [])
    if (a === 'run' && b === 'list') return JSON.stringify(zustand.laeufe?.[opt('--branch')] ?? [])
    if (a === 'run' && b === 'view' && args.includes('--log-failed')) return zustand.log?.[args[2]] ?? ''
    if (a === 'run' && b === 'view') return JSON.stringify(zustand.lauf[args[2]])
    if ((a === 'pr' && ['create', 'comment', 'close'].includes(b)) || (a === 'workflow' && b === 'run')) {
      schreib.push(args.join(' '))
      if (b === 'create') zustand.beiCreate?.()
      return ''
    }
    throw new Error(`gh-Attrappe kennt nicht: ${args.join(' ')}`)
  }
  return { gh, schreib }
}
const ctx = (w, gh, extra = {}) => {
  const zeilen = []
  return { gh, git: w.git, melde: (z) => zeilen.push(z), zeilen, trocken: false, ...extra }
}
delete process.env.GITHUB_STEP_SUMMARY
const refOrigin = (w, ref) => w.gitOrigin(['rev-parse', '--verify', '-q', ref]).trim()
const hatRef = (w, ref) => {
  try {
    return refOrigin(w, ref) !== ''
  } catch {
    return false
  }
}

const istVorfahr = (w, a, b) => {
  try {
    w.gitOrigin(['merge-base', '--is-ancestor', a, b])
    return true
  } catch {
    return false
  }
}
const hatLokal = (w, ref) => {
  try {
    return w.git(['rev-parse', '-q', '--verify', ref]).trim() !== ''
  } catch {
    return false
  }
}

console.log('bereiteFahrt: echtes git')
{
  const w = welt()
  pruefe('kein Zweig zug auf origin → kein-zug', bereiteFahrt(w.git).art === 'kein-zug')
}
{
  const w = welt()
  w.git(['push', '-q', 'origin', 'HEAD:refs/heads/zug'])
  pruefe('Zug gleich main → leer, keine Fahrt', bereiteFahrt(w.git).art === 'leer')
}
{
  const w = weltMitZug()
  const zugVorher = refOrigin(w, 'refs/heads/zug')
  const f = bereiteFahrt(w.git)
  const eltern = w.git(['rev-list', '--parents', '-n', '1', 'HEAD']).trim().split(' ').length - 1
  pruefe('Zug vor, main weitergelaufen → bereit, Merge-Commit mit zwei Eltern', f.art === 'bereit' && eltern === 2, f)
  pruefe('zugVorher ist der Zug-Kopf vor dem Hereinholen (Basis der Ratschen-Grenzen)', f.zugVorher === zugVorher && w.git(['rev-parse', 'HEAD^1']).trim() === zugVorher)
  pruefe('Merge-Betreff wie zugEintraege ihn kennt (keine PR-Nummer)', w.git(['log', '-1', '--format=%s']).trim() === "Merge branch 'main' into zug")
  pruefe('der Zug auf origin wird nicht berührt', refOrigin(w, 'refs/heads/zug') === zugVorher)
}
{
  const w = weltMitZug({ mainWeiter: false })
  const f = bereiteFahrt(w.git)
  pruefe('main nichts Neues → kein Merge-Commit, Kopf = Zug-Kopf', f.art === 'bereit' && f.kopf === f.zugVorher, f)
}
{
  const w = weltMitZug({ konflikt: true })
  const f = bereiteFahrt(w.git)
  pruefe('Konflikt → konflikt mit Dateiliste', f.art === 'konflikt' && f.dateien.join() === 'web/src/x.ts', f)
  pruefe('Konflikt: Merge abgebrochen, Arbeitsbaum sauber', w.git(['status', '--porcelain']).trim() === '' && !hatLokal(w, 'MERGE_HEAD'))
}

console.log('start: Push, PR, laufende Fahrt, Trockenlauf')
{
  const w = weltMitZug()
  const zu = {}
  const { gh, schreib } = fakeGh(zu)
  let beiPr = null
  zu.beiCreate = () => {
    beiPr = refOrigin(w, 'refs/heads/zug-fahrt')
  }
  const c = ctx(w, gh)
  pruefe('start → Exit 0', start(c) === 0, c.zeilen)
  const endKopf = refOrigin(w, 'refs/heads/zug-fahrt')
  pruefe('beim Anlegen des PR steht nur ein Platzhalter (main plus leerer Commit) auf dem Zweig, der Kopf folgt danach', beiPr !== null && beiPr !== endKopf && w.gitOrigin(['rev-parse', `${beiPr}^`]).trim() === refOrigin(w, 'refs/heads/main') && w.gitOrigin(['rev-parse', `${beiPr}^{tree}`]).trim() === w.gitOrigin(['rev-parse', 'refs/heads/main^{tree}']).trim(), { beiPr, endKopf })
  const c2 = ctx(w, fakeGh({ prs: { 'zug-fahrt': 7 }, laeufe: { 'zug-fahrt': [{ databaseId: 1, status: 'completed', conclusion: 'failure' }] } }).gh)
  process.env.GIT_COMMITTER_DATE = '2031-01-01T00:00:00Z' // anderer Merge-Commit (Uhrzeit), gleiche Eltern
  const exit2 = start(c2)
  delete process.env.GIT_COMMITTER_DATE
  pruefe('zweiter Aufruf ohne Änderung an Zug und main → keine neue Fahrt, obwohl der Merge-Commit anders ist', exit2 === 0 && /unverändert/.test(c2.zeilen.at(-1)) && refOrigin(w, 'refs/heads/zug-fahrt') === endKopf, c2.zeilen)
  w.git(['checkout', '-q', 'main'])
  w.schreibe('daten.txt', 'neu\n', 'chore(data): Bot nach der Fahrt')
  w.git(['push', '-q', 'origin', 'main'])
  const c3 = ctx(w, fakeGh({ prs: { 'zug-fahrt': 7 }, laeufe: { 'zug-fahrt': [{ databaseId: 1, status: 'completed', conclusion: 'failure' }] } }).gh)
  pruefe('main ist weitergelaufen → neue Fahrt, anderer Kopf', start(c3) === 0 && refOrigin(w, 'refs/heads/zug-fahrt') !== endKopf, c3.zeilen)
  pruefe('zug-fahrt liegt auf origin und enthält den Zug-Kopf', hatRef(w, 'refs/heads/zug-fahrt') && istVorfahr(w, 'refs/heads/zug', 'refs/heads/zug-fahrt'))
  pruefe('PR zug-fahrt → main angelegt, Beschreibung mit Patch-Notes-Zeile', schreib.length === 1 && /^pr create --base main --head zug-fahrt --title chore\(zug\): Fahrt --body .*Patch Notes: keine – CI:/s.test(schreib[0]), schreib)
}
{
  const w = weltMitZug()
  const { gh, schreib } = fakeGh({ prs: { 'zug-fahrt': 7 }, laeufe: { 'zug-fahrt': [{ databaseId: 1, status: 'in_progress', conclusion: '' }] } })
  const c = ctx(w, gh)
  pruefe('Kette der laufenden Fahrt offen → keine neue Fahrt, nichts geschrieben', start(c) === 0 && !hatRef(w, 'refs/heads/zug-fahrt') && schreib.length === 0 && /Fahrt läuft/.test(c.zeilen[0]), c.zeilen)
}
{
  const w = weltMitZug()
  const { gh, schreib } = fakeGh({ prs: { 'zug-fahrt': 7 }, laeufe: { 'zug-fahrt': [{ databaseId: 1, status: 'completed', conclusion: 'success' }] } })
  pruefe('fertige Fahrt, PR offen → neuer Kopf gepusht, kein zweiter PR', start(ctx(w, gh)) === 0 && hatRef(w, 'refs/heads/zug-fahrt') && schreib.length === 0)
}
{
  const w = weltMitZug()
  const { gh, schreib } = fakeGh()
  const c = ctx(w, gh, { trocken: true })
  pruefe('trocken: nichts gepusht, kein PR', start(c) === 0 && !hatRef(w, 'refs/heads/zug-fahrt') && schreib.length === 0 && /trocken/.test(c.zeilen.at(-1)), c.zeilen)
}
{
  const w = welt()
  const c = ctx(w, fakeGh().gh)
  pruefe('ohne Zug: Exit 0, Zeile nennt den fehlenden Zweig', start(c) === 0 && /zug fehlt/.test(c.zeilen[0]), c.zeilen)
}
{
  const w = weltMitZug({ konflikt: true })
  const c = ctx(w, fakeGh().gh)
  pruefe('Konflikt: Exit 1 mit Dateiname, nichts gepusht', start(c) === 1 && /Konflikt in: web\/src\/x\.ts/.test(c.zeilen.join('\n')) && !hatRef(w, 'refs/heads/zug-fahrt'), c.zeilen)
}

console.log('urteil auf zug-fahrt: grün, Fast-Forward nur als Dry-Run')
const LAUF_GRUEN = { 9: { databaseId: 9, headSha: '', status: 'completed', conclusion: 'success' } }
function weltMitFahrt(w = weltMitZug()) {
  start(ctx(w, fakeGh().gh))
  const kopf = refOrigin(w, 'refs/heads/zug-fahrt')
  return { w, kopf }
}
{
  const { w, kopf } = weltMitFahrt()
  const mainVorher = refOrigin(w, 'refs/heads/main')
  const { gh, schreib } = fakeGh({ prs: { 'zug-fahrt': 7 }, lauf: { 9: { ...LAUF_GRUEN[9], headSha: kopf } } })
  const c = ctx(w, gh)
  pruefe('grün auf dem heutigen Kopf → Exit 0', urteil(c, 'zug-fahrt', '9') === 0, c.zeilen)
  pruefe('main auf origin unverändert (der Dry-Run schreibt nichts)', refOrigin(w, 'refs/heads/main') === mainVorher)
  pruefe('Kommentar an PR 7 mit Dry-Run-Satz und Ratschen-Stand', schreib.length === 1 && /^pr comment 7 --body .*Schritt ff-pruefen.*Dry-Run ok.*Ratschen am Basisstand: umfang:pipeline:funktionen=8986/s.test(schreib[0]), schreib)
}
{
  const { w, kopf } = weltMitFahrt()
  const { gh } = fakeGh({ prs: { 'zug-fahrt': 7 }, lauf: { 9: { ...LAUF_GRUEN[9], headSha: 'f'.repeat(40) } } })
  const c = ctx(w, gh, { trocken: true })
  urteil(c, 'zug-fahrt', '9')
  pruefe('Kette lief auf anderem Kopf als der Zug → neu-fahren', /Schritt neu-fahren/.test(c.zeilen.join('\n')) && kopf !== 'f'.repeat(40), c.zeilen)
}
{
  const { w, kopf } = weltMitFahrt()
  w.git(['checkout', '-q', 'main'])
  w.schreibe('daten.txt', 'neu\n', 'chore(data): Bot nach der Fahrt')
  w.git(['push', '-q', 'origin', 'main'])
  const { gh } = fakeGh({ prs: { 'zug-fahrt': 7 }, lauf: { 9: { ...LAUF_GRUEN[9], headSha: kopf } } })
  const c = ctx(w, gh, { trocken: true })
  urteil(c, 'zug-fahrt', '9')
  pruefe('main ist nach dem Bau der Fahrt weitergelaufen → main-holen, kein Dry-Run', /Schritt main-holen/.test(c.zeilen.join('\n')) && !/Dry-Run ok/.test(c.zeilen.join('\n')), c.zeilen)
}
{
  const { w } = weltMitFahrt()
  for (const [status, conclusion] of [['in_progress', ''], ['completed', 'cancelled'], ['completed', 'skipped']]) {
    const { gh, schreib } = fakeGh({ prs: { 'zug-fahrt': 7 }, lauf: { 9: { databaseId: 9, headSha: 'a'.repeat(40), status, conclusion } } })
    const c = ctx(w, gh)
    pruefe(`Kette ${status}/${conclusion || '-'} → kein Urteil, nichts geschrieben`, urteil(c, 'zug-fahrt', '9') === 0 && schreib.length === 0 && /kein Urteil/.test(c.zeilen[0]), c.zeilen)
  }
}

console.log('urteil auf zug-fahrt: rot → Probe main allein')
{
  const { w, kopf } = weltMitFahrt()
  const zu = { prs: { 'zug-fahrt': 7 }, lauf: { 9: { databaseId: 9, headSha: kopf, status: 'completed', conclusion: 'failure' } } }
  let beiPr = null
  zu.beiCreate = () => {
    beiPr = refOrigin(w, 'refs/heads/zug-probe')
  }
  const { gh, schreib } = fakeGh(zu)
  const c = ctx(w, gh)
  pruefe('rot → Exit 0', urteil(c, 'zug-fahrt', '9') === 0, c.zeilen)
  pruefe('Probe: beim Anlegen des PR steht ein Platzhalter auf dem Zweig, danach der Probe-Kopf', beiPr !== null && beiPr !== refOrigin(w, 'refs/heads/zug-probe'))
  pruefe('zug-probe = main plus genau ein leerer Commit', hatRef(w, 'refs/heads/zug-probe') && w.gitOrigin(['rev-list', '--count', 'refs/heads/main..refs/heads/zug-probe']).trim() === '1' && w.gitOrigin(['diff', '--stat', 'refs/heads/main', 'refs/heads/zug-probe']).trim() === '')
  pruefe('Probe-PR gegen main angelegt, Fahrt-Log kommentiert', schreib.some((s) => /^pr create --base main --head zug-probe /.test(s)) && schreib.some((s) => /^pr comment 7 .*Kette rot, Schritt probe-starten/s.test(s)), schreib)
}
{
  const { w, kopf } = weltMitFahrt()
  const { gh, schreib } = fakeGh({ prs: { 'zug-fahrt': 7 }, lauf: { 9: { databaseId: 9, headSha: kopf, status: 'completed', conclusion: 'failure' } } })
  urteil(ctx(w, gh, { trocken: true }), 'zug-fahrt', '9')
  pruefe('trocken: weder Probe-Zweig noch Schreibaufruf', !hatRef(w, 'refs/heads/zug-probe') && schreib.length === 0)
}

console.log('urteil auf zug-probe: Schuldsuche mit Basisgrenzen')
const logZeile = (job, text) => `${job}\tSchritt\t2026-11-06T07:00:01.0Z ${text}\n`
function probeWelt(logText, probeErgebnis, prsOffen = { 'zug-fahrt': 7, 'zug-probe': 8 }, fahrt = weltMitFahrt()) {
  const { w, kopf } = fahrt
  const zustand = {
    prs: prsOffen,
    laeufe: { 'zug-fahrt': [{ databaseId: 5, headSha: kopf, status: 'completed', conclusion: 'failure' }] },
    lauf: { 6: { databaseId: 6, headSha: 'b'.repeat(40), status: 'completed', conclusion: probeErgebnis } },
    log: { 5: logText },
  }
  const { gh, schreib } = fakeGh(zustand)
  const c = ctx(w, gh)
  const exit = urteil(c, 'zug-probe', '6')
  const kommentar = schreib.find((s) => s.startsWith('pr comment 7')) ?? ''
  return { w, c, exit, schreib, kommentar }
}
const UMFANG = logZeile('Kette – Bau und Installation', '  pipeline: Überlänge der funktionen 8986 statt höchstens 8964')
{
  const r = probeWelt(UMFANG, 'failure')
  pruefe('main allein rot → art main, Probe: failure → rot', r.exit === 0 && /Schuldsuche: \{"art":"main"\}/.test(r.kommentar) && /Probe main allein: rot/.test(r.kommentar), r.kommentar)
}
{
  const r = probeWelt(UMFANG, 'success')
  pruefe('main grün, Ratsche gerissen, Basisgrenze (Zug vor main) hält → art ratsche, nichts zurücknehmen', /"art":"ratsche","ratsche":"umfang","fall":"ratsche"/.test(r.kommentar) && !/Revert-Plan/.test(r.kommentar), r.kommentar)
  pruefe('Ratschen-Zustand im Log: Wert, Grenze main, Basis, Deutung', /Ratsche umfang:pipeline:funktionen \(Kette – Bau und Installation\): Wert 8986, Grenze main 8964, Basis 8986 → Senkung auf main/.test(r.kommentar), r.kommentar)
  pruefe('Probe-PR wird geschlossen und sein Zweig gelöscht', r.schreib.includes('pr close 8 --delete-branch'), r.schreib)
}
{
  const r = probeWelt(logZeile('Kette – Bau und Installation', '  pipeline: Überlänge der funktionen 8990 statt höchstens 8964'), 'success')
  pruefe('Ratsche vom Zug selbst gerissen (Wert über Basisgrenze) → keine Ratsche, Halbierung', /"art":"halbieren"/.test(r.kommentar) && /→ vom Zug gerissen/.test(r.kommentar), r.kommentar)
}
{
  const r = probeWelt(logZeile('Kette – Workflows', 'FEHL workflow x.yml kaputt'), 'success')
  pruefe('nur .github/ passt zum Job Workflows → #102 schuldig, Revert-Plan nur im Log', /"art":"pr","nr":102/.test(r.kommentar) && /Revert-Plan \(nicht ausgeführt\): git revert --no-edit [0-9a-f]{40}/.test(r.kommentar), r.kommentar)
  pruefe('Fahrt-Log ohne Ratsche sagt es', /Ratschen im Fehlschlag: keine gemeldet/.test(r.kommentar), r.kommentar)
}
{
  const r = probeWelt(UMFANG, 'cancelled')
  pruefe('Probe abgebrochen → kein Urteil, nichts geschrieben', r.exit === 0 && r.schreib.length === 0 && /kein Urteil/.test(r.c.zeilen[0]), r.c.zeilen)
}
{
  const { w, kopf } = weltMitFahrt()
  const { gh, schreib } = fakeGh({
    prs: { 'zug-fahrt': 7, 'zug-probe': 8 },
    laeufe: { 'zug-fahrt': [{ databaseId: 5, headSha: kopf, status: 'completed', conclusion: 'success' }] },
    lauf: { 6: { databaseId: 6, headSha: 'b'.repeat(40), status: 'completed', conclusion: 'success' } },
  })
  const c = ctx(w, gh)
  urteil(c, 'zug-probe', '6')
  pruefe('Probe fertig, aber keine rote Fahrt (z. B. schon neu gefahren) → nichts zu tun', /keine rote Fahrt/.test(c.zeilen.join('\n')), c.zeilen)
  pruefe('… und der Probe-PR wird trotzdem aufgeräumt', schreib.includes('pr close 8 --delete-branch'), schreib)
}
{
  const r = probeWelt(UMFANG, 'success')
  const w = r.w
  const { gh, schreib } = fakeGh({
    prs: { 'zug-fahrt': 7, 'zug-probe': 8 },
    laeufe: { 'zug-fahrt': [{ databaseId: 5, headSha: refOrigin(w, 'refs/heads/zug-fahrt'), status: 'completed', conclusion: 'failure' }] },
    lauf: { 6: { databaseId: 6, headSha: 'b'.repeat(40), status: 'completed', conclusion: 'success' } },
    log: { 5: UMFANG },
  })
  urteil(ctx(w, gh, { trocken: true }), 'zug-probe', '6')
  pruefe('trocken: Schuldsuche läuft, aber kein Kommentar und kein Schließen', schreib.length === 0)
}

console.log('Lücken aus der Mutationsprobe: Unter-PR als Merge-Commit, Zug ohne Merge von main, Geschwister-Kopf, Aufrufform des Dry-Runs')
{
  // Unter-PR #105 liegt als Merge-Commit im Zug (GitHub-Merge-Commit): seine Dateien zeigt nur `git log -m`.
  const w = welt()
  w.git(['checkout', '-q', '-b', 'zug'])
  w.schreibe('web/src/a.ts', 'a\n', 'feat(a): erster Unter-PR (#101)')
  w.git(['checkout', '-q', '-b', 'pr105'])
  w.schreibe('.github/workflows/y.yml', 'y\n', 'ci: Änderung im Unter-PR')
  w.git(['checkout', '-q', 'zug'])
  w.git(['merge', '--no-ff', '-q', '-m', 'Merge pull request #105 from x/y', 'pr105'])
  w.git(['push', '-q', 'origin', 'zug'])
  w.git(['checkout', '-q', 'main'])
  const r = probeWelt(logZeile('Kette – Workflows', 'FEHL workflow y.yml kaputt'), 'success', { 'zug-fahrt': 7, 'zug-probe': 8 }, weltMitFahrt(w))
  pruefe('Unter-PR als Merge-Commit: seine Dateien zählen für den Verdacht (git log -m) → #105', /"art":"pr","nr":105/.test(r.kommentar), r.kommentar)
}
{
  // Zug ohne Merge von main: der Kopf der Fahrt ist ein gewöhnlicher Commit; die Basis der Grenzen ist dann main, nicht sein Elternteil.
  const w = welt()
  w.git(['checkout', '-q', '-b', 'zug'])
  w.schreibe('tools/umfang-grenzen.json', JSON.stringify({ ueberlaenge: { pipeline: { funktionen: 8970 } } }), 'chore: Unter-PR senkt die Grenze (#103)')
  w.schreibe('web/src/b.ts', 'b\n', 'feat(b): zweiter Unter-PR (#102)')
  w.git(['push', '-q', 'origin', 'zug'])
  w.git(['checkout', '-q', 'main'])
  const fahrt = weltMitFahrt(w)
  pruefe('Kontrolle: Kopf der Fahrt ist kein Merge-Commit', w.gitOrigin(['rev-list', '--parents', '-n', '1', 'refs/heads/zug-fahrt']).trim().split(' ').length === 2)
  const r = probeWelt(logZeile('Kette – Bau und Installation', '  pipeline: Überlänge der funktionen 8980 statt höchstens 8964'), 'success', undefined, fahrt)
  pruefe('ohne Merge von main gilt main als Basis (8986): Wert 8980 hält → ratsche (der Elternteil des Kopfs hätte 8970)', /"art":"ratsche"/.test(r.kommentar) && /Basis 8986/.test(r.kommentar), r.kommentar)
}
{
  const w = weltMitZug({ mainWeiter: false })
  start(ctx(w, fakeGh().gh))
  const erster = refOrigin(w, 'refs/heads/zug-fahrt')
  w.git(['checkout', '-q', 'zug'])
  w.git(['commit', '-q', '--amend', '-m', 'ci(b): zweiter Unter-PR, neu gefasst (#102)'])
  w.git(['push', '-q', '--force', 'origin', 'zug'])
  w.git(['checkout', '-q', 'main'])
  const c = ctx(w, fakeGh({ prs: { 'zug-fahrt': 7 }, laeufe: { 'zug-fahrt': [{ databaseId: 1, status: 'completed', conclusion: 'failure' }] } }).gh)
  pruefe('anderer Zug-Kopf mit gleichem Elternteil (ohne Merge) → neue Fahrt, kein „unverändert“', start(c) === 0 && refOrigin(w, 'refs/heads/zug-fahrt') !== erster && refOrigin(w, 'refs/heads/zug-fahrt') === refOrigin(w, 'refs/heads/zug'), c.zeilen)
}
{
  const { w, kopf } = weltMitFahrt()
  const aufgerufen = []
  const git = (a) => {
    aufgerufen.push(a)
    return w.git(a)
  }
  const { gh } = fakeGh({ prs: { 'zug-fahrt': 7 }, lauf: { 9: { ...LAUF_GRUEN[9], headSha: kopf } } })
  const c = ctx(w, gh, { git })
  urteil(c, 'zug-fahrt', '9')
  const pushes = aufgerufen.filter((a) => a[0] === 'push')
  pruefe('grün: genau ein Push, und der ist ein Dry-Run des Kopfs nach main', pushes.length === 1 && JSON.stringify(pushes[0]) === JSON.stringify(['push', '--dry-run', 'origin', `${kopf}:refs/heads/main`]), pushes)
}
{
  const { w, kopf } = weltMitFahrt()
  const git = (a) => {
    if (a[0] === 'push' && a.includes('--dry-run')) throw new Error('rejected')
    return w.git(a)
  }
  const { gh, schreib } = fakeGh({ prs: { 'zug-fahrt': 7 }, lauf: { 9: { ...LAUF_GRUEN[9], headSha: kopf } } })
  const c = ctx(w, gh, { git })
  urteil(c, 'zug-fahrt', '9')
  pruefe('Dry-Run abgelehnt (obwohl main im Kopf steckt) → main-holen mit Grund, nicht ff-pruefen', /Schritt main-holen \(Dry-Run abgelehnt/.test(schreib.join('\n')), schreib)
}
{
  const { w, kopf } = weltMitFahrt()
  w.git(['checkout', '-q', 'main'])
  w.schreibe('daten.txt', 'neu\n', 'chore(data): Bot nach der Fahrt')
  w.git(['push', '-q', 'origin', 'main'])
  const { gh, schreib } = fakeGh({ prs: { 'zug-fahrt': 7 }, lauf: { 9: { ...LAUF_GRUEN[9], headSha: kopf } } })
  urteil(ctx(w, gh), 'zug-fahrt', '9')
  pruefe('main weitergelaufen: der Grund kommt aus der Fast-Forward-Regel (Bots oder Direkt-Merge), nicht aus dem Dry-Run', /Schritt main-holen \(main ist weitergelaufen \(Bots oder Direkt-Merge\)\)/.test(schreib.join('\n')), schreib)
}
{
  const r = probeWelt(UMFANG, 'success', { 'zug-probe': 8 })
  pruefe('kein Fahrt-PR offen → kein Kommentar, der Probe-PR wird trotzdem geschlossen', !r.schreib.some((s) => s.startsWith('pr comment')) && r.schreib.includes('pr close 8 --delete-branch'), r.schreib)
  const q = probeWelt(UMFANG, 'success', { 'zug-fahrt': 7 })
  pruefe('kein Probe-PR offen → kein pr close', q.schreib.some((s) => s.startsWith('pr comment 7')) && !q.schreib.some((s) => s.startsWith('pr close')), q.schreib)
  const { w } = weltMitFahrt()
  const zu = { prs: { 'zug-fahrt': 7 }, lauf: { 9: { databaseId: 9, headSha: 'a'.repeat(40), status: 'completed', conclusion: 'failure' } } }
  const { gh } = fakeGh(zu)
  urteil(ctx(w, gh), 'zug-fahrt', '9')
  pruefe('Probe: Platzhalter-Kopf hat main als Elternteil und main als Baum, Probe-Kopf ebenso', w.gitOrigin(['rev-parse', 'refs/heads/zug-probe^']).trim() === refOrigin(w, 'refs/heads/main') && w.gitOrigin(['rev-parse', 'refs/heads/zug-probe^{tree}']).trim() === w.gitOrigin(['rev-parse', 'refs/heads/main^{tree}']).trim())
}
{
  const w = weltMitZug()
  const aus = []
  const { gh, schreib } = fakeGh()
  const exit = main(['start', '--trocken'], { gh, git: w.git, melde: (z) => aus.push(z) })
  pruefe('main(start --trocken) schreibt nichts (der Schalter kommt in start an)', exit === 0 && !hatRef(w, 'refs/heads/zug-fahrt') && schreib.length === 0 && /trocken/.test(aus.at(-1)), aus)
}

console.log('bauDeploy und Einstieg')
{
  const { gh, schreib } = fakeGh()
  const zeilen = []
  bauDeploy({ gh, melde: (z) => zeilen.push(z), trocken: false })
  pruefe('Bau zuerst, dann Deploy, beide auf main', gleichListe(schreib, ['workflow run bestand-bauen.yml --ref main', 'workflow run deploy.yml --ref main']), schreib)
  const t = fakeGh()
  bauDeploy({ gh: t.gh, melde: () => {}, trocken: true })
  pruefe('trocken: kein Dispatch', t.schreib.length === 0)
}
function gleichListe(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i])
}
{
  const aus = []
  pruefe('ohne Befehl → Exit 2 mit Aufruf-Zeile', main([], { melde: (z) => aus.push(z) }) === 2 && /Aufruf:/.test(aus[0]))
  // Attrappen, die einen Aufruf des Urteils als Exit 0 zeigen: ein stiller Abruffehler (echtes gh) ergäbe auch Exit 2 und verdeckte die Prüfung.
  const laeuft = { gh: () => JSON.stringify({ databaseId: 1, headSha: 'a'.repeat(40), status: 'in_progress', conclusion: '' }), git: () => '', melde: () => {} }
  pruefe('Kontrolle: gültiger Aufruf mit laufender Kette → Exit 0', main(['urteil', '--zweig', 'zug-fahrt', '--lauf', '1'], laeuft) === 0)
  pruefe('urteil mit Zweig main → Exit 2', main(['urteil', '--zweig', 'main', '--lauf', '1'], laeuft) === 2)
  pruefe('urteil mit Lauf x → Exit 2', main(['urteil', '--zweig', 'zug-fahrt', '--lauf', 'x'], laeuft) === 2)
  pruefe('urteil ohne Lauf → Exit 2', main(['urteil', '--zweig', 'zug-fahrt'], laeuft) === 2)
  const aus2 = []
  pruefe('Abruffehler → Exit 2 mit FEHLER-Zeile', main(['urteil', '--zweig', 'zug-fahrt', '--lauf', '3'], { gh: () => { throw new Error('HTTP 502') }, git: () => '', melde: (z) => aus2.push(z) }) === 2 && /FEHLER HTTP 502/.test(aus2[0]), aus2)
}
{
  const p = spawnSync(process.execPath, [path.join(import.meta.dirname, 'zug-fahrt.mjs')], { encoding: 'utf8', timeout: 30000 })
  pruefe('Prozess ohne Argument: Exit 2 und Aufruf-Zeile (Startprüfung greift)', p.status === 2 && /Aufruf: node tools\/zug-fahrt\.mjs/.test(p.stdout), p.stdout)
}

rmSync(wurzel, { recursive: true, force: true })
if (fehler.length > 0) {
  console.error(`zug-fahrt.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('zug-fahrt.test: alle Fälle grün')
