#!/usr/bin/env node
/**
 * Start-Budget (Leitziel Mobile Performance, ZIELE.md): Was ein Erstbesuch der Startseite lädt, gzip-Summe, darf die Grenze nicht
 * überschreiten. Gemessen nach dem Web-Bau an `dist/`: index.html, die Skript- und Stylesheet-Dateien daraus (Einstieg plus
 * statisch vorgeladene Chunks) und die Dateien, die das Vorlade-Skript der Wochenansicht (`teil = [...]`, tools/vite-vorladen.ts)
 * im Kopf der HTML anfordert. Nicht gezählt: dynamisch geladene Chunks, Schriften, Bilder, die vollen Dateien der Nicht-Wochen-Ansichten.
 *
 * Aufruf: `node tools/start-budget.mjs [dist-ordner]` (Vorgabe `dist`). Exit 1 über der Grenze oder bei fehlender Datei.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const KB = 1024
// Ziel 300 KB (gemessen 18.10.2026: 282 KB). Die Grenze steigt nie; sie sinkt von Hand, wenn der Ist-Wert dauerhaft darunter liegt.
export const GRENZE = 300 * KB

/** Dateien, die der Erstbesuch lädt, als Pfade relativ zu `dist/`; `null` im Fehlerfall mit Grund. */
export function startDateien(html) {
  const aus = (re) => [...html.matchAll(re)].map((m) => m[1].replace(/^\//, ''))
  const bundel = aus(/<script[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g)
  const vorab = aus(/<link[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)
  const css = aus(/<link[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)
  const teil = /teil = (\[[^\]]*\])/.exec(html)
  if (!bundel.length) return { fehler: 'kein Einstiegsskript in index.html' }
  if (!css.length) return { fehler: 'kein Stylesheet in index.html' }
  if (!teil) return { fehler: 'Vorlade-Skript (teil = [...]) fehlt in index.html' }
  const daten = JSON.parse(teil[1]).map((n) => `data/${n}.json`)
  return { dateien: ['index.html', ...bundel, ...vorab, ...css, ...daten] }
}

/** gzip-Größe je Datei; fehlt eine Datei, steht sie in `fehlt`. */
export function messe(dist, pfade) {
  const zeilen = []
  const fehlt = []
  for (const pfad of [...new Set(pfade)]) {
    const voll = join(dist, pfad)
    if (!existsSync(voll)) fehlt.push(pfad)
    else zeilen.push({ pfad, bytes: gzipSync(readFileSync(voll), { level: 9 }).length })
  }
  return { zeilen, fehlt }
}

/** Ergebnis als `{ code, text }`; über der Grenze mit Aufschlüsselung je Datei. */
export function bewerte(dist, grenze = GRENZE) {
  const indexPfad = join(dist, 'index.html')
  if (!existsSync(indexPfad)) return { code: 1, text: `start-budget: ${indexPfad} fehlt (erst bauen)` }
  const start = startDateien(readFileSync(indexPfad, 'utf8'))
  if (start.fehler) return { code: 1, text: `start-budget: ${start.fehler}` }
  const { zeilen, fehlt } = messe(dist, start.dateien)
  if (fehlt.length) return { code: 1, text: `start-budget: Datei fehlt in ${dist}: ${fehlt.join(', ')}` }
  const summe = zeilen.reduce((s, z) => s + z.bytes, 0)
  const kb = (b) => (b / KB).toFixed(1)
  if (summe <= grenze) return { code: 0, text: `start-budget: ${kb(summe)} KB gzip von ${kb(grenze)} KB, ${kb(grenze - summe)} KB Luft` }
  const liste = zeilen.map((z) => `  ${kb(z.bytes).padStart(7)} KB  ${z.pfad}`).join('\n')
  return { code: 1, text: `start-budget: ${kb(summe)} KB gzip, ${kb(summe - grenze)} KB über der Grenze von ${kb(grenze)} KB\n${liste}` }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, text } = bewerte(resolve(process.argv[2] ?? 'dist'))
  if (code) console.error(text)
  else console.log(text)
  process.exit(code)
}
