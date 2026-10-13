#!/usr/bin/env node
/**
 * Prüft das Verhalten von Cover- und Banner-Ansicht im Detail-Panel (13.10.2026), Handy 393 px, in `dist/`:
 *  - Zurück schließt erst die Vergrößerung, das Panel bleibt; ein zweites Zurück schließt das Panel
 *  - Escape schließt nur die Vergrößerung und lässt keinen Verlaufseintrag zurück (ein Zurück genügt für das Panel)
 *  - Klick aufs Banner zeigt das Banner, ohne Banner das Cover; Klick aufs Poster zeigt das Cover
 *  - erst Poster (großes Plakat lädt), schließen, dann Banner: das Banner-Bild ist sichtbar (nicht `opacity-0`)
 *  - „Ausblenden“ ist nur ein Zeichen (44 × 44) mit aria-label und title
 * Aufruf: node tools/panel-zurueck.mjs     (Teil von `npm run check:panel`)
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
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
/** Ein Cartoon aus dem Bestand mit Cartoon-Marke (`westlich`). */
const CARTOON = JSON.parse(readFileSync(path.join(WURZEL, 'public', 'data', 'cartoons.json'), 'utf8')).find((t) => t.westlich)
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

/** Die Cartoon-Marke auf der Kachel ist kein Knopf: ein Mausklick darauf öffnet wie überall auf der Kachel das Panel (die FSK-Marke daneben tut es nicht). */
async function pruefeCartoonMarke(seite) {
  await seite.goto('about:blank')
  await seite.goto(`http://ak.test/#/datenbank?q=${encodeURIComponent(CARTOON.titleEn)}`, { waitUntil: 'networkidle' })
  const marke = seite.getByText('Cartoon', { exact: true }).first()
  const da = await marke.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true, () => false)
  ist(da, 'eine Kachel mit Cartoon-Marke ist zu finden (Voraussetzung des Falls)')
  if (!da) return
  await marke.click()
  await seite.waitForTimeout(600)
  ist(await panelOffen(seite), 'Klick auf die Cartoon-Marke öffnet das Panel')
}

/** Poster öffnen (das große Plakat lädt), schließen, Banner öffnen: das Basisbild muss sichtbar sein, für das Banner gibt es kein großes Bild. */
async function pruefeBannerNachPoster(seite) {
  await oeffnePanel(seite, MIT_BANNER)
  await seite.locator('[data-poster]').click()
  await schicht(seite, 'Cover').waitFor({ state: 'visible', timeout: 5000 })
  const gross = schicht(seite, 'Cover').locator('img[sizes]')
  const hatGross = await gross.waitFor({ state: 'attached', timeout: 5000 }).then(() => true, () => false)
  ist(hatGross, 'Cover-Ansicht lädt das große Plakat (Voraussetzung des Falls)')
  if (hatGross) await gross.evaluate((el) => (el.complete ? 0 : new Promise((ok) => el.addEventListener('load', ok))))
  await seite.waitForTimeout(400)
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(300)
  await seite.locator('[data-kopf]').click({ position: { x: 20, y: 100 } })
  await schicht(seite, 'Banner').waitFor({ state: 'visible', timeout: 5000 })
  await seite.waitForTimeout(400)
  const deckkraft = await schicht(seite, 'Banner').locator('img').first().evaluate((el) => getComputedStyle(el).opacity)
  ist(deckkraft === '1', `nach Poster, Schließen und Banner ist das Banner-Bild sichtbar (Deckkraft ${deckkraft})`)
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
  await pruefeBannerNachPoster(seite)
  await pruefeCartoonMarke(seite)
  await pruefeAusblenden(seite)
  await browser.close()
  if (rot.length) process.exitCode = 1
}

await main()
