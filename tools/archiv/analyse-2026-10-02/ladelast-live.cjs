// Messskript aus der Analysesitzung vom 02.10.2026 (docs/wissen/sitzung-2026-10-02-analyse-und-umstellung.md). Einmalig, Pfade zum Scratchpad ggf. anpassen.
const { request } = require('C:/code/ai/anime-kalender-de/node_modules/playwright');
(async () => {
  const ctx = await request.newContext({ extraHTTPHeaders: { 'accept-encoding': 'gzip' } });
  const base = 'https://anime-kalender.de/';
  const html = await (await ctx.get(base)).text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => m[1]);
  const urls = [...assets, ...['meta.json','titles-core.json','releases.json','events.json','news.json','franchises.json','synonyme.json','cartoons.json','titles.json','ohne-synchro.json'].map(f => 'data/' + f)];
  let startup = 0;
  for (const u of urls) {
    const r = await ctx.get(new URL(u, base).toString());
    const gz = +(r.headers()['content-length'] || 0); const raw = (await r.body()).length;
    console.log(u.padEnd(34), 'wire=' + (gz / 1024).toFixed(0) + 'KB', 'body=' + (raw / 1024).toFixed(0) + 'KB', r.headers()['content-encoding'] || '');
    if (/index|\.css|meta|core|releases|events/.test(u)) startup += gz;
  }
  console.log('startup wire total ~', (startup / 1024).toFixed(0), 'KB');
})();
