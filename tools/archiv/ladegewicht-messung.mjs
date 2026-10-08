// Startmessung, gedrosseltes Handy (Rezept: docs/wissen/datensatz.md, 08.10.2026).
//   node tools/archiv/ladegewicht-messung.mjs                 -> Live-Seite, CDP-Drosselung
//   node tools/archiv/ladegewicht-messung.mjs --lokal=dist    -> gebautes Verzeichnis (Routen; Leitung als eine gemeinsame Warteschlange nachgebildet,
//                                                                 1,6 Mbit/s + 150 ms je Antwort; Bilder kommen echt von AniList). --n=3 Läufe, --quellen: CLS-Verursacher
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, extname } from 'node:path';
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const lokal = arg('lokal'); const N = +(arg('n') || 5); const quellen = process.argv.includes('--quellen');
const BPS = (1.6 * 1024 * 1024) / 8;
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/json', '.ico': 'image/x-icon' };
const GZIP = /html|javascript|css|json|svg/;
const b = await chromium.launch(); const runs = [];
for (let i = 0; i < N; i++) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  const reqs = new Map(); let t0 = null; const lokalListe = [];
  if (!lokal) {
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: BPS, uploadThroughput: 750 * 1024 / 8 });
    cdp.on('Network.requestWillBeSent', (e) => { if (t0 === null) t0 = e.timestamp; });
    cdp.on('Network.responseReceived', (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type }));
    cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.t = (e.timestamp - t0) * 1000; } });
  } else {
    let freiAb = 0; const start = Date.now();
    await ctx.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url()); let body, headers, status = 200;
      if (u.origin === 'https://anime-kalender.de') {
        let f = join(lokal, decodeURIComponent(u.pathname)); if (!extname(f) || !existsSync(f)) f = join(lokal, 'index.html');
        body = readFileSync(f); headers = { 'content-type': TYPEN[extname(f)] || 'application/octet-stream' };
      } else { const r = await route.fetch(); body = await r.body(); headers = r.headers(); status = r.status(); delete headers['content-encoding']; delete headers['content-length']; }
      const enc = GZIP.test(headers['content-type'] || '') ? gzipSync(body).length : body.length;
      const jetzt = Date.now() - start; freiAb = Math.max(jetzt, freiAb) + (enc / BPS) * 1000;
      const fertig = freiAb + 150; await new Promise((r) => setTimeout(r, Math.max(0, fertig - (Date.now() - start))));
      lokalListe.push({ url: req.url(), type: req.resourceType() === 'image' ? 'Image' : req.resourceType(), bytes: enc, t: Date.now() - start });
      await route.fulfill({ status, headers, body }).catch(() => {});
    });
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.addInitScript(() => {
    const m = (window.__m = { lcp: 0, lcpEl: '', tbt: 0, fcp: 0, card: null, cardImg: null, cls: 0, q: [] });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { m.lcp = e.startTime; m.lcpEl = e.element ? e.element.tagName + ':' + (e.url || e.element.textContent || '').slice(-40) : ''; } }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration > 50) m.tbt += e.duration - 50; }).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { m.cls += e.value; m.q.push({ v: +e.value.toFixed(3), t: Math.round(e.startTime), s: (e.sources || []).map((s) => (s.node ? s.node.tagName + '.' + String(s.node.className || '').slice(0, 30) : '?')) }); } }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
    const chk = () => {
      if (!m.card) { const a = [...document.querySelectorAll('article')].find((e) => { const r = e.getBoundingClientRect(); return r.top < 844 && r.bottom > 0 && r.height > 100 && /Details zu/.test(e.textContent); }); if (a) m.card = performance.now(); }
      if (m.card && !m.cardImg) { const im = [...document.querySelectorAll('article img')].find((e) => { const r = e.getBoundingClientRect(); return r.top < 844 && r.bottom > 0 && e.complete && e.naturalWidth > 0; }); if (im) m.cardImg = performance.now(); }
      if (!m.cardImg) requestAnimationFrame(chk);
    };
    requestAnimationFrame(chk);
  });
  await p.goto('https://anime-kalender.de/', { waitUntil: 'commit' });
  await p.waitForLoadState('networkidle', { timeout: 180000 }).catch(() => {}); await p.waitForTimeout(3000);
  const m = await p.evaluate(() => window.__m);
  const list = lokal ? lokalListe : [...reqs.values()].filter((r) => r.bytes != null);
  const noimg = list.filter((r) => r.type !== 'Image'); const lastNo = Math.max(...noimg.map((r) => r.t));
  const imgs = list.filter((r) => r.type === 'Image');
  runs.push({ m, lastNo, noimg: noimg.reduce((s, r) => s + r.bytes, 0), imgs: imgs.length, imgB: imgs.reduce((s, r) => s + r.bytes, 0) });
  await ctx.close();
}
await b.close();
for (const r of runs) console.log(JSON.stringify({ fcp: Math.round(r.m.fcp), card: Math.round(r.m.card), cardImg: Math.round(r.m.cardImg), lcp: Math.round(r.m.lcp), lcpEl: r.m.lcpEl, tbt: Math.round(r.m.tbt), cls: +r.m.cls.toFixed(3), lastNonImgDone: Math.round(r.lastNo), nonImgB: r.noimg, imgN: r.imgs, imgB: r.imgB, ...(quellen ? { quellen: r.m.q } : {}) }));
