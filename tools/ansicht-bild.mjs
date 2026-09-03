#!/usr/bin/env node
/**
 * Bildet die Hauptansichten ab — Woche, Monat, Agenda, Datenbank, „Wo sehen?".
 *
 * Das Gegenstück zu `panel-bild.mjs`, das nur das Detail-Panel kennt. Der
 * Kalender ist das Kernstück der Seite und war bis zum 03.09.2026 nie
 * abgebildet: Alle Styling-Befunde kamen aus Screenshots, die Daniel selbst
 * gemacht hat.
 *
 * **Ohne Server**, wie das Panel-Werkzeug: `page.route()` beantwortet jede
 * Anfrage aus `dist/`, gerendert wird also genau das, was ausgeliefert wird.
 *
 * Aufruf: node tools/ansicht-bild.mjs [<ansicht> …]   (Vorgabe: alle fünf)
 *         npm run check:ansichten
 *
 * Ergebnis: `docs/ansicht-<name>-<hell|dunkel>.png`, dazu je Ansicht die Zahl
 * der Konsolenfehler und ein Hinweis, wenn die Seite waagerecht scrollt — das
 * ist der Mangel, den man auf einem Bild am leichtesten übersieht.
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
const ALLE = ['woche', 'monat', 'agenda', 'datenbank', 'wo']

/** Ein 1×1-Pixel-PNG, transparent — die Antwort auf jede fremde Bildanfrage. */
const EIN_PUNKT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const TYPEN = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ fehlt — erst `npm run build`.')
    process.exitCode = 1
    return
  }
  const ansichten = process.argv.slice(2).length ? process.argv.slice(2) : ALLE

  const browser = await chromium.launch()
  /* Eine gängige Fenstergröße, kein Sonderfall — 1280 × 900. */
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  const fehler = []
  seite.on('console', (m) => {
    if (m.type() === 'error') fehler.push(m.text().slice(0, 160))
  })
  seite.on('pageerror', (e) => fehler.push(String(e).slice(0, 160)))

  await seite.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
    /*
      **Fremde Bilder werden beantwortet, nicht abgewiesen.**

      Die Cover liegen bei AniList. Ein `route.abort()` sparte den Abruf, warf
      aber je Bild einen Konsolenfehler — sechzig Stück in der Datenbank-Ansicht,
      und die Fehlerzählung dieses Werkzeugs war damit wertlos. Ein
      Einpunkt-PNG kostet nichts und hält die Konsole sauber für die Fehler, um
      die es geht.
    */
    if (url.hostname !== 'ak.test') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
    }
    const rel = url.pathname === '/' ? '/index.html' : url.pathname
    const datei = path.join(DIST, rel)
    if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      status: 200,
      contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream',
      body: await readFile(datei),
    })
  })

  const befunde = []
  for (const name of ansichten) {
    for (const thema of ['dunkel', 'hell']) {
      fehler.length = 0
      await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
      await seite.goto('about:blank')
      await seite.goto(`http://ak.test/#/${name}`, { waitUntil: 'networkidle' })
      await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
      /* Der Datenabruf läuft nach dem ersten Bild — sonst fotografiert man den Ladezustand. */
      await seite.waitForTimeout(2500)
      await seite.screenshot({
        path: path.join(WURZEL, 'docs', `ansicht-${name}-${thema}.png`),
        fullPage: false,
      })
      if (thema === 'dunkel') {
        /*
          **Waagerechtes Scrollen ist der Mangel, den ein Bild verschweigt.**
          Auf dem Screenshot sieht eine zu breite Tabelle aus wie eine
          abgeschnittene; erst die Zahl sagt, dass der Besucher schieben muss.
        */
        const breite = await seite.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          fenster: window.innerWidth,
        }))
        befunde.push({ name, fehler: [...fehler], ueberbreite: breite.doc - breite.fenster })
      }
    }
  }

  await browser.close()

  let rot = false
  console.log('\nAnsicht        Überbreite  Konsolenfehler')
  for (const b of befunde) {
    const ueber = b.ueberbreite > 1 ? `${b.ueberbreite} px` : '—'
    console.log(`  ${b.name.padEnd(12)} ${ueber.padEnd(11)} ${b.fehler.length || '—'}`)
    for (const f of b.fehler.slice(0, 3)) console.log(`      ${f}`)
    if (b.ueberbreite > 1 || b.fehler.length) rot = true
  }
  console.log(rot ? '\n  ✕ etwas stimmt nicht — siehe oben' : '\n  ok  keine Überbreite, keine Fehler')
  if (rot) process.exitCode = 1
}

await main()
