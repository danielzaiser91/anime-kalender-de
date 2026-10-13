import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Zielordner der Prüfbilder: `docs/` nur mit `--docs`, sonst `<Temp>/<unterordner>`.
 * Die Bilder in `docs/` sind getrackt — ein gewöhnlicher Prüflauf soll keinen Diff erzeugen.
 */
export function bilderOrdner(wurzel, unterordner) {
  const ordner = process.argv.includes('--docs') ? path.join(wurzel, 'docs') : path.join(os.tmpdir(), unterordner)
  mkdirSync(ordner, { recursive: true })
  console.log(`Bilder: ${ordner}`)
  return ordner
}
