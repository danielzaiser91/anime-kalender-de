#!/usr/bin/env node
/**
 * Prüft mit klassischer Bildlaufleiste, dass die Wochenansicht beim Öffnen und Schließen des Detail-Panels stehen bleibt (18.10.2026):
 * die Breite der Wurzelbox (`html`; `clientWidth` zählt reservierten Leistenplatz nicht ab) und die Rechtecke der Kacheln sind mit offenem Panel und danach so wie vorher.
 * Headless-Chromium blendet Bildlaufleisten sonst aus (`--hide-scrollbars`), dann sieht keine Layoutprüfung den Sprung.
 * Aufruf: node tools/panel-sprung.mjs [--dist <Ordner>]     (Teil von `npm run check:panel`)
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { distPruefen } from './dist-frisch.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined)
const DIST = path.resolve(arg('--dist') ?? path.join(WURZEL, 'dist'))
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
/** Unter der Maximalbreite der Seite (1520 px), dort füllen die Kacheln die Breite und merken jede Änderung. */
const BREITE = 1280

export async function beantworte(route) {
  const url = new URL(route.request().url())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
}

/** Breite der Seite (Wurzelbox statt `clientWidth`: das zählt reservierten Leistenplatz nicht ab), Breite der Leiste und gerundete Rechtecke aller Kacheln der Woche. */
export function messeSeite(seite) {
  return seite.evaluate(() => {
    const gerundet = (e) => {
      const r = e.getBoundingClientRect()
      return [r.x, r.y + scrollY, r.width, r.height].map((z) => Math.round(z * 10) / 10)
    }
    return {
      breite: document.documentElement.getBoundingClientRect().width,
      leiste: innerWidth - document.documentElement.getBoundingClientRect().width,
      kacheln: [...document.querySelectorAll('section[data-datum] article')].map(gerundet),
    }
  })
}

/** Texte der Abweichungen zwischen zwei Messungen; leer, wenn die Seite stehen blieb. */
export function unterschiede(vorher, nachher, wann) {
  const fehler = []
  if (vorher.breite !== nachher.breite) fehler.push(`${wann}: Breite ${vorher.breite} → ${nachher.breite} px`)
  const anzahl = vorher.kacheln.filter((k, i) => nachher.kacheln[i]?.join() !== k.join()).length
  if (anzahl) fehler.push(`${wann}: ${anzahl} von ${vorher.kacheln.length} Kacheln verschoben oder verändert`)
  return fehler
}

async function main() {
  if (!distPruefen(WURZEL)) return
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
  const seite = await browser.newPage({ viewport: { width: BREITE, height: 800 } })
  await seite.route('**/*', beantworte)
  await seite.goto('http://ak.test/#/woche', { waitUntil: 'networkidle' })
  const kachel = seite.locator('section[data-datum] article').first()
  await kachel.waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(500)
  const vorher = await messeSeite(seite)
  await kachel.click()
  await seite.locator('[data-panel="titel"] [data-kopf]').waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(600)
  const offen = await messeSeite(seite)
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(600)
  const danach = await messeSeite(seite)
  await browser.close()
  const fehler = [...unterschiede(vorher, offen, 'Panel offen'), ...unterschiede(vorher, danach, 'Panel geschlossen')]
  if (vorher.leiste < 8) fehler.push(`Voraussetzung: klassische Bildlaufleiste fehlt (Breite ${vorher.leiste} px)`)
  if (vorher.kacheln.length < 3) fehler.push(`Voraussetzung: nur ${vorher.kacheln.length} Kacheln in der Woche`)
  console.log(`Panel-Sprung (${BREITE} px, Leiste ${vorher.leiste} px, ${vorher.kacheln.length} Kacheln): ${fehler.length ? '' : 'ok'}`)
  for (const f of fehler) console.log(`  ✕ ${f}`)
  if (fehler.length) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
