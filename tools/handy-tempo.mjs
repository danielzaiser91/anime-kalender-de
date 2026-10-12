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
 * Mit Zeitgrenzen und Ladezeit: `tools/ladezeiten-messen.mjs`.
 */
import { chromium, devices } from 'playwright'
import { BASIS, messhaken, ergebnis, aktionen, median, ausDistLiefern } from './tempo-kern.mjs'

const arg = (name, vorgabe) => process.argv[process.argv.indexOf(`--${name}`) + 1] ?? vorgabe
const hat = (name) => process.argv.includes(`--${name}`)
const DIST = hat('dist') ? arg('dist') : undefined
const WIEDERHOLUNGEN = Number(hat('n') ? arg('n') : 5)
const DROSSEL = Number(hat('drossel') ? arg('drossel') : 4)

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' })
  if (DIST) await ausDistLiefern(ctx, DIST)
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
