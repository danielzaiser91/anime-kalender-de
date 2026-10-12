#!/usr/bin/env node
/**
 * **Wie zäh fühlen sich die Umschalter am Handy an?** (12.10.2026, Daniel: „Am Handy hakt es")
 *
 * Misst je Aktion (Monat/Woche umschalten, Woche vor/zurück, Filter auf/zu, Panel auf/zu) mit echten Tipp-Ereignissen,
 * Pixel-7-Emulation und 4× CPU-Drosselung, wiederholt, und meldet den Median:
 *  - Reaktion: Event Timing der Eingabe bis zum nächsten Zeichnen (wie INP)
 *  - Stabil: Tipp bis zur letzten DOM-Änderung bzw. zum letzten langen Task, bevor 500 ms Ruhe herrschen
 *  - lange Tasks (Anzahl, Summe, größter) und DOM-Knoten danach
 *
 * Aufruf: `node tools/handy-tempo.mjs [--dist <Ordner>] [--n 5] [--drossel 4]` (Vorgabe: Live-Seite). Mit `--dist` liefert Playwright
 * die Dateien dieses Build-Ordners unter der Live-Adresse aus (kein Server); alles andere, etwa Cover, kommt weiter von dort.
 */
import { chromium, devices } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }
const arg = (name, vorgabe) => process.argv[process.argv.indexOf(`--${name}`) + 1] ?? vorgabe
const hat = (name) => process.argv.includes(`--${name}`)
const BASIS = 'https://anime-kalender.de/'
const DIST = hat('dist') ? arg('dist') : undefined
const WIEDERHOLUNGEN = Number(hat('n') ? arg('n') : 5)
const DROSSEL = Number(hat('drossel') ? arg('drossel') : 4)
const RUHE_MS = 500

/** Läuft in der Seite: sammelt Eingabe-Zeitpunkt, DOM-Änderungen, lange Tasks und Event-Timing-Einträge. */
function messhaken() {
  const m = { start: 0, letzte: 0, lange: [], reaktion: 0 }
  window.__tempo = m
  const merke = () => (m.letzte = performance.now())
  new MutationObserver(merke).observe(document, { childList: true, subtree: true, attributes: true, characterData: true })
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => {
      m.lange.push(Math.round(e.duration))
      m.letzte = Math.max(m.letzte, e.startTime + e.duration)
    }),
  ).observe({ type: 'longtask', buffered: false })
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => {
      if (e.startTime >= m.start - 1) m.reaktion = Math.max(m.reaktion, Math.round(e.duration))
    }),
  ).observe({ type: 'event', durationThreshold: 16, buffered: false })
  addEventListener('pointerdown', (e) => {
    m.start = e.timeStamp
    m.letzte = e.timeStamp
    m.lange = []
    m.reaktion = 0
  }, true)
  addEventListener('keydown', (e) => {
    m.start = e.timeStamp
    m.letzte = e.timeStamp
    m.lange = []
    m.reaktion = 0
  }, true)
}

/** Wartet, bis 500 ms lang nichts mehr passiert, und liefert die Messwerte der Aktion. */
async function ergebnis(seite) {
  await seite.waitForFunction((ruhe) => performance.now() - window.__tempo.letzte > ruhe, RUHE_MS, { timeout: 30000, polling: 100 })
  return seite.evaluate(() => {
    const m = window.__tempo
    return {
      reaktion: m.reaktion,
      stabil: Math.round(m.letzte - m.start),
      lange: m.lange.length,
      langeSumme: m.lange.reduce((a, x) => a + x, 0),
      langeMax: Math.max(0, ...m.lange),
      knoten: document.getElementsByTagName('*').length,
    }
  })
}

/** Die Aktionen in einer Reihenfolge, in der jede den Zustand für die nächste herstellt. */
function aktionen(seite) {
  const leiste = seite.locator('[role=toolbar]')
  const tippe = (ort) => ort.tap()
  return [
    ['Woche → Monat', () => tippe(leiste.getByRole('button', { name: 'Monat', exact: true }))],
    ['Monat → Woche', () => tippe(leiste.getByRole('button', { name: 'Woche', exact: true }))],
    ['Woche vor', () => tippe(leiste.getByRole('button', { name: 'Nächster Zeitraum' }))],
    ['Woche zurück', () => tippe(leiste.getByRole('button', { name: 'Voriger Zeitraum' }))],
    ['Filter auf', () => tippe(leiste.locator('button[aria-controls=ak-filter]'))],
    ['Filter zu', () => tippe(leiste.locator('button[aria-controls=ak-filter]'))],
    ['Panel auf', async () => {
      const karte = seite.locator('.ak-oeffnen').first().locator('..')
      await karte.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      await tippe(karte)
    }],
    ['Panel zu', () => tippe(seite.getByRole('button', { name: 'Schließen', exact: true }).first())],
  ]
}

const median = (zahlen) => [...zahlen].sort((a, b) => a - b)[Math.floor(zahlen.length / 2)]

/** Liefert Dateien aus dem Build-Ordner unter der Live-Adresse aus; Unbekanntes (Cover) geht weiter ins Netz. */
async function ausDistLiefern(ctx) {
  await ctx.route(`${BASIS}**`, async (route) => {
    const pfad = new URL(route.request().url()).pathname
    const datei = path.join(DIST, pfad === '/' ? 'index.html' : pfad)
    if (!existsSync(datei) || !path.extname(datei)) return route.continue()
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: readFileSync(datei) })
  })
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' })
  if (DIST) await ausDistLiefern(ctx)
  const seite = await ctx.newPage()
  await seite.addInitScript(messhaken)
  const cdp = await ctx.newCDPSession(seite)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: DROSSEL })
  await seite.goto(`${BASIS}#/woche`, { waitUntil: 'load' })
  await seite.waitForSelector('.ak-oeffnen', { timeout: 60000 })
  await seite.waitForTimeout(6000)
  await seite.evaluate(() => (window.__tempo.letzte = performance.now()))
  const proAktion = new Map()
  for (let i = 0; i < WIEDERHOLUNGEN; i++) {
    for (const [name, tu] of aktionen(seite)) {
      await tu()
      const r = await ergebnis(seite)
      proAktion.set(name, [...(proAktion.get(name) ?? []), r])
    }
  }
  console.log(`${DIST ?? BASIS} · Pixel 7 · ${DROSSEL}× CPU · ${WIEDERHOLUNGEN} Wiederholungen · Median (Streuung min–max der Stabil-Zeit)`)
  for (const [name, rs] of proAktion) {
    const f = (k) => median(rs.map((r) => r[k]))
    const st = rs.map((r) => r.stabil)
    console.log(
      `${name.padEnd(14)} Reaktion ${String(f('reaktion')).padStart(4)} ms · stabil ${String(f('stabil')).padStart(5)} ms (${Math.min(...st)}–${Math.max(...st)}) · lange Tasks ${f('lange')} (Σ ${f('langeSumme')}, max ${f('langeMax')} ms) · Knoten ${f('knoten')}`,
    )
  }
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
