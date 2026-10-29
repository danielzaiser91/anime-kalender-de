/**
 * Wächter: Escape-Hörer auf `window`/`document` gehen über `useEscape` (`web/src/lib/escape.ts`), nie über einen rohen
 * `addEventListener('keydown', …)` in `web/src` — nur der Helfer beachtet `defaultPrevented`, sonst schließt ein Escape zwei Ebenen
 * (Detail-Panel + Quellen-Fenster, PR 2371). Ausnahme: der Helfer selbst; er muss tatsächlich vorkommen, sonst ist der Wächter blind.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findeRoheEscapeHoerer } from './lib/escape-hoerer.ts'

const WURZEL = resolve(process.argv[2] === '--wurzel' ? process.argv[3] : resolve(import.meta.dirname, '..'))
const HELFER = 'web/src/lib/escape.ts'

/** Alle `.ts`/`.tsx` unter `web/src` (Pfade mit `/`, relativ zur Wurzel). */
export function quelldateien(wurzel: string): string[] {
  const aus: string[] = []
  const geh = (ordner: string) => {
    for (const e of readdirSync(ordner, { withFileTypes: true })) {
      if (e.isDirectory()) geh(join(ordner, e.name))
      else if (/\.tsx?$/.test(e.name)) aus.push(relative(wurzel, join(ordner, e.name)).split('\\').join('/'))
    }
  }
  geh(join(wurzel, 'web/src'))
  return aus
}

/** Meldungen zu einer Dateiliste: jeder rohe Escape-Hörer außerhalb des Helfers; fehlt der Helfer oder sein Hörer, ist der Wächter blind. */
export function bewerte(dateien: string[], lies: (d: string) => string): string[] {
  const meldungen: string[] = []
  if (!dateien.includes(HELFER)) meldungen.push(`${HELFER} fehlt`)
  for (const d of dateien) {
    const zeilen = findeRoheEscapeHoerer(lies(d), d)
    if (d === HELFER) {
      if (zeilen.length !== 1) meldungen.push(`${HELFER}: ${zeilen.length} Escape-Hörer statt genau einem (Wächter blind oder Helfer zerlegt)`)
    } else {
      for (const z of zeilen) meldungen.push(`${d}:${z} roher Escape-Hörer — useEscape aus ${HELFER} nehmen`)
    }
  }
  return meldungen
}

function main(): number {
  const dateien = quelldateien(WURZEL)
  const meldungen = bewerte(dateien, (d) => readFileSync(resolve(WURZEL, d), 'utf8'))
  for (const m of meldungen) console.error(`FEHLER: ${m}`)
  console.log(`check-escape-hoerer: ${meldungen.length ? 'FEHLER' : 'ok'} (${dateien.length} Dateien in web/src, ${meldungen.length} Meldungen)`)
  return meldungen.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
