// Barrierefreiheit: axe-core (vom CDN) über alle Ansichten, beide Themen, gegen dist/.
// Aufruf: npx vite build && node tools/a11y-pruefen.mjs [--kontrast] [--hell|--dunkel]  (18.09.2026)
//   --kontrast  gruppiert die Kontrastfehler nach Farbpaar statt nach Regel
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve('dist')
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
const PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const KONTRAST = process.argv.includes('--kontrast')
const THEMEN = process.argv.includes('--hell') ? ['light'] : process.argv.includes('--dunkel') ? ['dark'] : ['light', 'dark']
const ANSICHTEN = ['woche', 'monat', 'agenda', 'datenbank', 'favoriten', 'wo', 'news', 'abo', 'newsletter', 'quellen', 'woche?t=170083']

const b = await chromium.launch()
const s = await b.newPage({ viewport: { width: 1280, height: 900 } })
await s.route('**/*', async (r) => {
  const u = new URL(r.request().url())
  if (u.hostname === 'cdn.jsdelivr.net') return r.continue()
  if (u.hostname !== 'ak.test') return r.fulfill({ status: 200, contentType: 'image/png', body: PUNKT })
  const d = path.join(DIST, u.pathname === '/' ? '/index.html' : u.pathname)
  if (!existsSync(d)) return r.fulfill({ status: 404, body: '' })
  return r.fulfill({ status: 200, contentType: T[path.extname(d)] ?? 'application/octet-stream', body: await readFile(d) })
})

const gesamt = new Map()
for (const thema of THEMEN) {
  await s.emulateMedia({ colorScheme: thema })
  for (const v of ANSICHTEN) {
    await s.goto('about:blank')
    await s.goto(`http://ak.test/#/${v}`, { waitUntil: 'networkidle' })
    await s.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js' })
    const befunde = await s.evaluate(async (kontrast) => {
      const r = await window.axe.run(document, kontrast ? { runOnly: ['color-contrast'] } : {})
      return r.violations.flatMap((x) =>
        kontrast
          ? x.nodes.map((n) => {
              const d = n.any[0]?.data ?? {}
              return { schluessel: `${d.fgColor} auf ${d.bgColor} (${d.contrastRatio})`, beispiel: n.target.join(' ') }
            })
          : [{ schluessel: `${x.id} (${x.impact})`, anzahl: x.nodes.length, beispiel: x.nodes[0]?.target?.join(' '), text: x.nodes[0]?.failureSummary?.split('\n')[1] }],
      )
    }, KONTRAST)
    for (const f of befunde) {
      const e = gesamt.get(f.schluessel) ?? { n: 0, wo: new Set(), beispiel: f.beispiel, text: f.text }
      e.n += f.anzahl ?? 1
      e.wo.add(`${v}/${thema}`)
      gesamt.set(f.schluessel, e)
    }
  }
}
for (const [k, e] of [...gesamt].sort((a, c) => c[1].n - a[1].n))
  console.log(`${k}: ${e.n} Knoten in ${e.wo.size} Ansichten — z. B. ${e.beispiel}${e.text ? ` — ${e.text}` : ''}`.slice(0, 260))
if (!gesamt.size) console.log('ok  keine Verstöße')
await b.close()
