// Messskript aus der Analysesitzung vom 02.10.2026 (docs/wissen/sitzung-2026-10-02-analyse-und-umstellung.md). Einmalig, Pfade zum Scratchpad ggf. anpassen.
const { chromium, devices } = require('C:/code/ai/anime-kalender-de/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'de-DE', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.goto('https://anime-kalender.de/#/datenbank', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const g = {};
    for (const e of document.querySelectorAll('button, a, input, select, [role=button]')) {
      const bb = e.getBoundingClientRect(); if (!bb.width || !bb.height) continue;
      if (bb.width >= 44 && bb.height >= 44) continue;
      const k = (e.tagName + ' ' + (e.getAttribute('aria-label') || e.title || (e.innerText || '').slice(0, 20))).replace(/\d+/g, '#').slice(0, 50) + ' ' + Math.round(bb.width) + 'x' + Math.round(bb.height);
      g[k] = (g[k] || 0) + 1;
    }
    return Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 14);
  });
  console.log(JSON.stringify(r, null, 1));
  // Suche auf Mobile
  await p.goto('https://anime-kalender.de/#/woche', { waitUntil: 'networkidle' });
  const btn = p.locator('header button').first();
  console.log('hdr buttons', await p.locator('header button').evaluateAll(es => es.map(e => e.getAttribute('aria-label') || e.innerText)));
  await b.close();
})();
