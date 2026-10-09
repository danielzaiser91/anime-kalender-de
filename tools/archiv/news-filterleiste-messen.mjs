#!/usr/bin/env node
/**
 * Regressionsmessung: Die Filterleiste der News-Ansicht darf nie selbst scrollen.
 * Anlass: 09.10.2026, winzige vertikale Scrollbar neben den Pillen (Desktop).
 * Ursache: overflow-x:auto erzwingt overflow-y:auto; bei umbrochenen Pillen
 * (sm:flex-wrap) ragt der Auswahlring über die Containerhöhe.
 *
 * Aufruf: node tools/archiv/news-filterleiste-messen.mjs [--dist]
 *   ohne Flag: live (https://anime-kalender.de), mit --dist: Bau aus dist/.
 * Exit 1, wenn ein Container in Y mehr Inhalt als Fläche hat oder seine
 * Pillen in X nicht umbricht (Desktop).
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '../../dist')
const lokal = process.argv.includes('--dist')
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
const ORIGIN = lokal ? 'http://ak.test' : 'https://anime-kalender.de'

const browser = await chromium.launch()
let rot = false
for (const [breite, hoehe] of [[1280, 900], [1440, 900], [375, 812]]) {
  for (const thema of ['dark', 'light']) {
    const seite = await browser.newPage({ viewport: { width: breite, height: hoehe } })
    await seite.emulateMedia({ colorScheme: thema })
    await seite.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (!/^https?:$/.test(url.protocol)) return route.continue()
      if (!lokal && url.hostname === 'anime-kalender.de') return route.continue()
      if (lokal && url.hostname === 'ak.test') {
        const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
        if (!existsSync(datei)) return route.fulfill({ status: 404, body: '' })
        return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
      }
      return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
    })
    await seite.goto(`${ORIGIN}/#/news`, { waitUntil: 'networkidle' })
    const knopf = seite.locator('button[aria-pressed]').first()
    await knopf.waitFor({ timeout: 30_000 })
    await seite.waitForTimeout(1500)
    const m = await seite.evaluate(() => {
      const k = document.querySelector('button[aria-pressed]')
      const leiste = k.parentElement
      // Auswahlzustand mitmessen: erste Art-Pille anklicken (Ring)
      const pillen = leiste.querySelectorAll('button').length
      const messe = (el) => ({ sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth, oy: getComputedStyle(el).overflowY })
      const scrollende = []
      for (let el = leiste; el && el !== document.documentElement; el = el.parentElement) {
        const s = getComputedStyle(el)
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) scrollende.push(el.tagName + '.' + String(el.className).slice(0, 40))
      }
      return { pillen, ...messe(leiste), scrollende }
    })
    // Zustand mit gewählter Pille (Ring-2 ragt 2px heraus)
    await seite.locator('button[aria-pressed]').nth(1).click()
    const m2 = await seite.evaluate(() => {
      const el = document.querySelector('button[aria-pressed]').parentElement
      return { sh: el.scrollHeight, ch: el.clientHeight }
    })
    const mobil = breite < 640
    const schlecht = (m.sh > m.ch || m2.sh > m2.ch) || (!mobil && m.sw > m.cw)
    if (schlecht) rot = true
    console.log(`${breite} ${thema} pillen=${m.pillen} scrollHeight/clientHeight=${m.sh}/${m.ch} gewählt=${m2.sh}/${m2.ch} oy=${m.oy} x=${m.sw}/${m.cw} ${schlecht ? 'ROT' : 'ok'} ${m.scrollende.join(',')}`)
    await seite.close()
  }
}
await browser.close()
process.exitCode = rot ? 1 : 0
