/**
 * Löschexperiment für Prüfer: `node tools/loeschexperiment.mjs <pfad…> [--pruefung <npm-skript>…] [--cache]`.
 * Fährt die Prüfungen (Vorgabe: check:pfade, typecheck, check:hooks) einmal als Basis, löscht dann genau die genannten
 * Pfade, fährt sie erneut und vergleicht je Prüfung (gleich / neu rot / neu grün). So zeigt sich, ob ein Leser der Pfade
 * übersehen wurde. Danach stellt `git checkout` genau diese Pfade wieder her (kein `git clean`, nichts anderes).
 * `--cache` legt `data/cache` als Junction auf das des Hauptordners, falls es fehlt (nur lesend benutzen).
 * Die Prüfungen laufen über `node tools/schwer.mjs`. Exit 0 bei vollständigem Lauf, 2 bei Fehlbedienung.
 */
import { spawnSync } from 'node:child_process'
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
  if (git(wurzel, ['status', '--porcelain', '--', ...pfade]).aus.trim()) return 'Die Pfade haben lokale Änderungen; erst committen.'
  return ''
}

function fahre(wurzel, skript) {
  const r = spawnSync(`node tools/schwer.mjs npm run ${skript}`, { cwd: wurzel, encoding: 'utf8', windowsHide: true, shell: true })
  return { code: r.status ?? 1, ende: letzteZeilen(`${r.stdout}\n${r.stderr}`) }
}

function verlinkeCache(wurzel) {
  const gemeinsam = resolve(wurzel, git(wurzel, ['rev-parse', '--git-common-dir']).aus.trim())
  const ziel = join(wurzel, 'data', 'cache')
  const quelle = join(dirname(gemeinsam), 'data', 'cache')
  if (existsSync(ziel) || !existsSync(quelle)) return false
  symlinkSync(quelle, ziel, 'junction')
  return true
}

function loeseLink(pfad) {
  if (lstatSync(pfad).isSymbolicLink()) unlinkSync(pfad) // nur die Verknüpfung, nie den Inhalt
}

/** Basislauf, Löschen, zweiter Lauf, Wiederherstellung (auch bei Fehler); `lauf` ist einspeisbar. */
export function experiment(wurzel, { pfade, pruefungen }, lauf = fahre) {
  const basis = Object.fromEntries(pruefungen.map((p) => [p, lauf(wurzel, p)]))
  for (const p of pfade) rmSync(resolve(wurzel, p), { recursive: true, force: true })
  try {
    const laeufe = Object.fromEntries(pruefungen.map((p) => [p, { basis: basis[p], nach: lauf(wurzel, p) }]))
    return bilanz(laeufe)
  } finally {
    git(wurzel, ['checkout', '--', ...pfade])
  }
}

function main() {
  const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
  const a = liesArgumente(process.argv.slice(2))
  const fehler = pruefePfade(wurzel, a.pfade)
  if (fehler) {
    console.error(`loeschexperiment: ${fehler}`)
    process.exitCode = 2
    return
  }
  const verlinkt = a.cache && verlinkeCache(wurzel)
  try {
    const { zeilen, abweichend } = experiment(wurzel, a)
    for (const z of zeilen) console.log(`${z.urteil.padEnd(18)} ${z.name} (Exit ${z.basis} -> ${z.nach})`)
    const rest = git(wurzel, ['status', '--porcelain', '--', ...a.pfade]).aus.trim()
    console.log(`loeschexperiment: ${zeilen.length} Prüfungen, ${abweichend} abweichend, Pfade ${rest ? `NICHT wiederhergestellt: ${rest}` : 'wiederhergestellt'}.`)
  } finally {
    if (verlinkt) loeseLink(join(wurzel, 'data', 'cache'))
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
