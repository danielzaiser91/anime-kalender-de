/**
 * Textebenen für die Vorschaubilder: jeder Text ist ein eigenes Bild aus sharps Texteingabe (Pango
 * mit `fontfile`) — SVG-Text hätte nur die Systemschriften (siehe `og-schriften.ts`).
 */
import sharp from 'sharp'
import { pangoFamilie, schriftDatei, SCHRIFTEN, type Schrift } from './og-schriften.ts'

/** Standardbreite eines Textblocks. */
export const TEXT_W = 680

export function markup(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Ein Textblock als Bild; `breite` bricht um, `hoehe` ist die Obergrenze der Messung. */
export async function text(inhalt: string, schrift: Schrift, groesse: number, farbe: string, breite = TEXT_W) {
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

/** Genau eine Zeile: Was nicht passt, wird am Wortende gekürzt und bekommt „…". */
export async function eineZeile(inhalt: string, schrift: Schrift, groesse: number, farbe: string, breite = TEXT_W) {
  const woerter = inhalt.split(/\s+/)
  let block = await text(markup(inhalt), schrift, groesse, farbe, breite)
  while (block.hoehe > groesse * 1.8 && woerter.length > 1) {
    woerter.pop()
    block = await text(`${markup(woerter.join(' ').replace(/[,;:·–-]$/, ''))} …`, schrift, groesse, farbe, breite)
  }
  return block
}
