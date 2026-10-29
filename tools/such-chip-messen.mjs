#!/usr/bin/env node
/**
 * Prüft das × am Such-Chip der Datenbank (Daniel, 13.10.2026) in `dist/`, am Rechner (Filterfeld unten) und am Handy (Filterfenster):
 *  - mit `?q=…` steht der Chip „Suche: …" da
 *  - ein Klick auf × leert Adresse (`q`), Suchfeld und Chip
 *  - „Alle zurücksetzen" lässt die Suche dagegen stehen (Daniel, 29.09.2026)
 * Aufruf: node tools/such-chip-messen.mjs     (Teil von `npm run check:panel`)
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { distPruefen } from './dist-frisch.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
const BEGRIFF = 'the-new-chronicles-of-extraordinary-beings'
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

const chip = (seite) => seite.getByRole('button', { name: `Suche: ${BEGRIFF} entfernen` })
const adresseQ = (seite) => new URLSearchParams(seite.url().split('?')[1] ?? '').get('q')

/** Am Handy liegt der Chip im Filterfenster, und das zeigt Chips nur bei einem weiteren Filter (die Suche zählt nicht mit): daher sicher=1. Am Rechner steht er im Filterfeld unten, das erst nach dem Klick auf den Filter-Knopf aufklappt (Variante A, 29.10.2026). */
async function oeffne(seite, mobil) {
  await seite.goto('about:blank')
  await seite.goto(`http://ak.test/#/datenbank?q=${BEGRIFF}${mobil ? '&sicher=1' : ''}`, { waitUntil: 'networkidle' })
  if (mobil) await seite.getByRole('button', { name: /^Filter/ }).first().click()
  else await seite.locator('button[data-filter-knopf]').click()
  await chip(seite).waitFor({ state: 'visible', timeout: 20_000 })
}

/** „Alle zurücksetzen" räumt die Filter, die Suche bleibt in der Adresse (Daniel, 29.09.2026). */
async function pruefeZuruecksetzen(seite, art, mobil) {
  await oeffne(seite, mobil)
  ist(adresseQ(seite) === BEGRIFF, `${art}: mit ?q= steht der Such-Chip da`)
  await seite.getByRole('button', { name: 'Alle zurücksetzen' }).first().click()
  await seite.waitForTimeout(400)
  ist(adresseQ(seite) === BEGRIFF, `${art}: „Alle zurücksetzen" lässt die Suche in der Adresse stehen`)
}

async function pruefeKreuz(seite, art, mobil) {
  await oeffne(seite, mobil)
  await chip(seite).click()
  await seite.waitForTimeout(400)
  ist(adresseQ(seite) === null, `${art}: × leert die Adresse (q=${adresseQ(seite)})`)
  ist((await chip(seite).count()) === 0, `${art}: × entfernt den Chip`)
  const feld = seite.getByRole('searchbox').first()
  const wert = (await feld.count()) ? await feld.inputValue() : ''
  ist(wert === '', `${art}: × leert das Suchfeld ("${wert}")`)
}

async function pruefe(seite, mobil) {
  const art = mobil ? 'Handy' : 'Rechner'
  await pruefeZuruecksetzen(seite, art, mobil)
  await pruefeKreuz(seite, art, mobil)
}

async function main() {
  if (!distPruefen(WURZEL)) return
  const browser = await chromium.launch()
  for (const mobil of [false, true]) {
    const seite = await browser.newPage(mobil ? { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 900 } })
    await seite.route('**/*', beantworte)
    await pruefe(seite, mobil)
    await seite.close()
  }
  await browser.close()
  if (rot.length) process.exitCode = 1
}

await main()
