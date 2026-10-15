/** Hilfen der Design-Tests: Quelldateien von `web/src` lesen und Fundstellen eines Musters zeilenweise nennen. */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const QUELLE = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'src')

/** Alle Quelldateien (tsx, ts, css) unter einem Ordner als [relativer Pfad, Inhalt]. */
export function dateien(ordner = QUELLE, vorne = '') {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return dateien(join(ordner, e.name), `${vorne}${e.name}/`)
    if (!/\.(tsx|ts|css)$/.test(e.name)) return []
    return [[`${vorne}${e.name}`, readFileSync(join(ordner, e.name), 'utf8')]]
  })
}

/** Fundstellen eines Musters als `Datei:Zeile`. */
export function funde(muster, quellen) {
  return quellen.flatMap(([pfad, text]) => text.split('\n').flatMap((zeile, i) => (muster.test(zeile) ? [`${pfad}:${i + 1}`] : [])))
}

/** Inhalt einer Quelldatei unter `web/src`. */
export const lies = (pfad) => readFileSync(join(QUELLE, pfad), 'utf8')
