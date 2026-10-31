/**
 * Test: `zeileMittig` holt eine Zeile unter den sticky Kopf hervor, `scrollIntoViewIfNeeded` (alter Weg) nicht; `verdeckung`
 * meldet die Verdeckung. Seite wie die Woche am Samstag: Scroll am Maximum, einzige Zeile bei y=36 unter dem 60 px hohen Kopf.
 * Aufruf: node tools/zeile-mittig.test.mjs
 */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { verdeckung, zeileMittig } from './zeile-mittig.mjs'

const HOEHE = 600
const SEITE = `<body style="margin:0"><header style="position:sticky;top:0;height:60px;background:#ccc">Kopf</header>
<div style="height:2000px"></div><ul style="margin:0;padding:0"><li id="z" style="height:40px">Zeile</li></ul>
<div style="height:${HOEHE - 36 - 40}px"></div></body>`

const browser = await chromium.launch()
try {
  const seite = await browser.newPage({ viewport: { width: 800, height: HOEHE } })
  await seite.setContent(SEITE)
  const zeile = seite.locator('#z')
  const mitte = async () => {
    const b = await zeile.boundingBox()
    return [b.x + 40, b.y + b.height / 2]
  }

  await seite.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await zeile.scrollIntoViewIfNeeded()
  const [alterX, alterY] = await mitte()
  assert.equal(Math.round((await zeile.boundingBox()).y), 36, 'Kulisse: Zeile liegt bei y=36')
  const alt = await verdeckung(zeile, alterX, alterY)
  assert.match(alt, /^Zeile vom Kopf verdeckt/, 'alter Weg: Zeile bleibt unter dem Kopf, Verdeckung wird gemeldet')

  await zeileMittig(zeile)
  const [x, y] = await mitte()
  assert.ok(Math.abs(y - HOEHE / 2) < 30, `neuer Weg: Zeile liegt mittig (y=${y})`)
  assert.equal(await verdeckung(zeile, x, y), null, 'neuer Weg: Zeile wird getroffen')

  /* Ein Kind der Zeile zählt als Treffer. */
  await seite.evaluate(() => { document.querySelector('#z').innerHTML = '<b style="display:block;height:40px">Kind</b>' })
  assert.equal(await verdeckung(zeile, x, y), null, 'Kind der Zeile zählt als Treffer')
  console.log('zeile-mittig.test: 4 Zusicherungen grün (alter Weg rot, neuer Weg grün, Kind, Kulisse)')
} finally {
  await browser.close()
}
