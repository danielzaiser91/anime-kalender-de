// Messskript aus der Analysesitzung vom 02.10.2026 (docs/wissen/sitzung-2026-10-02-analyse-und-umstellung.md). Einmalig, Pfade zum Scratchpad ggf. anpassen.
const { chromium, devices } = require('C:/code/ai/anime-kalender-de/node_modules/playwright');
const fs = require('fs');
const SP = 'C:/Users/ih/AppData/Local/Temp/claude/C--code-ai-anime-kalender-de/31b34792-e831-48d4-bf92-d684014bdb3a/scratchpad/shots/';
fs.mkdirSync(SP, { recursive: true });
const BASE = process.env.BASE || 'https://anime-kalender.de/';
const routes = ['woche','monat','datenbank','news','abo','newsletter','quellen','impressum','datenschutz'];
const profiles = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { ...devices['Pixel 7'] },
};
const report = {};
(async () => {
  const browser = await chromium.launch();
  for (const [name, opts] of Object.entries(profiles)) {
    const ctx = await browser.newContext({ ...opts, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
    for (const r of routes) {
      const page = await ctx.newPage();
      const rec = { console: [], failed: [], bytes: 0, reqs: 0 };
      page.on('console', m => { if (['error','warning'].includes(m.type())) rec.console.push(m.type() + ': ' + m.text().slice(0, 300)); });
      page.on('pageerror', e => rec.console.push('PAGEERROR: ' + String(e).slice(0, 300)));
      page.on('requestfailed', q => rec.failed.push(q.url().slice(0, 150) + ' ' + (q.failure() && q.failure().errorText)));
      page.on('response', async resp => { rec.reqs++; if (resp.status() >= 400) rec.failed.push(resp.status() + ' ' + resp.url().slice(0, 150)); try { const h = resp.headers()['content-length']; if (h) rec.bytes += +h; } catch {} });
      const t0 = Date.now();
      try { await page.goto(BASE + '#/' + r, { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) { rec.console.push('GOTO: ' + e.message.slice(0, 200)); }
      await page.waitForTimeout(1500);
      rec.ms = Date.now() - t0;
      rec.metrics = await page.evaluate(() => {
        const de = document.documentElement;
        const small = [...document.querySelectorAll('button, a, input, select, [role=button]')].filter(e => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && (b.width < 40 || b.height < 40); }).length;
        const inter = [...document.querySelectorAll('button, a, input, select, [role=button]')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }).length;
        const noAlt = [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length;
        const noLabel = [...document.querySelectorAll('button')].filter(b => !(b.innerText || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length;
        const over = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.right > window.innerWidth + 2 && b.width > 0 && getComputedStyle(e).position !== 'fixed'; }).length;
        return { sw: de.scrollWidth, iw: window.innerWidth, hOverflow: de.scrollWidth > window.innerWidth + 1, small, inter, noAlt, noLabel, over, title: document.title, h1: [...document.querySelectorAll('h1')].map(h => h.innerText).slice(0, 3), lang: de.lang, textLen: document.body.innerText.length, imgs: document.images.length, brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length };
      });
      await page.screenshot({ path: SP + name + '-' + r + '.png', fullPage: false });
      report[name + '/' + r] = rec;
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(SP + 'report1.json', JSON.stringify(report, null, 1));
  console.log('done');
})();
