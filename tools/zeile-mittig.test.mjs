/**
 * Test: `zeileMittig` holt eine Zeile unter den sticky Kopf hervor, `scrollIntoViewIfNeeded` (alter Weg) nicht; `verdeckung`
 * meldet die Verdeckung. Seite wie die Woche am Samstag: Scroll am Maximum, einzige Zeile bei y=36 unter dem 60 px hohen Kopf.
 * Aufruf: node tools/zeile-mittig.test.mjs
 */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { browserDa } from './browser-weiche.mjs'
import { sperreNetz } from './netz-sperre.mjs'
import { ruheAbwarten, verdeckung, zeileImFenster, zeileMittig } from './zeile-mittig.mjs'

const HOEHE = 600
const SEITE = `<body style="margin:0"><header style="position:sticky;top:0;height:60px;background:#ccc">Kopf</header>
<div style="height:2000px"></div><ul style="margin:0;padding:0"><li id="z" style="height:40px">Zeile</li></ul>
<div style="height:${HOEHE - 36 - 40}px"></div></body>`

/* Lange Seite; die Zeile liegt bei etwa 3060 px. Der Bildlauf darüber läuft von außen weiter (Schritte je Bild bis 3600) und überholt sie. */
const GLEITEN = `<body style="margin:0"><header style="position:sticky;top:0;height:60px;background:#ccc">Kopf</header>
<div style="height:3000px"></div><ul style="margin:0;padding:0"><li id="z" style="height:40px">Zeile</li></ul><div style="height:3000px"></div></body>`

if (!browserDa('zeile-mittig', chromium)) process.exit()

const browser = await chromium.launch()
try {
  const seite = await browser.newPage({ viewport: { width: 800, height: HOEHE } })
  await sperreNetz(seite)
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
  /* Layout verschiebt die Zeile 60 ms nach dem Scroll aus dem Fenster (Bilder oberhalb laden nach, Verankerung aus). */
  const SPAET = `<body style="margin:0;overflow-anchor:none"><div id="s" style="height:3000px"></div>
<ul style="margin:0;padding:0"><li id="z" style="height:40px">Zeile</li></ul><div style="height:3000px"></div></body>`
  const kulisse = async () => {
    await seite.setContent(SPAET)
    await seite.evaluate(() => setTimeout(() => { document.querySelector('#s').style.height = '1500px' }, 60))
  }
  await kulisse()
  await seite.evaluate(() => document.querySelector('#z').scrollIntoView({ block: 'center' }))
  await seite.waitForTimeout(150)
  const verschoben = await zeile.boundingBox()
  assert.ok(verschoben.y < 0, `Kulisse: einmaliges Zentrieren lässt die Zeile aus dem Fenster rutschen (y=${verschoben.y})`)
  await kulisse()
  await zeileMittig(zeile)
  await seite.waitForTimeout(150)
  const spaet = await zeile.boundingBox()
  assert.ok(Math.abs(spaet.y + 20 - HOEHE / 2) < 30, `späte Verschiebung: Zeile liegt danach mittig (y=${spaet.y})`)
  assert.equal(await verdeckung(zeile, spaet.x + 40, spaet.y + 20), null, 'späte Verschiebung: Zeile wird getroffen')
  /* zeileImFenster: holt die ausgerutschte Zeile zurück, lässt eine bewusst tiefe Lage (unten am Fenster) stehen. */
  await kulisse()
  await seite.evaluate(() => document.querySelector('#z').scrollIntoView({ block: 'center' }))
  await zeileImFenster(zeile)
  await seite.waitForTimeout(150)
  const zurueck = await zeile.boundingBox()
  assert.ok(zurueck.y >= 0 && zurueck.y < HOEHE, `zeileImFenster: ausgerutschte Zeile kommt zurück (y=${zurueck.y})`)
  await seite.evaluate(() => { const z = document.querySelector('#z'); window.scrollBy(0, z.getBoundingClientRect().top - 500) })
  const unten = (await zeile.boundingBox()).y
  await zeileImFenster(zeile)
  assert.equal((await zeile.boundingBox()).y, unten, 'zeileImFenster: Zeile unten am Fenster bleibt dort')
  /* ruheAbwarten: Gleiten läuft noch (Bildlauf bis 3600 px, 40 px je Bild), danach steht die Lage und ändert sich nicht mehr. */
  await seite.setContent(GLEITEN)
  await seite.evaluate(() => scrollTo(0, 0))
  await seite.evaluate(() => {
    let bilder = 0
    const schritt = () => {
      bilder += 1
      scrollTo(0, Math.min(3600, bilder * 40))
      if (bilder * 40 < 3600) requestAnimationFrame(schritt)
    }
    requestAnimationFrame(schritt)
  })
  await seite.waitForTimeout(100)
  const mittendrin = await seite.evaluate(() => scrollY)
  assert.ok(mittendrin < 3600, `Kulisse: Gleiten läuft noch (scrollY=${mittendrin})`)
  await ruheAbwarten(seite)
  const ruhigY = await seite.evaluate(() => scrollY)
  assert.equal(ruhigY, 3600, 'ruheAbwarten kehrt erst nach dem Gleiten zurück')
  await seite.waitForTimeout(200)
  assert.equal(await seite.evaluate(() => scrollY), ruhigY, 'ruheAbwarten: Lage bleibt')
  console.log('zeile-mittig.test: 11 Zusicherungen grün (alter Weg rot, neuer Weg grün, Kind, Kulisse, späte Verschiebung rot/grün, zeileImFenster zurück/stehen, ruheAbwarten Gleiten/Ruhe)')
} finally {
  await browser.close()
}
