#!/usr/bin/env node
/**
 * **Der Einstellungsdialog — am Handy erreichbar und ohne Cartoon-Schalter.**
 *
 * Cartoons schaltet nur der Schnellfilter (Filter `kw`/`xkw` in der Adresse). Gemessen wird: Das Zahnrad steht
 * bei 393 px in der Tab-Leiste, der Dialog geht auf, enthält die Thema-Zeile und keine Cartoon-Zeile; am
 * Rechner (1280 px) gibt es kein Zahnrad, weil der Dialog dort nichts enthielte.
 *
 * Aufruf: `node tools/einstellungen-bild.mjs` · `npm run check:einstellungen`
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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

if (!existsSync(DIST)) {
  console.error('Kein dist/ — vorher `npm run build`.')
  process.exit(1)
}

const browser = await chromium.launch()
const seite = await browser.newPage({ viewport: { width: 393, height: 852 } })
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

const fehler = []
const pruefe = (was, ok, zusatz) => {
  console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${was}${ok || zusatz === undefined ? '' : ` — ${zusatz}`}`)
  if (!ok) fehler.push(was)
}

async function sichtbareZahnraeder() {
  const alle = seite.getByRole('button', { name: 'Einstellungen' })
  let n = 0
  for (let i = 0; i < (await alle.count()); i++) if (await alle.nth(i).isVisible()) n++
  return n
}

console.log('Die Einstellungen:\n')

for (const thema of ['dunkel', 'hell']) {
  await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })

  await seite.setViewportSize({ width: 393, height: 852 })
  await seite.goto('about:blank')
  await seite.goto('http://ak.test/#/datenbank', { waitUntil: 'networkidle' })
  await seite.waitForTimeout(1500)
  pruefe(`393 px: genau ein Zahnrad (${thema})`, (await sichtbareZahnraeder()) === 1)
  await seite.getByRole('button', { name: 'Einstellungen' }).locator('visible=true').click()
  const dialog = seite.getByRole('dialog', { name: 'Einstellungen' })
  await dialog.waitFor({ state: 'visible', timeout: 10_000 })
  await seite.screenshot({ path: path.join(WURZEL, 'docs', `einstellungen-${thema}.png`) })
  const text = await dialog.innerText()
  pruefe(`393 px: Dialog enthält die Thema-Zeile (${thema})`, /Helles Design/.test(text), text)
  pruefe(`393 px: Dialog hat keine Cartoon-Zeile (${thema})`, !/cartoon/i.test(text), text)
  await seite.keyboard.press('Escape')

  await seite.setViewportSize({ width: 1280, height: 900 })
  await seite.waitForTimeout(400)
  pruefe(`1280 px: kein Zahnrad (${thema})`, (await sichtbareZahnraeder()) === 0)
}

await browser.close()
console.log('\n  Bilder: docs/einstellungen-dunkel.png · docs/einstellungen-hell.png')
process.exit(fehler.length ? 1 : 0)
