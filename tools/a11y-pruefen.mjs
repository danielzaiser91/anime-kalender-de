// Barrierefreiheit: axe-core (vom CDN) über alle Ansichten, beide Themen, gegen dist/. Aufruf: npx vite build && node tools/a11y-pruefen.mjs (18.09.2026)
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
const DIST = path.resolve('dist')
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
const b = await chromium.launch()
const s = await b.newPage({ viewport: { width: 1280, height: 900 } })
await s.route('**/*', async (r) => {
  const u = new URL(r.request().url())
  if (u.hostname === 'cdn.jsdelivr.net') return r.continue()
  if (u.hostname !== 'ak.test') return r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') })
  const d = path.join(DIST, u.pathname === '/' ? '/index.html' : u.pathname)
  if (!existsSync(d)) return r.fulfill({ status: 404, body: '' })
  return r.fulfill({ status: 200, contentType: T[path.extname(d)] ?? 'application/octet-stream', body: await readFile(d) })
})
const gesamt = new Map()
for (const thema of ['light', 'dark']) {
  await s.emulateMedia({ colorScheme: thema })
  for (const v of ['woche', 'monat', 'agenda', 'datenbank', 'favoriten', 'wo', 'news', 'abo', 'newsletter', 'quellen', 'woche?t=170083']) {
    await s.goto('about:blank')
    await s.goto(`http://ak.test/#/${v}`, { waitUntil: 'networkidle' })
    await s.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js' })
    const res = await s.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, beispiel: x.nodes[0]?.target?.join(' '), text: x.nodes[0]?.failureSummary?.split('\n')[1] })))
    for (const r of res) {
      const k = `${r.id} (${r.impact})`
      const e = gesamt.get(k) ?? { n: 0, wo: new Set(), beispiel: r.beispiel, text: r.text }
      e.n += r.n; e.wo.add(`${v}/${thema}`); gesamt.set(k, e)
    }
  }
}
for (const [k, e] of [...gesamt].sort((a, b) => b[1].n - a[1].n)) console.log(`${k}: ${e.n} Knoten in ${e.wo.size} Ansichten — z. B. ${e.beispiel} — ${e.text ?? ''}`.slice(0, 300))
await b.close()
