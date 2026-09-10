#!/usr/bin/env node
/**
 * **Wie die Pillen der Statusanzeige wirklich aussehen.**
 *
 * Daniel am 10.09.2026: „do different colors depending on the pill target,
 * check their company logo for colors to choose." Farbwerte lassen sich lesen,
 * aber nicht beurteilen — ob Netflix' Rot auf dem dunklen Grund der Anzeige
 * kräftig genug ist und ob fünf Pillen nebeneinander noch als Reihe wirken,
 * entscheidet ein Bild.
 *
 * Der echte Code läuft: Die Antwort des Worker-Endpunkts wird abgefangen und
 * durch einen festen Stand ersetzt, alles andere — Klassenvergabe, Stylesheet,
 * Aufbau — ist das Original. Ein Nachbau würde den eigenen Nachbau prüfen.
 *
 * Aufruf: `node tools/lauf-status-pillen-bild.mjs`
 * Ergebnis: `docs/lauf-status-pillen.png`
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const SEITE = 'C:/code/ai/__assets/tools/lauf-status/index.html'
const ZIEL = 'docs/lauf-status-pillen.png'

/** Ein Stand mit allen fünf Aufgaben — so, wie ihn der Worker liefert. */
const STAND = {
  offen: 24,
  anbieter: [
    { name: 'Amazon', plattform: 'primevideo', titel: 5, ohneSeite: 2, unterwegs: 0, ziel: 'https://x/1', ziele: [] },
    { name: 'Netflix', plattform: 'netflix', titel: 5, ohneSeite: 0, unterwegs: 0, ziel: 'https://x/2', ziele: [] },
    { name: 'Disney+', plattform: 'disneyplus', titel: 3, ohneSeite: 0, unterwegs: 0, ziel: 'https://x/3', ziele: [] },
    { name: 'Crunchyroll', plattform: 'crunchyroll', titel: 6, ohneSeite: 0, unterwegs: 0, ziel: 'https://x/4', ziele: [] },
    { name: 'Suchadressen', plattform: 'suchadressen', titel: 6, ohneSeite: 0, unterwegs: 0, ziel: 'https://x/5', ziele: [] },
  ],
}

const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 420, height: 260 } })

/* Jede fremde Anfrage wird beantwortet — der Laufstatus selbst bleibt leer. */
await seite.route('**/*', async (route) => {
  const url = route.request().url()
  if (url.startsWith('file://')) return route.continue()
  if (url.includes('stand=1')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STAND) })
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
})

await seite.goto(pathToFileURL(SEITE).href)
await seite.waitForFunction(() => document.querySelectorAll('#pruefliste .pille').length >= 5, null, {
  timeout: 10_000,
})

/* Was tatsächlich gerendert wurde — Klasse und berechnete Farbe je Pille. */
const pillen = await seite.$$eval('#pruefliste .pille', (els) =>
  els.map((el) => ({
    text: el.textContent.replace(/\s+/g, ' ').trim(),
    klassen: el.className,
    rand: getComputedStyle(el).borderTopColor,
    schrift: getComputedStyle(el).color,
  })),
)

console.log('Pillen in der Anzeige:\n')
for (const p of pillen) console.log(`  ${p.text.padEnd(24)} ${p.klassen.padEnd(30)} Rand ${p.rand}`)

const verschieden = new Set(pillen.map((p) => p.rand)).size
console.log(`\n  ${verschieden} verschiedene Randfarben bei ${pillen.length} Pillen`)

mkdirSync('docs', { recursive: true })
await seite.locator('#pruefliste').screenshot({ path: ZIEL })
console.log(`  Bild: ${ZIEL}`)

await browser.close()

if (verschieden < 4) {
  console.error('\nZu wenige verschiedene Farben — die Anbieterregeln greifen nicht.')
  process.exit(1)
}
