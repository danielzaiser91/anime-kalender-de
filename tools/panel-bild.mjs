#!/usr/bin/env node
/**
 * Bildet das Detail-Panel ab — für die Augen, nicht für den Rechner.
 *
 * Daniel am 03.09.2026, nachdem drei Fassungen des Kastens nacheinander
 * danebengingen: „prüf das styling selbst mit playwright und screenshots." Was
 * überlappt, springt oder in der falschen Zeile steht, sieht man auf einem Bild
 * in einer Sekunde und in keiner Messung.
 *
 * **Ohne Server.** Die Regel dieses Rechners lässt keinen laufen, ohne vorher zu
 * fragen — also fängt `page.route()` jede Anfrage ab und beantwortet sie aus
 * `dist/`. Das ist kein Umweg, sondern näher am Ernstfall als ein Dev-Server:
 * gerendert wird genau das, was ausgeliefert wird.
 *
 * Aufruf: node tools/panel-bild.mjs [<AniList-Id> …]
 *         npm run check:panel
 *
 * Ergebnis: docs/panel-<id>-<hell|dunkel>.png, dazu die gemessenen Höhen des
 * Antwort-Kastens auf der Konsole — springt er zwischen zwei Titeln, steht es
 * dort schwarz auf weiß.
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
/*
  Drei Zustände desselben Kastens, an denen sich das Springen zeigt: Staffel 1
  der Apothekerin hat Stream **und** Disc (also den Umschalter), Staffel 2 nur
  Stream, und „Mission: Yozakura Family" gar keine deutsche Fassung.

  **Nur Titel aus dem Hauptbestand.** Was keine belegte Synchro hat, liegt in
  `ohne-synchro.json` und wird erst geladen, wenn der Schalter in der Datenbank
  umgelegt ist — die Mini-Episoden der Apothekerin standen hier zuerst und
  öffneten kein Panel.
*/
const STANDARD = ['161645', '176301', '163132']

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
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : STANDARD

  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: { width: 560, height: 1200 } })

  /*
    Alles unter der erfundenen Adresse kommt aus `dist/`. Cover und Bilder liegen
    bei AniList und werden abgewiesen statt geholt — sie sagen nichts über das
    Layout, kosten aber jedes Mal Zeit und einen fremden Abruf.
  */
  await seite.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    /*
      `about:blank` muss durch — der Sprung dorthin setzt die Anwendung zwischen
      zwei Titeln zurück. Wurde er mit abgewiesen, blieb die Seite danach in
      einem Zustand, in dem das Panel nie erschien.
    */
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
    if (url.hostname !== 'ak.test') return route.abort()
    const rel = url.pathname === '/' ? '/index.html' : url.pathname
    const datei = path.join(DIST, rel)
    if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      status: 200,
      contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream',
      body: await readFile(datei),
    })
  })

  const hoehen = []
  for (const id of ids) {
    for (const thema of ['dunkel', 'hell']) {
      await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
      /*
        Erst auf eine andere Adresse, dann auf die gewünschte: Ein reiner
        Hash-Wechsel lädt die Seite nicht neu, und die zweite Aufnahme zeigte
        sonst den Titel der ersten.
      */
      await seite.goto('about:blank')
      /*
        Über die Datenbank-Ansicht, nicht über den Kalender: Titel ohne Termin
        stehen nicht in `titles-core.json`, und dort würde das Panel nie
        erscheinen. Die Datenbank lädt `titles.json` nach — also alle.
      */
      await seite.goto(`http://ak.test/#/datenbank?t=${id}`, { waitUntil: 'networkidle' })
      const panel = seite.locator('aside[role="dialog"]')
      try {
        await panel.waitFor({ state: 'visible', timeout: 15_000 })
      } catch {
        /*
          Kein Panel heißt fast immer: Der Titel steht nicht im Hauptbestand,
          sondern in `ohne-synchro.json`. Das ist kein Fehler des Werkzeugs —
          es sagt es und geht weiter.
        */
        console.log(`  – ${id}: kein Panel (Titel nicht im Hauptbestand?)`)
        break
      }
      /* Der Kasten ist die erste `section` im Panel — die Antwort auf „wann, wie weit, wo". */
      const kasten = panel.locator('section').first()
      await kasten.waitFor({ state: 'visible', timeout: 15_000 })
      const box = await kasten.boundingBox()
      if (thema === 'dunkel') hoehen.push({ id, hoehe: Math.round(box?.height ?? 0) })
      await panel.screenshot({ path: path.join(WURZEL, 'docs', `panel-${id}-${thema}.png`) })
    }
  }

  await browser.close()

  console.log('\nHöhe des Antwort-Kastens je Titel:')
  for (const h of hoehen) console.log(`  ${h.id}: ${h.hoehe} px`)
  const einzig = new Set(hoehen.map((h) => h.hoehe))
  if (einzig.size > 1) {
    console.log(`\n  ✕ ${einzig.size} verschiedene Höhen — der Kasten springt beim Wechsel.`)
    process.exitCode = 1
  } else {
    console.log('\n  ok  alle gleich hoch')
  }
}

await main()
