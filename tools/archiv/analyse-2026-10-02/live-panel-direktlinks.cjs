// Messskript aus der Analysesitzung vom 02.10.2026 (docs/wissen/sitzung-2026-10-02-analyse-und-umstellung.md). Einmalig, Pfade zum Scratchpad ggf. anpassen.
const { chromium, devices } = require('C:/code/ai/anime-kalender-de/node_modules/playwright');
const fs = require('fs');
const SP = 'C:/Users/ih/AppData/Local/Temp/claude/C--code-ai-anime-kalender-de/31b34792-e831-48d4-bf92-d684014bdb3a/scratchpad/shots/';
const BASE = 'https://anime-kalender.de/';
const L = (...a) => console.log(a.join(' '));
const T = async (page, n = 1800) => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, n);
(async () => {
  const browser = await chromium.launch();
  for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['mobile', { ...devices['Pixel 7'] }]]) {
    const ctx = await browser.newContext({ ...opts, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url().slice(0, 120)); });
    for (const slug of ['hana-kimi-s2', 'you-and-i-are-polar-opposites-s2', 'auto-112153-tv-toggo-plus', 'cr-GR3K50PZR', 'apothecary-diaries-s3-cour1', 'steel-ball-run-2nd-3rd-stage', 'lycoris-recoil-crunchyroll-de-2022-07-23']) {
      await page.goto(BASE + 'r/' + slug + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(2200);
      await page.screenshot({ path: SP + name + '-r-' + slug + '.png' });
      const panelText = await page.evaluate(() => { const d = document.querySelector('[role=dialog], aside, [class*=panel]'); return d ? d.innerText : document.body.innerText; });
      L('\n###', name, slug, 'URL', page.url());
      L(panelText.replace(/\s+/g, ' ').slice(0, 1600));
    }
    // Mobile: Suche
    await page.goto(BASE + '#/datenbank', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
    if (name === 'mobile') {
      const btn = page.locator('button[aria-label*="such" i]').first();
      await btn.click().catch(e => L('search btn fail', e.message.slice(0, 80)));
      await page.waitForTimeout(600);
      await page.screenshot({ path: SP + 'mobile-suche-offen.png' });
      await page.keyboard.type('frieren'); await page.waitForTimeout(1200);
      await page.screenshot({ path: SP + 'mobile-suche-frieren.png' });
      L('mobile suche', await T(page, 500));
    }
    L(name, 'ERRS', JSON.stringify(errs));
    await ctx.close();
  }
  await browser.close();
})();
