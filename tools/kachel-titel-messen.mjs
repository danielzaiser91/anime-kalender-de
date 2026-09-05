#!/usr/bin/env node
/**
 * Misst, wie viele Kachel-Titel in der Wochenansicht gekappt sind — und bildet sie ab.
 *
 * Entstanden am 05.09.2026 aus Daniels Vorgabe zur Entscheidung über die
 * Kachel: „zeig problem und lösung visuell bevor ich mich entscheide." Die
 * Entscheidung ist gefallen, das Werkzeug bleibt — es ist die einzige Stelle,
 * an der ein Rückschritt an dieser Kachel auffiele.
 *
 * **Gemessen, nicht geschätzt:** gekappt heißt `scrollHeight > clientHeight` am
 * Titel-Element. Auf einem Screenshot ist der Unterschied zwischen „passt
 * genau" und „endet mit …" leicht zu übersehen.
 *
 * **Ohne Server**, wie `ansicht-bild.mjs` und `panel-bild.mjs`: `page.route()`
 * beantwortet jede Anfrage aus `dist/`, gerendert wird also genau das, was
 * ausgeliefert wird.
 *
 * Die Zahlen, die zur Entscheidung geführt haben (1280 × 900, dunkles Thema,
 * 42 sichtbare Titel — die drei mittleren Zeilen sind Varianten, die es nie in
 * den Code geschafft haben):
 *
 * ```
 * Titel neben dem Cover, drei Zeilen   20 gekappt   134 px   ← Stand davor
 * … vier Zeilen                         6 gekappt   152 px
 * … ohne Grenze                         0 gekappt   170 px
 * … Icons neben den Titel              35 gekappt   134 px   ← Sackgasse
 * Titel über die volle Kachelbreite     0 gekappt   136 px   ← gebaut
 * ```
 *
 * Der Engpass war die **Breite**, nicht die Zeilenzahl: Neben dem Cover hatte
 * der Titel 85 von 153 Pixeln, also rund zehn Zeichen je Zeile.
 *
 * Aufruf: npm run bild:kachel
 * Ergebnis: `docs/kachel-woche.png` und eine Zeile mit der Zahl.
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')

/** Ein 1×1-Pixel-PNG — die Antwort auf jede fremde Bildanfrage. */
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

/*
  **Der Titel wird über seine Klassen gesucht, und das Werkzeug bricht ab, wenn
  es keinen findet.** Ein Lauf, der null Titel misst, meldete sonst „0 gekappt"
  — die beste Zahl der Tabelle für den Zustand, in dem gar nichts geprüft
  wurde. Genau das ist beim Bauen dieser Änderung einmal passiert.
*/
const TITEL = '.line-clamp-4.text-\\[13px\\].font-medium'

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ fehlt — erst `npm run build`.')
    process.exitCode = 1
    return
  }
  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  await seite.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
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

  await seite.emulateMedia({ colorScheme: 'dark' })
  await seite.goto('http://ak.test/#/woche', { waitUntil: 'networkidle' })
  await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
  /* Der Datenabruf läuft nach dem ersten Bild — sonst misst man den Ladezustand. */
  await seite.waitForTimeout(2500)

  const mass = await seite.evaluate((sel) => {
    const titel = [...document.querySelectorAll(sel)]
    const gekappt = titel.filter((e) => e.scrollHeight - e.clientHeight > 1)
    const kachel = titel[0]?.closest('div[style*="border-left"]')
    return {
      sichtbar: titel.length,
      gekappt: gekappt.length,
      kachelHoehe: kachel ? Math.round(kachel.getBoundingClientRect().height) : 0,
      beispiele: gekappt.slice(0, 5).map((e) => e.textContent.trim().slice(0, 44)),
    }
  }, TITEL)

  await seite.screenshot({ path: path.join(WURZEL, 'docs', 'kachel-woche.png') })
  await browser.close()

  if (!mass.sichtbar) {
    console.error('  ✕ kein einziger Kachel-Titel gefunden — Klassen geändert? Selektor anpassen.')
    process.exitCode = 1
    return
  }
  console.log(
    `\n  ${mass.sichtbar} Titel sichtbar, ${mass.gekappt} gekappt, erste Kachel ${mass.kachelHoehe} px`,
  )
  for (const b of mass.beispiele) console.log(`      ${b}…`)
  /*
    **Eine Schwelle, keine Null.** Ein einzelner sehr langer Titel darf enden;
    was hier auffallen soll, ist der Rückfall auf die schmale Spalte — dort
    waren es zwanzig.
  */
  const SCHWELLE = 5
  if (mass.gekappt > SCHWELLE) {
    console.error(`  ✕ mehr als ${SCHWELLE} gekappte Titel — steht der Titel wieder neben dem Cover?`)
    process.exitCode = 1
  } else {
    console.log('  ok  die Titel passen')
  }
}

await main()
