/**
 * Wächter: Jeder Schritt, der `apt` ruft (auch über `playwright install --with-deps|install-deps`), steht in seiner Schrittliste
 * hinter einem Schritt, der die vorinstallierte Microsoft-Paketquelle entfernt. Ihr 403 am 20.10.2026 ließ `apt-get update`
 * und damit die PR-Prüfkette ohne Codefehler scheitern (Chromium braucht die Quelle nicht).
 * Aufruf: node tools/apt-fremdquelle.mjs  (Exit 1 bei Verstoß)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'yaml'

const RUFT_APT = /\bapt(-get)?\s|playwright\s+install\b[^\n]*--with-deps|playwright\s+install-deps/
const ENTFERNT_QUELLE = /packages\.microsoft\.com[^\n]*\brm\b|\brm\b[^\n]*packages\.microsoft\.com/

/** Alle Schrittlisten eines Dokuments: Jobs eines Workflows oder `runs.steps` einer Composite-Action. */
function schrittlisten(doc) {
  const listen = Object.entries(doc?.jobs ?? {}).map(([name, job]) => [`Job ${name}`, job?.steps ?? []])
  if (doc?.runs?.steps) listen.push(['Aktion', doc.runs.steps])
  return listen
}

/** Verstöße eines geparsten Workflows oder einer Action. */
export function pruefeAptQuelle(doc, datei) {
  const fehler = []
  for (const [ort, schritte] of schrittlisten(doc)) {
    let entfernt = false
    for (const s of schritte) {
      const run = String(s.run ?? '')
      if (RUFT_APT.test(run) && !entfernt) fehler.push(`${datei}: ${ort}, Schritt „${s.name ?? run}“ ruft apt ohne vorherigen Schritt, der die Microsoft-Paketquelle entfernt`)
      if (ENTFERNT_QUELLE.test(run)) entfernt = true
    }
  }
  return fehler
}

/** Alle YAML-Dateien unter .github/workflows und .github/actions. */
function yamlDateien(wurzel) {
  const dateien = readdirSync(resolve(wurzel, '.github/workflows')).map((d) => `.github/workflows/${d}`)
  for (const a of readdirSync(resolve(wurzel, '.github/actions'))) dateien.push(`.github/actions/${a}/action.yml`)
  return dateien.filter((d) => /\.ya?ml$/.test(d))
}

export function pruefeAlle(wurzel) {
  return yamlDateien(wurzel).flatMap((d) => pruefeAptQuelle(parse(readFileSync(resolve(wurzel, d), 'utf8')), d))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fehler = pruefeAlle(resolve(process.argv[2] ?? resolve(import.meta.dirname, '..')))
  fehler.forEach((f) => console.error(f))
  console.log(`apt-fremdquelle: ${fehler.length} Verstöße`)
  process.exit(fehler.length ? 1 : 0)
}
