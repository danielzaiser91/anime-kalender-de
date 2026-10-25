/**
 * Test für `tools/claude-global/hooks/worktree-aufraeumen.js` (+ `-logik.js`): Entscheidungen, Abbau auf einem Attrappen-Repo im Temp-Ordner
 * (nie das echte Repo, nie cwd = Repo), Sperre, Auslöser, Wächterzeile und Prozess-Verdrahtung (Attrappe statt Prozess-Register).
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const hooks = join(import.meta.dirname, 'claude-global', 'hooks')
const req = createRequire(import.meta.url)
const L = req(join(hooks, 'worktree-aufraeumen-logik.js'))
const H = req(join(hooks, 'worktree-aufraeumen.js'))
const SCHON = L.SCHONFRIST_MS

// ---- reine Entscheidungen -------------------------------------------------------------------------------------------------------------
const JETZT = 1_000_000_000_000
const PR_SCHON = L.SCHONFRIST_PR_MS
const ctxBasis = { haupt: 'C:/x/haupt', jetzt: JETZT, prs: [], cacheLeer: () => true, sauber: () => true }
const wt = (extra = {}) => ({ pfad: 'C:/x/_worktrees/haupt/a', zweig: 'z', kopf: 'k', existiert: true, juengsteAenderungMs: JETZT - SCHON - 1, kopfZeitMs: JETZT - PR_SCHON - 1, ...extra })
const e = (w, c = {}) => L.entscheide(w, { ...ctxBasis, ...c })
const iso = (ms) => new Date(ms).toISOString()
// Dateizeiten und Sperren des Dateisystems sind echte Zeit, die Entscheidungslogik oben läuft mit fester JETZT.
const uhr = () => Date.now() // uhr-echt: Zeitstempel echter Dateien und Sperren, keine Tagesgrenze im Ergebnis
const pr = (state, extra = {}) => ({ headRefName: 'z', headRefOid: 'k', state, mergedAt: iso(JETZT - PR_SCHON), closedAt: null, ...extra })
const mit = (...prs) => ({ prs })

assert.deepEqual(H.PR_FELDER.split(','), ['headRefName', 'headRefOid', 'state', 'mergedAt', 'closedAt'])
assert.equal(PR_SCHON, 24 * 60 * 60 * 1000, 'Schonfrist seit dem Merge ist 24 h')
assert.deepEqual(e(wt(), mit(pr('MERGED'))), { aktion: 'weg', grund: 'pr-merged' })
assert.deepEqual(e(wt(), mit(pr('CLOSED', { mergedAt: null, closedAt: iso(JETZT - PR_SCHON) }))), { aktion: 'weg', grund: 'pr-closed' })
assert.equal(e(wt(), mit(pr('OPEN'))).grund, 'pr-offen')
assert.equal(e(wt(), mit(pr('OPEN'), pr('MERGED'))).grund, 'pr-offen', 'offener PR schlägt gemergten (Reihenfolge 1)')
assert.equal(e(wt(), mit(pr('MERGED'), pr('OPEN'))).grund, 'pr-offen', 'Reihenfolge 2')
assert.equal(e(wt({ kopf: 'anders' }), mit(pr('OPEN'))).grund, 'pr-offen', 'offener PR über den Zweignamen, auch bei anderem Kopf')
assert.equal(e(wt({ zweig: null }), mit(pr('OPEN', { headRefName: 'x' }))).grund, 'pr-offen', 'offener PR über den Kopf, auch losgelöst')
assert.equal(e(wt({ zweig: 'q', kopf: 'k2' }), mit(pr('OPEN', { headRefName: 'x', headRefOid: 'k' }))).grund, 'ohne-pr', 'fremder offener PR zählt nicht')
// A1: Lesen hinterlässt kein Lebenszeichen — ohne PR nie weg, auch nach Tagen; „Kopf in main“ ist kein Erledigt-Zeichen mehr.
assert.equal(e(wt({ juengsteAenderungMs: 0 })).grund, 'ohne-pr')
assert.equal(e(wt({ zweig: null, juengsteAenderungMs: 0 })).grund, 'ohne-pr')
// A2: gleicher Zweigname, anderer Stand → behalten.
assert.equal(e(wt({ kopf: 'neuer-commit' }), mit(pr('MERGED'))).grund, 'ohne-pr', 'Kopf weicht vom PR-Kopf ab')
assert.equal(e(wt({ kopf: null }), mit(pr('MERGED', { headRefOid: null }))).grund, 'ohne-pr', 'ohne Kopf kein Erledigt-Zeichen')
// A5: losgelöster Kopf eines gemergten PR → weg, mit Schonfrist seit dem Merge.
assert.deepEqual(e(wt({ zweig: null }), mit(pr('MERGED'))), { aktion: 'weg', grund: 'pr-merged' })
// Schonfrist seit Merge/Schließen: eine Millisekunde darunter behalten, genau 24 h weg, nicht seit der letzten Dateiänderung.
assert.equal(e(wt(), mit(pr('MERGED', { mergedAt: iso(JETZT - PR_SCHON + 1) }))).grund, 'pr-jung')
assert.equal(e(wt(), mit(pr('MERGED', { mergedAt: iso(JETZT - PR_SCHON) }))).aktion, 'weg')
assert.equal(e(wt(), mit(pr('CLOSED', { mergedAt: null, closedAt: iso(JETZT - PR_SCHON + 1) }))).grund, 'pr-jung')
assert.equal(e(wt({ juengsteAenderungMs: 0 }), mit(pr('MERGED', { mergedAt: iso(JETZT - 1000) }))).grund, 'pr-jung', 'alte Dateien, frischer Merge')
assert.equal(e(wt(), mit(pr('MERGED', { mergedAt: null, closedAt: null }))).grund, 'ohne-pr', 'ohne Datum kein Erledigt-Zeichen')
assert.equal(e(wt(), mit(pr('MERGED', { mergedAt: 'kein-datum' }))).grund, 'ohne-pr')
assert.equal(e(wt(), mit(pr('MERGED', { mergedAt: iso(JETZT - 5 * PR_SCHON) }), pr('MERGED', { mergedAt: iso(JETZT - 1000) }))).grund, 'pr-jung', 'jüngster Abschluss zählt')
assert.equal(e(wt(), mit(pr('MERGED', { mergedAt: iso(JETZT - 1000) }), pr('MERGED', { mergedAt: iso(JETZT - 5 * PR_SCHON) }))).grund, 'pr-jung')
// A6: HEAD erst nach dem Abschluss bewegt (Nachprüfung, neuer Zweig auf altem Kopf) → behalten; genau zur Abschlusszeit noch weg.
assert.equal(e(wt({ kopfZeitMs: JETZT - PR_SCHON }), mit(pr('MERGED'))).aktion, 'weg', 'HEAD genau zum Merge')
assert.equal(e(wt({ kopfZeitMs: JETZT - PR_SCHON + 1 }), mit(pr('MERGED'))).grund, 'kopf-nach-abschluss')
assert.equal(e(wt({ kopfZeitMs: JETZT - 1000 }), mit(pr('MERGED'))).grund, 'kopf-nach-abschluss', 'HEAD deutlich nach dem Merge')
assert.equal(e(wt({ kopfZeitMs: JETZT - PR_SCHON + 1 }), mit(pr('CLOSED', { mergedAt: null, closedAt: iso(JETZT - PR_SCHON) }))).grund, 'kopf-nach-abschluss', 'auch bei geschlossenem PR')
assert.equal(e(wt({ kopfZeitMs: undefined }), mit(pr('MERGED'))).grund, 'kopf-nach-abschluss', 'ohne HEAD-Zeit bleibt der Worktree')
assert.equal(e(wt({ kopfZeitMs: Infinity }), mit(pr('MERGED'))).grund, 'kopf-nach-abschluss', 'unlesbare HEAD-Zeit bleibt')
assert.equal(e(wt({ pfad: 'C:/x/haupt' }), mit(pr('MERGED'))).grund, 'haupt', 'Hauptordner nie')
assert.equal(e(wt({ pfad: 'C:\\X\\Haupt\\' }), mit(pr('MERGED'))).grund, 'haupt', 'Schreibweise egal')
for (const fremd of ['C:/x/haupt/anderer', 'C:/x/haupt/_wt-a', 'C:/x/_worktrees/haupt', 'C:/x/_worktrees/haupt/a/b', 'C:/x/_worktrees2/haupt/a', 'C:/x/mein_worktrees/haupt/a', 'C:/x/_worktrees//a', 'C:/x/haupt/_worktrees/a']) {
  assert.equal(e(wt({ pfad: fremd }), mit(pr('MERGED'))).grund, 'fremd', `nur _worktrees/<repo>/<thema>: ${fremd}`)
}
assert.deepEqual(e(wt({ existiert: false })), { aktion: 'prune', grund: 'ordner-fehlt' })
assert.equal(e(wt({ juengsteAenderungMs: JETZT - SCHON + 1 }), mit(pr('MERGED'))).grund, 'jung', 'eine Millisekunde unter 2 h')
assert.equal(e(wt({ juengsteAenderungMs: JETZT - SCHON }), mit(pr('MERGED'))).aktion, 'weg', 'genau 2 h')
assert.equal(e(wt({ juengsteAenderungMs: JETZT }), mit(pr('MERGED'))).grund, 'jung')
// A4: echter data/cache mit Inhalt bleibt.
assert.equal(e(wt(), { ...mit(pr('MERGED')), cacheLeer: () => false }).grund, 'cache-inhalt')
assert.equal(e(wt(), { ...mit(pr('MERGED')), cacheLeer: () => undefined }).grund, 'cache-inhalt', 'unbekannt zählt als Inhalt')
assert.equal(e(wt(), { ...mit(pr('MERGED')), sauber: () => false }).grund, 'geaendert')
assert.equal(e(wt(), { ...mit(pr('MERGED')), sauber: () => undefined }).grund, 'geaendert', 'unbekannt zählt als geändert')
const fragen = []
e(wt(), { ...mit(pr('OPEN')), sauber: (p) => fragen.push(p), cacheLeer: (p) => fragen.push(p) })
e(wt({ juengsteAenderungMs: JETZT }), { ...mit(pr('MERGED')), sauber: (p) => fragen.push(p), cacheLeer: (p) => fragen.push(p) })
e(wt(), { ...mit(pr('MERGED', { mergedAt: iso(JETZT) })), sauber: (p) => fragen.push(p), cacheLeer: (p) => fragen.push(p) })
assert.equal(fragen.length, 0, 'Dateisystem und git status nur für Kandidaten zum Entfernen')

const losEintrag = (eintraege, alter = SCHON) => L.bewerteLosen({ eintraege, jetzt: JETZT, juengsteAenderungMs: JETZT - alter })
assert.deepEqual(losEintrag([]), { aktion: 'weg', grund: 'leer' })
assert.deepEqual(losEintrag([{ name: 'node_modules', istVerknuepfung: true }]), { aktion: 'weg', grund: 'nur-junction' })
assert.equal(losEintrag([{ name: 'node_modules', istVerknuepfung: false }]).aktion, 'behalten', 'echter node_modules-Ordner bleibt')
assert.equal(losEintrag([{ name: 'andere', istVerknuepfung: true }]).aktion, 'weg', 'Verknüpfung mit jedem Namen')
// Reste aus Verknüpfungen, auch einen Ordner tief (data/cache, worker/node_modules): weg; jeder echte Eintrag daneben hält sie zurück.
const link = (name) => ({ name, istVerknuepfung: true })
const ordner = (name, ...kinder) => ({ name, istVerknuepfung: false, kinder })
assert.deepEqual(losEintrag([ordner('data', link('cache'))]), { aktion: 'weg', grund: 'nur-junction' })
assert.equal(losEintrag([ordner('data', link('cache')), link('node_modules'), ordner('worker', link('node_modules'))]).aktion, 'weg')
assert.equal(losEintrag([ordner('data', { name: 'cache', istVerknuepfung: false })]).aktion, 'behalten', 'echter Cache im Unterordner')
assert.equal(losEintrag([ordner('data', link('cache'), { name: 'a.txt', istVerknuepfung: false })]).aktion, 'behalten', 'echte Datei neben der Verknüpfung')
assert.equal(losEintrag([ordner('data', link('fremd'))]).aktion, 'weg', 'Verknüpfung mit unbekanntem Namen')
assert.equal(losEintrag([ordner('data', ordner('leer'))]).aktion, 'weg', 'leere Ordner sind Rest')
assert.equal(losEintrag([ordner('data', ordner('x', ordner('y', { name: 'f.txt', istVerknuepfung: false })))]).aktion, 'behalten', 'echte Datei tief unten')
assert.equal(losEintrag([ordner('data', link('cache')), { name: 'x.txt', istVerknuepfung: false }]).aktion, 'behalten', 'echte Datei im Kopf')
assert.equal(losEintrag([{ name: 'node_modules', istVerknuepfung: true }, { name: 'x', istVerknuepfung: false }]).aktion, 'behalten')
assert.equal(losEintrag([], SCHON - 1).grund, 'jung')

assert.equal(SCHON, 2 * 60 * 60 * 1000, 'Schonfrist ist 2 h')
assert.equal(L.warnzeile(20), null)
assert.match(L.warnzeile(21), /21 Worktrees/)
assert.equal(L.sperreFrei(null, JETZT, () => true), true)
assert.equal(L.sperreFrei({ pid: 1, zeit: JETZT }, JETZT, () => true), false, 'lebt: gesperrt')
assert.equal(L.sperreFrei({ pid: 1, zeit: JETZT }, JETZT, () => false), true, 'Prozess tot: frei')
assert.equal(L.sperreFrei({ pid: 1, zeit: JETZT - L.SPERRE_MAX_MS - 1 }, JETZT, () => true), true, 'zu alt: frei')
assert.equal(L.sperreFrei({ pid: 1, zeit: JETZT - L.SPERRE_MAX_MS + 1 }, JETZT, () => true), false)

for (const ja of ['gh pr merge 12 --squash', '"/c/Program Files/GitHub CLI/gh.exe" pr merge 5', 'cd x && gh pr merge 3', 'echo a; gh  pr  merge 3']) assert.equal(L.istMerge(ja), true, ja)
for (const nein of ['gh pr view 12', 'gh pr list', 'git merge x', 'ghx pr merge 1', '', undefined]) assert.equal(L.istMerge(nein), false, String(nein))

const sitz = { hook_event_name: 'SessionStart' }
const merge = { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr merge 9' }, tool_response: {} }
assert.equal(H.ausloeser(sitz), 'sitzung')
assert.equal(H.ausloeser(merge), 'merge')
assert.equal(H.ausloeser({ ...merge, tool_name: 'Edit' }), null)
assert.equal(H.ausloeser({ ...merge, hook_event_name: 'PreToolUse' }), null)
assert.equal(H.ausloeser({ ...merge, tool_response: { interrupted: true } }), null)
assert.equal(H.ausloeser({ ...merge, tool_input: { command: 'gh pr view 9' } }), null)

// Standardwurzel ohne Umgebungsvariable (der Attrappen-Teil setzt WT_WURZEL auf einen Wegwerf-Ordner).
const wurzelVorher = process.env.WT_WURZEL
delete process.env.WT_WURZEL
assert.equal(H.wtOrdner('C:/code/ai/anime-kalender-de'), 'C:/code/_worktrees/anime-kalender-de', 'Standardwurzel')
assert.equal(H.wtOrdner('C:/code/ai/ticket-board'), 'C:/code/_worktrees/ticket-board', 'Repo-Name aus dem Hauptordner')
if (wurzelVorher !== undefined) process.env.WT_WURZEL = wurzelVorher

// ---- Attrappen-Repo ---------------------------------------------------------------------------------------------------------------------
const wurzel = mkdtempSync(join(tmpdir(), 'wt-aufraeumen-'))
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' }
const g = (cwd, ...a) => execFileSync('git', a, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim()
const origin = join(wurzel, 'origin.git')
const haupt = join(wurzel, 'haupt').replace(/\\/g, '/')
const wtDir = join(wurzel, '_worktrees', 'haupt').replace(/\\/g, '/')
process.env.WT_WURZEL = join(wurzel, '_worktrees')
const fremdNm = join(wurzel, 'echtes-node-modules')
const fremdCache = join(wurzel, 'echter-cache')

try {
  mkdirSync(origin)
  g(origin, 'init', '--bare', '-b', 'main')
  g(wurzel, 'clone', origin, 'haupt')
  writeFileSync(join(haupt, '.gitignore'), 'node_modules\ndata/cache\n')
  mkdirSync(join(haupt, 'data'))
  writeFileSync(join(haupt, 'data', 'a.txt'), 'a\n')
  g(haupt, 'add', '.')
  g(haupt, 'commit', '-m', 'c1')
  g(haupt, 'push', 'origin', 'HEAD:main')
  const c1 = g(haupt, 'rev-parse', 'HEAD')
  mkdirSync(wtDir, { recursive: true })

  // HEAD-Zeit des Worktrees setzen (Reflog-Datei im Verwaltungsordner); ohne Angabe 30 h zurück, also vor jedem Abschluss dieser Tests.
  const kopfDatei = (name) => join(haupt, '.git', 'worktrees', name, 'logs', 'HEAD')
  const setzeKopfZeit = (name, vorH = 30) => utimesSync(kopfDatei(name), new Date(uhr() - vorH * 3600_000), new Date(uhr() - vorH * 3600_000))
  const neu = (name, zweig, mitCommit = false) => {
    g(haupt, 'worktree', 'add', '-b', zweig, join(wtDir, name), c1)
    if (mitCommit) {
      writeFileSync(join(wtDir, name, 'neu.txt'), zweig)
      g(join(wtDir, name), 'add', 'neu.txt')
      g(join(wtDir, name), 'commit', '-m', zweig)
    }
    setzeKopfZeit(name)
  }
  neu('_wt-gemergt', 'b-gemergt', true)
  neu('_wt-geschlossen', 'b-geschlossen', true)
  neu('_wt-offen', 'b-offen', true)
  neu('_wt-offen-inmain', 'b-offen-inmain')
  neu('_wt-inmain', 'b-inmain')
  neu('_wt-ohnepr', 'b-ohnepr', true)
  neu('_wt-dirty', 'b-dirty', true)
  neu('_wt-untracked', 'b-untracked', true)
  neu('_wt-junction', 'b-junction', true)
  neu('_wt-weg-ordner', 'b-weg-ordner')
  writeFileSync(join(wtDir, '_wt-dirty', 'data', 'a.txt'), 'geändert\n')
  writeFileSync(join(wtDir, '_wt-untracked', 'agent-notiz.txt'), 'wichtig\n')
  mkdirSync(fremdNm)
  writeFileSync(join(fremdNm, 'paket.txt'), 'p')
  mkdirSync(fremdCache)
  mkdirSync(join(haupt, 'node_modules'))
  writeFileSync(join(haupt, 'node_modules', 'haupt.txt'), 'h')
  mkdirSync(join(haupt, 'data', 'cache'), { recursive: true })
  writeFileSync(join(haupt, 'data', 'cache', 'haupt.json'), '{}')
  writeFileSync(join(fremdCache, 'roh.json'), '{}')
  symlinkSync(fremdNm, join(wtDir, '_wt-junction', 'node_modules'), 'junction')
  symlinkSync(fremdCache, join(wtDir, '_wt-junction', 'data', 'cache'), 'junction')
  // A5: Prüfer-Worktree losgelöst auf dem Kopf eines gemergten PR; A2: Zweig des gemergten PR mit späterer Arbeit; A4: echter Cache; A3: Junction unter worker/.
  const oidGemergt = g(join(wtDir, '_wt-gemergt'), 'rev-parse', 'HEAD')
  g(haupt, 'worktree', 'add', '--detach', join(wtDir, '_wt-pruefer'), oidGemergt)
  setzeKopfZeit('_wt-pruefer')
  neu('_wt-wieder', 'b-wieder', true)
  const oidWieder = g(join(wtDir, '_wt-wieder'), 'rev-parse', 'HEAD')
  writeFileSync(join(wtDir, '_wt-wieder', 'spaeter.txt'), 'neue Arbeit')
  g(join(wtDir, '_wt-wieder'), 'add', 'spaeter.txt')
  g(join(wtDir, '_wt-wieder'), 'commit', '-m', 'spaeter')
  neu('_wt-cache', 'b-cache', true)
  mkdirSync(join(wtDir, '_wt-cache', 'data', 'cache'))
  writeFileSync(join(wtDir, '_wt-cache', 'data', 'cache', 'x.json'), '{"lokal":1}')
  neu('_wt-worker', 'b-worker', true)
  mkdirSync(join(wtDir, '_wt-worker', 'worker'))
  symlinkSync(fremdNm, join(wtDir, '_wt-worker', 'worker', 'node_modules'), 'junction')
  rmSync(join(wtDir, '_wt-weg-ordner'), { recursive: true })
  // lose Ordner
  mkdirSync(join(wtDir, '_wt-lose-leer'))
  mkdirSync(join(wtDir, '_wt-lose-junction'))
  symlinkSync(fremdNm, join(wtDir, '_wt-lose-junction', 'node_modules'), 'junction')
  mkdirSync(join(wtDir, '_wt-lose-inhalt'))
  writeFileSync(join(wtDir, '_wt-lose-inhalt', 'x.txt'), 'x')
  mkdirSync(join(wtDir, '_wt-lose-inhalt-und-junction'))
  symlinkSync(fremdNm, join(wtDir, '_wt-lose-inhalt-und-junction', 'node_modules'), 'junction')
  writeFileSync(join(wtDir, '_wt-lose-inhalt-und-junction', 'x.txt'), 'x')

  // Abschluss vor 22 h: nach „jetzt + 3 h“ sind es 25 h (über der Schonfrist), mit echter Uhr 22 h (darunter).
  const vor22h = new Date(uhr() - 22 * 3600_000).toISOString()
  const oid = (name) => g(join(wtDir, name), 'rev-parse', 'HEAD')
  const erledigt = (zweig, name, state = 'MERGED', kopf = oid(name)) => ({ headRefName: zweig, headRefOid: kopf, state, mergedAt: state === 'MERGED' ? vor22h : null, closedAt: state === 'CLOSED' ? vor22h : null })
  const prs = [
    erledigt('b-gemergt', '_wt-gemergt'),
    erledigt('b-geschlossen', '_wt-geschlossen', 'CLOSED'),
    erledigt('b-offen', '_wt-offen', 'OPEN'),
    erledigt('b-offen-inmain', '_wt-offen-inmain', 'OPEN', 'fremd-1'),
    erledigt('b-offen-inmain', '_wt-offen-inmain', 'MERGED', 'fremd-2'),
    erledigt('b-dirty', '_wt-dirty'),
    erledigt('b-untracked', '_wt-untracked'),
    erledigt('b-junction', '_wt-junction'),
    erledigt('b-wieder', '_wt-wieder', 'MERGED', oidWieder),
    erledigt('b-cache', '_wt-cache'),
    erledigt('b-worker', '_wt-worker'),
  ]
  let jetzt = uhr() + 3 * 3600_000
  const entfernt = []
  // Die echten Adapter (status, worktree remove) laufen gegen das Attrappen-Repo; nur gh und die Uhr sind ersetzt.
  const echt = H.echteWelt(haupt)
  const welt = { ...echt, prs: () => prs, jetzt: () => jetzt, entferne: (pfad) => { entfernt.push(pfad); echt.entferne(pfad) } }
  const grund = (b, name) => b.worktrees.find((w) => w.pfad.endsWith(`/${name}`))
  const lose = (b, name) => b.lose.find((w) => w.pfad.replace(/\\/g, '/').endsWith(`/${name}`))

  // Liste ändert nichts.
  const liste = H.abbau(haupt, welt, false)
  assert.equal(entfernt.length, 0)
  assert.equal(existsSync(join(wtDir, '_wt-gemergt')), true)
  const erwartet = {
    '_wt-gemergt': ['weg', 'pr-merged'],
    '_wt-geschlossen': ['weg', 'pr-closed'],
    '_wt-offen': ['behalten', 'pr-offen'],
    '_wt-offen-inmain': ['behalten', 'pr-offen'],
    '_wt-inmain': ['behalten', 'ohne-pr'],
    '_wt-pruefer': ['weg', 'pr-merged'],
    '_wt-wieder': ['behalten', 'ohne-pr'],
    '_wt-cache': ['behalten', 'cache-inhalt'],
    '_wt-worker': ['weg', 'pr-merged'],
    '_wt-ohnepr': ['behalten', 'ohne-pr'],
    '_wt-dirty': ['behalten', 'geaendert'],
    '_wt-untracked': ['behalten', 'geaendert'],
    '_wt-junction': ['weg', 'pr-merged'],
    '_wt-weg-ordner': ['prune', 'ordner-fehlt'],
  }
  for (const [name, [aktion, warum]] of Object.entries(erwartet)) assert.deepEqual([grund(liste, name).aktion, grund(liste, name).grund], [aktion, warum], name)
  assert.equal(liste.worktrees.find((w) => w.pfad === haupt).grund, 'haupt', 'Hauptordner steht in der Liste und bleibt')
  assert.deepEqual([lose(liste, '_wt-lose-leer').aktion, lose(liste, '_wt-lose-junction').aktion, lose(liste, '_wt-lose-inhalt').aktion, lose(liste, '_wt-lose-inhalt-und-junction').aktion], ['weg', 'weg', 'behalten', 'behalten'])
  assert.equal(lose(liste, '_wt-weg-ordner'), undefined, 'registrierter Worktree ist kein loser Ordner')

  // Frisch (jetzt = echte Zeit): nichts wird angefasst.
  jetzt = uhr()
  const frisch = H.abbau(haupt, welt, true)
  assert.equal(frisch.entfernt, 0, 'alles unter 2 h bleibt')
  assert.equal(grund(frisch, '_wt-gemergt').grund, 'jung')
  assert.equal(lose(frisch, '_wt-lose-leer').grund, 'jung')
  assert.equal(existsSync(join(wtDir, '_wt-lose-leer')), true)

  // Abbau.
  jetzt = uhr() + 3 * 3600_000
  const b = H.abbau(haupt, welt, true)
  assert.deepEqual(b.fehler, [])
  assert.deepEqual(entfernt.map((p) => p.replace(/^.*\/(_wt-[^/]+)$/, '$1')).sort(), ['_wt-geschlossen', '_wt-gemergt', '_wt-pruefer', '_wt-worker', '_wt-junction'].sort())
  for (const weg of ['_wt-gemergt', '_wt-geschlossen', '_wt-pruefer', '_wt-worker', '_wt-junction', '_wt-lose-leer', '_wt-lose-junction']) assert.equal(existsSync(join(wtDir, weg)), false, `${weg} weg`)
  for (const bleibt of ['_wt-inmain', '_wt-wieder', '_wt-cache', '_wt-offen', '_wt-offen-inmain', '_wt-ohnepr', '_wt-dirty', '_wt-untracked', '_wt-lose-inhalt', '_wt-lose-inhalt-und-junction']) assert.equal(existsSync(join(wtDir, bleibt)), true, `${bleibt} bleibt`)
  assert.equal(readFileSync(join(wtDir, '_wt-untracked', 'agent-notiz.txt'), 'utf8'), 'wichtig\n')
  assert.equal(readFileSync(join(wtDir, '_wt-dirty', 'data', 'a.txt'), 'utf8'), 'geändert\n')
  assert.equal(readFileSync(join(wtDir, '_wt-cache', 'data', 'cache', 'x.json'), 'utf8'), '{"lokal":1}', 'echter Cache bleibt')
  assert.equal(existsSync(join(wtDir, '_wt-wieder', 'spaeter.txt')), true, 'Zweig mit Arbeit nach dem Merge bleibt')
  assert.equal(readFileSync(join(fremdNm, 'paket.txt'), 'utf8'), 'p', 'worker/node_modules: Ziel unberührt')
  assert.equal(readFileSync(join(fremdNm, 'paket.txt'), 'utf8'), 'p', 'node_modules des Hauptordners unberührt (Junction nie rekursiv)')
  assert.equal(readFileSync(join(fremdCache, 'roh.json'), 'utf8'), '{}', 'data/cache unberührt')
  assert.ok(existsSync(join(haupt, '.git')) && existsSync(join(haupt, 'data', 'a.txt')), 'Hauptordner unberührt')
  assert.equal(readFileSync(join(wtDir, '_wt-lose-inhalt', 'x.txt'), 'utf8'), 'x')
  assert.ok(existsSync(join(wtDir, '_wt-lose-inhalt-und-junction', 'node_modules')), 'Junction im Ordner mit Inhalt bleibt')
  const zweige = g(haupt, 'branch', '--list').split('\n').map((z) => z.replace(/^[*+]?\s+/, ''))
  for (const z of ['b-gemergt', 'b-geschlossen', 'b-inmain', 'b-wieder', 'b-cache', 'b-worker', 'b-junction', 'b-weg-ordner', 'b-offen', 'b-dirty']) assert.ok(zweige.includes(z), `Zweig ${z} bleibt`)
  assert.equal(g(haupt, 'worktree', 'list').includes('_wt-weg-ordner'), false, 'prune räumt die Registrierung')

  // Eine Verknüpfung, die sich nicht lösen lässt, hält den Worktree zurück.
  neu('_wt-haengt', 'b-haengt', true)
  symlinkSync(fremdNm, join(wtDir, '_wt-haengt', 'node_modules'), 'junction')
  prs.push(erledigt('b-haengt', '_wt-haengt'))
  prs.push({ headRefName: 'b-haengt', state: 'MERGED' })
  const haengt = H.abbau(haupt, { ...welt, loese: () => false }, true)
  assert.equal(grund(haengt, '_wt-haengt').aktion, 'weg')
  assert.equal(haengt.fehler.filter((f) => f.includes('_wt-haengt')).length, 1)
  assert.equal(existsSync(join(wtDir, '_wt-haengt')), true, 'Worktree mit hängender Verknüpfung bleibt')
  assert.equal(entfernt.some((p) => p.endsWith('_wt-haengt')), false)
  assert.equal(H.verknuepfungen(join(wtDir, '_wt-haengt')).length, 1)
  assert.equal(H.loeseVerknuepfungen(join(wtDir, '_wt-haengt')), true)
  assert.equal(H.verknuepfungen(join(wtDir, '_wt-haengt')).length, 0)
  assert.equal(readFileSync(join(fremdNm, 'paket.txt'), 'utf8'), 'p')

  // Bleibt nach `entferne` ein Rest (z. B. nicht gelöste Verknüpfung in der Tiefe), zählt der Worktree nicht als entfernt.
  neu('_wt-rest', 'b-rest', true)
  prs.push(erledigt('b-rest', '_wt-rest'))
  const rest = H.abbau(haupt, { ...welt, entferne: (p) => (p.includes('_wt-rest') ? undefined : welt.entferne(p)) }, true)
  assert.equal(existsSync(join(wtDir, '_wt-rest')), true)
  assert.equal(rest.fehler.filter((f) => f.startsWith('Rest bleibt') && f.includes('_wt-rest')).length, 1)
  // Zwischen Planung und Entfernen geändert: nichts wird gelöst oder entfernt.
  let status = 0
  const spaeter = H.abbau(haupt, { ...welt, sauber: (p) => (p.includes('_wt-rest') ? ++status === 1 : welt.sauber(p)) }, true)
  assert.equal(spaeter.fehler.filter((f) => f.startsWith('Geändert nach der Prüfung') && f.includes('_wt-rest')).length, 1)
  assert.equal(existsSync(join(wtDir, '_wt-rest')), true)
  // Nicht-leerer loser Ordner und zwischenzeitlich verändertes Worktree: nichts wird erzwungen.
  const nichtLeer = { worktrees: [], lose: [{ pfad: join(wtDir, '_wt-lose-inhalt'), aktion: 'weg' }], fehler: [], entfernt: 0 }
  H.vollziehe(haupt, welt, nichtLeer)
  assert.equal(nichtLeer.fehler.length, 1)
  assert.equal(readFileSync(join(wtDir, '_wt-lose-inhalt', 'x.txt'), 'utf8'), 'x', 'rmdir, nie rekursiv')
  const beiRennen = H.abbau(haupt, { ...welt, sauber: () => true }, true)
  assert.equal(beiRennen.fehler.filter((f) => f.includes('_wt-dirty') || f.includes('_wt-untracked')).length, 2, 'ohne --force: Entfernen scheitert')
  assert.equal(readFileSync(join(wtDir, '_wt-untracked', 'agent-notiz.txt'), 'utf8'), 'wichtig\n')
  assert.equal(readFileSync(join(wtDir, '_wt-dirty', 'data', 'a.txt'), 'utf8'), 'geändert\n')

  // A6: erst nach dem Merge auf den PR-Kopf gesetzte Worktrees (neuer Zweig, losgelöste Nachprüfung, alter Zweig wieder ausgecheckt) bleiben.
  prs.push(erledigt('b-gemergt', '_wt-pruefer', 'MERGED', oidGemergt))
  g(haupt, 'worktree', 'add', '-b', 'neue-arbeit', join(wtDir, '_wt-a6-zweig'), oidGemergt)
  g(haupt, 'worktree', 'add', '--detach', join(wtDir, '_wt-a6-nachpruefung'), oidGemergt)
  g(haupt, 'worktree', 'add', join(wtDir, '_wt-a6-alt'), 'b-gemergt')
  const a6 = ['_wt-a6-zweig', '_wt-a6-nachpruefung', '_wt-a6-alt']
  const a6Liste = H.abbau(haupt, welt, false)
  for (const n of a6) assert.deepEqual([grund(a6Liste, n).aktion, grund(a6Liste, n).grund], ['behalten', 'kopf-nach-abschluss'], n)
  // Gegenprobe: dieselben Worktrees mit HEAD-Zeit vor dem Merge wären weg.
  for (const n of a6) setzeKopfZeit(n)
  const a6Alt = H.abbau(haupt, welt, false)
  for (const n of a6) assert.deepEqual([grund(a6Alt, n).aktion, grund(a6Alt, n).grund], ['weg', 'pr-merged'], `${n} mit altem HEAD`)
  for (const n of a6) setzeKopfZeit(n, 0)
  const a6Los = H.abbau(haupt, welt, true)
  for (const n of a6) assert.equal(existsSync(join(wtDir, n, '.git')), true, `${n} nach dem Abbau noch da`)
  assert.equal(a6Los.fehler.filter((f) => a6.some((n) => f.includes(n))).length, 0)

  // A7: Ordner in Benutzung (EBUSY/EPERM beim Umbenennen) → nichts gelöst, nichts entfernt, nur gemeldet.
  const ebusy = () => { throw Object.assign(new Error('busy'), { code: 'EBUSY' }) }
  const umbenennungen = []
  assert.equal(H.ordnerFrei(join(wurzel, 'x'), (von, nach) => umbenennungen.push([von, nach])), true)
  assert.deepEqual(umbenennungen, [[join(wurzel, 'x'), `${join(wurzel, 'x')}-p`], [`${join(wurzel, 'x')}-p`, join(wurzel, 'x')]], 'hin und zurück')
  assert.equal(H.ordnerFrei(join(wurzel, 'x'), ebusy), false)
  let zaehler = 0
  const pausen = []
  assert.throws(() => H.ordnerFrei(join(wurzel, 'x'), () => { if (++zaehler >= 2) ebusy() }, (ms) => pausen.push(ms)), /Zurückbenennen scheitert.*x-p/, 'Zurückbenennen scheitert endgültig: laut')
  assert.equal(zaehler, 4, 'ein Hinweg, drei Rückversuche')
  assert.equal(pausen.length, 2, 'zwischen den Rückversuchen wird gewartet')
  zaehler = 0
  assert.equal(H.ordnerFrei(join(wurzel, 'x'), () => { if (++zaehler === 2) ebusy() }, () => {}), true, 'zweiter Rückversuch gelingt')
  neu('_wt-benutzt', 'b-benutzt', true)
  symlinkSync(fremdNm, join(wtDir, '_wt-benutzt', 'node_modules'), 'junction')
  prs.push(erledigt('b-benutzt', '_wt-benutzt'))
  const belegt = H.abbau(haupt, { ...welt, frei: (p) => H.ordnerFrei(p, ebusy) }, true)
  assert.equal(belegt.fehler.filter((f) => f.startsWith('In Benutzung') && f.includes('_wt-benutzt')).length, 1)
  assert.equal(existsSync(join(wtDir, '_wt-benutzt', 'neu.txt')), true, 'Dateien bleiben')
  assert.equal(H.verknuepfungen(join(wtDir, '_wt-benutzt')).length, 1, 'Verknüpfung bleibt')
  assert.equal(entfernt.some((p) => p.endsWith('_wt-benutzt')), false, 'git worktree remove nicht aufgerufen')
  assert.ok(g(haupt, 'worktree', 'list').includes('_wt-benutzt'), 'Registrierung bleibt')
  if (process.platform === 'win32') {
    // Nur unter win32 beweisbar: Linux/macOS benennen einen Ordner mit fremdem cwd ohne Fehler um, ein Gegenstück gibt es dort nicht.
    // Windows: echter Kindprozess mit cwd im Worktree hält den Ordner; die Standardprobe (fs.renameSync) muss das sehen. Auf Linux belegt nur A7 oben (ebusy-Attrappe) den Ablauf.
    const kind = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: join(wtDir, '_wt-benutzt'), stdio: 'ignore', windowsHide: true })
    try {
      await new Promise((ok) => setTimeout(ok, 1500))
      const mitKind = H.abbau(haupt, welt, true)
      assert.equal(mitKind.fehler.filter((f) => f.startsWith('In Benutzung') && f.includes('_wt-benutzt')).length, 1, 'cwd im Worktree: in Benutzung')
      assert.equal(existsSync(join(wtDir, '_wt-benutzt', 'neu.txt')), true)
      assert.ok(g(haupt, 'worktree', 'list').includes('_wt-benutzt'))
    } finally {
      kind.kill()
      await new Promise((ok) => kind.once('exit', ok))
    }
  }
  const frei = H.abbau(haupt, welt, true)
  assert.equal(existsSync(join(wtDir, '_wt-benutzt')), false, 'ohne Benutzung wird abgebaut')
  assert.deepEqual(frei.fehler.filter((f) => f.includes('_wt-benutzt')), [])
  assert.equal(readFileSync(join(fremdNm, 'paket.txt'), 'utf8'), 'p')

  // A1: Hin klappt, Zurückbenennen scheitert endgültig → Fehlerzeile, Registrierung bleibt, kein prune; ein späterer Lauf benennt zurück.
  neu('_wt-rueck', 'b-rueck', true)
  prs.push(erledigt('b-rueck', '_wt-rueck'))
  const nurHin = (von, nach) => { if (nach.endsWith('-p')) renameSync(von, nach); else ebusy() }
  const rueck = H.abbau(haupt, { ...welt, frei: (p) => H.ordnerFrei(p, nurHin, () => {}) }, true)
  assert.equal(rueck.fehler.filter((f) => f.startsWith('Zurückbenennen scheitert') && f.includes('_wt-rueck')).length, 1, 'Fehler laut')
  assert.ok(rueck.fehler.some((f) => f.startsWith('prune übersprungen')), 'prune ausgesetzt, gemeldet')
  assert.ok(g(haupt, 'worktree', 'list').includes('_wt-rueck'), 'Registrierung bleibt')
  assert.equal(existsSync(join(wtDir, '_wt-rueck-p', 'neu.txt')), true, 'Dateien liegen als -p')
  // Eigener Vollzug mit Attrappen: ohne Fehler beim Zurückbenennen läuft prune weiter (Gegenprobe zum Aussetzen).
  const pruneSpur = { worktrees: [], lose: [], fehler: [], entfernt: 0 }
  H.vollziehe(haupt, welt, pruneSpur)
  assert.equal(pruneSpur.fehler.length, 0, 'ohne Rückbenennfehler: prune läuft')
  // Der nächste Lauf: -p wird zurückbenannt (und der gemergte Worktree dann regulär abgebaut).
  assert.deepEqual(H.heileProbeOrdner([{ pfad: join(wtDir, '_wt-rueck') }], { fehler: [] }, renameSync).map((p) => basename(p)), ['_wt-rueck'])
  assert.equal(existsSync(join(wtDir, '_wt-rueck', 'neu.txt')), true, 'wieder unter dem Namen')
  neu('_wt-rueck2', 'b-rueck2', true)
  prs.push(erledigt('b-rueck2', '_wt-rueck2'))
  renameSync(join(wtDir, '_wt-rueck2'), join(wtDir, '_wt-rueck2-p'))
  for (const n of ['_wt-ohne-registrierung-p', '_wt-beides', '_wt-beides-p']) { mkdirSync(join(wtDir, n)); writeFileSync(join(wtDir, n, 'x.txt'), 'x') }
  const heilLauf = H.abbau(haupt, welt, true)
  assert.equal(existsSync(join(wtDir, '_wt-rueck2-p')), false, 'Lauf heilt liegengebliebenes -p')
  assert.equal(existsSync(join(wtDir, '_wt-ohne-registrierung-p')), true, 'ohne Registrierung bleibt es')
  assert.equal(existsSync(join(wtDir, '_wt-beides-p')), true, 'ist der Zielname belegt, bleibt es')
  assert.deepEqual(heilLauf.fehler.filter((f) => f.includes('_wt-rueck2')), [])
  // A1 R5: Worktree neben haupt (21 von 70 echten liegen unter C:/code/ai/) liegt als -p → der Lauf benennt ihn zurück, die Registrierung bleibt.
  const aussen = join(wurzel, '_wt-aussen')
  g(haupt, 'worktree', 'add', '-b', 'b-aussen', aussen, c1)
  writeFileSync(join(aussen, 'arbeit.txt'), 'x')
  renameSync(aussen, `${aussen}-p`)
  const aussenLauf = H.abbau(haupt, welt, true)
  assert.equal(existsSync(`${aussen}-p`), false, 'außerhalb von haupt: -p geheilt')
  assert.equal(readFileSync(join(aussen, 'arbeit.txt'), 'utf8'), 'x')
  assert.ok(g(haupt, 'worktree', 'list').includes('_wt-aussen'), 'Registrierung bleibt')
  assert.deepEqual(aussenLauf.fehler, [])
  // Heilung scheitert (Ordner belegt): Fehlerzeile mit -p, kein prune, Registrierung bleibt.
  renameSync(aussen, `${aussen}-p`)
  const heilFehler = H.abbau(haupt, { ...welt, umbenennen: ebusy }, true)
  assert.deepEqual(heilFehler.fehler.filter((f) => f.startsWith('Heilung scheitert')).map(L.norm), [L.norm(`Heilung scheitert: ${aussen} liegt als ${aussen}-p`)])
  assert.ok(heilFehler.fehler.includes('prune übersprungen (Ordner nicht zurückbenannt)'), 'prune ausgesetzt')
  assert.ok(g(haupt, 'worktree', 'list').includes('_wt-aussen'), 'Registrierung bleibt trotz gescheiterter Heilung')
  assert.equal(existsSync(join(`${aussen}-p`, 'arbeit.txt')), true)
  H.abbau(haupt, welt, true)
  assert.equal(existsSync(join(aussen, 'arbeit.txt')), true, 'späterer Lauf heilt')
  // Nur `<pfad>-p` wird zurückbenannt; fehlt er, wird nichts versucht und nichts gemeldet.
  const stray = join(wurzel, 'stray')
  mkdirSync(join(stray, '_wt-qxy'), { recursive: true })
  const strayBericht = { fehler: [] }
  assert.deepEqual(H.heileProbeOrdner([{ pfad: join(stray, '_wt-q') }], strayBericht, renameSync), [])
  assert.deepEqual(strayBericht, { fehler: [] }, 'ohne -p: keine Fehlerzeile, prune bleibt an')
  assert.equal(existsSync(join(stray, '_wt-qxy')), true)
  mkdirSync(join(stray, '_wt-q-p'))
  assert.equal(H.heileProbeOrdner([{ pfad: join(stray, '_wt-q') }], strayBericht, renameSync).length, 1, 'Gegenprobe: -p wird zurückbenannt')
  mkdirSync(join(stray, '_wt-b-p'))
  mkdirSync(join(stray, '_wt-b'))
  const versucht = []
  H.heileProbeOrdner([{ pfad: join(stray, '_wt-b') }], strayBericht, (von) => versucht.push(von))
  assert.deepEqual(versucht, [], 'Zielname belegt: nicht einmal versucht')
  rmSync(join(wtDir, '_wt-ohne-registrierung-p'), { recursive: true })
  rmSync(join(wtDir, '_wt-beides'), { recursive: true })
  rmSync(join(wtDir, '_wt-beides-p'), { recursive: true })

  // Lose Reste aus Verknüpfungen einen Ordner tief (data/cache) gehen weg, echter Cache im selben Aufbau nicht; die Wächterzeile zählt sie mit.
  const vorher = H.zaehleWt(haupt)
  mkdirSync(join(wtDir, '_wt-lose-datacache', 'data'), { recursive: true })
  symlinkSync(fremdCache, join(wtDir, '_wt-lose-datacache', 'data', 'cache'), 'junction')
  symlinkSync(fremdNm, join(wtDir, '_wt-lose-datacache', 'node_modules'), 'junction')
  mkdirSync(join(wtDir, '_wt-lose-echtcache', 'data', 'cache'), { recursive: true })
  writeFileSync(join(wtDir, '_wt-lose-echtcache', 'data', 'cache', 'k.json'), '{}')
  assert.equal(H.zaehleWt(haupt), vorher + 2, 'lose Ordner zählen mit')
  const loseListe = H.abbau(haupt, { ...welt, jetzt: () => uhr() + 3 * 3600_000 }, true)
  assert.equal(existsSync(join(wtDir, '_wt-lose-datacache')), false, 'Reste weg')
  assert.equal(readFileSync(join(fremdCache, 'roh.json'), 'utf8'), '{}', 'Ziel der Junction unberührt')
  assert.equal(readFileSync(join(fremdNm, 'paket.txt'), 'utf8'), 'p')
  assert.equal(readFileSync(join(wtDir, '_wt-lose-echtcache', 'data', 'cache', 'k.json'), 'utf8'), '{}', 'echter Cache bleibt')
  assert.equal(lose(loseListe, '_wt-lose-echtcache').grund, 'inhalt')

  // Verwaiste Ordner unter _worktrees/<repo>/ (Reste, Probe-Ordner): nur Verknüpfungen (jeder Name) und leere Ordner gehen weg, alles andere bleibt.
  const nachbar = (...teile) => join(wtDir, ...teile)
  mkdirSync(nachbar('_wt-nb-weg', 'data'), { recursive: true })
  mkdirSync(nachbar('_wt-nb-weg', 'leer', 'tief'), { recursive: true })
  symlinkSync(fremdNm, nachbar('_wt-nb-weg', 'node_modules'), 'junction')
  symlinkSync(fremdCache, nachbar('_wt-nb-weg', 'data', 'cache'), 'junction')
  symlinkSync(fremdCache, nachbar('_wt-nb-weg', 'anderer-name'), 'junction')
  mkdirSync(nachbar('_wt-nb-datei'))
  symlinkSync(fremdNm, nachbar('_wt-nb-datei', 'node_modules'), 'junction')
  writeFileSync(nachbar('_wt-nb-datei', 'echt.txt'), 'e')
  mkdirSync(nachbar('_wt-nb-git'))
  symlinkSync(fremdNm, nachbar('_wt-nb-git', 'node_modules'), 'junction')
  writeFileSync(nachbar('_wt-nb-git', '.git'), 'gitdir: x\n')
  writeFileSync(nachbar('_wt-nb.log'), 'log')
  symlinkSync(fremdNm, nachbar('_wt-nb-link'), 'junction')
  g(haupt, 'worktree', 'add', '-b', 'b-nb-reg', nachbar('_wt-nb-reg'), c1)
  symlinkSync(fremdNm, nachbar('_wt-nb-reg', 'node_modules'), 'junction')
  // Tiefe: sechs Ordner übereinander mit Verknüpfung darunter sind noch Rest, bei sieben zählt der nicht mehr gelesene Ordner als Inhalt.
  const tiefe = (name, n) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i)).reduce((pfad, d) => join(pfad, d), nachbar(name))
  mkdirSync(tiefe('_wt-nb-sechs', 6), { recursive: true })
  symlinkSync(fremdNm, join(tiefe('_wt-nb-sechs', 6), 'node_modules'), 'junction')
  mkdirSync(tiefe('_wt-nb-tief', 7), { recursive: true })
  symlinkSync(fremdNm, join(tiefe('_wt-nb-tief', 7), 'node_modules'), 'junction')
  const nbListe = H.abbau(haupt, welt, false)
  assert.deepEqual(['_wt-nb-weg', '_wt-nb-datei', '_wt-nb-git', '_wt-nb.log', '_wt-nb-link', '_wt-nb-tief', '_wt-nb-sechs'].map((n) => lose(nbListe, n).aktion), ['weg', 'behalten', 'behalten', 'behalten', 'behalten', 'behalten', 'weg'])
  assert.deepEqual(['_wt-nb-datei', '_wt-nb-git', '_wt-nb.log', '_wt-nb-link', '_wt-nb-tief'].map((n) => lose(nbListe, n).grund), ['inhalt', 'inhalt', 'kein-ordner', 'kein-ordner', 'inhalt'])
  // Seit 25.10.2026 zählt nur noch _worktrees/<repo>/: alte Orte (im Hauptordner, daneben) werden weder gelistet noch angefasst.
  const altOrte = [join(haupt, '_wt-alt-haupt'), join(wurzel, '_wt-alt-nachbar')]
  for (const p of altOrte) mkdirSync(p)
  const altListe = H.abbau(haupt, welt, false)
  // Fehlt der Ordner unter _worktrees/<repo>/ ganz, gibt es keine losen Ordner und keinen Fehler.
  const echteWurzel = process.env.WT_WURZEL
  process.env.WT_WURZEL = join(wurzel, 'gibt-es-nicht')
  assert.deepEqual([H.abbau(haupt, welt, false).lose, typeof H.zaehleWt(haupt)], [[], 'number'], 'Ordner fehlt')
  process.env.WT_WURZEL = echteWurzel
  const gelistet = (p) => altListe.lose.some((o) => o.pfad.replace(/\\/g, '/') === p.replace(/\\/g, '/'))
  assert.deepEqual(altOrte.map(gelistet), [false, false], 'alte Orte nicht gelistet')
  assert.equal(H.zaehleWt(haupt), readdirSync(wtDir).length, 'Zähler: genau die Ordner unter _worktrees/<repo>/ (nach dem Abbau ist kein registrierter ohne Ordner übrig)')
  // Registriert, aber ohne Ordner: zählt über die Registrierung, nicht über das Verzeichnis (und nur unter _worktrees/<repo>/).
  neu('_wt-zaehl', 'b-zaehl')
  rmSync(join(wtDir, '_wt-zaehl'), { recursive: true })
  assert.equal(H.zaehleWt(haupt), readdirSync(wtDir).length + 1, 'Zähler: registrierter Worktree ohne Ordner')
  g(haupt, 'worktree', 'prune')
  assert.equal(lose(nbListe, '_wt-nb-reg'), undefined, 'registrierter Worktree daneben ist kein loser Ordner')
  assert.equal(existsSync(nachbar('_wt-nb-weg')), true, '--liste ändert nichts')
  // Haupt-Bestand fehlt: Abbruch, nichts wird gelöst.
  renameSync(join(haupt, 'node_modules'), join(haupt, 'node_modules-weg'))
  const ohneNm = H.abbau(haupt, welt, true)
  assert.ok(ohneNm.fehler.some((f) => f.startsWith('Abbruch, Haupt-Bestand fehlt: node_modules') && f.includes('_wt-nb-weg')), 'Abbruch gemeldet')
  assert.equal(lstatSync(nachbar('_wt-nb-weg', 'node_modules')).isSymbolicLink(), true, 'Link bleibt, wenn der Haupt-Bestand fehlt')
  renameSync(join(haupt, 'node_modules-weg'), join(haupt, 'node_modules'))
  renameSync(join(haupt, 'data', 'cache'), join(haupt, 'data', 'cache-weg'))
  const ohneCache = H.abbau(haupt, welt, true)
  assert.ok(ohneCache.fehler.some((f) => f.startsWith('Abbruch, Haupt-Bestand fehlt: data/cache') && f.includes('_wt-nb-weg')))
  assert.equal(lstatSync(nachbar('_wt-nb-weg', 'node_modules')).isSymbolicLink(), true)
  renameSync(join(haupt, 'data', 'cache-weg'), join(haupt, 'data', 'cache'))
  // Verschwindet der Haupt-Bestand erst durch das Lösen, bricht der Lauf ab und meldet es.
  assert.throws(() => H.raeumeLosen(nachbar('_wt-nb-weg'), haupt, (p) => { unlinkSync(p); if (p.endsWith('node_modules')) renameSync(join(haupt, 'node_modules'), join(haupt, 'node_modules-weg')) }), /Haupt-Bestand fehlt/)
  renameSync(join(haupt, 'node_modules-weg'), join(haupt, 'node_modules'))
  // Inhalt neben einer Verknüpfung (nach der Planung dazugekommen): kein Link wird angefasst.
  assert.throws(() => H.raeumeLosen(nachbar('_wt-nb-datei'), haupt), /Inhalt/)
  assert.equal(lstatSync(nachbar('_wt-nb-datei', 'node_modules')).isSymbolicLink(), true, 'Link neben echter Datei bleibt')
  const nbLauf = H.abbau(haupt, welt, true)
  assert.equal(existsSync(nachbar('_wt-nb-weg')), false, 'Nachbar-Ordner samt Links und leeren Ordnern weg')
  for (const bleibt of ['_wt-nb-datei', '_wt-nb-git', '_wt-nb.log', '_wt-nb-link', '_wt-nb-reg']) assert.equal(existsSync(nachbar(bleibt)), true, `${bleibt} bleibt`)
  assert.equal(readFileSync(nachbar('_wt-nb-datei', 'echt.txt'), 'utf8'), 'e')
  assert.equal(readFileSync(join(fremdNm, 'paket.txt'), 'utf8'), 'p', 'Ziel der Links bleibt voll')
  assert.equal(readFileSync(join(fremdCache, 'roh.json'), 'utf8'), '{}')
  assert.equal(readFileSync(join(haupt, 'node_modules', 'haupt.txt'), 'utf8'), 'h', 'Haupt-node_modules unberührt')
  assert.equal(readFileSync(join(haupt, 'data', 'cache', 'haupt.json'), 'utf8'), '{}', 'Haupt-data/cache unberührt')
  assert.equal(nbLauf.entfernt, 1, 'genau _wt-nb-sechs (_wt-nb-weg räumte der Attrappen-Lauf davor ab)')
  assert.equal(existsSync(nachbar('_wt-nb-sechs')), false)
  // Aufräumen der Nachbar-Reste (Links einzeln lösen, nie rekursiv durch einen Link).
  for (const p of [['_wt-nb-datei', 'node_modules'], ['_wt-nb-git', 'node_modules'], ['_wt-nb-link'], ['_wt-nb-reg', 'node_modules'], ]) unlinkSync(nachbar(...p))
  unlinkSync(join(tiefe('_wt-nb-tief', 7), 'node_modules'))

  // Sperre im Vordergrundlauf: gehalten → nichts läuft; frei → während des Laufs gehalten, danach (auch bei Fehler) freigegeben.
  const vSperre = join(wurzel, 'vordergrund.lock')
  const stumm = console.log
  console.log = () => {}
  try {
    let gefragt = 0
    const spaeh = { ...welt, jetzt: () => uhr(), prs: () => { gefragt++; return prs } }
    writeFileSync(vSperre, JSON.stringify({ pid: process.pid, zeit: uhr() }))
    assert.equal(H.abbauImVordergrund(true, { haupt, sperre: vSperre, welt: spaeh }), 0)
    assert.equal(gefragt, 0, 'gesperrt: kein Abbau')
    rmSync(vSperre)
    let waehrend = null
    H.abbauImVordergrund(true, { haupt, sperre: vSperre, welt: { ...spaeh, prs: () => { waehrend = existsSync(vSperre); return prs } } })
    assert.equal(waehrend, true, 'Sperre gehalten')
    assert.equal(existsSync(vSperre), false, 'danach frei')
    assert.throws(() => H.abbauImVordergrund(true, { haupt, sperre: vSperre, welt: { ...spaeh, prs: () => { throw new Error('gh kaputt') } } }))
    assert.equal(existsSync(vSperre), false, 'auch nach Fehler frei')
    H.abbauImVordergrund(false, { haupt, sperre: vSperre, welt: { ...spaeh, prs: () => { waehrend = existsSync(vSperre); return prs } } })
    assert.equal(waehrend, false, 'Liste braucht keine Sperre')
    // H1: die Sperre eines anderen Besitzers bleibt stehen; eine unlesbare Sperre wird nicht überschrieben.
    H.abbauImVordergrund(true, { haupt, sperre: vSperre, welt: { ...spaeh, prs: () => { writeFileSync(vSperre, JSON.stringify({ pid: process.pid + 1, zeit: uhr() })); return prs } } })
    assert.equal(existsSync(vSperre), true, 'fremde Sperre bleibt')
    writeFileSync(vSperre, 'kaputt')
    assert.equal(H.nimmSperre(vSperre, uhr()), false)
    assert.equal(readFileSync(vSperre, 'utf8'), 'kaputt')
    utimesSync(vSperre, 1000, 1000)
    assert.equal(H.nimmSperre(vSperre, uhr()), true, 'unlesbar und alt: übernommen')
    rmSync(vSperre)
  } finally {
    console.log = stumm
  }

  // ---- jüngste Änderung: jede der gemessenen Stellen zählt einzeln -------------------------------------------------------------------
  const fake = join(wurzel, 'fake', '_wt-f')
  const verw = join(wurzel, 'fake-gitdir')
  mkdirSync(join(verw, 'logs'), { recursive: true })
  mkdirSync(fake, { recursive: true })
  writeFileSync(join(fake, '.git'), `gitdir: ${verw}\n`)
  for (const d of [join(fake, 'a'), join(verw, 'index'), join(verw, 'HEAD'), join(verw, 'logs', 'HEAD')]) writeFileSync(d, 'x')
  const alle = [fake, join(fake, '.git'), join(fake, 'a'), join(verw, 'index'), join(verw, 'HEAD'), join(verw, 'logs', 'HEAD')]
  const setzeZeit = (p, sek) => utimesSync(p, sek, sek)
  for (const p of alle) setzeZeit(p, 1000)
  assert.equal(H.juengsteAenderung(fake, haupt), 1000_000)
  for (const p of [fake, join(fake, 'a'), join(verw, 'index'), join(verw, 'HEAD'), join(verw, 'logs', 'HEAD')]) {
    setzeZeit(p, 5000)
    assert.equal(H.juengsteAenderung(fake, haupt), 5000_000, `${p} zählt`)
    setzeZeit(p, 1000)
  }

  // ---- Sperre und Start --------------------------------------------------------------------------------------------------------------
  const sperre = join(wurzel, 'abbau.lock')
  assert.equal(H.nimmSperre(sperre, uhr()), true)
  assert.equal(H.nimmSperre(sperre, uhr()), false, 'zweiter Abbau gesperrt (Besitzer lebt)')
  writeFileSync(sperre, JSON.stringify({ pid: 2147483646, zeit: uhr() }))
  assert.equal(H.nimmSperre(sperre, uhr()), true, 'verwaiste Sperre wird übernommen')
  rmSync(sperre)
  // A3: Zwei Starter sehen dieselbe verwaiste Sperre; der zweite übernimmt zwischen Lesen und Übernehmen des ersten. Nur einer läuft.
  const verwaist = JSON.stringify({ pid: 2147483646, zeit: uhr() })
  writeFileSync(sperre, verwaist)
  let zweiter = null
  const erster = H.nimmSperre(sperre, uhr(), () => { zweiter = H.nimmSperre(sperre, uhr()) })
  assert.deepEqual([erster, zweiter], [false, true], 'genau einer übernimmt')
  assert.equal(JSON.parse(readFileSync(sperre, 'utf8')).pid, process.pid, 'die Sperre des Gewinners bleibt unversehrt')
  assert.deepEqual(readdirSync(wurzel).filter((n) => n.startsWith('abbau.lock.')), [], 'keine Reste')
  rmSync(sperre)
  writeFileSync(sperre, verwaist)
  assert.equal(H.nimmSperre(sperre, uhr(), () => rmSync(sperre)), false, 'Sperre inzwischen weg (anderer Starter fertig): nicht übernehmen')
  assert.equal(existsSync(sperre), false, 'und nichts hinterlassen')
  writeFileSync(sperre, verwaist)
  assert.equal(H.nimmSperre(sperre, uhr(), () => {}), true, 'ohne Rennen übernimmt der einzelne Starter')
  rmSync(sperre)

  const aufrufe = []
  const spawnAttrappe = (prog, args, opt) => { aufrufe.push({ prog, args, opt }); return { status: 0 } }
  const startOpt = { sperre, register: 'REG.mjs', spawn: spawnAttrappe }
  assert.equal(H.starteAbbau(startOpt), 'gestartet')
  assert.equal(aufrufe.length, 1)
  assert.equal(aufrufe[0].args[0], 'REG.mjs')
  assert.equal(aufrufe[0].args[1], 'start')
  assert.equal(aufrufe[0].opt.windowsHide, true, 'unsichtbar')
  assert.equal(aufrufe[0].opt.stdio, 'ignore')
  assert.equal(aufrufe[0].args[aufrufe[0].args.indexOf('--frist-min') + 1], '30', 'mit Frist')
  assert.equal(aufrufe[0].args.at(-1), '--abbau')
  assert.equal(H.starteAbbau({ ...startOpt, spawn: () => ({ status: 1 }) }), 'startfehler')
  writeFileSync(sperre, JSON.stringify({ pid: process.pid, zeit: uhr() }))
  assert.equal(H.starteAbbau(startOpt), 'laeuft-schon')
  assert.equal(aufrufe.length, 1, 'bei Sperre kein Start')
  rmSync(sperre)

  // Hook-Verdrahtung: Merge startet, anderer Befehl nicht; Sitzungsstart startet und meldet > 20 Worktrees.
  const zahl = () => aufrufe.length
  const vor = zahl()
  assert.equal(H.hook({ ...merge, tool_input: { command: 'ls' } }, startOpt), null)
  assert.equal(zahl(), vor)
  assert.equal(H.hook(merge, startOpt), null)
  assert.equal(zahl(), vor + 1, 'Merge startet den Abbau')
  assert.equal(H.hook(sitz, { ...startOpt, haupt }), null, 'wenige Worktrees: keine Zeile')
  assert.equal(zahl(), vor + 2, 'Sitzungsstart startet den Abbau')
  for (let i = 0; i < 18; i++) g(haupt, 'worktree', 'add', '--no-checkout', '-b', `b-viele-${i}`, join(wtDir, `_wt-viele-${i}`), c1)
  const anzahl = g(haupt, 'worktree', 'list', '--porcelain').split('\n').filter((z) => z.startsWith('worktree ')).length - 1
  assert.ok(anzahl > 20, `Vorbereitung: ${anzahl}`)
  assert.match(H.hook(sitz, { ...startOpt, haupt }), /Worktree-Wächter: \d+ Worktrees/)

  // ---- Prozess: stdin-JSON → Register-Aufruf (Attrappe), cwd im Temp-Ordner ---------------------------------------------------------
  const attrappe = join(wurzel, 'register-attrappe.mjs')
  const aus = join(wurzel, 'register-aufruf.json')
  writeFileSync(attrappe, `import { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(aus)}, JSON.stringify(process.argv.slice(2)))\n`)
  const lauf2 = (eingabe) => spawnSync(process.execPath, [join(hooks, 'worktree-aufraeumen.js')], {
    cwd: wurzel,
    input: JSON.stringify(eingabe),
    encoding: 'utf8',
    timeout: 20000,
    env: { ...env, WT_WURZEL: process.env.WT_WURZEL, WT_HAUPT: haupt, WT_REGISTER: attrappe, WT_SPERRE: sperre },
  })
  let r = lauf2({ ...merge, tool_input: { command: 'gh pr view 1' } })
  assert.equal(r.status, 0)
  assert.equal(existsSync(aus), false, 'fremder Befehl startet nichts')
  r = lauf2(merge)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout, '')
  assert.deepEqual(JSON.parse(readFileSync(aus, 'utf8')).slice(0, 2), ['start', '--zweck'])
  rmSync(aus)
  r = lauf2(sitz)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Worktree-Wächter: \d+ Worktrees/)
  assert.equal(existsSync(aus), true)
} finally {
  for (const p of [join(wtDir, '_wt-junction', 'node_modules'), join(wtDir, '_wt-haengt', 'node_modules'), join(wtDir, '_wt-lose-junction', 'node_modules'), join(wtDir, '_wt-lose-inhalt-und-junction', 'node_modules')]) {
    try { rmSync(p, { force: true }) } catch {}
  }
  rmSync(wurzel, { recursive: true, force: true, maxRetries: 3 })
}
console.log('worktree-aufraeumen.test: ok (Entscheidungen, Grenzen 2 h, Attrappen-Repo, Junctions, lose Ordner, Sperre, Auslöser, Wächter, Prozess)')
