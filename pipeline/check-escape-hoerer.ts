/**
 * Wächter: Escape-Hörer auf `window`/`document` gehen über `useEscape` (`web/src/lib/escape.ts`), nie über einen rohen Tastenhörer in
 * `web/src` — nur der Helfer beachtet `defaultPrevented` und die Reihenfolge der Ebenen, sonst schließt ein Escape zwei Ebenen
 * (Detail-Panel + Quellen-Fenster, PR 2371; Leinwand + Trailer-Kino, PR 2386). Jeder Tastenhörer (keydown/keyup/keypress, `on…`-Zuweisung,
 * Alias, nicht auflösbarer Ereignisname) außerhalb des Helfers und der Ausnahmeliste ist eine Meldung; der Helfer muss genau einen haben.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findeTastenHoerer, textKonstanten } from './lib/escape-hoerer.ts'

const WURZEL = resolve(process.argv[2] === '--wurzel' ? process.argv[3] : resolve(import.meta.dirname, '..'))
const HELFER = 'web/src/lib/escape.ts'

/** Dateien mit Tastenhörern, die nichts mit Escape zu tun haben (Datei → Grund); steht ein Hörer nicht mehr darin, ist der Eintrag zu streichen. */
export const AUSNAHMEN: Record<string, string> = {
  'web/src/App.tsx': 'useTastenSpruenge: Pfeiltasten und T blättern die Woche, kein Escape',
  'web/src/lib/use-einrollen.ts': 'Bildlauf-Tasten (PageDown, Pfeile, Leertaste) zählen als Nutzerbedienung, kein Escape',
  'web/src/lib/start-daten.ts': 'Bedienung (Tippen, Scrollen, Taste) stößt das Nachladen an, kein Escape',
  'web/src/lib/idSet.ts': 'Ereignisname aus Schlüssel zusammengesetzt (`${key}:changed`), kein Tastenereignis',
}

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

/** Textkonstanten aller Dateien zusammen (ein Ereignisname darf aus einer anderen Datei kommen). */
function alleKonstanten(dateien: string[], lies: (d: string) => string): Map<string, Set<string>> {
  const gesamt = new Map<string, Set<string>>()
  for (const d of dateien) {
    for (const [name, werte] of textKonstanten(lies(d), d)) gesamt.set(name, new Set([...(gesamt.get(name) ?? []), ...werte]))
  }
  return gesamt
}

/** Meldungen zu einer Dateiliste; fehlt der Helfer, sein Hörer oder der Hörer einer Ausnahme, ist der Wächter blind bzw. die Liste veraltet. */
export function bewerte(dateien: string[], lies: (d: string) => string, ausnahmen: Record<string, string> = AUSNAHMEN): string[] {
  const meldungen: string[] = []
  if (!dateien.includes(HELFER)) meldungen.push(`${HELFER} fehlt`)
  const konstanten = alleKonstanten(dateien, lies)
  for (const d of dateien) {
    const zeilen = findeTastenHoerer(lies(d), d, konstanten)
    if (d === HELFER) {
      if (zeilen.length !== 1) meldungen.push(`${HELFER}: ${zeilen.length} Tastenhörer statt genau einem (Wächter blind oder Helfer zerlegt)`)
    } else if (d in ausnahmen) {
      if (zeilen.length === 0) meldungen.push(`${d}: steht in der Ausnahmeliste, hat aber keinen Tastenhörer mehr — Eintrag streichen`)
    } else {
      for (const z of zeilen) meldungen.push(`${d}:${z} roher Tastenhörer — useEscape aus ${HELFER} nehmen (oder mit Grund in AUSNAHMEN)`)
    }
  }
  return meldungen
}

function main(): number {
  const dateien = quelldateien(WURZEL)
  const meldungen = bewerte(dateien, (d) => readFileSync(resolve(WURZEL, d), 'utf8'))
  for (const m of meldungen) console.error(`FEHLER: ${m}`)
  console.log(`check-escape-hoerer: ${meldungen.length ? 'FEHLER' : 'ok'} (${dateien.length} Dateien in web/src, ${Object.keys(AUSNAHMEN).length} Ausnahmen, ${meldungen.length} Meldungen)`)
  return meldungen.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
