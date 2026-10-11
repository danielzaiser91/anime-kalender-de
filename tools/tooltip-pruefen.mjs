#!/usr/bin/env node
/**
 * Tooltip-Verhalten im Detail-Panel (dist/, ohne Server): höchstens eine Blase; keine Blase nach Rückkehr aus einem neuen Tab;
 * Tastaturfokus zeigt sie weiter. Anlass (11.10.2026): Nach dem Klick auf „aniSearch ↗“ blieb der Hinweis stehen, ein zweiter kam dazu.
 * Aufruf: `npm run check:tooltip` (erst `npm run build`). Ein Wechsel des Tabs wird nachgestellt (blur/focus am Element, visibilitychange), weil headless keinen echten kennt.
 */
import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '../dist')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/json' }
let rot = 0
const melde = (ok, text) => {
  console.log((ok ? '  ok  ' : '  ✕  ') + text)
  if (!ok) rot++
}

async function seiteOeffnen(browser) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, serviceWorkers: 'block' })
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return route.continue()
    if (u.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' })
    let f = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname)
    if (!path.extname(f) || !existsSync(f)) f = path.join(DIST, 'index.html')
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(f)] ?? 'application/octet-stream', body: readFileSync(f) })
  })
  const p = await ctx.newPage()
  await p.goto('http://ak.test/#/datenbank?t=3342', { waitUntil: 'networkidle' })
  await p.locator('[data-panel="titel"]').waitFor({ timeout: 15_000 })
  return { ctx, p }
}

/** Fenster verliert und gewinnt den Fokus zurück, wie bei Tabwechsel: Element wird unfokussiert und wieder fokussiert. */
async function tabWechsel(p) {
  await p.evaluate(() => {
    const a = document.activeElement
    window.__a = a
    a.blur()
    window.dispatchEvent(new Event('blur'))
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await p.waitForTimeout(150)
  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    window.__a.focus()
  })
  await p.waitForTimeout(150)
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) { console.error('dist/ fehlt - erst `npm run build`.'); process.exitCode = 1; return }
  const browser = await chromium.launch()
  const { ctx, p } = await seiteOeffnen(browser)
  const blasen = () => p.locator('[role="tooltip"]').allTextContents()
  const as = p.getByRole('link', { name: /aniSearch/ }).first()
  const mal = p.getByRole('link', { name: /MAL/ }).first()

  await as.hover()
  melde((await blasen()).length === 1, 'Schweben über aniSearch zeigt eine Blase')
  const [neu] = await Promise.all([ctx.waitForEvent('page'), as.click()])
  await neu.close()
  await tabWechsel(p)
  melde((await blasen()).length === 0, 'nach Klick und Rückkehr aus dem neuen Tab steht keine Blase')
  await as.hover()
  await p.mouse.move(5, 5)
  melde((await blasen()).length === 0, 'Wegfahren schließt sie')

  await as.hover()
  await mal.hover()
  const beide = await blasen()
  melde(beide.length === 1 && /MyAnimeList/.test(beide[0]), `Schweben über MAL ersetzt die Blase (${beide.length} sichtbar)`)

  await p.mouse.move(5, 5)
  await p.keyboard.press('Tab')
  await as.focus()
  await p.keyboard.press('Shift+Tab')
  await p.keyboard.press('Tab')
  const taste = await blasen()
  melde(taste.length === 1, `Tastaturfokus zeigt die Blase (${taste.length})`)
  await mal.hover()
  melde((await blasen()).length === 1, 'Fokus-Blase und Schweben zusammen: eine Blase')
  await p.mouse.move(5, 5)
  await p.evaluate(() => window.dispatchEvent(new Event('blur')))
  melde((await blasen()).length === 0, 'Fensterblur schließt die Blase')

  await browser.close()
  if (rot) process.exitCode = 1
}
await main()
