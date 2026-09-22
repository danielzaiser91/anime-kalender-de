/* Prüft den Zurück-Pfeil (22.09.2026, `npm run check:zurueck`, braucht `dist/`): Karte A öffnen, Karte B öffnen, zurück → Panel zeigt A.
   Vor dem Fix blieb B offen, weil der Router nur `hashchange` hörte (siehe `useRoute`). */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
const DIST = path.resolve('dist')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
const browser = await chromium.launch()
const seite = await browser.newPage()
await seite.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) })
  let datei = path.join(DIST, url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname)
  if (!existsSync(datei)) datei = path.join(DIST, 'index.html')
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
})
/* Zwei Karten verschiedener Titel aus den gebauten Daten — die Prüfung hängt an keinem Tagesstand. */
const rohR = JSON.parse(await readFile(path.join(DIST, 'data/releases.json'), 'utf8'))
const rohT = JSON.parse(await readFile(path.join(DIST, 'data/titles.json'), 'utf8'))
const ids = new Set((Array.isArray(rohT) ? rohT : rohT.titles).map((t) => t.id))
const karten = []
for (const r of Array.isArray(rohR) ? rohR : rohR.releases) {
  if (!ids.has(r.titleId) || karten.some((k) => k.titleId === r.titleId)) continue
  karten.push(r)
  if (karten.length === 2) break
}
const [A, B] = karten.map((k) => k.slug)
/* Das Titel-Panel trägt `data-panel="titel"` und den Anzeigenamen als `aria-label`. */
const titel = () => seite.evaluate(() => document.querySelector('[data-panel="titel"]')?.getAttribute('aria-label') ?? '(kein Panel)')
await seite.goto('http://ak.test/#/woche')
await seite.waitForTimeout(2500)
await seite.evaluate((slug) => { location.hash = `#/woche?r=${slug}` }, A)
await seite.waitForTimeout(1500)
const a = { url: seite.url(), titel: await titel() }
await seite.evaluate((slug) => { location.hash = `#/woche?r=${slug}` }, B)
await seite.waitForTimeout(1500)
const b = { url: seite.url(), titel: await titel() }
await seite.goBack()
await seite.waitForTimeout(1500)
const zurueck = { url: seite.url(), titel: await titel() }
await browser.close()
console.log('A      ', a.url, '·', a.titel)
console.log('B      ', b.url, '·', b.titel)
console.log('zurück ', zurueck.url, '·', zurueck.titel)
const ok = zurueck.titel === a.titel && a.titel !== b.titel
console.log(ok ? 'ok  Zurück zeigt wieder A' : 'FEHL Zurück zeigt nicht A')
if (!ok) process.exit(1)
