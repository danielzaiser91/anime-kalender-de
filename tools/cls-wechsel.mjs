#!/usr/bin/env node
/**
 * **Layout-Shift beim Ansichtswechsel messen** (CLS je Wechsel Woche -> Monat -> Woche), ohne Server gegen `dist/`.
 * Aufruf: `npm run check:cls-wechsel` (Tor im Job PR-Aussehen) bzw. `node tools/cls-wechsel.mjs [--handy375|--handy|--desktop] [--grenze 0.1] [--n 3]`;
 * Exit 1, wenn ein Wechsel die Grenze reißt. Vor jedem Wechsel in den Monat steht die Woche unten (scrollY > 0, sonst Abbruch).
 * Liefert je Wechsel die Summe und die verschobenen Elemente (Selektor, Verschiebung), damit die Ursache sichtbar wird.
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, devices } from 'playwright'
import { BASIS, ausDistLiefern } from './tempo-kern.mjs'
import { distPruefen } from './dist-frisch.mjs'
import { browserDa } from './browser-weiche.mjs'

export const GRENZE = 0.1

/** Summe der Layout-Shifts ohne solche direkt nach Eingabe (wie die Web-Vitals-Wertung). */
export function clsSumme(eintraege) {
  return Math.round(eintraege.filter((e) => !e.hadRecentInput).reduce((a, e) => a + e.value, 0) * 10000) / 10000
}

/** Läuft in der Seite: sammelt Layout-Shifts samt Quellelementen. */
function shiftHaken() {
  window.__shifts = []
  const kurz = (n) => (n ? `${n.nodeName.toLowerCase()}${n.id ? `#${n.id}` : ''}${typeof n.className === 'string' && n.className ? `.${n.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}` : '?')
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) =>
      window.__shifts.push({
        value: e.value,
        hadRecentInput: e.hadRecentInput,
        quellen: (e.sources ?? []).map((s) => ({ knoten: kurz(s.node), von: Math.round(s.previousRect.y), nach: Math.round(s.currentRect.y) })),
      }),
    ),
  ).observe({ type: 'layout-shift', buffered: true })
}

/** Stellt sicher, dass die Woche unten steht (nur dann klemmt der kürzere Monat); sonst misst die Probe nichts. */
async function nachUntenScrollen(seite) {
  await seite.evaluate(() => window.scrollTo({ top: 3000, behavior: 'auto' }))
  await seite.waitForTimeout(300)
  const y = await seite.evaluate(() => window.scrollY)
  if (!(y > 0)) throw new Error(`cls-wechsel: Woche lässt sich nicht scrollen (scrollY ${y}), die Messung wäre leer`)
}

async function wechsel(seite, name) {
  if (name === 'Monat') await nachUntenScrollen(seite)
  await seite.evaluate(() => (window.__shifts = []))
  await seite.getByRole('button', { name, exact: true }).first().dispatchEvent('click')
  await seite.waitForTimeout(1500)
  const eintraege = await seite.evaluate(() => window.__shifts)
  // Der Klick ist per Skript ausgelöst: hadRecentInput bleibt false, so zählt jede Verschiebung (strenger als der Browser).
  return { name: `-> ${name}`, cls: clsSumme(eintraege), eintraege }
}

const PROFILE = {
  handy375: () => ({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }),
  handy: () => ({ ...devices['Pixel 7'] }),
  desktop: () => ({ viewport: { width: 1280, height: 900 } }),
}

/** Misst Woche->Monat->Woche `n`-mal mit dem Profil ('handy375' | 'handy' | 'desktop'). */
export async function clsMessen({ dist, profil, n }) {
  const browser = await chromium.launch()
  try {
    const optionen = PROFILE[profil]()
    const ctx = await browser.newContext({ ...optionen, serviceWorkers: 'block' })
    await ctx.route(/^https?:\/\//, (r) => (`${new URL(r.request().url()).origin}/` === BASIS ? r.fallback() : r.abort()))
    await ausDistLiefern(ctx, dist)
    const seite = await ctx.newPage()
    await seite.addInitScript(shiftHaken)
    await seite.goto(`${BASIS}#/woche`, { waitUntil: 'load' })
    await seite.waitForSelector('.ak-oeffnen', { timeout: 60000 })
    await seite.waitForTimeout(1500)
    const ergebnisse = []
    for (let i = 0; i < n; i++) {
      ergebnisse.push(await wechsel(seite, 'Monat'))
      ergebnisse.push(await wechsel(seite, 'Woche'))
    }
    return ergebnisse
  } finally {
    await browser.close()
  }
}

async function main() {
  const arg = (name, vorgabe) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : vorgabe)
  if (!browserDa('cls-wechsel', chromium)) return
  const wurzel = path.resolve(import.meta.dirname, '..')
  if (!distPruefen(wurzel)) return
  const grenze = Number(arg('grenze', GRENZE))
  const gewaehlt = Object.keys(PROFILE).filter((p) => process.argv.includes(`--${p}`))
  const profile = gewaehlt.length ? gewaehlt : Object.keys(PROFILE)
  for (const profil of profile) {
    const ergebnisse = await clsMessen({ dist: path.join(wurzel, 'dist'), profil, n: Number(arg('n', 3)) })
    console.log(`cls-wechsel ${profil}: ${ergebnisse.length} Wechsel, Grenze ${grenze}`)
    for (const r of ergebnisse) {
      const zu = r.cls >= grenze
      console.log(`${profil.padEnd(8)} ${r.name.padEnd(10)} CLS ${r.cls}${zu ? '  ZU HOCH' : ''}`)
      if (zu) for (const e of r.eintraege) for (const q of e.quellen) console.log(`           ${e.value.toFixed(4)} ${q.knoten} y ${q.von} -> ${q.nach}`)
      if (zu) process.exitCode = 1
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
