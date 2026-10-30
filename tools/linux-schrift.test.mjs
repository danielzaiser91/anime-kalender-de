/* Belegt: Der Override legt DejaVu wirklich über die Seitenschrift (Familie geladen, Breite ändert sich, Titel serifig). */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { installiereLinuxSchrift, linuxSchriftCss, SCHNITTE } from './linux-schrift.mjs'

const SEITE = `<!doctype html><html><head><style>
:root{--ak-schrift-text:'Arial',sans-serif;--ak-schrift-titel:'Georgia',serif}
body{font-family:var(--ak-schrift-text);font-size:16px}h1{font-family:var(--ak-schrift-titel)}
</style></head><body><h1 id="t">Datenbank</h1><span id="s">Woche Monat Datenbank Heute</span></body></html>`

const css = linuxSchriftCss()
assert.equal(SCHNITTE.length, 4)
assert.match(css, /--ak-schrift-text:'AkLinuxSans'/)
assert.match(css, /--ak-schrift-titel:'AkLinuxSerif'/)

async function messe(mitOverride) {
  const browser = await chromium.launch()
  try {
    const seite = await browser.newPage()
    await seite.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: SEITE }))
    if (mitOverride) await installiereLinuxSchrift(seite)
    await seite.goto('http://ak.test/')
    await seite.evaluate(() => document.fonts.ready)
    return await seite.evaluate(() => ({
      breite: document.getElementById('s').getBoundingClientRect().width,
      familie: getComputedStyle(document.getElementById('s')).fontFamily,
      titel: getComputedStyle(document.getElementById('t')).fontFamily,
      geladen: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
    }))
  } finally {
    await browser.close()
  }
}

const ohne = await messe(false)
const mit = await messe(true)
assert.deepEqual(ohne.geladen, [], 'ohne Override wird keine Schriftdatei geladen')
assert.match(mit.familie, /AkLinuxSans/)
assert.match(mit.titel, /AkLinuxSerif/)
assert.ok(mit.geladen.includes('AkLinuxSans'), 'DejaVu Sans geladen')
assert.ok(mit.geladen.includes('AkLinuxSerif'), 'DejaVu Serif geladen')
assert.notEqual(mit.breite, ohne.breite, 'Textbreite ändert sich durch den Override')
console.log(`linux-schrift: ok (Breite ohne ${ohne.breite.toFixed(1)} px, mit ${mit.breite.toFixed(1)} px, geladen: ${mit.geladen.join(', ')})`)
