#!/usr/bin/env node
/**
 * Prüft das Verhalten von Cover- und Banner-Ansicht im Detail-Panel (13.10.2026), Handy 393 px, in `dist/`:
 *  - Zurück schließt erst die Vergrößerung, das Panel bleibt; ein zweites Zurück schließt das Panel
 *  - Escape schließt nur die Vergrößerung und lässt keinen Verlaufseintrag zurück (ein Zurück genügt für das Panel)
 *  - Klick aufs Banner zeigt das Banner, ohne Banner das Cover; Klick aufs Poster zeigt das Cover
 *  - „Ausblenden“ ist nur ein Zeichen (44 × 44) mit aria-label und title
 * Aufruf: node tools/panel-zurueck.mjs     (Teil von `npm run check:panel`)
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { akVon } from './ak-von.mjs'
import { distPruefen } from './dist-frisch.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
/** Jujutsu Kaisen (mit Banner) und Rozen Maiden: Dreaming (ohne Banner, `listen/banner-luecken.md`). */
const MIT_BANNER = akVon('113415')
const OHNE_BANNER = akVon('65')
const rot = []
const ist = (ok, text) => {
  console.log(`  ${ok ? 'ok' : '✕'} ${text}`)
  if (!ok) rot.push(text)
}

async function beantworte(route) {
  const url = new URL(route.request().url())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
}

async function oeffnePanel(seite, ak) {
  await seite.goto('about:blank')
  await seite.goto(`http://ak.test/#/datenbank?t=${ak}`, { waitUntil: 'networkidle' })
  await seite.locator('[data-panel="titel"] [data-kopf]').waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(400)
}

const schicht = (seite, wort) => seite.locator(`[role=dialog][aria-label^="${wort}:"]`)
const panelOffen = (seite) => seite.locator('[data-panel="titel"]').count().then((n) => n > 0)

async function pruefeZurueck(seite) {
  await oeffnePanel(seite, MIT_BANNER)
  await seite.locator('[data-poster]').click()
  await schicht(seite, 'Cover').waitFor({ state: 'visible', timeout: 5000 })
  ist(true, 'Klick aufs Poster öffnet die Cover-Ansicht')
  await seite.goBack()
  await seite.waitForTimeout(500)
  ist((await schicht(seite, 'Cover').count()) === 0 && (await panelOffen(seite)), 'Zurück schließt die Cover-Ansicht, das Panel bleibt')
  await seite.goBack()
  await seite.waitForTimeout(500)
  ist(!(await panelOffen(seite)), 'ein zweites Zurück schließt das Panel')
}

async function pruefeBanner(seite) {
  await oeffnePanel(seite, MIT_BANNER)
  await seite.locator('[data-kopf]').click({ position: { x: 20, y: 100 } })
  await schicht(seite, 'Banner').waitFor({ state: 'visible', timeout: 5000 })
  ist(true, 'Klick aufs Banner öffnet die Banner-Ansicht')
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(500)
  ist((await schicht(seite, 'Banner').count()) === 0 && (await panelOffen(seite)), 'Escape schließt nur die Banner-Ansicht')
  await seite.goBack()
  await seite.waitForTimeout(500)
  ist(!(await panelOffen(seite)), 'nach Escape genügt ein Zurück für das Panel (kein Verlaufseintrag übrig)')
  await oeffnePanel(seite, OHNE_BANNER)
  await seite.locator('[data-kopf]').click({ position: { x: 20, y: 100 } })
  await schicht(seite, 'Cover').waitFor({ state: 'visible', timeout: 5000 })
  ist(true, 'ohne Banner zeigt der Klick aufs Banner das Cover')
}

async function pruefeAusblenden(seite) {
  await oeffnePanel(seite, MIT_BANNER)
  const knopf = seite.locator('[data-panel="titel"]').getByRole('button', { name: 'Ausblenden' })
  const box = await knopf.boundingBox()
  ist(!!box && Math.round(box.width) === 44 && Math.round(box.height) === 44, `„Ausblenden“ ist 44 × 44 (gemessen ${box && Math.round(box.width)} × ${box && Math.round(box.height)})`)
  ist(((await knopf.innerText()) ?? '').trim() === '', '„Ausblenden“ trägt keinen Text')
  ist((await knopf.getAttribute('title')) === 'Ausblenden', '„Ausblenden“ hat title')
}

async function main() {
  if (!distPruefen(WURZEL)) return
  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true })
  await seite.route('**/*', beantworte)
  await pruefeZurueck(seite)
  await pruefeBanner(seite)
  await pruefeAusblenden(seite)
  await browser.close()
  if (rot.length) process.exitCode = 1
}

await main()
