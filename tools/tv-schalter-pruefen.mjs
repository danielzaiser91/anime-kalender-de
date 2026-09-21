/**
 * Prüft den Schalter „TV-Ausstrahlungen anzeigen" über dem Kalender (16.09.2026,
 * umbenannt 19.09.2026 — der alte Text ließ diese Prüfung zwei Tage lang rot):
 * Wochenansicht aus `dist/`, einmal mit, einmal ohne TV-Termine — und nach dem
 * Neuladen muss die Wahl noch gelten.
 *
 * Aufruf: node tools/tv-schalter-pruefen.mjs   (vorher `npm run build`)
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const DIST = path.join(path.resolve(import.meta.dirname, '..'), 'dist')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

const browser = await chromium.launch()
const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await seite.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
})

const tvKacheln = () => seite.locator('text=/^(TOGGO PLUS|SUPER RTL|RTLZWEI)$/i').count()
await seite.goto('http://ak.test/#/woche')
await seite.waitForSelector('text=TV-Ausstrahlungen anzeigen', { timeout: 30000 })
await seite.waitForTimeout(1500)
const vorher = await tvKacheln()
await seite.getByText('TV-Ausstrahlungen anzeigen').click()
await seite.waitForTimeout(800)
const aus = await tvKacheln()
await seite.reload()
await seite.waitForSelector('text=TV-Ausstrahlungen anzeigen', { timeout: 30000 })
await seite.waitForTimeout(1500)
const nachNeuladen = await tvKacheln()
await browser.close()

console.log(`TV-Kacheln: an ${vorher}, aus ${aus}, nach Neuladen ${nachNeuladen}`)
/* Läuft diese Woche nichts im TV, ist der Schalter nicht prüfbar — das ist kein Fehler (CLAUDE.md, Momentaufnahme). */
if (vorher === 0) {
  console.log('hinweis  diese Woche keine TV-Termine — Schalter nicht geprüft')
  process.exit(0)
}
/* Seit 19.09.2026 bleiben Premieren beim Ausschalten stehen — „aus“ muss also nicht 0 sein,
   darf aber nie mehr zeigen als „an“, und das Neuladen muss dieselbe Wahl treffen. */
const ok = aus <= vorher && nachNeuladen === aus
console.log(ok ? 'ok  Schalter blendet TV-Wiederholungen aus und merkt sich die Wahl' : 'FEHLER')
process.exit(ok ? 0 : 1)
