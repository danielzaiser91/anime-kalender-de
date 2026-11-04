/**
 * Test: Auf der Netflix-Profilauswahl reagiert jeder Knopf des Kastens auf einen echten Mausklick, auch wenn die Seite `click`
 * per Capture-Listener am Dokument stoppt (Daniel, 04.11.2026: Toggle ging, Prüfliste-Knopf und Debug-Knöpfe nicht).
 * Die Erweiterung läuft echt in Chromium: alle Netflix-Inhaltsskripte aus `manifest.json` (ohne MAIN-Welt) in Manifest-Reihenfolge,
 * `chrome` ist eine Attrappe, die Seite kommt über `route`. Geklickt wird mit der Maus an der Mitte des Knopfs; `elementFromPoint`
 * belegt, dass nichts darüberliegt. Fall A ohne Seitenstopp (Kontrolle), Fall B mit Stopp.
 * Aufruf: node tools/netflix-kasten-klick.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { browserDa } from './browser-weiche.mjs'

const EXT = resolve(import.meta.dirname, '..', 'extension')
const manifest = JSON.parse(readFileSync(resolve(EXT, 'manifest.json'), 'utf8'))
const dateien = manifest.content_scripts
  .filter((c) => c.matches.some((m) => m.includes('www.netflix.com')) && c.world !== 'MAIN')
  .flatMap((c) => c.js)
  .filter((d) => d.endsWith('.js'))
const css = readFileSync(resolve(EXT, 'melder.css'), 'utf8')

const SEITE = '<!doctype html><meta charset="utf-8"><body><div style="margin:200px">Wer schaut gerade?</div></body>'

function attrappe() {
  window.chrome = {
    runtime: { getManifest: () => ({ version: '4.32.65' }), sendMessage: () => Promise.resolve(), onMessage: { addListener() {} }, id: 'x' },
    storage: {
      local: { get: (k, cb) => (cb ? cb({}) : Promise.resolve({})), set: () => Promise.resolve(), remove: () => Promise.resolve() },
      onChanged: { addListener() {} },
    },
  }
}

/** Mitte des Knopfs und ob dort wirklich er liegt. */
const lage = (selektor) =>
  `(() => { const e = document.querySelector(${JSON.stringify(selektor)}); if (!e) return null
    const r = e.getBoundingClientRect(); const x = r.x + r.width / 2; const y = r.y + r.height / 2
    return { x, y, oben: document.elementFromPoint(x, y) === e || e.contains(document.elementFromPoint(x, y)) } })()`

async function klick(seite, selektor, name) {
  const p = await seite.evaluate(lage(selektor))
  assert.ok(p, `${name}: Knopf ${selektor} fehlt`)
  assert.ok(p.oben, `${name}: ${selektor} liegt nicht oben (Überlagerung)`)
  await seite.mouse.click(p.x, p.y)
}

async function fall(browser, seitenStopp) {
  const wo = seitenStopp ? 'mit Seitenstopp' : 'ohne Seitenstopp'
  const seite = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const fehler = []
  seite.on('pageerror', (e) => fehler.push(String(e)))
  await seite.route('https://www.netflix.com/**', (r) => r.fulfill({ contentType: 'text/html', body: SEITE }))
  await seite.addInitScript(attrappe)
  await seite.goto('https://www.netflix.com/browse')
  await seite.addStyleTag({ content: css })
  await seite.evaluate((stopp) => {
    window.__ereignisse = { ruhig: 0, bericht: 0 }
    document.addEventListener('ak-ruhig', () => window.__ereignisse.ruhig++)
    document.addEventListener('ak-report', () => window.__ereignisse.bericht++)
    if (stopp) document.addEventListener('click', (e) => e.stopPropagation(), true)
  }, seitenStopp)
  for (const d of dateien) await seite.evaluate((t) => (0, eval)(t), readFileSync(resolve(EXT, d), 'utf8'))
  await seite.waitForSelector('.ak-debugknopf', { state: 'attached' })
  await seite.waitForSelector('.ak-uebersicht-innen', { state: 'attached' })

  await klick(seite, '.ak-icon', `${wo}: Toggle`)
  await seite.waitForFunction(() => document.querySelector('.ak-icon').ariaExpanded === 'true')
  /* Die Einblendung (0,2 s) verschiebt den Kasten; erst danach stimmen die Koordinaten. */
  await seite.waitForFunction(() => getComputedStyle(document.querySelector('.ak-box')).transform === 'none')
  const ereignisse = () => seite.evaluate(() => window.__ereignisse)
  await klick(seite, '.ak-debugknopf', `${wo}: Ruhemodus`)
  assert.equal((await ereignisse()).ruhig, 1, `${wo}: Ruhemodus-Knopf löst nichts aus`)
  await klick(seite, '.ak-debugpaar:nth-child(2) .ak-debugknopf', `${wo}: Bericht laden`)
  assert.equal((await ereignisse()).bericht, 1, `${wo}: Bericht-Knopf löst nichts aus`)
  await klick(seite, '.ak-uebersicht-innen', `${wo}: Prüfliste-Knopf`)
  await seite.waitForSelector('.ak-dialog', { timeout: 3000 }).catch(() => assert.fail(`${wo}: Prüfliste-Knopf öffnet keinen Dialog`))
  await klick(seite, 'button.ak-zu', `${wo}: Dialog schließen`)
  await seite.waitForSelector('.ak-dialog', { state: 'detached', timeout: 3000 }).catch(() => assert.fail(`${wo}: Schließen-Knopf wirkt nicht`))
  assert.deepEqual(fehler, [], `${wo}: Seitenfehler`)
  /* Verschachtelt wie die Zeilen im Dialog: innen zuerst, `stopPropagation()` innen hält die Zeile auf. */
  await seite.evaluate(() => {
    window.__reihe = []
    const aussen = document.createElement('div')
    aussen.id = 'aussen'
    aussen.style.cssText = 'position:fixed;left:10px;top:10px;width:120px;height:60px;z-index:2147483647;background:#fff'
    for (const [id, stoppt] of [['a', false], ['b', true]]) {
      const k = document.createElement('button')
      k.id = id
      k.textContent = id
      window.akKlick(k, (e) => {
        window.__reihe.push(id)
        if (stoppt) e.stopPropagation()
      })
      aussen.appendChild(k)
    }
    window.akKlick(aussen, () => window.__reihe.push('aussen'))
    document.documentElement.appendChild(aussen)
  })
  await klick(seite, '#a', `${wo}: innerer Knopf`)
  await klick(seite, '#b', `${wo}: innerer Knopf mit stopPropagation`)
  assert.deepEqual(await seite.evaluate(() => window.__reihe), ['a', 'aussen', 'b'], `${wo}: Reihenfolge innen vor außen, Stopp hält die Zeile auf`)
  await seite.context().close()
  console.log(`  ✓ ${wo}: Toggle, Ruhemodus, Bericht, Prüfliste öffnen und schließen`)
}

if (!browserDa('netflix-kasten-klick', chromium)) process.exit()
const browser = await chromium.launch()
try {
  await fall(browser, false)
  await fall(browser, true)
  console.log('netflix-kasten-klick: 2 Fälle ✓')
} finally {
  await browser.close()
}
