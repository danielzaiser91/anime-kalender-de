#!/usr/bin/env node
/**
 * Holt den aktuellen `data/cache/` der Läufe in den eigenen Arbeitsbaum, damit ein lokaler Bau
 * (`pipeline/build.ts`) nicht am Titelschwund-Riegel scheitert.
 *
 * Der Ordner liegt nur im Actions-Cache `anilist-cache-*`, und den kann niemand außerhalb eines
 * Laufs laden. Deshalb legt der Workflow `cache-ablegen.yml` ihn täglich als Artefakt `data-cache`
 * ab (Beschreibung: docs/wissen/betrieb.md, „Lokaler Bau"); dieses Werkzeug lädt das jüngste.
 *
 * Aufruf (im Arbeitsbaum, in dem gebaut wird):
 *   node tools/cache-holen.mjs [--ziel <ordner>] [--name <artefakt>]
 * Vorgabe: Ziel = data/cache dieses Arbeitsbaums, Artefakt = data-cache. Vorhandene Dateien, die
 * nicht im Artefakt stehen, bleiben liegen. Exit 0 = geholt, 1 = Fehler.
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

const alterText = (iso) => {
  const stunden = (Date.now() - Date.parse(iso)) / 3_600_000
  return `${iso.slice(0, 16).replace('T', ' ')} UTC, vor ${stunden < 48 ? `${stunden.toFixed(1)} h` : `${(stunden / 24).toFixed(1)} Tagen`}`
}

/** Stand des Katalogs (`geholtAm`, sonst Änderungszeit) — die Datei, an der ein alter Cache auffällt. */
function katalogStand(ordner) {
  const datei = join(ordner, KATALOG)
  if (!existsSync(datei)) return 'nicht vorhanden'
  const roh = readFileSync(datei, 'utf8').slice(0, 200)
  const iso = /"geholtAm":\s*"([^"]+)"/.exec(roh)?.[1] ?? statSync(datei).mtime.toISOString()
  return alterText(iso)
}

/** Jüngstes nicht abgelaufenes Artefakt dieses Namens samt Lauf-Kennung. */
function juengstesArtefakt(name) {
  const antwort = gh('api', `repos/${REPO}/actions/artifacts?name=${encodeURIComponent(name)}&per_page=10`)
  const a = JSON.parse(antwort).artifacts.find((x) => !x.expired)
  if (!a) throw new Error(`Kein Artefakt „${name}" vorhanden — der Workflow cache-ablegen.yml fehlt oder lief noch nie (docs/wissen/betrieb.md, „Lokaler Bau").`)
  return { lauf: a.workflow_run.id, angelegt: a.created_at, mb: Math.round(a.size_in_bytes / 1048576) }
}

/** Ein Junction/Symlink als Ziel würde den Cache eines anderen Arbeitsbaums überschreiben. */
function zielPruefen(ziel) {
  if (existsSync(ziel) && lstatSync(ziel).isSymbolicLink()) {
    throw new Error(`${ziel} ist ein Junction/Symlink (zeigt in einen fremden Arbeitsbaum). Erst entfernen: cmd //c rmdir "${ziel}"`)
  }
}

function main() {
  const ziel = resolve(arg('--ziel', join(WURZEL, 'data', 'cache')))
  zielPruefen(ziel)
  console.log(`Vorher:  Katalog geholt ${katalogStand(ziel)}`)
  const art = juengstesArtefakt(arg('--name', 'data-cache'))
  console.log(`Artefakt: ${art.mb} MB, angelegt ${alterText(art.angelegt)} (Lauf ${art.lauf})`)
  const staging = mkdtempSync(join(tmpdir(), 'cache-holen-'))
  try {
    execFileSync('gh', ['run', 'download', String(art.lauf), '--repo', REPO, '-n', arg('--name', 'data-cache'), '-D', staging], { stdio: 'inherit' })
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
