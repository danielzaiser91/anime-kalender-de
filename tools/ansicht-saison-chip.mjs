/**
 * Saison-Karte mit Anbieter-Chips „Deutsch laut Anbieter“ (Handy 360 px, beide Themen), gemessen in der gebauten App an den echten Karten:
 *  - eine Karte mit gestricheltem Chip trägt die Zeile „<Anbieter>: Deutsch laut Anbieter“; eine Karte ohne trägt weder Strich noch Zeile;
 *  - Karte >= 44 px hoch, Chips und Zeile ragen nicht über den Kartenrand, Seite ohne seitlichen Überlauf.
 * Regeln als reine Funktionen in `saison-chip-urteil.mjs`. Ohne Server: `page.route()` liefert `dist/`.
 * Aufruf allein: `node tools/ansicht-saison-chip.mjs [--dist <ordner>]`; in `ansicht-bild.mjs --handy` als Zusatzprüfung.
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { urteilKarte, urteilSeite } from './saison-chip-urteil.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' }
const COVER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#4a5a80"/></svg>'
const ZEILE = /Deutsch laut Anbieter/

function antworter(dist) {
  return async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: COVER_SVG })
    const datei = path.join(dist, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
  }
}

/** Misst die erste Karte mit und die erste ohne Zeile „laut Anbieter“, die einen Chip hat. Läuft im Browser. */
function messeKarten(zeilenText) {
  const muster = new RegExp(zeilenText)
  const karten = [...document.querySelectorAll('li > button')]
  const lies = (knopf) => {
    const k = knopf.getBoundingClientRect()
    const chips = [...knopf.querySelectorAll('span[data-anbieter-chip]')]
    const zeile = [...knopf.querySelectorAll('span')].find((s) => s.children.length === 0 && muster.test(s.textContent ?? ''))
    return {
      knopfHoehe: Math.round(k.height * 10) / 10,
      knopfRechts: k.right,
      chipsRechts: chips.map((c) => c.getBoundingClientRect().right),
      zeileRechts: zeile ? zeile.getBoundingClientRect().right : null,
      gestrichelt: chips.filter((c) => getComputedStyle(c).borderTopStyle === 'dashed').length,
      laut: Boolean(zeile),
    }
  }
  const hatChip = (knopf) => knopf.querySelectorAll('span[data-anbieter-chip]').length > 0
  const laut = karten.find((k) => muster.test(k.textContent ?? ''))
  const belegt = karten.find((k) => hatChip(k) && !muster.test(k.textContent ?? ''))
  return { laut: laut ? lies(laut) : null, belegt: belegt ? lies(belegt) : null, scroll: document.documentElement.scrollWidth, fenster: innerWidth, karten: karten.length }
}

async function messeThema(browser, dist, thema) {
  const kontext = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
  await kontext.addInitScript(() => {
    localStorage.setItem('kennung:ak1', '1')
    localStorage.setItem('kennung:umleitung', '999999')
  })
  const seite = await kontext.newPage()
  await seite.route('**/*', antworter(dist))
  await seite.goto('http://ak.test/#/saison', { waitUntil: 'networkidle' })
  await seite.locator('li > button').first().waitFor({ timeout: 20_000 })
  await seite.waitForTimeout(1500)
  const m = await seite.evaluate(messeKarten, ZEILE.source)
  await kontext.close()
  const fehler = [...urteilSeite(m.scroll, m.fenster)]
  if (m.laut) fehler.push(...urteilKarte(m.laut, 'gekennzeichnet').map((f) => `gekennzeichnete Karte: ${f}`))
  else fehler.push('keine Karte mit „Deutsch laut Anbieter“ in den Daten (Messung hätte nichts gemessen)')
  if (m.belegt) fehler.push(...urteilKarte(m.belegt, 'belegt').map((f) => `belegte Karte: ${f}`))
  else fehler.push('keine Karte mit belegtem Chip in den Daten')
  return { thema, karten: m.karten, fehler }
}

/** Prüft beide Themen; gibt je Thema Messwerte und Fehler zurück (`fehler` leer = in Ordnung). */
export async function pruefeSaisonChip(dist) {
  const browser = await chromium.launch()
  try {
    const ergebnisse = []
    for (const thema of ['dunkel', 'hell']) ergebnisse.push(await messeThema(browser, dist, thema))
    return ergebnisse
  } finally {
    await browser.close()
  }
}

/** Schreibt das Ergebnis; wahr, wenn rot. */
export function meldeSaisonChip(ergebnisse) {
  const rot = ergebnisse.some((e) => e.fehler.length)
  console.log(`\nSaison-Karte mit Anbieter-Chips „laut Anbieter“ (360 px, beide Themen): ${rot ? '' : 'ok'}`)
  for (const e of ergebnisse) {
    console.log(`  ${e.thema}: ${e.karten} Karten`)
    for (const f of e.fehler) console.log(`  ✕ ${e.thema}: ${f}`)
  }
  return rot
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--dist')
  const dist = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(WURZEL, 'dist')
  process.exit(meldeSaisonChip(await pruefeSaisonChip(dist)) ? 1 : 0)
}
