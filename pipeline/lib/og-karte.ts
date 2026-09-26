/**
 * Das Vorschaubild im Poster-Stil der Seite (27.09.2026): dunkler Grund, Cover links in voller
 * Höhe, rechts Anbieter-Chips, Titel in Unbounded, die Eckdaten als Raster, unten die Wortmarke.
 *
 * Jeder Text ist eine eigene Ebene aus sharps Texteingabe (Pango mit `fontfile`) — SVG-Text
 * hätte nur die Systemschriften (siehe `og-schriften.ts`).
 */
import sharp from 'sharp'
import type { OverlayOptions } from 'sharp'
import { pangoFamilie, schriftDatei, SCHRIFTEN, type Schrift } from './og-schriften.ts'

export const W = 1200
export const H = 630
const COVER_W = 420
const X = COVER_W + 50
const TEXT_W = W - X - 50

const GRUND = '#0d0f14'
const TEXT = '#f2f1ee'
const LEISE = '#9aa0ab'
const AKZENT = '#ff5a36'

export interface KartenDaten {
  title: string
  subtitle?: string
  lines: { label: string; value: string }[]
  badges: { text: string; color: string }[]
  /** Farbe des Streifens unter dem Cover — der Anbieter. */
  accent: string
}

function markup(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Ein Textblock als Bild; `breite` bricht um, `hoehe` ist die Obergrenze der Messung. */
async function text(inhalt: string, schrift: Schrift, groesse: number, farbe: string, breite = TEXT_W) {
  const s = SCHRIFTEN[schrift]
  /* Das Gewicht steht im Markup: Pango kennt jede Familie nur einmal, der Schnitt kommt über `weight`. */
  const bild = await sharp({
    text: {
      text: `<span foreground="${farbe}" weight="${s.gewicht}">${inhalt}</span>`,
      font: `${pangoFamilie(schrift)} ${groesse}`,
      fontfile: schriftDatei(schrift),
      width: breite,
      rgba: true,
      dpi: 72,
      wrap: 'word',
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true })
  return { input: bild.data, hoehe: bild.info.height, breite: bild.info.width }
}

/**
 * Der Titel so groß wie möglich, höchstens drei Zeilen: erst 56 px, dann kleiner; passt er auch
 * bei 38 px nicht, wird er am Wortende gekürzt.
 */
async function titel(t: string) {
  for (const groesse of [56, 48, 40]) {
    const block = await text(markup(t), 'titel', groesse, TEXT)
    if (block.hoehe <= groesse * 1.3 * (groesse >= 48 ? 2 : 3)) return block
  }
  const woerter = t.split(/\s+/)
  while (woerter.length > 1) {
    woerter.pop()
    const block = await text(`${markup(woerter.join(' '))} …`, 'titel', 40, TEXT)
    if (block.hoehe <= 40 * 1.3 * 3) return block
  }
  return text(markup(t), 'titel', 40, TEXT)
}

/** Genau eine Zeile: Was nicht passt, wird am Wortende gekürzt und bekommt „…". */
async function eineZeile(inhalt: string, schrift: Schrift, groesse: number, farbe: string, breite = TEXT_W) {
  const woerter = inhalt.split(/\s+/)
  let block = await text(markup(inhalt), schrift, groesse, farbe, breite)
  while (block.hoehe > groesse * 1.8 && woerter.length > 1) {
    woerter.pop()
    block = await text(`${markup(woerter.join(' ').replace(/[,;:·–-]$/, ''))} …`, schrift, groesse, farbe, breite)
  }
  return block
}

/** Chips wie auf der Seite: Punkt in der Farbe, Text hell auf dunkler Fläche. */
async function chips(badges: KartenDaten['badges'], y: number): Promise<OverlayOptions[]> {
  const ebenen: OverlayOptions[] = []
  let x = X
  for (const b of badges) {
    const t = await text(markup(b.text), 'fett', 20, TEXT, 400)
    const breite = t.breite + 52
    if (x + breite > W - 50) break
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="40"><rect x="1" y="1" width="${breite - 2}" height="38" rx="19" fill="#1b202a" stroke="#2c3240"/><circle cx="21" cy="20" r="6" fill="${b.color}"/></svg>`
    ebenen.push({ input: Buffer.from(svg), top: y, left: x }, { input: t.input, top: y + Math.round((40 - t.hoehe) / 2), left: x + 36 })
    x += breite + 10
  }
  return ebenen
}

/** Die Eckdaten als Raster aus zwei Spalten: Beschriftung klein und leise, Wert groß. */
async function raster(lines: KartenDaten['lines'], y: number): Promise<OverlayOptions[]> {
  const ebenen: OverlayOptions[] = []
  const spalte = Math.floor(TEXT_W / 2)
  /* Höchstens fünf: die sechste Zelle unten rechts gehört der Wortmarke. */
  for (const [i, l] of lines.slice(0, 5).entries()) {
    const x = X + (i % 2) * spalte
    const top = y + Math.floor(i / 2) * 66
    const label = await text(markup(l.label.toUpperCase()), 'fett', 15, LEISE, spalte - 20)
    const wert = await eineZeile(l.value, 'halbfett', 26, TEXT, spalte - 20)
    ebenen.push({ input: label.input, top, left: x }, { input: wert.input, top: top + 22, left: x })
  }
  return ebenen
}

/** Die Wortmarke unten rechts: „anime·kalender" mit dem Punkt im Akzent. */
async function wortmarke(): Promise<OverlayOptions> {
  const marke = await text(`anime<span foreground="${AKZENT}">·</span>kalender`, 'marke', 26, TEXT, 400)
  return { input: marke.input, top: H - 40 - marke.hoehe, left: W - 50 - marke.breite }
}

async function coverEbenen(cover: Buffer | undefined, farbe: string): Promise<OverlayOptions[]> {
  if (!cover) {
    /* Ohne Cover: eine Fläche mit dem Logo, damit die Karte nicht halb leer wirkt. */
    const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${H}"><rect width="${COVER_W}" height="${H}" fill="#151922"/><g transform="translate(${(COVER_W - 200) / 2} ${(H - 200) / 2}) scale(0.39)"><rect width="512" height="512" rx="102" fill="#1b2130"/><rect x="41" y="101" width="430" height="370" rx="95" fill="#e6e9f0"/><rect x="41" y="101" width="430" height="96" rx="95" fill="#38bdf8"/><rect x="41" y="168" width="430" height="37" fill="#38bdf8"/><rect x="144" y="67" width="34" height="69" rx="17" fill="#e6e9f0"/><rect x="333" y="67" width="34" height="69" rx="17" fill="#e6e9f0"/><path d="M213 268 351 342 213 416Z" fill="#0f1420"/></g><rect y="${H - 10}" width="${COVER_W}" height="10" fill="${farbe}"/></svg>`
    return [{ input: Buffer.from(logo), top: 0, left: 0 }]
  }
  const bild = await sharp(cover).resize(COVER_W, H, { fit: 'cover', position: 'attention' }).png().toBuffer()
  const verlauf = `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${H}"><defs><linearGradient id="v" x1="0" x2="1"><stop offset="0.8" stop-color="${GRUND}" stop-opacity="0"/><stop offset="1" stop-color="${GRUND}" stop-opacity="1"/></linearGradient></defs><rect width="${COVER_W}" height="${H}" fill="url(#v)"/><rect y="${H - 10}" width="${COVER_W}" height="10" fill="${farbe}"/></svg>`
  return [{ input: bild, top: 0, left: 0 }, { input: Buffer.from(verlauf), top: 0, left: 0 }]
}

export async function zeichneKarte(daten: KartenDaten, cover: Buffer | undefined, datei: string): Promise<void> {
  const ebenen: OverlayOptions[] = [...(await coverEbenen(cover, daten.accent))]
  let y = 52
  ebenen.push(...(await chips(daten.badges, y)))
  y += daten.badges.length ? 40 + 26 : 0
  const t = await titel(daten.title)
  ebenen.push({ input: t.input, top: y, left: X })
  y += t.hoehe + 8
  if (daten.subtitle) {
    const u = await eineZeile(daten.subtitle, 'text', 24, LEISE)
    ebenen.push({ input: u.input, top: y, left: X })
    y += 32
  }
  ebenen.push(...(await raster(daten.lines, y + 26)))
  ebenen.push(await wortmarke())
  await sharp({ create: { width: W, height: H, channels: 4, background: GRUND } })
    .composite(ebenen)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(datei)
}
