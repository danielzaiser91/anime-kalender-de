#!/usr/bin/env node
/**
 * Pixelprobe der Cover-Karten in der Reihenliste auf der Bühne (Mockup `reihen-box`, Variante B, PR „Reihen-Box als Cover-Karussell", 20.10.2026).
 * Variante B hängt unter den Kopf eine zweite Reihenliste mit festen Zuständen (gewählt, künftig, gemerkt, normal); gemessen wird an Pixeln, nicht an Klassen:
 *  - gewählt: an allen vier Kanten (auch der Unterkante) liegen genau zwei Pixelreihen in der Ringfarbe außerhalb des Covers (nicht abgeschnitten);
 *  - künftig: der gestrichelte Rand liegt an allen vier Kanten als Folge von Strichen und Lücken im Cover (≥ 4 Wechsel je Kante); eine normale Karte hat keinen (0 Wechsel);
 *  - gemerkt: Stern samt Pille liegen mindestens 3 px im Cover, die Pille hebt sich vom Cover ab, im Stern finden sich Pixel in der Sternfarbe; eine nicht gemerkte Karte hat keinen Stern.
 * Aufruf: node tools/buehne-reihen-messen.mjs [--fall <name>]    (vorher `npm run buehne:bauen`); Ergebniszeile je Zelle, Exit 1 bei einem Verstoß. Kein Teil von `check:vor-commit`.
 */
import { argument, oeffneZellen, starteBuehne } from './buehne-seite.mjs'
import { pathToFileURL } from 'node:url'

const FALL = argument('--fall', 'attack-on-titan')
const MIN_INNEN = 3
const WECHSEL_GESTRICHELT = 4

/** Im Rahmen: scrollt die Messfläche ins Bild und liefert Maße und Farben aller Karten. */
export function kartenImRahmen(zeige) {
  const flaeche = document.querySelector('[data-zustaende]')
  flaeche?.scrollIntoView({ block: 'center', behavior: 'instant' })
  if (zeige !== undefined) flaeche?.querySelectorAll('[role="tab"]')[zeige]?.scrollIntoView({ inline: 'center', block: 'center', behavior: 'instant' })
  const rect = (e) => {
    const r = e.getBoundingClientRect()
    return { l: r.left, t: r.top, r: r.right, b: r.bottom }
  }
  return [...(flaeche?.querySelectorAll('[role="tab"]') ?? [])].map((k) => {
    const cover = k.firstElementChild
    const stil = getComputedStyle(cover)
    const stern = [...cover.querySelectorAll('span')].find((s) => s.textContent.trim() === '★')
    return {
      gewaehlt: k.getAttribute('aria-selected') === 'true',
      gestrichelt: stil.outlineStyle === 'dashed',
      ringFarbe: stil.outlineColor,
      cover: rect(cover),
      stern: stern ? rect(stern) : undefined,
      sternFarbe: stern ? getComputedStyle(stern).color : undefined,
    }
  })
}

/** Im Hauptfenster: Farben (r,g,b) der Bildpunkte eines PNG. */
export async function pixelAus(seite, png, punkte) {
  return seite.evaluate(
    async ({ b64, punkte }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }))
      const g = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d')
      g.drawImage(bmp, 0, 0)
      return punkte.map(([x, y]) => [...g.getImageData(Math.floor(x), Math.floor(y), 1, 1).data.slice(0, 3)])
    },
    { b64: png.toString('base64'), punkte },
  )
}

const abstand = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])))
const rgbVon = (text) => (text.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)

/** Zahl der Wechsel zwischen „weicht vom Innenpixel ab" und „gleich" entlang einer Reihe Bildpunkte. */
export function wechsel(randpixel, innenpixel) {
  const marke = randpixel.map((p, i) => abstand(p, innenpixel[i]) > 12)
  return marke.reduce((n, m, i) => (i > 0 && m !== marke[i - 1] ? n + 1 : n), 0)
}

/**
 * Die Bildschirmpixel lassen sich um ein bis zwei Reihen gegen die Rechtecke verschieben (Teilpixel-Scrollstand der Bühne): Gesucht wird deshalb nicht an einer festen Reihe,
 * sondern in einem Band um die Kante. Je Kante liefert `band(k)` die Bildpunkte einer Reihe im Abstand `k` von der Kante (negativ = außerhalb des Covers) als Liste.
 */
export function kantenBand(c, k) {
  const xs = Array.from({ length: Math.max(0, Math.floor(c.r - c.l) - 20) }, (_, i) => Math.ceil(c.l) + 10 + i)
  const ys = Array.from({ length: Math.max(0, Math.floor(c.b - c.t) - 20) }, (_, i) => Math.ceil(c.t) + 10 + i)
  return {
    oben: xs.map((x) => [x, Math.ceil(c.t) + k]),
    unten: xs.map((x) => [x, Math.floor(c.b) - 1 - k]),
    links: ys.map((y) => [Math.ceil(c.l) + k, y]),
    rechts: ys.map((y) => [Math.floor(c.r) - 1 - k, y]),
  }
}

const KANTEN = ['oben', 'unten', 'links', 'rechts']
/** Reihen im Abstand −4 … +5 von der Kante (negativ außen) für alle vier Kanten, je Reihe die Farben der Bildpunkte. */
async function leseBand(seite, png, c) {
  const abstaende = Array.from({ length: 10 }, (_, i) => i - 4)
  const ergebnis = Object.fromEntries(KANTEN.map((n) => [n, []]))
  for (const k of abstaende) {
    const reihen = kantenBand(c, k)
    for (const n of KANTEN) ergebnis[n].push(await pixelAus(seite, png, reihen[n]))
  }
  return ergebnis
}

/** Gewählt: Je Kante liegen genau 2 Reihen in der Ringfarbe, mehr (nicht abgeschnitten) und nicht weniger (fehlt/abgeschnitten) gibt es nicht. */
async function pruefeGewaehlt(seite, png, karte) {
  const soll = rgbVon(karte.ringFarbe)
  const band = await leseBand(seite, png, karte.cover)
  const reihen = (n) => band[n].filter((px) => px.length && px.every((p) => abstand(p, soll) <= 3)).length
  const je = Object.fromEntries(KANTEN.map((n) => [n, reihen(n)]))
  return { ok: KANTEN.every((n) => je[n] === 2), text: `Reihen in Ringfarbe ${JSON.stringify(soll)} je Kante ${JSON.stringify(je)} (soll 2)` }
}

/** Künftig: In einer der Reihen am Rand wechseln Strich und Lücke (≥ 4 Wechsel) an allen vier Kanten; die normale Karte hat nirgends einen Wechsel. */
async function wechselJeKante(seite, png, c) {
  const band = await leseBand(seite, png, c)
  const innen = 9
  return Object.fromEntries(KANTEN.map((n) => [n, Math.max(0, ...[-2, -1, 0, 1, 2, 3].map((i) => wechsel(band[n][4 + i], band[n][innen])))]))
}

async function pruefeGestrichelt(seite, kuenftig, normal) {
  const k = await wechselJeKante(seite, kuenftig.png, kuenftig.karte.cover)
  const n = await wechselJeKante(seite, normal.png, normal.karte.cover)
  const ok = Object.values(k).every((z) => z >= WECHSEL_GESTRICHELT) && Object.values(n).every((z) => z === 0)
  return { ok, text: `Wechsel je Kante künftig ${JSON.stringify(k)}, normale Karte ${JSON.stringify(n)}` }
}

async function pruefeStern(seite, png, karte) {
  const c = karte.cover
  const s = karte.stern
  const p = s
  const innen = [p.l - c.l, p.t - c.t, c.r - p.r, c.b - p.b].every((a) => a >= MIN_INNEN)
  const mitte = (s.t + s.b) / 2
  const [pille, cover] = await pixelAus(seite, png, [[p.l + 1.5, mitte], [p.r + 4, mitte]])
  const hebtAb = abstand(pille, cover) > 6
  const soll = rgbVon(karte.sternFarbe)
  const punkte = []
  for (let x = Math.floor(s.l); x < s.r; x++) for (let y = Math.floor(s.t); y < s.b; y++) punkte.push([x + 0.5, y + 0.5])
  const treffer = (await pixelAus(seite, png, punkte)).filter((q) => abstand(q, soll) <= 40).length
  return { ok: innen && hebtAb && treffer >= 5, text: `Pille ≥ ${MIN_INNEN} px im Cover ${innen}, hebt sich ab ${hebtAb}, ${treffer} Pixel in Sternfarbe` }
}

/** Zeigt die Karte mit der Rolle (`wahl(karte)`) mittig in der Spur und liefert sie samt Bild des ganzen Rahmens. */
async function zeigeKarte(z, wahl) {
  const index = (await z.frame.evaluate(kartenImRahmen)).findIndex(wahl)
  if (index < 0) return undefined
  await z.frame.evaluate(kartenImRahmen, index)
  await z.frame.waitForTimeout(300)
  const karte = (await z.frame.evaluate(kartenImRahmen, index))[index]
  return { karte, png: await (await z.frame.frameElement()).screenshot() }
}

async function messeZelle(seite, z) {
  const gewaehlt = await zeigeKarte(z, (k) => k.gewaehlt)
  const kuenftig = await zeigeKarte(z, (k) => k.gestrichelt)
  const gemerkt = await zeigeKarte(z, (k) => Boolean(k.stern))
  const normal = await zeigeKarte(z, (k) => !k.gewaehlt && !k.gestrichelt && !k.stern)
  const fehlt = [!gewaehlt && 'gewählte Karte', !kuenftig && 'künftige Karte', !gemerkt && 'gemerkte Karte', !normal && 'normale Karte'].filter(Boolean)
  if (fehlt.length) return [{ ok: false, text: `Fall unvollständig, es fehlt: ${fehlt.join(', ')}` }]
  const alle = await z.frame.evaluate(kartenImRahmen)
  const genauEinStern = alle.filter((k) => k.stern).length === 1
  return [
    await pruefeGewaehlt(seite, gewaehlt.png, gewaehlt.karte),
    await pruefeGestrichelt(seite, kuenftig, normal),
    await pruefeStern(seite, gemerkt.png, gemerkt.karte),
    { ok: genauEinStern, text: `genau eine Karte mit Stern ${genauEinStern}` },
  ]
}


async function main() {
  const { browser, seite } = await starteBuehne()
  let rot = 0
  const zellen = await oeffneZellen(seite, { mockup: 'reihen-box', variante: 'B', fall: FALL, teil: 'nachher' })
  for (const z of zellen) {
    const antworten = await messeZelle(seite, z)
    const ok = antworten.every((a) => a.ok)
    if (!ok) rot++
    console.log(`${ok ? 'ok ' : 'ROT'} reihen-box B ${FALL} ${z.schluessel}: ${antworten.map((a) => `${a.ok ? '✓' : '✖'} ${a.text}`).join(' | ')}`)
  }
  await browser.close()
  console.log(`buehne-reihen-messen: ${zellen.length} Zellen, ${rot} rot`)
  process.exitCode = rot || !zellen.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
