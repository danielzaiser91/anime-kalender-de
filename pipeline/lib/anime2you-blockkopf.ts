/**
 * Titelblöcke in Sammelartikeln: Anime2You listet erst alle Titel, dann je Titel eine Titelzeile »Titel« mit den Zeilen
 * `Sprache:`, `Simulcast:`, `Stream:` darunter. Das Modell zitiert oft nur diese Zeilen, der Titel steht dann eine Zeile darüber.
 * Der Titel gilt in diesem Fall als belegt, wenn das Zitat im Block unter genau dieser Titelzeile steht – nicht schon, weil er irgendwo im Text vorkommt.
 */
import { woerter, zeichenfolge } from './anime2you-abgleich.ts'

/** Titelzeile: nur »Titel«, höchstens mit kurzem Zusatz („ – Staffel 2“). */
const TITELZEILE = /^»([^»«]{2,120})«(?:\s*[–-]\s*[^»«]{1,40})?$/
/** So viele Zeilen darf das Zitat unter der Titelzeile beginnen (Episoden, Sprache, Hinweis, Simulcast, Stream, Handlung). */
const MAX_ABSTAND = 8

/**
 * Die Titelzeilen der Blöcke, in denen das Zitat steht. Mehrere, wo derselbe Wortlaut in mehreren Blöcken vorkommt
 * („Sprache: Japanisch (UT)“): Er stimmt für jeden dieser Titel. Leer, wenn das Zitat in keinem Block liegt oder in einen zweiten hineinreicht.
 */
export function titelzeilenUeber(text: string, zitat: string): string[] {
  const zeilen = text.split('\n').map((z) => z.trim()).filter(Boolean)
  const anfang: number[] = []
  let gesamt = ''
  for (const z of zeilen) {
    anfang.push(gesamt.length)
    gesamt += zeichenfolge(z)
  }
  const gesucht = zeichenfolge(zitat)
  const zeileAn = (p: number): number => anfang.filter((a) => a <= p).length - 1
  const koepfe: string[] = []
  for (let pos = gesucht ? gesamt.indexOf(gesucht) : -1; pos >= 0; pos = gesamt.indexOf(gesucht, pos + 1)) {
    const erste = zeileAn(pos)
    const letzte = zeileAn(pos + gesucht.length - 1)
    if (zeilen.slice(erste + 1, letzte + 1).some((z) => TITELZEILE.test(z))) continue
    for (let i = erste; i >= Math.max(0, erste - MAX_ABSTAND); i--) {
      if (!TITELZEILE.test(zeilen[i]!)) continue
      koepfe.push(zeilen[i]!)
      break
    }
  }
  return koepfe
}

/** Nennt die Titelzeile genau diesen Titel? Der Name in »…« und der Titel haben dieselben Wörter; ein Zusatz wie „Staffel 2“ darf nur eine Seite tragen. */
export function titelzeilePasst(titel: string, zeile: string): boolean {
  const innen = woerter(TITELZEILE.exec(zeile)?.[1] ?? '')
  const gesucht = woerter(titel)
  const imKopf = new Set(woerter(zeile))
  return innen.length > 0 && innen.every((w) => gesucht.includes(w)) && gesucht.every((w) => imKopf.has(w))
}
