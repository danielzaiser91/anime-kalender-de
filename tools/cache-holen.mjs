#!/usr/bin/env node
/**
 * Holt den aktuellen `data/cache/` der Läufe in den eigenen Arbeitsbaum, damit ein lokaler Bau
 * (`pipeline/build.ts`) nicht am Titelschwund-Riegel scheitert.
 *
 * Der Ordner liegt nur im Actions-Cache `anilist-cache-*`, und den kann niemand außerhalb eines
 * Laufs laden. Deshalb legt der Workflow `cache-ablegen.yml` (nur auf Abruf) ihn als Artefakt
 * `data-cache` ab (docs/wissen/betrieb.md, „Lokaler Bau"). Dieses Werkzeug lädt das jüngste; ist
 * keins jünger als 24 h da, stößt es den Workflow an und wartet auf sein Ende.
 *
 * Aufruf (im Arbeitsbaum, in dem gebaut wird):
 *   node tools/cache-holen.mjs [--ziel <ordner>] [--name <artefakt>] [--max-alter <stunden>]
 * Vorgabe: Ziel = data/cache dieses Arbeitsbaums, Artefakt = data-cache, 24 Stunden. Vorhandene
 * Dateien, die nicht im Artefakt stehen, bleiben liegen. Exit 0 = geholt, 1 = Fehler.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const REPO = 'danielzaiser91/anime-kalender-de'
const KATALOG = 'anilist-katalog.json'

const arg = (name, vorgabe) => {
  const i = process.argv.indexOf(name)
  return i < 0 ? vorgabe : process.argv[i + 1]
}

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 8 << 20 })

const stundenSeit = (iso) => (Date.now() - Date.parse(iso)) / 3_600_000

const alterText = (iso) => {
  const stunden = stundenSeit(iso)
  return `${iso.slice(0, 16).replace('T', ' ')} UTC, vor ${stunden < 48 ? `${stunden.toFixed(1)} h` : `${(stunden / 24).toFixed(1)} Tagen`}`
}

const warten = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** Stand des Katalogs (`geholtAm`, sonst Änderungszeit) — die Datei, an der ein alter Cache auffällt. */
function katalogStand(ordner) {
  const datei = join(ordner, KATALOG)
  if (!existsSync(datei)) return 'nicht vorhanden'
  const roh = readFileSync(datei, 'utf8').slice(0, 200)
  const iso = /"geholtAm":\s*"([^"]+)"/.exec(roh)?.[1] ?? statSync(datei).mtime.toISOString()
  return alterText(iso)
}

/** Jüngstes nicht abgelaufenes Artefakt dieses Namens samt Lauf-Kennung, sonst null. */
function juengstesArtefakt(name) {
  const antwort = gh('api', `repos/${REPO}/actions/artifacts?name=${encodeURIComponent(name)}&per_page=10`)
  const a = JSON.parse(antwort).artifacts.find((x) => !x.expired)
  return a ? { lauf: a.workflow_run.id, angelegt: a.created_at, mb: Math.round(a.size_in_bytes / 1048576) } : null
}

/** Stößt `cache-ablegen.yml` an und wartet auf sein Ende; scheitert, wenn die Datei nicht auf main liegt. */
function ablegenAnstossen() {
  const start = Date.now() - 5000
  console.log('Kein Artefakt jünger als die Frist — stoße cache-ablegen.yml an …')
  gh('workflow', 'run', 'cache-ablegen.yml', '--repo', REPO)
  for (let i = 0; i < 12; i++) {
    const laeufe = JSON.parse(gh('run', 'list', '--repo', REPO, '--workflow', 'cache-ablegen.yml', '--limit', '3', '--json', 'databaseId,createdAt'))
    const neu = laeufe.find((l) => Date.parse(l.createdAt) >= start)
    if (neu) {
      execFileSync('gh', ['run', 'watch', String(neu.databaseId), '--repo', REPO, '--exit-status'], { stdio: 'inherit' })
      return
    }
    warten(5000)
  }
  throw new Error('Der angestoßene Lauf von cache-ablegen.yml erschien nicht in der Laufliste.')
}

/** Das Artefakt, jünger als `maxStunden` — vorhanden oder frisch erzeugt. */
function frischesArtefakt(name, maxStunden) {
  const ist = juengstesArtefakt(name)
  if (ist && stundenSeit(ist.angelegt) <= maxStunden) return ist
  ablegenAnstossen()
  const neu = juengstesArtefakt(name)
  if (!neu) throw new Error(`Artefakt „${name}" fehlt auch nach dem Lauf (docs/wissen/betrieb.md, „Lokaler Bau").`)
  return neu
}

/** Ein Junction/Symlink als Ziel würde den Cache eines anderen Arbeitsbaums überschreiben. */
function zielPruefen(ziel) {
  if (existsSync(ziel) && lstatSync(ziel).isSymbolicLink()) {
    throw new Error(`${ziel} ist ein Junction/Symlink (zeigt in einen fremden Arbeitsbaum). Erst entfernen: cmd //c rmdir "${ziel}"`)
  }
}

function main() {
  const ziel = resolve(arg('--ziel', join(WURZEL, 'data', 'cache')))
  const name = arg('--name', 'data-cache')
  zielPruefen(ziel)
  console.log(`Vorher:  Katalog geholt ${katalogStand(ziel)}`)
  const art = frischesArtefakt(name, Number(arg('--max-alter', '24')))
  console.log(`Artefakt: ${art.mb} MB, angelegt ${alterText(art.angelegt)} (Lauf ${art.lauf})`)
  const staging = mkdtempSync(join(tmpdir(), 'cache-holen-'))
  try {
    execFileSync('gh', ['run', 'download', String(art.lauf), '--repo', REPO, '-n', name, '-D', staging], { stdio: 'inherit' })
    mkdirSync(ziel, { recursive: true })
    cpSync(staging, ziel, { recursive: true, force: true })
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
  console.log(`Nachher: Katalog geholt ${katalogStand(ziel)}`)
}

try {
  main()
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
