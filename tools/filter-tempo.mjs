#!/usr/bin/env node
/**
 * **Wie schnell reagiert ein Filterklick?** (05.11.2026, Daniel: „Klick auf Filter laggt")
 *
 * Tippt im geöffneten Filterfenster die Schnellfilter „TV" und „Disc" reihum (nichts → gewählt → ausgeschlossen → nichts)
 * und misst je Tipp die Reaktion (Event Timing bis zum nächsten Zeichnen, wie INP) und die langen Tasks.
 * Handy: Pixel-7-Emulation mit 4× CPU-Drosselung; Desktop: 1280 px ohne Drosselung (`--desktop`).
 *
 * Aufruf: `node tools/filter-tempo.mjs --dist dist [--n 3] [--drossel 4] [--desktop] [--grenze 200] [--spitze 800]`
 * Mit `--grenze` (Median) und `--spitze` (langsamster Tipp) endet das Skript mit Exit 1, wenn eine Grenze überschritten ist (Messtor der PR-Kette, `check:filter-tempo`).
 */
import { chromium, devices } from 'playwright'
import { BASIS, messhaken, ergebnis, median, ausDistLiefern } from './tempo-kern.mjs'
import { urteil } from './filter-tempo-urteil.mjs'

const arg = (name, vorgabe) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : vorgabe)
const hat = (name) => process.argv.includes(`--${name}`)
const DIST = arg('dist')
const WIEDERHOLUNGEN = Number(arg('n', 3))
const DESKTOP = hat('desktop')
const DROSSEL = Number(arg('drossel', DESKTOP ? 1 : 4))
const GRENZE = hat('grenze') ? Number(arg('grenze')) : undefined
const SPITZE = hat('spitze') ? Number(arg('spitze')) : undefined
const CHIPS = ['TV', 'Disc']

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    ...(DESKTOP ? { viewport: { width: 1280, height: 900 } } : devices['Pixel 7']),
    serviceWorkers: 'block',
  })
  if (DIST) await ausDistLiefern(ctx, DIST)
  const seite = await ctx.newPage()
  await seite.addInitScript(messhaken)
  const cdp = await ctx.newCDPSession(seite)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: DROSSEL })
  await seite.goto(`${BASIS}#/woche`, { waitUntil: 'load' })
  await seite.waitForSelector('.ak-oeffnen', { timeout: 60000 })
  await seite.waitForTimeout(6000)
  const tippe = (ort) => (DESKTOP ? ort.click() : ort.tap())
  const chipZiel = seite.locator('button[aria-pressed][aria-label^="TV:"]').first()
  if (!(await chipZiel.isVisible())) await tippe(seite.locator('[role=toolbar]').getByRole('button', { name: 'Filter' }).first())
  await chipZiel.waitFor({ state: 'visible', timeout: 10000 })
  await seite.waitForTimeout(1500)
  await seite.evaluate(() => (window.__tempo.letzte = performance.now()))
  const messungen = new Map()
  for (let i = 0; i < WIEDERHOLUNGEN; i++) {
    for (const chip of CHIPS) {
      for (let schritt = 0; schritt < 3; schritt++) {
        await tippe(seite.locator(`button[aria-pressed][aria-label^="${chip}:"]`).first())
        const r = await ergebnis(seite)
        messungen.set(chip, [...(messungen.get(chip) ?? []), r])
      }
    }
  }
  const zeilen = []
  for (const [chip, rs] of messungen) {
    const f = (k) => median(rs.map((r) => r[k]))
    zeilen.push({ chip, reaktion: f('reaktion'), maximum: Math.max(...rs.map((r) => r.reaktion)), stabil: f('stabil'), lange: f('lange'), langeMax: f('langeMax'), knoten: f('knoten') })
  }
  console.log(`${DIST ?? BASIS} · ${DESKTOP ? 'Desktop' : 'Pixel 7'} · ${DROSSEL}× CPU · ${WIEDERHOLUNGEN} Runden × 3 Tipps je Chip`)
  for (const z of zeilen) {
    console.log(`${z.chip.padEnd(5)} Reaktion Median ${String(z.reaktion).padStart(4)} ms (max ${z.maximum}) · stabil ${z.stabil} ms · lange Tasks ${z.lange} (größter ${z.langeMax} ms) · Knoten ${z.knoten}`)
  }
  await browser.close()
  const u = urteil(zeilen, GRENZE, SPITZE)
  console.log(u.zeile)
  process.exit(u.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
