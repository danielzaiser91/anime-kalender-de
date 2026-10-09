#!/usr/bin/env node
/**
 * Echter Touch-Tap (Handy 375x812) auf den „Heute"-Knopf der Wochenansicht (dist/, ohne Server): Der ERSTE Tap muss wirken -
 * aus einer anderen Woche (Woche wechselt) und aus der heutigen Woche, weggescrollt (Seite scrollt zum heutigen Tag).
 * Anlass (09.10.2026): Daniel am Handy - Knopf reagierte erst beim zweiten Tippen. Aufruf: `node tools/archiv/heute-tippen.mjs` (erst `npm run build`).
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

const heute = () => document.querySelector('[data-heute="1"]')?.getBoundingClientRect().top
async function tap(p) {
  const knopf = p.getByRole('button', { name: /^heute/i }).first()
  const box = await knopf.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const treffer = await knopf.evaluate((el, [px, py]) => { const t = document.elementFromPoint(px, py); return !!t && (t === el || el.contains(t)) }, [x, y])
  await p.touchscreen.tap(x, y)
  await p.waitForTimeout(1500)
  return { treffer, hash: await p.evaluate(() => document.querySelector('h1')?.textContent), top: await p.evaluate(heute), y: await p.evaluate(() => scrollY), label: await knopf.getAttribute('aria-label') }
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) { console.error('dist/ fehlt - erst `npm run build`.'); process.exitCode = 1; return }
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return route.continue()
    if (u.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) })
    let f = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname)
    if (!path.extname(f) || !existsSync(f)) f = path.join(DIST, 'index.html')
    return route.fulfill({ status: 200, headers: { 'content-type': TYPEN[path.extname(f)] || 'application/octet-stream' }, body: readFileSync(f) })
  })
  const p = await ctx.newPage()
  await p.goto('https://ak.test/#/woche', { waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)

  // A: heutige Woche, nach oben weggescrollt
  await p.evaluate(() => scrollTo(0, 0))
  await p.waitForTimeout(500)
  const a0 = await p.evaluate(heute)
  const a = await tap(p)
  console.log('A vorher heute-top', a0, 'nachher', a)
  melde(a.treffer, 'A: Tap trifft den Knopf')
  melde(a.top !== undefined && a.top > 0 && a.top < 400, `A: erster Tap scrollt zu heute (top ${a0} -> ${a.top})`)

  // B: andere Woche, ein Tap
  await p.getByRole('button', { name: /^nächste|nächster/i }).first().tap()
  await p.waitForTimeout(800)
  const hashB = await p.evaluate(() => document.querySelector('h1')?.textContent)
  const b = await tap(p)
  console.log('B vorher', hashB, 'nachher', b)
  melde(b.hash !== hashB, 'B: erster Tap wechselt zur heutigen Woche')
  melde(b.top !== undefined && b.top > 0 && b.top < 400, `B: heute im Bild nach erstem Tap (top ${b.top})`)

  // C: heutige Woche, nach unten weggescrollt
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight))
  await p.waitForTimeout(800)
  const c0 = await p.evaluate(heute)
  const c = await tap(p)
  console.log('C vorher', c0, 'nachher', c)
  melde(c.top !== undefined && c.top > 0 && c.top < 400, `C: erster Tap scrollt zu heute (top ${c0} -> ${c.top})`)

  await p.waitForTimeout(3500) // Blase der früheren Tipps ist zu
  // D: Ursache (iOS schluckt den ersten Tipp, wenn Touch-/Maus-Ereignisse vor dem Klick sichtbar etwas einblenden): keine Blase vor dem Klick
  await p.evaluate(() => scrollTo(0, 0))
  await p.waitForTimeout(500)
  await p.evaluate(() => {
    window.__reihe = []
    const log = (s) => window.__reihe.push(s)
    for (const t of ['touchstart', 'mouseover', 'mousedown', 'click']) document.addEventListener(t, () => log(t), true)
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && n.getAttribute('role') === 'tooltip' && log('BLASE')))).observe(document.body, { childList: true })
  })
  await tap(p)
  const reihe = await p.evaluate(() => window.__reihe)
  const blase = reihe.indexOf('BLASE')
  melde(blase === -1 || blase > reihe.indexOf('click'), `D: keine Blase vor dem Klick (${reihe.join(' > ')})`)
  await browser.close()
  console.log(rot ? `\n  ✕ ${rot} Befund(e)` : '\n  ok  erster Tap wirkt')
  if (rot) process.exitCode = 1
}
await main()
