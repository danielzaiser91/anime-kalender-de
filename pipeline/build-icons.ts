/**
 * Erzeugt die App-Symbole für die Installation auf dem Startbildschirm.
 *
 * Warum aus einer Zeichnung statt aus einem Emoji: Das bisherige Favicon war
 * ein 📺 in einem SVG. Als App-Symbol taugt das nicht — jedes Betriebssystem
 * zeichnet Emoji anders, unter Windows fehlen manche ganz, und ein Symbol mit
 * transparentem Rand bekommt auf Android einen weißen Kasten verpasst.
 *
 * Erzeugt werden deshalb echte PNGs in den Größen, die die Systeme wirklich
 * abfragen — inklusive einer `maskable`-Fassung mit Sicherheitsabstand, damit
 * Android sie in seine Kreis- oder Kleeblattform schneiden kann, ohne dass
 * etwas Wichtiges wegfällt.
 *
 * Aufruf: npm run data:icons
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { ROOT, log } from './lib/util.ts'

const OUT = resolve(ROOT, 'public/icons')

/** Markenfarben, identisch zur Oberfläche. */
const BG = '#0f1420'
const ACCENT = '#38bdf8'
const PAPER = '#e6e9f0'

/**
 * Das Motiv: ein Kalenderblatt, dessen unterste Reihe zur Abspieltaste wird.
 *
 * `inset` schiebt die Zeichnung nach innen. Für die maskable-Fassung braucht
 * es davon reichlich: Android schneidet bis zu 20 % vom Rand weg.
 */
function icon(size: number, inset: number, rounded: boolean): Buffer {
  const s = size
  const pad = s * inset
  const w = s - pad * 2
  const r = rounded ? w * 0.22 : 0
  // Kalenderblatt
  const top = pad + w * 0.14
  const bodyH = w - w * 0.14
  const ringY = pad + w * 0.06

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" ${rounded ? `rx="${s * 0.2}"` : ''} fill="${BG}"/>
  <rect x="${pad}" y="${top}" width="${w}" height="${bodyH}" rx="${r}" fill="${PAPER}"/>
  <rect x="${pad}" y="${top}" width="${w}" height="${bodyH * 0.26}" rx="${r}" fill="${ACCENT}"/>
  <rect x="${pad}" y="${top + bodyH * 0.18}" width="${w}" height="${bodyH * 0.1}" fill="${ACCENT}"/>
  <rect x="${pad + w * 0.24}" y="${ringY}" width="${w * 0.08}" height="${w * 0.16}" rx="${w * 0.04}" fill="${PAPER}"/>
  <rect x="${pad + w * 0.68}" y="${ringY}" width="${w * 0.08}" height="${w * 0.16}" rx="${w * 0.04}" fill="${PAPER}"/>
  <path d="M ${pad + w * 0.4} ${top + bodyH * 0.45}
           L ${pad + w * 0.72} ${top + bodyH * 0.65}
           L ${pad + w * 0.4} ${top + bodyH * 0.85} Z"
        fill="${BG}"/>
</svg>`)
}

async function write(name: string, size: number, inset: number, rounded: boolean): Promise<void> {
  const png = await sharp(icon(size, inset, rounded)).png({ compressionLevel: 9 }).toBuffer()
  writeFileSync(resolve(OUT, name), png)
}

/**
 * Schreibt `public/favicon.ico` — die Adresse, die niemand anmeldet und trotzdem
 * jeder abfragt.
 *
 * Browser und Suchmaschinen holen `/favicon.ico` auch ohne `<link>`-Angabe. Bei
 * uns lief das bis zum 17.08.2026 in die 404-Seite, also in 1,6 KB HTML für jeden,
 * der vorbeikommt. Googles Dokumentation verlangt die Datei nicht — sie will ein
 * `<link>` —, aber sie kostet fast nichts und beendet einen Dauerfehler.
 *
 * Ein ICO ist hier nur eine Hülle: Seit Windows Vista darf darin ein PNG stecken,
 * und genau das tun wir. Sechs Byte Verzeichniskopf, sechzehn Byte Eintrag, dann
 * die PNG-Daten — kein Fremdpaket nötig.
 */
async function schreibeIco(): Promise<void> {
  const kante = 48
  const png = await sharp(icon(kante, 0.04, true)).png({ compressionLevel: 9 }).toBuffer()

  const kopf = Buffer.alloc(6)
  kopf.writeUInt16LE(0, 0) // reserviert, immer 0
  kopf.writeUInt16LE(1, 2) // Typ 1 = Symbol
  kopf.writeUInt16LE(1, 4) // ein einziges Bild

  const eintrag = Buffer.alloc(16)
  eintrag.writeUInt8(kante, 0) // Breite
  eintrag.writeUInt8(kante, 1) // Höhe
  eintrag.writeUInt8(0, 2) // keine Farbtabelle
  eintrag.writeUInt8(0, 3) // reserviert
  eintrag.writeUInt16LE(1, 4) // Farbebenen
  eintrag.writeUInt16LE(32, 6) // Bit je Bildpunkt
  eintrag.writeUInt32LE(png.length, 8)
  eintrag.writeUInt32LE(kopf.length + eintrag.length, 12) // Beginn der Bilddaten

  writeFileSync(resolve(ROOT, 'public/favicon.ico'), Buffer.concat([kopf, eintrag, png]))
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })

  // Normale Symbole: knapper Rand, abgerundete Ecken zeichnen wir selbst.
  await write('icon-192.png', 192, 0.08, true)
  await write('icon-512.png', 512, 0.08, true)
  // Apple schneidet nicht und rundet selbst — hier keine eigenen Ecken.
  await write('apple-touch-icon.png', 180, 0.08, false)
  // Maskable: viel Luft, volle Fläche, weil Android beliebig zuschneidet.
  await write('icon-maskable-512.png', 512, 0.22, false)

  // Fallback für Browser, die kein SVG-Favicon mögen.
  await write('favicon-32.png', 32, 0.04, true)

  /**
   * Für Google: ein Rastersymbol **über** 48 Pixeln.
   *
   * In der Ergebnisliste stand statt unseres Symbols der graue Standard-Globus
   * (Daniel, 17.08.2026, Screenshot). Angemeldet waren nur das SVG und ein 32er
   * PNG — und die Google-Dokumentation ist an dieser Stelle eindeutig: „Your
   * favicon must be a square (1:1 aspect ratio) that's at least 8x8px. While the
   * minimum size requirement is 8x8px, we recommend using a favicon that's larger
   * than 48x48px so that it looks good on various surfaces."
   *
   * 96 statt 64, damit die Kante auf einem Bildschirm mit doppelter Dichte noch
   * sauber bleibt. Die Datei kostet unter zwei Kilobyte.
   */
  await write('favicon-96.png', 96, 0.04, true)

  writeFileSync(resolve(OUT, 'icon.svg'), icon(512, 0.08, true))
  await schreibeIco()
  log('App-Symbole in public/icons/ erzeugt')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
