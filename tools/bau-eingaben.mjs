/**
 * Eingaben des Seitenbaus (17.10.2026): Zwischen dem Bau der PR-Prüfkette und dem Merge schreiben Bestandsbau und Sammler oft nur Dateien
 * unter `data/`, die der Seitenbau gar nicht liest. Der Abdruck (`abdruck`) fasst einen Git-Baum so zusammen, dass genau diese Änderungen ihn
 * nicht verändern: Bei freien Pfaden (`frei`) zählen nur Art und Name, außer der Bau liest sie (`BAU_EINGABEN`); alles andere zählt mit Inhalt.
 * Dazu kommt die Ausgabe des einzigen git-Aufrufs, dessen Ergebnis in die Seite eingeht (`PATCHNOTES_LOG`, Datum der Patch Notes).
 * Gleicher Abdruck heißt: gleiche Ausgabe bis auf `v`/`baum` in `version.json` (belegt an zwei Paaren echter Artefakte, Bericht
 * daniel-zum-abarbeiten/berichte/deploy-daten-schnellweg-2026-10-17.md). Der Deploy liefert dann den geprüften Bau aus (`tools/deploy-aus-build.mjs`).
 *
 * Aufruf im Bau (`package.json`): `node tools/bau-eingaben.mjs "<befehl>"` führt den Befehl mit der Spur (`tools/bau-eingaben-spur.cjs`) aus
 * und schreibt danach `abdruck` in `dist/version.json` — nur, wenn jeder gelesene freie Pfad in `BAU_EINGABEN` steht, jeder Programmstart
 * erlaubt ist (`startErlaubt`) und Git den Baum nennt. Fehlt der Abdruck, baut der Deploy neu.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Pfade, deren Inhalt der Seitenbau nicht liest, solange sie nicht in `BAU_EINGABEN` stehen: Datenquellen, Doku, Listen für Daniel, Umfang-Grenzen (schreibt der Bestandsbau). */
export function frei(pfad) {
  return /^(data|docs|daniel-zum-abarbeiten)\//.test(pfad) || /^[^/]+\.md$/.test(pfad) || pfad === 'tools/umfang-grenzen.json'
}

/** Freie Pfade, die der Seitenbau liest (gemessen per Spur); ein Eintrag mit `/` am Ende gilt für den ganzen Ordner. */
export const BAU_EINGABEN = ['data/cartoon-umzug.json', 'data/kennungen.json', 'data/patchnotes/']

const eingabe = (pfad) => BAU_EINGABEN.some((e) => (e.endsWith('/') ? `${pfad}/`.startsWith(e) : pfad === e))

/** git-Aufruf in `pipeline/lib/patchnotes-datum.ts`: Commit-Zeit jeder hinzugefügten Patch Note, das Datum steht auf der Seite. */
export const PATCHNOTES_LOG = ['log', '--no-renames', '--diff-filter=A', '--name-only', '--format=@%ct', '--', 'data/patchnotes']

/** Abdruck eines Baums aus `git ls-tree -r -z` (Art, Kennung, Pfad; bei freien Pfaden außerhalb der Eingaben nur Art und Pfad) und der Ausgabe von `PATCHNOTES_LOG`. */
export function abdruck(lsTree, patchnotesLog) {
  const hash = createHash('sha1')
  for (const eintrag of lsTree.split('\0')) {
    const pfad = eintrag.slice(eintrag.indexOf('\t') + 1)
    hash.update(frei(pfad) && !eingabe(pfad) ? `${eintrag.split(' ')[0]}\t${pfad}\0` : `${eintrag}\0`)
  }
  hash.update(`\0${patchnotesLog}`)
  return hash.digest('hex')
}

/** Abdruck von HEAD; ein flacher Klon wird wie im Bau (`patchnotes-datum.ts`) vertieft, sonst fehlten Commit-Zeiten. */
export function abdruckAusGit(git) {
  if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') git(['fetch', '--unshallow', '--filter=blob:none', '--quiet', 'origin'])
  return abdruck(git(['ls-tree', '-r', '-z', 'HEAD']), git(PATCHNOTES_LOG))
}

/** Lesefunktionen, die nur Namen liefern: Namen freier Pfade stehen ohnehin im Abdruck. */
const NUR_NAMEN = new Set(['readdirSync', 'readdir', 'opendirSync', 'opendir', 'promises.readdir', 'promises.opendir'])

/** Kopierfunktionen nehmen ganze Ordner, ohne dass die Dateien darin in der Spur erscheinen (natives `cpSync`). */
const KOPIEREN = new Set(['cpSync', 'cp', 'promises.cp'])
/** Wurzel und Ordner, unter denen freie Pfade liegen: ganz kopiert, ist ihr Inhalt gelesen. */
const VORFAHREN_FREIER = new Set(['.', 'data', 'docs', 'daniel-zum-abarbeiten', 'tools'])

/** git-Aufrufe des Baus im Wortlaut (Arbeitsordner Wurzel): Baum für `version.json`, Vertiefen des flachen Klons, `PATCHNOTES_LOG`. */
const GIT_ERLAUBT = [['rev-parse', 'HEAD^{tree}'], ['rev-parse', '--is-shallow-repository'], ['fetch', '--unshallow', '--filter=blob:none', '--quiet', 'origin'], PATCHNOTES_LOG]
/** esbuild-Dienst von Vite und tsx: bekommt Quelltext per stdin, liest selbst keine Dateien (Konfiguration: Test in bau-eingaben.test.mjs). */
const ESBUILD = /(^|[\\/])node_modules[\\/](.+[\\/])?(@esbuild[\\/][\w-]+[\\/](bin[\\/])?esbuild|esbuild[\\/]bin[\\/]esbuild)(\.exe)?$/
const programm = (datei) => datei.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase()

/** Erlaubt sind Node (bekommt die Spur selbst), der esbuild-Dienst, die git-Aufrufe aus `GIT_ERLAUBT` und `net use` (Vite unter Windows). */
export function startErlaubt(start) {
  if (start.shell !== undefined) return start.shell === 'net use'
  if (typeof start.datei !== 'string' || !Array.isArray(start.argv)) return false
  if (programm(start.datei) === 'node') return true
  if (ESBUILD.test(start.datei)) return /^--service=\d+\.\d+\.\d+$/.test(start.argv[0]) && start.argv.slice(1).every((a) => a === '--ping') && start.argv.length <= 2
  const wortlaut = JSON.stringify(start.argv)
  return programm(start.datei) === 'git' && start.cwd === '.' && GIT_ERLAUBT.some((g) => JSON.stringify(g) === wortlaut)
}

/** Unerklärte Spur-Zeilen (`<funktion>\t<pfad>`, `start\t<JSON>`, `binding\t<name>`): berührte freie Pfade außerhalb von `BAU_EINGABEN`, Programmstarts außerhalb von `startErlaubt`, jedes `process.binding`. */
export function unerklaert(zeilen) {
  const inhalt = ([funktion, pfad]) => (frei(pfad) && !eingabe(pfad) && !NUR_NAMEN.has(funktion)) || (KOPIEREN.has(funktion) && VORFAHREN_FREIER.has(pfad))
  const geteilt = zeilen.filter(Boolean).map((z) => [z.slice(0, z.indexOf('\t')), z.slice(z.indexOf('\t') + 1)])
  const offen = geteilt.filter(([art, rest]) => {
    if (art === 'binding') return true
    if (art === 'start') return !startErlaubt(JSON.parse(rest))
    return inhalt([art, rest])
  })
  return [...new Set(offen.map(([art, rest]) => (art === 'start' || art === 'binding' ? `${art} ${rest}` : rest)))].sort()
}

/**
 * Liest die Spur-Dateien `<pid>-<thread>.txt`. Vollständig ist ein Prozess, wenn die letzte Zeile seines Haupt-Threads (`-0`) `ende` ist; Threads
 * schreiben jeden Pfad vor dem Zugriff und brauchen kein eigenes `ende`. `offen` zählt Prozesse ohne `ende` am Schluss (auch bei
 * wiederverwendeter PID) und Threads ohne Haupt-Thread-Datei.
 */
export function liesSpur(ordner) {
  const dateien = new Map(readdirSync(ordner).map((d) => [d, readFileSync(join(ordner, d), 'utf8').split('\n').filter(Boolean)]))
  rmSync(ordner, { recursive: true, force: true })
  const zeilen = [...dateien.values()].flat().filter((z) => z !== 'ende' && z !== 'beginn')
  const prozessFertig = (pid) => dateien.get(`${pid}-0.txt`)?.at(-1) === 'ende'
  const offen = new Set([...dateien.keys()].map((d) => /^(\d+)-\d+\.txt$/.exec(d)?.[1] ?? d).filter((pid) => !prozessFertig(pid)))
  return { zeilen, prozesse: dateien.size, offen: offen.size }
}

/** Befehle, die die Spur trägt: `vite build` und `tsx pipeline/<name>.ts`, mit `&&` verkettet — keine Shell-Programme, die außerhalb der Spur lesen. */
export function befehlErlaubt(befehl) {
  return typeof befehl === 'string' && befehl.split(' && ').every((teil) => teil === 'vite build' || /^tsx pipeline\/[\w-]+\.ts$/.test(teil))
}

/** Führt `befehl` mit Spur aus und ergänzt `abdruck` in `version.json`; Rückgabe: 1, wenn der Befehl scheitert (auch durch ein Signal), sonst 0. */
export function bauMitSpur(befehl, { wurzel, versionDatei, git, log = console.log, starte = spawnSync, befehlPruefen = befehlErlaubt }) {
  const ordner = mkdtempSync(join(tmpdir(), 'bau-spur-'))
  const vorlader = join(wurzel, 'tools', 'bau-eingaben-spur.cjs').replace(/\\/g, '/')
  const env = { ...process.env, BAU_SPUR: ordner, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ${vorlader}`.trim() }
  const lauf = starte(befehl, { cwd: wurzel, env, shell: true, stdio: 'inherit' })
  const spur = liesSpur(ordner)
  if (lauf.status !== 0) return 1
  if (!befehlPruefen(befehl)) {
    log(`::warning::Bau-Befehl außerhalb von befehlErlaubt (tools/bau-eingaben.mjs), Deploy baut neu: ${befehl}`)
    return 0
  }
  if (spur.prozesse === 0 || spur.offen > 0) {
    log(`::warning::Spur unvollständig (${spur.offen} Prozesse ohne Ende, ${spur.prozesse} Spur-Dateien), Deploy baut neu.`)
    return 0
  }
  const offen = unerklaert(spur.zeilen)
  if (offen.length > 0) {
    log(`::warning::Bau liest außerhalb von BAU_EINGABEN oder startet Fremdes (tools/bau-eingaben.mjs), Deploy baut neu: ${offen.join(', ')}`)
    return 0
  }
  let wert = ''
  try {
    wert = abdruckAusGit(git)
  } catch {
    log('Kein Git-Baum: version.json ohne Abdruck, der Deploy baut neu.')
    return 0
  }
  const version = JSON.parse(readFileSync(versionDatei, 'utf8'))
  writeFileSync(versionDatei, JSON.stringify({ ...version, abdruck: wert }))
  log(`Spur: ${spur.zeilen.length} Zugriffe, ${spur.prozesse} Prozesse und Threads, 0 unerklärt, Abdruck ${wert}`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
  const git = (args) => execFileSync('git', args, { cwd: wurzel, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
  process.exitCode = bauMitSpur(process.argv[2], { wurzel, versionDatei: join(wurzel, 'dist', 'version.json'), git })
}
