#!/usr/bin/env node
/**
 * **Wie träge ist die Datenbanksuche wirklich?**
 *
 * Anlass (Daniel, 12.09.2026): „ich hab gerade was gesucht und es hat extrem
 * gelaggt, sodass tastatur eingaben verschluckt wurden … mach ein input buffer
 * rein, sodass die suche erst anfängt wenn mindestens x ms nix eingegeben
 * wurde."
 *
 * Gemessen wird genau das: Ein Wort wird Zeichen für Zeichen getippt, im Takt
 * eines geübten Tippers, und danach verglichen, was im Feld steht — plus die
 * Zeit, die der Haupt-Thread je Anschlag blockiert war. Eine Blockade über
 * rund 100 ms ist die Schwelle, ab der sich eine Eingabe hakelig anfühlt; ab
 * einigen hundert Millisekunden gehen Anschläge verloren.
 *
 * **Gemessen am 12.09.2026** an „attack on titan" (15 Anschläge), mit
 * eingeschaltetem Katalog-Toggle:
 *
 * | | median | Ausreißer |
 * |---|---|---|
 * | ohne Eingabepuffer | 82 ms | **534 ms** |
 * | mit Eingabepuffer (250 ms Ruhe) | 13 ms | 24 ms |
 *
 * Die Gegenprobe ist der Wert des Werkzeugs: Ohne sie belegt die zweite Zeile
 * nur, dass es jetzt schnell ist — nicht, dass der Puffer es bewirkt hat.
 * Gefahren wird sie, indem man die Änderung an `FilterBar.tsx` kurz
 * zurücklegt (`git stash`), neu baut und erneut misst.
 *
 * Aufruf: `node tools/such-messung.mjs [--katalog]` · `npm run mess:suche`
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const WURZEL = 'C:/code/ai/anime-kalender-de'
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

const WORT = 'attack on titan'
/* Ein geübter Tipper schlägt alle 120 bis 200 ms an. */
const TAKT_MS = 130

const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 1280, height: 900 } })
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

const MIT_KATALOG = process.argv.includes('--katalog')

await seite.goto('http://ak.test/#/datenbank', { waitUntil: 'networkidle' })

/*
  **Der Toggle ist der interessantere Fall.** Ohne ihn stehen 2.771 Titel in
  der Liste, mit ihm rund 18.000 — und genau dort wird eine Filterung je
  Anschlag teuer.
*/
if (MIT_KATALOG) {
  /* Der Schalter ist eine Checkbox hinter `sr-only` — geklickt wird ihr Label. */
  const schalter = seite.getByRole('checkbox').first()
  await schalter.waitFor({ state: 'attached', timeout: 15_000 })
  await schalter.check({ force: true })
  await seite.waitForTimeout(1500)
}

const feld = seite.locator('input[type="search"]').first()
await feld.waitFor({ state: 'visible', timeout: 15_000 })
await feld.click()

/* Je Anschlag messen, wie lange der Haupt-Thread danach nicht antwortet. */
const dauern = []
for (const zeichen of WORT) {
  const vor = Date.now()
  await seite.keyboard.type(zeichen)
  await seite.evaluate(() => new Promise((f) => requestAnimationFrame(() => f(null))))
  dauern.push(Date.now() - vor)
  await seite.waitForTimeout(TAKT_MS)
}

const imFeld = await feld.inputValue()
/* Nach der Ruhezeit muss die Trefferliste stehen. */
await seite.waitForTimeout(600)
const treffer = await seite.evaluate(() => {
  const text = document.body.innerText.match(/([\d.]+)\s+Anime mit belegter/)
  return text ? text[1] : '(nicht gefunden)'
})

await browser.close()

const sortiert = [...dauern].sort((a, b) => a - b)
console.log(`Getippt: „${WORT}" (${WORT.length} Anschläge im Takt von ${TAKT_MS} ms)${MIT_KATALOG ? ' · mit Katalog-Toggle' : ''}`)
console.log(`Im Feld: „${imFeld}"  ${imFeld === WORT ? '✓ vollständig' : '✕ ZEICHEN VERSCHLUCKT'}`)
console.log(`Blockade je Anschlag: min ${sortiert[0]} · median ${sortiert[Math.floor(sortiert.length / 2)]} · max ${sortiert[sortiert.length - 1]} ms`)
console.log(`Trefferzeile danach: ${treffer}`)
