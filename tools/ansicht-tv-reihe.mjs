/**
 * Wischreihe „Im Fernsehen“ in der Woche (Handy 360 px, beide Themen), gemessen in der gebauten App an einem Tag mit 12 Kulissen-TV-Terminen:
 *  - eine Reihe (alle Kacheln gleiche Oberkante), Reihe scrollt seitlich, `scrollWidth` der Seite <= Fensterbreite, Kachelknopf >= 44 px;
 *  - Tastatur: Tab setzt den Fokus auf eine Kachel außerhalb des Sichtbereichs, `scrollLeft` wächst, die Kachel liegt im Sichtbereich;
 *  - Pixel: Unterkante des Kachelrands sichtbar, untere Ecke gerundet, die 3 Zeilen unter der Kante wie der Grund des Kastens.
 * Regeln als reine Funktionen in `tv-reihe-urteil.mjs`. Ohne Server: `page.route()` liefert `dist/`.
 * Aufruf allein: `node tools/ansicht-tv-reihe.mjs [--dist <ordner>]`; in `ansicht-bild.mjs --handy` als Zusatzprüfung.
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { urteilReihe, urteilTastatur, urteilRand, tvKulisse } from './tv-reihe-urteil.mjs'
import { setzeSichtbarkeitSchwebender } from './kachel-ecken-messen.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const ANZAHL_TV = 12
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' }
const COVER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#4a5a80"/></svg>'
const TAG = (datum) => `section[data-datum="${datum}"]`

/** Beantwortet jede Anfrage aus `dist`; `events.json` bekommt die TV-Kulisse am Tag `datum`. */
function antworter(dist, datum) {
  return async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: COVER_SVG })
    const datei = path.join(dist, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    let body = await readFile(datei)
    if (path.basename(datei) === 'events.json') body = JSON.stringify(tvKulisse(JSON.parse(body.toString('utf8')), datum, ANZAHL_TV))
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body })
  }
}

/** Lage der Reihe und ihrer Kacheln. Läuft im Browser. */
function messeReihe(selektor) {
  const kacheln = [...document.querySelectorAll(`${selektor} [data-tv-zeile]`)]
  const ul = kacheln[0]?.parentElement
  return {
    oben: kacheln.map((k) => k.getBoundingClientRect().top),
    scrollBreite: document.documentElement.scrollWidth,
    fensterBreite: window.innerWidth,
    minKnopf: Math.min(...kacheln.map((k) => k.querySelector('button').getBoundingClientRect().height)),
    reiheScrollt: !!ul && ul.scrollWidth > ul.clientWidth,
  }
}

/** Tab-Taste bis zu einer anfangs verdeckten Kachel; gibt die Messwerte für `urteilTastatur`. */
async function messeTastatur(seite, selektor) {
  const start = await seite.evaluate((sel) => {
    const kacheln = [...document.querySelectorAll(`${sel} [data-tv-zeile]`)]
    const ul = kacheln[0].parentElement
    const rechts = ul.getBoundingClientRect().right
    kacheln.forEach((k, i) => (k.dataset.nr = String(i)))
    kacheln[0].querySelector('button').focus()
    return { scroll: ul.scrollLeft, verdeckt: kacheln.filter((k) => k.getBoundingClientRect().left >= rechts).map((k) => k.dataset.nr) }
  }, selektor)
  for (let i = 0; i < 60; i++) {
    await seite.keyboard.press('Tab')
    await seite.waitForTimeout(150)
    const hier = await seite.evaluate((sel) => {
      const li = document.activeElement?.closest(`${sel} [data-tv-zeile]`)
      if (!li) return null
      const r = li.getBoundingClientRect()
      const u = li.parentElement.getBoundingClientRect()
      return { nr: li.dataset.nr, scroll: li.parentElement.scrollLeft, sichtbar: r.left >= u.left - 1 && r.right <= u.right + 1 }
    }, selektor)
    if (hier && start.verdeckt.includes(hier.nr)) return { fokusAufVerdeckter: true, scrollVorher: start.scroll, scrollNachher: hier.scroll, sichtbar: hier.sichtbar }
  }
  return { fokusAufVerdeckter: false, scrollVorher: start.scroll, scrollNachher: start.scroll, sichtbar: false }
}

/** Liest Pixel (x, y) aus einem PNG. Läuft im Browser. */
async function lesePixel({ png, punkte }) {
  const bild = new Image()
  bild.src = `data:image/png;base64,${png}`
  await bild.decode()
  const leinwand = document.createElement('canvas')
  leinwand.width = bild.width
  leinwand.height = bild.height
  const g = leinwand.getContext('2d')
  g.drawImage(bild, 0, 0)
  return punkte.map(([x, y]) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3))
}

const abstandZu = (a, b) => a.reduce((t, v, i) => t + Math.abs(v - b[i]), 0)

/** Pixel von Rand, Ecke und den Zeilen darunter an der ersten Kachel; der Grund kommt aus der Kastenfläche links der Kachel. */
async function messeRand(seite, selektor) {
  await seite.evaluate(setzeSichtbarkeitSchwebender, 'hidden')
  const kachel = seite.locator(`${selektor} [data-tv-zeile]`).first()
  await kachel.scrollIntoViewIfNeeded()
  const r = await kachel.boundingBox()
  const png = (await seite.screenshot()).toString('base64')
  await seite.evaluate(setzeSichtbarkeitSchwebender, '')
  const mitte = Math.round(r.x + r.width / 2)
  const von = Math.floor(r.y + r.height) - 3
  const grundPunkt = [Math.floor(r.x) - 4, Math.round(r.y + r.height / 2)]
  const streifen = Array.from({ length: 6 }, (_, i) => [mitte, von + i])
  const [grund, ...zeilen] = await seite.evaluate(lesePixel, { png, punkte: [grundPunkt, ...streifen] })
  /* Die Randzeile ist die mit dem größten Abstand zum Grund; wo sie liegt, hängt von der Nachkommastelle der Kachelhöhe ab. */
  const nr = zeilen.reduce((best, p, i) => (abstandZu(p, grund) > abstandZu(zeilen[best], grund) ? i : best), 0)
  const yRand = von + nr
  const [ecke, ...darunter] = await seite.evaluate(lesePixel, { png, punkte: [[Math.ceil(r.x), yRand], [mitte, yRand + 1], [mitte, yRand + 2], [mitte, yRand + 3]] })
  return { grund, rand: zeilen[nr], ecke, darunter }
}

async function messeThema(browser, dist, datum, thema) {
  const kontext = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
  await kontext.addInitScript(() => {
    localStorage.setItem('kennung:ak1', '1')
    localStorage.setItem('kennung:umleitung', '999999')
  })
  const seite = await kontext.newPage()
  await seite.route('**/*', antworter(dist, datum))
  await seite.goto(`http://ak.test/#/woche?d=${datum}`, { waitUntil: 'networkidle' })
  await seite.locator(`${TAG(datum)} [data-tv-zeile]`).first().waitFor({ timeout: 20_000 })
  await seite.waitForTimeout(1500)
  const sel = TAG(datum)
  const reihe = await seite.evaluate(messeReihe, sel)
  const fehler = [...urteilReihe(reihe).map((f) => `Reihe: ${f}`), ...urteilRand(await messeRand(seite, sel)).map((f) => `Rand: ${f}`)]
  fehler.push(...urteilTastatur(await messeTastatur(seite, sel)).map((f) => `Tastatur: ${f}`))
  await kontext.close()
  return { thema, kacheln: reihe.oben.length, minKnopf: reihe.minKnopf, scrollBreite: reihe.scrollBreite, fehler }
}

/** Prüft beide Themen; gibt je Thema Messwerte und Fehler zurück (`fehler` leer = in Ordnung). */
export async function pruefeTvReihe(dist) {
  let datum
  try {
    datum = JSON.parse(await readFile(path.join(dist, 'data', 'meta.json'), 'utf8')).generatedAt.slice(0, 10)
  } catch (e) {
    return [{ thema: '-', fehler: [`data/meta.json in ${dist} nicht lesbar (${e.message})`] }]
  }
  const browser = await chromium.launch()
  try {
    const ergebnisse = []
    for (const thema of ['dunkel', 'hell']) ergebnisse.push(await messeThema(browser, dist, datum, thema))
    return ergebnisse
  } finally {
    await browser.close()
  }
}

/** Schreibt das Ergebnis; wahr, wenn rot. */
export function meldeTvReihe(ergebnisse) {
  const rot = ergebnisse.some((e) => e.fehler.length)
  console.log(`\nTV-Wischreihe (Woche, 360 px, ${ANZAHL_TV} TV-Termine an einem Tag): ${rot ? '' : 'ok'}`)
  for (const e of ergebnisse) {
    console.log(`  ${e.thema}: ${e.kacheln ?? '-'} Kacheln, Knopf min ${e.minKnopf ?? '-'} px, Seitenbreite ${e.scrollBreite ?? '-'} px`)
    for (const f of e.fehler) console.log(`  ✕ ${e.thema}: ${f}`)
  }
  return rot
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--dist')
  const dist = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(WURZEL, 'dist')
  process.exit(meldeTvReihe(await pruefeTvReihe(dist)) ? 1 : 0)
}
