#!/usr/bin/env node
/**
 * Rechnet den Kontrast (WCAG 2.x) der Farbrollen aus `web/src/styles.css` nach und hält die Tabelle in
 * `docs/wissen/design-regeln.md` aktuell — die Belege dort sind erzeugt, nicht geschrieben (13.10.2026).
 *
 * Aufruf:
 *   node tools/design-kontrast.mjs             prüfen: jedes Paar über seiner Schwelle, Tabelle im Dokument aktuell (Exit 1 sonst)
 *   node tools/design-kontrast.mjs --schreiben Tabelle im Dokument neu erzeugen
 *
 * Gelesen werden die Blöcke `html.dark { … }` und `html:not(.dark) { … }`; `var(--ak-…)` und
 * `color-mix(in srgb, A p%, B)` werden aufgelöst. Text braucht 4,5:1, Flächen und Ränder 3:1 (AA).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const WURZEL = path.resolve(import.meta.dirname, '..')
const CSS = path.join(WURZEL, 'web/src/styles.css')
const DOKU = path.join(WURZEL, 'docs/wissen/design-regeln.md')
const ANFANG = '<!-- kontrast-tabelle:anfang -->'
const ENDE = '<!-- kontrast-tabelle:ende -->'

/** Paare [Vordergrund, Grund, Schwelle]: Text 4,5, nicht-textliche Zeichen (Ränder, Füllungen, Fokusring) 3. */
export const PAARE = [
  ['text', 'grund', 4.5],
  ['text', 'flaeche', 4.5],
  ['text', 'flaeche-2', 4.5],
  ['text', 'flaeche-3', 4.5],
  ['leise', 'grund', 4.5],
  ['leise', 'flaeche', 4.5],
  ['leise', 'flaeche-2', 4.5],
  ['sehr-leise', 'flaeche', 4.5],
  ['leise', 'pille', 4.5],
  ['leise', 'pille-hover', 4.5],
  ['akzent-text', 'grund', 4.5],
  ['akzent-text', 'flaeche', 4.5],
  ['akzent-text', 'flaeche-2', 4.5],
  ['auf-akzent', 'akzent', 4.5],
  ['auf-akzent', 'akzent-hover', 4.5],
  ['gut-text', 'flaeche', 4.5],
  ['gut-text', 'gut-grund', 4.5],
  ['fehler-text', 'flaeche', 4.5],
  ['fehler-text', 'fehler-grund', 4.5],
  ['warnung-text', 'flaeche', 4.5],
  ['warnung-text', 'warnung-grund', 4.5],
  ['info-text', 'flaeche', 4.5],
  ['info-text', 'info-grund', 4.5],
  ['tv', 'tv-grund', 4.5],
  ['favorit-text', 'flaeche', 4.5],
  ['finale-text', 'flaeche', 4.5],
  ['finale', 'flaeche', 3],
  ['finale', 'grund', 3],
  ['favorit-rand', 'grund', 3],
  ['favorit-rand', 'flaeche', 3],
  ['katalog-text', 'flaeche', 4.5],
  ['akzent', 'grund', 3],
  ['akzent', 'flaeche', 3],
  ['fokus', 'grund', 3],
  ['fokus', 'flaeche', 3],
  ['fokus', 'flaeche-2', 3],
  ['auf-gut', 'gut', 4.5],
  ['gut', 'flaeche', 3],
  ['auf-fehler', 'fehler', 4.5],
  ['fehler', 'flaeche', 3],
  ['warnung', 'flaeche', 3],
  ['info', 'flaeche', 3],
  ['rand', 'flaeche', 1.3],
]

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const kanal = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const helligkeit = ([r, g, b]) => 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b)
export function kontrast(a, b) {
  const [x, y] = [helligkeit(a), helligkeit(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** Die `--ak-*`-Deklarationen eines Themenblocks als Rohtext je Name. */
function rohwerte(css, selektor) {
  const werte = new Map()
  const re = new RegExp(`${selektor.replace(/[.()]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g')
  for (const block of css.matchAll(re)) {
    for (const z of block[1].matchAll(/--ak-([a-z0-9-]+)\s*:\s*([^;]+);/g)) werte.set(z[1], z[2].trim())
  }
  return werte
}

/** Löst einen Rohwert zu RGB auf: Hex, `var(--ak-x)` oder `color-mix(in srgb, A p%, B)`. */
function aufloesen(wert, werte, tiefe = 0) {
  if (tiefe > 8) throw new Error(`Zirkel bei ${wert}`)
  const v = wert.match(/^var\(--ak-([a-z0-9-]+)\)$/)
  if (v) return aufloesen(werte.get(v[1]) ?? fehlt(v[1]), werte, tiefe + 1)
  const m = wert.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/)
  if (m) {
    const [a, b, t] = [aufloesen(m[1], werte, tiefe + 1), aufloesen(m[3], werte, tiefe + 1), Number(m[2]) / 100]
    return a.map((x, i) => x * t + b[i] * (1 - t))
  }
  if (/^#[0-9a-f]{6}$/i.test(wert)) return rgb(wert)
  throw new Error(`Unbekannter Farbwert: ${wert}`)
}
const fehlt = (name) => {
  throw new Error(`Rolle --ak-${name} fehlt in styles.css`)
}

/** Die aufgelösten Farben beider Themen: { dunkel: Map, hell: Map } mit RGB je Rolle. */
export function rollen(css = readFileSync(CSS, 'utf8')) {
  const themen = { dunkel: rohwerte(css, 'html.dark'), hell: rohwerte(css, 'html:not(.dark)') }
  return Object.fromEntries(Object.entries(themen).map(([t, w]) => [t, new Map([...w].map(([k, v]) => [k, aufloesen(v, w)]))]))
}

/** Zeilen der Tabelle; `rot` nennt die Paare unter ihrer Schwelle. */
export function tabelle(css = readFileSync(CSS, 'utf8')) {
  const farben = rollen(css)
  const zeilen = ['| Vorne | Hinten | Mindestens | Dunkel | Hell |', '|---|---|---|---|---|']
  const rot = []
  for (const [vorne, hinten, min] of PAARE) {
    const werte = ['dunkel', 'hell'].map((t) => {
      const [a, b] = [farben[t].get(vorne) ?? fehlt(vorne), farben[t].get(hinten) ?? fehlt(hinten)]
      const k = kontrast(a, b)
      if (k < min) rot.push(`${t}: ${vorne} auf ${hinten} ${k.toFixed(2)} < ${min}`)
      return `${k.toFixed(1)} (${hex(a)} auf ${hex(b)})`
    })
    zeilen.push(`| ${vorne} | ${hinten} | ${min} | ${werte.join(' | ')} |`)
  }
  return { text: zeilen.join('\n'), rot }
}

const IMMER_TEXT = ['text', 'leise', 'sehr-leise', 'akzent-text', 'link']
const IMMER_GRUND = ['grund', 'flaeche', 'flaeche-2', 'flaeche-3']
/** Jede Rolle, die `.ak-immer-dunkel` selbst setzen muss, mit dem Wert von `html.dark` (auch Rollen ohne Text-auf-Fläche-Paar). */
export const IMMER_ROLLEN = ['grund', 'flaeche', 'flaeche-2', 'flaeche-3', 'rand', 'linie', 'text', 'leise', 'sehr-leise', 'akzent-text', 'link', 'fokus', 'fehler', 'fehler-text']
const THEMEN = [['dunkel', 'html.dark'], ['hell', 'html:not(.dark)']]

/**
 * Werte innerhalb `.ak-immer-dunkel` unter einem Themenblock: was der Block setzt, löst gegen den Block auf; was er nicht setzt,
 * erbt der Browser als schon aufgelösten Wert des Themas (`--ak-link: var(--ak-akzent-text)` im Block verdeckt nichts).
 */
function immerDunkelWerte(css, selektor) {
  const thema = rohwerte(css, selektor)
  const ueber = rohwerte(css, '.ak-immer-dunkel')
  const roh = new Map([...thema, ...ueber])
  return new Map([...roh].map(([k, v]) => [k, aufloesen(v, ueber.has(k) ? roh : thema)]))
}

/** Text gegen Fläche innerhalb des Blocks, in beiden Themen (4,5:1). */
export function immerDunkelKontrast(css) {
  const rot = []
  for (const [thema, selektor] of THEMEN) {
    const w = immerDunkelWerte(css, selektor)
    for (const v of IMMER_TEXT) {
      for (const g of IMMER_GRUND) {
        if (v === 'sehr-leise' && g === 'flaeche-3') continue // im Hauptthema ebenfalls 4,2:1, dort nicht vorgesehen
        const k = kontrast(w.get(v) ?? fehlt(v), w.get(g) ?? fehlt(g))
        if (k < 4.5) rot.push(`${thema} in .ak-immer-dunkel: ${v} auf ${g} ${k.toFixed(2)} < 4.5`)
      }
    }
  }
  return rot
}

/** Der Block setzt jede Rolle aus `IMMER_ROLLEN` selbst und auf den Wert von `html.dark`. */
export function immerDunkelGleich(css) {
  const ueber = rohwerte(css, '.ak-immer-dunkel')
  const dunkel = rohwerte(css, 'html.dark')
  const eigen = immerDunkelWerte(css, 'html.dark')
  const rot = []
  for (const r of IMMER_ROLLEN) {
    if (!ueber.has(r)) rot.push(`.ak-immer-dunkel setzt --ak-${r} nicht`)
    else if (hex(eigen.get(r)) !== hex(aufloesen(dunkel.get(r) ?? fehlt(r), dunkel))) rot.push(`.ak-immer-dunkel: --ak-${r} weicht von html.dark ab`)
  }
  return rot
}

/** Ruhe gegen Hover der Anbieter-Pille: mindestens 1,2:1, in beiden Themen. */
function pilleStufeRot(css) {
  const rot = []
  for (const [thema, selektor] of THEMEN) {
    const w = rohwerte(css, selektor)
    const k = kontrast(aufloesen(w.get('pille') ?? fehlt('pille'), w), aufloesen(w.get('pille-hover') ?? fehlt('pille-hover'), w))
    if (k < 1.2) rot.push(`${thema}: Pille Ruhe gegen Hover ${k.toFixed(2)} < 1.2`)
  }
  return rot
}

/** Prüfungen für `.ak-immer-dunkel` (Trailer-Fenster, Beleg-Dialog) und die Anbieter-Pille (15.10.2026). */
export const immerDunkelRot = (css) => [...immerDunkelKontrast(css), ...immerDunkelGleich(css), ...pilleStufeRot(css)]


function main() {
  const { text, rot } = tabelle()
  rot.push(...immerDunkelRot(readFileSync(CSS, 'utf8')))
  const doku = readFileSync(DOKU, 'utf8')
  const [a, e] = [doku.indexOf(ANFANG), doku.indexOf(ENDE)]
  if (a < 0 || e < 0) throw new Error(`Marken ${ANFANG} / ${ENDE} fehlen in ${DOKU}`)
  const neu = `${doku.slice(0, a + ANFANG.length)}\n${text}\n${doku.slice(e)}`
  if (process.argv.includes('--schreiben')) {
    writeFileSync(DOKU, neu)
    console.log(`Tabelle geschrieben: ${PAARE.length} Paare`)
  } else if (neu !== doku) {
    console.log('✕ Kontrasttabelle in docs/wissen/design-regeln.md ist veraltet — node tools/design-kontrast.mjs --schreiben')
    process.exitCode = 1
  }
  for (const z of rot) console.log(`✕ ${z}`)
  if (rot.length) process.exitCode = 1
  else console.log(`Kontrast: ${PAARE.length} Paare in beiden Themen über der Schwelle`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main()
