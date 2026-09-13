#!/usr/bin/env node
/**
 * **Der Antwort-Kasten eines angekündigten Kinofilms — als Bild.**
 *
 * Daniel am 13.09.2026 zum Apothekerin-Film: Statt „Noch keine deutsche
 * Fassung" soll der Kasten den japanischen Kinostart nennen, sagen, dass der
 * deutsche fehlt, und was der Stern bringt. `panel-bild.mjs` bildet nur Titel
 * aus dem Hauptbestand ab; angekündigte Filme liegen fast alle im Katalog
 * hinter dem Toggle.
 *
 * Gemessen wird, was ein Bild nicht beantwortet: steht „Noch keine deutsche
 * Fassung" noch irgendwo im Panel, und ist der alte Abschnitt „Keine deutsche
 * Synchro bekannt" weg (er sagte dasselbe ein zweites Mal)?
 *
 * **Ohne Server:** `page.route()` beantwortet jede Anfrage aus `dist/`.
 *
 * Aufruf: node tools/kino-kasten-bild.mjs [<AniList-Id>]   (Standard: 200929)
 * Ergebnis: docs/kino-kasten-<hell|dunkel>.png
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
}

if (!existsSync(DIST)) {
  console.error('Kein dist/ — vorher `npm run build`.')
  process.exit(1)
}

const id = process.argv[2] ?? '200929'
const browser = await chromium.launch()
const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await seite.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  /* Fremde Bilder bekommen ein leeres PNG statt eines Abbruchs — sonst füllt sich die Konsole mit Fehlern. */
  if (url.hostname !== 'ak.test') {
    return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) })
  }
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

console.log(`Kino-Kasten an Titel ${id}:\n`)
for (const thema of ['dunkel', 'hell']) {
  await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
  await seite.goto('about:blank')
  await seite.goto(`http://ak.test/#/datenbank?t=${id}`, { waitUntil: 'networkidle' })
  await seite.waitForSelector('[role="dialog"]', { timeout: 15_000 })
  await seite.waitForTimeout(800)
  const text = await seite.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '')
  if (thema === 'dunkel') {
    console.log(text.split('\n').filter(Boolean).slice(0, 12).map((z) => `    │ ${z}`).join('\n'))
    pruefe('der Kasten nennt den Kinostart', /im Kino|japanischen Kinos|als Kinofilm angekündigt/.test(text))
    pruefe('„Noch keine deutsche Fassung" steht nicht mehr da', !text.includes('Noch keine deutsche Fassung'))
    pruefe('der Abschnitt „Keine deutsche Synchro bekannt" ist weg', !text.includes('Keine deutsche Synchro bekannt'))
    pruefe('„Kein Anbieter bekannt" ist ersetzt', !text.includes('Kein Anbieter bekannt'))
  }
  const panel = seite.locator('[role="dialog"]').first()
  await panel.screenshot({ path: path.join(WURZEL, 'docs', `kino-kasten-${thema}.png`) })
}

await browser.close()
console.log('\n  Bilder: docs/kino-kasten-dunkel.png, docs/kino-kasten-hell.png')
process.exit(fehler.length ? 1 : 0)
