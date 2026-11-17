/**
 * Gemeinsamer Lader für Sandkasten-Tests der Erweiterung: die Skripte kommen in der Reihenfolge aus
 * `manifest.json` (content_scripts), die der Browser auch sieht, nie in einer eigenen Reihenfolge des Tests.
 */
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')

const manifest = JSON.parse(readFileSync(join(__dirname, 'manifest.json'), 'utf8'))

/** Dateien der content_scripts-Gruppe, die `ziel` enthält, bis einschließlich `ziel`; `nur` wählt aus (Manifest-Reihenfolge bleibt). */
function skripteBis(ziel, { nur } = {}) {
  const gruppe = manifest.content_scripts.find((c) => c.js.includes(ziel))
  if (!gruppe) throw new Error(`${ziel} steht in keiner content_scripts-Gruppe von manifest.json`)
  const bisZiel = gruppe.js.slice(0, gruppe.js.indexOf(ziel) + 1)
  if (!nur) return bisZiel
  const fehlt = nur.filter((d) => !bisZiel.includes(d))
  if (fehlt.length > 0) throw new Error(`nicht vor ${ziel} im Manifest: ${fehlt.join(', ')}`)
  return bisZiel.filter((d) => nur.includes(d))
}

/** Führt die Dateien der Reihe nach im Kontext aus. */
function ladeSkripte(kontext, dateien) {
  for (const datei of dateien) vm.runInContext(readFileSync(join(__dirname, datei), 'utf8'), kontext, { filename: datei })
}

module.exports = { skripteBis, ladeSkripte }
