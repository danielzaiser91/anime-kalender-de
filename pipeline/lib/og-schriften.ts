/**
 * Schriften für die Vorschaubilder: Unbounded und Manrope, dieselben wie auf der Seite.
 *
 * sharp setzt Text über Pango, und Pango liest weder WOFF noch findet es Schriften aus einer
 * eigenen fontconfig-Datei (gemessen 27.09.2026: beides fällt still auf eine Ersatzschrift
 * zurück). Es liest aber eine TTF, die man ihm als `fontfile` gibt. Die WOFF-Dateien aus
 * `@fontsource` werden deshalb einmal nach `data/cache/og-schriften/` in TTF umgepackt —
 * WOFF 1.0 ist nur zlib-komprimiertes SFNT, das Umpacken ändert keine Glyphe.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { ROOT } from './util.ts'

const ZIEL = resolve(ROOT, 'data/cache/og-schriften')

export const SCHRIFTEN = {
  titel: { woff: '@fontsource/unbounded/files/unbounded-latin-700-normal.woff', familie: 'Unbounded', gewicht: 700 },
  marke: { woff: '@fontsource/unbounded/files/unbounded-latin-500-normal.woff', familie: 'Unbounded', gewicht: 500 },
  text: { woff: '@fontsource/manrope/files/manrope-latin-400-normal.woff', familie: 'Manrope', gewicht: 400 },
  halbfett: { woff: '@fontsource/manrope/files/manrope-latin-600-normal.woff', familie: 'Manrope', gewicht: 600 },
  fett: { woff: '@fontsource/manrope/files/manrope-latin-800-normal.woff', familie: 'Manrope', gewicht: 800 },
} as const

export type Schrift = keyof typeof SCHRIFTEN

/** Pfad der TTF zu einer Schrift — beim ersten Aufruf aus der WOFF umgepackt. */
export function schriftDatei(schrift: Schrift): string {
  const quelle = resolve(ROOT, 'node_modules', SCHRIFTEN[schrift].woff)
  const datei = resolve(ZIEL, `${pangoFamilie(schrift)}.ttf`)
  if (!existsSync(datei)) {
    mkdirSync(ZIEL, { recursive: true })
    writeFileSync(datei, woffZuTtf(readFileSync(quelle), pangoFamilie(schrift)))
  }
  return datei
}

/** WOFF 1.0 → SFNT: Tabellen entpacken und mit neuem Tabellenverzeichnis hintereinander legen. */
export function woffZuTtf(w: Buffer, familie?: string): Buffer {
  if (w.toString('ascii', 0, 4) !== 'wOFF') throw new Error('keine WOFF-1.0-Datei')
  const anzahl = w.readUInt16BE(12)
  const tabellen = Array.from({ length: anzahl }, (_, i) => {
    const o = 44 + i * 20
    const roh = w.subarray(w.readUInt32BE(o + 4), w.readUInt32BE(o + 4) + w.readUInt32BE(o + 8))
    const daten = w.readUInt32BE(o + 8) < w.readUInt32BE(o + 12) ? inflateSync(roh) : roh
    const tag = w.toString('ascii', o, o + 4)
    return { tag, daten: familie && tag === 'name' ? nameTabelle(familie) : daten, pruef: w.readUInt32BE(o + 16) }
  }).sort((a, b) => (a.tag < b.tag ? -1 : 1))
  const potenz = 2 ** Math.floor(Math.log2(anzahl))
  const kopf = Buffer.alloc(12 + 16 * anzahl)
  kopf.writeUInt32BE(w.readUInt32BE(4), 0)
  kopf.writeUInt16BE(anzahl, 4)
  kopf.writeUInt16BE(potenz * 16, 6)
  kopf.writeUInt16BE(Math.log2(potenz), 8)
  kopf.writeUInt16BE(anzahl * 16 - potenz * 16, 10)
  const teile: Buffer[] = [kopf]
  let pos = kopf.length
  tabellen.forEach((t, i) => {
    kopf.write(t.tag, 12 + i * 16, 'ascii')
    kopf.writeUInt32BE(t.pruef, 16 + i * 16)
    kopf.writeUInt32BE(pos, 20 + i * 16)
    kopf.writeUInt32BE(t.daten.length, 24 + i * 16)
    const fuell = (4 - (t.daten.length % 4)) % 4
    teile.push(t.daten, Buffer.alloc(fuell))
    pos += t.daten.length + fuell
  })
  return Buffer.concat(teile)
}

/**
 * Eigener Familienname je Schnitt: Pango merkt sich je Familie nur den zuerst geladenen Schnitt —
 * „Manrope 600" kam nach „Manrope 800" als 800 heraus (gemessen 27.09.2026). Mit „AKfett",
 * „AKhalbfett" usw. gibt es nichts zu verwechseln.
 */
export function pangoFamilie(schrift: Schrift): string {
  return `AK${schrift}`
}

/** Eine `name`-Tabelle (Format 0) mit Familie, Stil, vollem und PostScript-Namen, Windows/Unicode. */
function nameTabelle(familie: string): Buffer {
  const eintraege: [number, string][] = [
    [1, familie],
    [2, 'Regular'],
    [4, familie],
    [6, familie],
  ]
  const texte = eintraege.map(([, s]) => Buffer.from(s, 'utf16le').swap16())
  const kopf = Buffer.alloc(6 + 12 * eintraege.length)
  kopf.writeUInt16BE(0, 0)
  kopf.writeUInt16BE(eintraege.length, 2)
  kopf.writeUInt16BE(kopf.length, 4)
  let versatz = 0
  eintraege.forEach(([id], i) => {
    const o = 6 + i * 12
    kopf.writeUInt16BE(3, o)
    kopf.writeUInt16BE(1, o + 2)
    kopf.writeUInt16BE(0x409, o + 4)
    kopf.writeUInt16BE(id, o + 6)
    kopf.writeUInt16BE(texte[i].length, o + 8)
    kopf.writeUInt16BE(versatz, o + 10)
    versatz += texte[i].length
  })
  return Buffer.concat([kopf, ...texte])
}
