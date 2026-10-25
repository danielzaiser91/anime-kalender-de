#!/usr/bin/env node
/**
 * Start-Budget (Leitziel Mobile Performance, ZIELE.md): Was ein Erstbesuch der Startseite lädt, gzip-Summe, darf die Grenze nicht
 * überschreiten. Gemessen nach dem Web-Bau an `dist/`: index.html, jedes Skript und jedes `modulepreload`/`stylesheet`/`preload` daraus
 * (Einstieg plus statisch vorgeladene Chunks), die Dateien, die das Vorlade-Skript der Wochenansicht (`teil = [...]`,
 * tools/vite-vorladen.ts) anfordert. Webschriften gibt es seit Schrift E (25.10.2026) nicht mehr; eine woff2 im Start-CSS ergibt Exit 1, damit keine ungezählte Schrift hineinwächst.
 * Nicht gezählt: dynamisch geladene Chunks, Bilder, die vollen Dateien der Nicht-Wochen-Ansichten, das Nachladen nach dem Start.
 * Jedes `<script src>` und `<link>` der HTML wird gelesen; ein `link rel` außerhalb der Ausnahmeliste ergibt Exit 1 statt still zu fehlen.
 *
 * Aufruf: `node tools/start-budget.mjs [dist-ordner]` (Vorgabe `dist`). Exit 1 über der Grenze oder bei fehlender Datei.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const KB = 1024
// Grenze 240 KB (25.10.2026, Schrift E: Ist 236,0 KB ohne Webschriften, Ist + 10 KB abgerundet). Davor 280 KB (25.10.2026: Ist 274,8 KB, 18,2 KB weniger, seit die Wochenansicht aus `woche-kacheln.json` startet; Ist-Zahl + 10 KB, auf volle 10 KB abgerundet).
// Davor 300 KB (23.10.2026: Ist 293,8 KB nach verzögertem Laden der Seitenansichten); davor 310 KB inkl. Schriften (18.10.2026: 330 KB bei Ist 327 KB; 20.10.2026: Ist 305,2 KB nach Unbounded-Teilmenge, 5 KB Reserve; Ziel bleibt 300 KB).
// Die Grenze steigt nie; sie sinkt von Hand, wenn der Ist-Wert dauerhaft darunter liegt.
export const GRENZE = 240 * KB
/** Frühwarnung: bleibt weniger Luft, druckt der Lauf eine `::warning::`-Zeile (Daten wachsen mit jedem Datenlauf; 25.10.2026 riss die Grenze um 0,2 KB). */
export const WARNLUFT = 3 * KB

const GEZAEHLT = ['stylesheet', 'modulepreload', 'preload']
const AUSNAHMEN = ['icon', 'shortcut', 'apple-touch-icon', 'manifest', 'alternate', 'canonical']

/** Attribute eines Tags, unabhängig von Reihenfolge und Anführungszeichen; Namen klein. */
function attribute(text) {
  const attr = {}
  for (const m of text.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) attr[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
  return attr
}

/** Dateien, die der Erstbesuch lädt, als Pfade relativ zu `dist/`; `fehler` mit Grund, wenn die HTML nicht eindeutig lesbar ist. */
export function startDateien(html) {
  const bundel = []
  const vorab = []
  const css = []
  const fehler = []
  const pfad = (adresse, was) => {
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(adresse)) fehler.push(`${was} lädt von außen (${adresse}), nicht messbar`)
    return adresse.replace(/^\//, '').split(/[?#]/)[0]
  }
  for (const [, tag, text] of html.matchAll(/<(script|link)\b([^>]*)>/gi)) {
    const a = attribute(text)
    if (tag.toLowerCase() === 'script') {
      if (a.src) bundel.push(pfad(a.src, 'script'))
      continue
    }
    const rels = (a.rel ?? '').toLowerCase().split(/\s+/).filter(Boolean)
    if (rels.some((r) => GEZAEHLT.includes(r))) {
      if (!a.href) fehler.push(`link rel="${a.rel}" ohne href`)
      else if (rels.includes('stylesheet')) css.push(pfad(a.href, 'stylesheet'))
      else vorab.push(pfad(a.href, 'link'))
    } else if (!rels.some((r) => AUSNAHMEN.includes(r))) fehler.push(`link rel="${a.rel ?? ''}" ist weder gezählt noch ausgenommen`)
  }
  const teil = /teil = (\[[^\]]*\])/.exec(html)
  if (fehler.length) return { fehler: fehler.join('; ') }
  if (!bundel.length) return { fehler: 'kein Einstiegsskript in index.html' }
  if (!css.length) return { fehler: 'kein Stylesheet in index.html' }
  if (!teil) return { fehler: 'Vorlade-Skript (teil = [...]) fehlt in index.html' }
  const daten = JSON.parse(teil[1]).map((n) => `data/${n}.json`)
  return { dateien: ['index.html', ...bundel, ...vorab, ...css, ...daten], css }
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

/** woff2-Dateien, die die Start-Stylesheets anfordern (Soll: keine, Text und Überschriften nehmen Geräteschriften). */
export function startSchriften(dist, cssPfade) {
  return cssPfade.flatMap((p) => [...readFileSync(join(dist, p), 'utf8').matchAll(/url\(([^)]+?\.woff2)\)/g)].map((m) => m[1].replace(/^["']|["']$/g, '').replace(/^\//, '')))
}

/** Zusatzzeile, wenn die Luft unter `WARNLUFT` liegt. */
function warnZeile(luft, kb) {
  if (luft >= WARNLUFT) return ''
  return `\n::warning::start-budget: nur noch ${kb(luft)} KB Luft (Warnung unter ${kb(WARNLUFT)} KB) – Startdateien verkleinern, bevor der nächste Datenlauf die Grenze reißt`
}

/** Ergebnis als `{ code, text }`; über der Grenze mit Aufschlüsselung je Datei. */
export function bewerte(dist, grenze = GRENZE) {
  const indexPfad = join(dist, 'index.html')
  if (!existsSync(indexPfad)) return { code: 1, text: `start-budget: ${indexPfad} fehlt (erst bauen)` }
  const start = startDateien(readFileSync(indexPfad, 'utf8'))
  if (start.fehler) return { code: 1, text: `start-budget: ${start.fehler}` }
  const { zeilen, fehlt } = messe(dist, start.dateien)
  if (fehlt.length) return { code: 1, text: `start-budget: Datei fehlt in ${dist}: ${fehlt.join(', ')}` }
  const schriften = startSchriften(dist, start.css)
  if (schriften.length) return { code: 1, text: `start-budget: Webschrift im Start-CSS (nicht gezählt, nicht vorgesehen): ${schriften.join(', ')}` }
  const codeBytes = zeilen.reduce((s, z) => s + z.bytes, 0)
  const summe = codeBytes
  const kb = (b) => (b / KB).toFixed(1)
  const teile = `Code und Daten ${kb(codeBytes)} KB`
  if (summe <= grenze) return { code: 0, text: `start-budget: ${kb(summe)} KB gzip von ${kb(grenze)} KB, ${kb(grenze - summe)} KB Luft (${teile})${warnZeile(grenze - summe, kb)}` }
  const liste = zeilen.map((z) => `  ${kb(z.bytes).padStart(7)} KB  ${z.pfad}`).join('\n')
  return { code: 1, text: `start-budget: ${kb(summe)} KB gzip, ${kb(summe - grenze)} KB über der Grenze von ${kb(grenze)} KB (${teile})\n${liste}` }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, text } = bewerte(resolve(process.argv[2] ?? 'dist'))
  if (code) console.error(text)
  else console.log(text)
  process.exit(code)
}
