#!/usr/bin/env node
/**
 * Misst die Augen an „Im Fernsehen" und „Im Handel" bei 360 px (Handy, Touch): Trefferfläche (`::after`) mindestens 44 px,
 * Schaltfläche im Fenster. Sucht in bis zu vier Wochen je einen Tag mit beiden Bereichen. Urteil: `bereich-auge-urteil.mjs`.
 * Aufruf: `node tools/bereich-auge-messen.mjs --dist dist`
 */
import { chromium } from 'playwright'
import { BASIS, ausDistLiefern } from './tempo-kern.mjs'
import { urteil } from './bereich-auge-urteil.mjs'

const i = process.argv.indexOf('--dist')
const DIST = i > 0 ? process.argv[i + 1] : undefined
const BREITE = 360

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: BREITE, height: 740 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  if (DIST) await ausDistLiefern(ctx, DIST)
  const seite = await ctx.newPage()
  await seite.goto(`${BASIS}#/woche`, { waitUntil: 'load' })
  await seite.waitForSelector('.ak-oeffnen', { timeout: 60000 })
  await seite.waitForTimeout(4000)
  const gefunden = new Map()
  for (let woche = 0; woche < 4 && gefunden.size < 2; woche++) {
    const augen = await seite.evaluate(() =>
      [...document.querySelectorAll('[data-bereich-auge]')].slice(0, 6).map((el) => {
        const r = el.getBoundingClientRect()
        const f = getComputedStyle(el, '::after')
        return { bereich: el.getAttribute('data-bereich-auge'), flaeche: { breite: Math.round(parseFloat(f.width)), hoehe: Math.round(parseFloat(f.height)) }, rechts: Math.round(r.right) }
      }),
    )
    for (const a of augen) if (!gefunden.has(a.bereich)) gefunden.set(a.bereich, a)
    if (gefunden.size < 2) {
      await seite.locator('[role=toolbar]').getByRole('button', { name: 'Nächster Zeitraum' }).first().tap()
      await seite.waitForTimeout(1500)
    }
  }
  await browser.close()
  const u = urteil([...gefunden.values()], BREITE)
  console.log(u.zeile)
  process.exit(u.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
