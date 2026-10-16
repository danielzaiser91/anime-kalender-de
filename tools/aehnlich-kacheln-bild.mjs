#!/usr/bin/env node
/**
 * Prüft die Kacheln „Ähnliche Titel" im Detail-Panel: Titel und Chips dürfen sich nie überdecken.
 * Öffnet das Panel aus `dist/` (ohne Server, wie panel-bild.mjs), setzt in den Kacheln Fälle mit
 * 1–3 Titelzeilen und 1–4 Chips ein und misst je Kachel, ob der Titel unter dem ersten Chip endet.
 * Aufruf: node tools/aehnlich-kacheln-bild.mjs [--vorher] [<Ordner für Bilder>]
 *         --vorher setzt die alten Klassen (feste Höhe) ein, um die Messung gegen den Fehler zu beweisen.
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { akVon } from './ak-von.mjs'
import { distPruefen } from './dist-frisch.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
const VORHER = process.argv.includes('--vorher')
const BILDER = process.argv.slice(2).find((a) => !a.startsWith('--'))
// Hohes Platzhalterbild (1:4): ein Cover schmaler als 2:3 darf die Kachel nicht verlängern.
const HOHES_BILD = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="400"><rect width="100" height="400" fill="#888"/></svg>'
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
const TITEL = ['Kurz', 'Blue Exorcist: The Blue Night Saga Extra', 'Beyond the Boundary: Kyoukai no Kanata Extra Lang Lang Lang']
const CHIPS = ['Dämonen', 'Zeitmanipulation', 'Schule', 'Übernatürliche Kräfte', 'Fantasy', 'Magie']

/** Läuft im Browser: setzt je Kachel einen Fall (Titel, Chipzahl) ein und misst, ob Chips den Titel überdecken oder aus der Kachel ragen. */
function setzeUndMesse({ vorher, faelle, chips }) {
  const kacheln = [...document.querySelectorAll('ul.grid-cols-2 > li > button')]
  const fehler = []
  kacheln.forEach((k, i) => {
    const [titel, anzahl] = faelle[i % faelle.length]
    const name = k.querySelector('.line-clamp-3')
    const chipBox = name.nextElementSibling
    name.textContent = titel
    const vorlage = chipBox.firstElementChild
    chipBox.replaceChildren(
      ...Array.from({ length: anzahl }, (_, n) => {
        const c = vorlage.cloneNode(true)
        c.textContent = chips[(i + n) % chips.length]
        return c
      }),
    )
    if (vorher) {
      k.classList.remove('min-h-36')
      k.style.height = '9rem'
      chipBox.parentElement.classList.remove('gap-1')
    }
  })
  kacheln.forEach((k, i) => {
    const name = k.querySelector('.line-clamp-3')
    const zeile = parseFloat(getComputedStyle(name).lineHeight)
    const klon = name.cloneNode(true)
    Object.assign(klon.style, { position: 'absolute', visibility: 'hidden', webkitLineClamp: 'unset', display: 'block', overflow: 'visible', width: name.clientWidth + 'px' })
    name.parentElement.appendChild(klon)
    const soll = Math.min(klon.getBoundingClientRect().height, 3 * zeile)
    klon.remove()
    const abgeschnitten = Math.round(soll - name.getBoundingClientRect().height)
    const ueber = Math.round(name.getBoundingClientRect().bottom - name.nextElementSibling.getBoundingClientRect().top)
    const raus = Math.round(name.nextElementSibling.getBoundingClientRect().bottom - k.getBoundingClientRect().bottom)
    const bild = k.querySelector('img')
    const bildZuHoch = bild ? Math.round(bild.getBoundingClientRect().height - 144) : 0
    if (ueber > 0 || raus > 0 || abgeschnitten > 1 || bildZuHoch > 0) {
      fehler.push({ kachel: i, fall: faelle[i % faelle.length][1] + ' Chips', ueber, raus, abgeschnitten, bildZuHoch })
    }
  })
  return { kacheln: kacheln.length, fehler }
}

/** Alle Paare aus Titellänge (1–3 Zeilen) und Chipzahl (1–4), in Gruppen zu je Kachelzahl. */
function alleFaelle() {
  return TITEL.flatMap((t) => [1, 2, 3, 4].map((n) => [t, n]))
}

async function main() {
  if (!distPruefen(WURZEL)) return
  const browser = await chromium.launch()
  let rot = false
  for (const breite of [570, 1280]) {
    const seite = await browser.newPage({ viewport: { width: breite, height: 1400 } })
    await seite.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
      if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: HOHES_BILD })
      const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
      if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
    })
    for (const thema of ['dunkel', 'hell']) {
      await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
      await seite.goto('about:blank')
      await seite.goto(`http://ak.test/#/datenbank?t=${akVon(161645)}`, { waitUntil: 'networkidle' })
      await seite.locator('[data-panel="titel"]').getByText('Ähnliche Titel').first().scrollIntoViewIfNeeded()
      const liste = seite.locator('[data-panel="titel"] ul.grid-cols-2').first()
      await liste.waitFor({ state: 'visible', timeout: 20_000 })
      const fehler = []
      const alle = alleFaelle()
      for (let r = 0; r < alle.length; r += 5) {
        const faelle = Array.from({ length: 5 }, (_, n) => alle[(r + n) % alle.length])
        fehler.push(...(await seite.evaluate(setzeUndMesse, { vorher: VORHER, faelle, chips: CHIPS })).fehler)
      }
      const schlimm = [[TITEL[2], 4], [TITEL[2], 3], [TITEL[1], 4], [TITEL[2], 2], [TITEL[0], 4]]
      await seite.evaluate(setzeUndMesse, { vorher: VORHER, faelle: schlimm, chips: CHIPS })
      const m = { kacheln: alle.length, fehler }
      const rest = m.fehler.length
      console.log(`${breite} px ${thema}: ${m.kacheln} Kacheln, ${rest} mit Überdeckung ${JSON.stringify(m.fehler)}`)
      if (rest && !VORHER) rot = true
      if (BILDER) {
        await liste.scrollIntoViewIfNeeded()
        await liste.screenshot({ path: path.join(BILDER, `aehnlich-${VORHER ? 'vorher' : 'nachher'}-${breite}-${thema}.png`) })
      }
    }
    await seite.close()
  }
  await browser.close()
  if (VORHER ? false : rot) process.exitCode = 1
}
main()
