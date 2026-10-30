/**
 * Linux-Ersatzschrift für die lokale Aussehen-Probe (nur im Prüfwerkzeug, nie in der Seite).
 *
 * Die Seite nimmt die Systemschrift (`--ak-schrift-text`: system-ui … sans-serif). Auf dem Linux-Läufer der
 * CI ist das DejaVu Sans (Titel: DejaVu Serif), unter Windows Segoe UI — schmaler. Überläufe, die nur mit
 * der breiteren Linux-Schrift auftreten, zeigten sich bisher erst in der CI. Mit `--linux-schrift` legt
 * `ansicht-bild.mjs` DejaVu über beide Variablen.
 *
 * Schrift: DejaVu (Bitstream Vera + gemeinfreie Ergänzungen), frei weitergebbar, Lizenz in `schriften/DejaVu-LIZENZ.txt`.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ORDNER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schriften')
const PFAD = '/__linux-schrift/'

export const SCHNITTE = [
  { familie: 'AkLinuxSans', gewicht: 400, datei: 'DejaVuSans.ttf' },
  { familie: 'AkLinuxSans', gewicht: 700, datei: 'DejaVuSans-Bold.ttf' },
  { familie: 'AkLinuxSerif', gewicht: 400, datei: 'DejaVuSerif.ttf' },
  { familie: 'AkLinuxSerif', gewicht: 700, datei: 'DejaVuSerif-Bold.ttf' },
]

/** CSS, das die zwei Schrift-Variablen der Seite auf DejaVu setzt. */
export function linuxSchriftCss() {
  const faces = SCHNITTE.map(
    (s) => `@font-face{font-family:'${s.familie}';font-weight:${s.gewicht};src:url('${PFAD}${s.datei}') format('truetype')}`,
  )
  return `${faces.join('')}:root{--ak-schrift-text:'AkLinuxSans',sans-serif!important;--ak-schrift-titel:'AkLinuxSerif',serif!important}`
}

/** Beantwortet nur die Schriftdateien; alles andere geht an die zuvor gesetzte Route. */
export async function antworteSchrift(route) {
  const url = new URL(route.request().url())
  const name = url.pathname.startsWith(PFAD) ? url.pathname.slice(PFAD.length) : ''
  const schnitt = SCHNITTE.find((s) => s.datei === name)
  if (!schnitt) return route.fallback()
  return route.fulfill({ status: 200, contentType: 'font/ttf', body: await readFile(path.join(ORDNER, name)) })
}

/** Nach der Haupt-Route aufrufen (spätere Routen gehen vor). Das Skript hängt das CSS in jede Seite ein. */
export async function installiereLinuxSchrift(seite) {
  await seite.route('**/*', antworteSchrift)
  const css = linuxSchriftCss()
  await seite.addInitScript((text) => {
    const hang = () => {
      const s = document.createElement('style')
      s.textContent = text
      document.documentElement.appendChild(s)
    }
    if (document.documentElement) hang()
    else document.addEventListener('DOMContentLoaded', hang)
  }, css)
}
