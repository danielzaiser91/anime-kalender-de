/**
 * Klick/Tipp aufs Such-Icon der Kopfleiste muss das Suchfeld fokussieren und den Fokus behalten (Issue 4072).
 * Je Versuch: Fokus-Ziel nach 50, 300 und 1000 ms und die Folge der focus/blur-Ereignisse an Eingabefeldern.
 * Aufruf allein: node tools/ansicht-such-icon-fokus.mjs [Versuche]   (liest dist/, Standard 20 je Fall)
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '..', 'dist')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }
const PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const ICON = 'button[aria-label="Suche öffnen"]'
const FAELLE = [
  { name: 'Rechner 1366 Start', start: 'http://ak.test/#/woche', viewport: { width: 1366, height: 900 } },
  { name: 'Handy 390 Start', start: 'http://ak.test/#/woche', viewport: { width: 390, height: 844 }, handy: true },
  { name: 'Handy 390 Datenbank', start: 'http://ak.test/#/datenbank', viewport: { width: 390, height: 844 }, handy: true },
]

async function ausDist(route) {
  const url = new URL(route.request().url())
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: PUNKT })
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
}

/** Läuft im Browser: wer hat den Fokus? „feld“ = sichtbares Suchfeld. */
function fokusZiel() {
  const a = document.activeElement
  if (a instanceof HTMLInputElement && a.type === 'search' && a.offsetParent !== null) return 'feld'
  return a ? `${a.tagName.toLowerCase()}${a.getAttribute('aria-hidden') ? '(versteckt)' : ''}` : 'nichts'
}

/** Läuft im Browser: hängt den Ereignis-Schreiber an. */
function horchen() {
  window.__folge = []
  for (const art of ['focus', 'blur']) {
    document.addEventListener(art, (e) => {
      if (e.target instanceof HTMLInputElement) window.__folge.push(`${art}:${e.target.type}${e.target.getAttribute('aria-hidden') ? '(versteckt)' : ''}`)
    }, true)
  }
}

async function versuch(seite, handy) {
  await seite.evaluate(horchen)
  const icon = seite.locator(ICON).first()
  if (handy) await icon.tap()
  else await icon.click()
  const ziele = []
  let t = 0
  for (const ms of [50, 300, 1000]) {
    await seite.waitForTimeout(ms - t)
    t = ms
    ziele.push(await seite.evaluate(fokusZiel))
  }
  const folge = await seite.evaluate(() => window.__folge)
  return { ziele, folge, ok: ziele[1] === 'feld' && ziele[2] === 'feld' }
}

/** Liefert { zeilen, abweichungen }; `n` Versuche je Fall. */
export async function pruefeSuchIconFokus(chromium, n = 20, antworte = ausDist, { drossel = 1, sofort = false } = {}) {
  const browser = await chromium.launch(process.env.AK_CHROME ? { executablePath: process.env.AK_CHROME } : {})
  const zeilen = []
  const abweichungen = []
  for (const f of FAELLE) {
    const ctx = await browser.newContext({ viewport: f.viewport, hasTouch: !!f.handy, isMobile: !!f.handy })
    const seite = await ctx.newPage()
    await seite.route('**/*', antworte)
    if (drossel > 1) await (await ctx.newCDPSession(seite)).send('Emulation.setCPUThrottlingRate', { rate: drossel })
    let fehl = 0
    let beispiel = ''
    for (let i = 0; i < n; i++) {
      await seite.goto('about:blank')
      await seite.goto(f.start, { waitUntil: sofort ? 'commit' : 'networkidle' })
      await seite.locator(ICON).first().waitFor({ state: 'visible' })
      if (!sofort) await seite.waitForTimeout(300)
      const r = await versuch(seite, f.handy)
      if (!r.ok) {
        fehl++
        beispiel ||= `${r.ziele.join('/')} · ${r.folge.join(' → ')}`
      }
    }
    zeilen.push({ fall: f.name, versuche: n, fehl, beispiel })
    if (fehl) abweichungen.push(`${f.name}: ${fehl} von ${n} ohne Fokus (${beispiel})`)
    await ctx.close()
  }
  await browser.close()
  return { zeilen, abweichungen }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright')
  const r = await pruefeSuchIconFokus(chromium, Number(process.argv[2]) || 20, undefined, { drossel: Number(process.env.AK_DROSSEL) || 1, sofort: !!process.env.AK_SOFORT })
  console.log('| Fall | Versuche | Fehlversuche | Beispiel (Fokus 50/300/1000 ms · Ereignisse) |\n|---|---|---|---|')
  for (const z of r.zeilen) console.log(`| ${z.fall} | ${z.versuche} | ${z.fehl} | ${z.beispiel || '–'} |`)
  process.exit(0)
}
