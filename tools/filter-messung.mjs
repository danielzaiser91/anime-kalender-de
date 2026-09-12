#!/usr/bin/env node
/**
 * **Blockiert auch ein Filterklick — oder war es nur die Sucheingabe?**
 *
 * Der Eingabepuffer vom 12.09.2026 entkoppelt das Tippen von der Filterung:
 * gemessen 82 → 13 ms im Median, 534 → 24 ms im Ausreißer. Er macht die
 * Rechnung darunter aber nicht schneller — er ruft sie nur seltener auf.
 *
 * Diese Messung fragt deshalb nach dem Rest: Was kostet **eine** Filterung,
 * wenn sie unvermeidbar ist? Ein Klick auf den Katalog-Toggle oder einen
 * Filter-Chip hat keinen Puffer und kann keinen haben — dort ist die Eingabe
 * selbst das Ereignis.
 *
 * Aufruf: `node tools/filter-messung.mjs` · `npm run mess:filter`
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const WURZEL = 'C:/code/ai/anime-kalender-de'
const DIST = path.join(WURZEL, 'dist')
const TYPEN = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
}

const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 1280, height: 900 } })
await seite.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) })
  const datei = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname)
  if (!existsSync(datei)) {
    return route.fulfill({ status: 200, contentType: 'text/html', body: await readFile(path.join(DIST, 'index.html')) })
  }
  return route.fulfill({
    status: 200,
    contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream',
    body: await readFile(datei),
  })
})

await seite.goto('http://ak.test/#/datenbank', { waitUntil: 'networkidle' })

/** Wie lange bleibt der Haupt-Thread nach einer Handlung stehen? */
async function messen(was, handlung) {
  const vor = Date.now()
  await handlung()
  await seite.evaluate(() => new Promise((f) => requestAnimationFrame(() => f(null))))
  const dauer = Date.now() - vor
  console.log(`  ${String(dauer).padStart(4)} ms   ${was}`)
  return dauer
}

console.log('Blockade je Handlung in der Datenbank-Ansicht:\n')

const schalter = seite.getByRole('checkbox').first()
await schalter.waitFor({ state: 'attached', timeout: 15_000 })
await messen('Katalog-Toggle an (2.771 → ~18.000 Titel)', () => schalter.check({ force: true }))
await seite.waitForTimeout(1200)

const stern = seite.getByRole('button', { name: /Favoriten/ }).first()
if (await stern.isVisible().catch(() => false)) {
  await messen('Filter-Chip „Favoriten"', () => stern.click())
  await seite.waitForTimeout(400)
  await messen('Filter-Chip „Favoriten" zurück', () => stern.click())
  await seite.waitForTimeout(400)
}

const sortierung = seite.locator('select').first()
if (await sortierung.isVisible().catch(() => false)) {
  await messen('Sortierung wechseln', () => sortierung.selectOption({ index: 1 }))
}

/*
  Nach dem Sortierwechsel baut die Liste neu auf, und der alte Griff auf die
  Checkbox zeigt ins Leere. Gesucht wird deshalb frisch — und wenn sie dann
  immer noch fehlt, ist das kein Fehler der Messung.
*/
const nochmal = seite.getByRole('checkbox').first()
if (await nochmal.count()) {
  await messen('Katalog-Toggle aus', () => nochmal.uncheck({ force: true }))
}

await browser.close()
console.log('\nZum Vergleich: ein Tastendruck mit Eingabepuffer kostet 13 ms (median).')
