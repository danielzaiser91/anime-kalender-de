/**
 * Test für `tools/claude-global/hooks/worktree-aufraeumen.js` (+ `-logik.js`): Entscheidungen, Abbau auf einem Attrappen-Repo im Temp-Ordner
 * (nie das echte Repo, nie cwd = Repo), Sperre, Auslöser, Wächterzeile und Prozess-Verdrahtung (Attrappe statt Prozess-Register).
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const hooks = join(import.meta.dirname, 'claude-global', 'hooks')
const req = createRequire(import.meta.url)
const L = req(join(hooks, 'worktree-aufraeumen-logik.js'))
const H = req(join(hooks, 'worktree-aufraeumen.js'))
const SCHON = L.SCHONFRIST_MS

// ---- reine Entscheidungen -------------------------------------------------------------------------------------------------------------
const JETZT = 1_000_000_000_000
const ctxBasis = { haupt: 'C:/x/haupt', jetzt: JETZT, prStand: new Map(), inMain: () => false, sauber: () => true }
const wt = (extra = {}) => ({ pfad: 'C:/x/haupt/_wt-a', zweig: 'z', kopf: 'k', existiert: true, juengsteAenderungMs: JETZT - SCHON - 1, ...extra })
const e = (w, c = {}) => L.entscheide(w, { ...ctxBasis, ...c })
const mit = (zweig, stand) => ({ prStand: new Map([[zweig, stand]]) })

assert.deepEqual(e(wt(), mit('z', 'MERGED')), { aktion: 'weg', grund: 'pr-merged' })
assert.deepEqual(e(wt(), mit('z', 'CLOSED')), { aktion: 'weg', grund: 'pr-closed' })
assert.deepEqual(e(wt(), { inMain: () => true }), { aktion: 'weg', grund: 'in-main' })
assert.equal(e(wt(), mit('z', 'OPEN')).grund, 'pr-offen')
assert.equal(e(wt(), { prStand: new Map([['z', 'OPEN']]), inMain: () => true }).aktion, 'behalten', 'offener PR schlägt „Kopf in main“')
assert.equal(e(wt()).grund, 'ohne-pr', 'ohne PR und nicht in main bleibt')
assert.equal(e(wt({ zweig: null })).grund, 'ohne-pr')
assert.equal(e(wt({ pfad: 'C:/x/haupt' })).grund, 'haupt', 'Hauptordner nie')
assert.equal(e(wt({ pfad: 'C:\\X\\Haupt\\' }), { inMain: () => true }).grund, 'haupt', 'Schreibweise egal')
assert.equal(e(wt({ pfad: 'C:/x/haupt/anderer' }), { inMain: () => true }).grund, 'fremd', 'nur _wt-Ordner')
assert.equal(e(wt({ pfad: 'C:/x/haupt/x_wt-a' }), { inMain: () => true }).grund, 'fremd')
assert.deepEqual(e(wt({ existiert: false })), { aktion: 'prune', grund: 'ordner-fehlt' })
assert.equal(e(wt({ juengsteAenderungMs: JETZT - SCHON + 1 }), mit('z', 'MERGED')).grund, 'jung', 'eine Millisekunde unter 2 h')
assert.equal(e(wt({ juengsteAenderungMs: JETZT - SCHON }), mit('z', 'MERGED')).aktion, 'weg', 'genau 2 h')
assert.equal(e(wt({ juengsteAenderungMs: JETZT }), mit('z', 'MERGED')).grund, 'jung')
assert.equal(e(wt(), { ...mit('z', 'MERGED'), sauber: () => false }).grund, 'geaendert')
assert.equal(e(wt(), { ...mit('z', 'MERGED'), sauber: () => undefined }).grund, 'geaendert', 'unbekannt zählt als geändert')
const fragen = []
e(wt(), { ...mit('z', 'OPEN'), sauber: (p) => fragen.push(p) })
e(wt({ juengsteAenderungMs: JETZT }), { ...mit('z', 'MERGED'), sauber: (p) => fragen.push(p) })
assert.equal(fragen.length, 0, 'git status nur für Kandidaten zum Entfernen')

const losEintrag = (eintraege, alter = SCHON) => L.bewerteLosen({ eintraege, jetzt: JETZT, juengsteAenderungMs: JETZT - alter })
assert.deepEqual(losEintrag([]), { aktion: 'weg', grund: 'leer' })
assert.deepEqual(losEintrag([{ name: 'node_modules', istVerknuepfung: true }]), { aktion: 'weg', grund: 'nur-junction' })
assert.equal(losEintrag([{ name: 'node_modules', istVerknuepfung: false }]).aktion, 'behalten', 'echter node_modules-Ordner bleibt')
assert.equal(losEintrag([{ name: 'andere', istVerknuepfung: true }]).aktion, 'behalten')
assert.equal(losEintrag([{ name: 'node_modules', istVerknuepfung: true }, { name: 'x', istVerknuepfung: false }]).aktion, 'behalten')
assert.equal(losEintrag([], SCHON - 1).grund, 'jung')

assert.equal(SCHON, 2 * 60 * 60 * 1000, 'Schonfrist ist 2 h')
assert.equal(L.prStandKarte([{ headRefName: 'z', state: 'MERGED' }, { headRefName: 'z', state: 'OPEN' }]).get('z'), 'OPEN', 'offen gewinnt, egal in welcher Reihenfolge')
assert.equal(L.prStandKarte([{ headRefName: 'z', state: 'OPEN' }, { headRefName: 'z', state: 'MERGED' }]).get('z'), 'OPEN')
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

// ---- Attrappen-Repo ---------------------------------------------------------------------------------------------------------------------
const wurzel = mkdtempSync(join(tmpdir(), 'wt-aufraeumen-'))
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' }
const g = (cwd, ...a) => execFileSync('git', a, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim()
const origin = join(wurzel, 'origin.git')
const haupt = join(wurzel, 'haupt').replace(/\\/g, '/')
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

  const neu = (name, zweig, mitCommit = false) => {
    g(haupt, 'worktree', 'add', '-b', zweig, join(haupt, name), c1)
    if (mitCommit) {
      writeFileSync(join(haupt, name, 'neu.txt'), zweig)
      g(join(haupt, name), 'add', 'neu.txt')
      g(join(haupt, name), 'commit', '-m', zweig)
    }
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
  writeFileSync(join(haupt, '_wt-dirty', 'data', 'a.txt'), 'geändert\n')
  writeFileSync(join(haupt, '_wt-untracked', 'agent-notiz.txt'), 'wichtig\n')
  mkdirSync(fremdNm)
  writeFileSync(join(fremdNm, 'paket.txt'), 'p')
  mkdirSync(fremdCache)
  writeFileSync(join(fremdCache, 'roh.json'), '{}')
  symlinkSync(fremdNm, join(haupt, '_wt-junction', 'node_modules'), 'junction')
  symlinkSync(fremdCache, join(haupt, '_wt-junction', 'data', 'cache'), 'junction')
  rmSync(join(haupt, '_wt-weg-ordner'), { recursive: true })
  // lose Ordner
  mkdirSync(join(haupt, '_wt-lose-leer'))
  mkdirSync(join(haupt, '_wt-lose-junction'))
  symlinkSync(fremdNm, join(haupt, '_wt-lose-junction', 'node_modules'), 'junction')
  mkdirSync(join(haupt, '_wt-lose-inhalt'))
  writeFileSync(join(haupt, '_wt-lose-inhalt', 'x.txt'), 'x')
  mkdirSync(join(haupt, '_wt-lose-inhalt-und-junction'))
  symlinkSync(fremdNm, join(haupt, '_wt-lose-inhalt-und-junction', 'node_modules'), 'junction')
  writeFileSync(join(haupt, '_wt-lose-inhalt-und-junction', 'x.txt'), 'x')

  const prs = [
    { headRefName: 'b-gemergt', state: 'MERGED' },
    { headRefName: 'b-geschlossen', state: 'CLOSED' },
    { headRefName: 'b-offen', state: 'OPEN' },
    { headRefName: 'b-offen-inmain', state: 'OPEN' },
    { headRefName: 'b-offen-inmain', state: 'MERGED' },
    { headRefName: 'b-dirty', state: 'MERGED' },
    { headRefName: 'b-untracked', state: 'MERGED' },
    { headRefName: 'b-junction', state: 'MERGED' },
  ]
  let jetzt = Date.now() + 3 * 3600_000
  const entfernt = []
  // Die echten Adapter (git fetch, merge-base, status, worktree remove) laufen gegen das Attrappen-Repo; nur gh und die Uhr sind ersetzt.
  const echt = H.echteWelt(haupt)
  const welt = { ...echt, prs: () => prs, jetzt: () => jetzt, entferne: (pfad) => { entfernt.push(pfad); echt.entferne(pfad) } }
  const grund = (b, name) => b.worktrees.find((w) => w.pfad.endsWith(`/${name}`))
  const lose = (b, name) => b.lose.find((w) => w.pfad.replace(/\\/g, '/').endsWith(`/${name}`))

  // Liste ändert nichts.
  const liste = H.abbau(haupt, welt, false)
  assert.equal(entfernt.length, 0)
  assert.equal(existsSync(join(haupt, '_wt-gemergt')), true)
  const erwartet = {
    '_wt-gemergt': ['weg', 'pr-merged'],
    '_wt-geschlossen': ['weg', 'pr-closed'],
    '_wt-offen': ['behalten', 'pr-offen'],
    '_wt-offen-inmain': ['behalten', 'pr-offen'],
    '_wt-inmain': ['weg', 'in-main'],
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
  jetzt = Date.now()
  const frisch = H.abbau(haupt, welt, true)
  assert.equal(frisch.entfernt, 0, 'alles unter 2 h bleibt')
  assert.equal(grund(frisch, '_wt-gemergt').grund, 'jung')
  assert.equal(lose(frisch, '_wt-lose-leer').grund, 'jung')
  assert.equal(existsSync(join(haupt, '_wt-lose-leer')), true)

  // Abbau.
  jetzt = Date.now() + 3 * 3600_000
  const b = H.abbau(haupt, welt, true)
  assert.deepEqual(b.fehler, [])
  assert.deepEqual(entfernt.map((p) => p.replace(/^.*\/(_wt-[^/]+)$/, '$1')).sort(), ['_wt-geschlossen', '_wt-gemergt', '_wt-inmain', '_wt-junction'].sort())
  for (const weg of ['_wt-gemergt', '_wt-geschlossen', '_wt-inmain', '_wt-junction', '_wt-lose-leer', '_wt-lose-junction']) assert.equal(existsSync(join(haupt, weg)), false, `${weg} weg`)
  for (const bleibt of ['_wt-offen', '_wt-offen-inmain', '_wt-ohnepr', '_wt-dirty', '_wt-untracked', '_wt-lose-inhalt', '_wt-lose-inhalt-und-junction']) assert.equal(existsSync(join(haupt, bleibt)), true, `${bleibt} bleibt`)
  assert.equal(readFileSync(join(haupt, '_wt-untracked', 'agent-notiz.txt'), 'utf8'), 'wichtig\n')
  assert.equal(readFileSync(join(haupt, '_wt-dirty', 'data', 'a.txt'), 'utf8'), 'geändert\n')
  assert.equal(readFileSync(join(fremdNm, 'paket.txt'), 'utf8'), 'p', 'node_modules des Hauptordners unberührt (Junction nie rekursiv)')
  assert.equal(readFileSync(join(fremdCache, 'roh.json'), 'utf8'), '{}', 'data/cache unberührt')
  assert.ok(existsSync(join(haupt, '.git')) && existsSync(join(haupt, 'data', 'a.txt')), 'Hauptordner unberührt')
  assert.equal(readFileSync(join(haupt, '_wt-lose-inhalt', 'x.txt'), 'utf8'), 'x')
  assert.ok(existsSync(join(haupt, '_wt-lose-inhalt-und-junction', 'node_modules')), 'Junction im Ordner mit Inhalt bleibt')
  const zweige = g(haupt, 'branch', '--list').split('\n').map((z) => z.replace(/^[*+]?\s+/, ''))
  for (const z of ['b-gemergt', 'b-geschlossen', 'b-inmain', 'b-junction', 'b-weg-ordner', 'b-offen', 'b-dirty']) assert.ok(zweige.includes(z), `Zweig ${z} bleibt`)
  assert.equal(g(haupt, 'worktree', 'list').includes('_wt-weg-ordner'), false, 'prune räumt die Registrierung')

  // Eine Verknüpfung, die sich nicht lösen lässt, hält den Worktree zurück.
  neu('_wt-haengt', 'b-haengt', true)
  symlinkSync(fremdNm, join(haupt, '_wt-haengt', 'node_modules'), 'junction')
  prs.push({ headRefName: 'b-haengt', state: 'MERGED' })
  const haengt = H.abbau(haupt, { ...welt, loese: () => false }, true)
  assert.equal(grund(haengt, '_wt-haengt').aktion, 'weg')
  assert.equal(haengt.fehler.filter((f) => f.includes('_wt-haengt')).length, 1)
  assert.equal(existsSync(join(haupt, '_wt-haengt')), true, 'Worktree mit hängender Verknüpfung bleibt')
  assert.equal(entfernt.some((p) => p.endsWith('_wt-haengt')), false)
  assert.equal(H.verknuepfungen(join(haupt, '_wt-haengt')).length, 1)
  assert.equal(H.loeseVerknuepfungen(join(haupt, '_wt-haengt')), true)
  assert.equal(H.verknuepfungen(join(haupt, '_wt-haengt')).length, 0)
  assert.equal(readFileSync(join(fremdNm, 'paket.txt'), 'utf8'), 'p')

  // Nicht-leerer loser Ordner und zwischenzeitlich verändertes Worktree: nichts wird erzwungen.
  const nichtLeer = { worktrees: [], lose: [{ pfad: join(haupt, '_wt-lose-inhalt'), aktion: 'weg' }], fehler: [], entfernt: 0 }
  H.vollziehe(haupt, welt, nichtLeer)
  assert.equal(nichtLeer.fehler.length, 1)
  assert.equal(readFileSync(join(haupt, '_wt-lose-inhalt', 'x.txt'), 'utf8'), 'x', 'rmdir, nie rekursiv')
  const beiRennen = H.abbau(haupt, { ...welt, sauber: () => true }, true)
  assert.equal(beiRennen.fehler.filter((f) => f.includes('_wt-dirty') || f.includes('_wt-untracked')).length, 2, 'ohne --force: Entfernen scheitert')
  assert.equal(readFileSync(join(haupt, '_wt-untracked', 'agent-notiz.txt'), 'utf8'), 'wichtig\n')
  assert.equal(readFileSync(join(haupt, '_wt-dirty', 'data', 'a.txt'), 'utf8'), 'geändert\n')

  // Sperre im Vordergrundlauf: gehalten → nichts läuft; frei → während des Laufs gehalten, danach (auch bei Fehler) freigegeben.
  const vSperre = join(wurzel, 'vordergrund.lock')
  const stumm = console.log
  console.log = () => {}
  try {
    let gefragt = 0
    const spaeh = { ...welt, jetzt: () => Date.now(), prs: () => { gefragt++; return prs } }
    writeFileSync(vSperre, JSON.stringify({ pid: process.pid, zeit: Date.now() }))
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
  assert.equal(H.nimmSperre(sperre, Date.now()), true)
  assert.equal(H.nimmSperre(sperre, Date.now()), false, 'zweiter Abbau gesperrt (Besitzer lebt)')
  writeFileSync(sperre, JSON.stringify({ pid: 2147483646, zeit: Date.now() }))
  assert.equal(H.nimmSperre(sperre, Date.now()), true, 'verwaiste Sperre wird übernommen')
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
  writeFileSync(sperre, JSON.stringify({ pid: process.pid, zeit: Date.now() }))
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
  for (let i = 0; i < 18; i++) g(haupt, 'worktree', 'add', '--no-checkout', '-b', `b-viele-${i}`, join(haupt, `_wt-viele-${i}`), c1)
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
    env: { ...env, WT_HAUPT: haupt, WT_REGISTER: attrappe, WT_SPERRE: sperre },
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
  for (const p of [join(haupt, '_wt-junction', 'node_modules'), join(haupt, '_wt-haengt', 'node_modules'), join(haupt, '_wt-lose-junction', 'node_modules'), join(haupt, '_wt-lose-inhalt-und-junction', 'node_modules')]) {
    try { rmSync(p, { force: true }) } catch {}
  }
  rmSync(wurzel, { recursive: true, force: true, maxRetries: 3 })
}
console.log('worktree-aufraeumen.test: ok (Entscheidungen, Grenzen 2 h, Attrappen-Repo, Junctions, lose Ordner, Sperre, Auslöser, Wächter, Prozess)')
