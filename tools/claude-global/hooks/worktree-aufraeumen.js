// Worktrees räumen sich selbst ab (Anlass 18.10.2026: 274 `_wt-*`-Worktrees ≈ 3 GB Kernel-Dateicache). Entscheidungen: worktree-aufraeumen-logik.js.
// Zwei Auslöser, beide kehren sofort zurück und starten den Abbau unsichtbar über das Prozess-Register (Frist, Sperre = höchstens ein Abbau):
//   PostToolUse(Bash) nach erfolgreichem `gh pr merge`  und  SessionStart (dort zusätzlich die Wächterzeile bei > 20 Worktrees).
// Entfernt wird nur: sauberer Worktree, HEAD seit vor dem Abschluss unbewegt, Ordner frei (Probe-Umbenennen), keine Änderung in den letzten 2 h, Kopf == headRefOid eines gemergten/geschlossenen PR seit mindestens 24 h (Lesen hinterlässt kein Lebenszeichen), kein offener PR, kein echter data/cache.
// Zweige bleiben. Verknüpfungen (node_modules, data/cache) werden vor dem Entfernen einzeln gelöst, nie rekursiv. Lose `_wt-*`-Ordner:
// im Hauptordner und daneben: nur Verknüpfungen und leere Ordner → weg (Verknüpfung per unlink, vorher/nachher Haupt-node_modules und data/cache da), sonst nur aufgelistet.
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
const RUECK_VERSUCHE = 3
const RUECK_PAUSE_MS = 200
/** Felder der PR-Liste: das Erledigt-Zeichen braucht Kopf und Abschlusszeit. */
const PR_FELDER = 'headRefName,headRefOid,state,mergedAt,closedAt'

const git = (cwd, ...a) => execFileSync('git', ['--no-optional-locks', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim()

/** Neueste Änderungszeit: Ordner, seine obersten Einträge (nicht verfolgt) und Git-Verwaltungsdateien — ohne alle Dateien zu berühren. */
function juengsteAenderung(pfad, haupt) {
  const zeiten = []
  const stat = (p) => { try { zeiten.push(fs.lstatSync(p).mtimeMs) } catch {} }
  stat(pfad)
  for (const n of fs.readdirSync(pfad)) stat(path.join(pfad, n))
  const verwaltung = verwaltungsOrdner(pfad, haupt)
  for (const d of ['index', 'HEAD', 'logs/HEAD']) stat(path.join(verwaltung, d))
  return Math.max(...zeiten)
}

/** Git-Verwaltungsordner des Worktrees (`.git`-Datei, sonst der Standardort unter dem Hauptordner). */
function verwaltungsOrdner(pfad, haupt) {
  let verwaltung = path.join(haupt, '.git', 'worktrees', path.basename(pfad))
  try { verwaltung = fs.readFileSync(path.join(pfad, '.git'), 'utf8').replace(/^gitdir:\s*/, '').trim() } catch {}
  return verwaltung
}

/** Letzte Bewegung von HEAD (Reflog, sonst HEAD-Datei); unlesbar = Infinity, damit der Worktree bleibt. */
function kopfZeit(pfad, haupt) {
  const verwaltung = verwaltungsOrdner(pfad, haupt)
  for (const d of ['logs/HEAD', 'HEAD']) {
    try { return fs.statSync(path.join(verwaltung, d)).mtimeMs } catch {}
  }
  return Infinity
}

/** Alle Verknüpfungen (Junctions/Symlinks) im Worktree-Kopf, unter data/ sowie `<Ordner>/node_modules` — dahinter liegt fremder Bestand. */
function verknuepfungen(pfad) {
  const kandidaten = []
  for (const ordner of [pfad, path.join(pfad, 'data')]) {
    let namen = []
    try { namen = fs.readdirSync(ordner) } catch {}
    for (const n of namen) kandidaten.push(path.join(ordner, n))
  }
  let oberste = []
  try { oberste = fs.readdirSync(pfad) } catch {}
  for (const n of oberste) kandidaten.push(path.join(pfad, n, 'node_modules'))
  return [...new Set(kandidaten)].filter((p) => {
    try { return fs.lstatSync(p).isSymbolicLink() } catch { return false }
  })
}

/** Ist `data/cache` leer, fehlend oder eine Verknüpfung? Echter Inhalt (lokaler Sammlerlauf) ginge mit dem Worktree verloren. */
function cacheLeer(pfad) {
  const cache = path.join(pfad, 'data', 'cache')
  try {
    if (fs.lstatSync(cache).isSymbolicLink()) return true
    return fs.readdirSync(cache).length === 0
  } catch {
    return true
  }
}

/** Löst Verknüpfungen einzeln (unlink, nie rekursiv); false, wenn eine bleibt — dann wird der Worktree nicht angefasst. */
function loeseVerknuepfungen(pfad) {
  for (const p of verknuepfungen(pfad)) {
    try { fs.unlinkSync(p) } catch { return false }
  }
  return verknuepfungen(pfad).length === 0
}

/**
 * Probeweise umbenennen und zurück: unter Windows scheitert das (EPERM/EBUSY), solange ein Prozess dort sein cwd oder eine offene Datei hat.
 * Nur so wird ein halb gelöschter Worktree vermieden. `umbenennen` ist für den Test ersetzbar.
 */
function ordnerFrei(pfad, umbenennen = fs.renameSync, warte = schlafe) {
  const probe = `${pfad}-p`
  try { umbenennen(pfad, probe) } catch { return false }
  for (let versuch = 1; versuch <= RUECK_VERSUCHE; versuch++) {
    try { umbenennen(probe, pfad); return true } catch {}
    if (versuch < RUECK_VERSUCHE) warte(RUECK_PAUSE_MS)
  }
  throw new Error(`Zurückbenennen scheitert: ${pfad} liegt als ${probe}`)
}

function schlafe(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) }

/**
 * Ein früherer Lauf ließ `<pfad>-p` neben einem registrierten Worktree liegen (Rückbenennen scheiterte), egal ob in `haupt` oder daneben:
 * zurückbenennen, solange `<pfad>` fehlt. Scheitert das, Fehlerzeile und kein prune, sonst löst git die Registrierung.
 */
function heileProbeOrdner(worktrees, bericht, umbenennen = fs.renameSync) {
  const geheilt = []
  for (const w of worktrees) {
    const probe = `${w.pfad}-p`
    if (fs.existsSync(w.pfad) || !fs.existsSync(probe)) continue
    try {
      umbenennen(probe, w.pfad)
      geheilt.push(w.pfad)
    } catch {
      bericht.fehler.push(`Heilung scheitert: ${w.pfad} liegt als ${probe}`)
      bericht.pruneAus = true
    }
  }
  return geheilt
}

/** Gesammelte Eingaben der echten Welt; im Test ersetzt. */
function echteWelt(haupt) {
  return {
    prs: () => JSON.parse(execFileSync('gh', ['pr', 'list', '--state', 'all', '--limit', '3000', '--json', PR_FELDER], { cwd: haupt, encoding: 'utf8', windowsHide: true })),
    cacheLeer,
    sauber: (pfad) => { try { return git(pfad, 'status', '--porcelain') === '' } catch { return false } },
    entferne: (pfad) => { git(haupt, 'worktree', 'remove', pfad) },
    loese: loeseVerknuepfungen,
    frei: ordnerFrei,
    umbenennen: fs.renameSync,
    jetzt: () => Date.now(),
  }
}

/** Tiefer als das gilt ein echter Ordner als Inhalt (ohne weiter zu lesen). */
const MAX_TIEFE = 6

/** Eintrag eines losen Ordners (lstat, Verknüpfungen nie verfolgt); echte Unterordner bringen ihre Kinder mit. */
function leseEintrag(p, tiefe = 0) {
  const name = path.basename(p)
  const l = fs.lstatSync(p)
  if (l.isSymbolicLink() || !l.isDirectory() || tiefe >= MAX_TIEFE) return { name, istVerknuepfung: l.isSymbolicLink() }
  return { name, istVerknuepfung: false, kinder: fs.readdirSync(p).map((n) => leseEintrag(path.join(p, n), tiefe + 1)) }
}

/** Einträge unter einem losen Ordner. */
const leseKinder = (pfad) => fs.readdirSync(pfad).map((n) => leseEintrag(path.join(pfad, n)))

/** Bewertung eines losen `_wt-*`-Eintrags: nur ein echter Ordner kommt in Frage (Dateien wie `_wt-x.log` und Verknüpfungen bleiben). */
function bewerteLosenPfad(pfad, haupt, jetzt) {
  try {
    const l = fs.lstatSync(pfad)
    if (l.isSymbolicLink() || !l.isDirectory()) return { aktion: 'behalten', grund: 'kein-ordner' }
    const eintraege = leseKinder(pfad)
    return L.bewerteLosen({ eintraege, jetzt, juengsteAenderungMs: juengsteAenderung(pfad, haupt) })
  } catch { return { aktion: 'behalten', grund: 'unlesbar' } }
}

/** Lose `_wt-*`-Ordner ohne Git-Registrierung im Hauptordner und daneben (dort liegen die meisten Worktrees), mit Bewertung. */
function loseOrdner(haupt, registriert, jetzt) {
  const orte = [haupt, path.dirname(haupt)]
  return orte.flatMap((ort) => fs.readdirSync(ort)
    .filter((n) => n.startsWith('_wt-') && !registriert.has(L.norm(`${ort}/${n}`)))
    .map((name) => ({ pfad: path.join(ort, name), ...bewerteLosenPfad(path.join(ort, name), haupt, jetzt) })))
}

/** Fehlende Haupt-Bestände (`node_modules`, `data/cache`): dann darf keine Verknüpfung mehr gelöst werden. */
function fehlendeBestaende(haupt) {
  return ['node_modules', 'data/cache'].filter((p) => !fs.existsSync(path.join(haupt, p)))
}

/** Löst einen losen Ordner von unten: Verknüpfungen per unlink (nie rekursiv, nie ein Link verfolgt), dann leere Ordner. Wirft bei Inhalt oder fehlendem Haupt-Bestand. */
function raeumeLosen(pfad, haupt, unlink = fs.unlinkSync) {
  if (!L.nurVerknuepfung({ kinder: leseKinder(pfad) })) throw new Error('Inhalt')
  const loesen = (p) => {
    const fehlt = fehlendeBestaende(haupt)
    if (fehlt.length) throw new Error(`Abbruch, Haupt-Bestand fehlt: ${fehlt.join(', ')}`)
    if (fs.lstatSync(p).isSymbolicLink()) { unlink(p); return }
    for (const n of fs.readdirSync(p)) loesen(path.join(p, n))
    fs.rmdirSync(p)
  }
  loesen(pfad)
  const fehlt = fehlendeBestaende(haupt)
  if (fehlt.length) throw new Error(`Haupt-Bestand fehlt nach dem Lösen: ${fehlt.join(', ')}`)
}

/** Planen und (mit `los`) ausführen. Rückgabe: { worktrees: [{pfad, zweig, aktion, grund}], lose: [...] , entfernt, fehler }. */
function abbau(haupt, welt, los) {
  const bericht = { worktrees: [], lose: [], entfernt: 0, fehler: [] }
  const ctx = { haupt, jetzt: welt.jetzt(), prs: welt.prs(), cacheLeer: welt.cacheLeer, sauber: welt.sauber }
  const alle = L.leseWorktrees(git(haupt, 'worktree', 'list', '--porcelain'))
  if (los) heileProbeOrdner(alle, bericht, welt.umbenennen)
  for (const w of alle) {
    const existiert = fs.existsSync(w.pfad)
    const entscheidung = L.entscheide({ ...w, existiert, juengsteAenderungMs: existiert ? juengsteAenderung(w.pfad, haupt) : 0, kopfZeitMs: existiert ? kopfZeit(w.pfad, haupt) : 0 }, ctx)
    bericht.worktrees.push({ pfad: w.pfad, zweig: w.zweig, ...entscheidung })
  }
  bericht.lose = loseOrdner(haupt, new Set(alle.map((w) => L.norm(w.pfad))), ctx.jetzt)
  if (los) vollziehe(haupt, welt, bericht)
  return bericht
}

/** Ein Worktree: erneut prüfen (ein Agent kann nach der Planung geschrieben haben), Verknüpfungen lösen, entfernen, Rest melden. */
function entferneWorktree(welt, w, bericht) {
  let frei = false
  try { frei = welt.frei(w.pfad) } catch (e) {
    // Der Ordner heißt noch `-p`: die Registrierung muss bleiben, sonst verliert git den Worktree.
    bericht.fehler.push(e.message)
    bericht.pruneAus = true
    return
  }
  if (!frei) { bericht.fehler.push(`In Benutzung: ${w.pfad}`); return }
  if (welt.sauber(w.pfad) !== true) { bericht.fehler.push(`Geändert nach der Prüfung: ${w.pfad}`); return }
  if (!welt.loese(w.pfad)) { bericht.fehler.push(`Verknüpfung bleibt: ${w.pfad}`); return }
  try { welt.entferne(w.pfad) } catch { bericht.fehler.push(`Entfernen scheitert: ${w.pfad}`); return }
  // git entfernt Ordner mit nicht gelöster Verknüpfung nicht, meldet aber Erfolg.
  if (fs.existsSync(w.pfad)) bericht.fehler.push(`Rest bleibt: ${w.pfad}`)
  else bericht.entfernt++
}

function vollziehe(haupt, welt, bericht) {
  for (const w of bericht.worktrees.filter((x) => x.aktion === 'weg')) entferneWorktree(welt, w, bericht)
  for (const o of bericht.lose.filter((x) => x.aktion === 'weg')) {
    try {
      raeumeLosen(o.pfad, haupt)
      bericht.entfernt++
    } catch (e) { bericht.fehler.push(`${e.message}: ${o.pfad}`) }
  }
  if (bericht.pruneAus) bericht.fehler.push('prune übersprungen (Ordner nicht zurückbenannt)')
  else git(haupt, 'worktree', 'prune')
}

const lebt = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
function liesRoh(datei) {
  try { return fs.readFileSync(datei, 'utf8') } catch { return null }
}
function liesSperre(datei) {
  try { return JSON.parse(liesRoh(datei)) } catch { return null }
}

/** Eine unlesbare Sperrdatei, die älter ist als jede Abbaufrist, zählt als verwaist (sonst bliebe der Abbau für immer gesperrt). */
function unlesbarUndAlt(datei, jetzt) {
  try { return jetzt - fs.statSync(datei).mtimeMs > L.SPERRE_MAX_MS ? { pid: 0, zeit: 0 } : null } catch { return null }
}

/**
 * Übernimmt eine verwaiste Sperre durch Umbenennen (nur ein Starter gewinnt). Hat ein anderer Starter sie schon ersetzt, steht unter dem Namen
 * dessen frische Sperre: sie wird zurückgelegt und der Aufruf scheitert.
 */
function uebernimmAlte(datei, roh) {
  const beiseite = `${datei}.uebernommen-${process.pid}`
  try { fs.renameSync(datei, beiseite) } catch { return false }
  const nun = liesRoh(beiseite) ?? ''
  fs.rmSync(beiseite, { force: true })
  if (nun === (roh ?? '')) return true
  try { fs.writeFileSync(datei, nun, { flag: 'wx' }) } catch {}
  return false
}

/** Nimmt die Sperre (atomar); false, wenn ein anderer Abbau läuft. Eine verwaiste Sperre wird übernommen. `zwischen` läuft zwischen Lesen und Übernehmen (Test). */
function nimmSperre(datei, jetzt, zwischen = () => {}) {
  fs.mkdirSync(path.dirname(datei), { recursive: true })
  const roh = liesRoh(datei)
  const alt = liesSperre(datei) ?? unlesbarUndAlt(datei, jetzt)
  if (!L.sperreFrei(alt, jetzt, lebt)) return false
  zwischen()
  try {
    if (alt && !uebernimmAlte(datei, roh)) return false
    fs.writeFileSync(datei, JSON.stringify({ pid: process.pid, zeit: jetzt }), { flag: 'wx' })
  } catch {
    return false
  }
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

/** Registrierte `_wt-*`-Worktrees plus lose `_wt-*`-Ordner im Hauptordner (die Reste aus Verknüpfungen zählen mit). */
function zaehleWt(haupt) {
  const pfade = L.leseWorktrees(git(haupt, 'worktree', 'list', '--porcelain')).map((w) => L.norm(w.pfad)).filter(L.istWtName)
  const lose = fs.readdirSync(haupt).filter((n) => n.startsWith('_wt-')).map((n) => L.norm(`${haupt}/${n}`))
  return new Set([...pfade, ...lose]).size
}

function hook(eingabe, optionen = {}) {
  const was = ausloeser(eingabe)
  if (!was) return null
  const zeilen = []
  if (was === 'sitzung') {
    const anzahl = zaehleWt(optionen.haupt ?? HAUPT)
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
    if (los && liesSperre(sperre)?.pid === process.pid) fs.rmSync(sperre, { force: true })
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

module.exports = { PR_FELDER, abbauImVordergrund, vollziehe, abbau, hook, starteAbbau, ausloeser, nimmSperre, echteWelt, juengsteAenderung, loeseVerknuepfungen, verknuepfungen, ordnerFrei, heileProbeOrdner, kopfZeit, zaehleWt, raeumeLosen, fehlendeBestaende, bewerteLosenPfad }
