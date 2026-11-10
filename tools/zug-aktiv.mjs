/**
 * Der eine Schalter für den Sammelzug (P3, Daniel 09.11.2026): `tools/zug-aktiv.json` mit `{ "aktiv": true }`.
 * Aus (Standard) verhält sich jedes Werkzeug wie vor P3; umgelegt wird erst nach der ersten echten Fahrt (P2c).
 * Fehlt die Datei oder ist sie kaputt, gilt „aus“ (nie still „an“). Die Reihe `merge-reihe-zug.sh` fragt per
 * `node tools/zug-aktiv.mjs` (Exit 0 = an, 1 = aus) dieselbe Datei.
 */
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ZUG = 'zug'
export const SCHALTER_DATEI = fileURLToPath(new URL('./zug-aktiv.json', import.meta.url))

/** true nur bei gültigem JSON mit `aktiv === true`. */
export function leseZugAktiv(datei = SCHALTER_DATEI, fsFn = fs) {
  try {
    return JSON.parse(fsFn.readFileSync(datei, 'utf8')).aktiv === true
  } catch {
    return false
  }
}

/** Ein PR mit Basis `zug` zählt nur bei gelegtem Schalter als Zug-PR. */
export const istZugPr = (pr, aktiv) => aktiv === true && pr.baseRefName === ZUG

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(leseZugAktiv() ? 0 : 1)
}
