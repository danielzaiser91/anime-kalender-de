#!/usr/bin/env node
/**
 * Laufzeitprobe der Datenadressen: lädt das gebaute `dist/` in Chromium (wie `install-zustaende-pruefen.mjs`: `page.route()` liefert aus `dist/`)
 * und prüft die echten Anfragen an `/data/*.json` beim Start, im vollen Pfad (`#/datenbank`) und im Wochen-Pfad (`#/woche`),
 * gegen `dist/data/meta.json` (Regeln: `tools/daten-adressen-bewerten.ts`). Fängt, was Text-Prüfungen nicht sehen:
 * ein Vorlade-Skript oder `loadJson()`, das die Tabelle umgeht.
 * Aufruf: node tools/daten-adressen-browser.mjs [--dist <ordner>]   (nach `npm run build`)
 */
import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { bewerteAnfragen } from './daten-adressen-bewerten.ts'

const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined)
const DIST = path.resolve(arg('--dist') ?? path.join(import.meta.dirname, '..', 'dist'))
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

async function start(browser, hash, zeit) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: 'block' })
  await ctx.clock.setFixedTime(zeit)
  const anfragen = []
  await ctx.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
    if (/\/data\/.*\.json$/.test(url.pathname)) anfragen.push(url.href)
    const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
  })
  const seite = await ctx.newPage()
  await seite.goto(`http://ak.test/${hash}`, { waitUntil: 'networkidle' })
  await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
  const wochenpfad = await seite.evaluate(() => window.__akWoche === true)
  const vorgeladen = await seite.evaluate(() => [...document.querySelectorAll('link[rel=preload][as=fetch]')].map((l) => l.href))
  await ctx.close()
  return { anfragen, vorgeladen, wochenpfad }
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error(`${DIST} fehlt — erst \`npm run build\`.`)
    process.exitCode = 1
    return
  }
  const dateien = JSON.parse(readFileSync(path.join(DIST, 'data', 'meta.json'), 'utf8')).dateien ?? {}
  const version = JSON.parse(readFileSync(path.join(DIST, 'version.json'), 'utf8')).v
  // Feste Uhr mitten in der Woche von woche.json: so wählt das Vorlade-Skript den Wochen-Pfad an jedem Tag, die Probe schaltet sich nie ab.
  const woche = JSON.parse(readFileSync(path.join(DIST, 'data', 'woche.json'), 'utf8'))
  const zeit = new Date(`${woche.von}T12:00:00Z`)
  const browser = await chromium.launch()
  const fehler = []
  const zeilen = []
  for (const [name, hash, erwartetWoche] of [['voll', '#/datenbank', false], ['Woche', '#/woche', true]]) {
    const r = await start(browser, hash, zeit)
    zeilen.push(`${name}: ${r.anfragen.length} Datenabrufe, ${r.vorgeladen.length} vorgeladen`)
    if (!erwartetWoche && r.wochenpfad) fehler.push(`${name}: Wochen-Pfad statt der vollen Dateien`)
    if (erwartetWoche && !r.wochenpfad) fehler.push(`${name}: Wochen-Pfad nicht gewählt, die Probe hätte nichts gemessen`)
    for (const f of bewerteAnfragen(r.anfragen, r.vorgeladen, dateien, version)) fehler.push(`${name}: ${f}`)
  }
  await browser.close()
  if (fehler.length) {
    console.error(`✖ Daten-Adressen im Browser: ${fehler.join('; ')}`)
    process.exitCode = 1
    return
  }
  console.log(`  ✓ Daten-Adressen im Browser: ${zeilen.join('; ')}, alle mit der Kennung aus meta.json`)
}

await main()
