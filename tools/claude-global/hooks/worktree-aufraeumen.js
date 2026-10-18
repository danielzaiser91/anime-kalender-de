// Worktrees räumen sich selbst ab (Anlass 18.10.2026: 274 `_wt-*`-Worktrees ≈ 3 GB Kernel-Dateicache). Entscheidungen: worktree-aufraeumen-logik.js.
// Zwei Auslöser, beide kehren sofort zurück und starten den Abbau unsichtbar über das Prozess-Register (Frist, Sperre = höchstens ein Abbau):
//   PostToolUse(Bash) nach erfolgreichem `gh pr merge`  und  SessionStart (dort zusätzlich die Wächterzeile bei > 20 Worktrees).
// Entfernt wird nur: sauberer Worktree, keine Änderung in den letzten 2 h, PR gemergt/geschlossen oder Kopf in origin/main, kein offener PR.
// Zweige bleiben. Verknüpfungen (node_modules, data/cache) werden vor dem Entfernen einzeln gelöst, nie rekursiv. Lose `_wt-*`-Ordner:
// leer oder nur node_modules-Junction → weg, sonst nur aufgelistet.
// Von Hand:  node worktree-aufraeumen.js --liste   (zeigt Entscheidungen, ändert nichts)   |   --abbau (Abbau im Vordergrund)
// Einträge in ~/.claude/settings.json: siehe docs/wissen/projektregeln-im-detail.md, Punkt „Worktrees räumen sich selbst ab“.
const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const L = require('./worktree-aufraeumen-logik.js')

// Die WT_*-Umgebungswerte gibt es nur für den Prozesstest (Attrappe statt Register, Wegwerf-Repo).
const HAUPT = process.env.WT_HAUPT ?? 'C:/code/ai/anime-kalender-de'
const REGISTER = process.env.WT_REGISTER ?? 'C:/code/ai/__assets/tools/prozess-register.mjs'
const SPERRE = process.env.WT_SPERRE ?? 'C:/code/ai/__assets/prozesse/worktree-aufraeumen.lock'
const FRIST_MIN = 30

const git = (cwd, ...a) => execFileSync('git', ['--no-optional-locks', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim()

/** Neueste Änderungszeit: Ordner, seine obersten Einträge (nicht verfolgt) und Git-Verwaltungsdateien — ohne alle Dateien zu berühren. */
function juengsteAenderung(pfad, haupt) {
  const zeiten = []
  const stat = (p) => { try { zeiten.push(fs.lstatSync(p).mtimeMs) } catch {} }
  stat(pfad)
  for (const n of fs.readdirSync(pfad)) stat(path.join(pfad, n))
  let verwaltung = path.join(haupt, '.git', 'worktrees', path.basename(pfad))
  try { verwaltung = fs.readFileSync(path.join(pfad, '.git'), 'utf8').replace(/^gitdir:\s*/, '').trim() } catch {}
  for (const d of ['index', 'HEAD', 'logs/HEAD']) stat(path.join(verwaltung, d))
  return Math.max(...zeiten)
}

/** Alle Verknüpfungen (Junctions/Symlinks) im Worktree-Kopf und unter data/ — hinter ihnen liegt fremder Bestand. */
function verknuepfungen(pfad) {
  const treffer = []
  for (const ordner of [pfad, path.join(pfad, 'data')]) {
    let namen = []
    try { namen = fs.readdirSync(ordner) } catch {}
    for (const n of namen) {
      const p = path.join(ordner, n)
      try { if (fs.lstatSync(p).isSymbolicLink()) treffer.push(p) } catch {}
    }
  }
  return treffer
}

/** Löst Verknüpfungen einzeln (unlink, nie rekursiv); false, wenn eine bleibt — dann wird der Worktree nicht angefasst. */
function loeseVerknuepfungen(pfad) {
  for (const p of verknuepfungen(pfad)) {
    try { fs.unlinkSync(p) } catch { return false }
  }
  return verknuepfungen(pfad).length === 0
}

/** Gesammelte Eingaben der echten Welt; im Test ersetzt. */
function echteWelt(haupt) {
  return {
    prs: () => JSON.parse(execFileSync('gh', ['pr', 'list', '--state', 'all', '--limit', '1000', '--json', 'headRefName,state'], { cwd: haupt, encoding: 'utf8', windowsHide: true })),
    holeMain: () => git(haupt, 'fetch', 'origin', 'main', '--quiet'),
    inMain: (kopf) => { try { git(haupt, 'merge-base', '--is-ancestor', kopf, 'origin/main'); return true } catch { return false } },
    sauber: (pfad) => { try { return git(pfad, 'status', '--porcelain') === '' } catch { return false } },
    entferne: (pfad) => { git(haupt, 'worktree', 'remove', pfad) },
    loese: loeseVerknuepfungen,
    jetzt: () => Date.now(),
  }
}

/** Lose `_wt-*`-Ordner unter `haupt` ohne Git-Registrierung, mit Bewertung. */
function loseOrdner(haupt, registriert, jetzt) {
  return fs.readdirSync(haupt).filter((n) => n.startsWith('_wt-') && !registriert.has(L.norm(`${haupt}/${n}`))).map((name) => {
    const pfad = path.join(haupt, name)
    let eintraege = []
    try { eintraege = fs.readdirSync(pfad).map((n) => ({ name: n, istVerknuepfung: fs.lstatSync(path.join(pfad, n)).isSymbolicLink() })) } catch { return { pfad, aktion: 'behalten', grund: 'unlesbar' } }
    return { pfad, ...L.bewerteLosen({ eintraege, jetzt, juengsteAenderungMs: juengsteAenderung(pfad, haupt) }) }
  })
}

/** Planen und (mit `los`) ausführen. Rückgabe: { worktrees: [{pfad, zweig, aktion, grund}], lose: [...] , entfernt, fehler }. */
function abbau(haupt, welt, los) {
  const bericht = { worktrees: [], lose: [], entfernt: 0, fehler: [] }
  welt.holeMain()
  const ctx = { haupt, jetzt: welt.jetzt(), prStand: L.prStandKarte(welt.prs()), inMain: welt.inMain, sauber: welt.sauber }
  const alle = L.leseWorktrees(git(haupt, 'worktree', 'list', '--porcelain'))
  for (const w of alle) {
    const existiert = fs.existsSync(w.pfad)
    const entscheidung = L.entscheide({ ...w, existiert, juengsteAenderungMs: existiert ? juengsteAenderung(w.pfad, haupt) : 0 }, ctx)
    bericht.worktrees.push({ pfad: w.pfad, zweig: w.zweig, ...entscheidung })
  }
  bericht.lose = loseOrdner(haupt, new Set(alle.map((w) => L.norm(w.pfad))), ctx.jetzt)
  if (los) vollziehe(haupt, welt, bericht)
  return bericht
}

function vollziehe(haupt, welt, bericht) {
  for (const w of bericht.worktrees.filter((x) => x.aktion === 'weg')) {
    if (!welt.loese(w.pfad)) { bericht.fehler.push(`Verknüpfung bleibt: ${w.pfad}`); continue }
    try { welt.entferne(w.pfad); bericht.entfernt++ } catch { bericht.fehler.push(`Entfernen scheitert: ${w.pfad}`) }
  }
  for (const o of bericht.lose.filter((x) => x.aktion === 'weg')) {
    if (!welt.loese(o.pfad)) { bericht.fehler.push(`Verknüpfung bleibt: ${o.pfad}`); continue }
    try { fs.rmdirSync(o.pfad); bericht.entfernt++ } catch { bericht.fehler.push(`Ordner nicht leer: ${o.pfad}`) }
  }
  git(haupt, 'worktree', 'prune')
}

const lebt = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
function liesSperre(datei) {
  try { return JSON.parse(fs.readFileSync(datei, 'utf8')) } catch { return null }
}

/** Nimmt die Sperre (atomar); false, wenn ein anderer Abbau läuft. Eine verwaiste Sperre wird übernommen. */
function nimmSperre(datei, jetzt) {
  fs.mkdirSync(path.dirname(datei), { recursive: true })
  if (!L.sperreFrei(liesSperre(datei), jetzt, lebt)) return false
  try { fs.rmSync(datei, { force: true }); fs.writeFileSync(datei, JSON.stringify({ pid: process.pid, zeit: jetzt }), { flag: 'wx' }) } catch { return false }
  return true
}

/** Startet den Abbau als eigenen, unsichtbaren Prozess über das Register; kehrt sofort zurück. */
function starteAbbau(optionen = {}) {
  const sperre = optionen.sperre ?? SPERRE
  if (!L.sperreFrei(liesSperre(sperre), Date.now(), lebt)) return 'laeuft-schon'
  const argumente = [optionen.register ?? REGISTER, 'start', '--zweck', 'Worktrees abbauen', '--agent', 'worktree-aufraeumen', '--frist-min', String(FRIST_MIN), '--', process.execPath, __filename, '--abbau']
  const r = (optionen.spawn ?? spawnSync)(process.execPath, argumente, { stdio: 'ignore', windowsHide: true, timeout: 10000 })
  return r.status === 0 ? 'gestartet' : 'startfehler'
}

/** Hook-Eingabe (stdin-JSON) → Aktion: 'merge' | 'sitzung' | null. */
function ausloeser(eingabe) {
  if (eingabe.hook_event_name === 'SessionStart') return 'sitzung'
  const ok = eingabe.hook_event_name === 'PostToolUse' && eingabe.tool_name === 'Bash' && eingabe.tool_response?.interrupted !== true
  return ok && L.istMerge(eingabe.tool_input?.command) ? 'merge' : null
}

function hook(eingabe, optionen = {}) {
  const was = ausloeser(eingabe)
  if (!was) return null
  const zeilen = []
  if (was === 'sitzung') {
    const anzahl = L.leseWorktrees(git(optionen.haupt ?? HAUPT, 'worktree', 'list', '--porcelain')).filter((w) => L.istWtName(w.pfad)).length
    const zeile = L.warnzeile(anzahl)
    if (zeile) zeilen.push(zeile)
  }
  starteAbbau(optionen)
  return zeilen.join('\n') || null
}

function abbauImVordergrund(los, o = {}) {
  const haupt = o.haupt ?? HAUPT
  const sperre = o.sperre ?? SPERRE
  if (los && !nimmSperre(sperre, Date.now())) { console.log('Abbau läuft schon (Sperre)'); return 0 }
  try {
    const b = abbau(haupt, o.welt ?? echteWelt(haupt), los)
    for (const w of [...b.worktrees, ...b.lose]) if (w.aktion !== 'behalten') console.log(w.aktion, w.grund, w.pfad)
    const behalten = [...b.worktrees, ...b.lose].filter((w) => w.aktion === 'behalten' && !['haupt', 'fremd'].includes(w.grund)).length
    console.log(`Abbau ${los ? 'fertig' : '(Liste)'}: entfernt ${b.entfernt}, behalten ${behalten}, Fehler ${b.fehler.length}`)
    for (const f of b.fehler) console.log(f)
  } finally {
    if (los) fs.rmSync(sperre, { force: true })
  }
  return 0
}

function main() {
  if (process.argv.includes('--abbau') || process.argv.includes('--liste')) return abbauImVordergrund(process.argv.includes('--abbau'))
  let eingabe = {}
  try { eingabe = JSON.parse(fs.readFileSync(0, 'utf8')) } catch {}
  try {
    const text = hook(eingabe)
    if (text) console.log(text)
  } catch {}
  return 0
}

if (require.main === module) process.exit(main())

module.exports = { abbauImVordergrund, vollziehe, abbau, hook, starteAbbau, ausloeser, nimmSperre, echteWelt, juengsteAenderung, loeseVerknuepfungen, verknuepfungen }
