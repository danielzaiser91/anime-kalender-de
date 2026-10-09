#!/usr/bin/env node
/**
 * Zusicherung: Fällt der Dialog-Chunk („Neu auf der Webseite“) aus (alter Cache, neuer Hash → 404),
 * bleibt die Seite stehen und der Knopf meldet den Fehler — statt die ganze App abzuräumen (schwarze Fläche).
 * Ohne Server: `page.route()` beantwortet jede Anfrage aus `dist/`. Aufruf: npm run check:patchnotes-chunk (nach `vite build`).
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '..', 'dist')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

if (!existsSync(DIST)) (console.error('dist/ fehlt — erst `vite build`.'), process.exit(1))
const browser = await chromium.launch()
let schlimm = 0
for (const [ausfall, erwartetDialog] of [[false, true], [true, false]]) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 826 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  const seite = await ctx.newPage()
  await seite.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
    if (ausfall && /PatchnotesDialog.*\.js$/.test(url.pathname)) return route.fulfill({ status: 404, body: '' })
    const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
  })
  await seite.goto('http://ak.test/#/news', { waitUntil: 'networkidle' })
  await seite.getByRole('button', { name: /Neu auf der Webseite/i }).first().click()
  await seite.waitForTimeout(1000)
  const dialog = await seite.locator('.pn').count()
  const seiteDa = await seite.locator('header').count()
  const meldung = await seite.getByRole('alert').filter({ hasText: /geladen/ }).count()
  const ok = Boolean(dialog) === erwartetDialog && seiteDa > 0 && Boolean(meldung) === !erwartetDialog
  if (!ok) schlimm++
  console.log(`  ${ok ? '✓' : '✖'} Chunk ${ausfall ? 'fällt aus' : 'da'}: Dialog ${dialog}, Seite ${seiteDa}, Fehlermeldung ${meldung}`)
  await ctx.close()
}
await browser.close()
process.exit(schlimm ? 1 : 0)
