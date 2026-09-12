#!/usr/bin/env node
/**
 * Bildet die Nachrichtenseite ab — zugeklappt **und** aufgeklappt.
 *
 * `ansicht-bild.mjs` fotografiert jede Route in ihrem Anfangszustand. Die
 * Nachrichtenseite hat aber einen zweiten, den niemand sonst zu sehen bekommt:
 * Daniel am 12.09.2026 verlangte „interaktion für mehr details" — und was
 * hinter einem Klick liegt, prüft ein Lauf, der nie klickt, grundsätzlich
 * nicht.
 *
 * **Gemessen wird außerdem die Zeilenhöhe**, denn sie ist hier die eigentliche
 * Anforderung („die übersicht muss noch kompakter, damit man nicht so viel
 * scrollen muss"). Eine Zahl hält das besser fest als ein Vorsatz: Zehn fremde
 * Listen kamen bei der Recherche auf 22 bis 119 px, unser Ziel liegt bei rund
 * 56 px — hoch genug für ein Touchziel, niedrig genug für zwei Textgrößen und
 * ein Cover.
 *
 * **Ohne Server**, wie die beiden Schwesterwerkzeuge: `page.route()`
 * beantwortet jede Anfrage aus `dist/`.
 *
 * Aufruf: node tools/news-bild.mjs [--handy]  ·  npm run check:news
 * Ergebnis: `docs/news-<zu|auf>-<hell|dunkel>.png`
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
const HANDY = process.argv.includes('--handy')

/** Obergrenze für eine Übersichtszeile. Reißt sie, ist die Seite nicht mehr kompakt. */
const HOECHSTE_ZEILE = 72

const EIN_PUNKT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const TYPEN = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
}

if (!existsSync(DIST)) {
  console.error('dist/ fehlt — erst `npm run build`.')
  process.exit(1)
}

const browser = await chromium.launch()
const seite = await browser.newPage({
  viewport: HANDY ? { width: 375, height: 812 } : { width: 1280, height: 900 },
  deviceScaleFactor: 1,
})
const fehler = []
seite.on('console', (m) => m.type() === 'error' && fehler.push(m.text().slice(0, 160)))
seite.on('pageerror', (e) => fehler.push(String(e).slice(0, 160)))

await seite.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
  if (url.hostname !== 'ak.test') {
    return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
  }
  const rel = url.pathname === '/' ? '/index.html' : url.pathname
  const datei = path.join(DIST, rel)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({
    status: 200,
    contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream',
    body: await readFile(datei),
  })
})

let schlimm = 0
for (const thema of ['dunkel', 'hell']) {
  fehler.length = 0
  await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
  await seite.goto('about:blank')
  await seite.goto('http://ak.test/#/news', { waitUntil: 'networkidle' })
  await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(2500)

  const zeilen = seite.locator('section ul > li > button[type="button"]')
  const zahl = await zeilen.count()
  if (!zahl) {
    console.error('keine Meldungszeile gefunden — die Seite ist leer oder der Aufbau hat sich geändert')
    schlimm++
    continue
  }

  /* Die Höhe der ersten fünf Zeilen — eine einzelne könnte ein Ausreißer sein. */
  const hoehen = []
  for (let i = 0; i < Math.min(5, zahl); i++) hoehen.push((await zeilen.nth(i).boundingBox())?.height ?? 0)
  const hoechste = Math.max(...hoehen)

  await seite.screenshot({
    path: path.join(WURZEL, 'docs', `news-zu-${HANDY ? 'handy-' : ''}${thema}.png`),
    fullPage: false,
  })

  /*
    Aufklappen: die erste Zeile, die es kann. `aria-expanded` trägt nur, wer
    mehr als eine Meldung hat — das ist zugleich die Prüfung, dass das Attribut
    überhaupt gesetzt wird.
  */
  const aufklappbar = seite.locator('section ul > li > button[aria-expanded]')
  const wieViele = await aufklappbar.count()
  if (!wieViele) {
    console.error('keine aufklappbare Zeile — die Bündelung greift nicht')
    schlimm++
  } else {
    await aufklappbar.first().click()
    await seite.waitForTimeout(250)
    const detail = await seite.locator('section ul > li ul li').count()
    if (detail < 2) {
      console.error(`aufgeklappt stehen nur ${detail} Einzelmeldungen da`)
      schlimm++
    }
    await seite.screenshot({
      path: path.join(WURZEL, 'docs', `news-auf-${HANDY ? 'handy-' : ''}${thema}.png`),
      fullPage: false,
    })
  }

  const breite = await seite.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    fenster: window.innerWidth,
  }))
  const ueber = breite.doc - breite.fenster > 1
  if (ueber) schlimm++
  if (hoechste > HOECHSTE_ZEILE) schlimm++
  if (fehler.length) schlimm++

  console.log(
    `  ${thema.padEnd(7)} ${zahl} Zeilen, ${wieViele} aufklappbar, höchste Zeile ${Math.round(hoechste)} px` +
      `${hoechste > HOECHSTE_ZEILE ? ` (über ${HOECHSTE_ZEILE})` : ''}` +
      `${ueber ? '  ÜBERBREITE' : ''}${fehler.length ? `  ${fehler.length} Konsolenfehler` : ''}`,
  )
  for (const f of fehler.slice(0, 3)) console.log(`      ${f}`)
}

await browser.close()
console.log(schlimm ? `\n  ${schlimm} Mangel/Mängel` : '\n  ok  kompakt, aufklappbar, keine Fehler')
process.exit(schlimm ? 1 : 0)
