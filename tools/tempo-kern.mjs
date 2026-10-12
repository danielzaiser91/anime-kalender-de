/**
 * Gemeinsamer Kern der Handy-Messungen (`handy-tempo.mjs`, `ladezeiten-messen.mjs`): Messhaken in der Seite,
 * Warten auf Ruhe, die Aktionsfolge und das Ausliefern eines Build-Ordners unter der Live-Adresse.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const BASIS = 'https://anime-kalender.de/'
const RUHE_MS = 500
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }

/** Läuft in der Seite: sammelt Eingabe-Zeitpunkt, DOM-Änderungen, lange Tasks und Event-Timing-Einträge. */
export function messhaken() {
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
export async function ergebnis(seite) {
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
export function aktionen(seite) {
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

export const median = (zahlen) => [...zahlen].sort((a, b) => a - b)[Math.floor(zahlen.length / 2)]

/** Liefert Dateien aus dem Build-Ordner unter der Live-Adresse aus; Unbekanntes (Cover) geht weiter ins Netz. */
export async function ausDistLiefern(ctx, dist) {
  await ctx.route(`${BASIS}**`, async (route) => {
    const pfad = new URL(route.request().url()).pathname
    const datei = path.join(dist, pfad === '/' ? 'index.html' : pfad)
    if (!existsSync(datei) || !path.extname(datei)) return route.continue()
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: readFileSync(datei) })
  })
}
