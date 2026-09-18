// Ladeleistung der Live-Seite: Zeit bis zum ersten Termin, LCP, lange Tasks, größte Antworten — Desktop und gedrosseltes Handy. Aufruf: node tools/leistung-messen.mjs (18.09.2026)
import { chromium } from 'playwright'
const b = await chromium.launch()
for (const [name, opt] of [['Desktop', { viewport: { width: 1280, height: 900 } }], ['Handy 4x CPU', { viewport: { width: 375, height: 812 }, isMobile: true }]]) {
  const ctx = await b.newContext(opt)
  const s = await ctx.newPage()
  const cdp = await ctx.newCDPSession(s)
  if (name.startsWith('Handy')) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  }
  const groessen = []
  s.on('response', async (r) => { try { const h = await r.allHeaders(); groessen.push([new URL(r.url()).pathname.slice(0, 50), Number(h['content-length'] ?? 0)]) } catch {} })
  await s.addInitScript(() => {
    window.__lange = []
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lange.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true })
    window.__lcp = 0
    new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) window.__lcp = Math.round(e.startTime) }).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  const t0 = Date.now()
  await s.goto('https://anime-kalender.de/#/woche', { waitUntil: 'load' })
  await s.waitForSelector('.ak-oeffnen', { timeout: 60000 })
  const ersterTermin = Date.now() - t0
  await s.waitForTimeout(1500)
  const m = await s.evaluate(() => ({ lcp: window.__lcp, lange: window.__lange, nav: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd | 0 }))
  const sum = m.lange.reduce((a, x) => a + x, 0)
  console.log(`${name}: erster Termin nach ${ersterTermin} ms, LCP ${m.lcp} ms, DCL ${m.nav} ms, lange Tasks ${m.lange.length} (Summe ${sum} ms, max ${Math.max(0, ...m.lange)} ms)`)
  if (name === 'Desktop') console.log('  größte Antworten:', groessen.sort((a, c) => c[1] - a[1]).slice(0, 6).map(([p, g]) => `${p} ${Math.round(g / 1024)} KB`).join(' · '))
  await ctx.close()
}
await b.close()
