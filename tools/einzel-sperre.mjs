/**
 * Sperrdatei für Werkzeuge, die nur einmal gleichzeitig laufen dürfen (`bau-vergleich`,
 * `panel-vergleich`): Zwei Läufe teilen sich Worktree-Namen und Ablage und kosten je ein volles
 * `pipeline/build.ts` bzw. `vite build`. Der zweite Aufruf bricht sofort ab (Exit 3) statt zu
 * warten. `bau-vergleich` wartet dagegen der Reihe nach (`wartAufSperre` in `einzel-sperre-schlange.mjs`),
 * weil dort parallele Bauer sich sonst gegenseitig abweisen und Nachzügler die Wartenden überholen.
 *
 * Eine Sperre, deren PID nicht mehr lebt oder inzwischen einem anderen Programm gehört (`exe`), wird übernommen (mit Meldung). Die Absage nennt, wer die Sperre hält
 * (PID, was läuft, von wo) und seit wann (Uhrzeit und „vor N min“): Prüfer warteten am 12.10.2026 10–15 min, ohne zu wissen, worauf.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

/** Programmname des Prozesses `pid` (klein, ohne Pfad), null wenn nicht ermittelbar. Windows: `tasklist` (ohne PowerShell), sonst `ps`. */
function prozessName(pid) {
  try {
    if (process.platform === 'win32') {
      const aus = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
      return /^"([^"]+)"/.exec(aus)?.[1].toLowerCase() ?? null
    }
    const comm = execFileSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
    return basename(comm.trim()).toLowerCase() || null
  } catch {
    return null
  }
}

/**
 * Lebt der Halter noch? Windows vergibt PIDs wieder: Läuft unter der PID ein Prozess mit anderem Programmnamen als dem in der
 * Sperre vermerkten (`exe`), ist sie verwaist. Ohne `exe` (ältere Sperre) oder ohne ermittelbaren Namen zählt allein die PID.
 */
export function lebt(pid, exe, nameVon = prozessName) {
  try {
    process.kill(pid, 0)
  } catch (e) {
    return e.code === 'EPERM' // lebt, gehört aber einem anderen Benutzer
  }
  const name = exe ? nameVon(pid) : null
  return !name || name === exe
}

/** WMI-Zeit (`20261018193512.123456+120`: Ortszeit, Versatz in Minuten) als ms seit 1970, NaN bei anderem Format. */
function wmiZeit(text) {
  const m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)\.(\d{3})\d*([+-]\d+)$/.exec(text)
  if (!m) return NaN
  const [jahr, monat, tag, std, min, sek, ms, versatz] = m.slice(1).map(Number)
  return Date.UTC(jahr, monat - 1, tag, std, min, sek, ms) - versatz * 60_000
}

/** Rohausgabe „PID CreationDate“ je Kindprozess von `pid` (WMI über cscript, Windows). */
function fragKinder(pid) {
  const skript = join(import.meta.dirname, 'prozess-kinder.vbs')
  return execFileSync('cscript', ['//nologo', skript, String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 20_000 })
}

/**
 * Lebt ein Kind von `pid`, das nach `seit` gestartet wurde? Ältere Kinder gehören einem früheren Träger derselben PID
 * (Windows vergibt PIDs wieder und lässt Waisen ihre Eltern-PID). Scheitert die Abfrage, zählt das als nein (mit Warnung).
 */
export function hatJungeKinder(pid, seit, frage = fragKinder) {
  try {
    return frage(pid).split(/\r?\n/).some((zeile) => wmiZeit(zeile.split(' ')[1] ?? '') >= Date.parse(seit))
  } catch (e) {
    console.warn(`Kinder-Suche (WMI) für PID ${pid} fehlgeschlagen, zählt als nein: ${String(e.message).split('\n')[0]}`)
    return false
  }
}

/**
 * Läuft das Kind des Halters (`schwer.mjs`) noch? Unter Windows ist das Kind die Shell; sie stirbt mit dem hart beendeten
 * Halter (libuv-Job), der eigentliche Lauf darunter lebt weiter und trägt ihre PID als Eltern-PID.
 */
export function kindLaeuft(sperre, frage = fragKinder) {
  if (!sperre.kind) return false
  if (lebt(sperre.kind, sperre.kindExe)) return true
  return process.platform === 'win32' && hatJungeKinder(sperre.kind, sperre.seit, frage)
}

function lies(datei) {
  try {
    return JSON.parse(readFileSync(datei, 'utf8'))
  } catch {
    return null // fehlt oder halb geschrieben
  }
}

/** Vorgabe für „wer läuft“: Skript, Argumente und Arbeitsverzeichnis. */
const standardWer = () => `${basename(process.argv[1] ?? 'node')} ${process.argv.slice(2).join(' ')} in ${process.cwd()}`.replace(/\s+/g, ' ')

const vorMin = (seit) => Math.max(0, Math.round((Date.now() - Date.parse(seit)) / 60_000))

/** „PID 1234, seit 2026-…, vor 3 min, <was läuft>“ aus dem Inhalt einer Sperrdatei. */
export function beschreibeHalter(sperre) {
  const was = sperre.wer ? `, ${sperre.wer}` : ''
  return `PID ${sperre.pid}, seit ${sperre.seit}, vor ${vorMin(sperre.seit)} min${was}`
}

/** Inhalt der Sperre `<name>` (null, wenn keine liegt). */
export function liesSperre(name) {
  return lies(join(tmpdir(), `${name}.sperre`))
}

/** Legt die Sperre `<name>` an; `wer` beschreibt den Lauf für Wartende. Liefert null bei Erfolg, sonst den Grund (Text) für die Absage. */
export function nimmSperre(name, wer = standardWer()) {
  const datei = join(tmpdir(), `${name}.sperre`)
  const exe = basename(process.execPath).toLowerCase()
  const eigene = JSON.stringify({ pid: process.pid, exe, seit: new Date().toISOString(), wer })
  for (let versuch = 0; versuch < 2; versuch++) {
    try {
      writeFileSync(datei, eigene, { flag: 'wx' })
      const freigeben = () => rmSync(datei, { force: true })
      process.on('exit', freigeben)
      process.on('SIGINT', () => process.exit(130))
      process.on('SIGTERM', () => process.exit(143))
      return null
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
    }
    const alt = lies(datei)
    if (alt && (lebt(alt.pid, alt.exe) || kindLaeuft(alt))) {
      return `${name} läuft schon (${beschreibeHalter(alt)}) — warten oder die Sperre ${datei} nur löschen, wenn der Prozess nicht echt läuft.`
    }
    console.warn(`${name}: verwaiste Sperre${alt ? ` (PID ${alt.pid}, seit ${alt.seit}, tot)` : ' (unlesbar)'} übernommen.`)
    if (JSON.stringify(lies(datei)) === JSON.stringify(alt)) rmSync(datei, { force: true })
  }
  return `${name}: Sperre ${datei} wurde gleichzeitig neu vergeben — später erneut versuchen.`
}

/**
 * Trägt das Kind des Halters (`schwer.mjs`) in die eigene Sperre ein: Wurde der Halter hart beendet, gilt die Sperre weiter,
 * solange das Kind lebt (sonst liefe es ohne Sperre neben dem nächsten schweren Lauf). `kindExe`: Programmname des Kindes,
 * damit eine wiederverwendete PID nicht als lebend gilt.
 */
export function vermerkeKind(name, kind, kindExe) {
  const datei = join(tmpdir(), `${name}.sperre`)
  const sperre = lies(datei)
  if (sperre?.pid !== process.pid) return
  const entwurf = `${datei}.kind-${process.pid}` // atomar ersetzen: ein halb geschriebenes Lesen gälte als verwaist
  writeFileSync(entwurf, JSON.stringify({ ...sperre, kind, kindExe }))
  renameSync(entwurf, datei)
}

/** Für den Aufruf am Skriptanfang: bei Absage Meldung und Exit 3. */
export function nurEinmalGleichzeitig(name, wer) {
  const grund = nimmSperre(name, wer)
  if (grund) {
    console.error(grund)
    process.exit(3)
  }
}
