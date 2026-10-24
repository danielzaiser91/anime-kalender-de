/**
 * Browsermessung zum alten Icon im Service-Worker-Cache (23.10.2026): Ein Besucher mit dem alten Worker hat das alte Icon
 * im Cache; ändert sich das Icon und der Worker, muss das neue ankommen.
 * Ohne Server: `page.route()` beantwortet alles aus zwei übergebenen Worker-Dateien und zwei Icon-Fassungen.
 * Der Worker wird per Abmelden, Neuladen und Anmelden ersetzt (der Update-Abruf umgeht `page.route`); die Caches bleiben.
 * Aufruf: `node tools/sw-icon-messung.mjs <alter-sw.js> <neuer-sw.js>` (alt z. B. aus `git show origin/main:public/sw.js`).
 * Kontrolle: bleibt der alte Worker, kommt das alte Icon weiter (Fehlerbild von Daniel); mit dem neuen Worker das neue.
 */
import fs from 'node:fs'
import { chromium } from 'playwright'

const ALT_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#38bdf8"/></svg>'
const NEU_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#ff5a36"/></svg>'
const INDEX = '<!doctype html><html><head><link rel="icon" href="/icons/icon.svg"></head><body>x</body></html>'

/** Beantwortet jede Anfrage aus dem aktuellen Stand der Welt. */
function antworter(welt) {
  return async (route) => {
    const pfad = new URL(route.request().url()).pathname
    const tabelle = {
      '/': ['text/html', INDEX],
      '/manifest.webmanifest': ['application/json', '{}'],
      '/sw.js': ['text/javascript', welt.sw],
      '/icons/icon.svg': ['image/svg+xml', welt.svg],
    }
    const treffer = tabelle[pfad]
    if (!treffer) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: treffer[0], body: treffer[1] })
  }
}

async function holeIcon(seite) {
  return seite.evaluate(async () => (await fetch('/icons/icon.svg')).text())
}

/**
 * Läuft im Browser. Der Update-Abruf des Worker-Skripts läuft an `page.route` vorbei; darum Abmelden und neu
 * Anmelden. Die Cache-Speicher bleiben dabei erhalten, nur sie entscheiden, welches Icon ankommt.
 */
async function meldeAb() {
  await (await navigator.serviceWorker.getRegistration()).unregister()
}

async function registriereNeu() {
  await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
}

async function warteAufWorker(seite, neuerName) {
  for (let i = 0; i < 30; i++) {
    const keys = await seite.evaluate(() => caches.keys())
    if (keys.includes(neuerName)) return
    await seite.waitForTimeout(500)
  }
  throw new Error(`Cache ${neuerName} nicht entstanden: neuer Worker wurde nicht installiert`)
}

/** Ein Besucher: alter Worker legt das alte Icon ab, dann ändert sich Icon (und je nach Fall der Worker). */
async function besucher(alterSw, spaeterSw, neuerCacheName) {
  const welt = { sw: alterSw, svg: ALT_SVG }
  const browser = await chromium.launch()
  const kontext = await browser.newContext()
  await kontext.route('**/*', antworter(welt))
  const seite = await kontext.newPage()
  await seite.goto('http://localhost/')
  await seite.evaluate(() => navigator.serviceWorker.register('/sw.js'))
  await seite.evaluate(() => navigator.serviceWorker.ready)
  await seite.reload()
  const vorher = await holeIcon(seite)
  welt.sw = spaeterSw
  welt.svg = NEU_SVG
  await seite.reload()
  await seite.evaluate(meldeAb)
  await seite.reload()
  await seite.evaluate(registriereNeu)
  if (neuerCacheName) await warteAufWorker(seite, neuerCacheName)
  await seite.waitForTimeout(1500)
  const nachher = await holeIcon(seite)
  const zweiterAbruf = await holeIcon(seite)
  await browser.close()
  return { vorher, nachher, zweiterAbruf }
}

const farbe = (svg) => (svg.match(/#[0-9a-f]{6}/i) ?? ['?'])[0]
const [altDatei, neuDatei] = process.argv.slice(2)
const alt = fs.readFileSync(altDatei, 'utf8')
const neu = fs.readFileSync(neuDatei, 'utf8')
const kontrolle = await besucher(alt, alt, null)
const mitFix = await besucher(alt, neu, 'fest-v4')
console.log(`Kontrolle (Worker bleibt alt): vorher ${farbe(kontrolle.vorher)}, nach Icon-Wechsel ${farbe(kontrolle.nachher)}`)
console.log(`Mit neuem Worker: vorher ${farbe(mitFix.vorher)}, nach Wechsel ${farbe(mitFix.nachher)}, zweiter Abruf ${farbe(mitFix.zweiterAbruf)}`)
const ok = farbe(kontrolle.nachher) === '#38bdf8' && farbe(mitFix.nachher) === '#ff5a36' && farbe(mitFix.zweiterAbruf) === '#ff5a36'
console.log(ok ? 'sw-icon-messung: ok' : 'sw-icon-messung: FEHLER')
process.exit(ok ? 0 : 1)
