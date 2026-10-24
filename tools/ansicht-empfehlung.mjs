#!/usr/bin/env node
/**
 * Bildet „Was gucken?“ (`#/empfehlung`) in allen Stufen ab und misst: Einleitung → Duell → Vorschläge → Leinwand → zweite Ebene,
 * Handy 360 × 780 und Rechner 1440 × 900, hell und dunkel. `check:ansichten` zeigt von der Route nur die Einleitung; hier läuft
 * die Reise wirklich (sechs Duelle durchgeklickt) gegen die gebaute App.
 *
 * Geprüft je Fall: keine Konsolenfehler, kein waagerechtes Scrollen, jede sichtbare Schaltfläche ≥ 44 px hoch, Unterkante und
 * Ecken der Vorschlags-Cover an Pixeln (Ecke rund, Unterkante und die Zeilen darunter mit und ohne Favorit gleich, Plakette im Cover).
 * Ohne Server: `page.route()` liefert `dist/` (vorher bauen); fremde Bilder werden durch einen Farbverlauf ersetzt.
 * Aufruf: `node tools/ansicht-empfehlung.mjs [--bilder <ordner>]`. Ergebniszeile: „ansicht-empfehlung: ok (…)“, sonst Exit 1.
 */
import { chromium } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { distPruefen } from './dist-frisch.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const GERAETE = [
  { name: 'handy', breite: 360, hoehe: 780, mobil: true },
  { name: 'desktop', breite: 1440, hoehe: 900, mobil: false },
]
const THEMEN = ['dunkel', 'hell']
const MIN_TIPPFLAECHE = 43.5
/** Mindestabstand (Summe der Farbkanäle), ab dem zwei Pixel als verschieden gelten. */
const VERSCHIEDEN = 12

function verlauf(url) {
  let h = 0
  for (const c of url) h = (h * 31 + c.charCodeAt(0)) % 360
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 60% 45%)"/><stop offset="1" stop-color="hsl(${(h + 60) % 360} 60% 25%)"/></linearGradient></defs><rect width="400" height="600" fill="url(#g)"/></svg>`)
}

async function antworte(route) {
  const url = new URL(route.request().url())
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: verlauf(url.href) })
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
}

/** Liest Pixel aus einem PNG. Läuft im Browser. */
async function lesePixel({ png, punkte }) {
  const bild = new Image()
  bild.src = `data:image/png;base64,${png}`
  await bild.decode()
  const leinwand = document.createElement('canvas')
  leinwand.width = bild.width
  leinwand.height = bild.height
  const g = leinwand.getContext('2d')
  g.drawImage(bild, 0, 0)
  return punkte.map(([x, y]) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3))
}

const abstand = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)

/** Alle sichtbaren Schaltflächen und Links der Fläche, die niedriger als 44 px sind. */
function zuNiedrig(min) {
  return [...document.querySelectorAll('.empf button, .empf a')]
    .filter((b) => !b.closest('[inert]') && b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height < min)
    .map((b) => `${b.textContent?.trim().slice(0, 24)} (${Math.round(b.getBoundingClientRect().height)} px)`)
}

const COVER = '.empf ul > li:first-child button.empf-kandidat'

async function messeCover(seite) {
  await seite.mouse.move(1, 1)
  await seite.waitForTimeout(500)
  const r = await seite.locator(COVER).evaluate((e) => {
    const b = e.getBoundingClientRect()
    const p = e.querySelector('span[aria-hidden]')?.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height, plakette: p ? { x: p.x, y: p.y, w: p.width, h: p.height } : null }
  })
  const x = Math.round(r.x)
  const y = Math.round(r.y)
  const w = Math.round(r.w)
  const h = Math.round(r.h)
  const punkte = [[x + 1, y + 1], [x + 18, y + 18], [x + w - 2, y + h - 2], [x + w - 19, y + h - 19], ...[1, 2, 3, 4].map((d) => [x + Math.round(w / 2), y + h - 1 + d])]
  const png = (await seite.screenshot()).toString('base64')
  return { r, farben: await seite.evaluate(lesePixel, { png, punkte }) }
}

/** Ecken rund, Unterkante und Zeilen darunter mit und ohne Favorit gleich, Plakette im Cover. */
function pruefeCover(ohne, mit) {
  const fehler = []
  const [ecke, innen, eckeU, innenU] = ohne.farben
  if (abstand(ecke, innen) < VERSCHIEDEN) fehler.push('obere linke Ecke ist nicht rund (Pixel gleich dem Innern)')
  if (abstand(eckeU, innenU) < VERSCHIEDEN) fehler.push('untere rechte Ecke ist nicht rund')
  if (Math.round(ohne.r.y + ohne.r.h) !== Math.round(mit.r.y + mit.r.h)) fehler.push('Unterkante des Covers verschiebt sich mit Favorit')
  ohne.farben.slice(4).forEach((f, i) => {
    if (abstand(f, mit.farben[4 + i]) >= VERSCHIEDEN) fehler.push(`Zeile ${i + 1} unter dem Cover ändert sich mit Favorit (Ringrest)`)
  })
  const p = mit.r.plakette
  const c = mit.r
  if (!p) fehler.push('keine ★-Plakette mit Favorit')
  else if (p.x < c.x || p.y < c.y || p.x + p.w > c.x + c.w || p.y + p.h > c.y + c.h) fehler.push('★-Plakette ragt aus dem Cover')
  return fehler
}

async function spieleFall(browser, geraet, thema, bilder) {
  const kontext = await browser.newContext({
    viewport: { width: geraet.breite, height: geraet.hoehe },
    isMobile: geraet.mobil,
    hasTouch: geraet.mobil,
    colorScheme: thema === 'dunkel' ? 'dark' : 'light',
  })
  const seite = await kontext.newPage()
  const fehler = []
  const kennung = `${geraet.name}/${thema}`
  seite.on('console', (m) => m.type() === 'error' && fehler.push(`${kennung}: Konsole ${m.text().slice(0, 140)}`))
  seite.on('pageerror', (e) => fehler.push(`${kennung}: ${String(e).slice(0, 140)}`))
  await seite.route('**/*', antworte)
  const bild = (stufe) => bilder && seite.screenshot({ path: path.join(bilder, `empfehlung-${stufe}-${geraet.name}-${thema}.png`) })
  const los = seite.getByRole('button', { name: "Los geht's" })
  await seite.goto('http://ak.test/#/empfehlung', { waitUntil: 'networkidle' })
  await los.waitFor({ timeout: 20_000 })
  await seite.waitForTimeout(1200)
  await bild('1-einleitung')
  await los.click()
  await seite.waitForTimeout(900)
  await bild('2-duell')
  for (let i = 0; i < 6; i++) {
    await seite.locator('.empf-kandidat').nth(i % 2).click()
    await seite.waitForTimeout(700)
  }
  await seite.waitForSelector(COVER, { timeout: 10_000 })
  await seite.waitForTimeout(600)
  await bild('3-vorschlaege')
  const niedrig = await seite.evaluate(zuNiedrig, MIN_TIPPFLAECHE)
  if (niedrig.length) fehler.push(`${kennung}: Tippfläche unter 44 px: ${niedrig.join(' | ')}`)
  const ohne = await messeCover(seite)
  await seite.locator('.empf ul > li:first-child button[aria-pressed]').click()
  const mit = await messeCover(seite)
  for (const f of pruefeCover(ohne, mit)) fehler.push(`${kennung}: ${f}`)
  await seite.locator(COVER).click()
  await seite.waitForTimeout(1200)
  await bild('4-leinwand')
  await seite.locator('.empf-szene').evaluate((e) => e.scrollTo({ top: e.clientHeight, behavior: 'instant' }))
  await seite.waitForTimeout(600)
  await bild('5-ebene2')
  const breit = await seite.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (breit > 0) fehler.push(`${kennung}: Seite scrollt waagerecht um ${breit} px`)
  await kontext.close()
  return fehler
}

async function main() {
  if (!distPruefen(WURZEL)) return
  const i = process.argv.indexOf('--bilder')
  const bilder = i > 0 ? path.resolve(process.argv[i + 1]) : undefined
  if (bilder) await mkdir(bilder, { recursive: true })
  const browser = await chromium.launch()
  const fehler = []
  let faelle = 0
  for (const geraet of GERAETE) {
    for (const thema of THEMEN) {
      fehler.push(...(await spieleFall(browser, geraet, thema, bilder)))
      faelle++
    }
  }
  await browser.close()
  if (fehler.length) {
    console.error(fehler.join('\n'))
    console.error(`ansicht-empfehlung: ${fehler.length} Befund(e) in ${faelle} Fällen`)
    process.exitCode = 1
    return
  }
  console.log(`ansicht-empfehlung: ok (${faelle} Fälle: Handy und Rechner, hell und dunkel; 5 Stufen; Konsole, Scrollen, Tippflächen, Ecken und Unterkante der Cover)`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
