/**
 * Das Vorschaubild im Kino-Stil (Daniel, 14.10.2026): das Cover als Plakat rechts und unscharf noch
 * einmal als Hintergrund, links Marke, Titel, der Termin als orange Datumsmarke, die Chips unten.
 * Ohne Cover bleiben Glut und Wasserzeichen der Marke (wie im Standardbild).
 *
 * Jeder Text ist eine eigene Ebene (`og-text.ts`); Marke und Wortmarke stehen in `og-lockup.ts`.
 */
import sharp from 'sharp'
import type { OverlayOptions } from 'sharp'
import { lockup } from './og-lockup.ts'
import { MARKE_INNEN, MARKE_KACHEL } from './og-marke.ts'
import { eineZeile, markup, text } from './og-text.ts'

export const W = 1200
export const H = 630
const X = 70
const POSTER = { x: 800, y: 60, w: 340, h: 510, r: 18 }
const TEXT_BREITE = 680

export const GRUND = '#0d0f14'
export const TEXT = '#f2f1ee'
export const LEISE = '#9aa0ab'
export const AKZENT = '#ff5a36'

export interface KartenDaten {
  title: string
  /** Datumsmarke („Fr, 16.10."), daneben `folge`, darunter `fakt` (leer = keine Zeile). */
  datum: string
  folge: string
  fakt: string
  /** `akzent`: Chip im Akzent statt im Grau (Läuft). */
  badges: { text: string; color: string; akzent?: boolean }[]
}

/**
 * Der Titel so groß wie möglich, höchstens zwei Zeilen: erst 62 px, dann kleiner; passt er auch
 * bei 38 px nicht, wird er am Wortende gekürzt.
 */
async function titel(t: string) {
  const passt = (hoehe: number, groesse: number) => hoehe <= groesse * 1.3 * 2
  for (const groesse of [62, 52, 44, 38]) {
    const block = await text(markup(t), 'titel', groesse, TEXT, TEXT_BREITE)
    if (passt(block.hoehe, groesse)) return block
  }
  const woerter = t.split(/\s+/)
  while (woerter.length > 1) {
    woerter.pop()
    const block = await text(`${markup(woerter.join(' '))} …`, 'titel', 38, TEXT, TEXT_BREITE)
    if (passt(block.hoehe, 38)) return block
  }
  return text(markup(t), 'titel', 38, TEXT, TEXT_BREITE)
}

/** Chips wie auf der Seite: Punkt in der Farbe, Text hell auf dunkler Fläche; `bis` ist die rechte Grenze. */
async function chips(badges: KartenDaten['badges'], y: number, bis: number): Promise<OverlayOptions[]> {
  const ebenen: OverlayOptions[] = []
  let x = X
  for (const b of badges) {
    const t = await text(markup(b.text), 'fett', 24, b.akzent ? '#ff7a5c' : TEXT, 400)
    const breite = t.breite + 48
    if (x + breite > bis) break
    const rand = b.akzent ? AKZENT : '#2c3240'
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="48"><rect x="1" y="1" width="${breite - 2}" height="46" rx="23" fill="#1b202a" stroke="${rand}" stroke-width="2"/><circle cx="28" cy="24" r="6" fill="${b.color}"/></svg>`
    ebenen.push({ input: Buffer.from(svg), top: y, left: x }, { input: t.input, top: y + Math.round((48 - t.hoehe) / 2), left: x + 40 })
    x += breite + 12
  }
  return ebenen
}

/** Datumsmarke in der Akzentfarbe, daneben die Folgen; liefert die Ebenen. */
async function datumZeile(datum: string, folge: string, y: number): Promise<OverlayOptions[]> {
  const marke = await text(markup(datum), 'fett', 40, GRUND, 400)
  const breite = marke.breite + 48
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="72"><rect width="${breite}" height="72" rx="14" fill="${AKZENT}"/></svg>`
  const ebenen: OverlayOptions[] = [
    { input: Buffer.from(svg), top: y, left: X },
    { input: marke.input, top: y + Math.round((72 - marke.hoehe) / 2), left: X + 24 },
  ]
  if (folge) {
    const t = await eineZeile(folge, 'halbfett', 36, TEXT, TEXT_BREITE - breite - 20)
    ebenen.push({ input: t.input, top: y + Math.round((72 - t.hoehe) / 2), left: X + breite + 20 })
  }
  return ebenen
}

/** Glut unten links und die Marke als Wasserzeichen rechts: der Grund ohne Cover und für das Standardbild. */
export function glutEbenen(): OverlayOptions[] {
  /* Eine Ebene in Bildgröße: sharp legt nichts über den Rand hinaus (Glut und Zeichen ragen aus dem Bild). */
  const grund = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="250" cy="550" r="350"><stop offset="0" stop-color="${AKZENT}" stop-opacity="0.42"/><stop offset="1" stop-color="${AKZENT}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><g opacity="0.1" transform="translate(720 -40) scale(${620 / 64})"><rect width="64" height="64" rx="14" fill="${MARKE_KACHEL}"/>${MARKE_INNEN}</g></svg>`
  return [{ input: Buffer.from(grund), top: 0, left: 0 }]
}

/** Cover unscharf als Hintergrund, abgedunkelt nach links, dazu das Plakat mit Schatten und Rand. */
async function coverEbenen(cover: Buffer): Promise<OverlayOptions[]> {
  const hintergrund = await sharp(cover).resize(W, H, { fit: 'cover', position: 'attention' }).blur(44).modulate({ saturation: 1.2 }).png().toBuffer()
  const dunkel = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="d" x1="0" x2="1"><stop offset="0" stop-color="${GRUND}" stop-opacity="1"/><stop offset="0.55" stop-color="${GRUND}" stop-opacity="0.86"/><stop offset="1" stop-color="${GRUND}" stop-opacity="0.35"/></linearGradient></defs><rect width="${W}" height="${H}" fill="${GRUND}" fill-opacity="0.45"/><rect width="${W}" height="${H}" fill="url(#d)"/></svg>`
  const { x, y, w, h, r } = POSTER
  const schatten = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter></defs><rect x="${x}" y="${y + 30}" width="${w}" height="${h}" rx="${r}" fill="#000" fill-opacity="0.6" filter="url(#s)"/></svg>`
  const maske = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}"/></svg>`)
  const plakat = await sharp(cover).resize(w, h, { fit: 'cover', position: 'attention' }).composite([{ input: maske, blend: 'dest-in' }]).png().toBuffer()
  const rand = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="${r - 1}" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="3"/></svg>`
  return [
    { input: hintergrund, top: 0, left: 0 },
    { input: Buffer.from(dunkel), top: 0, left: 0 },
    { input: Buffer.from(schatten), top: 0, left: 0 },
    { input: plakat, top: y, left: x },
    { input: Buffer.from(rand), top: y, left: x },
  ]
}

export async function zeichneKarte(daten: KartenDaten, cover: Buffer | undefined, datei: string): Promise<void> {
  const ebenen: OverlayOptions[] = cover ? await coverEbenen(cover) : glutEbenen()
  ebenen.push(...(await lockup(X, 56, 46, 30)))
  const t = await titel(daten.title)
  ebenen.push({ input: t.input, top: 160, left: X })
  if (daten.datum) ebenen.push(...(await datumZeile(daten.datum, daten.folge, 362)))
  if (daten.fakt) {
    const fakt = await eineZeile(daten.fakt, 'halbfett', 30, LEISE, TEXT_BREITE)
    ebenen.push({ input: fakt.input, top: 454, left: X })
  }
  ebenen.push(...(await chips(daten.badges, 534, cover ? POSTER.x - 15 : W - 50)))
  await sharp({ create: { width: W, height: H, channels: 4, background: GRUND } })
    .composite(ebenen)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(datei)
}
