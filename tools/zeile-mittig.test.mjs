/**
 * Test: `zeileMittig` holt eine Zeile unter den sticky Kopf hervor, `scrollIntoViewIfNeeded` (alter Weg) nicht; `verdeckung`
 * meldet die Verdeckung. Seite wie die Woche am Samstag: Scroll am Maximum, einzige Zeile bei y=36 unter dem 60 px hohen Kopf.
 * Aufruf: node tools/zeile-mittig.test.mjs
 */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { browserDa } from './browser-weiche.mjs'
import { ruheAbwarten, verdeckung, zeileMittig } from './zeile-mittig.mjs'

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
  /* Weiches Gleiten läuft noch, wenn die Probe scrollt (Wochenansicht nach der Ankunft): der alte Weg bleibt falsch stehen, der neue hält die Mitte. */
  const gleiten = async () => {
    await seite.setContent(GLEITEN)
    /* setContent setzt scrollY nicht zurück: Ausgangszustand selbst herstellen, sonst ist der zweite Fall leer. */
    await seite.evaluate(() => scrollTo(0, 0))
    await seite.waitForFunction(() => scrollY === 0)
    await seite.evaluate(() => {
      /* Zielgesteuert wie das weiche Gleiten: Lage nach Bildzahl, unabhängig davon, wohin andere scrollen. */
      let bilder = 0
      const schritt = () => {
        bilder += 1
        scrollTo(0, Math.min(3600, bilder * 40))
        if (bilder * 40 < 3600) requestAnimationFrame(schritt)
      }
      requestAnimationFrame(schritt)
    })
    await seite.waitForTimeout(100)
  }
  await gleiten()
  await zeileMittig(zeile, 0)
  await seite.waitForTimeout(1500)
  const altY = (await zeile.boundingBox()).y
  assert.ok(altY < 0, `Kulisse: einmaliges scrollIntoView wird vom Gleiten überholt (y=${altY})`)
  await gleiten()
  await zeileMittig(zeile)
  await seite.waitForTimeout(1500)
  const neuY = (await zeile.boundingBox()).y
  assert.ok(Math.abs(neuY + 20 - HOEHE / 2) < 30, `Gleiten: Zeile liegt nach dem Warten mittig und bleibt (y=${neuY})`)
  await ruheAbwarten(seite)
  assert.equal((await zeile.boundingBox()).y, neuY, 'ruheAbwarten ändert die Lage nicht')
  /* Frist: endloses Gleiten (Lage ändert sich in jedem Bild) → zeileMittig kehrt nach etwa der Frist zurück und wirft nicht. */
  await seite.setContent(GLEITEN)
  await seite.evaluate(() => {
    let n = 0
    /* Alle 5 ms eine neue Lage (Timer statt Bild, damit sie zwischen zwei Messungen der Probe wechselt). */
    window.gleitTimer = setInterval(() => scrollTo(0, 1000 + ((n++ * 40) % 800)), 5)
  })
  const start = Date.now()
  const grenze = new Promise((_, nein) => setTimeout(() => nein(new Error('zeileMittig kehrt nicht zurück (Frist fehlt)')), 12000))
  await Promise.race([zeileMittig(zeile), grenze])
  const dauer = Date.now() - start
  assert.ok(dauer >= 3500 && dauer < 8000, `Frist: Rückkehr nach etwa 4 s (${dauer} ms)`)
  await seite.evaluate(() => { clearInterval(window.gleitTimer) })
  console.log('zeile-mittig.test: 9 Zusicherungen grün (alter Weg rot, neuer Weg grün, Kind, Kulisse, Gleiten alt rot/neu grün, Ruhe, Frist)')
} finally {
  await browser.close()
}
