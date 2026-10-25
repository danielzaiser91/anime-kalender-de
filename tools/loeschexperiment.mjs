/**
 * Löschexperiment für Prüfer: `node tools/loeschexperiment.mjs <pfad…> [--pruefung <npm-skript>…] [--cache]`.
 * Fährt die Prüfungen (Vorgabe: check:pfade, typecheck, check:hooks) einmal als Basis, löscht dann genau die genannten
 * Pfade, fährt sie erneut und vergleicht je Prüfung (gleich / neu rot / neu grün). So zeigt sich, ob ein Leser der Pfade
 * übersehen wurde. Danach stellt `git checkout` genau diese Pfade wieder her (kein `git clean`, nichts anderes).
 * `--cache` legt `data/cache` als Junction auf das des Hauptordners, falls es fehlt (nur lesend benutzen).
 * Die Prüfungen laufen über `node tools/schwer.mjs`. Exit 0 bei vollständigem Lauf, 2 bei Fehlbedienung.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bilanz, letzteZeilen } from './loeschexperiment-vergleich.mjs'

const VORGABE = ['check:pfade', 'typecheck', 'check:hooks']

export function liesArgumente(argv) {
  const pfade = []
  const pruefungen = []
  let cache = false
  let ziel = pfade
  for (const a of argv) {
    if (a === '--pruefung') ziel = pruefungen
    else if (a === '--cache') cache = true
    else ziel.push(a)
  }
  return { pfade, pruefungen: pruefungen.length ? pruefungen : VORGABE, cache }
}

function git(wurzel, args) {
  const r = spawnSync('git', args, { cwd: wurzel, encoding: 'utf8', windowsHide: true })
  return { code: r.status ?? 1, aus: r.stdout ?? '' }
}

/** Fehlertext, wenn die Pfade nicht sauber löschbar sind (außerhalb, nicht getrackt oder mit lokalen Änderungen). */
export function pruefePfade(wurzel, pfade) {
  if (!pfade.length) return 'Kein Pfad genannt.'
  for (const p of pfade) {
    const rel = relative(wurzel, resolve(wurzel, p))
    if (rel.startsWith('..') || isAbsolute(rel)) return `${p} liegt außerhalb des Repos.`
    if (!git(wurzel, ['ls-files', '--', rel]).aus.trim()) return `${p} ist nicht in git getrackt (Wiederherstellung wäre unmöglich).`
  }
  // skip-worktree (S) und assume-unchanged (Kleinbuchstabe) verbergen lokale Änderungen vor `status`; `checkout` würde sie verwerfen.
  if (/^[a-zS]/m.test(git(wurzel, ['ls-files', '-v', '--', ...pfade]).aus)) return 'Die Pfade enthalten skip-worktree- oder assume-unchanged-Dateien; erst zurücksetzen.'
  if (git(wurzel, ['status', '--porcelain', '--ignored', '--', ...pfade]).aus.trim()) return 'Die Pfade haben lokale oder ignorierte Dateien (git stellt sie nicht her); erst bereinigen.'
  return ''
}

/** Eine Prüfung als Kindprozess (asynchron, damit Strg-C die Wiederherstellung auslösen kann). Ohne Frist: Strg-C ist der Ausweg (betrieb.md). */
export function fahre(wurzel, skript) {
  if (!/^[\w:.-]+$/.test(skript)) throw new Error(`Ungültiger Skriptname: ${skript}`)
  return new Promise((fertig) => {
    let aus = ''
    const kind = spawn(`node tools/schwer.mjs npm run ${skript}`, { cwd: wurzel, windowsHide: true, shell: true })
    kind.stdout.on('data', (d) => (aus += d))
    kind.stderr.on('data', (d) => (aus += d))
    kind.once('exit', (code) => fertig({ code: code ?? 1, ende: letzteZeilen(aus) }))
  })
}

export function verlinkeCache(wurzel) {
  const gemeinsam = resolve(wurzel, git(wurzel, ['rev-parse', '--git-common-dir']).aus.trim())
  const ziel = join(wurzel, 'data', 'cache')
  const quelle = join(dirname(gemeinsam), 'data', 'cache')
  if (existsSync(ziel) || !existsSync(quelle)) return false
  symlinkSync(quelle, ziel, 'junction')
  return true
}

/** Löst nur die Verknüpfung, nie den Inhalt; fehlt der Pfad (mit `data` gelöscht und ohne cache wiederhergestellt), tut sie nichts. */
export function loeseLink(pfad) {
  let status
  try {
    status = lstatSync(pfad)
  } catch {
    return
  }
  if (status.isSymbolicLink()) unlinkSync(pfad)
}

/** Stellt die Pfade wieder her und löst die Cache-Verknüpfung (Ende und Abbruch gehen denselben Weg). */
export function raeumeAuf(wurzel, pfade, cacheLink) {
  try {
    stelleWieder(wurzel, pfade)
  } finally {
    if (cacheLink) loeseLink(join(wurzel, 'data', 'cache'))
  }
}

/** Hängt das Aufräumen an Abbruchsignale; `beende` ist einspeisbar (Exit 130). */
export function haengeAbbruchAn(quelle, raeume, beende) {
  for (const sig of ['SIGINT', 'SIGTERM']) {
    quelle.once(sig, () => {
      raeume()
      beende(130)
    })
  }
}

export function schlusszeile(anzahl, abweichend, rest) {
  return `loeschexperiment: ${anzahl} Prüfungen, ${abweichend} abweichend, Pfade ${rest ? `NICHT wiederhergestellt: ${rest}` : 'wiederhergestellt'}.`
}

/** Basislauf, Löschen, zweiter Lauf, Wiederherstellung (auch bei Fehler); `lauf` ist einspeisbar. */
export async function experiment(wurzel, { pfade, pruefungen }, lauf = fahre) {
  const fahreAlle = async () => {
    const erg = {}
    for (const p of pruefungen) erg[p] = await lauf(wurzel, p)
    return erg
  }
  const basis = await fahreAlle()
  try {
    for (const p of pfade) rmSync(resolve(wurzel, p), { recursive: true, force: true })
    const nach = await fahreAlle()
    return bilanz(Object.fromEntries(pruefungen.map((p) => [p, { basis: basis[p], nach: nach[p] }])))
  } finally {
    stelleWieder(wurzel, pfade)
  }
}

/** `git checkout` je Pfad (ein unbekannter Pfad bricht sonst alle ab); Fehlschläge werden gesammelt und laut gemeldet. */
export function stelleWieder(wurzel, pfade) {
  const gescheitert = pfade.filter((p) => git(wurzel, ['checkout', '--', p]).code !== 0)
  if (gescheitert.length) throw new Error(`Wiederherstellung gescheitert: ${gescheitert.join(' ')}`)
}

async function main() {
  const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
  const a = liesArgumente(process.argv.slice(2))
  const fehler = pruefePfade(wurzel, a.pfade)
  if (fehler) {
    console.error(`loeschexperiment: ${fehler}`)
    process.exitCode = 2
    return
  }
  const verlinkt = a.cache && verlinkeCache(wurzel)
  haengeAbbruchAn(process, () => raeumeAuf(wurzel, a.pfade, verlinkt), (code) => process.exit(code))
  try {
    const { zeilen, abweichend } = await experiment(wurzel, a)
    for (const z of zeilen) console.log(`${z.urteil.padEnd(18)} ${z.name} (Exit ${z.basis} -> ${z.nach})`)
    const rest = git(wurzel, ['status', '--porcelain', '--ignored', '--', ...a.pfade]).aus.trim()
    console.log(schlusszeile(zeilen.length, abweichend, rest))
  } finally {
    if (verlinkt) loeseLink(join(wurzel, 'data', 'cache'))
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
