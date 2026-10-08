#!/usr/bin/env node
/**
 * Echte Mausklicks auf die kleinen Ziele der Oberfläche (dist/, ohne Server, Handy 390 und Desktop 1366): Stern, Auge und Teilen
 * der Datenbank-Kachel, Filter-Knopf, Datenbank-Schalter, News-Chips. Je Ziel: `elementFromPoint(Mitte)` muss das Ziel (oder ein
 * Kind) sein, die Fläche ≥ 24 px, und der Klick muss wirken (`aria-pressed`, Schalterzustand, Panel bleibt zu).
 *
 * Anlass (08.10.2026): Eine Tooltip-Hülle mit `after:absolute` lag über dem Heute-Knopf (PR 493/510) — ein Bild zeigt das nicht,
 * ein Klick schon. Aufruf: `node tools/archiv/klick-ziele.mjs` (erst `npm run build`).
 */
import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '../../dist')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/json' }
let rot = 0
const melde = (ok, text) => {
  console.log((ok ? '  ok  ' : '  ✕  ') + text)
  if (!ok) rot++
}

/** Mitte messen, elementFromPoint prüfen, dann echter Mausklick auf die Mitte. */
async function klick(p, loc, name) {
  const box = await loc.boundingBox()
  if (!box) {
    melde(false, `${name}: nicht sichtbar`)
    return false
  }
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const ok = await loc.evaluate((el, [x, y]) => {
    const t = document.elementFromPoint(x, y)
    return !!t && (t === el || el.contains(t))
  }, [x, y])
  melde(ok && box.width >= 24 && box.height >= 24, `${name}: elementFromPoint trifft=${ok}, ${Math.round(box.width)}×${Math.round(box.height)} px`)
  await p.mouse.click(x, y)
  await p.waitForTimeout(250)
  return ok
}

async function kachel(p, mobil) {
  const erste = p.locator('.group.cursor-pointer').nth(1)
  const name = await erste.locator('.line-clamp-2').first().innerText()
  const karte = () => p.locator('.group.cursor-pointer', { hasText: name }).first()
  const stern = () => karte().locator('button[aria-pressed]').first()
  if (!mobil) await karte().hover()
  await klick(p, stern(), 'Stern')
  melde((await stern().getAttribute('aria-pressed')) === 'true', 'Stern: nach Klick aria-pressed=true')
  melde((await p.locator('[data-panel="titel"]').count()) === 0, 'Stern: Klick öffnete kein Panel')
  await klick(p, stern(), 'Stern (zurück)')
  melde((await stern().getAttribute('aria-pressed')) === 'false', 'Stern: zweiter Klick nimmt zurück')
  if (mobil) {
    melde(!(await karte().getByRole('button', { name: /ausblenden/i }).first().isVisible().catch(() => false)), 'Auge: auf dem Handy nicht als Knopf (Panel)')
    return
  }
  await karte().hover()
  await klick(p, karte().getByRole('button', { name: /ausblenden/i }).first(), 'Auge')
  melde((await p.locator('.group.cursor-pointer', { hasText: name }).count()) === 0, 'Auge: Kachel ausgeblendet')
  await p.getByRole('button', { name: /einblenden|wieder/i }).first().click().catch(() => {})
  await karte().hover()
  await klick(p, karte().getByRole('button', { name: /teilen/i }).first(), 'Teilen')
}

async function leisten(p, mobil) {
  const filter = p.getByRole('button', { name: /^Filter/ }).last()
  await klick(p, filter, 'Filter-Knopf')
  melde((await filter.getAttribute('aria-expanded')) === 'true', 'Filter-Knopf: Klick öffnet')
  await filter.click()
  await p.waitForTimeout(300)
  const text = 'Staffeln zusammenfassen'
  const pille = p.locator('span.rounded-full', { has: p.getByText(text) }).first()
  if (mobil) await pille.scrollIntoViewIfNeeded()
  const vorher = await p.getByLabel(text).isChecked()
  await klick(p, pille, 'Schalter-Pille')
  melde((await p.getByLabel(text).isChecked()) !== vorher, 'Schalter: Klick schaltet um')
  await p.goto('https://ak.test/#/news', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  const chip = p.getByRole('button', { name: /^Angekündigt/ }).first()
  await klick(p, chip, 'News-Chip')
  melde((await chip.getAttribute('aria-pressed')) === 'true', 'News-Chip: Klick wählt')
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ fehlt — erst `npm run build`.')
    process.exitCode = 1
    return
  }
  const browser = await chromium.launch()
  for (const [geraet, viewport, mobil] of [['handy', { width: 390, height: 844 }, true], ['desktop', { width: 1366, height: 900 }, false]]) {
    console.log(geraet)
    const ctx = await browser.newContext({ viewport, isMobile: mobil, hasTouch: mobil, serviceWorkers: 'block' })
    await ctx.route('**/*', async (route) => {
      const u = new URL(route.request().url())
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return route.continue()
      if (u.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) })
      let f = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname)
      if (!path.extname(f) || !existsSync(f)) f = path.join(DIST, 'index.html')
      return route.fulfill({ status: 200, headers: { 'content-type': TYPEN[path.extname(f)] || 'application/octet-stream' }, body: readFileSync(f) })
    })
    const p = await ctx.newPage()
    await p.goto('https://ak.test/#/datenbank', { waitUntil: 'networkidle' })
    await p.waitForTimeout(2000)
    await kachel(p, mobil)
    await leisten(p, mobil)
    await ctx.close()
  }
  await browser.close()
  console.log(rot ? `\n  ✕ ${rot} Befund(e)` : '\n  ok  alle Ziele treffen und wirken')
  if (rot) process.exitCode = 1
}

await main()
