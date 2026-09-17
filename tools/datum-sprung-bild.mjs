#!/usr/bin/env node
/*
  Bild der Datumsauswahl in der Kopfleiste (17.09.2026): öffnet sie, zeigt die
  Monate, wählt November und zeigt die Tage, klickt einen Tag und prüft, dass die
  Adresse danach das Datum trägt. Beide Themen, ohne Server — wie ansicht-bild.mjs.
*/
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
const EIN_PUNKT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }

const browser = await chromium.launch()
const seite = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const fehler = []
seite.on('pageerror', (e) => fehler.push(String(e)))
await seite.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
})

let rot = false
for (const thema of ['dunkel', 'hell']) {
  await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
  await seite.goto('about:blank')
  await seite.goto('http://ak.test/#/woche', { waitUntil: 'networkidle' })
  await seite.getByRole('button', { name: 'Zu einem Datum springen' }).click()
  await seite.waitForTimeout(300)
  await seite.screenshot({ path: path.join(WURZEL, 'docs', `datum-sprung-monate-${thema}.png`), clip: { x: 0, y: 0, width: 1280, height: 480 } })
  await seite.getByRole('dialog').getByRole('button', { name: /^Nov/ }).click()
  await seite.waitForTimeout(200)
  await seite.screenshot({ path: path.join(WURZEL, 'docs', `datum-sprung-tage-${thema}.png`), clip: { x: 0, y: 0, width: 1280, height: 480 } })
  await seite.getByRole('dialog').getByRole('button', { name: '24', exact: true }).click()
  await seite.waitForTimeout(300)
  const adresse = seite.url()
  const ok = /2026-11-2[34]/.test(adresse)
  console.log(`${thema}: Sprung auf 24.11. → ${adresse} ${ok ? 'ok' : 'FEHLT'}`)
  if (!ok) rot = true
}
await browser.close()
if (fehler.length) {
  console.log('Seitenfehler:', fehler.slice(0, 3))
  rot = true
}
process.exitCode = rot ? 1 : 0
