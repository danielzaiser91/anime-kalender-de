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

  writeFileSync(resolve(OUT, 'icon.svg'), icon(512, 0.08, true))
  log('App-Symbole in public/icons/ erzeugt')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
