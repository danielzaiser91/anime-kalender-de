/**
 * Messung des Abzeichens „angekündigt“ auf der Datenbank-Kachel (PR 2366, Prüfer-Auflage A1, Messregel K9): am Handy (360 px), hell und dunkel,
 * dieselbe Kachel einmal mit und einmal ohne Abzeichen (es wird ausgeblendet). Gemessen werden die Lage (Abstand zu Rand und Streifen) und
 * Pixel: die vier Kachelecken, die Unterkante der Kachel, die Zeile unter dem Abzeichen und die Pixel außerhalb seiner Ecken bleiben gleich,
 * die Mitte des Abzeichens ändert sich. Die Kachel ist die erste mit `os` und `ankuendigung.synchro: angekuendigt` aus `dist/data/titles.json`;
 * gibt es keine, steht eine Zeile „übersprungen“ da (kein Fehler). Regeln: `abzeichen-urteil.mjs`.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { lageFehler, pixelFehler } from './abzeichen-urteil.mjs'

const BREITE = 360
const KACHEL = 'div.cursor-pointer:has(span.bg-ak-info-grund)'
const ABZEICHEN = `${KACHEL} span.bg-ak-info-grund`

/** Die Suche nach der ersten Kachel mit Abzeichen: Name des Titels oder `undefined`. */
async function suchname(dist) {
  const datei = path.join(dist, 'data/titles.json')
  if (!existsSync(datei)) return undefined
  const titel = JSON.parse(await readFile(datei, 'utf8'))
  const t = titel.find((x) => x.os && x.ankuendigung?.synchro === 'angekuendigt')
  return t && (t.titleDe ?? t.titleEn ?? t.titleRomaji)
}

/** Rechtecke (Kachel, Abzeichen, Streifen) relativ zur Kachel. Läuft im Browser. */
function rechtecke([kachel, abzeichen]) {
  const k = document.querySelector(kachel)
  const a = document.querySelector(abzeichen)
  const s = [...k.querySelectorAll('span')].find((x) => x.className.includes('inset-x-0'))
  const o = k.getBoundingClientRect()
  const rel = (e) => {
    const r = e.getBoundingClientRect()
    return { l: Math.round(r.left - o.left), t: Math.round(r.top - o.top), r: Math.round(r.right - o.left), b: Math.round(r.bottom - o.top) }
  }
  return { k: rel(k), a: rel(a), s: rel(s) }
}

/** Mess-Punkte [name, x, y] in Kachelkoordinaten. */
function punkte({ k, a }) {
  const w = k.r - k.l
  const h = k.b - k.t
  const mx = Math.round((a.l + a.r) / 2)
  return {
    gleich: [
      ['Kachelecke oben links', 0, 0],
      ['Kachelecke oben rechts', w - 1, 0],
      ['Kachelecke unten links', 0, h - 1],
      ['Kachelecke unten rechts', w - 1, h - 1],
      ['Unterkante der Kachel', Math.round(w / 2), h - 1],
      ['Zeile unter dem Abzeichen (links)', a.l + 2, a.b + 2],
      ['Zeile unter dem Abzeichen (Mitte)', mx, a.b + 2],
      ['Zeile unter dem Abzeichen (rechts)', a.r - 2, a.b + 2],
      ['Pixel außerhalb der Ecke oben links', a.l - 2, a.t - 2],
      ['Pixel außerhalb der Ecke unten rechts', a.r + 2, a.b + 2],
    ],
    sichtbar: [mx, Math.round((a.t + a.b) / 2)],
  }
}

/** Misst eine Kachel in einem Thema; liefert die Fehlertexte. `lesePixel` liest Pixel aus einem PNG (läuft im Browser). */
async function messeThema(seite, lesePixel, name) {
  const kachel = seite.locator(KACHEL).first()
  await kachel.scrollIntoViewIfNeeded()
  await seite.waitForTimeout(400)
  const lage = await seite.evaluate(rechtecke, [KACHEL, ABZEICHEN])
  const p = punkte(lage)
  const liste = [...p.gleich.map(([, x, y]) => [x, y]), p.sichtbar]
  const mit = await lesePixel({ png: (await kachel.screenshot()).toString('base64'), punkte: liste })
  await seite.locator(ABZEICHEN).first().evaluate((e) => { e.style.visibility = 'hidden' })
  const ohne = await lesePixel({ png: (await kachel.screenshot()).toString('base64'), punkte: liste })
  const gleich = Object.fromEntries(p.gleich.map(([n], i) => [n, [mit[i], ohne[i]]]))
  const fehler = [...lageFehler(lage), ...pixelFehler({ gleich, sichtbar: [mit.at(-1), ohne.at(-1)] })]
  const { k, a, s } = lage
  console.log(`  ${name}: Abzeichen ${a.l - k.l}/${a.t - k.t}/${k.r - a.r} px von links/oben/rechts, ${s.t - a.b} px über dem Streifen, ${p.gleich.length} Pixel gleich, Mitte mit ${mit.at(-1)} ohne ${ohne.at(-1)}`)
  return fehler.map((f) => `${name}: ${f}`)
}

/** Beide Themen am Handy; druckt die Ergebniszeile und gibt wahr zurück, wenn etwas rot ist. */
export async function meldeAbzeichen({ chromium, antworte, dist, lesePixel }) {
  const titel = await suchname(dist)
  if (!titel) {
    console.log('\nAbzeichen „angekündigt“ (360 px): übersprungen — im Datenstand keine Kachel mit angekündigter Synchro ohne deutsche Folge')
    return false
  }
  const browser = await chromium.launch()
  const fehler = []
  for (const thema of ['dunkel', 'hell']) {
    const kontext = await browser.newContext({ viewport: { width: BREITE, height: 800 }, isMobile: true, hasTouch: true, colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
    const seite = await kontext.newPage()
    await seite.route('**/*', antworte)
    await seite.goto(`http://ak.test/#/datenbank?${new URLSearchParams({ q: titel, ohne: '1', staffeln: '0' })}`, { waitUntil: 'networkidle' })
    try {
      await seite.waitForSelector(ABZEICHEN, { timeout: 15_000 })
      fehler.push(...(await messeThema(seite, (a) => seite.evaluate(lesePixel, a), `${thema}`)))
    } catch (e) {
      fehler.push(`${thema}: keine Kachel mit Abzeichen für „${titel}“ gefunden (${String(e).slice(0, 80)})`)
    }
    await kontext.close()
  }
  await browser.close()
  console.log(`\nAbzeichen „angekündigt“ auf der Datenbank-Kachel (360 px, hell und dunkel, „${titel}“; Abstand zu Rand und Streifen, Kachelecken, Unterkante, Zeile unter dem Abzeichen und Pixel außerhalb seiner Ecken mit und ohne Abzeichen gleich, Mitte sichtbar): ${fehler.length ? '' : 'ok'}`)
  for (const f of fehler) console.log(`  ✕ ${f}`)
  return fehler.length > 0
}
